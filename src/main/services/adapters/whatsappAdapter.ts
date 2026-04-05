import {
  ChannelAdapter,
  ChannelCapabilityProfile,
  ChannelMessageEnvelope,
  WhatsAppWebhookMessage,
  WhatsAppWebhookPayload,
  WhatsAppWebhookValue,
} from '../types/channelAdapterTypes';
import { getRuntimeBootstrapConfig } from '../runtimeConfigService';

const maybeString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

const toWhatsappText = (message: WhatsAppWebhookMessage): string => {
  if (message.type === 'text') {
    return maybeString(message.text?.body) ?? '';
  }

  if (message.type === 'image') {
    return maybeString(message.image?.caption) ?? '[image]';
  }

  if (message.type === 'document') {
    return maybeString(message.document?.caption) ?? '[document]';
  }

  if (message.type === 'audio') {
    return '[audio]';
  }

  if (message.type === 'video') {
    return maybeString(message.video?.caption) ?? '[video]';
  }

  if (message.type === 'sticker') {
    return '[sticker]';
  }

  if (message.type === 'interactive') {
    return (
      maybeString(message.interactive?.button_reply?.title)
      ?? maybeString(message.interactive?.list_reply?.title)
      ?? '[interactive-response]'
    );
  }

  return '';
};

const normalizeWhatsAppPayload = (rawPayload: Record<string, unknown>): WhatsAppWebhookValue | null => {
  const payload = rawPayload as WhatsAppWebhookPayload;
  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  return change?.value ?? null;
};

export const normalizeWhatsAppInboundMessage = (
  rawPayload: Record<string, unknown>,
): ChannelMessageEnvelope => {
  const value = normalizeWhatsAppPayload(rawPayload);
  const message = value?.messages?.[0];
  const contact = value?.contacts?.[0];
  const senderId = maybeString(message?.from) ?? maybeString(contact?.wa_id) ?? '';
  const senderName = maybeString(contact?.profile?.name);
  const providerMessageId = maybeString(message?.id);
  const providerConversationId = maybeString(message?.context?.id);
  const phoneNumberId = maybeString(value?.metadata?.phone_number_id);
  const displayPhoneNumber = maybeString(value?.metadata?.display_phone_number);
  const timestampSeconds = Number(message?.timestamp ?? 0);

  return {
    senderId,
    senderName,
    channelId: 'whatsapp',
    roomId: providerConversationId ?? senderId,
    accountId: phoneNumberId ?? displayPhoneNumber,
    messageText: toWhatsappText(message ?? {}),
    timestampIso: Number.isFinite(timestampSeconds) && timestampSeconds > 0
      ? new Date(timestampSeconds * 1000).toISOString()
      : undefined,
    sessionId: providerConversationId ?? providerMessageId,
    explicitTargetPersonaId: undefined,
    isDirector: false,
    metadata: {
      provider: 'whatsapp',
      object: rawPayload.object ?? 'whatsapp_business_account',
      messageId: providerMessageId,
      messageType: message?.type,
      conversationId: providerConversationId,
      phoneNumberId,
      displayPhoneNumber,
      contactName: senderName,
      contactWaId: maybeString(contact?.wa_id),
      raw: rawPayload,
    },
  };
};

export class WhatsAppAdapter implements ChannelAdapter {
  channelId = 'whatsapp';

  label = 'WhatsApp';

  async getCapabilities(): Promise<ChannelCapabilityProfile> {
    let providerCredentials = '';
    try {
      const runtime = getRuntimeBootstrapConfig();
      providerCredentials = (
        runtime as unknown as { channels?: { providerCredentials?: string } }
      ).channels?.providerCredentials ?? '';
    } catch {
      providerCredentials = '';
    }

    return {
      channelId: this.channelId,
      label: this.label,
      supportsGroups: true,
      supportsThreading: false,
      supportsActionsViaMessage: false,
      supportedMessageTypes: ['text', 'image', 'file'],
      requiresAccountBinding: true,
      isConfigured: providerCredentials.includes('whatsapp'),
      isEnabled: providerCredentials.includes('whatsapp'),
    };
  }

  async normalizeInboundMessage(rawPayload: Record<string, unknown>): Promise<ChannelMessageEnvelope> {
    return normalizeWhatsAppInboundMessage(rawPayload);
  }

  async validate(): Promise<{ valid: boolean; errors?: string[] }> {
    const capability = await this.getCapabilities();
    if (!capability.isConfigured) {
      return { valid: true, errors: ['WhatsApp adapter is registered but not configured.'] };
    }
    return { valid: true };
  }
}
