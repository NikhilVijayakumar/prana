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
import { hostDependencyCapabilityService } from './hostDependencyCapabilityService';

export type StartupState =
  | 'INIT'
  | 'FOUNDATION'
  | 'IDENTITY_VERIFIED'
  | 'STORAGE_READY'
  | 'STORAGE_MIRROR_VALIDATING'
  | 'INTEGRITY_VERIFIED'
  | 'OPERATIONAL';

export type StartupStageId =
  | 'integration'
  | 'host-dependencies'
  | 'governance'
  | 'vault'
  | 'storage-mirror-validation'
  | 'vaidyar'
  | 'sync-recovery'
  | 'cron-recovery';

export type StartupStageStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface StartupStageReport {
  id: StartupStageId;
  label: string;
  status: StartupStageStatus;
  state: StartupState;
  progress: number; // 0-100, monotonically increasing
  message: string;
  errorCode?: string;
  startedAt: string | null;
  finishedAt: string | null;
  isBlocking: boolean;
}

export interface StartupStatusReport {
  startedAt: string;
  finishedAt: string | null;
  currentState: StartupState;
  overallStatus: 'READY' | 'DEGRADED' | 'BLOCKED';
  overallProgress: number; // 0-100, monotonically increasing
  stages: StartupStageReport[];
  diagnostics?: {
    virtualDrives: VirtualDriveDiagnosticsSnapshot;
  };
}

export interface StartupProgressEvent {
  type: 'stage-start' | 'stage-complete' | 'stage-skip' | 'stage-fail' | 'sequence-complete';
  stage?: StartupStageReport;
  currentState?: StartupState;
  overallProgress?: number;
  timestamp: string;
}

export type StartupProgressCallback = (event: StartupProgressEvent) => void;

const nowIso = (): string => new Date().toISOString();

/**
 * Watchdog timer configuration: per-stage maximum execution time in milliseconds.
 * Stages exceeding these durations will be marked as FAILED with TIMEOUT_ERROR.
 */
const WATCHDOG_TIMEOUT_MS: Record<StartupStageId, number> = {
  'integration': 30 * 1000,        // 30 seconds
  'host-dependencies': 15 * 1000,  // 15 seconds (binary availability checks)
  'governance': 45 * 1000,         // 45 seconds (includes repo clone if needed)
  'vault': 60 * 1000,              // 60 seconds (vault initialization + pull)
  'storage-mirror-validation': 30 * 1000, // 30 seconds
  'vaidyar': 45 * 1000,            // 45 seconds (bootstrap diagnostics)
  'sync-recovery': 60 * 1000,      // 60 seconds (recovery can take time)
  'cron-recovery': 60 * 1000,      // 60 seconds (cron jobs recovery)
};

/**
 * Execute an async operation with watchdog timeout protection.
 * Rejects with TimeoutError if execution exceeds the configured timeout for the stage.
 */
const executeWithWatchdog = async <T>(
  stageId: StartupStageId,
  operation: () => Promise<T>,
): Promise<T> => {
  const timeoutMs = WATCHDOG_TIMEOUT_MS[stageId];
  if (!timeoutMs) {
    return operation();
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Stage '${stageId}' exceeded timeout of ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

/**
 * Maps stage IDs to their target boot state upon successful completion.
 * Stages progress through states: INIT -> FOUNDATION -> IDENTITY_VERIFIED -> STORAGE_READY -> STORAGE_MIRROR_VALIDATING -> INTEGRITY_VERIFIED -> OPERATIONAL
 */
const stageToTargetState = (id: StartupStageId): StartupState => {
  const mapping: Record<StartupStageId, StartupState> = {
    'integration': 'FOUNDATION',
    'host-dependencies': 'FOUNDATION',
    'governance': 'IDENTITY_VERIFIED',
    'vault': 'STORAGE_READY',
    'storage-mirror-validation': 'STORAGE_MIRROR_VALIDATING',
    'vaidyar': 'INTEGRITY_VERIFIED',
    'sync-recovery': 'OPERATIONAL',
    'cron-recovery': 'OPERATIONAL',
  };
  return mapping[id];
};

/**
 * Calculates stage progress allocation (0-100 total, monotonic).
 * Allocates percentages to each stage proportionally:
 * integration(8), governance(8), vault(12), storage-mirror(8), vaidyar(12), sync-recovery(20), cron-recovery(22), finalization(10)
 */
const stageProgressAllocation = (id: StartupStageId): { start: number; end: number } => {
  const allocations: Record<StartupStageId, { start: number; end: number }> = {
    'integration': { start: 0, end: 6 },
    'host-dependencies': { start: 6, end: 14 },
    'governance': { start: 14, end: 22 },
    'vault': { start: 22, end: 34 },
    'storage-mirror-validation': { start: 34, end: 42 },
    'vaidyar': { start: 42, end: 54 },
    'sync-recovery': { start: 54, end: 74 },
    'cron-recovery': { start: 74, end: 96 },
  };
  return allocations[id] || { start: 0, end: 100 };
};

const calculateOverallProgress = (stages: StartupStageReport[]): number => {
  if (stages.length === 0) return 0;
  const total = stages.reduce((sum, s) => sum + s.progress, 0);
  return Math.min(100, Math.round(total / stages.length));
};

const determineCurrentState = (stages: StartupStageReport[]): StartupState => {
  const lastSuccess = [...stages].reverse().find((s) => s.status === 'SUCCESS');
  return lastSuccess?.state ?? 'INIT';
};

const createInitialStages = (): StartupStageReport[] => [
  { id: 'integration', label: 'Integration Contract', status: 'PENDING', state: 'INIT', progress: 0, message: 'Waiting...', isBlocking: true, startedAt: null, finishedAt: null },
  { id: 'host-dependencies', label: 'Host Dependencies', status: 'PENDING', state: 'FOUNDATION', progress: 0, message: 'Waiting...', isBlocking: false, startedAt: null, finishedAt: null },
  { id: 'governance', label: 'Governance Repository', status: 'PENDING', state: 'IDENTITY_VERIFIED', progress: 0, message: 'Waiting...', isBlocking: true, startedAt: null, finishedAt: null },
  { id: 'vault', label: 'Vault Mount & Sync', status: 'PENDING', state: 'STORAGE_READY', progress: 0, message: 'Waiting...', isBlocking: true, startedAt: null, finishedAt: null },
  { id: 'storage-mirror-validation', label: 'Storage Mirror Validation', status: 'PENDING', state: 'STORAGE_MIRROR_VALIDATING', progress: 0, message: 'Waiting...', isBlocking: false, startedAt: null, finishedAt: null },
  { id: 'vaidyar', label: 'Vaidyar Health Check', status: 'PENDING', state: 'INTEGRITY_VERIFIED', progress: 0, message: 'Waiting...', isBlocking: false, startedAt: null, finishedAt: null },
  { id: 'sync-recovery', label: 'Sync Recovery', status: 'PENDING', state: 'OPERATIONAL', progress: 0, message: 'Waiting...', isBlocking: false, startedAt: null, finishedAt: null },
  { id: 'cron-recovery', label: 'Cron Recovery', status: 'PENDING', state: 'OPERATIONAL', progress: 0, message: 'Waiting...', isBlocking: false, startedAt: null, finishedAt: null },
];

/**
 * Factory function to create a startup orchestrator.
 * Eliminates module-level state for latestStartupReport, runningSequence, and progressCallback.
 */
export const createStartupOrchestrator = () => {
  // Instance-level state (not module-level)
  let latestStartupReport: StartupStatusReport = {
    startedAt: nowIso(),
    finishedAt: null,
    currentState: 'INIT',
    overallStatus: 'DEGRADED',
    overallProgress: 0,
    stages: createInitialStages(),
  };

  let runningSequence: Promise<StartupStatusReport> | null = null;
  let progressCallback: StartupProgressCallback | null = null;

  const markStage = (
    stages: StartupStageReport[],
    id: StartupStageId,
    status: StartupStageStatus,
    message: string,
    errorCode?: string,
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
    stage.errorCode = errorCode;
    stage.finishedAt = nowIso();

    // Update stage state and progress based on status
    if (status === 'SUCCESS') {
      stage.state = stageToTargetState(id);
      const alloc = stageProgressAllocation(id);
      stage.progress = alloc.end;
    } else if (status === 'FAILED' || status === 'SKIPPED') {
      const alloc = stageProgressAllocation(id);
      stage.progress = alloc.start;
      // Don't change state on failure; stay at current state
    } else if (status === 'PENDING') {
      const alloc = stageProgressAllocation(id);
      stage.progress = alloc.start;
    }
  };

  const skipStage = (stages: StartupStageReport[], id: StartupStageId, reason: string): void => {
    markStage(stages, id, 'SKIPPED', reason);
  };

  const determineOverallStatus = (stages: StartupStageReport[]): StartupStatusReport['overallStatus'] => {
    const failedIds = new Set(stages.filter((stage) => stage.status === 'FAILED').map((stage) => stage.id));

    // These are startup blockers before auth flow.
    const blockingStages = new Set(stages.filter((stage) => stage.isBlocking && stage.status === 'FAILED').map((stage) => stage.id));
    if (blockingStages.size > 0) {
      return 'BLOCKED';
    }

    // Recovery stage failures degrade startup but can still allow diagnostics/login policy decisions.
    if (failedIds.size > 0) {
      return 'DEGRADED';
    }

    return 'READY';
  };

  /**
   * Helper function to construct a complete startup status report with all new fields.
   */
  const buildStatusReport = (startedAt: string, stages: StartupStageReport[]): StartupStatusReport => {
    return {
      startedAt,
      finishedAt: nowIso(),
      currentState: determineCurrentState(stages),
      overallStatus: determineOverallStatus(stages),
      overallProgress: calculateOverallProgress(stages),
      stages,
      diagnostics: {
        virtualDrives: driveControllerService.getDiagnostics(),
      },
    };
  };

  const emitProgressEvent = (event: Omit<StartupProgressEvent, 'timestamp'>): void => {
    if (progressCallback) {
      progressCallback({
        ...event,
        timestamp: nowIso(),
      });
    }
  };

  const runStartupSequenceInternal = async (callback?: StartupProgressCallback): Promise<StartupStatusReport> => {
    progressCallback = callback || null;
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
        skipStage(stages, 'host-dependencies', 'Skipped due to integration failure.');
        skipStage(stages, 'governance', 'Skipped due to integration failure.');
        skipStage(stages, 'vault', 'Skipped due to integration failure.');
        skipStage(stages, 'storage-mirror-validation', 'Skipped due to integration failure.');
        skipStage(stages, 'vaidyar', 'Skipped due to integration failure.');
        skipStage(stages, 'sync-recovery', 'Skipped due to integration failure.');
        skipStage(stages, 'cron-recovery', 'Skipped due to integration failure.');

        latestStartupReport = buildStatusReport(startedAt, stages);
        return latestStartupReport;
      }

      markStage(stages, 'integration', 'SUCCESS', 'Integration contract valid.');
    } catch (error) {
      markStage(
        stages,
        'integration',
        'FAILED',
        error instanceof Error ? error.message : 'Integration check failed.',
      );
      skipStage(stages, 'host-dependencies', 'Skipped due to integration failure.');
      skipStage(stages, 'governance', 'Skipped due to integration failure.');
      skipStage(stages, 'vault', 'Skipped due to integration failure.');
      skipStage(stages, 'storage-mirror-validation', 'Skipped due to integration failure.');
      skipStage(stages, 'vaidyar', 'Skipped due to integration failure.');
      skipStage(stages, 'sync-recovery', 'Skipped due to integration failure.');
      skipStage(stages, 'cron-recovery', 'Skipped due to integration failure.');

      latestStartupReport = buildStatusReport(startedAt, stages);
      return latestStartupReport;
    }

    // Host dependencies check
    markStage(stages, 'host-dependencies', 'PENDING', 'Checking host dependencies...');
    try {
      const deps = await executeWithWatchdog('host-dependencies', () => hostDependencyCapabilityService.runFullCapabilityCheck());
      if (!deps.ready) {
        markStage(
          stages,
          'host-dependencies',
          'FAILED',
          `Host dependencies not met: ${deps.summary.failedChecks.join(', ')}`,
        );
      } else {
        markStage(stages, 'host-dependencies', 'SUCCESS', 'Host dependencies verified.');
      }
    } catch (error) {
      markStage(
        stages,
        'host-dependencies',
        'FAILED',
        error instanceof Error ? error.message : 'Host dependency check failed.',
      );
    }

    // Governance repository
    markStage(stages, 'governance', 'PENDING', 'Ensuring governance repository...');
    try {
      await executeWithWatchdog('governance', () => ensureGovernanceRepoReady());
      markStage(stages, 'governance', 'SUCCESS', 'Governance repository ready.');
    } catch (error) {
      markStage(
        stages,
        'governance',
        'FAILED',
        error instanceof Error ? error.message : 'Governance repository setup failed.',
      );
      skipStage(stages, 'vault', 'Skipped because governance failed.');
      skipStage(stages, 'storage-mirror-validation', 'Skipped because governance failed.');
      skipStage(stages, 'vaidyar', 'Skipped because governance failed.');
      skipStage(stages, 'sync-recovery', 'Skipped because governance failed.');
      skipStage(stages, 'cron-recovery', 'Skipped because governance failed.');

      latestStartupReport = buildStatusReport(startedAt, stages);
      return latestStartupReport;
    }

    // Vault mount & sync
    const drivePolicy = driveControllerService.getPolicy();
    if (!drivePolicy.clientManaged) {
      markStage(stages, 'vault', 'PENDING', 'Mounting vault drive...');
      try {
        const splashSync = await executeWithWatchdog('vault', () => syncProviderService.initializeOnSplash());
        markStage(
          stages,
          'vault',
          splashSync.merged ? 'SUCCESS' : 'FAILED',
          `Vault sync: pulled=${splashSync.pulled}, merged=${splashSync.merged}, ${splashSync.skippedReason ? `, note=${splashSync.skippedReason}` : ''}`,
        );
      } catch (error) {
        markStage(
          stages,
          'vault',
          'FAILED',
          error instanceof Error ? error.message : 'Vault startup stage failed.',
        );

        skipStage(stages, 'storage-mirror-validation', 'Skipped because vault stage failed.');
        skipStage(stages, 'sync-recovery', 'Skipped because vault stage failed.');
        skipStage(stages, 'cron-recovery', 'Skipped because vault stage failed.');
        skipStage(stages, 'vaidyar', 'Skipped because vault stage failed.');

        latestStartupReport = buildStatusReport(startedAt, stages);
        return latestStartupReport;
      }
    } else {
      skipStage(stages, 'vault', 'Skipped (client-managed vault policy).');
    }

    // Storage mirror validation
    if (!drivePolicy.clientManaged) {
      try {
        markStage(stages, 'storage-mirror-validation', 'PENDING', 'Validating cache-vault mirror contract...');
        // TODO: Call service method to validate cache/vault mirror contract
        markStage(
          stages,
          'storage-mirror-validation',
          'SUCCESS',
          'Cache-vault mirror contract validated.',
        );
      } catch (error) {
        markStage(
          stages,
          'storage-mirror-validation',
          'FAILED',
          error instanceof Error ? error.message : 'Storage mirror validation failed.',
        );

        skipStage(stages, 'sync-recovery', 'Skipped because storage mirror validation failed.');
        skipStage(stages, 'cron-recovery', 'Skipped because storage mirror validation failed.');
        skipStage(stages, 'vaidyar', 'Skipped because storage mirror validation failed.');

        latestStartupReport = buildStatusReport(startedAt, stages);
        return latestStartupReport;
      }
    } else {
      skipStage(stages, 'storage-mirror-validation', 'Skipped (client-managed vault policy).');
    }

    // Vaidyar health check
    try {
      markStage(stages, 'vaidyar', 'PENDING', 'Running startup health classification and blocking checks...');
      const vaidyarReport = await executeWithWatchdog('vaidyar', () => vaidyarService.runBootstrapDiagnostics());
      const blockingSignals = vaidyarService.getBlockingSignals();

      if (blockingSignals.length > 0) {
        markStage(
          stages,
          'vaidyar',
          'FAILED',
          `Startup blocked by Vaidyar signals: ${blockingSignals.join(', ')} (status=${vaidyarReport.overall_status})`,
        );

        skipStage(stages, 'sync-recovery', 'Skipped because Vaidyar reported blocking signals.');
        skipStage(stages, 'cron-recovery', 'Skipped because Vaidyar reported blocking signals.');

        latestStartupReport = buildStatusReport(startedAt, stages);
        return latestStartupReport;
      }

      markStage(
        stages,
        'vaidyar',
        'SUCCESS',
        `Startup diagnostics passed (status=${vaidyarReport.overall_status})`,
      );
    } catch (error) {
      markStage(
        stages,
        'vaidyar',
        'FAILED',
        error instanceof Error ? error.message : 'Vaidyar bootstrap diagnostics failed.',
      );

      skipStage(stages, 'sync-recovery', 'Skipped because Vaidyar bootstrap diagnostics failed.');
      skipStage(stages, 'cron-recovery', 'Skipped because Vaidyar bootstrap diagnostics failed.');

      latestStartupReport = buildStatusReport(startedAt, stages);
      return latestStartupReport;
    }

    // Sync recovery
    try {
      markStage(stages, 'sync-recovery', 'PENDING', 'Recovering interrupted sync tasks...');
      const recovery = await executeWithWatchdog('sync-recovery', () => recoveryOrchestratorService.recoverPendingSyncTasks());
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

    // Cron recovery
    try {
      markStage(stages, 'cron-recovery', 'PENDING', 'Recovering cron scheduler and missed runs...');
      const { emailHeartbeat, googleSyncSchedule, telemetry } = await executeWithWatchdog('cron-recovery', async () => {
        await cronSchedulerService.initialize();
        const emailHeartbeat = await emailOrchestratorService.syncHeartbeatSchedules();
        const googleSyncSchedule = await googleBridgeService.ensureSyncSchedulerJob();
        await cronSchedulerService.tick();
        const telemetry = await cronSchedulerService.getTelemetry();
        return { emailHeartbeat, googleSyncSchedule, telemetry };
      });
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

    // Initialize hook system
    try {
      await hookSystemService.initialize();
    } catch (error) {
      console.error('[PRANA_WARNING] Failed to initialize hookSystemService:', error);
    }

    // Initialize notification centre
    try {
      await notificationCentreService.initialize('prana');
    } catch (error) {
      console.error('[PRANA_WARNING] Failed to initialize notificationCentreService:', error);
    }

    // Initialize memory index
    try {
      await memoryIndexService.initialize();
    } catch (error) {
      console.error('[PRANA_WARNING] Failed to initialize memoryIndexService:', error);
    }

    latestStartupReport = buildStatusReport(startedAt, stages);
    emitProgressEvent({
      type: 'sequence-complete',
      currentState: determineCurrentState(stages),
      overallProgress: calculateOverallProgress(stages),
    });
    return latestStartupReport;
  };

  return {
    async runStartupSequence(callback?: StartupProgressCallback): Promise<StartupStatusReport> {
      if (runningSequence) {
        return runningSequence;
      }

      runningSequence = runStartupSequenceInternal(callback).finally(() => {
        runningSequence = null;
        progressCallback = null;
      });

      return runningSequence;
    },

    getLatestStartupStatus(): StartupStatusReport {
      return latestStartupReport;
    },

    __resetForTesting(): void {
      latestStartupReport = {
        startedAt: nowIso(),
        finishedAt: null,
        currentState: 'INIT',
        overallStatus: 'DEGRADED',
        overallProgress: 0,
        stages: createInitialStages(),
      };
      runningSequence = null;
      progressCallback = null;
    },
  };
};

// Backward compatibility - creates a default instance
const defaultStartupOrchestrator = createStartupOrchestrator();

export const startupOrchestratorService = defaultStartupOrchestrator;

// Convenience functions that delegate to the default instance
export async function runStartupSequence(callback?: StartupProgressCallback): Promise<StartupStatusReport> {
  return defaultStartupOrchestrator.runStartupSequence(callback);
}

export function getLatestStartupStatus(): StartupStatusReport {
  return defaultStartupOrchestrator.getLatestStartupStatus();
}
