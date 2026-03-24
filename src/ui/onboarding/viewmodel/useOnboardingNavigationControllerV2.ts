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

export interface NavigationState {
  currentStep: number;
  screenState: OnboardingScreenState;
  guardMessage: string;
  isNavigating: boolean;
  lastError: string | null;
}

/**
 * Enhanced navigation controller with proper async state management.
 * 
 * Key improvements:
 * - Explicit `isNavigating` flag prevents UI freeze perception
 * - Error recovery mechanism with lastError tracking
 * - Route stack support for better back navigation
 * - Validates guard conditions without blocking
 */
export const useOnboardingNavigationControllerV2 = (vaultBridge: OnboardingVaultBridge) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [screenState, setScreenState] = useState<OnboardingScreenState>('READY');
  const [guardMessage, setGuardMessage] = useState<string>('');
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [routeStack, setRouteStack] = useState<number[]>([0]); // Stack for back navigation

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

      try {
        // Async hydration doesn't block; it prepares state for the target step
        await vaultBridge.ensureHydrated(target.id, target.ownerAgentId);
      } catch (hydrateError) {
        const errorMsg = hydrateError instanceof Error ? hydrateError.message : 'Hydration failed';
        return {
          allowed: false,
          reason: `Failed to load step data: ${errorMsg}`,
          screenState: 'DATA_ACQUISITION',
        };
      }

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
      // Early exit: prevent duplicate navigation attempts
      if (isNavigating || targetIndex === currentStep) {
        return targetIndex === currentStep; // Return true if already there
      }

      setIsNavigating(true);
      setLastError(null);

      try {
        const current = steps[currentStep];

        // Check if leaving current step requires commitment
        if (current && targetIndex !== currentStep) {
          const currentStatus = vaultBridge.getScreenStatus(current.id);
          if (currentStatus.isDirtyDraft || !currentStatus.hasCommitted) {
            setScreenState('COMMIT_REQUIRED');
            setGuardMessage('Commit current screen draft to Vault before proceeding.');
            return false;
          }
        }

        // Evaluate target step guards (async, but doesn't freeze UI with isNavigating flag)
        const guard = await evaluateTransition(targetIndex);
        setScreenState(guard.screenState);
        setGuardMessage(guard.reason ?? '');

        if (!guard.allowed) {
          return false;
        }

        // Update state atomically
        setCurrentStep(targetIndex);
        setRouteStack((prev) => {
          // Prevent duplicate entries in stack
          const lastInStack = prev[prev.length - 1];
          if (lastInStack === targetIndex) {
            return prev;
          }
          return [...prev, targetIndex];
        });

        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Navigation failed';
        setLastError(errorMsg);
        setScreenState('DATA_ACQUISITION');
        setGuardMessage(`Navigation error: ${errorMsg}`);
        return false;
      } finally {
        setIsNavigating(false);
      }
    },
    [currentStep, evaluateTransition, isNavigating, steps, vaultBridge],
  );

  const next = useCallback(
    async (): Promise<boolean> => {
      if (currentStep >= steps.length - 1 || isNavigating) {
        return false;
      }
      return navigateTo(currentStep + 1);
    },
    [currentStep, navigateTo, steps.length, isNavigating],
  );

  const back = useCallback(
    async (): Promise<boolean> => {
      // Always allow back navigation (no guards on backtracking)
      if (currentStep <= 0 || isNavigating) {
        return false;
      }

      setIsNavigating(true);
      try {
        const newIndex = currentStep - 1;
        setCurrentStep(newIndex);
        
        // Pop from route stack
        setRouteStack((prev) => {
          const next = [...prev];
          if (next.length > 1) {
            next.pop();
          }
          return next;
        });

        // Reset guard message when going back
        setScreenState('READY');
        setGuardMessage('');
        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Back navigation failed';
        setLastError(errorMsg);
        return false;
      } finally {
        setIsNavigating(false);
      }
    },
    [currentStep, isNavigating],
  );

  return {
    currentStep,
    totalSteps: steps.length,
    screenState,
    guardMessage,
    isNavigating,
    lastError,
    currentStepDefinition: steps[currentStep],
    routeStack,
    steps,
    next,
    back,
    navigateTo,
  };
};
