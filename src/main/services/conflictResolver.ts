export type SyncConflictResolution =
  | 'USE_LOCAL'
  | 'USE_VAULT'
  | 'KEEP_SYNCED'
  | 'BLOCK_INTEGRITY'
  | 'RECONSTRUCT_FROM_VAULT';

export interface SyncConflictInput {
  hasLocalRecord: boolean;
  hasVaultRecord: boolean;
  localLastModified?: string | null;
  vaultLastModified?: string | null;
  localStatus?: 'SYNCED' | 'PENDING_UPDATE' | 'PENDING_DELETE' | 'LOCAL_ONLY' | null;
  vaultIntegrityValid: boolean;
}

export interface SyncConflictDecision {
  resolution: SyncConflictResolution;
  reason: string;
}

const toTime = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const conflictResolver = {
  resolve(input: SyncConflictInput): SyncConflictDecision {
    if (!input.vaultIntegrityValid) {
      return {
        resolution: 'BLOCK_INTEGRITY',
        reason: 'Vault integrity validation failed.',
      };
    }

    if (!input.hasLocalRecord && input.hasVaultRecord) {
      return {
        resolution: 'RECONSTRUCT_FROM_VAULT',
        reason: 'Local SQLite state is missing and must be rebuilt from Vault.',
      };
    }

    if (input.localStatus === 'PENDING_DELETE') {
      return {
        resolution: 'USE_LOCAL',
        reason: 'Local delete is pending and must be preserved until committed.',
      };
    }

    if (input.localStatus === 'LOCAL_ONLY') {
      return {
        resolution: 'USE_LOCAL',
        reason: 'Local-only record must remain outside Vault synchronization.',
      };
    }

    const localTime = toTime(input.localLastModified);
    const vaultTime = toTime(input.vaultLastModified);

    if (localTime !== null && vaultTime !== null) {
      if (localTime >= vaultTime) {
        return {
          resolution: 'USE_LOCAL',
          reason: 'Local record is newer or equal by last_modified.',
        };
      }

      return {
        resolution: 'USE_VAULT',
        reason: 'Vault record is newer by last_modified.',
      };
    }

    return {
      resolution: 'KEEP_SYNCED',
      reason: 'No conflict indicators were found.',
    };
  },
};
