import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureGovernanceRepoReadyMock = vi.fn();
const getRuntimeIntegrationStatusMock = vi.fn();
const initializeVaultMock = vi.fn();
const initializeOnSplashMock = vi.fn();
const recoverPendingSyncTasksMock = vi.fn();
const cronInitializeMock = vi.fn();
const cronTickMock = vi.fn();
const cronGetTelemetryMock = vi.fn();
const cronUpsertJobMock = vi.fn();
const cronRegisterJobExecutorMock = vi.fn();
const syncHeartbeatSchedulesMock = vi.fn();
const ensureGoogleSyncSchedulerJobMock = vi.fn();

vi.mock('./governanceRepoService', () => ({
  ensureGovernanceRepoReady: ensureGovernanceRepoReadyMock,
  getGovernanceRepoPath: () => 'E:/Python/prana/.tmp-governance',
  getAppDataRoot: () => 'E:/Python/prana/.tmp-appdata',
}));

vi.mock('./runtimeConfigService', () => ({
  getRuntimeIntegrationStatus: getRuntimeIntegrationStatusMock,
}));

vi.mock('./vaultService', () => ({
  vaultService: {
    initializeVault: initializeVaultMock,
  },
}));

vi.mock('./syncProviderService', () => ({
  syncProviderService: {
    initializeOnSplash: initializeOnSplashMock,
  },
}));

vi.mock('./recoveryOrchestratorService', () => ({
  recoveryOrchestratorService: {
    recoverPendingSyncTasks: recoverPendingSyncTasksMock,
  },
}));

vi.mock('./cronSchedulerService', () => ({
  cronSchedulerService: {
    initialize: cronInitializeMock,
    tick: cronTickMock,
    getTelemetry: cronGetTelemetryMock,
    upsertJob: cronUpsertJobMock,
    registerJobExecutor: cronRegisterJobExecutorMock,
  },
}));

vi.mock('./emailOrchestratorService', () => ({
  emailOrchestratorService: {
    syncHeartbeatSchedules: syncHeartbeatSchedulesMock,
  },
}));

vi.mock('./googleBridgeService', () => ({
  googleBridgeService: {
    ensureSyncSchedulerJob: ensureGoogleSyncSchedulerJobMock,
  },
}));

describe('startupOrchestratorService', () => {
  beforeEach(() => {
    vi.resetModules();

    ensureGovernanceRepoReadyMock.mockReset();
    getRuntimeIntegrationStatusMock.mockReset();
    initializeVaultMock.mockReset();
    initializeOnSplashMock.mockReset();
    recoverPendingSyncTasksMock.mockReset();
    cronInitializeMock.mockReset();
    cronTickMock.mockReset();
    cronGetTelemetryMock.mockReset();
    cronUpsertJobMock.mockReset();
    cronRegisterJobExecutorMock.mockReset();
    syncHeartbeatSchedulesMock.mockReset();
    ensureGoogleSyncSchedulerJobMock.mockReset();

    getRuntimeIntegrationStatusMock.mockReturnValue({
      ready: true,
      summary: {
        total: 5,
        present: 5,
        missing: 0,
        invalid: 0,
      },
    });

    ensureGovernanceRepoReadyMock.mockResolvedValue({
      repoReady: true,
      sshVerified: true,
      sshMessage: '',
      clonedNow: false,
    });

    initializeVaultMock.mockResolvedValue(undefined);
    initializeOnSplashMock.mockResolvedValue({ skippedReason: null });
    recoverPendingSyncTasksMock.mockResolvedValue({ recoveredTasks: 0 });
    cronInitializeMock.mockResolvedValue(undefined);
    cronTickMock.mockResolvedValue(undefined);
    cronUpsertJobMock.mockResolvedValue(undefined);
    cronRegisterJobExecutorMock.mockResolvedValue(undefined);
    syncHeartbeatSchedulesMock.mockResolvedValue({ configuredJobs: ['job-email-1'], removedJobs: [] });
    ensureGoogleSyncSchedulerJobMock.mockResolvedValue({
      jobId: 'job-google-drive-sync',
      target: 'GOOGLE_DRIVE_SYNC',
      expression: '0 */12 * * *',
    });
    cronGetTelemetryMock.mockResolvedValue({
      schedulerActive: true,
      enabledJobs: 3,
      totalRuns: 0,
      failedRuns: 0,
      skippedOverlapRuns: 0,
      recovery: {
        recoveredInterruptedTasks: 0,
        missedJobsDetected: 0,
        missedJobsEnqueued: 0,
        duplicatePreventions: 0,
        processedTasks: 0,
        failedTasks: 0,
        completedAt: '2026-03-29T00:00:00.000Z',
      },
    });
  });

  it('blocks startup when integration contract fails', async () => {
    getRuntimeIntegrationStatusMock.mockReturnValue({
      ready: false,
      summary: {
        total: 5,
        present: 4,
        missing: 1,
        invalid: 0,
      },
    });

    const { startupOrchestratorService } = await import('./startupOrchestratorService');
    const report = await startupOrchestratorService.runStartupSequence();

    expect(report.overallStatus).toBe('BLOCKED');
    expect(report.stages.find((stage) => stage.id === 'integration')?.status).toBe('FAILED');
    expect(report.stages.find((stage) => stage.id === 'governance')?.status).toBe('SKIPPED');
    expect(ensureGovernanceRepoReadyMock).not.toHaveBeenCalled();
  });

  it('blocks startup when governance repo is not ready', async () => {
    ensureGovernanceRepoReadyMock.mockResolvedValue({
      repoReady: false,
      sshVerified: true,
      sshMessage: 'Governance repository not ready.',
      clonedNow: false,
    });

    const { startupOrchestratorService } = await import('./startupOrchestratorService');
    const report = await startupOrchestratorService.runStartupSequence();

    expect(report.overallStatus).toBe('BLOCKED');
    expect(report.stages.find((stage) => stage.id === 'governance')?.status).toBe('FAILED');
    expect(report.stages.find((stage) => stage.id === 'vault')?.status).toBe('SKIPPED');
    expect(initializeVaultMock).not.toHaveBeenCalled();
  });

  it('marks startup READY when all startup stages pass', async () => {
    recoverPendingSyncTasksMock.mockResolvedValue({ recoveredTasks: 4 });
    cronGetTelemetryMock.mockResolvedValue({
      schedulerActive: true,
      enabledJobs: 3,
      totalRuns: 2,
      failedRuns: 0,
      skippedOverlapRuns: 0,
      recovery: {
        recoveredInterruptedTasks: 2,
        missedJobsDetected: 2,
        missedJobsEnqueued: 2,
        duplicatePreventions: 0,
        processedTasks: 2,
        failedTasks: 0,
        completedAt: '2026-03-29T00:00:00.000Z',
      },
    });

    const { startupOrchestratorService } = await import('./startupOrchestratorService');
    const report = await startupOrchestratorService.runStartupSequence();

    expect(report.overallStatus).toBe('READY');
    expect(report.stages.every((stage) => stage.status === 'SUCCESS')).toBe(true);
    expect(report.stages.find((stage) => stage.id === 'cron-recovery')?.message).toContain('missedEnqueued=2');
    expect(report.stages.find((stage) => stage.id === 'cron-recovery')?.message).toContain('recoveredInterrupted=2');
  });

  it('marks startup DEGRADED when non-blocking cron recovery fails', async () => {
    cronTickMock.mockRejectedValue(new Error('Cron tick failed'));

    const { startupOrchestratorService } = await import('./startupOrchestratorService');
    const report = await startupOrchestratorService.runStartupSequence();

    expect(report.overallStatus).toBe('DEGRADED');
    expect(report.stages.find((stage) => stage.id === 'integration')?.status).toBe('SUCCESS');
    expect(report.stages.find((stage) => stage.id === 'governance')?.status).toBe('SUCCESS');
    expect(report.stages.find((stage) => stage.id === 'vault')?.status).toBe('SUCCESS');
    expect(report.stages.find((stage) => stage.id === 'cron-recovery')?.status).toBe('FAILED');
  });
});
