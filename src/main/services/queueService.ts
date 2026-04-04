import { queueOrchestratorService } from './queueOrchestratorService';
import { QueueLaneType, QueuePriority, TaskRegistryRecord } from './taskRegistryService';
import { WorkOrderPriority } from './workOrderService';

export type QueueEntryStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'RETRY_PENDING' | 'EXPIRED';

export interface QueueEntry {
  id: string;
  workOrderId: string;
  priority: WorkOrderPriority;
  status: QueueEntryStatus;
  laneType: QueueLaneType;
  enqueuedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  attempts: number;
}

export interface EnqueueResult {
  accepted: boolean;
  reason: 'ok' | 'queue_full' | 'crisis_reserve';
  entry: QueueEntry | null;
}

const mapTaskStatus = (status: TaskRegistryRecord['status']): QueueEntryStatus => {
  if (status === 'RUNNING') {
    return 'RUNNING';
  }
  if (status === 'COMPLETED') {
    return 'COMPLETED';
  }
  if (status === 'FAILED') {
    return 'FAILED';
  }
  if (status === 'CANCELLED') {
    return 'CANCELLED';
  }
  if (status === 'EXPIRED') {
    return 'EXPIRED';
  }
  if (status === 'RETRY_PENDING') {
    return 'RETRY_PENDING';
  }
  return 'QUEUED';
};

const toQueueEntry = (record: TaskRegistryRecord): QueueEntry => {
  return {
    id: record.taskId,
    workOrderId: record.payloadRef,
    priority: record.priority,
    status: mapTaskStatus(record.status),
    laneType: record.laneType,
    enqueuedAt: record.createdAt,
    startedAt: record.executedAt,
    endedAt: record.completedAt,
    attempts: record.retryCount,
  };
};

export const queueService = {
  async enqueue(
    workOrderId: string,
    priority: WorkOrderPriority,
    options?: {
      laneType?: QueueLaneType;
      taskType?: string;
      payloadMeta?: Record<string, unknown>;
      maxRetries?: number;
      scheduledAt?: string;
      dedupeKey?: string | null;
      timeoutMs?: number | null;
      appId?: string;
    },
  ): Promise<EnqueueResult> {
    const result = await queueOrchestratorService.enqueueTask({
      payloadRef: workOrderId,
      priority: priority as QueuePriority,
      laneType: options?.laneType,
      taskType: options?.taskType,
      payloadMeta: options?.payloadMeta,
      maxRetries: options?.maxRetries,
      scheduledAt: options?.scheduledAt,
      dedupeKey: options?.dedupeKey ?? `work-order:${workOrderId}`,
      timeoutMs: options?.timeoutMs,
      appId: options?.appId,
    });

    return {
      accepted: result.accepted,
      reason: result.reason,
      entry: result.record ? toQueueEntry(result.record) : null,
    };
  },

  async startNext(lanes?: QueueLaneType[]): Promise<QueueEntry | null> {
    const task = await queueOrchestratorService.claimNextTask(lanes);
    return task ? toQueueEntry(task) : null;
  },

  async complete(entryId: string): Promise<QueueEntry | null> {
    const task = await queueOrchestratorService.completeTask(entryId);
    return task ? toQueueEntry(task) : null;
  },

  async fail(entryId: string, error = 'Queue task failed'): Promise<QueueEntry | null> {
    const task = await queueOrchestratorService.failTask(entryId, error);
    return task ? toQueueEntry(task) : null;
  },

  async cancel(entryId: string, reason?: string): Promise<QueueEntry | null> {
    const task = await queueOrchestratorService.cancelTask(entryId, reason);
    return task ? toQueueEntry(task) : null;
  },

  async list(): Promise<QueueEntry[]> {
    const tasks = await queueOrchestratorService.listTasks();
    return tasks.map(toQueueEntry);
  },

  async get(entryId: string): Promise<QueueEntry | null> {
    const tasks = await queueOrchestratorService.listTasks();
    const task = tasks.find((entry) => entry.taskId === entryId) ?? null;
    return task ? toQueueEntry(task) : null;
  },

  async findByWorkOrderId(workOrderId: string): Promise<QueueEntry | null> {
    const task = await queueOrchestratorService.findByPayloadRef(workOrderId);
    return task ? toQueueEntry(task) : null;
  },

  async getHealthSnapshot() {
    return queueOrchestratorService.getHealthCheck();
  },

  async __resetForTesting(): Promise<void> {
    await queueOrchestratorService.__resetForTesting();
  },
};
