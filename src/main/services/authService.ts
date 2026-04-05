import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ensureGovernanceRepoReady } from './governanceRepoService';
import { getRuntimeBootstrapConfig } from './runtimeConfigService';
import { authStoreService, type AuthStoreRecord } from './authStoreService';

const DEFAULT_PASSWORD = 'Director1';
const TEMP_PASSWORD_TTL_MS = 10 * 60 * 1000;
const SESSION_TOKEN_PREFIX = 'prana_session_';

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
  reason?: 'invalid_credentials' | 'email_mismatch' | 'ssh_unavailable';
  directorName: string | null;
  email: string | null;
  isFirstInstall: boolean;
  sessionToken: string | null;
  sessionTokenExpiresAt?: string; // ISO timestamp for session expiry
  vaultDriveMounted?: boolean;
  vaultDriveMessage?: string;
}

export interface ForgotPasswordResult {
  success: boolean;
  reason?: 'ssh_unavailable' | 'email_mismatch';
  tempPassword: string | null;
}

export interface ResetPasswordResult {
  success: boolean;
  reason?: 'no_temp_password' | 'temp_password_expired' | 'invalid_password';
}

const resolveSeedPasswordHash = async (): Promise<string> => {
  const runtimeConfig = getRuntimeBootstrapConfig();

  if (runtimeConfig.director.passwordHash) {
    return runtimeConfig.director.passwordHash;
  }

  const plainSeed = runtimeConfig.director.password ?? DEFAULT_PASSWORD;
  return bcrypt.hash(plainSeed, 10);
};

const ensureAuthStore = async (): Promise<AuthStoreRecord> => {
  const runtimeConfig = getRuntimeBootstrapConfig();
  const existing = await authStoreService.get();
  if (!existing) {
    const seededRecord: AuthStoreRecord = {
      directorName: runtimeConfig.director.name,
      email: runtimeConfig.director.email,
      passwordHash: await resolveSeedPasswordHash(),
      tempPasswordHash: null,
      tempPasswordExpiresAt: null,
      lastPasswordResetAt: new Date().toISOString(),
    };
    await authStoreService.save(seededRecord);
    return seededRecord;
  }

  const migratedRecord: AuthStoreRecord = {
    directorName: existing.directorName || runtimeConfig.director.name,
    email: existing.email || runtimeConfig.director.email,
    passwordHash: existing.passwordHash || (await resolveSeedPasswordHash()),
    tempPasswordHash: existing.tempPasswordHash ?? null,
    tempPasswordExpiresAt: existing.tempPasswordExpiresAt ?? null,
    lastPasswordResetAt: existing.lastPasswordResetAt ?? new Date().toISOString(),
  };

  if (
    migratedRecord.directorName !== existing.directorName
    || migratedRecord.email !== existing.email
    || migratedRecord.passwordHash !== existing.passwordHash
    || migratedRecord.lastPasswordResetAt !== existing.lastPasswordResetAt
  ) {
    await authStoreService.save(migratedRecord);
  }

  return migratedRecord;
};

const ensureBootstrapReady = async (): Promise<AuthStatus> => {
  const repoStatus = await ensureGovernanceRepoReady();

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

/**
 * Brute force protection constants
 */
const MAX_ATTEMPTS_SOFT = 3; // Soft lockout threshold (60 seconds)
const SOFT_LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS_HARD = 10; // Hard lockout threshold (300 seconds)
const HARD_LOCKOUT_DURATION_MS = 300 * 1000; // 300 seconds

/**
 * Check if account is currently locked due to brute force protection
 */
const isAccountLocked = (record: AuthStoreRecord): { locked: boolean; reason?: string } => {
  const now = Date.now();
  if (record.attemptLockUntil && now < record.attemptLockUntil) {
    const remainingMs = record.attemptLockUntil - now;
    const remainingSec = Math.ceil(remainingMs / 1000);
    return {
      locked: true,
      reason: `Account locked due to too many failed attempts. Try again in ${remainingSec}s.`,
    };
  }
  return { locked: false };
};

/**
 * Register failed login attempt and apply lockout if threshold exceeded
 */
const recordFailedAttempt = (record: AuthStoreRecord): void => {
  record.attemptCount = (record.attemptCount ?? 0) + 1;

  if (record.attemptCount >= MAX_ATTEMPTS_HARD) {
    // Hard lockout (300 seconds)
    record.attemptLockUntil = Date.now() + HARD_LOCKOUT_DURATION_MS;
  } else if (record.attemptCount >= MAX_ATTEMPTS_SOFT) {
    // Soft lockout (60 seconds)
    record.attemptLockUntil = Date.now() + SOFT_LOCKOUT_DURATION_MS;
  }
};

export const authService = {
  async getStatus(): Promise<AuthStatus> {
    await ensureAuthStore();
    return ensureBootstrapReady();
  },

  async login(email: string, password: string): Promise<LoginResult> {
    const record = await ensureAuthStore();
    const normalizedEmail = email.trim().toLowerCase();

    // Check brute force lockout
    const lockStatus = isAccountLocked(record);
    if (lockStatus.locked) {
      return {
        success: false,
        reason: 'invalid_credentials',
        directorName: null,
        email: null,
        isFirstInstall: false,
        sessionToken: null,
      };
    }

    if (normalizedEmail !== record.email.toLowerCase()) {
      recordFailedAttempt(record);
      await authStoreService.save(record);
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
      recordFailedAttempt(record);
      await authStoreService.save(record);
      return {
        success: false,
        reason: 'invalid_credentials',
        directorName: null,
        email: null,
        isFirstInstall: false,
        sessionToken: null,
      };
    }

    // Password match successful - reset attempt counter
    record.attemptCount = 0;
    record.attemptLockUntil = undefined;

    const sessionToken = `${SESSION_TOKEN_PREFIX}${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour TTL
    await authStoreService.save(record); // Save reset attempt counter
    return {
      success: true,
      directorName: record.directorName,
      email: record.email,
      isFirstInstall: true,
      sessionToken,
      sessionTokenExpiresAt: expiresAt,
      vaultDriveMounted: false,
      vaultDriveMessage: 'Vault drive remains locked until an explicit high-security flow requests access.',
    };
  },

  async forgotPassword(email: string): Promise<ForgotPasswordResult> {
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
    record.attemptCount = 0; // Reset brute force counter on successful password reset request
    await authStoreService.save(record);

    return {
      success: true,
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
      await authStoreService.save(record);
      return {
        success: false,
        reason: 'temp_password_expired',
      };
    }

    record.passwordHash = await bcrypt.hash(newPassword, 10);
    record.tempPasswordHash = null;
    record.tempPasswordExpiresAt = null;
    record.lastPasswordResetAt = new Date().toISOString();
    record.attemptCount = 0; // Reset brute force counter on successful password reset
    await authStoreService.save(record);

    return {
      success: true,
    };
  },
};
