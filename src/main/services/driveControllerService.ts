import { ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { getPranaPlatformRuntime } from './pranaPlatformRuntime';
import { sqliteConfigStoreService } from './sqliteConfigStoreService';
import { getGovernanceRepoPath, setAppDataRootOverride } from './governanceRepoService';
import { mountRegistryService, VirtualDriveId, VirtualDriveRecord } from './mountRegistryService';
import { executeCommand } from './processService';
import { hookSystemService } from './hookSystemService';

export interface VirtualDriveMountResult {
  success: boolean;
  driveId: VirtualDriveId;
  mountPoint: string;
  sourcePath: string;
  usedFallbackPath: boolean;
  message: string;
}

const SYSTEM_DRIVE_DEFAULT = 'S:';
const VAULT_DRIVE_DEFAULT = 'V:';
const SYSTEM_REMOTE_NAME = 'PRANA_SYS_CRYPT';
const VAULT_REMOTE_NAME = 'PRANA_VAULT_CRYPT';
const DEFAULT_ATTR_TIMEOUT = '1s';
const DEFAULT_VFS_CACHE_MODE = 'writes';
const DEFAULT_VFS_CACHE_MAX_AGE = '1m';
const DEFAULT_DIR_CACHE_TIME = '5s';

const childByDrive = new Map<VirtualDriveId, ChildProcess>();

const nowIso = (): string => new Date().toISOString();

const getRuntimeVirtualDriveConfig = () => sqliteConfigStoreService.readSnapshotSync()?.config?.virtualDrives;

const isWindows = (): boolean => process.platform === 'win32';

const getRcloneBinary = (): string => {
  const configured = getRuntimeVirtualDriveConfig()?.rcloneBinaryPath?.trim();
  return configured && configured.length > 0 ? configured : 'rclone';
};

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

const resolveSystemSourcePath = (): string => resolve(getGovernanceRepoPath(), 'db');
const resolveVaultSourcePath = (): string => resolve(getGovernanceRepoPath(), 'vault');

const resolveMountPoint = (driveId: VirtualDriveId): string => {
  const config = getRuntimeVirtualDriveConfig();
  if (driveId === 'system') {
    return normalizeDriveMountPoint(config?.systemDriveLetter ?? SYSTEM_DRIVE_DEFAULT);
  }

  return normalizeDriveMountPoint(config?.vaultDriveLetter ?? VAULT_DRIVE_DEFAULT);
};

const resolveUnixMountPoint = (driveId: VirtualDriveId): string => {
  const mountPoint = resolveMountPoint(driveId);
  if (isWindows()) {
    return mountPoint;
  }

  if (isAbsolute(mountPoint)) {
    return mountPoint;
  }

  return resolve(getGovernanceRepoPath(), '.mounts', driveId);
};

const buildRecord = (
  driveId: VirtualDriveId,
  stage: VirtualDriveRecord['stage'],
  mountPoint: string,
  sourcePath: string,
  lastError: string | null,
  lastStderr: string | null,
  pid: number | null,
): VirtualDriveRecord => ({
  id: driveId,
  stage,
  mountPoint,
  sourcePath,
  pid,
  mountedAt: stage === 'MOUNTED' ? nowIso() : null,
  lastError,
  lastStderr,
});

const detectMountFailure = (stderr: string): string | null => {
  const normalized = stderr.toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes('winfsp')) {
    return 'WinFsp is missing or not available for Rclone mount.';
  }
  if (normalized.includes('mountpoint') && normalized.includes('in use')) {
    return 'Requested mount point is already in use.';
  }
  if (normalized.includes('fuse')) {
    return 'FUSE mount support is unavailable or misconfigured.';
  }
  return null;
};

const ensureParentReady = async (mountPoint: string): Promise<void> => {
  if (isWindows()) {
    return;
  }

  await mkdir(mountPoint, { recursive: true });
};

const createCryptEnv = (
  remoteName: string,
  sourcePath: string,
  password: string,
  obscuredFileNames: boolean,
): Record<string, string> => ({
  [`RCLONE_CONFIG_${remoteName}_TYPE`]: 'crypt',
  [`RCLONE_CONFIG_${remoteName}_REMOTE`]: sourcePath,
  [`RCLONE_CONFIG_${remoteName}_PASSWORD`]: password,
  [`RCLONE_CONFIG_${remoteName}_FILENAME_ENCRYPTION`]: obscuredFileNames ? 'standard' : 'off',
  [`RCLONE_CONFIG_${remoteName}_DIRECTORY_NAME_ENCRYPTION`]: obscuredFileNames ? 'true' : 'false',
});

const spawnMount = async (
  driveId: VirtualDriveId,
  sourcePath: string,
  mountPoint: string,
  password: string,
  options?: { attrTimeout?: string; vfsCacheMode?: string; vfsCacheMaxAge?: string },
): Promise<VirtualDriveMountResult> => {
  const existing = mountRegistryService.get(driveId);
  if (existing?.stage === 'MOUNTED' || existing?.stage === 'MOUNTING') {
    return {
      success: true,
      driveId,
      mountPoint: existing.mountPoint,
      sourcePath: existing.sourcePath,
      usedFallbackPath: false,
      message: `${driveId} drive already ${existing.stage.toLowerCase()}.`,
    };
  }

  await mkdir(sourcePath, { recursive: true });
  await ensureParentReady(mountPoint);

  const obscuredFileNames = getRuntimeVirtualDriveConfig()?.obscuredFileNames !== false;
  const remoteName = driveId === 'system' ? SYSTEM_REMOTE_NAME : VAULT_REMOTE_NAME;
  const platformEnv = getPranaPlatformRuntime().inheritedEnv ?? {};
  const childEnv = {
    ...platformEnv,
    ...createCryptEnv(remoteName, sourcePath, password, obscuredFileNames),
  };

  const args = [
    'mount',
    `${remoteName}:`,
    mountPoint,
    '--attr-timeout',
    options?.attrTimeout ?? DEFAULT_ATTR_TIMEOUT,
    '--dir-cache-time',
    DEFAULT_DIR_CACHE_TIME,
  ];

  if (driveId === 'system') {
    args.push(
      '--vfs-cache-mode',
      options?.vfsCacheMode ?? DEFAULT_VFS_CACHE_MODE,
      '--vfs-cache-max-age',
      options?.vfsCacheMaxAge ?? DEFAULT_VFS_CACHE_MAX_AGE,
    );
  }

  mountRegistryService.upsert(buildRecord(driveId, 'MOUNTING', mountPoint, sourcePath, null, null, null));

  return new Promise((resolvePromise) => {
    const child = spawn(getRcloneBinary(), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: childEnv,
      shell: false,
    });

    childByDrive.set(driveId, child);

    let stderr = '';
    let stdout = '';
    let settled = false;

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
      if (settled) {
        return;
      }

      const detected = detectMountFailure(stderr);
      if (detected) {
        settled = true;
        mountRegistryService.upsert(buildRecord(driveId, 'FAILED', mountPoint, sourcePath, detected, stderr, child.pid ?? null));
        resolvePromise({
          success: false,
          driveId,
          mountPoint,
          sourcePath,
          usedFallbackPath: false,
          message: detected,
        });
      }
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      const message = error instanceof Error ? error.message : 'Failed to spawn rclone mount process.';
      mountRegistryService.upsert(buildRecord(driveId, 'FAILED', mountPoint, sourcePath, message, stderr, null));
      resolvePromise({
        success: false,
        driveId,
        mountPoint,
        sourcePath,
        usedFallbackPath: false,
        message,
      });
    });

    child.on('spawn', () => {
      if (settled) {
        return;
      }

      settled = true;
      mountRegistryService.upsert(buildRecord(driveId, 'MOUNTED', mountPoint, sourcePath, null, stderr || stdout || null, child.pid ?? null));
      resolvePromise({
        success: true,
        driveId,
        mountPoint,
        sourcePath,
        usedFallbackPath: false,
        message: `${driveId} drive mounted through rclone.`,
      });
    });

    child.on('close', (code) => {
      childByDrive.delete(driveId);
      const current = mountRegistryService.get(driveId);
      if (current?.stage === 'UNMOUNTING') {
        mountRegistryService.upsert(buildRecord(driveId, 'UNMOUNTED', mountPoint, sourcePath, null, stderr || stdout || null, null));
        return;
      }

      if (!settled) {
        const message = stderr.trim() || stdout.trim() || `rclone mount exited early with code ${code ?? 'unknown'}.`;
        mountRegistryService.upsert(buildRecord(driveId, 'FAILED', mountPoint, sourcePath, message, stderr || stdout, null));
        void hookSystemService.emit('system.status', { component: `drive:${driveId}`, status: 'degraded', reason: message });
      } else if (current?.stage === 'MOUNTED') {
        const message = `Mount process exited with code ${code ?? 'unknown'}.`;
        mountRegistryService.upsert(buildRecord(driveId, 'FAILED', mountPoint, sourcePath, message, stderr || stdout, null));
        void hookSystemService.emit('system.status', { component: `drive:${driveId}`, status: 'degraded', reason: message });
      }
    });
  });
};

const unmountMountedDrive = async (driveId: VirtualDriveId): Promise<void> => {
  const current = mountRegistryService.get(driveId);
  if (!current || (current.stage !== 'MOUNTED' && current.stage !== 'FAILED' && current.stage !== 'MOUNTING')) {
    return;
  }

  mountRegistryService.upsert(buildRecord(driveId, 'UNMOUNTING', current.mountPoint, current.sourcePath, null, current.lastStderr, current.pid));
  const child = childByDrive.get(driveId);

  if (child?.pid) {
    if (isWindows()) {
      await executeCommand('taskkill', ['/PID', String(child.pid), '/T', '/F'], 15_000);
    } else {
      await executeCommand('fusermount', ['-u', current.mountPoint], 15_000);
      await executeCommand('umount', [current.mountPoint], 15_000);
    }
  } else if (!isWindows()) {
    await executeCommand('fusermount', ['-u', current.mountPoint], 15_000);
    await executeCommand('umount', [current.mountPoint], 15_000);
  }

  childByDrive.delete(driveId);
  mountRegistryService.upsert(buildRecord(driveId, 'UNMOUNTED', current.mountPoint, current.sourcePath, null, current.lastStderr, null));
};

export const driveControllerService = {
  async initializeSystemDrive(): Promise<VirtualDriveMountResult> {
    const sourcePath = resolveSystemSourcePath();
    const mountPoint = resolveUnixMountPoint('system');
    const fallbackPath = join(sourcePath, 'live');
    await mkdir(fallbackPath, { recursive: true });

    if (getRuntimeVirtualDriveConfig()?.enabled === false) {
      setAppDataRootOverride(fallbackPath);
      mountRegistryService.upsert(buildRecord('system', 'UNMOUNTED', mountPoint, sourcePath, null, 'Virtual drives disabled by config.', null));
      return {
        success: true,
        driveId: 'system',
        mountPoint,
        sourcePath,
        usedFallbackPath: true,
        message: 'Virtual drives disabled. Using fallback system storage path.',
      };
    }

    const password = getRuntimeVirtualDriveConfig()?.systemCryptPassword?.trim();
      // Falls back to existing vault archive password so disk-level crypt stays additive.
    const effectivePassword = password && password.length > 0
      ? password
      : (sqliteConfigStoreService.readSnapshotSync()?.config?.vault?.archivePassword ?? '');

    if (!effectivePassword) {
      setAppDataRootOverride(fallbackPath);
      mountRegistryService.upsert(buildRecord('system', 'FAILED', mountPoint, sourcePath, 'No system-drive crypt password configured.', null, null));
      return {
        success: false,
        driveId: 'system',
        mountPoint,
        sourcePath,
        usedFallbackPath: true,
        message: 'No system-drive crypt password configured. Falling back to repo/db/live.',
      };
    }

    const result = await spawnMount('system', sourcePath, mountPoint, effectivePassword);
    if (result.success) {
      setAppDataRootOverride(isWindows() ? mountPoint : join(mountPoint, 'live'));
      if (!isWindows()) {
        await mkdir(join(mountPoint, 'live'), { recursive: true });
      }
      return result;
    }

    setAppDataRootOverride(fallbackPath);
    void hookSystemService.emit('system.status', { component: 'drive', status: 'degraded', reason: result.message });
    return {
      ...result,
      usedFallbackPath: true,
      message: `${result.message} Falling back to repo/db/live.`,
    };
  },

  async mountVaultDrive(userPassword: string): Promise<VirtualDriveMountResult> {
    const sourcePath = resolveVaultSourcePath();
    const mountPoint = resolveUnixMountPoint('vault');
    const trimmed = userPassword.trim();
    if (!trimmed) {
      return {
        success: false,
        driveId: 'vault',
        mountPoint,
        sourcePath,
        usedFallbackPath: false,
        message: 'Vault drive password is required.',
      };
    }

    return spawnMount('vault', sourcePath, mountPoint, trimmed, {
      attrTimeout: DEFAULT_ATTR_TIMEOUT,
    });
  },

  async unmountVaultDrive(): Promise<void> {
    await unmountMountedDrive('vault');
  },

  async dispose(): Promise<void> {
    await unmountMountedDrive('vault');
    await unmountMountedDrive('system');
    setAppDataRootOverride(null);
  },

  getVaultArchiveRoot(): string {
    const vault = mountRegistryService.get('vault');
    if (vault?.stage === 'MOUNTED') {
      return vault.mountPoint;
    }

    return resolveVaultSourcePath();
  },

  getSystemDataRoot(): string {
    const system = mountRegistryService.get('system');
    if (system?.stage === 'MOUNTED') {
      return isWindows() ? system.mountPoint : join(system.mountPoint, 'live');
    }

    return join(resolveSystemSourcePath(), 'live');
  },

  getStatus() {
    return mountRegistryService.list();
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
