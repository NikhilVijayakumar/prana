import { ChannelAdapter, ChannelCapabilityProfile, ChannelMessageEnvelope } from '../types/channelAdapterTypes';
import { getRuntimeBootstrapConfig } from '../runtimeConfigService';

const maybeString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

export class TelegramAdapter implements ChannelAdapter {
  channelId = 'telegram';

  label = 'Telegram';

  async getCapabilities(): Promise<ChannelCapabilityProfile> {
    let telegramChannelId = '';
    try {
      telegramChannelId = getRuntimeBootstrapConfig().channels.telegramChannelId ?? '';
    } catch {
      telegramChannelId = '';
    }

    return {
      channelId: this.channelId,
      label: this.label,
      supportsGroups: true,
      supportsThreading: false,
      supportsActionsViaMessage: true,
      supportedMessageTypes: ['text'],
      requiresAccountBinding: true,
      isConfigured: Boolean(telegramChannelId),
      isEnabled: true,
    };
  }

  async normalizeInboundMessage(rawPayload: Record<string, unknown>): Promise<ChannelMessageEnvelope> {
    return {
      senderId: maybeString(rawPayload.senderId) ?? '',
      senderName: maybeString(rawPayload.senderName),
      channelId: this.channelId,
      roomId: maybeString(rawPayload.chatId) ?? 'telegram-direct',
      accountId: maybeString(rawPayload.chatId),
      messageText: maybeString(rawPayload.messageText) ?? maybeString(rawPayload.message) ?? '',
      timestampIso: maybeString(rawPayload.timestampIso),
      sessionId: maybeString(rawPayload.sessionId),
      explicitTargetPersonaId: maybeString(rawPayload.explicitTargetPersonaId),
      isDirector: rawPayload.isDirector === true,
      dataClassification: rawPayload.dataClassification as
        | 'PUBLIC'
        | 'INTERNAL'
        | 'CONFIDENTIAL'
        | 'RESTRICTED'
        | undefined,
      metadata: (rawPayload.metadata as Record<string, unknown> | undefined) ?? undefined,
    };
  }

  async validate(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }
}
