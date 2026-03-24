import { HttpStatusCode, ServerResponse } from 'astra';

export interface OnboardingKpi {
  id: string;
  name: string;
  unit: string;
  target: string;
  threshold: string;
}

export interface OnboardingAgentKpiRecord {
  agentId: string;
  agent: string;
  role: string;
  kpis: OnboardingKpi[];
}

export interface OnboardingAgentStatus {
  id: string;
  name: string;
  role: string;
  status: 'QUEUED' | 'GENERATING' | 'DONE';
  kpiCount: number;
}

export interface OnboardingKpiPayload {
  generatedAt: string;
  statuses: OnboardingAgentStatus[];
  registry: OnboardingAgentKpiRecord[];
}

export interface OnboardingCommitPayload {
  kpiData: Record<string, string>;
  contextByStep: Record<string, Record<string, string>>;
  approvalByStep: Record<string, 'PENDING' | 'DRAFT' | 'APPROVED'>;
  agentMappings: Record<string, {
    skills: string[];
    protocols: string[];
    kpis: string[];
    workflows: string[];
  }>;
}

export interface OnboardingCommitResult {
  success: boolean;
  committedAt: string;
  ingestedVaultRecords: number;
  validationErrors?: string[];
  alignmentIssues?: Array<{ field: string; reason: string }>;
}

export interface OnboardingPhaseStage {
  stepId: string;
  status: 'PENDING' | 'DRAFT' | 'APPROVED';
  contextByKey: Record<string, string>;
  requiresReverification: boolean;
  updatedAt: string;
}

export interface OnboardingStageSnapshot {
  phases: Record<string, OnboardingPhaseStage>;
  currentStep: number | null;
  modelAccess: Record<string, unknown> | null;
}

export interface SaveOnboardingStagePayload {
  phases: Record<string, {
    status: 'PENDING' | 'DRAFT' | 'APPROVED';
    contextByKey: Record<string, string>;
    requiresReverification: boolean;
  }>;
  currentStep: number;
  modelAccess?: Record<string, unknown>;
}

export class OnboardingRepo {
  async getKpis(): Promise<ServerResponse<OnboardingKpiPayload>> {
    const payload = await window.api.operations.getOnboardingKpis();
    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Loaded',
      data: payload,
    } as ServerResponse<OnboardingKpiPayload>;
  }

  async generateKpis(): Promise<ServerResponse<OnboardingKpiPayload>> {
    const payload = await window.api.operations.generateOnboardingKpis();
    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Generated',
      data: payload,
    } as ServerResponse<OnboardingKpiPayload>;
  }

  async removeKpi(agentId: string, kpiId: string): Promise<ServerResponse<OnboardingKpiPayload>> {
    const payload = await window.api.operations.removeOnboardingKpi(agentId, kpiId);
    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Removed',
      data: payload,
    } as ServerResponse<OnboardingKpiPayload>;
  }

  async commitOnboarding(payload: OnboardingCommitPayload): Promise<ServerResponse<OnboardingCommitResult>> {
    const result = await window.api.operations.commitOnboarding(payload);
    return {
      isSuccess: result.success,
      isError: !result.success,
      status: HttpStatusCode.SUCCESS,
      statusMessage: result.success ? 'Committed' : 'Commit failed',
      data: result,
    } as ServerResponse<OnboardingCommitResult>;
  }

  async getOnboardingStageSnapshot(): Promise<ServerResponse<OnboardingStageSnapshot>> {
    const payload = await window.api.operations.getOnboardingStageSnapshot();
    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Loaded stage snapshot',
      data: payload,
    } as ServerResponse<OnboardingStageSnapshot>;
  }

  async saveOnboardingStageSnapshot(payload: SaveOnboardingStagePayload): Promise<ServerResponse<boolean>> {
    const result = await window.api.operations.saveOnboardingStageSnapshot(payload);
    return {
      isSuccess: result,
      isError: !result,
      status: HttpStatusCode.SUCCESS,
      statusMessage: result ? 'Saved stage snapshot' : 'Failed to save stage snapshot',
      data: result,
    } as ServerResponse<boolean>;
  }
}
