import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { hostname, userInfo } from 'node:os';
import { join } from 'node:path';
import { dataFilterService, RegistrySyncSnapshot } from './dataFilterService';
import { registryRuntimeStoreService } from './registryRuntimeStoreService';
import { syncStoreService } from './syncStoreService';
import { vaultService } from './vaultService';
import { recoveryOrchestratorService } from './recoveryOrchestratorService';
import { getRuntimeBootstrapConfig } from './runtimeConfigService';
import { getAppDataRoot } from './governanceRepoService';
import { diffEngine } from './diffEngine';
import { auditLogService, AUDIT_ACTIONS } from './auditLogService';
import { runtimeDocumentStoreService } from './runtimeDocumentStoreService';

const REGISTRY_SYNC_RELATIVE_PATH = join('data', 'registry-sync', 'registry-sync.snapshot.json');
const MACHINE_LOCK_RELATIVE_PATH = join('data', 'registry-sync', 'active-client-lock.json');
const MACHINE_LOCK_TTL_MS = 10 * 60 * 1000;

export const SYNC_PUSH_CRON_JOB_ID = 'job-registry-sync-push';
export const SYNC_PULL_CRON_JOB_ID = 'job-registry-sync-pull';

interface ActiveClientLock {
  machineId: string;
  hostName: string;
  userName: string;
  startedAt: string;
  lastSeenAt: string;
}

export interface SplashSyncResult {
  installMode: 'FIRST_INSTALL' | 'RETURNING_INSTALL';
  pulled: boolean;
  merged: boolean;
  pullStatus: 'SUCCESS' | 'SKIPPED' | 'FAILED';
  mergeStatus: 'MERGED' | 'REBUILT_FROM_VAULT_MIRROR' | 'PURGED_FROM_REMOTE_DELETE' | 'SKIPPED_LOCAL_NEWER_OR_EQUAL' | 'SKIPPED_NO_REMOTE' | 'BLOCKED_INTEGRITY' | 'FAILED';
  integrityStatus: 'VALID' | 'INVALID' | 'NOT_PRESENT' | 'UNKNOWN';
  skippedReason?: string;
  machineLockWarning?: string;
}

export interface SyncStatusSnapshot {
  initialized: boolean;
  pushTimerActive: boolean;
  pushIntervalMs: number;
  machineLockWarning: string | null;
  lastPull: {
    at: string | null;
    status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | null;
    message: string | null;
  };
  lastPush: {
    at: string | null;
    status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | null;
    message: string | null;
  };
  lastIntegrityCheck: {
    at: string | null;
    valid: boolean | null;
    issues: string[];
  };
  startupSync: {
    installMode: 'FIRST_INSTALL' | 'RETURNING_INSTALL' | null;
    pullStatus: SplashSyncResult['pullStatus'] | null;
    mergeStatus: SplashSyncResult['mergeStatus'] | null;
    integrityStatus: SplashSyncResult['integrityStatus'] | null;
    message: string | null;
  };
  queue: {
    pendingOrFailed: number;
    running: number;
    completed: number;
  };
}

let initialized = false;
let intervalHandle: NodeJS.Timeout | null = null;
let lastMachineLockWarning: string | null = null;
let pushIntervalMs = 120_000;
let lastPullAt: string | null = null;
let lastPullStatus: 'SUCCESS' | 'SKIPPED' | 'FAILED' | null = null;
let lastPullMessage: string | null = null;
let lastPushAt: string | null = null;
let lastPushStatus: 'SUCCESS' | 'SKIPPED' | 'FAILED' | null = null;
let lastPushMessage: string | null = null;
let lastIntegrityAt: string | null = null;
let lastIntegrityValid: boolean | null = null;
let lastIntegrityIssues: string[] = [];
let lastStartupInstallMode: SplashSyncResult['installMode'] | null = null;
let lastStartupPullStatus: SplashSyncResult['pullStatus'] | null = null;
let lastStartupMergeStatus: SplashSyncResult['mergeStatus'] | null = null;
let lastStartupIntegrityStatus: SplashSyncResult['integrityStatus'] | null = null;
let lastStartupSyncMessage: string | null = null;

const nowIso = (): string => new Date().toISOString();

const getMachineId = (): string => {
  const host = hostname();
  const user = userInfo().username;
  return createHash('sha256').update(`${host}:${user}`).digest('hex');
};

const getSnapshotPath = (): string => join(vaultService.getWorkingRootPath(), REGISTRY_SYNC_RELATIVE_PATH);
const getMachineLockPath = (): string => join(vaultService.getWorkingRootPath(), MACHINE_LOCK_RELATIVE_PATH);

const loadPushIntervalFromSettings = async (): Promise<number | null> => {
  const settingsPath = join(getAppDataRoot(), 'settings.json');
  if (!existsSync(settingsPath)) {
    return null;
  }

  try {
    const raw = await readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw) as { syncPushIntervalMs?: unknown };
    if (typeof parsed.syncPushIntervalMs === 'number' && Number.isFinite(parsed.syncPushIntervalMs)) {
      return Math.max(30_000, Math.trunc(parsed.syncPushIntervalMs));
    }
    return null;
  } catch {
    return null;
  }
};

const ensureSyncDirectory = async (): Promise<void> => {
  await mkdir(join(vaultService.getWorkingRootPath(), 'data', 'registry-sync'), { recursive: true });
};

const parseSnapshot = (raw: string): RegistrySyncSnapshot | null => {
  try {
    const parsed = JSON.parse(raw) as RegistrySyncSnapshot;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (typeof parsed.generatedAt !== 'string' || !parsed.runtime || !Array.isArray(parsed.files)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const parseLock = (raw: string): ActiveClientLock | null => {
  try {
    const parsed = JSON.parse(raw) as ActiveClientLock;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (!parsed.machineId || !parsed.lastSeenAt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const updateActiveMachineLock = async (): Promise<string | undefined> => {
  await ensureSyncDirectory();
  const lockPath = getMachineLockPath();

  const localMachineId = getMachineId();
  const lockExists = existsSync(lockPath);

  if (lockExists) {
    const raw = await readFile(lockPath, 'utf8');
    const existingLock = parseLock(raw);

    if (existingLock && existingLock.machineId !== localMachineId) {
      const ageMs = Date.now() - Date.parse(existingLock.lastSeenAt);
      if (!Number.isNaN(ageMs) && ageMs <= MACHINE_LOCK_TTL_MS) {
        return `Another active client was detected on ${existingLock.hostName} (${existingLock.userName}).`;
      }
    }
  }

  const nextLock: ActiveClientLock = {
    machineId: localMachineId,
    hostName: hostname(),
    userName: userInfo().username,
    startedAt: nowIso(),
    lastSeenAt: nowIso(),
  };

  await writeFile(lockPath, JSON.stringify(nextLock, null, 2), 'utf8');
  return undefined;
};

const writeRemoteSnapshot = async (snapshot: RegistrySyncSnapshot): Promise<void> => {
  await ensureSyncDirectory();
  await writeFile(getSnapshotPath(), JSON.stringify(snapshot, null, 2), 'utf8');
};

const applyRemoteSnapshotIfNewer = async (
  installMode: SplashSyncResult['installMode'],
): Promise<SplashSyncResult> => {
  lastPullAt = nowIso();
  const snapshotPath = getSnapshotPath();
  if (!existsSync(snapshotPath)) {
    const local = await syncStoreService.getDecryptedRegistrySnapshot();
    if (diffEngine.detectRemoteSourceDeletion(local?.snapshot ?? null)) {
      await registryRuntimeStoreService.clearApprovedRuntimeState();
      await syncStoreService.clearEncryptedRegistrySnapshot();
      lastPullStatus = 'SUCCESS';
      lastPullMessage = 'Vault snapshot was removed remotely. Local SQLite mirror was purged to match Vault.';
      await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_REMOTE_MIRROR_APPLIED, {
        workOrderId: 'sync-provider',
        mode: installMode,
        action: 'purge_from_remote_delete',
      });
      return {
        installMode,
        pulled: true,
        merged: true,
        pullStatus: 'SUCCESS',
        mergeStatus: 'PURGED_FROM_REMOTE_DELETE',
        integrityStatus: 'NOT_PRESENT',
        skippedReason: 'Vault snapshot was removed remotely. Local SQLite mirror was purged to match Vault.',
      };
    }

    lastPullStatus = 'SKIPPED';
    lastPullMessage = 'No remote registry snapshot found in vault.';
    return {
      installMode,
      pulled: false,
      merged: false,
      pullStatus: 'SKIPPED',
      mergeStatus: 'SKIPPED_NO_REMOTE',
      integrityStatus: 'NOT_PRESENT',
      skippedReason: 'No remote registry snapshot found in vault.',
    };
  }

  const raw = await readFile(snapshotPath, 'utf8');
  const snapshot = parseSnapshot(raw);
  if (!snapshot) {
    lastPullStatus = 'FAILED';
    lastPullMessage = 'Remote registry snapshot is not valid JSON.';
    return {
      installMode,
      pulled: true,
      merged: false,
      pullStatus: 'FAILED',
      mergeStatus: 'FAILED',
      integrityStatus: 'UNKNOWN',
      skippedReason: 'Remote registry snapshot is not valid JSON.',
    };
  }

  const integrity = dataFilterService.validateSnapshotIntegrity(snapshot);
  lastIntegrityAt = nowIso();
  lastIntegrityValid = integrity.valid;
  lastIntegrityIssues = [...integrity.issues];

  if (!integrity.valid) {
    lastPullStatus = 'FAILED';
    lastPullMessage = `Integrity check failed: ${integrity.issues.join('; ')}`;
    return {
      installMode,
      pulled: true,
      merged: false,
      pullStatus: 'FAILED',
      mergeStatus: 'BLOCKED_INTEGRITY',
      integrityStatus: 'INVALID',
      skippedReason: `Integrity check failed: ${integrity.issues.join('; ')}`,
    };
  }

  const local = await syncStoreService.getDecryptedRegistrySnapshot();
  const localVersion = local?.sourceVersion ?? '';
  const remoteVersion = Date.parse(snapshot.generatedAt);
  const parsedLocalVersion = Date.parse(localVersion);
  const mirrorDiff = diffEngine.compareVaultToLocal(local?.snapshot ?? null, snapshot);

  if (mirrorDiff.requiresMirrorRebuild) {
    await registryRuntimeStoreService.importApprovedRuntimeFromSync({
      committedAt: snapshot.runtime.committedAt,
      contextByStep: snapshot.runtime.contextByStep,
      approvalByStep: snapshot.runtime.approvalByStep,
      agentMappings: snapshot.runtime.agentMappings,
    });
    await syncStoreService.saveEncryptedRegistrySnapshot(snapshot, snapshot.generatedAt);
    lastPullStatus = 'SUCCESS';
    lastPullMessage = `Vault mirror rebuild applied. Missing from Vault: ${mirrorDiff.missingFromVaultPaths.join(', ')}`;
    await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_REMOTE_MIRROR_APPLIED, {
      workOrderId: 'sync-provider',
      mode: installMode,
      action: 'rebuild_from_vault_mirror',
      missingCount: mirrorDiff.missingFromVaultPaths.length,
    });
    return {
      installMode,
      pulled: true,
      merged: true,
      pullStatus: 'SUCCESS',
      mergeStatus: 'REBUILT_FROM_VAULT_MIRROR',
      integrityStatus: 'VALID',
      skippedReason: `Vault mirror rebuild applied. Missing from Vault: ${mirrorDiff.missingFromVaultPaths.join(', ')}`,
    };
  }

  if (localVersion && !Number.isNaN(parsedLocalVersion) && !Number.isNaN(remoteVersion) && parsedLocalVersion >= remoteVersion) {
    lastPullStatus = 'SKIPPED';
    lastPullMessage = 'Local registry state is already newer or equal.';
    return {
      installMode,
      pulled: true,
      merged: false,
      pullStatus: 'SKIPPED',
      mergeStatus: 'SKIPPED_LOCAL_NEWER_OR_EQUAL',
      integrityStatus: 'VALID',
      skippedReason: 'Local registry state is already newer or equal.',
    };
  }

  await registryRuntimeStoreService.importApprovedRuntimeFromSync({
    committedAt: snapshot.runtime.committedAt,
    contextByStep: snapshot.runtime.contextByStep,
    approvalByStep: snapshot.runtime.approvalByStep,
    agentMappings: snapshot.runtime.agentMappings,
  });

  await syncStoreService.saveEncryptedRegistrySnapshot(snapshot, snapshot.generatedAt);

  lastPullStatus = 'SUCCESS';
  lastPullMessage = 'Remote vault snapshot merged into local registry runtime store.';

  return {
    installMode,
    pulled: true,
    merged: true,
    pullStatus: 'SUCCESS',
    mergeStatus: 'MERGED',
    integrityStatus: 'VALID',
  };
};

const recordStartupSyncResult = (result: SplashSyncResult): SplashSyncResult => {
  lastStartupInstallMode = result.installMode;
  lastStartupPullStatus = result.pullStatus;
  lastStartupMergeStatus = result.mergeStatus;
  lastStartupIntegrityStatus = result.integrityStatus;
  lastStartupSyncMessage = result.skippedReason ?? lastPullMessage;
  return result;
};

const stageCurrentRegistryStateForSync = async (reason: string): Promise<void> => {
  const runtimeState = await registryRuntimeStoreService.getApprovedRuntimeState();
  if (!runtimeState) {
    return;
  }

  const generatedAt = nowIso();
  const snapshot = await dataFilterService.buildRegistrySyncSnapshot({
    generatedAt,
    runtimeState: {
      committedAt: runtimeState.committedAt,
      contextByStep: runtimeState.contextByStep,
      approvalByStep: runtimeState.approvalByStep,
      agentMappings: runtimeState.agentMappings,
      modelAccess: null,
      channelDetails: runtimeState.channelDetails,
    },
  });

  await syncStoreService.saveEncryptedRegistrySnapshot(snapshot, generatedAt);
  await syncStoreService.enqueuePushTask(reason, { generatedAt });
};

const pushLatestApprovedSnapshot = async (): Promise<void> => {
  lastPushAt = nowIso();
  const task = await syncStoreService.claimNextPendingTask();
  if (!task) {
    lastPushStatus = 'SKIPPED';
    lastPushMessage = 'No pending approved registry sync task found.';
    return;
  }

  try {
    await vaultService.initializeVault();
    const state = await syncStoreService.getDecryptedRegistrySnapshot();
    if (!state) {
      throw new Error('No encrypted registry sync state available for push.');
    }

    await writeRemoteSnapshot(state.snapshot);
    await vaultService.publishVaultChanges({
      commitMessage: `sync: approved registry push ${state.sourceVersion}`,
      approvedByUser: true,
    });

    await syncStoreService.markTaskCompleted(task.taskId);
    lastPushStatus = 'SUCCESS';
    lastPushMessage = `Pushed approved registry snapshot to vault for task ${task.taskId}.`;
  } catch (error) {
    await syncStoreService.markTaskFailed(
      task.taskId,
      error instanceof Error ? error.message : 'Unknown sync push error',
    );
    lastPushStatus = 'FAILED';
    lastPushMessage = error instanceof Error ? error.message : 'Unknown sync push error';
  } finally {
    await vaultService.cleanupTemporaryWorkspace(true);
  }
};

const pullLatestFromRemoteVaultAndMerge = async (
  installMode: SplashSyncResult['installMode'],
): Promise<SplashSyncResult> => {
  try {
    await vaultService.initializeVault();
    const syncResult = await vaultService.syncFromRemoteVault();
    if (!syncResult.success) {
      lastPullAt = nowIso();
      lastPullStatus = 'FAILED';
      lastPullMessage = syncResult.message;
      return {
        installMode,
        pulled: false,
        merged: false,
        pullStatus: 'FAILED',
        mergeStatus: 'FAILED',
        integrityStatus: 'UNKNOWN',
        skippedReason: syncResult.message,
      };
    }

    await runtimeDocumentStoreService.seedFromVaultWorkspace(vaultService.getWorkingRootPath());
    return applyRemoteSnapshotIfNewer(installMode);
  } finally {
    await vaultService.cleanupTemporaryWorkspace(true);
  }
};

const startPushTimer = (): void => {
  if (intervalHandle) {
    return;
  }

  intervalHandle = setInterval(() => {
    void pushLatestApprovedSnapshot();
  }, pushIntervalMs);
};

const stopPushTimer = (): void => {
  if (!intervalHandle) {
    return;
  }

  clearInterval(intervalHandle);
  intervalHandle = null;
};

export const syncProviderService = {
  async initializeOnSplash(options?: { installMode?: SplashSyncResult['installMode'] }): Promise<SplashSyncResult> {
    const installMode = options?.installMode ?? 'RETURNING_INSTALL';
    if (initialized) {
      return recordStartupSyncResult(await pullLatestFromRemoteVaultAndMerge(installMode));
    }

    await recoveryOrchestratorService.recoverPendingSyncTasks();
    pushIntervalMs = Math.max(30_000, getRuntimeBootstrapConfig().sync.pushIntervalMs);
    const persistedPushInterval = await loadPushIntervalFromSettings();
    if (persistedPushInterval) {
      pushIntervalMs = persistedPushInterval;
    }

    const machineLockWarning = await updateActiveMachineLock();
    lastMachineLockWarning = machineLockWarning ?? null;
    const pullResult = await pullLatestFromRemoteVaultAndMerge(installMode);

    initialized = true;

    return recordStartupSyncResult({
      ...pullResult,
      machineLockWarning,
    });
  },

  async stageApprovedRegistryForSync(reason: string): Promise<void> {
    await stageCurrentRegistryStateForSync(reason);
  },

  async triggerBackgroundPush(): Promise<void> {
    await pushLatestApprovedSnapshot();
  },

  async triggerBackgroundPull(): Promise<{ pulled: boolean; merged: boolean; skippedReason?: string }> {
    return pullLatestFromRemoteVaultAndMerge('RETURNING_INSTALL');
  },

  async syncOnClose(): Promise<void> {
    const warning = await updateActiveMachineLock();
    lastMachineLockWarning = warning ?? null;
    await pushLatestApprovedSnapshot();
  },

  getLastMachineLockWarning(): string | null {
    return lastMachineLockWarning;
  },

  updatePushInterval(intervalMs: number): void {
    const normalized = Math.max(30_000, intervalMs);
    if (pushIntervalMs === normalized) {
      return;
    }

    pushIntervalMs = normalized;
    if (intervalHandle) {
      stopPushTimer();
      startPushTimer();
    }
  },

  async getStatus(): Promise<SyncStatusSnapshot> {
    const tasks = await syncStoreService.listQueueTasks(200);
    return {
      initialized,
      pushTimerActive: intervalHandle !== null,
      pushIntervalMs,
      machineLockWarning: lastMachineLockWarning,
      lastPull: {
        at: lastPullAt,
        status: lastPullStatus,
        message: lastPullMessage,
      },
      lastPush: {
        at: lastPushAt,
        status: lastPushStatus,
        message: lastPushMessage,
      },
      lastIntegrityCheck: {
        at: lastIntegrityAt,
        valid: lastIntegrityValid,
        issues: [...lastIntegrityIssues],
      },
      startupSync: {
        installMode: lastStartupInstallMode,
        pullStatus: lastStartupPullStatus,
        mergeStatus: lastStartupMergeStatus,
        integrityStatus: lastStartupIntegrityStatus,
        message: lastStartupSyncMessage,
      },
      queue: {
        pendingOrFailed: tasks.filter((task) => task.status === 'PENDING' || task.status === 'FAILED').length,
        running: tasks.filter((task) => task.status === 'RUNNING').length,
        completed: tasks.filter((task) => task.status === 'COMPLETED').length,
      },
    };
  },

  async dispose(): Promise<void> {
    stopPushTimer();
    initialized = false;
  },
};
