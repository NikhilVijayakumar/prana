import { v4 as generateUUID } from 'uuid';
import {
  DataClassification,
  ChannelType,
  InterceptionAction,
  InterceptionContext,
} from './types/orchestrationTypes';
import { getPublicRuntimeConfig } from './runtimeConfigService';
import { orchestrationManager, DirectorIntent } from './orchestrationManager';
import { protocolInterceptor } from './protocolInterceptor';
import { auditLogService, AUDIT_ACTIONS } from './auditLogService';
import { registryRuntimeStoreService, RuntimeChannelDetails } from './registryRuntimeStoreService';
import { agentRegistryService } from './agentRegistryService';
import { commandRouterService } from './commandRouterService';
import { conversationStoreService, ConversationChannel, ConversationMessageRecord, ConversationRecord } from './conversationStoreService';
import { contextEngineService } from './contextEngineService';
import { getRuntimeBootstrapConfig } from './runtimeConfigService';
import { ChannelCapabilityProfile, ChannelMessageEnvelope } from './types/channelAdapterTypes';
import { channelRegistryService } from './channelRegistryService';

export interface TelegramIngressPayload {
  message: string;
  senderId: string;
  senderName?: string;
  chatId?: string;
  timestampIso?: string;
  sessionId?: string;
  explicitTargetPersonaId?: string;
  isDirector?: boolean;
  dataClassification?: DataClassification;
  metadata?: Record<string, unknown>;
}

export interface WhatsAppIngressPayload {
  message: string;
  senderId: string; // The user phone number
  senderName?: string;
  chatId?: string; // The group JID or chat ID
  timestampIso?: string;
  sessionId?: string;
  explicitTargetPersonaId?: string;
  isDirector?: boolean;
  dataClassification?: DataClassification;
  metadata?: Record<string, unknown>;
}

export interface ChannelRoutingResult {
  accepted: boolean;
  status: 'accepted' | 'blocked' | 'escalated' | 'rejected' | 'failed';
  message: string;
  workOrderId?: string;
  personaId?: string;
  personaName?: string;
  personaRole?: string;
  responsePreview?: string;
  auditTrailRef?: string;
  violations?: string[];
  conversationId?: string;
  conversationKey?: string;
  sessionId?: string;
}

export interface InternalChatPayload {
  message: string;
  senderId: string;
  senderName?: string;
  moduleRoute: string;
  targetPersonaId?: string;
  roomId?: string;
  sessionId?: string;
  timestampIso?: string;
  isDirector?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatConversationSnapshot {
  conversation: ConversationRecord;
  messages: ConversationMessageRecord[];
}

interface ChannelRouterDependencies {
  getRuntimeConfig: typeof getPublicRuntimeConfig;
  getRuntimeBootstrapConfig: typeof getRuntimeBootstrapConfig;
  getRuntimeChannelDetails: () => Promise<RuntimeChannelDetails | null>;
  createId: () => string;
  nowIso: () => string;
  audit: Pick<typeof auditLogService, 'createTransaction' | 'appendTransaction'>;
  orchestrator: Pick<typeof orchestrationManager, 'orchestrateIntent'>;
  interceptor: Pick<typeof protocolInterceptor, 'interceptAndValidate'>;
  submitDirectorRequest: typeof commandRouterService.submitDirectorRequest;
}

const createDefaultDependencies = (): ChannelRouterDependencies => ({
  getRuntimeConfig: getPublicRuntimeConfig,
  getRuntimeBootstrapConfig,
  getRuntimeChannelDetails: () => registryRuntimeStoreService.getRuntimeChannelDetails(),
  createId: () => generateUUID(),
  nowIso: () => new Date().toISOString(),
  audit: auditLogService,
  orchestrator: orchestrationManager,
  interceptor: protocolInterceptor,
  submitDirectorRequest: commandRouterService.submitDirectorRequest.bind(commandRouterService),
});

let dependencies: ChannelRouterDependencies = createDefaultDependencies();

const extractExplicitTarget = (message: string): string | undefined => {
  const normalized = message.trim();
  const commandMatch = normalized.match(/^\/(?:agent|route)\s+([a-z0-9_-]+)/i);
  if (commandMatch?.[1]) {
    return commandMatch[1].toLowerCase();
  }

  const mentionMatch = normalized.match(/@([a-z0-9_-]{2,40})/i);
  if (mentionMatch?.[1]) {
    return mentionMatch[1].toLowerCase();
  }

  return undefined;
};

const normalize = (value: string | undefined): string => {
  return (value ?? '').trim().toLowerCase();
};

const normalizeKey = (value: string): string => {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, '-');
};

const toConversationKey = (input: {
  channel: ConversationChannel;
  roomId: string;
  operatorCanonicalId: string;
  targetPersonaId?: string;
}): string => {
  return [
    input.channel,
    normalizeKey(input.roomId),
    normalizeKey(input.operatorCanonicalId),
    normalizeKey(input.targetPersonaId ?? 'switchboard'),
  ].join(':');
};

const resolveAppId = (): string => {
  try {
    const runtime = dependencies.getRuntimeBootstrapConfig();
    return runtime.vault.appKey?.trim()
      || runtime.branding.appBrandName?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      || 'prana-runtime';
  } catch {
    return 'prana-runtime';
  }
};

const buildResponderHeader = (personaName?: string, personaRole?: string): string => {
  const name = (personaName ?? '').trim() || 'System Router';
  const role = (personaRole ?? '').trim();
  return role ? `Responder: ${name} (${role})` : `Responder: ${name}`;
};

const withResponderMessage = (
  body: string,
  personaName?: string,
  personaRole?: string,
): string => {
  return `${buildResponderHeader(personaName, personaRole)}\n${body}`;
};

const isAuthorizedDirector = (
  senderId: string,
  runtimeConfig: ReturnType<typeof getPublicRuntimeConfig>,
  explicitFlag?: boolean,
): boolean => {
  const senderIdentity = normalize(senderId);
  const directorIdentity = normalize(runtimeConfig.directorEmail);
  return explicitFlag === true || senderIdentity === directorIdentity;
};

const persistConversationTurn = async (input: {
  channel: ConversationChannel;
  roomId: string;
  providerRoomId?: string;
  operatorExternalId: string;
  operatorDisplayName?: string;
  targetPersonaId?: string;
  sessionId: string;
  incomingText: string;
  responseText: string;
  responseStatus: ChannelRoutingResult['status'];
  responseAccepted: boolean;
  messageTimestamp: string;
  responseWorkOrderId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ conversation: ConversationRecord; operatorMessage: ConversationMessageRecord; responseMessage: ConversationMessageRecord }> => {
  const identity = await conversationStoreService.resolveOperatorIdentity({
    appId: resolveAppId(),
    channel: input.channel,
    externalUserId: input.operatorExternalId,
    canonicalOperatorId: input.operatorExternalId,
    displayName: input.operatorDisplayName,
    metadata: {
      channel: input.channel,
    },
  });

  const conversationKey = toConversationKey({
    channel: input.channel,
    roomId: input.roomId,
    operatorCanonicalId: identity.canonicalOperatorId,
    targetPersonaId: input.targetPersonaId,
  });

  const conversation = await conversationStoreService.ensureConversation({
    conversationKey,
    roomKey: input.roomId,
    appId: resolveAppId(),
    channel: input.channel,
    mode: 'INDIVIDUAL',
    operatorCanonicalId: identity.canonicalOperatorId,
    operatorDisplayName: input.operatorDisplayName,
    targetPersonaId: input.targetPersonaId,
    participantAgentIds: input.targetPersonaId ? [input.targetPersonaId] : [],
    providerRoomId: input.providerRoomId ?? null,
    metadata: input.metadata,
  });

  contextEngineService.bootstrapSession(input.sessionId);
  await contextEngineService.ingest(input.sessionId, 'user', input.incomingText);

  const operatorMessage = await conversationStoreService.appendMessage({
    conversationId: conversation.conversationId,
    sessionKey: input.sessionId,
    role: 'operator',
    actorId: identity.canonicalOperatorId,
    actorName: input.operatorDisplayName ?? null,
    content: input.incomingText,
    channel: input.channel,
    status: 'RECEIVED',
    metadata: input.metadata,
    workOrderId: input.responseWorkOrderId,
  });

  await contextEngineService.ingest(input.sessionId, 'assistant', input.responseText);
  await contextEngineService.afterTurn(input.sessionId);

  const statusMap: Record<ChannelRoutingResult['status'], ConversationMessageRecord['status']> = {
    accepted: 'ROUTED',
    blocked: 'BLOCKED',
    escalated: 'ESCALATED',
    rejected: 'FAILED',
    failed: 'FAILED',
  };

  const responseMessage = await conversationStoreService.appendMessage({
    conversationId: conversation.conversationId,
    sessionKey: input.sessionId,
    role: 'assistant',
    actorId: input.targetPersonaId ?? 'system-router',
    actorName: input.targetPersonaId ? agentRegistryService.getAgent(input.targetPersonaId)?.name ?? input.targetPersonaId : 'System Router',
    content: input.responseText,
    channel: input.channel,
    status: statusMap[input.responseStatus],
    replyToMessageId: operatorMessage.messageId,
    workOrderId: input.responseWorkOrderId,
    metadata: {
      accepted: input.responseAccepted,
      ...(input.metadata ?? {}),
    },
  });

  return { conversation, operatorMessage, responseMessage };
};

const getChannelAllowlist = (runtimeChannelDetails: RuntimeChannelDetails | null): Set<string> => {
  return new Set((runtimeChannelDetails?.allowedChannels ?? []).map((channel) => channel.toLowerCase()));
};

export const channelRouterService = {
  __setDependenciesForTesting(partial: Partial<ChannelRouterDependencies>): void {
    dependencies = {
      ...dependencies,
      ...partial,
    };
  },

  __resetDependenciesForTesting(): void {
    dependencies = createDefaultDependencies();
  },

  async __resetStateForTesting(): Promise<void> {
    await conversationStoreService.__resetForTesting();
    contextEngineService.__resetForTesting();
    dependencies = createDefaultDependencies();
  },

  async routeChannelMessage(envelope: ChannelMessageEnvelope): Promise<ChannelRoutingResult> {
    const adapter = channelRegistryService.get(envelope.channelId);
    if (!adapter) {
      return {
        accepted: false,
        status: 'rejected',
        message: `Channel '${envelope.channelId}' is not registered.`,
      };
    }

    const capability = await adapter.getCapabilities();
    if (!capability.isEnabled) {
      return {
        accepted: false,
        status: 'rejected',
        message: `Channel '${envelope.channelId}' is disabled.`,
      };
    }

    if (envelope.channelId === 'internal-chat') {
      const moduleRoute = typeof envelope.metadata?.moduleRoute === 'string'
        ? envelope.metadata.moduleRoute
        : envelope.roomId;

      return this.routeInternalMessage({
        message: envelope.messageText,
        senderId: envelope.senderId,
        senderName: envelope.senderName,
        moduleRoute,
        targetPersonaId: envelope.explicitTargetPersonaId,
        roomId: envelope.roomId,
        sessionId: envelope.sessionId,
        timestampIso: envelope.timestampIso,
        isDirector: envelope.isDirector,
        metadata: envelope.metadata,
      });
    }

    if (envelope.channelId === 'telegram') {
      return this.routeTelegramMessage({
        message: envelope.messageText,
        senderId: envelope.senderId,
        senderName: envelope.senderName,
        chatId: envelope.roomId,
        timestampIso: envelope.timestampIso,
        sessionId: envelope.sessionId,
        explicitTargetPersonaId: envelope.explicitTargetPersonaId,
        isDirector: envelope.isDirector,
        dataClassification: envelope.dataClassification,
        metadata: envelope.metadata,
      });
    }

    if (envelope.channelId === 'whatsapp') {
      return this.routeWhatsAppMessage({
        message: envelope.messageText,
        senderId: envelope.senderId,
        senderName: envelope.senderName,
        chatId: envelope.roomId,
        timestampIso: envelope.timestampIso,
        sessionId: envelope.sessionId,
        explicitTargetPersonaId: envelope.explicitTargetPersonaId,
        isDirector: envelope.isDirector,
        dataClassification: envelope.dataClassification,
        metadata: envelope.metadata,
      });
    }

    return {
      accepted: false,
      status: 'rejected',
      message: `Channel '${envelope.channelId}' is registered but does not have a routing strategy yet.`,
    };
  },

  async getChannelCapabilities(): Promise<ChannelCapabilityProfile[]> {
    return channelRegistryService.listCapabilities();
  },

  async routeInternalMessage(payload: InternalChatPayload): Promise<ChannelRoutingResult> {
    const trimmedMessage = payload.message.trim();
    if (!trimmedMessage) {
      return {
        accepted: false,
        status: 'rejected',
        message: 'Internal message cannot be empty.',
      };
    }

    const runtimeConfig = dependencies.getRuntimeConfig();
    const runtimeChannelDetails = await dependencies.getRuntimeChannelDetails();
    const allowedChannels = getChannelAllowlist(runtimeChannelDetails);
    if (allowedChannels.size > 0 && !allowedChannels.has('internal-chat')) {
      return {
        accepted: false,
        status: 'rejected',
        message: 'Internal chat is disabled in onboarding runtime policy.',
      };
    }

    if (!isAuthorizedDirector(payload.senderId, runtimeConfig, payload.isDirector)) {
      return {
        accepted: false,
        status: 'rejected',
        message: 'Sender is not authorized to dispatch internal chat intents.',
      };
    }

    const result = await dependencies.submitDirectorRequest({
      moduleRoute: payload.moduleRoute,
      targetEmployeeId: payload.targetPersonaId,
      message: trimmedMessage,
      timestampIso: payload.timestampIso ?? dependencies.nowIso(),
    });

    const accepted = Boolean(result.queueAccepted);
    const status: ChannelRoutingResult['status'] = accepted ? 'accepted' : 'failed';
    const persona = agentRegistryService.getAgent(result.workOrder.targetEmployeeId);
    const responseText = accepted
      ? withResponderMessage(`Work order ${result.workOrder.id} queued for ${result.workOrder.targetEmployeeId}.`, persona?.name, persona?.role)
      : withResponderMessage(`Queue rejected request: ${result.queueReason}.`, persona?.name, persona?.role);
    const sessionId =
      payload.sessionId
      ?? `internal-${normalizeKey(payload.moduleRoute)}-${normalizeKey(payload.targetPersonaId ?? result.workOrder.targetEmployeeId)}`;

    const persisted = await persistConversationTurn({
      channel: 'internal-chat',
      roomId: payload.roomId ?? payload.moduleRoute,
      operatorExternalId: payload.senderId,
      operatorDisplayName: payload.senderName,
      targetPersonaId: result.workOrder.targetEmployeeId,
      sessionId,
      incomingText: trimmedMessage,
      responseText,
      responseStatus: status,
      responseAccepted: accepted,
      messageTimestamp: payload.timestampIso ?? dependencies.nowIso(),
      responseWorkOrderId: result.workOrder.id,
      metadata: {
        moduleRoute: payload.moduleRoute,
        queueReason: result.queueReason,
        ...(payload.metadata ?? {}),
      },
    });

    return {
      accepted,
      status,
      message: responseText,
      workOrderId: result.workOrder.id,
      personaId: result.workOrder.targetEmployeeId,
      personaName: persona?.name,
      personaRole: persona?.role,
      responsePreview: trimmedMessage.slice(0, 220),
      conversationId: persisted.conversation.conversationId,
      conversationKey: persisted.conversation.conversationKey,
      sessionId,
    };
  },

  async routeTelegramMessage(payload: TelegramIngressPayload): Promise<ChannelRoutingResult> {
    const trimmedMessage = payload.message.trim();
    if (!trimmedMessage) {
      return {
        accepted: false,
        status: 'rejected',
        message: 'Telegram message cannot be empty.',
      };
    }

    const runtimeConfig = dependencies.getRuntimeConfig();
    const runtimeChannelDetails = await dependencies.getRuntimeChannelDetails();
    const expectedChatId = normalize(
      runtimeChannelDetails?.telegramChannelId || runtimeConfig.channels.telegramChannelId,
    );
    const incomingChatId = normalize(payload.chatId);

    if (expectedChatId && incomingChatId && expectedChatId !== incomingChatId) {
      return {
        accepted: false,
        status: 'rejected',
        message: 'Telegram channel is not authorized for Director routing.',
      };
    }

    const globallyAllowedChannels = getChannelAllowlist(runtimeChannelDetails);
    if (globallyAllowedChannels.size > 0 && !globallyAllowedChannels.has('telegram')) {
      return {
        accepted: false,
        status: 'rejected',
        message: 'Telegram channel is disabled in onboarding runtime policy.',
      };
    }

    if (!isAuthorizedDirector(payload.senderId, runtimeConfig, payload.isDirector)) {
      return {
        accepted: false,
        status: 'rejected',
        message: 'Sender is not authorized to dispatch Director intents.',
      };
    }

    const intent: DirectorIntent = {
      id: dependencies.createId(),
      timestamp: payload.timestampIso ?? dependencies.nowIso(),
      message: trimmedMessage,
      explicitTargetPersonaId: payload.explicitTargetPersonaId ?? extractExplicitTarget(trimmedMessage),
      sessionId: payload.sessionId ?? `telegram-${dependencies.createId()}`,
      metadata: {
        channel: 'telegram',
        senderId: payload.senderId,
        senderName: payload.senderName,
        chatId: payload.chatId,
        ...(payload.metadata ?? {}),
      },
    };

    const intakeTxnId = await dependencies.audit.createTransaction(AUDIT_ACTIONS.TELEGRAM_INTENT_RECEIVED, {
      intentId: intent.id,
      senderId: payload.senderId,
      chatId: payload.chatId,
      explicitTargetPersonaId: intent.explicitTargetPersonaId,
      correlationId: intent.id,
    });

    const orchestration = await dependencies.orchestrator.orchestrateIntent(intent);
    if (!orchestration.success) {
      const systemMessage = withResponderMessage(orchestration.message, 'System Router');
      await dependencies.audit.appendTransaction(AUDIT_ACTIONS.TELEGRAM_ROUTE_FAILED, {
        intentId: intent.id,
        parentTxnId: intakeTxnId,
        reason: orchestration.message,
        correlationId: intent.id,
      });

      const persisted = await persistConversationTurn({
        channel: 'telegram',
        roomId: payload.chatId ?? 'telegram-direct',
        providerRoomId: payload.chatId,
        operatorExternalId: payload.senderId,
        operatorDisplayName: payload.senderName,
        targetPersonaId: payload.explicitTargetPersonaId,
        sessionId: intent.sessionId,
        incomingText: trimmedMessage,
        responseText: systemMessage,
        responseStatus: 'failed',
        responseAccepted: false,
        messageTimestamp: intent.timestamp,
        responseWorkOrderId: orchestration.workOrderId,
        metadata: payload.metadata,
      });

      return {
        accepted: false,
        status: 'failed',
        message: systemMessage,
        auditTrailRef: orchestration.auditTrailRef,
        conversationId: persisted.conversation.conversationId,
        conversationKey: persisted.conversation.conversationKey,
        sessionId: intent.sessionId,
      };
    }

    const interceptionContext: InterceptionContext = {
      agentId: orchestration.personaId,
      workOrderId: orchestration.workOrderId,
      workflowId: 'telegram-ingress-workflow',
      inputData: {
        action: 'telegram_message_route',
        message: trimmedMessage,
        senderId: payload.senderId,
        chatId: payload.chatId,
      },
      requestedChannels: ['telegram'],
      dataClassification: payload.dataClassification ?? 'INTERNAL',
    };

    const intercept = await dependencies.interceptor.interceptAndValidate(interceptionContext);

    if (intercept.action === InterceptionAction.BLOCK) {
      const blockedPersona = agentRegistryService.getAgent(orchestration.personaId);
      const blockedMessage = withResponderMessage(
        'Protocol validation blocked Telegram routing.',
        blockedPersona?.name,
        blockedPersona?.role,
      );
      await dependencies.audit.appendTransaction(AUDIT_ACTIONS.TELEGRAM_ROUTE_BLOCKED, {
        workOrderId: orchestration.workOrderId,
        personaId: orchestration.personaId,
        violations: intercept.violations.map((violation) => violation.description),
        parentTxnId: intakeTxnId,
        correlationId: intent.id,
      });

      const persisted = await persistConversationTurn({
        channel: 'telegram',
        roomId: payload.chatId ?? 'telegram-direct',
        providerRoomId: payload.chatId,
        operatorExternalId: payload.senderId,
        operatorDisplayName: payload.senderName,
        targetPersonaId: orchestration.personaId,
        sessionId: intent.sessionId,
        incomingText: trimmedMessage,
        responseText: blockedMessage,
        responseStatus: 'blocked',
        responseAccepted: false,
        messageTimestamp: intent.timestamp,
        responseWorkOrderId: orchestration.workOrderId,
        metadata: {
          violations: intercept.violations.map((violation) => violation.description),
          ...(payload.metadata ?? {}),
        },
      });

      return {
        accepted: false,
        status: 'blocked',
        message: blockedMessage,
        workOrderId: orchestration.workOrderId,
        personaId: orchestration.personaId,
        personaName: blockedPersona?.name,
        personaRole: blockedPersona?.role,
        responsePreview: `Routing blocked before ${blockedPersona?.name ?? orchestration.personaId} could execute.`,
        auditTrailRef: orchestration.auditTrailRef,
        violations: intercept.violations.map((violation) => violation.description),
        conversationId: persisted.conversation.conversationId,
        conversationKey: persisted.conversation.conversationKey,
        sessionId: intent.sessionId,
      };
    }

    if (intercept.action === InterceptionAction.ESCALATE_TO_EVA) {
      const escalatedPersona = agentRegistryService.getAgent(orchestration.personaId);
      const escalatedMessage = withResponderMessage(
        'Telegram message escalated to Eva due to protocol policy.',
        escalatedPersona?.name,
        escalatedPersona?.role,
      );
      await dependencies.audit.appendTransaction(AUDIT_ACTIONS.TELEGRAM_ROUTE_ESCALATED, {
        workOrderId: orchestration.workOrderId,
        personaId: orchestration.personaId,
        violations: intercept.violations.map((violation) => violation.description),
        parentTxnId: intakeTxnId,
        correlationId: intent.id,
      });

      const persisted = await persistConversationTurn({
        channel: 'telegram',
        roomId: payload.chatId ?? 'telegram-direct',
        providerRoomId: payload.chatId,
        operatorExternalId: payload.senderId,
        operatorDisplayName: payload.senderName,
        targetPersonaId: orchestration.personaId,
        sessionId: intent.sessionId,
        incomingText: trimmedMessage,
        responseText: escalatedMessage,
        responseStatus: 'escalated',
        responseAccepted: false,
        messageTimestamp: intent.timestamp,
        responseWorkOrderId: orchestration.workOrderId,
        metadata: {
          violations: intercept.violations.map((violation) => violation.description),
          ...(payload.metadata ?? {}),
        },
      });

      return {
        accepted: false,
        status: 'escalated',
        message: escalatedMessage,
        workOrderId: orchestration.workOrderId,
        personaId: orchestration.personaId,
        personaName: escalatedPersona?.name,
        personaRole: escalatedPersona?.role,
        responsePreview: `Policy escalated execution request from ${escalatedPersona?.name ?? orchestration.personaId}.`,
        auditTrailRef: orchestration.auditTrailRef,
        violations: intercept.violations.map((violation) => violation.description),
        conversationId: persisted.conversation.conversationId,
        conversationKey: persisted.conversation.conversationKey,
        sessionId: intent.sessionId,
      };
    }

    const acceptedPersona = agentRegistryService.getAgent(orchestration.personaId);
    const acceptedMessage = withResponderMessage(
      orchestration.message,
      acceptedPersona?.name,
      acceptedPersona?.role,
    );
    await dependencies.audit.appendTransaction(AUDIT_ACTIONS.TELEGRAM_ROUTE_ACCEPTED, {
      workOrderId: orchestration.workOrderId,
      personaId: orchestration.personaId,
      interceptionAction: intercept.action,
      parentTxnId: intakeTxnId,
      correlationId: intent.id,
    });

    const sessionId = intent.sessionId;
    const persisted = await persistConversationTurn({
      channel: 'telegram',
      roomId: payload.chatId ?? 'telegram-direct',
      providerRoomId: payload.chatId,
      operatorExternalId: payload.senderId,
      operatorDisplayName: payload.senderName,
      targetPersonaId: orchestration.personaId,
      sessionId,
      incomingText: trimmedMessage,
      responseText: acceptedMessage,
      responseStatus: 'accepted',
      responseAccepted: true,
      messageTimestamp: intent.timestamp,
      responseWorkOrderId: orchestration.workOrderId,
      metadata: {
        chatId: payload.chatId,
        ...(payload.metadata ?? {}),
      },
    });

    return {
      accepted: true,
      status: 'accepted',
      message: acceptedMessage,
      workOrderId: orchestration.workOrderId,
      personaId: orchestration.personaId,
      personaName: acceptedPersona?.name,
      personaRole: acceptedPersona?.role,
      responsePreview: `${acceptedPersona?.name ?? orchestration.personaId}: ${trimmedMessage.slice(0, 220)}`,
      auditTrailRef: orchestration.auditTrailRef,
      violations: intercept.violations.map((violation) => violation.description),
      conversationId: persisted.conversation.conversationId,
      conversationKey: persisted.conversation.conversationKey,
      sessionId,
    };
  },

  async routeWhatsAppMessage(payload: WhatsAppIngressPayload): Promise<ChannelRoutingResult> {
    const trimmedMessage = payload.message.trim();
    if (!trimmedMessage) {
      return {
        accepted: false,
        status: 'rejected',
        message: 'WhatsApp message cannot be empty.',
      };
    }

    const runtimeChannelDetails = await dependencies.getRuntimeChannelDetails();
    const globallyAllowedChannels = getChannelAllowlist(runtimeChannelDetails);
    
    if (globallyAllowedChannels.size > 0 && !globallyAllowedChannels.has('whatsapp')) {
      return {
        accepted: false,
        status: 'rejected',
        message: 'WhatsApp channel is disabled in onboarding runtime policy.',
      };
    }

    // 1. Enforce Whitelisted Group Sandboxing
    const incomingChatId = payload.chatId ?? '';
    const whitelistedGroups = new Set((runtimeChannelDetails?.whitelistedGroups ?? []).map(normalize));
    
    if (whitelistedGroups.size > 0 && !whitelistedGroups.has(normalize(incomingChatId))) {
      return {
        accepted: false,
        status: 'rejected',
        message: 'WhatsApp message originates from a non-whitelisted group JID. Ignoring.',
      };
    }

    // 2. Enforce Level-0 Fallback for Unknown Numbers
    const incomingSenderId = payload.senderId;
    const whitelistedNumbers = new Set((runtimeChannelDetails?.whitelistedNumbers ?? []).map(normalize));
    
    let permissionLevel = 'Full';
    if (whitelistedNumbers.size > 0 && !whitelistedNumbers.has(normalize(incomingSenderId))) {
      permissionLevel = 'Level 0 - General Info only';
    }

    const intent: DirectorIntent = {
      id: dependencies.createId(),
      timestamp: payload.timestampIso ?? dependencies.nowIso(),
      message: trimmedMessage,
      explicitTargetPersonaId: payload.explicitTargetPersonaId ?? extractExplicitTarget(trimmedMessage),
      sessionId: payload.sessionId ?? `whatsapp-${dependencies.createId()}`,
      metadata: {
        channel: 'whatsapp',
        senderId: payload.senderId,
        senderName: payload.senderName,
        chatId: payload.chatId,
        permissionLevel,
        ...(payload.metadata ?? {}),
      },
    };

    const orchestration = await dependencies.orchestrator.orchestrateIntent(intent);
    if (!orchestration.success) {
      return {
        accepted: false,
        status: 'failed',
        message: orchestration.message,
        auditTrailRef: orchestration.auditTrailRef,
        sessionId: intent.sessionId,
      };
    }

    return {
      accepted: true,
      status: 'accepted',
      message: 'Message routed successfully via WhatsApp adapter.',
      workOrderId: orchestration.workOrderId,
      personaId: orchestration.personaId,
      sessionId: intent.sessionId,
    };
  },

  async listConversations(channel?: ChannelType, limit?: number): Promise<ConversationRecord[]> {
    return conversationStoreService.listConversations(limit ?? 100, (channel as ConversationChannel | undefined));
  },

  async getConversationHistory(conversationKey: string, limit?: number): Promise<ChatConversationSnapshot | null> {
    const conversation = await conversationStoreService.getConversationByKey(conversationKey);
    if (!conversation) {
      return null;
    }
    const messages = await conversationStoreService.listConversationMessages(conversation.conversationId, limit ?? 200);
    return { conversation, messages };
  },

  async getConversationByKey(conversationKey: string): Promise<ConversationRecord | null> {
    return conversationStoreService.getConversationByKey(conversationKey);
  },
};
