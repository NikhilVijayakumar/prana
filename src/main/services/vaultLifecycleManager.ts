import { syncProviderService, type SplashSyncResult } from './syncProviderService';

export type VaultLifecycleStatus = 'LOCKED' | 'UNLOCKED' | 'SYNCING' | 'ERROR';

export interface VaultLifecycleSnapshot {
  status: VaultLifecycleStatus;
  lockedByDefaultTarget: boolean;
  lastTransitionAt: string | null;
  lastError: string | null;
  lastStartupSync: SplashSyncResult | null;
}

let lifecycleSnapshot: VaultLifecycleSnapshot = {
  status: 'LOCKED',
  lockedByDefaultTarget: true,
  lastTransitionAt: null,
  lastError: null,
  lastStartupSync: null,
};

const markLifecycle = (
  status: VaultLifecycleStatus,
  input?: { error?: string | null; startupSync?: SplashSyncResult | null },
): VaultLifecycleSnapshot => {
  lifecycleSnapshot = {
    ...lifecycleSnapshot,
    status,
    lastTransitionAt: new Date().toISOString(),
    lastError: input?.error ?? null,
    lastStartupSync: input?.startupSync ?? lifecycleSnapshot.lastStartupSync,
  };
  return lifecycleSnapshot;
};

export const vaultLifecycleManager = {
  async seedLocalConfig(): Promise<void> {
    // Legacy stub. Seeding is now handled by bootstrap IPC.
  },

  async syncAndLockOnStartup(installMode: SplashSyncResult['installMode']): Promise<SplashSyncResult> {
    markLifecycle('SYNCING');

    try {
      const result = await syncProviderService.initializeOnSplash({ installMode });
      markLifecycle('LOCKED', { startupSync: result });
      return result;
    } catch (error) {
      markLifecycle('ERROR', {
        error: error instanceof Error ? error.message : 'Vault lifecycle startup sync failed.',
      });
      throw error;
    }
  },

  markUnlocked(): VaultLifecycleSnapshot {
    return markLifecycle('UNLOCKED');
  },

  markLocked(): VaultLifecycleSnapshot {
    return markLifecycle('LOCKED');
  },

  getSnapshot(): VaultLifecycleSnapshot {
    return { ...lifecycleSnapshot };
  },
};
