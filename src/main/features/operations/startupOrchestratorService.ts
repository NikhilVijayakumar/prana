import { cronSchedulerService } from '../orchestration/cronSchedulerService';
import { hookSystemService } from '../governance/hookSystemService';
import { memoryIndexService } from '../context/memoryIndexService';
import { emailOrchestratorService } from '../communication/emailOrchestratorService';
import { googleBridgeService } from '../communication/googleBridgeService';
import { notificationCentreService } from '../communication/notificationCentreService';
import { hostDependencyCapabilityService } from '../governance/hostDependencyCapabilityService';

export type StartupState =
  | 'INIT'
  | 'PLATFORM_READY'
  | 'SERVICES_READY'
  | 'OPERATIONAL';

export type StartupStageId =
  | 'host-dependencies'
  | 'notification-centre'
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

const WATCHDOG_TIMEOUT_MS: Record<StartupStageId, number> = {
  'host-dependencies': 15 * 1000,
  'notification-centre': 10 * 1000,
  'cron-recovery': 60 * 1000,
};

const executeWithWatchdog = async <T>(
  stageId: StartupStageId,
  operation: () => Promise<T>,
): Promise<T> => {
  const timeoutMs = WATCHDOG_TIMEOUT_MS[stageId];
  if (!timeoutMs) return operation();

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
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const stageToTargetState = (id: StartupStageId): StartupState => {
  const mapping: Record<StartupStageId, StartupState> = {
    'host-dependencies': 'PLATFORM_READY',
    'notification-centre': 'SERVICES_READY',
    'cron-recovery': 'OPERATIONAL',
  };
  return mapping[id];
};

const stageProgressAllocation = (id: StartupStageId): { start: number; end: number } => {
  const allocations: Record<StartupStageId, { start: number; end: number }> = {
    'host-dependencies': { start: 0, end: 30 },
    'notification-centre': { start: 30, end: 60 },
    'cron-recovery': { start: 60, end: 96 },
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
  { id: 'host-dependencies', label: 'Host Dependencies', status: 'PENDING', state: 'INIT', progress: 0, message: 'Waiting...', isBlocking: false, startedAt: null, finishedAt: null },
  { id: 'notification-centre', label: 'Notification Centre', status: 'PENDING', state: 'PLATFORM_READY', progress: 0, message: 'Waiting...', isBlocking: false, startedAt: null, finishedAt: null },
  { id: 'cron-recovery', label: 'Cron Recovery', status: 'PENDING', state: 'SERVICES_READY', progress: 0, message: 'Waiting...', isBlocking: false, startedAt: null, finishedAt: null },
];

export const createStartupOrchestrator = () => {
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
    if (!stage) return;

    if (!stage.startedAt) stage.startedAt = nowIso();

    stage.status = status;
    stage.message = message;
    stage.errorCode = errorCode;
    stage.finishedAt = nowIso();

    if (status === 'SUCCESS') {
      stage.state = stageToTargetState(id);
      stage.progress = stageProgressAllocation(id).end;
    } else if (status === 'FAILED' || status === 'SKIPPED' || status === 'PENDING') {
      stage.progress = stageProgressAllocation(id).start;
    }
  };

  const determineOverallStatus = (stages: StartupStageReport[]): StartupStatusReport['overallStatus'] => {
    if (stages.some((s) => s.isBlocking && s.status === 'FAILED')) return 'BLOCKED';
    if (stages.some((s) => s.status === 'FAILED')) return 'DEGRADED';
    return 'READY';
  };

  const buildStatusReport = (startedAt: string, stages: StartupStageReport[]): StartupStatusReport => ({
    startedAt,
    finishedAt: nowIso(),
    currentState: determineCurrentState(stages),
    overallStatus: determineOverallStatus(stages),
    overallProgress: calculateOverallProgress(stages),
    stages,
  });

  const emitProgressEvent = (event: Omit<StartupProgressEvent, 'timestamp'>): void => {
    if (progressCallback) {
      progressCallback({ ...event, timestamp: nowIso() });
    }
  };

  const runStartupSequenceInternal = async (callback?: StartupProgressCallback): Promise<StartupStatusReport> => {
    progressCallback = callback || null;
    const stages = createInitialStages();
    const startedAt = nowIso();

    // Host dependencies — check git/ssh are available (needed for plugin app installs)
    markStage(stages, 'host-dependencies', 'PENDING', 'Checking host dependencies...');
    try {
      const deps = await executeWithWatchdog('host-dependencies', () =>
        hostDependencyCapabilityService.runFullCapabilityCheck(),
      );
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

    // Notification centre
    markStage(stages, 'notification-centre', 'PENDING', 'Initializing notification centre...');
    try {
      await executeWithWatchdog('notification-centre', async () => {
        await notificationCentreService.initialize('prana');
      });
      markStage(stages, 'notification-centre', 'SUCCESS', 'Notification centre ready.');
    } catch (error) {
      markStage(
        stages,
        'notification-centre',
        'FAILED',
        error instanceof Error ? error.message : 'Notification centre initialization failed.',
      );
    }

    // Cron recovery
    markStage(stages, 'cron-recovery', 'PENDING', 'Recovering cron scheduler and missed runs...');
    try {
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
        `Cron active=${telemetry.schedulerActive}, jobs=${telemetry.enabledJobs}, emailJobs=${emailHeartbeat.configuredJobs.length}, googleSyncJob=${googleSyncSchedule.jobId}, recovered=${telemetry.recovery.recoveredInterruptedTasks}, missed=${telemetry.recovery.missedJobsEnqueued}`,
      );
    } catch (error) {
      markStage(
        stages,
        'cron-recovery',
        'FAILED',
        error instanceof Error ? error.message : 'Cron recovery stage failed.',
      );
    }

    // Background initializations — non-blocking, do not affect startup status
    hookSystemService.initialize().catch((e) =>
      console.error('[PRANA_WARNING] Failed to initialize hookSystemService:', e),
    );
    memoryIndexService.initialize().catch((e) =>
      console.error('[PRANA_WARNING] Failed to initialize memoryIndexService:', e),
    );

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
      if (runningSequence) return runningSequence;

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

// Backward compatibility — creates a default instance
const defaultStartupOrchestrator = createStartupOrchestrator();

export const startupOrchestratorService = defaultStartupOrchestrator;

export async function runStartupSequence(callback?: StartupProgressCallback): Promise<StartupStatusReport> {
  return defaultStartupOrchestrator.runStartupSequence(callback);
}

export function getLatestStartupStatus(): StartupStatusReport {
  return defaultStartupOrchestrator.getLatestStartupStatus();
}
