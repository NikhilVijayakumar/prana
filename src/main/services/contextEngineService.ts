import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contextOptimizerService, ContextOptimizationStage } from './contextOptimizerService';
import { contextDigestStoreService } from './contextDigestStoreService';
import { summarizationAgentService } from './summarizationAgentService';
import { getRegistryRuntimeConfig } from './registryRuntimeService';
import { syncStoreService } from './syncStoreService';
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
  optimizationStage: ContextOptimizationStage;
  hardResetCount: number;
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
  type: 'warning_state' | 'threshold_reached' | 'compaction_started' | 'compaction_completed' | 'hard_limit_reset' | 'new_context_prepared' | 'new_context_started';
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

const persistRawMessage = async (sessionId: string, message: ContextMessageEnvelope): Promise<void> => {
  await contextDigestStoreService.appendRawMessage({
    id: message.id,
    sessionId,
    role: message.role,
    content: message.content,
    tokenEstimate: message.tokenEstimate,
    createdAt: message.createdAt,
    payloadJson: JSON.stringify(message),
  });
};

const persistActiveContext = async (record: ContextSessionRecord): Promise<void> => {
  await contextDigestStoreService.ensureSessionActive(record.state.sessionId, record.state.summary);
  await contextDigestStoreService.replaceActiveContext({
    sessionId: record.state.sessionId,
    messages: record.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      tokenEstimate: message.tokenEstimate,
      createdAt: message.createdAt,
    })),
  });
};

const persistArchivedMessagesToEmbeddings = async (
  sessionId: string,
  messages: ContextMessageEnvelope[],
): Promise<void> => {
  for (const message of messages) {
    const content = message.content.trim();
    if (!content) {
      continue;
    }

    await syncStoreService.upsertEmbedding({
      embeddingId: `${sessionId}:${message.id}`,
      namespace: `context-archive:${sessionId}`,
      contentHash: `${sessionId}:${message.id}`,
      vector: contextOptimizerService.createDeterministicEmbedding(content),
      metadata: {
        sessionId,
        role: message.role,
        createdAt: message.createdAt,
        contentPreview: content.slice(0, 240),
      },
    });
  }
};

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
        contextWindow: modelConfig.contextWindow ?? existing.state.modelConfig.contextWindow,
        reservedOutputTokens: modelConfig.reservedOutputTokens ?? existing.state.modelConfig.reservedOutputTokens,
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
      optimizationStage: 'NORMAL',
      hardResetCount: 0,
      budget: normalizedBudget,
      modelConfig: resolvedModelConfig,
    },
    messages: [seed],
  };

  sessions.set(sessionId, created);
  void persistRawMessage(sessionId, seed);
  void persistActiveContext(created);
  return created;
};

const updateOptimizationStage = (
  sessionId: string,
  record: ContextSessionRecord,
  nextStage: ContextOptimizationStage,
): void => {
  if (record.state.optimizationStage === nextStage) {
    return;
  }

  record.state.optimizationStage = nextStage;
  if (nextStage === 'WARNING') {
    emitEvent(
      sessionId,
      'warning_state',
      'Context usage reached the warning threshold. Memory is approaching capacity.',
    );
  }
};

const buildCompactionSummary = async (
  sessionId: string,
  firstSystem: ContextMessageEnvelope | undefined,
  currentGoalMessage: ContextMessageEnvelope | undefined,
  middleSlice: ContextMessageEnvelope[],
): Promise<string> => {
  const contextMetadata = loadContextMetadata();
  const previousDigest = await contextDigestStoreService.getLatestDigest(sessionId);
  return summarizationAgentService.summarize({
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
};

const forceHardLimitReset = async (
  sessionId: string,
  record: ContextSessionRecord,
  reason: string,
): Promise<void> => {
  const originalMessages = [...record.messages];
  const firstSystem = originalMessages.find((message) => message.role === 'system') ?? originalMessages[0];
  const currentGoalMessage = [...originalMessages]
    .reverse()
    .find((message) => message.role === 'user') ?? originalMessages[originalMessages.length - 1];

  const summaryContent = await buildCompactionSummary(
    sessionId,
    firstSystem,
    currentGoalMessage,
    originalMessages.filter((message) => message.id !== firstSystem?.id),
  );

  const metadata = loadContextMetadata();
  const compactedAt = nowIso();
  const digestId = `digest_${randomUUID()}`;
  const resetDigest = toEnvelope(
    'system',
    `Forced Context Reset (${compactedAt}):\n${summaryContent}`,
  );

  const resetMessages = [
    firstSystem,
    toEnvelope('system', `Core Metadata | Company: ${metadata.companyIdentity} | Product Focus: ${metadata.productFocus}`),
    resetDigest,
    currentGoalMessage ? toEnvelope('system', `Current Goal Carryover: ${currentGoalMessage.content}`) : null,
  ].filter((message): message is ContextMessageEnvelope => Boolean(message));

  const retainedIds = new Set(resetMessages.map((message) => message.id));
  const archivedMessages = originalMessages.filter((message) => !retainedIds.has(message.id));

  record.messages = resetMessages;
  recalcState(record);
  record.state.summary = summaryContent;
  record.state.lastCompactionAt = compactedAt;
  record.state.lastDigestId = digestId;
  record.state.hardResetCount += 1;
  record.state.optimizationStage = contextOptimizerService.resolveStage(
    record.state.totalTokens,
    record.state.budget.maxTokens,
  );

  await contextDigestStoreService.createDigest({
    id: digestId,
    sessionId,
    summary: summaryContent,
    metadataJson: JSON.stringify({
      reason,
      forcedReset: true,
      companyIdentity: metadata.companyIdentity,
      productFocus: metadata.productFocus,
      initialInstruction: firstSystem?.content.slice(0, 500) ?? '',
      currentGoal: currentGoalMessage?.content.slice(0, 500) ?? '',
      archivedMessageCount: archivedMessages.length,
    }),
    beforeTokens: originalMessages.reduce((sum, message) => sum + message.tokenEstimate, 0),
    afterTokens: record.state.totalTokens,
    removedMessages: archivedMessages.length,
    compactedAt,
  });
  for (const message of resetMessages) {
    if (!originalMessages.some((existing) => existing.id === message.id)) {
      await persistRawMessage(sessionId, message);
    }
  }
  await persistArchivedMessagesToEmbeddings(sessionId, archivedMessages);
  await persistActiveContext(record);
  emitEvent(sessionId, 'hard_limit_reset', `Context hard limit reached. Reset applied (${reason}).`);
};

const enforceOptimizationLifecycle = async (
  sessionId: string,
  record: ContextSessionRecord,
  reason: string,
): Promise<void> => {
  const nextStage = contextOptimizerService.resolveStage(
    record.state.totalTokens,
    record.state.budget.maxTokens,
  );

  if (nextStage === 'HARD_LIMIT') {
    await forceHardLimitReset(sessionId, record, reason);
    return;
  }

  if (nextStage === 'COMPACTION_REQUIRED') {
    emitEvent(sessionId, 'threshold_reached', 'Context threshold reached. Summarizing history for optimal performance...');
    await compactRecord(sessionId, record, reason);
    record.state.optimizationStage = contextOptimizerService.resolveStage(
      record.state.totalTokens,
      record.state.budget.maxTokens,
    );
    return;
  }

  updateOptimizationStage(sessionId, record, nextStage);
  await persistActiveContext(record);
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

  const originalMessages = [...record.messages];
  const plan = contextOptimizerService.createCompactionPlan(originalMessages);
  const firstSystem = plan.pinnedMessages.find((message) => message.role === 'system') ?? originalMessages[0];
  const currentGoalMessage = [...record.messages]
    .reverse()
    .find((message) => message.role === 'user') ?? record.messages[record.messages.length - 1];
  const contextMetadata = loadContextMetadata();

  const summaryContent = await buildCompactionSummary(
    sessionId,
    firstSystem,
    currentGoalMessage,
    plan.summarizationMessages,
  );

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

  const preservedTail = plan.activeTailMessages.slice(-MAX_MESSAGES_AFTER_COMPACTION);

  record.messages = [
    ...plan.pinnedMessages,
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
  record.state.optimizationStage = 'NORMAL';

  const retainedIds = new Set(record.messages.map((message) => message.id));
  const archivedMessages = originalMessages.filter((message) => !retainedIds.has(message.id));

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
      middleMessageCount: plan.summarizationMessages.length,
    }),
    beforeTokens,
    afterTokens: record.state.totalTokens,
    removedMessages,
    compactedAt,
  });
  for (const message of record.messages) {
    if (!originalMessages.some((existing) => existing.id === message.id)) {
      await persistRawMessage(sessionId, message);
    }
  }
  await persistArchivedMessagesToEmbeddings(sessionId, archivedMessages);
  await persistActiveContext(record);

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
    const message = toEnvelope(role, normalizedContent);
    record.messages.push(message);
    await persistRawMessage(sessionId, message);
    recalcState(record);
    await enforceOptimizationLifecycle(record.state.sessionId, record, 'high-water-mark-ingest');

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
      const envelope = toEnvelope(message.role, content);
      record.messages.push(envelope);
      await persistRawMessage(sessionId, envelope);
    }

    recalcState(record);
    await enforceOptimizationLifecycle(record.state.sessionId, record, 'high-water-mark-batch');

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
    await enforceOptimizationLifecycle(sessionId, record, 'after-turn-threshold');

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
    void persistActiveContext(child);
    return cloneState(child.state);
  },

  onSubagentEnded(parentSessionId: string, childSessionId: string, summary: string): ContextSessionState {
    const record = getOrCreateSession(parentSessionId);
    const summaryText = summary.trim() || `Subagent ${childSessionId} completed without a summary.`;
    const message = toEnvelope('assistant', `Subagent ${childSessionId} summary: ${summaryText}`);
    record.messages.push(message);
    void persistRawMessage(parentSessionId, message);
    recalcState(record);
    void persistActiveContext(record);
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
    void contextDigestStoreService.archiveSession(sourceSessionId, carriedSummary);
    target.messages.forEach((message) => {
      void persistRawMessage(targetSessionId, message);
    });
    void persistActiveContext(target);
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
