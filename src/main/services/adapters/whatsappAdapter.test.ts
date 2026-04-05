import { describe, expect, it } from 'vitest';
import { normalizeWhatsAppInboundMessage, WhatsAppAdapter } from './whatsappAdapter';

describe('WhatsAppAdapter', () => {
  it('normalizes WhatsApp Cloud API webhook payloads', async () => {
    const adapter = new WhatsAppAdapter();

    const envelope = await adapter.normalizeInboundMessage({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550001111',
                  phone_number_id: '987654321',
                },
                contacts: [
                  {
                    wa_id: '15551234567',
                    profile: {
                      name: 'Jordan Lee',
                    },
                  },
                ],
                messages: [
                  {
                    id: 'wamid.abc123',
                    from: '15551234567',
                    timestamp: '1712345678',
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: {
                        id: 'reply-1',
                        title: 'Approve',
                      },
                    },
                    context: {
                      id: 'conversation-1',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(envelope.channelId).toBe('whatsapp');
    expect(envelope.senderId).toBe('15551234567');
    expect(envelope.senderName).toBe('Jordan Lee');
    expect(envelope.roomId).toBe('conversation-1');
    expect(envelope.accountId).toBe('987654321');
    expect(envelope.sessionId).toBe('conversation-1');
    expect(envelope.messageText).toBe('Approve');
    expect(envelope.timestampIso).toBe(new Date(1712345678 * 1000).toISOString());
    expect(envelope.metadata).toMatchObject({
      provider: 'whatsapp',
      messageId: 'wamid.abc123',
      messageType: 'interactive',
      conversationId: 'conversation-1',
      phoneNumberId: '987654321',
      displayPhoneNumber: '15550001111',
      contactName: 'Jordan Lee',
      contactWaId: '15551234567',
    });
  });

  it('normalizes plain text WhatsApp payloads through the shared helper', () => {
    const envelope = normalizeWhatsAppInboundMessage({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [
                  {
                    wa_id: '15550000001',
                    profile: {
                      name: 'Sam',
                    },
                  },
                ],
                messages: [
                  {
                    id: 'wamid.text1',
                    from: '15550000001',
                    timestamp: '1712345000',
                    type: 'text',
                    text: {
                      body: 'Hello from WhatsApp',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(envelope.messageText).toBe('Hello from WhatsApp');
    expect(envelope.senderName).toBe('Sam');
    expect(envelope.sessionId).toBe('wamid.text1');
  });
});
