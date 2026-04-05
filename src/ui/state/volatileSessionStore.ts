import { useSyncExternalStore } from 'react';
import {
  SESSION_TOKEN_PREFIX,
  LEGACY_SESSION_TOKEN_PREFIX,
  SESSION_STORAGE_KEY,
  LEGACY_SESSION_STORAGE_KEY,
  ONBOARDING_COMPLETE_STORAGE_KEY,
  LEGACY_ONBOARDING_COMPLETE_STORAGE_KEY,
  ONBOARDING_LEDGER_STORAGE_KEY,
  LEGACY_ONBOARDING_LEDGER_STORAGE_KEY,
} from 'prana/ui/constants/storageKeys';

interface VolatileSessionState {
  sessionToken: string | null;
  sessionTokenExpiresAt: string | null; // ISO timestamp for session expiry
  onboardingStatus: OnboardingStatus;
  onboardingComplete: boolean;
}

export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type ExperienceMode = 'PREVIEW' | 'ACTIVE';

let state: VolatileSessionState = {
  sessionToken: null,
  sessionTokenExpiresAt: null,
  onboardingStatus: 'NOT_STARTED',
  onboardingComplete: false,
};

const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): VolatileSessionState => state;

const isCompleted = (status: OnboardingStatus): boolean => status === 'COMPLETED';

const toOnboardingStatus = (onboardingComplete: boolean): OnboardingStatus => {
  return onboardingComplete ? 'COMPLETED' : 'NOT_STARTED';
};

const setState = (next: VolatileSessionState): void => {
  state = next;
  emit();
};

export const useVolatileSessionStore = (): VolatileSessionState => {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export const volatileSessionStore = {
  get(): VolatileSessionState {
    return state;
  },

  getExperienceMode(): ExperienceMode {
    return state.onboardingStatus === 'COMPLETED' ? 'ACTIVE' : 'PREVIEW';
  },

  setSessionToken(sessionToken: string, expiresAt?: string): void {
    setState({
      ...state,
      sessionToken,
      sessionTokenExpiresAt: expiresAt ?? null,
    });
  },

  /**
   * Check if current session token has expired
   */
  isSessionExpired(): boolean {
    if (!state.sessionTokenExpiresAt) {
      return false; // No expiry set, session is valid
    }
    try {
      const expiryTime = new Date(state.sessionTokenExpiresAt).getTime();
      return Date.now() >= expiryTime;
    } catch {
      return false; // Invalid timestamp format, treat as valid
    }
  },

  setOnboardingStatus(onboardingStatus: OnboardingStatus): void {
    setState({
      ...state,
      onboardingStatus,
      onboardingComplete: isCompleted(onboardingStatus),
    });
  },

  setOnboardingComplete(onboardingComplete: boolean): void {
    setState({
      ...state,
      onboardingStatus: toOnboardingStatus(onboardingComplete),
      onboardingComplete,
    });
  },

  clear(): void {
    setState({
      sessionToken: null,
      sessionTokenExpiresAt: null,
      onboardingStatus: 'NOT_STARTED',
      onboardingComplete: false,
    });
  },

  hasSession(): boolean {
    return Boolean(
      state.sessionToken
        && (state.sessionToken.startsWith(SESSION_TOKEN_PREFIX) || state.sessionToken.startsWith(LEGACY_SESSION_TOKEN_PREFIX)),
    );
  },

  purgeLegacyPersistentSessionArtifacts(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_COMPLETE_STORAGE_KEY);
    localStorage.removeItem(LEGACY_ONBOARDING_COMPLETE_STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_LEDGER_STORAGE_KEY);
    localStorage.removeItem(LEGACY_ONBOARDING_LEDGER_STORAGE_KEY);
  },
};
