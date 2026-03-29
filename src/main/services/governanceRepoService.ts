import { app } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { executeCommand } from './processService';
import { getPranaPlatformRuntime } from './pranaPlatformRuntime';
import { getRuntimeBootstrapConfig } from './runtimeConfigService';

const APP_DATA_DIR = '.prana';
const LEGACY_APP_DATA_DIR = '.dhi';
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
  return getRuntimeBootstrapConfig().governance.repoPath;
};

export const getGovernanceRepoUrl = (): string => {
  return getRuntimeBootstrapConfig().governance.repoUrl;
};

const hasGitRepository = (repoPath: string): boolean => {
  return existsSync(join(repoPath, '.git'));
};

const getRequestedTestBranch = (): string | null => {
  const configuredBranch = process.env.PRANA_TEST_BRANCH?.trim();
  if (configuredBranch) {
    return configuredBranch;
  }

  return process.env.NODE_ENV === 'test' ? 'test-sandbox' : null;
};

const doesRemoteBranchExist = async (repoUrl: string, branchName: string): Promise<boolean> => {
  const result = await executeCommand('git', ['ls-remote', '--heads', repoUrl, branchName], 20_000);
  if (!result.ok) {
    return false;
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line.endsWith(`refs/heads/${branchName}`));
};

const checkoutExistingRemoteBranch = async (repoPath: string, branchName: string): Promise<boolean> => {
  const fetchResult = await executeCommand('git', ['-C', repoPath, 'fetch', 'origin', branchName], 30_000);
  if (!fetchResult.ok) {
    return false;
  }

  const checkoutResult = await executeCommand(
    'git',
    ['-C', repoPath, 'checkout', '-B', branchName, `origin/${branchName}`],
    20_000,
  );

  return checkoutResult.ok;
};

const createAndPushBranch = async (repoPath: string, branchName: string): Promise<{ ok: boolean; message: string }> => {
  const checkoutResult = await executeCommand('git', ['-C', repoPath, 'checkout', '-B', branchName], 20_000);
  if (!checkoutResult.ok) {
    return {
      ok: false,
      message: checkoutResult.stderr.trim() || checkoutResult.stdout.trim() || 'Failed to create local test branch.',
    };
  }

  const pushResult = await executeCommand('git', ['-C', repoPath, 'push', '-u', 'origin', branchName], 45_000);
  if (!pushResult.ok) {
    return {
      ok: false,
      message: pushResult.stderr.trim() || pushResult.stdout.trim() || 'Failed to push test branch to remote.',
    };
  }

  return {
    ok: true,
    message: `Created and pushed test branch '${branchName}'.`,
  };
};

const ensureTestBranchReady = async (
  repoPath: string,
  repoUrl: string,
  branchName: string,
): Promise<{ ok: boolean; message: string }> => {
  const remoteBranchExists = await doesRemoteBranchExist(repoUrl, branchName);

  if (remoteBranchExists) {
    const checkedOut = await checkoutExistingRemoteBranch(repoPath, branchName);
    if (!checkedOut) {
      return {
        ok: false,
        message: `Remote branch '${branchName}' exists but checkout failed.`,
      };
    }

    return {
      ok: true,
      message: `Using existing remote test branch '${branchName}'.`,
    };
  }

  return createAndPushBranch(repoPath, branchName);
};

const verifySshAccess = async (repoUrl: string): Promise<{ verified: boolean; message: string }> => {
  const platformRuntime = getPranaPlatformRuntime();
  console.log('[PRANA] SSH verification for:', repoUrl);
  console.log('[PRANA] HOME:', platformRuntime.homeDir || '(not set)');
  console.log('[PRANA] USERPROFILE:', platformRuntime.userProfileDir || '(not set)');
  console.log('[PRANA] GIT_SSH_COMMAND:', platformRuntime.gitSshCommand || '(not set)');

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
  const requestedTestBranch = getRequestedTestBranch();

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
    if (requestedTestBranch) {
      const branchResult = await ensureTestBranchReady(repoPath, repoUrl, requestedTestBranch);
      if (!branchResult.ok) {
        return {
          sshVerified: true,
          repoReady: false,
          clonedNow: false,
          sshMessage: branchResult.message,
          repoPath,
          repoUrl,
        };
      }

      return {
        sshVerified: true,
        repoReady: true,
        clonedNow: false,
        sshMessage: branchResult.message,
        repoPath,
        repoUrl,
      };
    }

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

  const cloneArgs = requestedTestBranch
    ? ['clone', repoUrl, repoPath]
    : ['clone', repoUrl, repoPath];
  const cloneResult = await executeCommand('git', cloneArgs, 45_000);
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

  if (requestedTestBranch) {
    const branchResult = await ensureTestBranchReady(repoPath, repoUrl, requestedTestBranch);
    if (!branchResult.ok) {
      return {
        sshVerified: true,
        repoReady: false,
        clonedNow: true,
        sshMessage: branchResult.message,
        repoPath,
        repoUrl,
      };
    }

    return {
      sshVerified: true,
      repoReady: true,
      clonedNow: true,
      sshMessage: branchResult.message,
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
