import { ChannelAdapter, ChannelCapabilityProfile, ChannelMessageEnvelope } from '../types/channelAdapterTypes';

const readString = (value: unknown, fallback = ''): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  return value;
};

export class InternalChatAdapter implements ChannelAdapter {
  channelId = 'internal-chat';

  label = 'In-App Chat';

  async getCapabilities(): Promise<ChannelCapabilityProfile> {
    return {
      channelId: this.channelId,
      label: this.label,
      supportsGroups: true,
      supportsThreading: true,
      supportsActionsViaMessage: true,
      supportedMessageTypes: ['text'],
      requiresAccountBinding: false,
      isConfigured: true,
      isEnabled: true,
    };
  }

  async normalizeInboundMessage(rawPayload: Record<string, unknown>): Promise<ChannelMessageEnvelope> {
    return {
      senderId: readString(rawPayload.senderId),
      senderName: readString(rawPayload.senderName, undefined),
      channelId: this.channelId,
      roomId: readString(rawPayload.roomId, readString(rawPayload.moduleRoute, 'internal-default')),
      messageText: readString(rawPayload.messageText, readString(rawPayload.message)),
      timestampIso: readString(rawPayload.timestampIso, undefined),
      sessionId: readString(rawPayload.sessionId, undefined),
      explicitTargetPersonaId: readString(
        rawPayload.explicitTargetPersonaId,
        readString(rawPayload.targetPersonaId, undefined),
      ),
      isDirector: rawPayload.isDirector === true,
      metadata: (rawPayload.metadata as Record<string, unknown> | undefined) ?? undefined,
    };
  }

  async validate(): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }
}
