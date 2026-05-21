import { beforeEach, describe, expect, it, vi } from 'vitest';

const initializeVaultMock = vi.fn();
const syncFromRemoteVaultMock = vi.fn();
const getWorkingRootPathMock = vi.fn();
const recoverPendingSyncTasksMock = vi.fn();
const getDecryptedRegistrySnapshotMock = vi.fn();
const saveEncryptedRegistrySnapshotMock = vi.fn();
const enqueuePushTaskMock = vi.fn();
const listQueueTasksMock = vi.fn();
const importApprovedRuntimeFromSyncMock = vi.fn();
const getApprovedRuntimeStateMock = vi.fn();
const validateSnapshotIntegrityMock = vi.fn();

vi.mock('./vaultService', () => ({
  vaultService: {
    initializeVault: initializeVaultMock,
    syncFromRemoteVault: syncFromRemoteVaultMock,
    getWorkingRootPath: getWorkingRootPathMock,
  },
}));

vi.mock('./recoveryOrchestratorService', () => ({
  recoveryOrchestratorService: {
    recoverPendingSyncTasks: recoverPendingSyncTasksMock,
  },
}));

vi.mock('./syncStoreService', () => ({
  syncStoreService: {
    getDecryptedRegistrySnapshot: getDecryptedRegistrySnapshotMock,
    saveEncryptedRegistrySnapshot: saveEncryptedRegistrySnapshotMock,
    enqueuePushTask: enqueuePushTaskMock,
    listQueueTasks: listQueueTasksMock,
    claimNextPendingTask: vi.fn(),
    markTaskCompleted: vi.fn(),
    markTaskFailed: vi.fn(),
  },
}));

vi.mock('./registryRuntimeStoreService', () => ({
  registryRuntimeStoreService: {
    importApprovedRuntimeFromSync: importApprovedRuntimeFromSyncMock,
    getApprovedRuntimeState: getApprovedRuntimeStateMock,
  },
}));

vi.mock('./dataFilterService', () => ({
  dataFilterService: {
    validateSnapshotIntegrity: validateSnapshotIntegrityMock,
    buildRegistrySyncSnapshot: vi.fn(),
  },
}));

vi.mock('./runtimeConfigService', () => ({
  getRuntimeBootstrapConfig: () => ({
    sync: {
      pushIntervalMs: 120_000,
    },
  }),
}));

describe('syncProviderService startup merge decisions', () => {
  beforeEach(() => {
    vi.resetModules();
    initializeVaultMock.mockReset();
    syncFromRemoteVaultMock.mockReset();
    getWorkingRootPathMock.mockReset();
    recoverPendingSyncTasksMock.mockReset();
    getDecryptedRegistrySnapshotMock.mockReset();
    saveEncryptedRegistrySnapshotMock.mockReset();
    enqueuePushTaskMock.mockReset();
    listQueueTasksMock.mockReset();
    importApprovedRuntimeFromSyncMock.mockReset();
    getApprovedRuntimeStateMock.mockReset();
    validateSnapshotIntegrityMock.mockReset();

    initializeVaultMock.mockResolvedValue(undefined);
    syncFromRemoteVaultMock.mockResolvedValue({ success: true, message: 'ok' });
    recoverPendingSyncTasksMock.mockResolvedValue({ recoveredTasks: 0 });
    listQueueTasksMock.mockResolvedValue([]);
    getDecryptedRegistrySnapshotMock.mockResolvedValue(null);
    getApprovedRuntimeStateMock.mockResolvedValue(null);
    validateSnapshotIntegrityMock.mockReturnValue({ valid: true, issues: [] });
    getWorkingRootPathMock.mockReturnValue('E:\\Python\\prana\\.prana\\vault-temp\\working');
  });

  it('merges a valid remote snapshot on first install', async () => {
    const { syncProviderService } = await import('./syncProviderService');
    const { writeFile, mkdir, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const workingRoot = getWorkingRootPathMock();
    await rm(workingRoot, { recursive: true, force: true });
    await mkdir(join(workingRoot, 'data', 'registry-sync'), { recursive: true });
    await writeFile(
      join(workingRoot, 'data', 'registry-sync', 'registry-sync.snapshot.json'),
      JSON.stringify({
        generatedAt: '2026-03-29T00:00:00.000Z',
        runtime: {
          committedAt: '2026-03-29T00:00:00.000Z',
          contextByStep: {},
          approvalByStep: {},
          agentMappings: {},
        },
        files: [],
        integrity: {
          manifestChecksumSha256: '',
          fileChecksums: {},
        },
      }),
      'utf8',
    );

    const result = await syncProviderService.initializeOnSplash({ installMode: 'FIRST_INSTALL' });

    expect(result.installMode).toBe('FIRST_INSTALL');
    expect(result.pullStatus).toBe('SUCCESS');
    expect(result.mergeStatus).toBe('MERGED');
    expect(importApprovedRuntimeFromSyncMock).toHaveBeenCalledTimes(1);
    expect(saveEncryptedRegistrySnapshotMock).toHaveBeenCalledTimes(1);
  });

  it('skips merge when local snapshot version is newer or equal', async () => {
    const { syncProviderService } = await import('./syncProviderService');
    const { writeFile, mkdir, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const workingRoot = getWorkingRootPathMock();
    await rm(workingRoot, { recursive: true, force: true });
    await mkdir(join(workingRoot, 'data', 'registry-sync'), { recursive: true });
    await writeFile(
      join(workingRoot, 'data', 'registry-sync', 'registry-sync.snapshot.json'),
      JSON.stringify({
        generatedAt: '2026-03-29T00:00:00.000Z',
        runtime: {
          committedAt: '2026-03-29T00:00:00.000Z',
          contextByStep: {},
          approvalByStep: {},
          agentMappings: {},
        },
        files: [],
        integrity: {
          manifestChecksumSha256: '',
          fileChecksums: {},
        },
      }),
      'utf8',
    );
    getDecryptedRegistrySnapshotMock.mockResolvedValue({
      sourceVersion: '2026-03-29T00:00:00.000Z',
      snapshot: {},
    });

    const result = await syncProviderService.initializeOnSplash({ installMode: 'RETURNING_INSTALL' });

    expect(result.pullStatus).toBe('SKIPPED');
    expect(result.mergeStatus).toBe('SKIPPED_LOCAL_NEWER_OR_EQUAL');
    expect(importApprovedRuntimeFromSyncMock).not.toHaveBeenCalled();
  });

  it('blocks merge when remote snapshot integrity fails', async () => {
    const { syncProviderService } = await import('./syncProviderService');
    const { writeFile, mkdir, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const workingRoot = getWorkingRootPathMock();
    await rm(workingRoot, { recursive: true, force: true });
    await mkdir(join(workingRoot, 'data', 'registry-sync'), { recursive: true });
    await writeFile(
      join(workingRoot, 'data', 'registry-sync', 'registry-sync.snapshot.json'),
      JSON.stringify({
        generatedAt: '2026-03-29T00:00:00.000Z',
        runtime: {
          committedAt: '2026-03-29T00:00:00.000Z',
          contextByStep: {},
          approvalByStep: {},
          agentMappings: {},
        },
        files: [],
        integrity: {
          manifestChecksumSha256: '',
          fileChecksums: {},
        },
      }),
      'utf8',
    );
    validateSnapshotIntegrityMock.mockReturnValue({
      valid: false,
      issues: ['Manifest checksum mismatch'],
    });

    const result = await syncProviderService.initializeOnSplash({ installMode: 'RETURNING_INSTALL' });

    expect(result.pullStatus).toBe('FAILED');
    expect(result.mergeStatus).toBe('BLOCKED_INTEGRITY');
    expect(result.integrityStatus).toBe('INVALID');
    expect(importApprovedRuntimeFromSyncMock).not.toHaveBeenCalled();
  });
});
