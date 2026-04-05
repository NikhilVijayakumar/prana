import { ensureGovernanceRepoReady } from './governanceRepoService';
import { getRuntimeIntegrationStatus } from './runtimeConfigService';
import { vaultService } from './vaultService';
import { syncProviderService } from './syncProviderService';
import { recoveryOrchestratorService } from './recoveryOrchestratorService';
import { cronSchedulerService } from './cronSchedulerService';
import { hookSystemService } from './hookSystemService';
import { memoryIndexService } from './memoryIndexService';
import { emailOrchestratorService } from './emailOrchestratorService';
import { googleBridgeService } from './googleBridgeService';
import { driveControllerService, VirtualDriveDiagnosticsSnapshot } from './driveControllerService';
import { notificationCentreService } from './notificationCentreService';
import { vaidyarService } from './vaidyarService';

export type StartupStageId =
  | 'integration'
  | 'governance'
  | 'vault'
  | 'sync-recovery'
  | 'cron-recovery';

export type StartupStageStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface StartupStageReport {
  id: StartupStageId;
  label: string;
  status: StartupStageStatus;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface StartupStatusReport {
  startedAt: string;
  finishedAt: string | null;
  overallStatus: 'READY' | 'DEGRADED' | 'BLOCKED';
  stages: StartupStageReport[];
  diagnostics?: {
    virtualDrives: VirtualDriveDiagnosticsSnapshot;
  };
}

const nowIso = (): string => new Date().toISOString();

const createInitialStages = (): StartupStageReport[] => [
  {
    id: 'integration',
    label: 'Integration Contract Check',
    status: 'PENDING',
    message: 'Waiting...',
    startedAt: null,
    finishedAt: null,
  },
  {
    id: 'governance',
    label: 'Governance Repo Readiness',
    status: 'PENDING',
    message: 'Waiting...',
    startedAt: null,
    finishedAt: null,
  },
  {
    id: 'vault',
    label: 'Vault Initialization and Pull',
    status: 'PENDING',
    message: 'Waiting...',
    startedAt: null,
    finishedAt: null,
  },
  {
    id: 'sync-recovery',
    label: 'Sync Queue Recovery',
    status: 'PENDING',
    message: 'Waiting...',
    startedAt: null,
    finishedAt: null,
  },
  {
    id: 'cron-recovery',
    label: 'Cron Catch-up Recovery',
    status: 'PENDING',
    message: 'Waiting...',
    startedAt: null,
    finishedAt: null,
  },
];

let latestStartupReport: StartupStatusReport = {
  startedAt: nowIso(),
  finishedAt: null,
  overallStatus: 'DEGRADED',
  stages: createInitialStages(),
  diagnostics: {
    virtualDrives: driveControllerService.getDiagnostics(),
  },
};

let runningSequence: Promise<StartupStatusReport> | null = null;

const markStage = (
  stages: StartupStageReport[],
  id: StartupStageId,
  status: StartupStageStatus,
  message: string,
): void => {
  const stage = stages.find((entry) => entry.id === id);
  if (!stage) {
    return;
  }

  if (!stage.startedAt) {
    stage.startedAt = nowIso();
  }

  stage.status = status;
  stage.message = message;
  stage.finishedAt = nowIso();
};

const skipStage = (stages: StartupStageReport[], id: StartupStageId, reason: string): void => {
  markStage(stages, id, 'SKIPPED', reason);
};

const determineOverallStatus = (stages: StartupStageReport[]): StartupStatusReport['overallStatus'] => {
  const failedIds = new Set(stages.filter((stage) => stage.status === 'FAILED').map((stage) => stage.id));

  // These are startup blockers before auth flow.
  if (failedIds.has('integration') || failedIds.has('governance') || failedIds.has('vault')) {
    return 'BLOCKED';
  }

  // Recovery stage failures degrade startup but can still allow diagnostics/login policy decisions.
  if (failedIds.size > 0) {
    return 'DEGRADED';
  }

  return 'READY';
};

const runStartupSequenceInternal = async (): Promise<StartupStatusReport> => {
  const stages = createInitialStages();
  const startedAt = nowIso();

  markStage(stages, 'integration', 'PENDING', 'Running required key checks...');
  try {
    const integration = getRuntimeIntegrationStatus();
    if (!integration.ready) {
      markStage(
        stages,
        'integration',
        'FAILED',
        `Integration contract failed. Missing=${integration.summary.missing}, Invalid=${integration.summary.invalid}`,
      );
      skipStage(stages, 'governance', 'Skipped due to integration failure.');
      skipStage(stages, 'vault', 'Skipped due to integration failure.');
      skipStage(stages, 'sync-recovery', 'Skipped due to integration failure.');
      skipStage(stages, 'cron-recovery', 'Skipped due to integration failure.');

      latestStartupReport = {
        startedAt,
        finishedAt: nowIso(),
        overallStatus: determineOverallStatus(stages),
        stages,
        diagnostics: {
          virtualDrives: driveControllerService.getDiagnostics(),
        },
      };

      return latestStartupReport;
    }

    markStage(stages, 'integration', 'SUCCESS', 'Integration contract is valid.');
  } catch (error) {
    markStage(
      stages,
      'integration',
      'FAILED',
      error instanceof Error ? error.message : 'Integration contract check failed.',
    );
    skipStage(stages, 'governance', 'Skipped due to integration failure.');
    skipStage(stages, 'vault', 'Skipped due to integration failure.');
    skipStage(stages, 'sync-recovery', 'Skipped due to integration failure.');
    skipStage(stages, 'cron-recovery', 'Skipped due to integration failure.');

    latestStartupReport = {
      startedAt,
      finishedAt: nowIso(),
      overallStatus: determineOverallStatus(stages),
      stages,
      diagnostics: {
        virtualDrives: driveControllerService.getDiagnostics(),
      },
    };

    return latestStartupReport;
  }

  markStage(stages, 'governance', 'PENDING', 'Verifying SSH and governance repository...');
  const governanceStatus = await ensureGovernanceRepoReady();
  if (!governanceStatus.repoReady || !governanceStatus.sshVerified) {
    markStage(
      stages,
      'governance',
      'FAILED',
      governanceStatus.sshMessage || 'Governance repository is not ready.',
    );

    skipStage(stages, 'vault', 'Skipped because governance repository is not ready.');
    skipStage(stages, 'sync-recovery', 'Skipped because governance repository is not ready.');
    skipStage(stages, 'cron-recovery', 'Skipped because governance repository is not ready.');

    latestStartupReport = {
      startedAt,
      finishedAt: nowIso(),
      overallStatus: determineOverallStatus(stages),
      stages,
      diagnostics: {
        virtualDrives: driveControllerService.getDiagnostics(),
      },
    };

    return latestStartupReport;
  }

  markStage(
    stages,
    'governance',
    'SUCCESS',
    governanceStatus.clonedNow ? 'Governance repository cloned and ready.' : 'Governance repository already ready.',
  );
  const installMode = governanceStatus.clonedNow ? 'FIRST_INSTALL' : 'RETURNING_INSTALL';

  try {
    markStage(stages, 'vault', 'PENDING', 'Initializing vault and pulling remote changes...');
    await vaultService.initializeVault();
    const splashSync = await syncProviderService.initializeOnSplash({ installMode });
    markStage(
      stages,
      'vault',
      'SUCCESS',
      `Mode=${splashSync.installMode}, pull=${splashSync.pullStatus}, merge=${splashSync.mergeStatus}, integrity=${splashSync.integrityStatus}${
        splashSync.skippedReason ? `, note=${splashSync.skippedReason}` : ''
      }`,
    );
  } catch (error) {
    markStage(
      stages,
      'vault',
      'FAILED',
      error instanceof Error ? error.message : 'Vault startup stage failed.',
    );

    skipStage(stages, 'sync-recovery', 'Skipped because vault stage failed.');
    skipStage(stages, 'cron-recovery', 'Skipped because vault stage failed.');

    latestStartupReport = {
      startedAt,
      finishedAt: nowIso(),
      overallStatus: determineOverallStatus(stages),
      stages,
      diagnostics: {
        virtualDrives: driveControllerService.getDiagnostics(),
      },
    };

    return latestStartupReport;
  }

  try {
    markStage(stages, 'sync-recovery', 'PENDING', 'Recovering interrupted sync tasks...');
    const recovery = await recoveryOrchestratorService.recoverPendingSyncTasks();
    markStage(
      stages,
      'sync-recovery',
      'SUCCESS',
      `Recovered sync tasks: ${recovery.recoveredTasks}`,
    );
  } catch (error) {
    markStage(
      stages,
      'sync-recovery',
      'FAILED',
      error instanceof Error ? error.message : 'Sync recovery stage failed.',
    );
  }

  try {
    markStage(stages, 'cron-recovery', 'PENDING', 'Recovering cron scheduler and missed runs...');
    await cronSchedulerService.initialize();
    const emailHeartbeat = await emailOrchestratorService.syncHeartbeatSchedules();
    const googleSyncSchedule = await googleBridgeService.ensureSyncSchedulerJob();
    await cronSchedulerService.tick();
    const telemetry = await cronSchedulerService.getTelemetry();
    markStage(
      stages,
      'cron-recovery',
      'SUCCESS',
      `Cron active=${telemetry.schedulerActive}, enabledJobs=${telemetry.enabledJobs}, emailHeartbeatJobs=${emailHeartbeat.configuredJobs.length}, googleSyncJob=${googleSyncSchedule.jobId}, recoveredInterrupted=${telemetry.recovery.recoveredInterruptedTasks}, missedEnqueued=${telemetry.recovery.missedJobsEnqueued}, duplicatePreventions=${telemetry.recovery.duplicatePreventions}, totalRuns=${telemetry.totalRuns}, failedRuns=${telemetry.failedRuns}, overlaps=${telemetry.skippedOverlapRuns}`,
    );
  } catch (error) {
    markStage(
      stages,
      'cron-recovery',
      'FAILED',
      error instanceof Error ? error.message : 'Cron recovery stage failed.',
    );
  }

  try {
    await hookSystemService.initialize();
  } catch (error) {
    console.error('[PRANA_WARNING] Failed to initialize hookSystemService:', error);
  }

  try {
    // Initialize notification centre (requires vaidyarService and hookSystemService to be ready)
    await notificationCentreService.initialize('prana');
  } catch (error) {
    console.error('[PRANA_WARNING] Failed to initialize notificationCentreService:', error);
  }

  try {
    await memoryIndexService.initialize();
  } catch (error) {
    console.error('[PRANA_WARNING] Failed to initialize memoryIndexService:', error);
  }

  latestStartupReport = {
    startedAt,
    finishedAt: nowIso(),
    overallStatus: determineOverallStatus(stages),
    stages,
    diagnostics: {
      virtualDrives: driveControllerService.getDiagnostics(),
    },
  };

  return latestStartupReport;
};

export const startupOrchestratorService = {
  async runStartupSequence(): Promise<StartupStatusReport> {
    if (runningSequence) {
      return runningSequence;
    }

    runningSequence = runStartupSequenceInternal().finally(() => {
      runningSequence = null;
    });

    return runningSequence;
  },

  getLatestStartupStatus(): StartupStatusReport {
    return latestStartupReport;
  },
};
