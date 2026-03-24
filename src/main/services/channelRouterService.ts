import { v4 as generateUUID } from 'uuid';
import {
  DataClassification,
  InterceptionAction,
  InterceptionContext,
} from './types/orchestrationTypes';
import { getPublicRuntimeConfig } from './runtimeConfigService';
import { orchestrationManager, DirectorIntent } from './orchestrationManager';
import { protocolInterceptor } from './protocolInterceptor';
import { auditLogService, AUDIT_ACTIONS } from './auditLogService';
import { registryRuntimeStoreService, RuntimeChannelDetails } from './registryRuntimeStoreService';
import { agentRegistryService } from './agentRegistryService';

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
}

interface ChannelRouterDependencies {
  getRuntimeConfig: typeof getPublicRuntimeConfig;
  getRuntimeChannelDetails: () => Promise<RuntimeChannelDetails | null>;
  createId: () => string;
  nowIso: () => string;
  audit: Pick<typeof auditLogService, 'createTransaction' | 'appendTransaction'>;
  orchestrator: Pick<typeof orchestrationManager, 'orchestrateIntent'>;
  interceptor: Pick<typeof protocolInterceptor, 'interceptAndValidate'>;
}

const createDefaultDependencies = (): ChannelRouterDependencies => ({
  getRuntimeConfig: getPublicRuntimeConfig,
  getRuntimeChannelDetails: () => registryRuntimeStoreService.getRuntimeChannelDetails(),
  createId: () => generateUUID(),
  nowIso: () => new Date().toISOString(),
  audit: auditLogService,
  orchestrator: orchestrationManager,
  interceptor: protocolInterceptor,
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

    const globallyAllowedChannels = new Set(
      (runtimeChannelDetails?.allowedChannels ?? []).map((channel) => channel.toLowerCase()),
    );
    if (globallyAllowedChannels.size > 0 && !globallyAllowedChannels.has('telegram')) {
      return {
        accepted: false,
        status: 'rejected',
        message: 'Telegram channel is disabled in onboarding runtime policy.',
      };
    }

    const senderIdentity = normalize(payload.senderId);
    const directorIdentity = normalize(runtimeConfig.directorEmail);
    const isAuthorizedDirector = payload.isDirector === true || senderIdentity === directorIdentity;

    if (!isAuthorizedDirector) {
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

      return {
        accepted: false,
        status: 'failed',
        message: systemMessage,
        auditTrailRef: orchestration.auditTrailRef,
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
    };
  },
};