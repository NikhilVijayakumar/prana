export const SESSION_STORAGE_KEY = 'prana_session';
export const LEGACY_SESSION_STORAGE_KEY = 'dhi_session';

export const ONBOARDING_COMPLETE_STORAGE_KEY = 'prana_onboarding_complete';
export const LEGACY_ONBOARDING_COMPLETE_STORAGE_KEY = 'dhi_onboarding_complete';

export const ONBOARDING_LEDGER_STORAGE_KEY = 'prana_onboarding_commit_ledger_v1';
export const LEGACY_ONBOARDING_LEDGER_STORAGE_KEY = 'dhi_onboarding_commit_ledger_v1';

export const LOCKOUT_TS_STORAGE_KEY = 'prana_lockout_until';
export const LEGACY_LOCKOUT_TS_STORAGE_KEY = 'dhi_lockout_until';

export const LOCKOUT_COUNT_STORAGE_KEY = 'prana_lockout_count';
export const LEGACY_LOCKOUT_COUNT_STORAGE_KEY = 'dhi_lockout_count';

export const SESSION_TOKEN_PREFIX = 'prana_session_';
export const LEGACY_SESSION_TOKEN_PREFIX = 'dhi_session_';

export const readStorageWithLegacy = (primaryKey: string, legacyKey: string): string | null => {
  return localStorage.getItem(primaryKey) ?? localStorage.getItem(legacyKey);
};
