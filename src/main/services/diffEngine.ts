import type { RegistrySyncSnapshot } from './dataFilterService';

export interface VaultDiffResult {
  requiresMirrorRebuild: boolean;
  missingFromVaultPaths: string[];
}

const toPathSet = (snapshot: RegistrySyncSnapshot | null): Set<string> => {
  return new Set((snapshot?.files ?? []).map((file) => file.path));
};

export const diffEngine = {
  compareVaultToLocal(
    localSnapshot: RegistrySyncSnapshot | null,
    remoteSnapshot: RegistrySyncSnapshot | null,
  ): VaultDiffResult {
    if (!localSnapshot || !remoteSnapshot) {
      return {
        requiresMirrorRebuild: false,
        missingFromVaultPaths: [],
      };
    }

    const localPaths = toPathSet(localSnapshot);
    const remotePaths = toPathSet(remoteSnapshot);
    const missingFromVaultPaths = [...localPaths].filter((path) => !remotePaths.has(path)).sort((a, b) => a.localeCompare(b));

    return {
      requiresMirrorRebuild: missingFromVaultPaths.length > 0,
      missingFromVaultPaths,
    };
  },

  detectRemoteSourceDeletion(localSnapshot: RegistrySyncSnapshot | null): boolean {
    return Boolean(localSnapshot && localSnapshot.files.length > 0);
  },
};
