import { WorkOrderPriority } from './workOrderService';

export type QueueEntryStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface QueueEntry {
  id: string;
  workOrderId: string;
  priority: WorkOrderPriority;
  status: QueueEntryStatus;
  enqueuedAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface EnqueueResult {
  accepted: boolean;
  reason: 'ok' | 'queue_full' | 'crisis_reserve';
  entry: QueueEntry | null;
}

const MAX_QUEUE_SIZE = 10;
const CRISIS_RESERVED_SLOTS = 1;
const PRIORITY_WEIGHT: Record<WorkOrderPriority, number> = {
  CRITICAL: 4,
  URGENT: 3,
  IMPORTANT: 2,
  ROUTINE: 1,
};

let queueEntryCounter = 1;
const queueEntries = new Map<string, QueueEntry>();

const createQueueEntryId = (): string => {
  const id = `Q-${String(queueEntryCounter).padStart(4, '0')}`;
  queueEntryCounter += 1;
  return id;
};

const listByStatus = (statuses: QueueEntryStatus[]): QueueEntry[] => {
  return Array.from(queueEntries.values()).filter((entry) => statuses.includes(entry.status));
};

export const queueService = {
  enqueue(workOrderId: string, priority: WorkOrderPriority): EnqueueResult {
    const activeEntries = listByStatus(['QUEUED', 'RUNNING']);

    if (activeEntries.length >= MAX_QUEUE_SIZE) {
      return { accepted: false, reason: 'queue_full', entry: null };
    }

    if (priority !== 'CRITICAL') {
      const nonCriticalActive = activeEntries.filter((entry) => entry.priority !== 'CRITICAL').length;
      const nonCriticalCapacity = MAX_QUEUE_SIZE - CRISIS_RESERVED_SLOTS;
      if (nonCriticalActive >= nonCriticalCapacity) {
        return { accepted: false, reason: 'crisis_reserve', entry: null };
      }
    }

    const now = new Date().toISOString();
    const entry: QueueEntry = {
      id: createQueueEntryId(),
      workOrderId,
      priority,
      status: 'QUEUED',
      enqueuedAt: now,
      startedAt: null,
      endedAt: null,
    };

    queueEntries.set(entry.id, entry);
    return { accepted: true, reason: 'ok', entry };
  },

  startNext(): QueueEntry | null {
    const queued = listByStatus(['QUEUED']);
    if (queued.length === 0) {
      return null;
    }

    const next = queued.sort((a, b) => {
      const weightDelta = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (weightDelta !== 0) {
        return weightDelta;
      }
      return a.enqueuedAt < b.enqueuedAt ? -1 : 1;
    })[0];

    if (!next) {
      return null;
    }

    const updated: QueueEntry = {
      ...next,
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
    };

    queueEntries.set(updated.id, updated);
    return updated;
  },

  complete(entryId: string): QueueEntry | null {
    const existing = queueEntries.get(entryId);
    if (!existing) {
      return null;
    }

    const updated: QueueEntry = {
      ...existing,
      status: 'COMPLETED',
      endedAt: new Date().toISOString(),
    };
    queueEntries.set(entryId, updated);
    return updated;
  },

  fail(entryId: string): QueueEntry | null {
    const existing = queueEntries.get(entryId);
    if (!existing) {
      return null;
    }

    const updated: QueueEntry = {
      ...existing,
      status: 'FAILED',
      endedAt: new Date().toISOString(),
    };
    queueEntries.set(entryId, updated);
    return updated;
  },

  cancel(entryId: string): QueueEntry | null {
    const existing = queueEntries.get(entryId);
    if (!existing) {
      return null;
    }

    const updated: QueueEntry = {
      ...existing,
      status: 'CANCELLED',
      endedAt: new Date().toISOString(),
    };
    queueEntries.set(entryId, updated);
    return updated;
  },

  list(): QueueEntry[] {
    return Array.from(queueEntries.values()).sort((a, b) => (a.enqueuedAt < b.enqueuedAt ? 1 : -1));
  },

  get(entryId: string): QueueEntry | null {
    return queueEntries.get(entryId) ?? null;
  },

  findByWorkOrderId(workOrderId: string): QueueEntry | null {
    for (const entry of queueEntries.values()) {
      if (entry.workOrderId === workOrderId) {
        return entry;
      }
    }
    return null;
  },

  __resetForTesting(): void {
    queueEntryCounter = 1;
    queueEntries.clear();
  },
};
