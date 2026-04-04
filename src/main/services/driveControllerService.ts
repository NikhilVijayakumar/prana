import { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { getPranaPlatformRuntime } from './pranaPlatformRuntime';
import { sqliteConfigStoreService } from './sqliteConfigStoreService';
import { getGovernanceRepoPath, setAppDataRootOverride } from './governanceRepoService';
import { mountRegistryService, VirtualDriveId, VirtualDriveRecord } from './mountRegistryService';
import { hookSystemService } from './hookSystemService';
import { getVirtualDriveProvider } from './virtualDriveProvider';

export interface VirtualDriveMountResult {
  success: boolean;
  driveId: VirtualDriveId;
  mountPoint: string;
  sourcePath: string;
  usedFallbackPath: boolean;
  message: string;
  providerId: string;
}

export interface VirtualDriveHealthCheck {
  checkId: string;
  driveId: VirtualDriveId;
  status: 'Healthy' | 'Degraded' | 'Blocked';
  severity: 'low' | 'medium' | 'high';
  message: string;
  posture: VirtualDriveRecord['posture'];
}

export interface VirtualDriveDiagnosticsSnapshot {
  overallStatus: 'Healthy' | 'Degraded' | 'Blocked';
  failClosed: boolean;
  records: VirtualDriveRecord[];
  checks: VirtualDriveHealthCheck[];
}

interface NormalizedDriveSettings {
  mountPoint: string;
  sourcePath: string;
  remoteName: string;
  cryptPassword: string;
  fallbackPath: string;
  allowFallback: boolean;
  requireSessionMount: boolean;
}

interface NormalizedVirtualDriveConfig {
  enabled: boolean;
  failClosed: boolean;
  providerId: string;
  obscuredFileNames: boolean;
  rcloneBinaryPath: string | null;
  drives: Record<VirtualDriveId, NormalizedDriveSettings>;
}

interface VaultSessionHandle {
  release(): Promise<void>;
}

const SYSTEM_DRIVE_DEFAULT = 'S:';
const VAULT_DRIVE_DEFAULT = 'V:';

const childByDrive = new Map<VirtualDriveId, ChildProcess>();
const inflightMounts = new Map<VirtualDriveId, Promise<VirtualDriveMountResult>>();
const sessionDepthByDrive = new Map<VirtualDriveId, number>();

const nowIso = (): string => new Date().toISOString();
const isWindows = (): boolean => process.platform === 'win32';
const getRuntimeVirtualDriveConfig = () => sqliteConfigStoreService.readSnapshotSync()?.config?.virtualDrives;

const normalizeDriveMountPoint = (driveLetter: string): string => {
  const normalized = driveLetter.trim().replace(/\\+$/g, '');
  if (!normalized) {
    return driveLetter;
  }

  if (isWindows()) {
    return normalized.endsWith(':') ? normalized : `${normalized}:`;
  }

  return normalized;
};

const resolveDriveSourcePath = (subPath: string): string => resolve(getGovernanceRepoPath(), subPath);

const resolveUnixMountPoint = (mountPoint: string, driveId: VirtualDriveId): string => {
  if (isWindows()) {
    return mountPoint;
  }

  if (isAbsolute(mountPoint)) {
    return mountPoint;
  }

  return resolve(getGovernanceRepoPath(), '.mounts', driveId);
};

const getNormalizedVirtualDriveConfig = (): NormalizedVirtualDriveConfig => {
  const runtimeConfig = getRuntimeVirtualDriveConfig() as Record<string, any> | undefined;
  const systemConfig = (runtimeConfig?.system ?? {}) as Record<string, any>;
  const vaultConfig = (runtimeConfig?.vault ?? {}) as Record<string, any>;
  const vaultArchivePassword = sqliteConfigStoreService.readSnapshotSync()?.config?.vault?.archivePassword?.trim() ?? '';

  const systemMountPoint = normalizeDriveMountPoint(
    systemConfig.mountPoint
      ?? runtimeConfig?.systemDriveLetter
      ?? SYSTEM_DRIVE_DEFAULT,
  );
  const vaultMountPoint = normalizeDriveMountPoint(
    vaultConfig.mountPoint
      ?? runtimeConfig?.vaultDriveLetter
      ?? VAULT_DRIVE_DEFAULT,
  );

  return {
    enabled: runtimeConfig?.enabled !== false,
    failClosed: runtimeConfig?.failClosed === true,
    providerId: String(runtimeConfig?.provider?.type ?? 'rclone'),
    obscuredFileNames: runtimeConfig?.obscuredFileNames !== false,
    rcloneBinaryPath: typeof runtimeConfig?.provider?.rcloneBinaryPath === 'string'
      ? runtimeConfig.provider.rcloneBinaryPath
      : typeof runtimeConfig?.rcloneBinaryPath === 'string'
        ? runtimeConfig.rcloneBinaryPath
        : null,
    drives: {
      system: {
        mountPoint: resolveUnixMountPoint(systemMountPoint, 'system'),
        sourcePath: resolveDriveSourcePath(systemConfig.sourceSubpath ?? 'db'),
        remoteName: String(systemConfig.remoteName ?? 'SYSTEM_DRIVE'),
        cryptPassword: String(
          systemConfig.cryptPassword
          ?? runtimeConfig?.systemCryptPassword
          ?? vaultArchivePassword,
        ).trim(),
        fallbackPath: resolve(
          resolveDriveSourcePath(systemConfig.sourceSubpath ?? 'db'),
          systemConfig.fallbackSubpath ?? 'live',
        ),
        allowFallback: systemConfig.allowFallback !== false,
        requireSessionMount: false,
      },
      vault: {
        mountPoint: resolveUnixMountPoint(vaultMountPoint, 'vault'),
        sourcePath: resolveDriveSourcePath(vaultConfig.sourceSubpath ?? 'vault'),
        remoteName: String(vaultConfig.remoteName ?? 'VAULT_DRIVE'),
        cryptPassword: String(vaultConfig.cryptPassword ?? vaultArchivePassword).trim(),
        fallbackPath: resolveDriveSourcePath(vaultConfig.sourceSubpath ?? 'vault'),
        allowFallback: false,
        requireSessionMount: vaultConfig.requireSessionMount !== false,
      },
    },
  };
};

const buildRecord = (input: {
  driveId: VirtualDriveId;
  stage: VirtualDriveRecord['stage'];
  posture: VirtualDriveRecord['posture'];
  providerId: string;
  mountPoint: string;
  sourcePath: string;
  resolvedPath: string;
  usedFallbackPath: boolean;
  pid?: number | null;
  mountedAt?: string | null;
  unmountedAt?: string | null;
  activeSessionCount?: number;
  retryCount?: number;
  lastError?: string | null;
  lastStderr?: string | null;
}): VirtualDriveRecord => ({
  id: input.driveId,
  stage: input.stage,
  posture: input.posture,
  providerId: input.providerId,
  mountPoint: input.mountPoint,
  sourcePath: input.sourcePath,
  resolvedPath: input.resolvedPath,
  usedFallbackPath: input.usedFallbackPath,
  pid: input.pid ?? null,
  mountedAt: input.mountedAt ?? (input.stage === 'MOUNTED' ? nowIso() : null),
  unmountedAt: input.unmountedAt ?? null,
  activeSessionCount: input.activeSessionCount ?? sessionDepthByDrive.get(input.driveId) ?? 0,
  retryCount: input.retryCount ?? 0,
  lastError: input.lastError ?? null,
  lastStderr: input.lastStderr ?? null,
});

const updateRegistry = (record: VirtualDriveRecord): VirtualDriveRecord => {
  return mountRegistryService.upsert(record);
};

const getDriveRecord = (driveId: VirtualDriveId): VirtualDriveRecord | null => mountRegistryService.get(driveId);

const emitDriveStatus = async (driveId: VirtualDriveId, status: 'healthy' | 'degraded', reason: string): Promise<void> => {
  await hookSystemService.emit('system.status', { component: `drive:${driveId}`, status, reason });
};

const createMountResult = (
  driveId: VirtualDriveId,
  config: NormalizedVirtualDriveConfig,
  record: VirtualDriveRecord,
  message: string,
): VirtualDriveMountResult => ({
  success: record.stage === 'MOUNTED' || (driveId === 'system' && record.usedFallbackPath),
  driveId,
  mountPoint: record.mountPoint,
  sourcePath: record.sourcePath,
  usedFallbackPath: record.usedFallbackPath,
  message,
  providerId: config.providerId,
});

const updateSystemDataRoot = async (record: VirtualDriveRecord | null, config: NormalizedVirtualDriveConfig): Promise<void> => {
  if (!record) {
    setAppDataRootOverride(config.drives.system.fallbackPath);
    return;
  }

  if (record.stage === 'MOUNTED') {
    const mountedRoot = isWindows() ? record.mountPoint : join(record.mountPoint, 'live');
    setAppDataRootOverride(mountedRoot);
    if (!isWindows()) {
      await mkdir(mountedRoot, { recursive: true });
    }
    return;
  }

  if (record.usedFallbackPath) {
    setAppDataRootOverride(config.drives.system.fallbackPath);
    return;
  }

  setAppDataRootOverride(null);
};

const persistDriveFailure = async (
  driveId: VirtualDriveId,
  config: NormalizedVirtualDriveConfig,
  message: string,
  stderr: string | null,
): Promise<VirtualDriveMountResult> => {
  const settings = config.drives[driveId];
  const current = getDriveRecord(driveId);
  const retryCount = (current?.retryCount ?? 0) + 1;
  const allowFallback = driveId === 'system' && settings.allowFallback && !config.failClosed;
  const record = updateRegistry(buildRecord({
    driveId,
    stage: 'FAILED',
    posture: allowFallback ? 'DEGRADED' : 'UNAVAILABLE',
    providerId: config.providerId,
    mountPoint: settings.mountPoint,
    sourcePath: settings.sourcePath,
    resolvedPath: allowFallback ? settings.fallbackPath : settings.mountPoint,
    usedFallbackPath: allowFallback,
    retryCount,
    lastError: message,
    lastStderr: stderr,
  }));

  if (driveId === 'system') {
    await updateSystemDataRoot(record, config);
  }

  await emitDriveStatus(driveId, 'degraded', message);
  return createMountResult(
    driveId,
    config,
    record,
    allowFallback ? `${message} Falling back to configured local system storage.` : message,
  );
};

const mountDriveInternal = async (driveId: VirtualDriveId, explicitPassword?: string): Promise<VirtualDriveMountResult> => {
  const config = getNormalizedVirtualDriveConfig();
  const settings = config.drives[driveId];
  const provider = getVirtualDriveProvider(config.providerId);
  const current = getDriveRecord(driveId);

  if (current?.stage === 'MOUNTED') {
    return createMountResult(driveId, config, current, `${driveId} drive already mounted.`);
  }

  if (!config.enabled) {
    const record = updateRegistry(buildRecord({
      driveId,
      stage: 'UNMOUNTED',
      posture: driveId === 'system' ? 'DEGRADED' : 'UNAVAILABLE',
      providerId: config.providerId,
      mountPoint: settings.mountPoint,
      sourcePath: settings.sourcePath,
      resolvedPath: driveId === 'system' ? settings.fallbackPath : settings.mountPoint,
      usedFallbackPath: driveId === 'system',
      unmountedAt: nowIso(),
      lastStderr: 'Virtual drive subsystem disabled by config.',
    }));
    if (driveId === 'system') {
      await updateSystemDataRoot(record, config);
    }
    return createMountResult(
      driveId,
      config,
      record,
      driveId === 'system'
        ? 'Virtual drives disabled. Using fallback system storage path.'
        : 'Virtual drives disabled. Vault drive sessions are unavailable.',
    );
  }

  const password = explicitPassword?.trim() || settings.cryptPassword;
  if (!password) {
    return persistDriveFailure(
      driveId,
      config,
      driveId === 'system'
        ? 'No crypt password configured for the system drive.'
        : 'No crypt password configured for the vault drive.',
      null,
    );
  }

  updateRegistry(buildRecord({
    driveId,
    stage: 'MOUNTING',
    posture: driveId === 'system' ? 'DEGRADED' : 'UNAVAILABLE',
    providerId: config.providerId,
    mountPoint: settings.mountPoint,
    sourcePath: settings.sourcePath,
    resolvedPath: settings.mountPoint,
    usedFallbackPath: false,
    pid: current?.pid ?? null,
    mountedAt: current?.mountedAt ?? null,
    unmountedAt: current?.unmountedAt ?? null,
    retryCount: current?.retryCount ?? 0,
    lastError: null,
    lastStderr: null,
  }));

  const result = await provider.mount({
    driveId,
    sourcePath: settings.sourcePath,
    mountPoint: settings.mountPoint,
    password,
    obscuredFileNames: config.obscuredFileNames,
    runtimeEnv: getPranaPlatformRuntime().inheritedEnv ?? {},
    options: {
      binaryPath: config.rcloneBinaryPath ?? undefined,
      remoteName: settings.remoteName,
    },
  });

  if (!result.success) {
    return persistDriveFailure(driveId, config, result.message, result.stderr ?? null);
  }

  if (result.child) {
    childByDrive.set(driveId, result.child);
    result.child.on('close', (code) => {
      childByDrive.delete(driveId);
      const record = getDriveRecord(driveId);
      if (!record || record.stage === 'UNMOUNTING') {
        return;
      }

      const message = `Mount provider exited unexpectedly with code ${code ?? 'unknown'}.`;
      updateRegistry(buildRecord({
        driveId,
        stage: 'FAILED',
        posture: driveId === 'system' && record.usedFallbackPath ? 'DEGRADED' : 'UNAVAILABLE',
        providerId: config.providerId,
        mountPoint: record.mountPoint,
        sourcePath: record.sourcePath,
        resolvedPath: record.usedFallbackPath ? record.resolvedPath : record.mountPoint,
        usedFallbackPath: record.usedFallbackPath,
        retryCount: record.retryCount + 1,
        activeSessionCount: record.activeSessionCount,
        mountedAt: record.mountedAt,
        unmountedAt: nowIso(),
        lastError: message,
        lastStderr: record.lastStderr,
      }));
      void emitDriveStatus(driveId, 'degraded', message);
    });
  }

  const record = updateRegistry(buildRecord({
    driveId,
    stage: 'MOUNTED',
    posture: 'SECURE',
    providerId: config.providerId,
    mountPoint: result.mountPoint,
    sourcePath: result.sourcePath,
    resolvedPath: result.mountPoint,
    usedFallbackPath: false,
    pid: result.child?.pid ?? null,
    mountedAt: nowIso(),
    retryCount: current?.retryCount ?? 0,
    lastStderr: result.stderr ?? null,
  }));
  if (driveId === 'system') {
    await updateSystemDataRoot(record, config);
  }
  await emitDriveStatus(driveId, 'healthy', result.message);
  return createMountResult(driveId, config, record, result.message);
};

const mountDrive = async (driveId: VirtualDriveId, explicitPassword?: string): Promise<VirtualDriveMountResult> => {
  const existing = inflightMounts.get(driveId);
  if (existing) {
    return existing;
  }

  const promise = mountDriveInternal(driveId, explicitPassword).finally(() => {
    inflightMounts.delete(driveId);
  });
  inflightMounts.set(driveId, promise);
  return promise;
};

const unmountMountedDrive = async (driveId: VirtualDriveId): Promise<void> => {
  const current = getDriveRecord(driveId);
  if (!current || (current.stage !== 'MOUNTED' && current.stage !== 'FAILED' && current.stage !== 'MOUNTING')) {
    return;
  }

  const config = getNormalizedVirtualDriveConfig();
  const provider = getVirtualDriveProvider(current.providerId || config.providerId);
  updateRegistry(buildRecord({
    driveId,
    stage: 'UNMOUNTING',
    posture: current.posture,
    providerId: current.providerId || config.providerId,
    mountPoint: current.mountPoint,
    sourcePath: current.sourcePath,
    resolvedPath: current.resolvedPath,
    usedFallbackPath: current.usedFallbackPath,
    pid: current.pid,
    mountedAt: current.mountedAt,
    retryCount: current.retryCount,
    activeSessionCount: current.activeSessionCount,
    lastStderr: current.lastStderr,
  }));

  await provider.unmount({
    driveId,
    mountPoint: current.mountPoint,
    child: childByDrive.get(driveId),
  });
  childByDrive.delete(driveId);

  const unmountedRecord = updateRegistry(buildRecord({
    driveId,
    stage: 'UNMOUNTED',
    posture: current.usedFallbackPath ? 'DEGRADED' : 'UNAVAILABLE',
    providerId: current.providerId || config.providerId,
    mountPoint: current.mountPoint,
    sourcePath: current.sourcePath,
    resolvedPath: current.usedFallbackPath ? current.resolvedPath : current.mountPoint,
    usedFallbackPath: current.usedFallbackPath,
    mountedAt: current.mountedAt,
    unmountedAt: nowIso(),
    retryCount: current.retryCount,
    activeSessionCount: sessionDepthByDrive.get(driveId) ?? 0,
    lastStderr: current.lastStderr,
  }));
  if (driveId === 'system') {
    await updateSystemDataRoot(unmountedRecord, config);
  }
};

const acquireVaultDriveSession = async (password?: string): Promise<VaultSessionHandle> => {
  const nextDepth = (sessionDepthByDrive.get('vault') ?? 0) + 1;
  sessionDepthByDrive.set('vault', nextDepth);

  const currentRecord = getDriveRecord('vault');
  const needsMount = currentRecord?.stage !== 'MOUNTED';
  if (needsMount) {
    const result = await mountDrive('vault', password);
    if (!result.success) {
      sessionDepthByDrive.set('vault', Math.max(nextDepth - 1, 0));
      throw new Error(result.message);
    }
  } else {
    updateRegistry({ ...currentRecord, activeSessionCount: nextDepth });
  }

  return {
    async release(): Promise<void> {
      const reducedDepth = Math.max((sessionDepthByDrive.get('vault') ?? 1) - 1, 0);
      sessionDepthByDrive.set('vault', reducedDepth);
      const record = getDriveRecord('vault');
      if (record) {
        updateRegistry({ ...record, activeSessionCount: reducedDepth });
      }

      const config = getNormalizedVirtualDriveConfig();
      if (reducedDepth === 0 && config.drives.vault.requireSessionMount) {
        await unmountMountedDrive('vault');
      }
    },
  };
};

const buildHealthChecks = (records: VirtualDriveRecord[], failClosed: boolean): VirtualDriveHealthCheck[] => {
  return records.map((record) => {
    const isBlocked = record.id === 'system'
      ? record.posture === 'UNAVAILABLE' || (failClosed && record.usedFallbackPath)
      : record.stage !== 'MOUNTED' && record.activeSessionCount > 0;
    const isDegraded = !isBlocked && (record.posture === 'DEGRADED' || record.stage === 'FAILED');

    return {
      checkId: `${record.id}_mount`,
      driveId: record.id,
      status: isBlocked ? 'Blocked' : isDegraded ? 'Degraded' : 'Healthy',
      severity: record.id === 'system' ? 'high' : 'medium',
      message: record.lastError
        ?? (record.stage === 'MOUNTED'
          ? `${record.id} drive available via provider ${record.providerId}.`
          : `${record.id} drive is ${record.stage.toLowerCase()}.`),
      posture: record.posture,
    };
  });
};

const computeDiagnostics = (): VirtualDriveDiagnosticsSnapshot => {
  const config = getNormalizedVirtualDriveConfig();
  const records = mountRegistryService.list();
  const checks = buildHealthChecks(records, config.failClosed);
  const overallStatus = checks.some((check) => check.status === 'Blocked')
    ? 'Blocked'
    : checks.some((check) => check.status === 'Degraded')
      ? 'Degraded'
      : 'Healthy';

  return {
    overallStatus,
    failClosed: config.failClosed,
    records,
    checks,
  };
};

export const driveControllerService = {
  async initializeSystemDrive(): Promise<VirtualDriveMountResult> {
    const config = getNormalizedVirtualDriveConfig();
    await mkdir(config.drives.system.fallbackPath, { recursive: true });
    return mountDrive('system');
  },

  async mountVaultDrive(userPassword?: string): Promise<VirtualDriveMountResult> {
    return mountDrive('vault', userPassword);
  },

  async withVaultDriveSession<T>(operation: () => Promise<T>, userPassword?: string): Promise<T> {
    const session = await acquireVaultDriveSession(userPassword);
    try {
      return await operation();
    } finally {
      await session.release();
    }
  },

  async unmountVaultDrive(): Promise<void> {
    if ((sessionDepthByDrive.get('vault') ?? 0) > 0) {
      return;
    }
    await unmountMountedDrive('vault');
  },

  async dispose(): Promise<void> {
    sessionDepthByDrive.set('vault', 0);
    await unmountMountedDrive('vault');
    await unmountMountedDrive('system');
    setAppDataRootOverride(null);
  },

  getVaultArchiveRoot(): string {
    const vault = getDriveRecord('vault');
    if (vault?.stage === 'MOUNTED') {
      return vault.mountPoint;
    }

    return getNormalizedVirtualDriveConfig().drives.vault.fallbackPath;
  },

  getSystemDataRoot(): string {
    const system = getDriveRecord('system');
    if (system?.stage === 'MOUNTED') {
      return isWindows() ? system.mountPoint : join(system.mountPoint, 'live');
    }

    return getNormalizedVirtualDriveConfig().drives.system.fallbackPath;
  },

  getStatus(): VirtualDriveRecord[] {
    return mountRegistryService.list();
  },

  getDiagnostics(): VirtualDriveDiagnosticsSnapshot {
    return computeDiagnostics();
  },

  isFailClosedEnabled(): boolean {
    return getNormalizedVirtualDriveConfig().failClosed;
  },

  async cleanupMountArtifacts(): Promise<void> {
    if (isWindows()) {
      return;
    }

    const root = resolve(getGovernanceRepoPath(), '.mounts');
    if (existsSync(root)) {
      await rm(root, { recursive: true, force: true });
    }
  },
};
