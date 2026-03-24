/**
 * useOnboardingPhaseController
 * Master state management hook for the 3-Phase Onboarding system
 * Orchestrates Phase 1, Phase 2, and Phase 3 with gatekeeper logic
 */

import { useCallback, useState } from 'react';
import {
  OnboardingState,
  Phase1DraftState,
  Phase2DraftState,
  Phase3DraftState,
  CompanyKpiRegistry,
  LocalModelAccessConfig,
} from '../domain/onboarding.types';
import { IOnboardingRepository } from '../repo/OnboardingRepository';

interface UseOnboardingPhaseControllerProps {
  repository: IOnboardingRepository;
}

const initialPhase1: Phase1DraftState = {
  employees: [],
  selectedEmployeeId: undefined,
  isDirty: false,
  validationErrors: {},
};

const initialPhase2: Phase2DraftState = {
  templateSelected: undefined,
  companyName: undefined,
  kpis: [],
  isDirty: false,
  validationErrors: {},
};

const initialPhase3: Phase3DraftState = {
  primaryProvider: 'lmstudio',
  providers: {
    lmstudio: {
      enabled: true,
      endpoint: 'http://localhost:1234/v1',
      model: 'local-model',
      api_key: '',
    },
    openrouter: {
      enabled: false,
      endpoint: 'https://openrouter.ai/api/v1',
      model: 'anthropic/claude-3-sonnet',
      api_key: '',
    },
    gemini: {
      enabled: false,
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      model: 'gemini-2.0-flash',
      api_key: '',
    },
  },
  executionPolicy: {
    timeout_seconds: 60,
    max_retries: 3,
    cache_responses: true,
  },
  isDirty: false,
  validationErrors: {},
};

/**
 * Main hook: useOnboardingPhaseController
 * Manages all three phases of onboarding
 */
export function useOnboardingPhaseController({
  repository,
}: UseOnboardingPhaseControllerProps): OnboardingState {
  // Phase tracking
  const [phase1, setPhase1] = useState<OnboardingState['phase1']>({
    status: 'not-started',
    draft: initialPhase1,
  });

  const [phase2, setPhase2] = useState<OnboardingState['phase2']>({
    status: 'locked', // Phase 2 starts locked until Phase 1 commits
    draft: initialPhase2,
  });

  const [phase3, setPhase3] = useState<OnboardingState['phase3']>({
    status: 'locked', // Phase 3 starts locked until Phase 2 commits
    draft: initialPhase3,
  });

  const [currentPhase, setCurrentPhase] = useState<1 | 2 | 3>(1);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [commitError, setCommitError] = useState<string>();
  const [isCommitting, setIsCommitting] = useState(false);

  /**
   * Phase 1: Update draft
   */
  const updatePhase1Draft = useCallback(
    (draft: Partial<Phase1DraftState>) => {
      setPhase1((prev) => ({
        ...prev,
        draft: { ...prev.draft, ...draft, isDirty: true },
      }));
      setCommitError(undefined);
    },
    []
  );

  /**
   * Phase 2: Update draft
   */
  const updatePhase2Draft = useCallback(
    (draft: Partial<Phase2DraftState>) => {
      setPhase2((prev) => ({
        ...prev,
        draft: { ...prev.draft, ...draft, isDirty: true },
      }));
      setCommitError(undefined);
    },
    []
  );

  /**
   * Phase 3: Update draft
   */
  const updatePhase3Draft = useCallback(
    (draft: Partial<Phase3DraftState>) => {
      setPhase3((prev) => ({
        ...prev,
        draft: { ...prev.draft, ...draft, isDirty: true },
      }));
      setCommitError(undefined);
    },
    []
  );

  /**
   * Validation: Phase 1
   */
  const validatePhase1 = (): boolean => {
    const errors: Record<string, string[]> = {};

    // Validate that all 10 employees are configured
    if (phase1.draft.employees.length < 10) {
      errors['employees'] = ['All 10 Virtual Employees must be configured'];
    }

    // Validate each employee
    phase1.draft.employees.forEach((emp, idx) => {
      if (!emp.name || emp.name.trim() === '') {
        errors[`employees.${idx}.name`] = ['Name is required'];
      }
      if (!emp.in_depth_goal || emp.in_depth_goal.trim() === '') {
        errors[`employees.${idx}.goal`] = ['Goal is required'];
      }
      if (!emp.in_depth_backstory || emp.in_depth_backstory.trim() === '') {
        errors[`employees.${idx}.backstory`] = ['Backstory is required'];
      }
      if (!emp.skills || emp.skills.length === 0) {
        errors[`employees.${idx}.skills`] = ['At least one skill must be assigned'];
      }
    });

    if (Object.keys(errors).length > 0) {
      setPhase1((prev) => ({
        ...prev,
        draft: { ...prev.draft, validationErrors: errors },
      }));
      return false;
    }

    return true;
  };

  /**
   * Validation: Phase 2
   */
  const validatePhase2 = (): boolean => {
    const errors: Record<string, string[]> = {};

    if (!phase2.draft.companyName || phase2.draft.companyName.trim() === '') {
      errors['companyName'] = ['Company name is required'];
    }

    if (phase2.draft.kpis.length === 0) {
      errors['kpis'] = ['At least one KPI must be defined'];
    }

    phase2.draft.kpis.forEach((kpi, idx) => {
      if (!kpi.name || kpi.name.trim() === '') {
        errors[`kpis.${idx}.name`] = ['KPI name is required'];
      }
      if (kpi.target <= 0) {
        errors[`kpis.${idx}.target`] = ['Target must be greater than 0'];
      }
      if (kpi.alert_threshold <= 0) {
        errors[`kpis.${idx}.alertThreshold`] = ['Alert threshold must be greater than 0'];
      }
    });

    if (Object.keys(errors).length > 0) {
      setPhase2((prev) => ({
        ...prev,
        draft: { ...prev.draft, validationErrors: errors },
      }));
      return false;
    }

    return true;
  };

  /**
   * Validation: Phase 3
   */
  const validatePhase3 = (): boolean => {
    const errors: Record<string, string[]> = {};
    const providers = phase3.draft.providers;

    // At least one provider must be enabled
    const anyEnabled = Object.values(providers).some((p) => p.enabled);
    if (!anyEnabled) {
      errors['providers'] = ['At least one model provider must be enabled'];
    }

    // Validate enabled providers
    Object.entries(providers).forEach(([providerId, config]) => {
      if (config.enabled) {
        if (!config.endpoint || config.endpoint.trim() === '') {
          errors[`providers.${providerId}.endpoint`] = ['Endpoint is required'];
        }
        if (!config.model || config.model.trim() === '') {
          errors[`providers.${providerId}.model`] = ['Model name is required'];
        }
        if (providerId !== 'lmstudio' && (!config.api_key || config.api_key.trim() === '')) {
          errors[`providers.${providerId}.apiKey`] = ['API Key is required'];
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setPhase3((prev) => ({
        ...prev,
        draft: { ...prev.draft, validationErrors: errors },
      }));
      return false;
    }

    return true;
  };

  /**
   * Phase 1: Commit to Git
   */
  const commitPhase1 = useCallback(async () => {
    if (!validatePhase1()) {
      setCommitError('Validation failed. Please check required fields.');
      return;
    }

    setIsCommitting(true);
    setCommitError(undefined);

    try {
      // Save Phase 1 profiles
      const saveResult = await repository.savePhase1Profiles(phase1.draft.employees);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save Phase 1 profiles');
      }

      // Commit to Git
      const gitResult = await repository.commitPhase1ToGit(
        'Onboarding Phase 1: Virtual Employee Profiles'
      );
      if (!gitResult.success) {
        throw new Error(gitResult.error || 'Failed to commit Phase 1 to Git');
      }

      // Update state
      setPhase1((prev) => ({
        ...prev,
        status: 'committed',
        draft: { ...prev.draft, isDirty: false, validationErrors: {} },
      }));

      // Unlock Phase 2
      setPhase2((prev) => ({
        ...prev,
        status: 'not-started',
      }));

      setCurrentPhase(2);
    } catch (error) {
      setCommitError(String(error));
      console.error('[OnboardingController] Phase 1 commit failed:', error);
    } finally {
      setIsCommitting(false);
    }
  }, [phase1.draft.employees, repository]);

  /**
   * Phase 2: Commit to Git
   */
  const commitPhase2 = useCallback(async () => {
    if (!validatePhase2()) {
      setCommitError('Validation failed. Please check required fields.');
      return;
    }

    setIsCommitting(true);
    setCommitError(undefined);

    try {
      const kpiRegistry: CompanyKpiRegistry = {
        company_name: phase2.draft.companyName || 'Company',
        kpi_version: '1.0',
        created_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        kpis: phase2.draft.kpis,
      };

      const saveResult = await repository.savePhase2Kpis(kpiRegistry);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save Phase 2 KPIs');
      }

      // Commit to Git
      const gitResult = await repository.commitPhase2ToGit(
        'Onboarding Phase 2: Company KPI Configuration'
      );
      if (!gitResult.success) {
        throw new Error(gitResult.error || 'Failed to commit Phase 2 to Git');
      }

      setPhase2((prev) => ({
        ...prev,
        status: 'committed',
        draft: { ...prev.draft, isDirty: false, validationErrors: {} },
      }));

      // Unlock Phase 3
      setPhase3((prev) => ({
        ...prev,
        status: 'not-started',
      }));

      setCurrentPhase(3);
    } catch (error) {
      setCommitError(String(error));
      console.error('[OnboardingController] Phase 2 commit failed:', error);
    } finally {
      setIsCommitting(false);
    }
  }, [phase2.draft, repository]);

  /**
   * Phase 3: Commit (NOT to Git, to local storage only)
   */
  const commitPhase3 = useCallback(async () => {
    if (!validatePhase3()) {
      setCommitError('Validation failed. Please check required fields.');
      return;
    }

    setIsCommitting(true);
    setCommitError(undefined);

    try {
      const modelConfig: LocalModelAccessConfig = {
        model_version: '1.0',
        created_at: new Date().toISOString(),
        primary_provider: phase3.draft.primaryProvider,
        providers: phase3.draft.providers,
        execution_policy: phase3.draft.executionPolicy,
      };

      const saveResult = await repository.savePhase3ModelConfig(modelConfig);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save Phase 3 model config');
      }

      // NOTE: Phase 3 is NOT committed to Git (saved locally only)

      setPhase3((prev) => ({
        ...prev,
        status: 'committed',
        draft: { ...prev.draft, isDirty: false, validationErrors: {} },
      }));
    } catch (error) {
      setCommitError(String(error));
      console.error('[OnboardingController] Phase 3 commit failed:', error);
    } finally {
      setIsCommitting(false);
    }
  }, [phase3.draft, repository]);

  /**
   * Finalize Onboarding: Mark as complete
   */
  const finalizeOnboarding = useCallback(async () => {
    if (
      phase1.status !== 'committed' ||
      phase2.status !== 'committed' ||
      phase3.status !== 'committed'
    ) {
      setCommitError('All phases must be committed before finalizing.');
      return;
    }

    setIsOnboardingComplete(true);
  }, [phase1.status, phase2.status, phase3.status]);

  /**
   * Reset Onboarding (for testing/recovery)
   */
  const resetOnboarding = useCallback(() => {
    setPhase1({ status: 'not-started', draft: initialPhase1 });
    setPhase2({ status: 'locked', draft: initialPhase2 });
    setPhase3({ status: 'locked', draft: initialPhase3 });
    setCurrentPhase(1);
    setIsOnboardingComplete(false);
    setCommitError(undefined);
  }, []);

  return {
    phase1,
    phase2,
    phase3,
    isOnboardingComplete,
    currentPhase,
    commitError,
    isCommitting,
    updatePhase1Draft,
    updatePhase2Draft,
    updatePhase3Draft,
    commitPhase1,
    commitPhase2,
    commitPhase3,
    finalizeOnboarding,
    resetOnboarding,
  };
}
