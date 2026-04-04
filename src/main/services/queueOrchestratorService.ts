import { getRuntimeBootstrapConfig } from './runtimeConfigService';
import {
  QueueLaneType,
  QueuePriority,
  TaskRegistryRecord,
  taskRegistryService,
} from './taskRegistryService';

export interface QueueHealthSnapshot {
  status: 'healthy' | 'warning' | 'critical';
  recoveredTasks: number;
  totalQueued: number;
  totalRunning: number;
  totalFailed: number;
  overdueTasks: number;
  laneDepth: Record<QueueLaneType, { queued: number; running: number; failed: number }>;
  limits: {
    maxQueueDepth: number;
    crisisReserveSlots: number;
    maxParallelTasks: number;
    perLaneParallelism: Record<QueueLaneType, number>;
  };
}

const MAX_QUEUE_DEPTH = 10;
const CRISIS_RESERVED_SLOTS = 1;
const MAX_PARALLEL_TASKS = 4;
const PER_LANE_PARALLELISM: Record<QueueLaneType, number> = {
  MODEL: 2,
  CHANNEL: 1,
  SYSTEM: 1,
};

let initialized = false;
let recoveredTasks = 0;

const ensureInitialized = async (): Promise<void> => {
  if (initialized) {
    return;
  }
  recoveredTasks = await taskRegistryService.recoverLeasedTasks();
  initialized = true;
};

const resolveDefaultAppId = (): string => {
  const runtime = getRuntimeBootstrapConfig();
  return runtime.vault.appKey?.trim()
    || runtime.branding.appBrandName?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    || 'prana-runtime';
};

const resolveDefaultLane = (input?: QueueLaneType): QueueLaneType => input ?? 'MODEL';

const activeTaskStatuses = ['QUEUED', 'SCHEDULED', 'RUNNING', 'RETRY_PENDING'] as const;

const isNonCriticalPriority = (priority: QueuePriority): boolean => priority !== 'CRITICAL';

export const queueOrchestratorService = {
  async enqueueTask(input: {
    payloadRef: string;
    priority: QueuePriority;
    laneType?: QueueLaneType;
    taskType?: string;
    payloadMeta?: Record<string, unknown>;
    maxRetries?: number;
    scheduledAt?: string;
    dedupeKey?: string | null;
    timeoutMs?: number | null;
    appId?: string;
  }): Promise<{ accepted: boolean; reason: 'ok' | 'queue_full' | 'crisis_reserve'; record: TaskRegistryRecord | null }> {
    await ensureInitialized();
    const telemetry = await taskRegistryService.getTelemetry();
    const totalActive =
      telemetry.totals.QUEUED +
      telemetry.totals.SCHEDULED +
      telemetry.totals.RUNNING +
      telemetry.totals.RETRY_PENDING;

    if (totalActive >= MAX_QUEUE_DEPTH) {
      return { accepted: false, reason: 'queue_full', record: null };
    }

    if (isNonCriticalPriority(input.priority)) {
      const nonCriticalActive = await taskRegistryService.listTasks({
        statuses: [...activeTaskStatuses],
        limit: 1_000,
      });
      const nonCriticalCount = nonCriticalActive.filter((task) => task.priority !== 'CRITICAL').length;
      if (nonCriticalCount >= MAX_QUEUE_DEPTH - CRISIS_RESERVED_SLOTS) {
        return { accepted: false, reason: 'crisis_reserve', record: null };
      }
    }

    const result = await taskRegistryService.enqueueTask({
      appId: input.appId ?? resolveDefaultAppId(),
      taskType: input.taskType ?? 'work-order',
      laneType: resolveDefaultLane(input.laneType),
      priority: input.priority,
      payloadRef: input.payloadRef,
      payloadMeta: input.payloadMeta,
      maxRetries: input.maxRetries ?? 2,
      scheduledAt: input.scheduledAt,
      dedupeKey: input.dedupeKey,
      timeoutMs: input.timeoutMs,
    });

    return {
      accepted: true,
      reason: 'ok',
      record: result.record,
    };
  },

  async claimNextTask(lanes?: QueueLaneType[]): Promise<TaskRegistryRecord | null> {
    await ensureInitialized();
    const telemetry = await taskRegistryService.getTelemetry();
    const totalRunning = telemetry.totals.RUNNING;
    if (totalRunning >= MAX_PARALLEL_TASKS) {
      return null;
    }

    const laneDepth = telemetry.byLane;
    const allowedLanes = (lanes ?? ['CHANNEL', 'MODEL', 'SYSTEM']).filter(
      (lane) => laneDepth[lane].running < PER_LANE_PARALLELISM[lane],
    );
    if (allowedLanes.length === 0) {
      return null;
    }

    return taskRegistryService.claimNextTask({
      workerId: 'queue-orchestrator',
      permittedLanes: allowedLanes,
      leaseDurationMs: 60_000,
    });
  },

  async completeTask(taskId: string): Promise<TaskRegistryRecord | null> {
    await ensureInitialized();
    return taskRegistryService.markTaskCompleted(taskId);
  },

  async failTask(taskId: string, error: string): Promise<TaskRegistryRecord | null> {
    await ensureInitialized();
    return taskRegistryService.markTaskFailed(taskId, error);
  },

  async cancelTask(taskId: string, reason?: string): Promise<TaskRegistryRecord | null> {
    await ensureInitialized();
    return taskRegistryService.markTaskCancelled(taskId, reason);
  },

  async listTasks(): Promise<TaskRegistryRecord[]> {
    await ensureInitialized();
    return taskRegistryService.listTasks({ limit: 500 });
  },

  async findByPayloadRef(payloadRef: string): Promise<TaskRegistryRecord | null> {
    await ensureInitialized();
    return taskRegistryService.findLatestByPayloadRef(payloadRef);
  },

  async getHealthCheck(): Promise<QueueHealthSnapshot> {
    await ensureInitialized();
    const telemetry = await taskRegistryService.getTelemetry();
    const totalQueued =
      telemetry.totals.QUEUED +
      telemetry.totals.SCHEDULED +
      telemetry.totals.RETRY_PENDING;
    const totalRunning = telemetry.totals.RUNNING;
    const totalFailed = telemetry.totals.FAILED;

    let status: QueueHealthSnapshot['status'] = 'healthy';
    if (telemetry.overdueTasks > 0 || totalFailed > 0 || totalQueued >= MAX_QUEUE_DEPTH - 1) {
      status = 'warning';
    }
    if (totalQueued >= MAX_QUEUE_DEPTH || totalFailed >= 5) {
      status = 'critical';
    }

    return {
      status,
      recoveredTasks,
      totalQueued,
      totalRunning,
      totalFailed,
      overdueTasks: telemetry.overdueTasks,
      laneDepth: telemetry.byLane,
      limits: {
        maxQueueDepth: MAX_QUEUE_DEPTH,
        crisisReserveSlots: CRISIS_RESERVED_SLOTS,
        maxParallelTasks: MAX_PARALLEL_TASKS,
        perLaneParallelism: { ...PER_LANE_PARALLELISM },
      },
    };
  },

  async dispose(): Promise<void> {
    initialized = false;
    recoveredTasks = 0;
  },

  async __resetForTesting(): Promise<void> {
    initialized = false;
    recoveredTasks = 0;
    await taskRegistryService.__resetForTesting();
  },
};
