import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

export type CronRecoveryPolicy = 'SKIP' | 'RUN_ONCE' | 'CATCH_UP';

export interface CronJobRecord {
  id: string;
  name: string;
  expression: string;
  target: string;
  recoveryPolicy: CronRecoveryPolicy;
  enabled: boolean;
  retentionDays: number;
  maxRuntimeMs: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED_OVERLAP' | null;
}

export interface CronTelemetry {
  totalJobs: number;
  enabledJobs: number;
  runningJobs: number;
  totalRuns: number;
  failedRuns: number;
  skippedOverlapRuns: number;
  schedulerActive: boolean;
  lastTickAt: string | null;
  recovery: {
    recoveredInterruptedTasks: number;
    missedJobsDetected: number;
    missedJobsEnqueued: number;
    duplicatePreventions: number;
    processedTasks: number;
    failedTasks: number;
    completedAt: string | null;
  };
}

export interface CronProposalRecord {
  proposalId: string;
  jobId: string;
  name: string;
  expression: string;
  retentionDays: number;
  maxRuntimeMs: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  reviewNote: string | null;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export class CronManagementRepo {
  async listJobs(): Promise<CronJobRecord[]> {
    return safeIpcCall('cron.list', () => window.api.cron.list(), Array.isArray);
  }

  async upsertJob(payload: {
    id: string;
    name: string;
    expression: string;
    target: string;
    recoveryPolicy: CronRecoveryPolicy;
    enabled: boolean;
    retentionDays?: number;
    maxRuntimeMs?: number;
  }): Promise<CronJobRecord> {
    return safeIpcCall(
      'cron.upsert',
      () =>
        window.api.cron.upsert({
          ...payload,
        }),
      isObject,
    ) as Promise<CronJobRecord>;
  }

  async removeJob(id: string): Promise<boolean> {
    return safeIpcCall('cron.remove', () => window.api.cron.remove({ id }), (value) => typeof value === 'boolean');
  }

  async pauseJob(id: string): Promise<CronJobRecord | null> {
    return safeIpcCall('cron.pause', () => window.api.cron.pause({ id }));
  }

  async resumeJob(id: string): Promise<CronJobRecord | null> {
    return safeIpcCall('cron.resume', () => window.api.cron.resume({ id }));
  }

  async runNow(id: string): Promise<CronJobRecord | null> {
    return safeIpcCall('cron.runNow', () => window.api.cron.runNow({ id }));
  }

  async telemetry(): Promise<CronTelemetry> {
    return safeIpcCall('cron.telemetry', () => window.api.cron.telemetry(), isObject) as Promise<CronTelemetry>;
  }

  async listProposals(status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN'): Promise<CronProposalRecord[]> {
    return safeIpcCall(
      'operations.listCronProposals',
      () => window.api.operations.listCronProposals(status ? { status } : undefined),
      Array.isArray,
    );
  }

  async createProposal(payload: {
    id: string;
    name: string;
    expression: string;
    retentionDays?: number;
    maxRuntimeMs?: number;
  }): Promise<CronProposalRecord> {
    return safeIpcCall(
      'operations.createCronProposal',
      () => window.api.operations.createCronProposal(payload),
      isObject,
    ) as Promise<CronProposalRecord>;
  }

  async reviewProposal(payload: {
    proposalId: string;
    status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';
    reviewer: string;
    reviewNote?: string;
  }): Promise<{ success: boolean; updatedAt: string; referenceId?: string; validationErrors?: string[] }> {
    return safeIpcCall('operations.reviewCronProposal', () => window.api.operations.reviewCronProposal(payload), isObject) as Promise<{
      success: boolean;
      updatedAt: string;
      referenceId?: string;
      validationErrors?: string[];
    }>;
  }
}
