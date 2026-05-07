import { ChannelAdapter, ChannelCapabilityProfile } from './types/channelAdapterTypes';
import { InternalChatAdapter, TelegramAdapter, WhatsAppAdapter } from './adapters';

/**
 * Factory function to create a channel registry.
 * This is transitional - will be fully DB-backed in v2.
 */
export const createChannelRegistry = () => {
  const adapters = new Map<string, ChannelAdapter>();

  // Register default adapters
  adapters.set('internal-chat', new InternalChatAdapter());
  adapters.set('telegram', new TelegramAdapter());
  adapters.set('whatsapp', new WhatsAppAdapter());

  return {
    register(adapter: ChannelAdapter): void {
      this.adapters.set(adapter.channelId, adapter);
    },

    get(channelId: string): ChannelAdapter | null {
      return adapters.get(channelId) ?? null;
    },

    listAll(): ChannelAdapter[] {
      return Array.from(adapters.values());
    },

    async listCapabilities(): Promise<ChannelCapabilityProfile[]> {
      return Promise.all(this.listAll().map(async (adapter) => adapter.getCapabilities()));
    },

    // For testing
    __resetForTesting(): void {
      adapters.clear();
      // Re-register defaults
      adapters.set('internal-chat', new InternalChatAdapter());
      adapters.set('telegram', new TelegramAdapter());
      adapters.set('whatsapp', new WhatsAppAdapter());
    },
  };
};

// Backward compatibility - creates a default instance
export const channelRegistryService = createChannelRegistry();
