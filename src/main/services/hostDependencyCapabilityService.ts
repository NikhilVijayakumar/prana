import { existsSync } from 'node:fs';
import { executeCommand } from './processService';
import { sqliteConfigStoreService } from './sqliteConfigStoreService';

export type HostDependencyId = 'ssh' | 'git' | 'virtual-drive';

export interface HostDependencyDiagnostic {
  dependency: HostDependencyId;
  available: boolean;
  source: 'PATH' | 'CONFIG';
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

export const hostDependencyCapabilityService = {
  async evaluate(): Promise<HostDependencyCapabilityResult> {
    const diagnostics: HostDependencyDiagnostic[] = [];

    diagnostics.push(await checkPathDependency('ssh', 'ssh', ['-V'], 'SSH binary is available on PATH.'));
    diagnostics.push(await checkPathDependency('git', 'git', ['--version'], 'Git binary is available on PATH.'));
    diagnostics.push(await checkVirtualDriveDependency());

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
