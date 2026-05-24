import { onboardingStageStoreService } from './onboardingStageStoreService';
import { auditLogService } from './auditLogService';
import type { OnboardingStageSnapshot, OnboardingPhaseStageRecord } from './onboardingStageStoreService';

export const CORE_STAGES = [
  'INTELLIGENCE_SETUP',
  'CONNECTION_SETUP',
  'GOVERNANCE_SETUP',
  'INTEGRITY_CHECK',
] as const;

export type CoreStageId = typeof CORE_STAGES[number];

export type FlowStage = 'welcome' | 'steps' | 'consent' | 'review' | 'completion';

export type CoreStageStatus = 'LOCKED' | 'ACTIVE' | 'VALIDATING' | 'VALID' | 'FAILED';

export interface ConsentState {
  dataHandling: boolean;
  runtimePolicy: boolean;
  externalChannels: boolean;
}

export interface OrchestratorMeta {
  flowStage: FlowStage;
  activeCoreStage: CoreStageId | null;
  consent: ConsentState;
  lastCheckpointAt: string;
}

export interface AdvanceResult {
  ok: boolean;
  error?: string;
  snapshot?: OnboardingStageSnapshot;
}

const FLOW_ORDER: FlowStage[] = ['welcome', 'steps', 'consent', 'review', 'completion'];

const AUDIT_CATEGORY = 'ONBOARDING_ORCHESTRATOR';

const nowIso = (): string => new Date().toISOString();

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

const isFlowTransitionValid = (current: FlowStage, next: FlowStage): boolean => {
  const curIdx = FLOW_ORDER.indexOf(current);
  const nextIdx = FLOW_ORDER.indexOf(next);
  return nextIdx === curIdx + 1;
};

const validateCoreStageTransition = (
  currentRecord: OnboardingPhaseStageRecord | undefined,
  targetStatus: CoreStageStatus,
): string | null => {
  const order: CoreStageStatus[] = ['LOCKED', 'ACTIVE', 'VALIDATING', 'VALID'];
  if (targetStatus === 'FAILED') {
    if (currentRecord?.status !== 'VALIDATING') {
      return 'Can only FAIL from VALIDATING';
    }
    return null;
  }

  const currentStatus = currentRecord?.status ?? 'LOCKED';
  const curIdx = order.indexOf(currentStatus as CoreStageStatus);
  const targetIdx = order.indexOf(targetStatus);

  if (targetIdx === -1) {
    return `Unknown target status: ${targetStatus}`;
  }

  if (targetIdx !== curIdx + 1) {
    return `Cannot transition from ${currentStatus} to ${targetStatus} — must advance one step at a time`;
  }

  return null;
};

const readOrchestratorMeta = (
  snapshot: OnboardingStageSnapshot,
): OrchestratorMeta => {
  const meta = snapshot.meta;
  return {
    flowStage: meta?.stage ?? 'welcome',
    activeCoreStage: snapshot.currentStep !== null
      ? (CORE_STAGES[snapshot.currentStep] ?? null)
      : null,
    consent: meta?.consent ?? { dataHandling: false, runtimePolicy: false, externalChannels: false },
    lastCheckpointAt: meta?.lastCheckpointAt ?? nowIso(),
  };
};

const buildSnapshotPayload = (
  coreStageStatuses: Record<string, OnboardingPhaseStageRecord>,
  currentStep: number | null,
  meta: OrchestratorMeta,
): Parameters<typeof onboardingStageStoreService.saveSnapshot>[0] => {
  const phases: Record<string, {
    status: 'PENDING' | 'DRAFT' | 'APPROVED';
    contextByKey: Record<string, string>;
    requiresReverification: boolean;
  }> = {};

  for (const [stepId, record] of Object.entries(coreStageStatuses)) {
    phases[stepId] = {
      status: record.status === 'APPROVED' ? 'APPROVED' : record.status === 'DRAFT' ? 'DRAFT' : 'PENDING',
      contextByKey: record.contextByKey,
      requiresReverification: record.requiresReverification,
    };
  }

  return {
    phases,
    currentStep: currentStep ?? -1,
    meta: {
      stage: meta.flowStage,
      consent: meta.consent,
      lastCheckpointAt: meta.lastCheckpointAt,
    },
  };
};

export const onboardingOrchestratorService = {
  async getState(): Promise<{
    flowStage: FlowStage;
    coreStages: Record<string, OnboardingPhaseStageRecord>;
    activeCoreStage: CoreStageId | null;
    consent: ConsentState;
    onboardingComplete: boolean;
  }> {
    const snapshot = await onboardingStageStoreService.getSnapshot();
    const meta = readOrchestratorMeta(snapshot);
    return {
      flowStage: meta.flowStage,
      coreStages: snapshot.phases,
      activeCoreStage: meta.activeCoreStage,
      consent: meta.consent,
      onboardingComplete: meta.flowStage === 'completion',
    };
  },

  async advanceFlow(target: FlowStage): Promise<AdvanceResult> {
    if (!FLOW_ORDER.includes(target)) {
      return { ok: false, error: `Unknown flow stage: ${target}` };
    }

    const snapshot = await onboardingStageStoreService.getSnapshot();
    const meta = readOrchestratorMeta(snapshot);

    if (meta.flowStage === 'completion') {
      return { ok: false, error: 'Onboarding already complete' };
    }

    if (!isFlowTransitionValid(meta.flowStage, target)) {
      return {
        ok: false,
        error: `Cannot transition from ${meta.flowStage} to ${target} — flow must advance sequentially`,
      };
    }

    const updatedMeta: OrchestratorMeta = {
      ...meta,
      flowStage: target,
      lastCheckpointAt: nowIso(),
    };

    if (target === 'steps') {
      updatedMeta.activeCoreStage = CORE_STAGES[0];
    }

    if (target === 'completion') {
      const allValid = CORE_STAGES.every(
        (stageId) => snapshot.phases[stageId]?.status === 'APPROVED',
      );
      if (!allValid) {
        return { ok: false, error: 'All core stages must be VALID before completion' };
      }
    }

    const payload = buildSnapshotPayload(snapshot.phases, snapshot.currentStep, updatedMeta);
    await onboardingStageStoreService.saveSnapshot(payload);

    await auditLogService.appendTransaction(
      `ONBOARDING_FLOW_ADVANCE` as any,
      {
        fromStage: meta.flowStage,
        toStage: target,
        correlationId: `onb-flow-${Date.now()}`,
      },
    );

    const newSnapshot = await onboardingStageStoreService.getSnapshot();
    return { ok: true, snapshot: newSnapshot };
  },

  async advanceCoreStage(stageId: CoreStageId, targetStatus: CoreStageStatus, context?: Record<string, string>): Promise<AdvanceResult> {
    if (!CORE_STAGES.includes(stageId as any)) {
      return { ok: false, error: `Unknown core stage: ${stageId}` };
    }

    const snapshot = await onboardingStageStoreService.getSnapshot();
    const meta = readOrchestratorMeta(snapshot);

    if (meta.flowStage !== 'steps') {
      return { ok: false, error: 'Core stages can only be advanced during the steps flow stage' };
    }

    if (meta.activeCoreStage !== stageId) {
      return { ok: false, error: `Stage ${stageId} is not the active stage (active: ${meta.activeCoreStage})` };
    }

    const currentRecord = snapshot.phases[stageId];
    const transitionError = validateCoreStageTransition(currentRecord, targetStatus);
    if (transitionError) {
      return { ok: false, error: transitionError };
    }

    const statusMap: Record<CoreStageStatus, 'PENDING' | 'DRAFT' | 'APPROVED'> = {
      LOCKED: 'PENDING',
      ACTIVE: 'PENDING',
      VALIDATING: 'DRAFT',
      VALID: 'APPROVED',
      FAILED: 'PENDING',
    };

    const updatedPhases = { ...snapshot.phases };
    const existingContext = currentRecord?.contextByKey ?? {};
    updatedPhases[stageId] = {
      stepId: stageId,
      status: statusMap[targetStatus],
      contextByKey: context ? { ...existingContext, ...context } : existingContext,
      requiresReverification: targetStatus === 'FAILED',
      updatedAt: nowIso(),
    };

    let nextStep: number | null = snapshot.currentStep;
    if (targetStatus === 'VALID' && meta.activeCoreStage) {
      const currentIdx = CORE_STAGES.indexOf(meta.activeCoreStage);
      if (currentIdx < CORE_STAGES.length - 1) {
        nextStep = currentIdx + 1;
      }
    }

    const updatedMeta: OrchestratorMeta = {
      ...meta,
      lastCheckpointAt: nowIso(),
    };

    const payload = buildSnapshotPayload(updatedPhases, nextStep, updatedMeta);
    await onboardingStageStoreService.saveSnapshot(payload);

    await auditLogService.appendTransaction(
      `ONBOARDING_CORE_ADVANCE` as any,
      {
        stageId,
        fromStatus: currentRecord?.status ?? 'LOCKED',
        toStatus: targetStatus,
        correlationId: `onb-core-${Date.now()}`,
      },
    );

    const newSnapshot = await onboardingStageStoreService.getSnapshot();
    return { ok: true, snapshot: newSnapshot };
  },

  async setConsent(consent: Partial<ConsentState>): Promise<AdvanceResult> {
    const snapshot = await onboardingStageStoreService.getSnapshot();
    const meta = readOrchestratorMeta(snapshot);

    if (meta.flowStage !== 'consent') {
      return { ok: false, error: 'Consent can only be set during the consent flow stage' };
    }

    const updatedConsent: ConsentState = {
      ...meta.consent,
      ...consent,
    };

    const updatedMeta: OrchestratorMeta = {
      ...meta,
      consent: updatedConsent,
      lastCheckpointAt: nowIso(),
    };

    const payload = buildSnapshotPayload(snapshot.phases, snapshot.currentStep, updatedMeta);
    await onboardingStageStoreService.saveSnapshot(payload);

    await auditLogService.appendTransaction(
      `ONBOARDING_CONSENT_SET` as any,
      {
        dataHandling: updatedConsent.dataHandling,
        runtimePolicy: updatedConsent.runtimePolicy,
        externalChannels: updatedConsent.externalChannels,
        correlationId: `onb-consent-${Date.now()}`,
      },
    );

    const newSnapshot = await onboardingStageStoreService.getSnapshot();
    return { ok: true, snapshot: newSnapshot };
  },

  async requireReReverification(stageId: CoreStageId): Promise<AdvanceResult> {
    if (!CORE_STAGES.includes(stageId as any)) {
      return { ok: false, error: `Unknown core stage: ${stageId}` };
    }

    const snapshot = await onboardingStageStoreService.getSnapshot();
    const currentRecord = snapshot.phases[stageId];
    if (!currentRecord || currentRecord.status !== 'APPROVED') {
      return { ok: false, error: `Stage ${stageId} is not currently approved` };
    }

    const updatedPhases = { ...snapshot.phases };
    updatedPhases[stageId] = {
      ...currentRecord,
      status: 'PENDING',
      requiresReverification: true,
      updatedAt: nowIso(),
    };

    const meta = readOrchestratorMeta(snapshot);
    const payload = buildSnapshotPayload(updatedPhases, snapshot.currentStep, meta);
    await onboardingStageStoreService.saveSnapshot(payload);

    await auditLogService.appendTransaction(
      `ONBOARDING_REVERIFY_REQUIRED` as any,
      {
        stageId,
        correlationId: `onb-reverify-${Date.now()}`,
      },
    );

    const newSnapshot = await onboardingStageStoreService.getSnapshot();
    return { ok: true, snapshot: newSnapshot };
  },

  async reset(): Promise<AdvanceResult> {
    await onboardingStageStoreService.clearSnapshot();

    await auditLogService.appendTransaction(
      `ONBOARDING_RESET` as any,
      {
        correlationId: `onb-reset-${Date.now()}`,
      },
    );

    return { ok: true };
  },

  getFlowProgress(snapshot: OnboardingStageSnapshot): {
    flowStage: FlowStage;
    currentStep: number | null;
    totalSteps: number;
    completedSteps: number;
    progressPercent: number;
  } {
    const meta = readOrchestratorMeta(snapshot);
    const totalSteps = CORE_STAGES.length;
    const completedSteps = CORE_STAGES.filter(
      (stageId) => snapshot.phases[stageId]?.status === 'APPROVED',
    ).length;

    let flowFactor = FLOW_ORDER.indexOf(meta.flowStage) / (FLOW_ORDER.length - 1);
    const stageFactor = totalSteps > 0 ? completedSteps / totalSteps : 0;

    const progressPercent = Math.round(
      (flowFactor * 0.5 + stageFactor * 0.5) * 100,
    );

    return {
      flowStage: meta.flowStage,
      currentStep: snapshot.currentStep,
      totalSteps,
      completedSteps,
      progressPercent: Math.min(100, Math.max(0, progressPercent)),
    };
  },
};
