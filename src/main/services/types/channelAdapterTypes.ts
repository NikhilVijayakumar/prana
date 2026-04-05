export type ChannelMessageType = 'text' | 'image' | 'file' | 'voice';

export interface WhatsAppWebhookContactProfile {
  name?: string;
}

export interface WhatsAppWebhookContact {
  wa_id?: string;
  profile?: WhatsAppWebhookContactProfile;
}

export interface WhatsAppWebhookTextMessage {
  body?: string;
}

export interface WhatsAppWebhookMediaMessage {
  caption?: string;
  mime_type?: string;
  id?: string;
}

export interface WhatsAppWebhookMessageContext {
  id?: string;
  from?: string;
}

export interface WhatsAppWebhookMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: WhatsAppWebhookTextMessage;
  image?: WhatsAppWebhookMediaMessage;
  document?: WhatsAppWebhookMediaMessage;
  audio?: WhatsAppWebhookMediaMessage;
  video?: WhatsAppWebhookMediaMessage;
  sticker?: WhatsAppWebhookMediaMessage;
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
  context?: WhatsAppWebhookMessageContext;
}

export interface WhatsAppWebhookValue {
  messaging_product?: 'whatsapp';
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: WhatsAppWebhookContact[];
  messages?: WhatsAppWebhookMessage[];
  statuses?: Array<{
    id?: string;
    status?: string;
    timestamp?: string;
  }>;
}

export interface WhatsAppWebhookChange {
  value?: WhatsAppWebhookValue;
}

export interface WhatsAppWebhookEntry {
  changes?: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: WhatsAppWebhookEntry[];
}

export interface ChannelMessageEnvelope {
  senderId: string;
  senderName?: string;
  channelId: string;
  roomId: string;
  accountId?: string;
  messageText: string;
  timestampIso?: string;
  sessionId?: string;
  explicitTargetPersonaId?: string;
  isDirector?: boolean;
  dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  metadata?: Record<string, unknown>;
}

export interface ChannelCapabilityProfile {
  channelId: string;
  label: string;
  supportsGroups: boolean;
  supportsThreading: boolean;
  supportsActionsViaMessage: boolean;
  supportedMessageTypes: ChannelMessageType[];
  requiresAccountBinding: boolean;
  isConfigured: boolean;
  isEnabled: boolean;
}

export interface ChannelAdapter {
  channelId: string;
  label: string;
  getCapabilities(): Promise<ChannelCapabilityProfile>;
  normalizeInboundMessage(rawPayload: Record<string, unknown>): Promise<ChannelMessageEnvelope>;
  validate(): Promise<{ valid: boolean; errors?: string[] }>;
}
