import { app } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { readMainEnvAlias } from './envService';
import { executeCommand } from './processService';

const APP_DATA_DIR = '.prana';
const LEGACY_APP_DATA_DIR = '.dhi';
const DEFAULT_GOVERNANCE_REPO_URL = 'git@bitbucket.org:NikhilVijayakumar/kumbha.git';

export interface GovernanceRepoStatus {
  sshVerified: boolean;
  repoReady: boolean;
  clonedNow: boolean;
  sshMessage: string;
  repoPath: string;
  repoUrl: string;
}

const resolveAppDataDir = (home: string): string => {
  const preferred = join(home, APP_DATA_DIR);
  const legacy = join(home, LEGACY_APP_DATA_DIR);
  if (existsSync(legacy) && !existsSync(preferred)) {
    return legacy;
  }

  return preferred;
};

export const getAppDataRoot = (): string => {
  try {
    return resolveAppDataDir(app.getPath('home'));
  } catch {
    return resolveAppDataDir(homedir());
  }
};

export const getGovernanceRepoPath = (): string => {
  const override = readMainEnvAlias('PRANA_GOV_REPO_PATH', 'DHI_GOV_REPO_PATH');
  if (override) {
    return override;
  }

  return join(getAppDataRoot(), 'governance');
};

export const getGovernanceRepoUrl = (): string => {
  return readMainEnvAlias('PRANA_GOV_REPO_URL', 'DHI_GOV_REPO_URL') ?? DEFAULT_GOVERNANCE_REPO_URL;
};

const hasGitRepository = (repoPath: string): boolean => {
  return existsSync(join(repoPath, '.git'));
};

const verifySshAccess = async (repoUrl: string): Promise<{ verified: boolean; message: string }> => {
  console.log('[PRANA] SSH verification for:', repoUrl);
  console.log('[PRANA] HOME:', process.env['HOME'] || '(not set)');
  console.log('[PRANA] USERPROFILE:', process.env['USERPROFILE'] || '(not set)');
  console.log('[PRANA] GIT_SSH_COMMAND:', process.env['GIT_SSH_COMMAND'] || '(not set)');

  const result = await executeCommand('git', ['ls-remote', repoUrl], 20_000);

  console.log('[PRANA] SSH result: ok=%s, exitCode=%s, timedOut=%s', result.ok, result.exitCode, result.timedOut);
  if (!result.ok) {
    console.log('[PRANA] SSH stderr:', result.stderr.slice(0, 500));
  }

  if (result.ok) {
    return {
      verified: true,
      message: 'SSH access verified.',
    };
  }

  if (result.timedOut) {
    return {
      verified: false,
      message: 'SSH verification timed out.',
    };
  }

  return {
    verified: false,
    message: result.stderr.trim() || result.stdout.trim() || 'SSH verification failed.',
  };
};


export const ensureGovernanceRepoReady = async (): Promise<GovernanceRepoStatus> => {
  const repoPath = getGovernanceRepoPath();
  const repoUrl = getGovernanceRepoUrl();

  const ssh = await verifySshAccess(repoUrl);
  if (!ssh.verified) {
    return {
      sshVerified: false,
      repoReady: false,
      clonedNow: false,
      sshMessage: ssh.message,
      repoPath,
      repoUrl,
    };
  }

  if (hasGitRepository(repoPath)) {
    return {
      sshVerified: true,
      repoReady: true,
      clonedNow: false,
      sshMessage: 'Repository is ready.',
      repoPath,
      repoUrl,
    };
  }

  await mkdir(dirname(repoPath), { recursive: true });

  if (existsSync(repoPath)) {
    const entries = await readdir(repoPath);
    if (entries.length > 0) {
      return {
        sshVerified: true,
        repoReady: false,
        clonedNow: false,
        sshMessage: 'Governance path exists but is not a git repository.',
        repoPath,
        repoUrl,
      };
    }
  }

  const cloneResult = await executeCommand('git', ['clone', repoUrl, repoPath], 45_000);
  if (!cloneResult.ok) {
    return {
      sshVerified: true,
      repoReady: false,
      clonedNow: false,
      sshMessage: cloneResult.stderr.trim() || cloneResult.stdout.trim() || 'Repository clone failed.',
      repoPath,
      repoUrl,
    };
  }

  return {
    sshVerified: true,
    repoReady: true,
    clonedNow: true,
    sshMessage: 'Repository cloned and ready.',
    repoPath,
    repoUrl,
  };
};
