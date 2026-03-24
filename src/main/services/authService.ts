import { app } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ensureGovernanceRepoReady } from './governanceRepoService';
import { getRuntimeBootstrapConfig } from './runtimeConfigService';
import { vaultService } from './vaultService';

const AUTH_FILE_NAME = 'auth.json';
const APP_DATA_DIR = '.dhi';
const DEFAULT_PASSWORD = 'Director1';
const TEMP_PASSWORD_TTL_MS = 10 * 60 * 1000;

interface AuthRecord {
  directorName: string;
  email: string;
  passwordHash: string;
  tempPasswordHash: string | null;
  tempPasswordExpiresAt: number | null;
  lastPasswordResetAt: string;
}

export interface AuthStatus {
  sshVerified: boolean;
  repoReady: boolean;
  clonedNow: boolean;
  sshMessage: string;
  repoPath: string;
  repoUrl: string;
}

export interface LoginResult {
  success: boolean;
  reason: 'invalid_credentials' | 'email_mismatch' | 'ssh_unavailable';
  directorName: string | null;
  email: string | null;
  isFirstInstall: boolean;
  sessionToken: string | null;
}

export interface ForgotPasswordResult {
  success: boolean;
  reason: 'ssh_unavailable' | 'email_mismatch';
  tempPassword: string | null;
}

export interface ResetPasswordResult {
  success: boolean;
  reason: 'no_temp_password' | 'temp_password_expired' | 'invalid_password';
}

const getAppDataRoot = (): string => {
  return join(app.getPath('home'), APP_DATA_DIR);
};

const getAuthFilePath = (): string => {
  return join(getAppDataRoot(), AUTH_FILE_NAME);
};

const resolveSeedPasswordHash = async (): Promise<string> => {
  const runtimeConfig = getRuntimeBootstrapConfig();

  if (runtimeConfig.director.passwordHash) {
    return runtimeConfig.director.passwordHash;
  }

  const plainSeed = runtimeConfig.director.password ?? DEFAULT_PASSWORD;
  return bcrypt.hash(plainSeed, 10);
};

const ensureAuthStore = async (): Promise<AuthRecord> => {
  const runtimeConfig = getRuntimeBootstrapConfig();
  const dataRoot = getAppDataRoot();
  const authPath = getAuthFilePath();

  await mkdir(dataRoot, { recursive: true });

  if (!existsSync(authPath)) {
    const seededRecord: AuthRecord = {
      directorName: runtimeConfig.director.name,
      email: runtimeConfig.director.email,
      passwordHash: await resolveSeedPasswordHash(),
      tempPasswordHash: null,
      tempPasswordExpiresAt: null,
      lastPasswordResetAt: new Date().toISOString(),
    };
    await writeFile(authPath, JSON.stringify(seededRecord, null, 2), 'utf8');
    return seededRecord;
  }

  const raw = await readFile(authPath, 'utf8');
  const parsedRecord = JSON.parse(raw) as Partial<AuthRecord>;
  const migratedRecord: AuthRecord = {
    directorName: parsedRecord.directorName ?? runtimeConfig.director.name,
    email: parsedRecord.email ?? runtimeConfig.director.email,
    passwordHash: parsedRecord.passwordHash ?? (await resolveSeedPasswordHash()),
    tempPasswordHash: parsedRecord.tempPasswordHash ?? null,
    tempPasswordExpiresAt: parsedRecord.tempPasswordExpiresAt ?? null,
    lastPasswordResetAt: parsedRecord.lastPasswordResetAt ?? new Date().toISOString(),
  };

  // Persist once to backfill older auth stores that predate directorName support.
  if (!parsedRecord.directorName) {
    await persistAuthStore(migratedRecord);
  }

  return migratedRecord;
};

const persistAuthStore = async (record: AuthRecord): Promise<void> => {
  await writeFile(getAuthFilePath(), JSON.stringify(record, null, 2), 'utf8');
};

const ensureBootstrapReady = async (): Promise<AuthStatus> => {
  const repoStatus = await ensureGovernanceRepoReady();

  if (repoStatus.repoReady) {
    await vaultService.initializeVault();
  }

  return {
    sshVerified: repoStatus.sshVerified,
    repoReady: repoStatus.repoReady,
    clonedNow: repoStatus.clonedNow,
    sshMessage: repoStatus.sshMessage,
    repoPath: repoStatus.repoPath,
    repoUrl: repoStatus.repoUrl,
  };
};

const generateTempPassword = (): string => {
  return `Temp${Math.floor(Math.random() * 9000 + 1000)}A!`;
};

export const authService = {
  async getStatus(): Promise<AuthStatus> {
    await ensureAuthStore();
    return ensureBootstrapReady();
  },

  async login(email: string, password: string): Promise<LoginResult> {
    const bootstrap = await ensureBootstrapReady();
    if (!bootstrap.sshVerified || !bootstrap.repoReady) {
      return {
        success: false,
        reason: 'ssh_unavailable',
        directorName: null,
        email: null,
        isFirstInstall: false,
        sessionToken: null,
      };
    }

    const record = await ensureAuthStore();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail !== record.email.toLowerCase()) {
      return {
        success: false,
        reason: 'email_mismatch',
        directorName: null,
        email: null,
        isFirstInstall: false,
        sessionToken: null,
      };
    }

    const passwordMatches = await bcrypt.compare(password, record.passwordHash);
    if (!passwordMatches) {
      return {
        success: false,
        reason: 'invalid_credentials',
        directorName: null,
        email: null,
        isFirstInstall: false,
        sessionToken: null,
      };
    }

    const sessionToken = `dhi_session_${randomUUID()}`;
    return {
      success: true,
      reason: 'invalid_credentials',
      directorName: record.directorName,
      email: record.email,
      isFirstInstall: true,
      sessionToken,
    };
  },

  async forgotPassword(email: string): Promise<ForgotPasswordResult> {
    const bootstrap = await ensureBootstrapReady();
    if (!bootstrap.sshVerified || !bootstrap.repoReady) {
      return {
        success: false,
        reason: 'ssh_unavailable',
        tempPassword: null,
      };
    }

    const record = await ensureAuthStore();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail !== record.email.toLowerCase()) {
      return {
        success: false,
        reason: 'email_mismatch',
        tempPassword: null,
      };
    }

    const tempPassword = generateTempPassword();
    record.tempPasswordHash = await bcrypt.hash(tempPassword, 10);
    record.tempPasswordExpiresAt = Date.now() + TEMP_PASSWORD_TTL_MS;
    await persistAuthStore(record);

    return {
      success: true,
      reason: 'email_mismatch',
      tempPassword,
    };
  },

  async resetPassword(newPassword: string): Promise<ResetPasswordResult> {
    const hasMinLength = newPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!(hasMinLength && hasUppercase && hasNumber)) {
      return {
        success: false,
        reason: 'invalid_password',
      };
    }

    const record = await ensureAuthStore();

    if (!record.tempPasswordHash || !record.tempPasswordExpiresAt) {
      return {
        success: false,
        reason: 'no_temp_password',
      };
    }

    if (Date.now() > record.tempPasswordExpiresAt) {
      record.tempPasswordHash = null;
      record.tempPasswordExpiresAt = null;
      await persistAuthStore(record);
      return {
        success: false,
        reason: 'temp_password_expired',
      };
    }

    record.passwordHash = await bcrypt.hash(newPassword, 10);
    record.tempPasswordHash = null;
    record.tempPasswordExpiresAt = null;
    record.lastPasswordResetAt = new Date().toISOString();
    await persistAuthStore(record);

    return {
      success: true,
      reason: 'invalid_password',
    };
  },
};
