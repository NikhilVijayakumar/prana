import { useCallback, useMemo, useState } from 'react';

export type OnboardingScreenState =
  | 'READY'
  | 'DATA_ACQUISITION'
  | 'DEPENDENCY_BLOCKED'
  | 'COMMIT_REQUIRED'
  | 'SYNC_CONFLICT';

export interface OnboardingStepDefinition {
  index: number;
  id: string;
  ownerAgentId: string;
  requiredFrom: string[];
}

export interface NavigationGuardResult {
  allowed: boolean;
  reason?: string;
  screenState: OnboardingScreenState;
}

export interface VaultScreenStatus {
  hasCommitted: boolean;
  isDirtyDraft: boolean;
  hasConflict: boolean;
}

export interface OnboardingVaultBridge {
  getScreenStatus: (stepId: string) => VaultScreenStatus;
  hasDependenciesCommitted: (requiredFrom: string[]) => boolean;
  ensureHydrated: (stepId: string, ownerAgentId: string) => Promise<void>;
}

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  { index: 0, id: 'company-profile', ownerAgentId: 'mira', requiredFrom: [] },
  { index: 1, id: 'product-tech', ownerAgentId: 'julia', requiredFrom: ['company-profile'] },
  { index: 2, id: 'financial', ownerAgentId: 'nora', requiredFrom: ['company-profile'] },
  { index: 3, id: 'operations', ownerAgentId: 'elina', requiredFrom: ['company-profile'] },
  { index: 4, id: 'goals-strategy', ownerAgentId: 'arya', requiredFrom: ['financial', 'operations'] },
  { index: 5, id: 'kpi-generation', ownerAgentId: 'mira', requiredFrom: ['goals-strategy'] },
  { index: 6, id: 'kpi-review', ownerAgentId: 'mira', requiredFrom: ['kpi-generation'] },
];

export const useOnboardingNavigationController = (vaultBridge: OnboardingVaultBridge) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [screenState, setScreenState] = useState<OnboardingScreenState>('READY');
  const [guardMessage, setGuardMessage] = useState<string>('');

  const steps = useMemo(() => ONBOARDING_STEPS, []);

  const evaluateTransition = useCallback(
    async (targetIndex: number): Promise<NavigationGuardResult> => {
      const target = steps[targetIndex];
      if (!target) {
        return {
          allowed: false,
          reason: 'Unknown onboarding step.',
          screenState: 'DEPENDENCY_BLOCKED',
        };
      }

      await vaultBridge.ensureHydrated(target.id, target.ownerAgentId);

      const targetStatus = vaultBridge.getScreenStatus(target.id);

      if (targetStatus.hasConflict) {
        return {
          allowed: false,
          reason: 'Vault conflict detected. Resolve sync before continuing.',
          screenState: 'SYNC_CONFLICT',
        };
      }

      if (target.requiredFrom.length > 0 && !vaultBridge.hasDependenciesCommitted(target.requiredFrom)) {
        return {
          allowed: false,
          reason: 'This step is blocked until dependency screens are committed.',
          screenState: 'DEPENDENCY_BLOCKED',
        };
      }

      if (!targetStatus.hasCommitted) {
        return {
          allowed: true,
          reason: 'Data acquisition required for this screen owner.',
          screenState: 'DATA_ACQUISITION',
        };
      }

      return {
        allowed: true,
        screenState: 'READY',
      };
    },
    [steps, vaultBridge],
  );

  const navigateTo = useCallback(
    async (targetIndex: number): Promise<boolean> => {
      const current = steps[currentStep];
      if (current && targetIndex !== currentStep) {
        const currentStatus = vaultBridge.getScreenStatus(current.id);
        if (currentStatus.isDirtyDraft || !currentStatus.hasCommitted) {
          setScreenState('COMMIT_REQUIRED');
          setGuardMessage('Commit current screen draft to Vault before proceeding.');
          return false;
        }
      }

      const guard = await evaluateTransition(targetIndex);
      setScreenState(guard.screenState);
      setGuardMessage(guard.reason ?? '');

      if (!guard.allowed) {
        return false;
      }

      setCurrentStep(targetIndex);
      return true;
    },
    [currentStep, evaluateTransition, steps, vaultBridge],
  );

  const next = useCallback(async (): Promise<boolean> => {
    if (currentStep >= steps.length - 1) {
      return false;
    }
    return navigateTo(currentStep + 1);
  }, [currentStep, navigateTo, steps.length]);

  const back = useCallback(async (): Promise<boolean> => {
    if (currentStep <= 0) {
      return false;
    }
    return navigateTo(currentStep - 1);
  }, [currentStep, navigateTo]);

  return {
    currentStep,
    totalSteps: steps.length,
    screenState,
    guardMessage,
    currentStepDefinition: steps[currentStep],
    steps,
    next,
    back,
    navigateTo,
  };
};
