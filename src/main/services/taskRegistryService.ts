import { encryptSqliteBuffer, decryptSqliteBuffer } from './sqliteCryptoUtil';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot } from './governanceRepoService';

export type QueueLaneType = 'MODEL' | 'CHANNEL' | 'SYSTEM';
export type QueuePriority = 'CRITICAL' | 'URGENT' | 'IMPORTANT' | 'ROUTINE';
export type TaskRegistryStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'RETRY_PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'DLQ';

export interface TaskRegistryRecord {
  taskId: string;
  appId: string;
  taskType: string;
  laneType: QueueLaneType;
  priority: QueuePriority;
  status: TaskRegistryStatus;
  payloadRef: string;
  payloadMetaJson: string;
  retryCount: number;
  maxRetries: number;
  scheduledAt: string;
  executedAt: string | null;
  completedAt: string | null;
  timeoutAt: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  dedupeKey: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRegistryEnqueueInput {
  appId: string;
  taskType: string;
  laneType: QueueLaneType;
  priority: QueuePriority;
  payloadRef: string;
  payloadMeta?: Record<string, unknown>;
  maxRetries?: number;
  scheduledAt?: string;
  dedupeKey?: string | null;
  timeoutMs?: number | null;
}

export interface TaskRegistryClaimOptions {
  workerId: string;
  permittedLanes?: QueueLaneType[];
  leaseDurationMs?: number;
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const DB_FILE_NAME = 'task-registry.sqlite';
const RETRYABLE_STATUSES: TaskRegistryStatus[] = ['QUEUED', 'SCHEDULED', 'RETRY_PENDING'];
const CLAIMABLE_STATUS_SET = new Set<TaskRegistryStatus>(RETRYABLE_STATUSES);
const PRIORITY_WEIGHT: Record<QueuePriority, number> = {
  CRITICAL: 4,
  URGENT: 3,
  IMPORTANT: 2,
  ROUTINE: 1,
};
const LANE_WEIGHT: Record<QueueLaneType, number> = {
  CHANNEL: 3,
  MODEL: 2,
  SYSTEM: 1,
};

const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);
const nowIso = (): string => new Date().toISOString();
const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const resolveSqlJsAsset = (fileName: string): string => {
  const candidates = [
    join(process.cwd(), 'node_modules', 'sql.js', 'dist', fileName),
    join(process.resourcesPath ?? '', 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', fileName),
    join(process.resourcesPath ?? '', 'node_modules', 'sql.js', 'dist', fileName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return fileName;
};

const getSqlRuntime = async (): Promise<SqlJsStatic> => {
  if (!sqlRuntimePromise) {
    sqlRuntimePromise = initSqlJs({ locateFile: (fileName) => resolveSqlJsAsset(fileName) });
  }
  return sqlRuntimePromise;
};

const persistDatabase = async (database: Database): Promise<void> => {
  const bytes = database.export();
  await mkdir(getAppDataRoot(), { recursive: true });
  await writeFile(getDbPath(), await encryptSqliteBuffer(bytes));
};

const initializeDatabase = async (): Promise<Database> => {
  const sqlRuntime = await getSqlRuntime();
  await mkdir(getAppDataRoot(), { recursive: true });

  let database: Database;
  if (existsSync(getDbPath())) {
    const raw = await readFile(getDbPath());
    try {
      database = new sqlRuntime.Database(await decryptSqliteBuffer(Buffer.from(raw)));
    } catch {
      database = new sqlRuntime.Database(new Uint8Array(raw));
      await persistDatabase(database);
    }
  } else {
    database = new sqlRuntime.Database();
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS task_registry (
      task_id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL,
      task_type TEXT NOT NULL,
      lane_type TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_ref TEXT NOT NULL,
      payload_meta_json TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 0,
      scheduled_at TEXT NOT NULL,
      executed_at TEXT,
      completed_at TEXT,
      timeout_at TEXT,
      lease_owner TEXT,
      lease_expires_at TEXT,
      dedupe_key TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS task_registry_status_lane_schedule_idx
    ON task_registry (status, lane_type, scheduled_at, created_at);
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS task_registry_payload_ref_idx
    ON task_registry (payload_ref, created_at);
  `);

  database.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS task_registry_dedupe_idx
    ON task_registry (dedupe_key)
    WHERE dedupe_key IS NOT NULL AND status IN ('CREATED', 'QUEUED', 'SCHEDULED', 'RUNNING', 'RETRY_PENDING');
  `);

  await persistDatabase(database);
  return database;
};

const getDatabase = async (): Promise<Database> => {
  if (!dbPromise) {
    dbPromise = initializeDatabase();
  }
  return dbPromise;
};

const queueWrite = async <T>(operation: () => Promise<T>): Promise<T> => {
  let result!: T;
  writeQueue = writeQueue.then(
    async () => {
      result = await operation();
    },
    async () => {
      result = await operation();
    },
  );
  await writeQueue;
  return result;
};

const mapRow = (row: Record<string, unknown>): TaskRegistryRecord => ({
  taskId: String(row.task_id ?? ''),
  appId: String(row.app_id ?? ''),
  taskType: String(row.task_type ?? ''),
  laneType: String(row.lane_type ?? 'SYSTEM') as QueueLaneType,
  priority: String(row.priority ?? 'ROUTINE') as QueuePriority,
  status: String(row.status ?? 'QUEUED') as TaskRegistryStatus,
  payloadRef: String(row.payload_ref ?? ''),
  payloadMetaJson: String(row.payload_meta_json ?? '{}'),
  retryCount: Number(row.retry_count ?? 0),
  maxRetries: Number(row.max_retries ?? 0),
  scheduledAt: String(row.scheduled_at ?? nowIso()),
  executedAt: row.executed_at ? String(row.executed_at) : null,
  completedAt: row.completed_at ? String(row.completed_at) : null,
  timeoutAt: row.timeout_at ? String(row.timeout_at) : null,
  leaseOwner: row.lease_owner ? String(row.lease_owner) : null,
  leaseExpiresAt: row.lease_expires_at ? String(row.lease_expires_at) : null,
  dedupeKey: row.dedupe_key ? String(row.dedupe_key) : null,
  lastError: row.last_error ? String(row.last_error) : null,
  createdAt: String(row.created_at ?? nowIso()),
  updatedAt: String(row.updated_at ?? nowIso()),
});

const listRows = (statement: ReturnType<Database['prepare']>): TaskRegistryRecord[] => {
  const rows: TaskRegistryRecord[] = [];
  while (statement.step()) {
    rows.push(mapRow(statement.getAsObject() as Record<string, unknown>));
  }
  statement.free();
  return rows;
};

const parsePayloadMeta = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return {};
};

const computeRetryScheduleAt = (record: TaskRegistryRecord): string => {
  const retryOrdinal = record.retryCount + 1;
  const laneMultiplier = record.laneType === 'MODEL' ? 2 : record.laneType === 'CHANNEL' ? 1 : 3;
  const delayMs = Math.min(60_000, laneMultiplier * retryOrdinal * 5_000);
  return new Date(Date.now() + delayMs).toISOString();
};

const compareTaskOrder = (left: TaskRegistryRecord, right: TaskRegistryRecord): number => {
  const laneDelta = LANE_WEIGHT[right.laneType] - LANE_WEIGHT[left.laneType];
  if (laneDelta !== 0) {
    return laneDelta;
  }

  const priorityDelta = PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const scheduledDelta = Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt);
  if (scheduledDelta !== 0) {
    return scheduledDelta;
  }

  return left.createdAt.localeCompare(right.createdAt);
};

export const taskRegistryService = {
  parsePayloadMeta,

  async enqueueTask(input: TaskRegistryEnqueueInput): Promise<{ record: TaskRegistryRecord; inserted: boolean; duplicatePrevented: boolean }> {
    const createdAt = nowIso();
    const record: TaskRegistryRecord = {
      taskId: createId('task'),
      appId: input.appId.trim() || 'prana-runtime',
      taskType: input.taskType.trim() || 'generic',
      laneType: input.laneType,
      priority: input.priority,
      status: input.scheduledAt && Date.parse(input.scheduledAt) > Date.now() ? 'SCHEDULED' : 'QUEUED',
      payloadRef: input.payloadRef.trim(),
      payloadMetaJson: JSON.stringify(input.payloadMeta ?? {}),
      retryCount: 0,
      maxRetries: Math.max(0, input.maxRetries ?? 0),
      scheduledAt: input.scheduledAt ?? createdAt,
      executedAt: null,
      completedAt: null,
      timeoutAt: input.timeoutMs ? new Date(Date.now() + Math.max(1_000, input.timeoutMs)).toISOString() : null,
      leaseOwner: null,
      leaseExpiresAt: null,
      dedupeKey: input.dedupeKey?.trim() || null,
      lastError: null,
      createdAt,
      updatedAt: createdAt,
    };

    return queueWrite(async () => {
      const database = await getDatabase();

      if (record.dedupeKey) {
        const dedupeStatement = database.prepare(`
          SELECT *
          FROM task_registry
          WHERE dedupe_key = ?
            AND status IN ('CREATED', 'QUEUED', 'SCHEDULED', 'RUNNING', 'RETRY_PENDING')
          LIMIT 1
        `);
        dedupeStatement.bind([record.dedupeKey]);
        if (dedupeStatement.step()) {
          const existing = mapRow(dedupeStatement.getAsObject() as Record<string, unknown>);
          dedupeStatement.free();
          return { record: existing, inserted: false, duplicatePrevented: true };
        }
        dedupeStatement.free();
      }

      const statement = database.prepare(`
        INSERT INTO task_registry (
          task_id, app_id, task_type, lane_type, priority, status, payload_ref, payload_meta_json,
          retry_count, max_retries, scheduled_at, executed_at, completed_at, timeout_at, lease_owner,
          lease_expires_at, dedupe_key, last_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, ?, NULL, ?, ?)
      `);
      statement.run([
        record.taskId,
        record.appId,
        record.taskType,
        record.laneType,
        record.priority,
        record.status,
        record.payloadRef,
        record.payloadMetaJson,
        record.retryCount,
        record.maxRetries,
        record.scheduledAt,
        record.timeoutAt,
        record.dedupeKey,
        record.createdAt,
        record.updatedAt,
      ]);
      statement.free();
      await persistDatabase(database);
      return { record, inserted: true, duplicatePrevented: false };
    });
  },

  async listTasks(options?: {
    statuses?: TaskRegistryStatus[];
    laneTypes?: QueueLaneType[];
    limit?: number;
    payloadRef?: string;
  }): Promise<TaskRegistryRecord[]> {
    const database = await getDatabase();
    const limit = Math.max(1, Math.min(options?.limit ?? 200, 1_000));
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (options?.statuses && options.statuses.length > 0) {
      clauses.push(`status IN (${options.statuses.map(() => '?').join(', ')})`);
      params.push(...options.statuses);
    }

    if (options?.laneTypes && options.laneTypes.length > 0) {
      clauses.push(`lane_type IN (${options.laneTypes.map(() => '?').join(', ')})`);
      params.push(...options.laneTypes);
    }

    if (options?.payloadRef) {
      clauses.push('payload_ref = ?');
      params.push(options.payloadRef);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const statement = database.prepare(`
      SELECT *
      FROM task_registry
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `);
    statement.bind([...params, limit]);
    return listRows(statement);
  },

  async getTask(taskId: string): Promise<TaskRegistryRecord | null> {
    const database = await getDatabase();
    const statement = database.prepare('SELECT * FROM task_registry WHERE task_id = ? LIMIT 1');
    statement.bind([taskId]);
    if (!statement.step()) {
      statement.free();
      return null;
    }
    const row = mapRow(statement.getAsObject() as Record<string, unknown>);
    statement.free();
    return row;
  },

  async findLatestByPayloadRef(payloadRef: string): Promise<TaskRegistryRecord | null> {
    const rows = await this.listTasks({ payloadRef, limit: 20 });
    return rows.find((entry) => entry.status !== 'COMPLETED' && entry.status !== 'FAILED' && entry.status !== 'CANCELLED')
      ?? rows[0]
      ?? null;
  },

  async claimNextTask(options: TaskRegistryClaimOptions): Promise<TaskRegistryRecord | null> {
    return queueWrite(async () => {
      const database = await getDatabase();
      const now = Date.now();
      const tasks = await this.listTasks({
        statuses: RETRYABLE_STATUSES,
        laneTypes: options.permittedLanes,
        limit: 500,
      });
      const available = tasks
        .filter((task) => CLAIMABLE_STATUS_SET.has(task.status))
        .filter((task) => Date.parse(task.scheduledAt) <= now)
        .filter((task) => !task.leaseExpiresAt || Date.parse(task.leaseExpiresAt) <= now)
        .sort(compareTaskOrder);

      let next: TaskRegistryRecord | null = null;
      for (const task of available) {
        const meta = parsePayloadMeta(task.payloadMetaJson);
        const deps = meta.dependency_task_ids;
        if (Array.isArray(deps) && deps.length > 0) {
          const statement = database.prepare(
            `SELECT status FROM task_registry WHERE task_id IN (${deps.map(() => '?').join(', ')})`
          );
          statement.bind(deps);
          let allCompleted = true;
          while (statement.step()) {
            const row = statement.getAsObject();
            if (row.status !== 'COMPLETED') {
              allCompleted = false;
              break;
            }
          }
          statement.free();
          if (!allCompleted) {
            continue;
          }
        }
        next = task;
        break; // found the highest priority task that has its dependencies met
      }

      if (!next) {
        return null;
      }

      const leaseExpiresAt = new Date(now + Math.max(5_000, options.leaseDurationMs ?? 60_000)).toISOString();
      const executedAt = nowIso();
      const statement = database.prepare(`
        UPDATE task_registry
        SET status = ?, executed_at = ?, lease_owner = ?, lease_expires_at = ?, updated_at = ?, last_error = NULL
        WHERE task_id = ?
      `);
      statement.run(['RUNNING', executedAt, options.workerId, leaseExpiresAt, executedAt, next.taskId]);
      statement.free();
      await persistDatabase(database);
      return {
        ...next,
        status: 'RUNNING',
        executedAt,
        leaseOwner: options.workerId,
        leaseExpiresAt,
        updatedAt: executedAt,
        lastError: null,
      };
    });
  },

  async markTaskCompleted(taskId: string): Promise<TaskRegistryRecord | null> {
    return queueWrite(async () => {
      const database = await getDatabase();
      const existing = await this.getTask(taskId);
      if (!existing) {
        return null;
      }
      const completedAt = nowIso();
      const statement = database.prepare(`
        UPDATE task_registry
        SET status = ?, completed_at = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?, last_error = NULL
        WHERE task_id = ?
      `);
      statement.run(['COMPLETED', completedAt, completedAt, taskId]);
      statement.free();
      await persistDatabase(database);
      return {
        ...existing,
        status: 'COMPLETED',
        completedAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
        updatedAt: completedAt,
      };
    });
  },

  async markTaskCancelled(taskId: string, reason?: string): Promise<TaskRegistryRecord | null> {
    return queueWrite(async () => {
      const database = await getDatabase();
      const existing = await this.getTask(taskId);
      if (!existing) {
        return null;
      }
      const updatedAt = nowIso();
      const statement = database.prepare(`
        UPDATE task_registry
        SET status = ?, completed_at = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?, last_error = ?
        WHERE task_id = ?
      `);
      statement.run(['CANCELLED', updatedAt, updatedAt, reason ?? null, taskId]);
      statement.free();
      await persistDatabase(database);
      return {
        ...existing,
        status: 'CANCELLED',
        completedAt: updatedAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: reason ?? null,
        updatedAt,
      };
    });
  },

  async markTaskExpired(taskId: string, reason?: string): Promise<TaskRegistryRecord | null> {
    return queueWrite(async () => {
      const database = await getDatabase();
      const existing = await this.getTask(taskId);
      if (!existing) {
        return null;
      }
      const updatedAt = nowIso();
      const statement = database.prepare(`
        UPDATE task_registry
        SET status = ?, completed_at = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?, last_error = ?
        WHERE task_id = ?
      `);
      statement.run(['EXPIRED', updatedAt, updatedAt, reason ?? null, taskId]);
      statement.free();
      await persistDatabase(database);
      return {
        ...existing,
        status: 'EXPIRED',
        completedAt: updatedAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: reason ?? null,
        updatedAt,
      };
    });
  },

  async markTaskFailed(taskId: string, error: string): Promise<TaskRegistryRecord | null> {
    return queueWrite(async () => {
      const database = await getDatabase();
      const existing = await this.getTask(taskId);
      if (!existing) {
        return null;
      }

      const updatedAt = nowIso();
      const nextRetryCount = existing.retryCount + 1;
      const shouldRetry = nextRetryCount <= existing.maxRetries;
      const nextStatus: TaskRegistryStatus = shouldRetry ? 'RETRY_PENDING' : 'DLQ';
      const nextScheduledAt = shouldRetry ? computeRetryScheduleAt(existing) : existing.scheduledAt;
      const statement = database.prepare(`
        UPDATE task_registry
        SET status = ?, retry_count = ?, scheduled_at = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?, last_error = ?
        WHERE task_id = ?
      `);
      statement.run([nextStatus, nextRetryCount, nextScheduledAt, updatedAt, error.slice(0, 1_000), taskId]);
      statement.free();
      await persistDatabase(database);
      return {
        ...existing,
        status: nextStatus,
        retryCount: nextRetryCount,
        scheduledAt: nextScheduledAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: error.slice(0, 1_000),
        updatedAt,
      };
    });
  },

  async recoverLeasedTasks(): Promise<number> {
    return queueWrite(async () => {
      const database = await getDatabase();
      const running = await this.listTasks({ statuses: ['RUNNING'], limit: 1_000 });
      const recoverable = running.filter((task) => !task.leaseExpiresAt || Date.parse(task.leaseExpiresAt) <= Date.now());
      if (recoverable.length === 0) {
        return 0;
      }

      const updatedAt = nowIso();
      const statement = database.prepare(`
        UPDATE task_registry
        SET status = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?, last_error = COALESCE(last_error, ?)
        WHERE task_id = ?
      `);

      for (const task of recoverable) {
        statement.run(['RETRY_PENDING', updatedAt, 'Recovered after interrupted execution lease.', task.taskId]);
      }

      statement.free();
      await persistDatabase(database);
      return recoverable.length;
    });
  },

  async getTelemetry(): Promise<{
    totals: Record<TaskRegistryStatus, number>;
    byLane: Record<QueueLaneType, { queued: number; running: number; failed: number }>;
    overdueTasks: number;
  }> {
    const rows = await this.listTasks({ limit: 2_000 });
    const totals = {
      CREATED: 0,
      QUEUED: 0,
      SCHEDULED: 0,
      RUNNING: 0,
      RETRY_PENDING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
      EXPIRED: 0,
      DLQ: 0,
    } satisfies Record<TaskRegistryStatus, number>;
    const byLane: Record<QueueLaneType, { queued: number; running: number; failed: number }> = {
      MODEL: { queued: 0, running: 0, failed: 0 },
      CHANNEL: { queued: 0, running: 0, failed: 0 },
      SYSTEM: { queued: 0, running: 0, failed: 0 },
    };

    let overdueTasks = 0;
    const now = Date.now();

    for (const row of rows) {
      totals[row.status] += 1;
      if (row.status === 'QUEUED' || row.status === 'SCHEDULED' || row.status === 'RETRY_PENDING') {
        byLane[row.laneType].queued += 1;
      }
      if (row.status === 'RUNNING') {
        byLane[row.laneType].running += 1;
      }
      if (row.status === 'FAILED') {
        byLane[row.laneType].failed += 1;
      }
      if ((row.status === 'SCHEDULED' || row.status === 'RETRY_PENDING') && Date.parse(row.scheduledAt) < now) {
        overdueTasks += 1;
      }
    }

    return { totals, byLane, overdueTasks };
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    dbPromise = null;
    sqlRuntimePromise = null;
    writeQueue = Promise.resolve();
    await rm(getDbPath(), { force: true });
  },
};
