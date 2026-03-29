import { createHash } from 'node:crypto';
import { conflictResolver } from './conflictResolver';
import { registryRuntimeStoreService } from './registryRuntimeStoreService';
import { syncStoreService } from './syncStoreService';
import { vaultLifecycleManager } from './vaultLifecycleManager';
import { vaultService } from './vaultService';

const APPROVED_RUNTIME_SYNC_RECORD_KEY = 'approved_runtime_state';

const computeHash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

export interface SyncEngineSnapshot {
  phase: 'IDLE' | 'OPENING' | 'COMMITTING' | 'PUSHING' | 'CLOSING' | 'ERROR';
  lastTransitionAt: string | null;
  lastError: string | null;
}

let snapshot: SyncEngineSnapshot = {
  phase: 'IDLE',
  lastTransitionAt: null,
  lastError: null,
};

const markPhase = (phase: SyncEngineSnapshot['phase'], error: string | null = null): void => {
  snapshot = {
    phase,
    lastTransitionAt: new Date().toISOString(),
    lastError: error,
  };
};

export const syncEngineService = {
  async reconcileApprovedRuntimeState(input: {
    vaultLastModified?: string | null;
    vaultIntegrityValid: boolean;
    hasVaultRecord: boolean;
  }) {
    const localState = await registryRuntimeStoreService.getApprovedRuntimeState();
    const localLineage = await syncStoreService.getSyncLineageRecord(APPROVED_RUNTIME_SYNC_RECORD_KEY);

    return conflictResolver.resolve({
      hasLocalRecord: Boolean(localState),
      hasVaultRecord: input.hasVaultRecord,
      localLastModified: localLineage?.lastModified ?? localState?.committedAt ?? null,
      vaultLastModified: input.vaultLastModified ?? null,
      localStatus: localLineage?.syncStatus ?? null,
      vaultIntegrityValid: input.vaultIntegrityValid,
    });
  },

  async commitPendingApprovedRuntimeToVault(): Promise<{ committed: boolean; pushed: boolean; pendingRecords: number }> {
    const pendingRecords = await syncStoreService.listSyncLineageRecords('PENDING_UPDATE');
    if (pendingRecords.length === 0) {
      return {
        committed: false,
        pushed: false,
        pendingRecords: 0,
      };
    }

    markPhase('OPENING');
    vaultLifecycleManager.markUnlocked();

    try {
      markPhase('COMMITTING');
      const approvedRuntime = await registryRuntimeStoreService.getApprovedRuntimeState();
      if (!approvedRuntime) {
        throw new Error('Approved runtime state is missing during sync commit.');
      }

      markPhase('PUSHING');
      const publishResult = await vaultService.publishVaultChanges({
        approvedByUser: true,
        commitMessage: `sync: commit approved runtime ${approvedRuntime.committedAt}`,
      });

      if (!publishResult.success || !publishResult.pushed) {
        throw new Error(publishResult.message);
      }

      const payload = JSON.stringify(approvedRuntime);
      const vaultHash = computeHash(payload);
      await syncStoreService.upsertSyncLineageRecord({
        recordKey: APPROVED_RUNTIME_SYNC_RECORD_KEY,
        tableName: 'runtime_registry_meta',
        syncStatus: 'SYNCED',
        payload,
        vaultHash,
        lastModified: approvedRuntime.committedAt,
      });

      markPhase('CLOSING');
      vaultLifecycleManager.markLocked();
      markPhase('IDLE');

      return {
        committed: true,
        pushed: true,
        pendingRecords: pendingRecords.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync engine push failed.';
      markPhase('ERROR', message);
      return {
        committed: false,
        pushed: false,
        pendingRecords: pendingRecords.length,
      };
    }
  },

  getSnapshot(): SyncEngineSnapshot {
    return { ...snapshot };
  },
};
