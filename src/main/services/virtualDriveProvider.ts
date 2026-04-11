import { ChildProcess, spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { isAbsolute, resolve, normalize } from 'node:path';
import { executeCommand } from './processService';
import { getGovernanceRepoPath } from './governanceRepoService';
import type { VirtualDriveId } from './mountRegistryService';

export interface VirtualDriveProviderMountRequest {
  driveId: VirtualDriveId;
  sourcePath: string;
  mountPoint: string;
  password: string;
  obscuredFileNames: boolean;
  runtimeEnv?: Record<string, string>;
  options?: {
    attrTimeout?: string;
    dirCacheTime?: string;
    vfsCacheMode?: string;
    vfsCacheMaxAge?: string;
    binaryPath?: string;
    remoteName?: string;
  };
}

export interface VirtualDriveProviderMountResult {
  success: boolean;
  providerId: string;
  mountPoint: string;
  sourcePath: string;
  message: string;
  child?: ChildProcess;
  stderr?: string | null;
}

export interface VirtualDriveProviderUnmountRequest {
  driveId: VirtualDriveId;
  mountPoint: string;
  child?: ChildProcess;
}

export interface VirtualDriveProvider {
  readonly id: string;
  mount(request: VirtualDriveProviderMountRequest): Promise<VirtualDriveProviderMountResult>;
  unmount(request: VirtualDriveProviderUnmountRequest): Promise<void>;
}

const DEFAULT_ATTR_TIMEOUT = '1s';
const DEFAULT_DIR_CACHE_TIME = '5s';
const DEFAULT_VFS_CACHE_MODE = 'writes';
const DEFAULT_VFS_CACHE_MAX_AGE = '1m';

const detectMountFailure = (stderr: string): string | null => {
  const normalized = stderr.toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes('winfsp')) {
    return 'WinFsp is missing or not available for the configured mount provider.';
  }
  if (normalized.includes('mountpoint') && normalized.includes('in use')) {
    return 'Requested mount point is already in use.';
  }
  if (normalized.includes('fuse')) {
    return 'FUSE mount support is unavailable or misconfigured.';
  }
  return null;
};

const isWindows = (): boolean => process.platform === 'win32';

export class PATH_TRAVERSAL_VIOLATION extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PATH_TRAVERSAL_VIOLATION';
  }
}

export const assertSafeVaultPath = (targetPath: string, vaultRoot: string): string => {
  const resolvedPath = resolve(isAbsolute(targetPath) ? targetPath : resolve(vaultRoot, targetPath));
  const resolvedRoot = resolve(vaultRoot);
  // Ensure path is unequivocally within the root
  if (!normalize(resolvedPath).startsWith(normalize(resolvedRoot))) {
    throw new PATH_TRAVERSAL_VIOLATION(`Path traversal violation detected for path: ${targetPath}`);
  }
  return resolvedPath;
};

const ensureParentReady = async (mountPoint: string): Promise<void> => {
  if (isWindows()) {
    return;
  }

  const baseDir = resolve(getGovernanceRepoPath(), '.mounts');
  const target = isAbsolute(mountPoint) ? mountPoint : resolve(baseDir, mountPoint);
  
  if (!isAbsolute(mountPoint)) {
    assertSafeVaultPath(mountPoint, baseDir);
  }

  await mkdir(target, { recursive: true });
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

export const rcloneVirtualDriveProvider: VirtualDriveProvider = {
  id: 'rclone',

  async mount(request): Promise<VirtualDriveProviderMountResult> {
    // Basic prefix checks at mount boundaries
    if (!isAbsolute(request.sourcePath)) {
      assertSafeVaultPath(request.sourcePath, getGovernanceRepoPath());
    }
    
    await mkdir(request.sourcePath, { recursive: true });
    await ensureParentReady(request.mountPoint);

    const remoteName = request.options?.remoteName ?? `${request.driveId.toUpperCase()}_DRIVE`;
    const childEnv = {
      ...(request.runtimeEnv ?? {}),
      ...createCryptEnv(remoteName, request.sourcePath, request.password, request.obscuredFileNames),
    };

    const args = [
      'mount',
      `${remoteName}:`,
      request.mountPoint,
      '--attr-timeout',
      request.options?.attrTimeout ?? DEFAULT_ATTR_TIMEOUT,
      '--dir-cache-time',
      request.options?.dirCacheTime ?? DEFAULT_DIR_CACHE_TIME,
    ];

    if (request.driveId === 'system') {
      args.push(
        '--vfs-cache-mode',
        request.options?.vfsCacheMode ?? DEFAULT_VFS_CACHE_MODE,
        '--vfs-cache-max-age',
        request.options?.vfsCacheMaxAge ?? DEFAULT_VFS_CACHE_MAX_AGE,
      );
    }

    return new Promise((resolvePromise) => {
      const child = spawn(request.options?.binaryPath?.trim() || 'rclone', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: childEnv,
        shell: false,
      });

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
        if (!detected) {
          return;
        }

        settled = true;
        resolvePromise({
          success: false,
          providerId: 'rclone',
          mountPoint: request.mountPoint,
          sourcePath: request.sourcePath,
          message: detected,
          child,
          stderr,
        });
      });

      child.on('error', (error) => {
        if (settled) {
          return;
        }

        settled = true;
        resolvePromise({
          success: false,
          providerId: 'rclone',
          mountPoint: request.mountPoint,
          sourcePath: request.sourcePath,
          message: error instanceof Error ? error.message : 'Failed to spawn mount provider.',
          stderr,
        });
      });

      child.on('spawn', () => {
        if (settled) {
          return;
        }

        settled = true;
        resolvePromise({
          success: true,
          providerId: 'rclone',
          mountPoint: request.mountPoint,
          sourcePath: request.sourcePath,
          message: `${request.driveId} drive mounted through provider ${remoteName}.`,
          child,
          stderr: stderr || stdout || null,
        });
      });
    });
  },

  async unmount(request): Promise<void> {
    if (request.child?.pid) {
      if (isWindows()) {
        await executeCommand('taskkill', ['/PID', String(request.child.pid), '/T', '/F'], 15_000);
        return;
      }
    }

    if (isWindows()) {
      return;
    }

    await executeCommand('fusermount', ['-u', request.mountPoint], 15_000);
    await executeCommand('umount', [request.mountPoint], 15_000);
  },
};

const providers = new Map<string, VirtualDriveProvider>([
  [rcloneVirtualDriveProvider.id, rcloneVirtualDriveProvider],
]);

export const getVirtualDriveProvider = (providerId: string): VirtualDriveProvider => {
  return providers.get(providerId) ?? rcloneVirtualDriveProvider;
};
