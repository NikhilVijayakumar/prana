import { useSyncExternalStore } from 'react';

interface VolatileSessionState {
  sessionToken: string | null;
  onboardingStatus: OnboardingStatus;
  onboardingComplete: boolean;
}

export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type ExperienceMode = 'PREVIEW' | 'ACTIVE';

const SESSION_TOKEN_PREFIX = 'dhi_session_';

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
    return Boolean(state.sessionToken && state.sessionToken.startsWith(SESSION_TOKEN_PREFIX));
  },

  purgeLegacyPersistentSessionArtifacts(): void {
    localStorage.removeItem('dhi_session');
    localStorage.removeItem('dhi_onboarding_complete');
    localStorage.removeItem('dhi_onboarding_commit_ledger_v1');
  },
};
