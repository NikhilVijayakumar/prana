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
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
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

const resolveAppId = (dependencies: ChannelRouterDependencies): string => {
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

const persistConversationTurn = async (
  dependencies: ChannelRouterDependencies,
  input: {
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
  },
): Promise<{ conversation: ConversationRecord; operatorMessage: ConversationMessageRecord; responseMessage: ConversationMessageRecord }> => {
  const identity = await conversationStoreService.resolveOperatorIdentity({
    appId: resolveAppId(dependencies),
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
    appId: resolveAppId(dependencies),
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
    rejected: 'REJECTED',
    failed: 'FAILED',
  };

  const responseMessage = await conversationStoreService.appendMessage({
    conversationId: conversation.conversationId,
    sessionKey: input.sessionId,
    role: 'persona',
    actorId: input.targetPersonaId ?? 'switchboard',
    actorName: input.operatorDisplayName ?? null,
    content: input.responseText,
    channel: input.channel,
    status: statusMap[input.responseStatus] ?? 'ROUTED',
    metadata: { ...input.metadata, accepted: input.responseAccepted },
    workOrderId: input.responseWorkOrderId,
  });

  return { conversation, operatorMessage, responseMessage };
};

/**
 * Factory function to create a channel router.
 * Eliminates module-level dependencies state.
 */
export const createChannelRouter = () => {
  // Instance-level state (not module-level)
  let dependencies: ChannelRouterDependencies = createDefaultDependencies();

  const routeTelegramMessage = async (payload: TelegramIngressPayload): Promise<ChannelRoutingResult> => {
    const intent: DirectorIntent = {
      sessionId: payload.sessionId ?? `telegram-${dependencies.createId()}`,
      channel: 'TELEGRAM',
      rawText: payload.message,
      senderId: payload.senderId,
      senderName: payload.senderName,
      isDirector: isAuthorizedDirector(payload.senderId, dependencies.getRuntimeConfig(), payload.isDirector),
      explicitTargetPersonaId: payload.explicitTargetPersonaId ?? extractExplicitTarget(payload.message),
      dataClassification: payload.dataClassification,
      timestampIso: payload.timestampIso ?? dependencies.nowIso(),
      metadata: { chatId: payload.chatId, ...payload.metadata },
    };

    try {
      const intercept = await dependencies.interceptor.interceptAndValidate({
        channel: 'TELEGRAM',
        senderId: intent.senderId,
        message: intent.rawText,
        dataClassification: intent.dataClassification,
      });

      if (intercept.action === 'BLOCK') {
        await dependencies.audit.appendTransaction(AUDIT_ACTIONS.TELEGRAM_ROUTE_BLOCKED, {
          sessionId: intent.sessionId,
          channel: 'TELEGRAM',
          senderId: intent.senderId,
          reason: intercept.reason ?? 'Message blocked by interceptor',
          violations: intercept.violations ?? [],
        });

        return {
          accepted: false,
          status: 'blocked',
          message: withResponderMessage(intercept.reason ?? 'Message blocked.', undefined, 'Security Interceptor'),
          violations: intercept.violations ?? [],
          sessionId: intent.sessionId,
        };
      }

      if (intercept.action === 'ESCALATE') {
        const result = await dependencies.submitDirectorRequest({
          sessionId: intent.sessionId,
          channel: 'TELEGRAM',
          senderId: intent.senderId,
          message: intent.rawText,
          reason: intercept.reason ?? 'Escalation requested by interceptor',
          metadata: { ...intent.metadata, violations: intercept.violations ?? [] },
        });

        await dependencies.audit.appendTransaction(AUDIT_ACTIONS.TELEGRAM_ROUTE_ESCALATED, {
          sessionId: intent.sessionId,
          channel: 'TELEGRAM',
          senderId: intent.senderId,
          escalated: result.accepted,
          reason: intercept.reason ?? 'Escalation requested by interceptor',
        });

        return {
          accepted: result.accepted,
          status: 'escalated',
          message: result.message,
          workOrderId: result.workOrderId,
          sessionId: intent.sessionId,
        };
      }

      const orchestration = await dependencies.orchestrator.orchestrateIntent(intent);

      await dependencies.audit.appendTransaction(AUDIT_ACTIONS.TELEGRAM_ROUTE_ACCEPTED, {
        sessionId: intent.sessionId,
        channel: 'TELEGRAM',
        senderId: intent.senderId,
        personaId: orchestration.personaId,
        accepted: orchestration.accepted,
      });

      if (!orchestration.accepted) {
        return {
          accepted: false,
          status: 'rejected',
          message: orchestration.responsePreview ?? 'Message rejected by orchestrator.',
          sessionId: intent.sessionId,
        };
      }

      const { conversation } = await persistConversationTurn(dependencies, {
        channel: 'TELEGRAM',
        roomId: payload.chatId ?? payload.senderId,
        operatorExternalId: intent.senderId,
        operatorDisplayName: intent.senderName,
        targetPersonaId: orchestration.personaId,
        sessionId: intent.sessionId,
        incomingText: intent.rawText,
        responseText: orchestration.responsePreview ?? '',
        responseStatus: 'accepted',
        responseAccepted: true,
        messageTimestamp: intent.timestampIso!,
        responseWorkOrderId: orchestration.workOrderId,
        metadata: intent.metadata,
      });

      return {
        accepted: true,
        status: 'accepted',
        message: 'Message routed successfully via Telegram adapter.',
        workOrderId: orchestration.workOrderId,
        personaId: orchestration.personaId,
        sessionId: intent.sessionId,
      };
    } catch (error) {
      await dependencies.audit.appendTransaction(AUDIT_ACTIONS.TELEGRAM_ROUTE_FAILED, {
        sessionId: intent.sessionId,
        channel: 'TELEGRAM',
        senderId: intent.senderId,
        error: error instanceof Error ? error.message : 'Unknown routing error',
      });

      return {
        accepted: false,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Failed to route Telegram message.',
        sessionId: intent.sessionId,
      };
    }
  };

  const routeWhatsAppMessage = async (payload: WhatsAppIngressPayload): Promise<ChannelRoutingResult> => {
    const intent: DirectorIntent = {
      sessionId: payload.sessionId ?? `whatsapp-${dependencies.createId()}`,
      channel: 'WHATSAPP',
      rawText: payload.message,
      senderId: payload.senderId,
      senderName: payload.senderName,
      isDirector: isAuthorizedDirector(payload.senderId, dependencies.getRuntimeConfig(), payload.isDirector),
      explicitTargetPersonaId: payload.explicitTargetPersonaId ?? extractExplicitTarget(payload.message),
      dataClassification: payload.dataClassification,
      timestampIso: payload.timestampIso ?? dependencies.nowIso(),
      metadata: { chatId: payload.chatId, ...payload.metadata },
    };

    try {
      const runtimeChannelDetails = await dependencies.getRuntimeChannelDetails();
      const channelAdapter = runtimeChannelDetails?.whatsappAdapter;
      if (!channelAdapter) {
        return {
          accepted: false,
          status: 'rejected',
          message: 'WhatsApp channel adapter not configured.',
          sessionId: intent.sessionId,
        };
      }

      const intercept = await dependencies.interceptor.interceptAndValidate({
        channel: 'WHATSAPP',
        senderId: intent.senderId,
        message: intent.rawText,
        dataClassification: intent.dataClassification,
      });

      if (intercept.action === 'BLOCK') {
        await dependencies.audit.appendTransaction(AUDIT_ACTIONS.WHATSAPP_ROUTE_BLOCKED, {
          sessionId: intent.sessionId,
          channel: 'WHATSAPP',
          senderId: intent.senderId,
          reason: intercept.reason ?? 'Message blocked by interceptor',
          violations: intercept.violations ?? [],
        });

        return {
          accepted: false,
          status: 'blocked',
          message: withResponderMessage(intercept.reason ?? 'Message blocked.', undefined, 'Security Interceptor'),
          violations: intercept.violations ?? [],
          sessionId: intent.sessionId,
        };
      }

      const orchestration = await dependencies.orchestrator.orchestrateIntent(intent);

      if (!orchestration.accepted) {
        return {
          accepted: false,
          status: 'rejected',
          message: orchestration.responsePreview ?? 'Message rejected by orchestrator.',
          sessionId: intent.sessionId,
        };
      }

      const { conversation } = await persistConversationTurn(dependencies, {
        channel: 'WHATSAPP',
        roomId: payload.chatId ?? payload.senderId,
        operatorExternalId: intent.senderId,
        operatorDisplayName: intent.senderName,
        targetPersonaId: orchestration.personaId,
        sessionId: intent.sessionId,
        incomingText: intent.rawText,
        responseText: orchestration.responsePreview ?? '',
        responseStatus: 'accepted',
        responseAccepted: true,
        messageTimestamp: intent.timestampIso!,
        responseWorkOrderId: orchestration.workOrderId,
        metadata: intent.metadata,
      });

      return {
        accepted: true,
        status: 'accepted',
        message: 'Message routed successfully via WhatsApp adapter.',
        workOrderId: orchestration.workOrderId,
        personaId: orchestration.personaId,
        sessionId: intent.sessionId,
      };
    } catch (error) {
      await dependencies.audit.appendTransaction(AUDIT_ACTIONS.WHATSAPP_ROUTE_FAILED, {
        sessionId: intent.sessionId,
        channel: 'WHATSAPP',
        senderId: intent.senderId,
        error: error instanceof Error ? error.message : 'Unknown routing error',
      });

      return {
        accepted: false,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Failed to route WhatsApp message.',
        sessionId: intent.sessionId,
      };
    }
  };

  const routeInternalChat = async (payload: InternalChatPayload): Promise<ChannelRoutingResult> => {
    const intent: DirectorIntent = {
      sessionId: payload.sessionId ?? `internal-${dependencies.createId()}`,
      channel: 'INTERNAL_CHAT',
      rawText: payload.message,
      senderId: payload.senderId,
      senderName: payload.senderName,
      isDirector: payload.isDirector ?? false,
      explicitTargetPersonaId: payload.targetPersonaId ?? extractExplicitTarget(payload.message),
      timestampIso: payload.timestampIso ?? dependencies.nowIso(),
      metadata: { moduleRoute: payload.moduleRoute, roomId: payload.roomId, ...payload.metadata },
    };

    try {
      const orchestration = await dependencies.orchestrator.orchestrateIntent(intent);

      if (!orchestration.accepted) {
        return {
          accepted: false,
          status: 'rejected',
          message: orchestration.responsePreview ?? 'Message rejected by orchestrator.',
          sessionId: intent.sessionId,
        };
      }

      const { conversation } = await persistConversationTurn(dependencies, {
        channel: 'INTERNAL_CHAT',
        roomId: payload.roomId ?? payload.senderId,
        operatorExternalId: intent.senderId,
        operatorDisplayName: intent.senderName,
        targetPersonaId: orchestration.personaId,
        sessionId: intent.sessionId,
        incomingText: intent.rawText,
        responseText: orchestration.responsePreview ?? '',
        responseStatus: 'accepted',
        responseAccepted: true,
        messageTimestamp: intent.timestampIso!,
        responseWorkOrderId: orchestration.workOrderId,
        metadata: intent.metadata,
      });

      return {
        accepted: true,
        status: 'accepted',
        message: 'Message routed successfully via Internal Chat.',
        workOrderId: orchestration.workOrderId,
        personaId: orchestration.personaId,
        sessionId: intent.sessionId,
      };
    } catch (error) {
      return {
        accepted: false,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Failed to route internal chat message.',
        sessionId: intent.sessionId,
      };
    }
  };

  return {
    async routeTelegramMessage(payload: TelegramIngressPayload): Promise<ChannelRoutingResult> {
      return routeTelegramMessage(payload);
    },

    async routeWhatsAppMessage(payload: WhatsAppIngressPayload): Promise<ChannelRoutingResult> {
      return routeWhatsAppMessage(payload);
    },

    async routeInternalChat(payload: InternalChatPayload): Promise<ChannelRoutingResult> {
      return routeInternalChat(payload);
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

    setDependencies(newDependencies: Partial<ChannelRouterDependencies>): void {
      dependencies = { ...dependencies, ...newDependencies };
    },

    getDependencies(): ChannelRouterDependencies {
      return { ...dependencies };
    },

    __resetForTesting(): void {
      dependencies = createDefaultDependencies();
    },
  };
};

// Backward compatibility - creates a default instance
const defaultChannelRouter = createChannelRouter();

export const channelRouterService = defaultChannelRouter;

// Convenience functions that delegate to the default instance
export async function routeTelegramMessage(payload: TelegramIngressPayload): Promise<ChannelRoutingResult> {
  return defaultChannelRouter.routeTelegramMessage(payload);
}

export async function routeWhatsAppMessage(payload: WhatsAppIngressPayload): Promise<ChannelRoutingResult> {
  return defaultChannelRouter.routeWhatsAppMessage(payload);
}

export async function routeInternalChat(payload: InternalChatPayload): Promise<ChannelRoutingResult> {
  return defaultChannelRouter.routeInternalChat(payload);
}
