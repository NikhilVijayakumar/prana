import { ChannelAdapter, ChannelCapabilityProfile } from './types/channelAdapterTypes';
import { InternalChatAdapter, TelegramAdapter, WhatsAppAdapter } from './adapters';

class ChannelRegistryService {
  private readonly adapters = new Map<string, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channelId, adapter);
  }

  get(channelId: string): ChannelAdapter | null {
    return this.adapters.get(channelId) ?? null;
  }

  listAll(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  async listCapabilities(): Promise<ChannelCapabilityProfile[]> {
    return Promise.all(this.listAll().map(async (adapter) => adapter.getCapabilities()));
  }
}

export const channelRegistryService = new ChannelRegistryService();

channelRegistryService.register(new InternalChatAdapter());
channelRegistryService.register(new TelegramAdapter());
channelRegistryService.register(new WhatsAppAdapter());
