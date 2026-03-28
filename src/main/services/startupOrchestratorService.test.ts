import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureGovernanceRepoReadyMock = vi.fn();
const getRuntimeIntegrationStatusMock = vi.fn();
const initializeVaultMock = vi.fn();
const initializeOnSplashMock = vi.fn();
const recoverPendingSyncTasksMock = vi.fn();
const cronInitializeMock = vi.fn();
const cronTickMock = vi.fn();
const cronGetTelemetryMock = vi.fn();

vi.mock('./governanceRepoService', () => ({
  ensureGovernanceRepoReady: ensureGovernanceRepoReadyMock,
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
    cronGetTelemetryMock.mockResolvedValue({ schedulerActive: true, enabledJobs: 3 });
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

    const { startupOrchestratorService } = await import('./startupOrchestratorService');
    const report = await startupOrchestratorService.runStartupSequence();

    expect(report.overallStatus).toBe('READY');
    expect(report.stages.every((stage) => stage.status === 'SUCCESS')).toBe(true);
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
