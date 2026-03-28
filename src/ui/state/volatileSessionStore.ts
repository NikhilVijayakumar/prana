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
  onboardingStatus: OnboardingStatus;
  onboardingComplete: boolean;
}

export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type ExperienceMode = 'PREVIEW' | 'ACTIVE';

let state: VolatileSessionState = {
  sessionToken: null,
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

  setSessionToken(sessionToken: string): void {
    setState({
      ...state,
      sessionToken,
    });
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
