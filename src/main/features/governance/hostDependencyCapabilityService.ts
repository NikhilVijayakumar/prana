import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { executeCommand } from '../operations/processService';
import { sqliteConfigStoreService } from '../../common/storage/sqliteConfigStoreService';

export type HostDependencyId = 'ssh' | 'git' | 'virtual-drive' | 'storage-governance-docs';

export interface HostDependencyDiagnostic {
  dependency: HostDependencyId;
  available: boolean;
  source: 'PATH' | 'CONFIG' | 'FILESYSTEM';
  command: string;
  message: string;
}

export interface HostDependencyCapabilityResult {
  passed: boolean;
  missing: HostDependencyId[];
  diagnostics: HostDependencyDiagnostic[];
}

const detectConfiguredVirtualDriveBinary = (): string | null => {
  const config = sqliteConfigStoreService.readSnapshotSync()?.config;
  const virtualDrives = config?.virtualDrives as {
    provider?: {
      rcloneBinaryPath?: string;
    };
    rcloneBinaryPath?: string;
  } | undefined;
  const providerPath = virtualDrives?.provider?.rcloneBinaryPath;
  const rootPath = virtualDrives?.rcloneBinaryPath;

  if (typeof providerPath === 'string' && providerPath.trim().length > 0) {
    return providerPath.trim();
  }

  if (typeof rootPath === 'string' && rootPath.trim().length > 0) {
    return rootPath.trim();
  }

  return null;
};

const checkPathDependency = async (
  dependency: HostDependencyId,
  command: string,
  args: string[],
  successMessage: string,
): Promise<HostDependencyDiagnostic> => {
  const result = await executeCommand(command, args, 8_000);
  if (result.ok) {
    return {
      dependency,
      available: true,
      source: 'PATH',
      command: `${command} ${args.join(' ')}`.trim(),
      message: successMessage,
    };
  }

  return {
    dependency,
    available: false,
    source: 'PATH',
    command: `${command} ${args.join(' ')}`.trim(),
    message: result.stderr.trim() || result.stdout.trim() || `${dependency} is not available on PATH.`,
  };
};

const checkVirtualDriveDependency = async (): Promise<HostDependencyDiagnostic> => {
  const configuredPath = detectConfiguredVirtualDriveBinary();
  if (configuredPath) {
    return {
      dependency: 'virtual-drive',
      available: existsSync(configuredPath),
      source: 'CONFIG',
      command: configuredPath,
      message: existsSync(configuredPath)
        ? `Virtual drive binary is available at configured path: ${configuredPath}`
        : `Configured virtual drive binary path not found: ${configuredPath}`,
    };
  }

  return checkPathDependency('virtual-drive', 'rclone', ['version'], 'Virtual drive runtime (rclone) is available on PATH.');
};

const checkStorageGovernanceDocs = async (govDocsRoot: string): Promise<HostDependencyDiagnostic> => {
  if (!existsSync(govDocsRoot)) {
    return {
      dependency: 'storage-governance-docs',
      available: false,
      source: 'FILESYSTEM',
      command: govDocsRoot,
      message: `Governance docs root not found: ${govDocsRoot}`,
    };
  }

  const cacheDir = join(govDocsRoot, 'cache');
  const vaultDir = join(govDocsRoot, 'vault');

  const cacheExists = existsSync(cacheDir);
  const vaultExists = existsSync(vaultDir);

  if (!cacheExists && !vaultExists) {
    return {
      dependency: 'storage-governance-docs',
      available: false,
      source: 'FILESYSTEM',
      command: govDocsRoot,
      message: 'Neither cache nor vault governance docs directory found.',
    };
  }

  let cacheFiles = 0;
  if (cacheExists) {
    try {
      cacheFiles = (await readdir(cacheDir)).length;
    } catch {
      cacheFiles = 0;
    }
  }

  let vaultFiles = 0;
  if (vaultExists) {
    try {
      vaultFiles = (await readdir(vaultDir)).length;
    } catch {
      vaultFiles = 0;
    }
  }

  return {
    dependency: 'storage-governance-docs',
    available: cacheFiles > 0,
    source: 'FILESYSTEM',
    command: govDocsRoot,
    message: cacheFiles > 0
      ? `Governance docs present: ${cacheFiles} cache file(s), ${vaultFiles} vault file(s).`
      : 'Governance docs directory exists but no cache contract files found.',
  };
};

export const hostDependencyCapabilityService = {
  async evaluate(storageGovernanceDocsRoot?: string): Promise<HostDependencyCapabilityResult> {
    const diagnostics: HostDependencyDiagnostic[] = [];

    diagnostics.push(await checkPathDependency('ssh', 'ssh', ['-V'], 'SSH binary is available on PATH.'));
    diagnostics.push(await checkPathDependency('git', 'git', ['--version'], 'Git binary is available on PATH.'));
    diagnostics.push(await checkVirtualDriveDependency());

    if (storageGovernanceDocsRoot) {
      diagnostics.push(await checkStorageGovernanceDocs(storageGovernanceDocsRoot));
    }

    const missing = diagnostics
      .filter((entry) => !entry.available)
      .map((entry) => entry.dependency);

    return {
      passed: missing.length === 0,
      missing,
      diagnostics,
    };
  },
};
