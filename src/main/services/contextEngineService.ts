import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contextDigestStoreService } from './contextDigestStoreService';
import { summarizationAgentService } from './summarizationAgentService';
import { getRegistryRuntimeConfig } from './registryRuntimeService';
import {
  ContextProvider,
  tokenManagerService,
} from './tokenManagerService';

export type ContextMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ContextTokenBudget {
  maxTokens: number;
  reservedOutputTokens: number;
  compactThresholdTokens: number;
  highWaterMarkRatio: number;
}

export interface ContextModelConfig {
  provider: ContextProvider;
  model?: string;
  contextWindow?: number;          // Runtime context window override (e.g., from user provider config)
  reservedOutputTokens?: number;   // Runtime reserved output tokens override
}

export interface ContextMessageEnvelope {
  id: string;
  role: ContextMessageRole;
  content: string;
  tokenEstimate: number;
  createdAt: string;
}

export interface ContextSessionState {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  totalTokens: number;
  messageCount: number;
  compactionCount: number;
  lastCompactionAt: string | null;
  lastDigestId: string | null;
  summary: string | null;
  budget: ContextTokenBudget;
  modelConfig: ContextModelConfig;
}

export interface ContextAssembleResult {
  sessionId: string;
  usedTokens: number;
  budgetTokens: number;
  droppedMessageCount: number;
  messages: ContextMessageEnvelope[];
}

export interface ContextCompactionResult {
  sessionId: string;
  beforeTokens: number;
  afterTokens: number;
  removedMessages: number;
  digestId: string;
  summary: string;
  compactedAt: string;
}

export interface ContextNewSessionPreview {
  sourceSessionId: string;
  suggestedSessionId: string;
  summary: string;
  generatedAt: string;
}

export interface ContextStartNewResult {
  sourceSessionId: string;
  targetSessionId: string;
  carriedSummary: string;
  state: ContextSessionState;
}

export interface ContextEvent {
  id: string;
  sessionId: string;
  type: 'threshold_reached' | 'compaction_started' | 'compaction_completed' | 'new_context_prepared' | 'new_context_started';
  message: string;
  createdAt: string;
}

export interface ContextEngineTelemetry {
  activeSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCompactions: number;
  hottestSessionId: string | null;
  hottestSessionTokens: number;
  recentEvents: ContextEvent[];
}

interface ContextSessionRecord {
  state: ContextSessionState;
  messages: ContextMessageEnvelope[];
}

interface ContextMetadataSnapshot {
  companyIdentity: string;
  productFocus: string;
  source: string;
}

const DEFAULT_BUDGET: ContextTokenBudget = {
  maxTokens: 32_000,
  reservedOutputTokens: 2_000,
  compactThresholdTokens: 25_600,
  highWaterMarkRatio: 0.8,
};

const MIN_BUDGET_TOKENS = 1_024;
const MIN_RESERVED_OUTPUT_TOKENS = 256;
const MAX_MESSAGES_AFTER_COMPACTION = 10;
const MAX_EVENTS = 30;
const CONTEXT_METADATA_FILE_COMPANY = join('company', 'company-core.json');
const CONTEXT_METADATA_FILE_PRODUCT = join('company', 'product-details.json');

const nowIso = (): string => new Date().toISOString();

const estimateTokens = (content: string): number => {
  return tokenManagerService.countTextTokens(content);
};

const events: ContextEvent[] = [];
const pendingNewContextPreviews = new Map<string, ContextNewSessionPreview>();

const emitEvent = (
  sessionId: string,
  type: ContextEvent['type'],
  message: string,
): void => {
  events.push({
    id: `ctxevt_${randomUUID()}`,
    sessionId,
    type,
    message,
    createdAt: nowIso(),
  });

  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
};

const loadContextMetadata = (): ContextMetadataSnapshot => {
  const root = getRegistryRuntimeConfig().registryRoot;
  const companyPath = join(root, CONTEXT_METADATA_FILE_COMPANY);
  const productPath = join(root, CONTEXT_METADATA_FILE_PRODUCT);

  const fallback: ContextMetadataSnapshot = {
    companyIdentity: 'unknown-company',
    productFocus: 'unknown-product-focus',
    source: 'registry-unavailable',
  };

  try {
    const companyRaw = JSON.parse(readFileSync(companyPath, 'utf8')) as {
      identity?: { name?: string };
    };
    const productRaw = JSON.parse(readFileSync(productPath, 'utf8')) as {
      product_and_ecosystem?: { current_focus?: { primary?: string } };
    };

    return {
      companyIdentity: companyRaw.identity?.name?.trim() || fallback.companyIdentity,
      productFocus: productRaw.product_and_ecosystem?.current_focus?.primary?.trim() || fallback.productFocus,
      source: 'registry/company',
    };
  } catch {
    return fallback;
  }
};

const normalizeBudget = (incoming?: Partial<ContextTokenBudget>): ContextTokenBudget => {
  const maxTokens = Math.max(
    MIN_BUDGET_TOKENS,
    incoming?.maxTokens ?? DEFAULT_BUDGET.maxTokens,
  );
  const reservedOutputTokens = Math.max(
    MIN_RESERVED_OUTPUT_TOKENS,
    incoming?.reservedOutputTokens ?? DEFAULT_BUDGET.reservedOutputTokens,
  );

  const compactThresholdTokens = Math.max(
    MIN_BUDGET_TOKENS - MIN_RESERVED_OUTPUT_TOKENS,
    incoming?.compactThresholdTokens ?? DEFAULT_BUDGET.compactThresholdTokens,
  );

  const highWaterMarkRatio = Math.max(
    0.3,
    Math.min(0.95, incoming?.highWaterMarkRatio ?? DEFAULT_BUDGET.highWaterMarkRatio),
  );

  return {
    maxTokens,
    reservedOutputTokens: Math.min(reservedOutputTokens, maxTokens - MIN_RESERVED_OUTPUT_TOKENS),
    compactThresholdTokens: Math.min(compactThresholdTokens, maxTokens - MIN_RESERVED_OUTPUT_TOKENS),
    highWaterMarkRatio,
  };
};

const cloneState = (state: ContextSessionState): ContextSessionState => ({
  ...state,
  budget: { ...state.budget },
  modelConfig: { ...state.modelConfig },
});

const recalcState = (record: ContextSessionRecord): void => {
  record.state.totalTokens = record.messages.reduce((sum, message) => sum + message.tokenEstimate, 0);
  record.state.messageCount = record.messages.length;
  record.state.updatedAt = nowIso();
};

const toEnvelope = (role: ContextMessageRole, content: string): ContextMessageEnvelope => ({
  id: `ctx_${randomUUID()}`,
  role,
  content,
  tokenEstimate: estimateTokens(content),
  createdAt: nowIso(),
});

const sessions = new Map<string, ContextSessionRecord>();

const getOrCreateSession = (
  sessionId: string,
  budget?: Partial<ContextTokenBudget>,
  modelConfig?: ContextModelConfig,
): ContextSessionRecord => {
  const existing = sessions.get(sessionId);
  if (existing) {
    if (budget) {
      existing.state.budget = normalizeBudget({ ...existing.state.budget, ...budget });
    }
    if (modelConfig) {
      existing.state.modelConfig = {
        provider: modelConfig.provider,
        model: modelConfig.model?.trim() || existing.state.modelConfig.model,
      };
    }
    return existing;
  }

  const createdAt = nowIso();
  const resolvedModelConfig: ContextModelConfig = {
    provider: modelConfig?.provider ?? 'lmstudio',
    model: modelConfig?.model?.trim() || undefined,
    contextWindow: modelConfig?.contextWindow,
    reservedOutputTokens: modelConfig?.reservedOutputTokens,
  };
  const providerWindow = tokenManagerService.resolveContextWindow({
    provider: resolvedModelConfig.provider,
    model: resolvedModelConfig.model,
    contextWindow: resolvedModelConfig.contextWindow,
    reservedOutputTokens: resolvedModelConfig.reservedOutputTokens,
  });
  const normalizedBudget = normalizeBudget({
    maxTokens: providerWindow.contextWindow,
    reservedOutputTokens: providerWindow.reservedOutputTokens,
    compactThresholdTokens: providerWindow.compactThresholdTokens,
    highWaterMarkRatio: providerWindow.highWaterMarkRatio,
    ...budget,
  });
  const seed = toEnvelope('system', 'Context session initialized.');

  const created: ContextSessionRecord = {
    state: {
      sessionId,
      createdAt,
      updatedAt: createdAt,
      totalTokens: seed.tokenEstimate,
      messageCount: 1,
      compactionCount: 0,
      lastCompactionAt: null,
      lastDigestId: null,
      summary: null,
      budget: normalizedBudget,
      modelConfig: resolvedModelConfig,
    },
    messages: [seed],
  };

  sessions.set(sessionId, created);
  return created;
};

const compactRecord = (
  sessionId: string,
  record: ContextSessionRecord,
  reason = 'threshold',
): Promise<ContextCompactionResult> => {
  return (async () => {
  const beforeTokens = record.state.totalTokens;
  const beforeCount = record.messages.length;
  emitEvent(sessionId, 'compaction_started', `Compaction started (${reason}).`);

  if (beforeCount <= 3) {
    const summary = record.state.summary ?? `Compaction skipped (${reason}); not enough messages.`;
    const digestId = `digest_${randomUUID()}`;
    record.state.summary = summary;
    return {
      sessionId: record.state.sessionId,
      beforeTokens,
      afterTokens: beforeTokens,
      removedMessages: 0,
      digestId,
      summary,
      compactedAt: nowIso(),
    };
  }

  const headCount = Math.max(1, Math.floor(beforeCount * 0.2));
  const tailCount = Math.max(2, Math.floor(beforeCount * 0.2));
  const middleStart = Math.min(headCount, beforeCount);
  const middleEnd = Math.max(middleStart, beforeCount - tailCount);

  const headSlice = record.messages.slice(0, middleStart);
  const middleSlice = record.messages.slice(middleStart, middleEnd);
  const tailSlice = record.messages.slice(middleEnd);

  const firstSystem = headSlice.find((message) => message.role === 'system') ?? record.messages[0];
  const currentGoalMessage = [...record.messages]
    .reverse()
    .find((message) => message.role === 'user') ?? record.messages[record.messages.length - 1];
  const contextMetadata = loadContextMetadata();

  const previousDigest = await contextDigestStoreService.getLatestDigest(sessionId);
  const summaryContent = await summarizationAgentService.summarize({
    sessionId,
    initialInstruction: firstSystem?.content ?? '',
    currentGoal: currentGoalMessage?.content ?? '',
    coreMetadata: `company=${contextMetadata.companyIdentity};product_focus=${contextMetadata.productFocus}`,
    previousDigest: previousDigest?.summary ?? null,
    middleMessages: middleSlice.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  });

  const digestId = `digest_${randomUUID()}`;
  const compactedAt = nowIso();

  const metadataEnvelope = toEnvelope(
    'system',
    `Core Metadata | Company: ${contextMetadata.companyIdentity} | Product Focus: ${contextMetadata.productFocus}`,
  );

  const digestEnvelope = toEnvelope(
    'system',
    `History Digest (${compactedAt}):\n${summaryContent}`,
  );

  const preservedTail = tailSlice.slice(-MAX_MESSAGES_AFTER_COMPACTION);

  record.messages = [
    firstSystem,
    metadataEnvelope,
    digestEnvelope,
    ...preservedTail,
  ];

  const unique = new Set<string>();
  record.messages = record.messages.filter((message) => {
    if (unique.has(message.id)) {
      return false;
    }
    unique.add(message.id);
    return true;
  });

  const removedMessages = Math.max(0, beforeCount - record.messages.length);
  recalcState(record);
  record.state.compactionCount += 1;
  record.state.lastCompactionAt = compactedAt;
  record.state.lastDigestId = digestId;
  record.state.summary = summaryContent;

  await contextDigestStoreService.createDigest({
    id: digestId,
    sessionId,
    summary: summaryContent,
    metadataJson: JSON.stringify({
      reason,
      companyIdentity: contextMetadata.companyIdentity,
      productFocus: contextMetadata.productFocus,
      metadataSource: contextMetadata.source,
      initialInstruction: firstSystem?.content.slice(0, 500) ?? '',
      currentGoal: currentGoalMessage?.content.slice(0, 500) ?? '',
      middleMessageCount: middleSlice.length,
    }),
    beforeTokens,
    afterTokens: record.state.totalTokens,
    removedMessages,
    compactedAt,
  });

  emitEvent(sessionId, 'compaction_completed', `Compaction completed (${reason}). Digest=${digestId}.`);

  return {
    sessionId: record.state.sessionId,
    beforeTokens,
    afterTokens: record.state.totalTokens,
    removedMessages,
    digestId,
    summary: summaryContent,
    compactedAt,
  };
  })();
};

export const contextEngineService = {
  bootstrapSession(
    sessionId: string,
    budget?: Partial<ContextTokenBudget>,
    modelConfig?: ContextModelConfig,
  ): ContextSessionState {
    const record = getOrCreateSession(sessionId, budget, modelConfig);
    return cloneState(record.state);
  },

  async ingest(
    sessionId: string,
    role: ContextMessageRole,
    content: string,
  ): Promise<ContextSessionState> {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      return this.getSessionSnapshot(sessionId) ?? this.bootstrapSession(sessionId);
    }

    const record = getOrCreateSession(sessionId);
    record.messages.push(toEnvelope(role, normalizedContent));
    recalcState(record);

    if (record.state.totalTokens >= record.state.budget.compactThresholdTokens) {
      emitEvent(sessionId, 'threshold_reached', 'Context threshold reached. Summarizing history for optimal performance...');
      await compactRecord(record.state.sessionId, record, 'high-water-mark-ingest');
    }

    return cloneState(record.state);
  },

  async ingestBatch(
    sessionId: string,
    messages: Array<{ role: ContextMessageRole; content: string }>,
  ): Promise<ContextSessionState> {
    const record = getOrCreateSession(sessionId);

    for (const message of messages) {
      const content = message.content.trim();
      if (!content) {
        continue;
      }
      record.messages.push(toEnvelope(message.role, content));
    }

    recalcState(record);

    if (record.state.totalTokens >= record.state.budget.compactThresholdTokens) {
      emitEvent(sessionId, 'threshold_reached', 'Context threshold reached. Summarizing history for optimal performance...');
      await compactRecord(record.state.sessionId, record, 'high-water-mark-batch');
    }

    return cloneState(record.state);
  },

  assemble(sessionId: string, maxTokensOverride?: number): ContextAssembleResult {
    const record = getOrCreateSession(sessionId);
    const budgetTokens = Math.max(
      MIN_RESERVED_OUTPUT_TOKENS,
      (maxTokensOverride ?? record.state.budget.maxTokens) - record.state.budget.reservedOutputTokens,
    );

    const selected: ContextMessageEnvelope[] = [];
    let usedTokens = 0;
    let droppedMessageCount = 0;

    for (let index = record.messages.length - 1; index >= 0; index -= 1) {
      const current = record.messages[index];
      if (usedTokens + current.tokenEstimate > budgetTokens) {
        droppedMessageCount += 1;
        continue;
      }

      selected.push(current);
      usedTokens += current.tokenEstimate;
    }

    selected.reverse();

    return {
      sessionId,
      usedTokens,
      budgetTokens,
      droppedMessageCount,
      messages: selected,
    };
  },

  async compact(sessionId: string, reason?: string): Promise<ContextCompactionResult> {
    const record = getOrCreateSession(sessionId);
    return compactRecord(sessionId, record, reason ?? 'manual');
  },

  async afterTurn(sessionId: string): Promise<ContextSessionState> {
    const record = getOrCreateSession(sessionId);

    if (record.state.totalTokens >= record.state.budget.compactThresholdTokens) {
      emitEvent(sessionId, 'threshold_reached', 'Context threshold reached. Summarizing history for optimal performance...');
      await compactRecord(sessionId, record, 'after-turn-threshold');
    }

    return cloneState(record.state);
  },

  prepareSubagentSpawn(parentSessionId: string, childSessionId: string): ContextSessionState {
    const parent = getOrCreateSession(parentSessionId);
    const child = getOrCreateSession(childSessionId, parent.state.budget);

    const inheritedMessages = parent.messages.slice(-4).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    child.messages = [toEnvelope('system', `Spawned from parent session ${parentSessionId}.`)];
    for (const message of inheritedMessages) {
      child.messages.push(toEnvelope(message.role, message.content));
    }

    recalcState(child);
    return cloneState(child.state);
  },

  onSubagentEnded(parentSessionId: string, childSessionId: string, summary: string): ContextSessionState {
    const record = getOrCreateSession(parentSessionId);
    const summaryText = summary.trim() || `Subagent ${childSessionId} completed without a summary.`;
    record.messages.push(toEnvelope('assistant', `Subagent ${childSessionId} summary: ${summaryText}`));
    recalcState(record);
    return cloneState(record.state);
  },

  async prepareNewContext(sessionId: string): Promise<ContextNewSessionPreview> {
    const record = getOrCreateSession(sessionId);
    let summary = record.state.summary;

    if (!summary) {
      const latestDigest = await contextDigestStoreService.getLatestDigest(sessionId);
      summary = latestDigest?.summary ?? null;
    }

    if (!summary) {
      const firstSystem = record.messages.find((message) => message.role === 'system') ?? record.messages[0];
      const goal = [...record.messages].reverse().find((message) => message.role === 'user') ?? record.messages[record.messages.length - 1];
      const middle = record.messages.slice(1, Math.max(1, record.messages.length - 1));
      const metadata = loadContextMetadata();

      summary = await summarizationAgentService.summarize({
        sessionId,
        initialInstruction: firstSystem?.content ?? '',
        currentGoal: goal?.content ?? '',
        coreMetadata: `company=${metadata.companyIdentity};product_focus=${metadata.productFocus}`,
        previousDigest: null,
        middleMessages: middle.map((message) => ({ role: message.role, content: message.content })),
      });
    }

    const preview: ContextNewSessionPreview = {
      sourceSessionId: sessionId,
      suggestedSessionId: `ctx_${randomUUID()}`,
      summary,
      generatedAt: nowIso(),
    };

    pendingNewContextPreviews.set(sessionId, preview);
    emitEvent(sessionId, 'new_context_prepared', 'New context preview generated. Review before starting a new session.');
    return preview;
  },

  startNewWithContext(
    sourceSessionId: string,
    targetSessionId: string,
    summaryOverride?: string,
  ): ContextStartNewResult {
    const source = getOrCreateSession(sourceSessionId);
    const preview = pendingNewContextPreviews.get(sourceSessionId);
    const carriedSummary = summaryOverride?.trim() || preview?.summary || source.state.summary || 'No summary available.';
    const firstSystem = source.messages.find((message) => message.role === 'system');
    const currentGoal = [...source.messages].reverse().find((message) => message.role === 'user');

    const target = getOrCreateSession(targetSessionId, source.state.budget, source.state.modelConfig);
    target.messages = [];

    if (firstSystem) {
      target.messages.push(toEnvelope('system', firstSystem.content));
    }

    target.messages.push(toEnvelope('system', `History Digest Carryover:\n${carriedSummary}`));
    if (currentGoal) {
      target.messages.push(toEnvelope('system', `Current Goal Carryover: ${currentGoal.content}`));
    }

    recalcState(target);
    pendingNewContextPreviews.delete(sourceSessionId);
    emitEvent(sourceSessionId, 'new_context_started', `Started new context session ${targetSessionId} with carryover summary.`);

    return {
      sourceSessionId,
      targetSessionId,
      carriedSummary,
      state: cloneState(target.state),
    };
  },

  async getLatestDigest(sessionId: string): Promise<{ id: string; summary: string; compactedAt: string } | null> {
    const digest = await contextDigestStoreService.getLatestDigest(sessionId);
    if (!digest) {
      return null;
    }

    return {
      id: digest.id,
      summary: digest.summary,
      compactedAt: digest.compactedAt,
    };
  },

  async listDigests(sessionId: string, limit?: number): Promise<Array<{ id: string; summary: string; compactedAt: string }>> {
    const digests = await contextDigestStoreService.listDigests(sessionId, limit);
    return digests.map((digest) => ({
      id: digest.id,
      summary: digest.summary,
      compactedAt: digest.compactedAt,
    }));
  },

  getSessionSnapshot(sessionId: string): ContextSessionState | null {
    const record = sessions.get(sessionId);
    if (!record) {
      return null;
    }
    return cloneState(record.state);
  },

  listSessions(): ContextSessionState[] {
    return [...sessions.values()]
      .map((record) => cloneState(record.state))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  getTelemetry(): ContextEngineTelemetry {
    let totalMessages = 0;
    let totalTokens = 0;
    let totalCompactions = 0;
    let hottestSessionId: string | null = null;
    let hottestSessionTokens = 0;

    for (const record of sessions.values()) {
      totalMessages += record.state.messageCount;
      totalTokens += record.state.totalTokens;
      totalCompactions += record.state.compactionCount;

      if (record.state.totalTokens > hottestSessionTokens) {
        hottestSessionTokens = record.state.totalTokens;
        hottestSessionId = record.state.sessionId;
      }
    }

    return {
      activeSessions: sessions.size,
      totalMessages,
      totalTokens,
      totalCompactions,
      hottestSessionId,
      hottestSessionTokens,
      recentEvents: [...events].slice(-8),
    };
  },

  disposeSession(sessionId: string): boolean {
    return sessions.delete(sessionId);
  },

  __resetForTesting(): void {
    sessions.clear();
    events.length = 0;
    pendingNewContextPreviews.clear();
  },
};
