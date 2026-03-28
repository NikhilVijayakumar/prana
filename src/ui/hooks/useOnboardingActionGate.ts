import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from 'astra';
import { useVolatileSessionStore } from 'prana/ui/state/volatileSessionStore';

export interface OnboardingActionGate {
  isBlocked: boolean;
  unmetPhaseTitles: string[];
  message: string;
}

interface OnboardingStageSnapshotResponse {
  phases?: Record<string, { status: 'PENDING' | 'DRAFT' | 'APPROVED' }>;
}

const PHASE_TITLE_KEY_BY_ID: Record<string, string> = {
  'company-core': 'onboarding.step1.title',
  'product-context': 'onboarding.step2.title',
  'global-assets': 'onboarding.step3.title',
  'global-guardrails': 'onboarding.step4.title',
  'agent-profile-persona': 'onboarding.step5.title',
  'agent-workflows': 'onboarding.step6.title',
  'infrastructure-finalization': 'onboarding.step7.title',
};

const toPhaseTitle = (phaseId: string, literal: Record<string, string>): string => {
  const literalKey = PHASE_TITLE_KEY_BY_ID[phaseId];
  if (!literalKey) {
    return phaseId;
  }

  return literal[literalKey] ?? phaseId;
};

export const useOnboardingActionGate = (requiredPhaseIds: string[]): OnboardingActionGate => {
  const session = useVolatileSessionStore();
  const { literal } = useLanguage();
  const [snapshot, setSnapshot] = useState<OnboardingStageSnapshotResponse | null>(null);

  useEffect(() => {
    if (session.onboardingStatus === 'COMPLETED') {
      setSnapshot(null);
      return;
    }

    let isMounted = true;

    const loadSnapshot = async (): Promise<void> => {
      try {
        const staged = await window.api.operations.getOnboardingStageSnapshot();
        if (isMounted) {
          setSnapshot((staged as OnboardingStageSnapshotResponse) ?? { phases: {} });
        }
      } catch {
        if (isMounted) {
          setSnapshot({ phases: {} });
        }
      }
    };

    void loadSnapshot();

    return () => {
      isMounted = false;
    };
  }, [session.onboardingStatus]);

  return useMemo(() => {
    if (session.onboardingStatus === 'COMPLETED') {
      return {
        isBlocked: false,
        unmetPhaseTitles: [],
        message: '',
      };
    }

    const phases = snapshot?.phases ?? {};
    const unmetPhaseIds = requiredPhaseIds.filter((phaseId) => phases[phaseId]?.status !== 'APPROVED');
    const unmetPhaseTitles = unmetPhaseIds.map((phaseId) => toPhaseTitle(phaseId, literal as Record<string, string>));

    if (unmetPhaseTitles.length === 0) {
      return {
        isBlocked: false,
        unmetPhaseTitles: [],
        message: '',
      };
    }

    const prefix = literal['preview.actionGate.blockedByPhases'] ?? 'Action is blocked until these onboarding phases are approved:';
    const message = `${prefix} ${unmetPhaseTitles.join(' | ')}`;

    return {
      isBlocked: true,
      unmetPhaseTitles,
      message,
    };
  }, [literal, requiredPhaseIds, session.onboardingStatus, snapshot]);
};
