import { IpcService, ServerResponse } from 'astra';
import { AppRegistryRecord, IdentityAccount, RuntimeConfigEntry, UpdateMetadata } from '../model/runtime.types';

const ipc = new IpcService();

export const runtimeRepository = {
  getIdentity(): Promise<ServerResponse<IdentityAccount | null>> {
    return ipc.invoke('runtime:identity-get');
  },

  linkAccount(provider: string, email: string): Promise<ServerResponse<IdentityAccount>> {
    return ipc.invoke('runtime:identity-link-account', { provider, email });
  },

  validateSession(): Promise<ServerResponse<{ valid: boolean }>> {
    return ipc.invoke('runtime:session-validate');
  },

  listApplications(): Promise<ServerResponse<AppRegistryRecord[]>> {
    return ipc.invoke('runtime:registry-list');
  },

  getApplication(appId: string): Promise<ServerResponse<AppRegistryRecord>> {
    return ipc.invoke('runtime:registry-get', { appId });
  },

  install(appId: string, name: string, version: string): Promise<ServerResponse<AppRegistryRecord>> {
    return ipc.invoke('runtime:install', { appId, name, version });
  },

  checkUpdate(appId: string): Promise<ServerResponse<UpdateMetadata>> {
    return ipc.invoke('runtime:update-check', { appId });
  },

  applyUpdate(appId: string, version: string): Promise<ServerResponse<AppRegistryRecord>> {
    return ipc.invoke('runtime:update-apply', { appId, version });
  },

  launch(appId: string): Promise<ServerResponse<{ appId: string; status: string }>> {
    return ipc.invoke('runtime:launch', { appId });
  },

  stop(appId: string): Promise<ServerResponse<{ appId: string; status: string }>> {
    return ipc.invoke('runtime:stop', { appId });
  },

  getConfig(key?: string): Promise<ServerResponse<RuntimeConfigEntry | RuntimeConfigEntry[] | null>> {
    return ipc.invoke('runtime:config-get', { key });
  },

  setConfig(key: string, value: unknown): Promise<ServerResponse<RuntimeConfigEntry>> {
    return ipc.invoke('runtime:config-set', { key, value });
  },

  onInstallProgress(callback: (data: unknown) => void): () => void {
    return ipc.receive('runtime:install-progress', callback);
  },

  onAppStateChange(callback: (data: unknown) => void): () => void {
    return ipc.receive('runtime:app-state-change', callback);
  }
};
