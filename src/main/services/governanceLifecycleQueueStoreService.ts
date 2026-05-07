import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { getAppDataRoot, mkdirSafe } from './governanceRepoService';

const DB_FILE_NAME = 'governance-lifecycle-queue.sqlite';

export type LifecycleDraftStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';
export type CronProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';
export type TaskQueueStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED';

export interface LifecycleDraftRecord {
  draftId: string;
  entityType: 'profile' | 'skill' | 'kpi' | 'data-input' | 'data-input-create';
  entityId: string;
  proposed: Record<string, unknown>;
  status: LifecycleDraftStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  reviewNote: string | null;
}

export interface CronProposalRecord {
  proposalId: string;
  jobId: string;
  name: string;
  expression: string;
  retentionDays: number;
  maxRuntimeMs: number;
  status: CronProposalStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  reviewNote: string | null;
}

export interface TaskQueueRecord {
  taskId: string;
  jobId: string;
  jobName: string;
  scheduledFor: string;
  source: 'SCHEDULED' | 'MISSED' | 'RECOVERY';
  status: TaskQueueStatus;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEnqueueResult {
  record: TaskQueueRecord;
  inserted: boolean;
  duplicatePrevented: boolean;
}

export interface TaskAuditLogRecord {
  id: number;
  eventType: string;
  jobId: string | null;
  taskId: string | null;
  details: string;
  createdAt: string;
}

export type CronJobRecoveryPolicy = 'SKIP' | 'RUN_ONCE' | 'CATCH_UP';

export interface CronJobStateRecord {
  id: string;
  name: string;
  expression: string;
  target: string;
  status: 'active' | 'paused';
  recoveryPolicy: CronJobRecoveryPolicy;
  retentionDays: number;
  maxRuntimeMs: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CronExecutionLogRecord {
  id: string;
  jobId: string;
  startedAt: string;
  completedAt: string;
  status: 'success' | 'failed' | 'skipped_overlap';
  errorMessage: string | null;
  source: 'scheduler' | 'manual' | 'recovery';
}

export interface CronLockRecord {
  jobId: string;
  lockAcquiredAt: string;
  lockExpiresAt: string;
}

let db: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);
const nowIso = (): string => new Date().toISOString();
const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const persistDatabase = async (database: Database): Promise<void> => {
  const buffer = database.serialize();
  await mkdirSafe(getAppDataRoot());
  await writeFile(getDbPath(), Buffer.from(buffer));
};

const initializeDatabase = async (): Promise<Database> => {
  await mkdirSafe(getAppDataRoot());

  let database: Database;
  if (existsSync(getDbPath())) {
    database = new Database(getDbPath());
  } else {
    database = new Database(':memory:');
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS lifecycle_drafts (
      draft_id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      proposed_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewer TEXT,
      review_note TEXT
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS cron_proposals (
      proposal_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      name TEXT NOT NULL,
      expression TEXT NOT NULL,
      retention_days INTEGER NOT NULL,
      max_runtime_ms INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewer TEXT,
      review_note TEXT
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS task_queue (
      task_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      job_name TEXT NOT NULL,
      scheduled_for TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS task_queue_job_due_occurrence_idx
      ON task_queue (job_id, scheduled_for);
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS task_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      job_id TEXT,
      task_id TEXT,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      expression TEXT NOT NULL,
      target TEXT NOT NULL,
      status TEXT NOT NULL,
      recovery_policy TEXT NOT NULL,
      retention_days INTEGER NOT NULL,
      max_runtime_ms INTEGER NOT NULL,
      last_run_at TEXT,
      next_run_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS cron_jobs_next_run_idx
      ON cron_jobs (status, next_run_at);
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS cron_execution_log (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      source TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES cron_jobs(id)
    );
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS cron_execution_log_job_idx
      ON cron_execution_log (job_id, started_at DESC);
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS cron_locks (
      job_id TEXT PRIMARY KEY,
      lock_acquired_at TEXT NOT NULL,
      lock_expires_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES cron_jobs(id)
    );
  `);

  db = database;
  return database;
};

const getDatabase = async (): Promise<Database> => {
  if (!db) {
    await initializeDatabase();
  }
  return db!;
};

const queueWrite = async (operation: () => Promise<void>): Promise<void> => {
  writeQueue = writeQueue.then(operation, operation);
  await writeQueue;
};

const normalizeCronJobState = (row: Record<string, unknown>): CronJobStateRecord => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? ''),
  expression: String(row.expression ?? ''),
  target: String(row.target ?? ''),
  status: String(row.status ?? 'active') as CronJobStateRecord['status'],
  recoveryPolicy: String(row.recovery_policy ?? 'RUN_ONCE') as CronJobRecoveryPolicy,
  retentionDays: Number(row.retention_days ?? 30),
  maxRuntimeMs: Number(row.max_runtime_ms ?? 5000),
  lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
  nextRunAt: row.next_run_at ? String(row.next_run_at) : null,
  createdAt: String(row.created_at ?? nowIso()),
  updatedAt: String(row.updated_at ?? nowIso()),
});

const parseJsonObject = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'string') {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore invalid json
  }
  return {};
};

const appendTaskAudit = (database: Database, eventType: string, details: string, jobId?: string | null, taskId?: string | null): void => {
  const stmt = database.prepare(
    'INSERT INTO task_audit_log (event_type, job_id, task_id, details, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(eventType, jobId ?? null, taskId ?? null, details, nowIso());
};

export const governanceLifecycleQueueStoreService = {
  async listCronJobs(): Promise<CronJobStateRecord[]> {
    const database = await getDatabase();
    const rows = database.prepare('SELECT * FROM cron_jobs ORDER BY name ASC').all() as Record<string, unknown>[];
    return rows.map(normalizeCronJobState);
  },

  async getCronJobById(jobId: string): Promise<CronJobStateRecord | null> {
    const database = await getDatabase();
    const row = database.prepare('SELECT * FROM cron_jobs WHERE id = ? LIMIT 1').get(jobId) as Record<string, unknown> | undefined;
    return row ? normalizeCronJobState(row) : null;
  },

  async upsertCronJob(payload: {
    id: string;
    name: string;
    expression: string;
    target: string;
    status: CronJobStateRecord['status'];
    recoveryPolicy: CronJobRecoveryPolicy;
    retentionDays: number;
    maxRuntimeMs: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
    createdAt?: string;
  }): Promise<CronJobStateRecord> {
    const record: CronJobStateRecord = {
      id: payload.id,
      name: payload.name,
      expression: payload.expression,
      target: payload.target,
      status: payload.status,
      recoveryPolicy: payload.recoveryPolicy,
      retentionDays: payload.retentionDays,
      maxRuntimeMs: payload.maxRuntimeMs,
      lastRunAt: payload.lastRunAt,
      nextRunAt: payload.nextRunAt,
      createdAt: payload.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };

    await queueWrite(async () => {
      const database = await getDatabase();
      database.prepare(`
        INSERT OR REPLACE INTO cron_jobs (
          id, name, expression, target, status, recovery_policy,
          retention_days, max_runtime_ms, last_run_at, next_run_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.id,
        record.name,
        record.expression,
        record.target,
        record.status,
        record.recoveryPolicy,
        record.retentionDays,
        record.maxRuntimeMs,
        record.lastRunAt,
        record.nextRunAt,
        record.createdAt,
        record.updatedAt
      );
      await persistDatabase(database);
    });

    const stored = await this.getCronJobById(payload.id);
    return stored ?? record;
  },

  async removeCronJob(jobId: string): Promise<boolean> {
    let changes = 0;
    await queueWrite(async () => {
      const database = await getDatabase();
      const result = database.prepare('DELETE FROM cron_jobs WHERE id = ?').run(jobId);
      changes = result.changes;

      if (changes > 0) {
        database.prepare('DELETE FROM cron_locks WHERE job_id = ?').run(jobId);
      }

      await persistDatabase(database);
    });
    return changes > 0;
  },

  async appendCronExecutionLog(payload: {
    id?: string;
    jobId: string;
    startedAt: string;
    completedAt: string;
    status: CronExecutionLogRecord['status'];
    errorMessage?: string | null;
    source: CronExecutionLogRecord['source'];
  }): Promise<CronExecutionLogRecord> {
    const record: CronExecutionLogRecord = {
      id: payload.id ?? createId('cron-exec'),
      jobId: payload.jobId,
      startedAt: payload.startedAt,
      completedAt: payload.completedAt,
      status: payload.status,
      errorMessage: payload.errorMessage ?? null,
      source: payload.source,
    };

    await queueWrite(async () => {
      const database = await getDatabase();
      database.prepare(`
        INSERT INTO cron_execution_log (
          id, job_id, started_at, completed_at, status, error_message, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.id,
        record.jobId,
        record.startedAt,
        record.completedAt,
        record.status,
        record.errorMessage,
        record.source
      );
      await persistDatabase(database);
    });

    return record;
  },

  async listCronExecutionLogByJob(jobId: string, limit = 100): Promise<CronExecutionLogRecord[]> {
    const database = await getDatabase();
    const rows = database.prepare(`
      SELECT id, job_id, started_at, completed_at, status, error_message, source
      FROM cron_execution_log
      WHERE job_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `).all(jobId, Math.max(1, Math.min(limit, 500))) as Record<string, unknown>[];

    return rows.map(row => ({
      id: String(row.id ?? ''),
      jobId: String(row.job_id ?? ''),
      startedAt: String(row.started_at ?? nowIso()),
      completedAt: String(row.completed_at ?? nowIso()),
      status: String(row.status ?? 'failed') as CronExecutionLogRecord['status'],
      errorMessage: row.error_message ? String(row.error_message) : null,
      source: String(row.source ?? 'scheduler') as CronExecutionLogRecord['source'],
    }));
  },

  async acquireCronLock(payload: { jobId: string; lockTimeoutMs: number }): Promise<{ acquired: boolean; lock: CronLockRecord | null }> {
    const now = new Date();
    const nowValue = now.toISOString();
    const expiresAt = new Date(now.getTime() + Math.max(1000, payload.lockTimeoutMs)).toISOString();
    let lock: CronLockRecord | null = null;
    let acquired = false;

    await queueWrite(async () => {
      const database = await getDatabase();
      const transaction = database.transaction(() => {
        try {
          const existingRow = database.prepare(
            'SELECT job_id, lock_acquired_at, lock_expires_at FROM cron_locks WHERE job_id = ? LIMIT 1'
          ).get(payload.jobId) as Record<string, unknown> | undefined;

          if (existingRow) {
            const existingExpiresAt = Date.parse(String(existingRow.lock_expires_at ?? ''));
            if (!Number.isNaN(existingExpiresAt) && existingExpiresAt > Date.now()) {
              lock = {
                jobId: String(existingRow.job_id ?? payload.jobId),
                lockAcquiredAt: String(existingRow.lock_acquired_at ?? nowValue),
                lockExpiresAt: String(existingRow.lock_expires_at ?? expiresAt),
              };
              return;
            }

            database.prepare(
              'UPDATE cron_locks SET lock_acquired_at = ?, lock_expires_at = ? WHERE job_id = ?'
            ).run(nowValue, expiresAt, payload.jobId);
          } else {
            database.prepare(
              'INSERT INTO cron_locks (job_id, lock_acquired_at, lock_expires_at) VALUES (?, ?, ?)'
            ).run(payload.jobId, nowValue, expiresAt);
          }

          acquired = true;
          lock = {
            jobId: payload.jobId,
            lockAcquiredAt: nowValue,
            lockExpiresAt: expiresAt,
          };
        } catch (error) {
          throw error;
        }
      });
      transaction();
      await persistDatabase(database);
    });

    return { acquired, lock };
  },

  async releaseCronLock(jobId: string): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();
      database.prepare('DELETE FROM cron_locks WHERE job_id = ?').run(jobId);
      await persistDatabase(database);
    });
  },

  async listCronLocks(): Promise<CronLockRecord[]> {
    const database = await getDatabase();
    const rows = database.prepare('SELECT job_id, lock_acquired_at, lock_expires_at FROM cron_locks ORDER BY job_id ASC').all() as Record<string, unknown>[];

    return rows.map(row => ({
      jobId: String(row.job_id ?? ''),
      lockAcquiredAt: String(row.lock_acquired_at ?? nowIso()),
      lockExpiresAt: String(row.lock_expires_at ?? nowIso()),
    }));
  },

  async stageLifecycleDraft(payload: {
    entityType: LifecycleDraftRecord['entityType'];
    entityId: string;
    proposed: Record<string, unknown>;
  }): Promise<LifecycleDraftRecord> {
    const record: LifecycleDraftRecord = {
      draftId: createId('draft'),
      entityType: payload.entityType,
      entityId: payload.entityId,
      proposed: payload.proposed,
      status: 'PENDING',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      reviewedAt: null,
      reviewer: null,
      reviewNote: null,
    };

    await queueWrite(async () => {
      const database = await getDatabase();
      database.prepare(`
        INSERT INTO lifecycle_drafts (draft_id, entity_type, entity_id, proposed_json, status, created_at, updated_at, reviewed_at, reviewer, review_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
      `).run(
        record.draftId,
        record.entityType,
        record.entityId,
        JSON.stringify(record.proposed),
        record.status,
        record.createdAt,
        record.updatedAt
      );
      await persistDatabase(database);
    });

    return record;
  },

  async listLifecycleDrafts(status?: LifecycleDraftStatus): Promise<LifecycleDraftRecord[]> {
    const database = await getDatabase();
    const rows = status
      ? database.prepare('SELECT * FROM lifecycle_drafts WHERE status = ? ORDER BY created_at DESC').all(status) as Record<string, unknown>[]
      : database.prepare('SELECT * FROM lifecycle_drafts ORDER BY created_at DESC').all() as Record<string, unknown>[];

    return rows.map(row => ({
      draftId: String(row.draft_id ?? ''),
      entityType: String(row.entity_type ?? 'profile') as LifecycleDraftRecord['entityType'],
      entityId: String(row.entity_id ?? ''),
      proposed: parseJsonObject(row.proposed_json),
      status: String(row.status ?? 'PENDING') as LifecycleDraftStatus,
      createdAt: String(row.created_at ?? nowIso()),
      updatedAt: String(row.updated_at ?? nowIso()),
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
      reviewer: row.reviewer ? String(row.reviewer) : null,
      reviewNote: row.review_note ? String(row.review_note) : null,
    }));
  },

  async reviewLifecycleDraft(payload: {
    draftId: string;
    status: Exclude<LifecycleDraftStatus, 'PENDING'>;
    reviewer: string;
    reviewNote?: string;
  }): Promise<LifecycleDraftRecord | null> {
    let updated: LifecycleDraftRecord | null = null;

    await queueWrite(async () => {
      const database = await getDatabase();
      const existingList = await this.listLifecycleDrafts();
      const existing = existingList.find((entry) => entry.draftId === payload.draftId) ?? null;
      if (!existing) {
        return;
      }

      const reviewedAt = nowIso();
      database.prepare(`
        UPDATE lifecycle_drafts
        SET status = ?, updated_at = ?, reviewed_at = ?, reviewer = ?, review_note = ?
        WHERE draft_id = ?
      `).run(
        payload.status,
        reviewedAt,
        reviewedAt,
        payload.reviewer,
        payload.reviewNote ?? null,
        payload.draftId
      );

      updated = {
        ...existing,
        status: payload.status,
        updatedAt: reviewedAt,
        reviewedAt,
        reviewer: payload.reviewer,
        reviewNote: payload.reviewNote ?? null,
      };

      await persistDatabase(database);
    });

    return updated;
  },

  async createCronProposal(payload: {
    jobId: string;
    name: string;
    expression: string;
    retentionDays: number;
    maxRuntimeMs: number;
  }): Promise<CronProposalRecord> {
    const record: CronProposalRecord = {
      proposalId: createId('cron-proposal'),
      jobId: payload.jobId,
      name: payload.name,
      expression: payload.expression,
      retentionDays: payload.retentionDays,
      maxRuntimeMs: payload.maxRuntimeMs,
      status: 'PENDING',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      reviewedAt: null,
      reviewer: null,
      reviewNote: null,
    };

    await queueWrite(async () => {
      const database = await getDatabase();
      database.prepare(`
        INSERT INTO cron_proposals (proposal_id, job_id, name, expression, retention_days, max_runtime_ms, status, created_at, updated_at, reviewed_at, reviewer, review_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
      `).run(
        record.proposalId,
        record.jobId,
        record.name,
        record.expression,
        record.retentionDays,
        record.maxRuntimeMs,
        record.status,
        record.createdAt,
        record.updatedAt
      );
      await persistDatabase(database);
    });

    return record;
  },

  async listCronProposals(status?: CronProposalStatus): Promise<CronProposalRecord[]> {
    const database = await getDatabase();
    const rows = status
      ? database.prepare('SELECT * FROM cron_proposals WHERE status = ? ORDER BY created_at DESC').all(status) as Record<string, unknown>[]
      : database.prepare('SELECT * FROM cron_proposals ORDER BY created_at DESC').all() as Record<string, unknown>[];

    return rows.map(row => ({
      proposalId: String(row.proposal_id ?? ''),
      jobId: String(row.job_id ?? ''),
      name: String(row.name ?? ''),
      expression: String(row.expression ?? ''),
      retentionDays: Number(row.retention_days ?? 30),
      maxRuntimeMs: Number(row.max_runtime_ms ?? 5000),
      status: String(row.status ?? 'PENDING') as CronProposalStatus,
      createdAt: String(row.created_at ?? nowIso()),
      updatedAt: String(row.updated_at ?? nowIso()),
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
      reviewer: row.reviewer ? String(row.reviewer) : null,
      reviewNote: row.review_note ? String(row.review_note) : null,
    }));
  },

  async reviewCronProposal(payload: {
    proposalId: string;
    status: Exclude<CronProposalStatus, 'PENDING'>;
    reviewer: string;
    reviewNote?: string;
  }): Promise<CronProposalRecord | null> {
    let updated: CronProposalRecord | null = null;

    await queueWrite(async () => {
      const database = await getDatabase();
      const existingList = await this.listCronProposals();
      const existing = existingList.find((entry) => entry.proposalId === payload.proposalId) ?? null;
      if (!existing) {
        return;
      }

      const reviewedAt = nowIso();
      database.prepare(`
        UPDATE cron_proposals
        SET status = ?, updated_at = ?, reviewed_at = ?, reviewer = ?, review_note = ?
        WHERE proposal_id = ?
      `).run(
        payload.status,
        reviewedAt,
        reviewedAt,
        payload.reviewer,
        payload.reviewNote ?? null,
        payload.proposalId
      );

      updated = {
        ...existing,
        status: payload.status,
        updatedAt: reviewedAt,
        reviewedAt,
        reviewer: payload.reviewer,
        reviewNote: payload.reviewNote ?? null,
      };

      appendTaskAudit(
        database,
        'cron_proposal_reviewed',
        `Cron proposal ${payload.proposalId} moved to ${payload.status}`,
        existing.jobId,
        null,
      );

      await persistDatabase(database);
    });

    return updated;
  },

  async enqueueTask(payload: {
    jobId: string;
    jobName: string;
    scheduledFor: string;
    source: TaskQueueRecord['source'];
  }): Promise<TaskEnqueueResult> {
    const record: TaskQueueRecord = {
      taskId: createId('task'),
      jobId: payload.jobId,
      jobName: payload.jobName,
      scheduledFor: payload.scheduledFor,
      source: payload.source,
      status: 'PENDING',
      attemptCount: 0,
      lastError: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    let result: TaskEnqueueResult = {
      record,
      inserted: false,
      duplicatePrevented: false,
    };

    await queueWrite(async () => {
      const database = await getDatabase();
      const existingRow = database.prepare(`
        SELECT task_id, job_id, job_name, scheduled_for, source, status, attempt_count, last_error, created_at, updated_at
        FROM task_queue
        WHERE job_id = ? AND scheduled_for = ?
        LIMIT 1
      `).get(payload.jobId, payload.scheduledFor) as Record<string, unknown> | undefined;

      if (existingRow) {
        result = {
          record: {
            taskId: String(existingRow.task_id ?? ''),
            jobId: String(existingRow.job_id ?? ''),
            jobName: String(existingRow.job_name ?? ''),
            scheduledFor: String(existingRow.scheduled_for ?? payload.scheduledFor),
            source: String(existingRow.source ?? payload.source) as TaskQueueRecord['source'],
            status: String(existingRow.status ?? 'PENDING') as TaskQueueStatus,
            attemptCount: Number(existingRow.attempt_count ?? 0),
            lastError: existingRow.last_error ? String(existingRow.last_error) : null,
            createdAt: String(existingRow.created_at ?? nowIso()),
            updatedAt: String(existingRow.updated_at ?? nowIso()),
          },
          inserted: false,
          duplicatePrevented: true,
        };
        appendTaskAudit(
          database,
          'task_enqueue_skipped_duplicate',
          `Skipped duplicate due occurrence for job ${payload.jobId} at ${payload.scheduledFor}`,
          payload.jobId,
          null,
        );
        await persistDatabase(database);
        return;
      }

      database.prepare(`
        INSERT INTO task_queue (task_id, job_id, job_name, scheduled_for, source, status, attempt_count, last_error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.taskId,
        record.jobId,
        record.jobName,
        record.scheduledFor,
        record.source,
        record.status,
        record.attemptCount,
        null,
        record.createdAt,
        record.updatedAt
      );

      appendTaskAudit(database, 'task_enqueued', `Task ${record.taskId} enqueued (${record.source})`, record.jobId, record.taskId);
      result = {
        record,
        inserted: true,
        duplicatePrevented: false,
      };
      await persistDatabase(database);
    });

    return result;
  },

  async listPendingTasks(): Promise<TaskQueueRecord[]> {
    const database = await getDatabase();
    const rows = database.prepare('SELECT * FROM task_queue WHERE status IN (?, ?) ORDER BY scheduled_for ASC').all('PENDING', 'INTERRUPTED') as Record<string, unknown>[];

    return rows.map(row => ({
      taskId: String(row.task_id ?? ''),
      jobId: String(row.job_id ?? ''),
      jobName: String(row.job_name ?? ''),
      scheduledFor: String(row.scheduled_for ?? nowIso()),
      source: String(row.source ?? 'SCHEDULED') as TaskQueueRecord['source'],
      status: String(row.status ?? 'PENDING') as TaskQueueStatus,
      attemptCount: Number(row.attempt_count ?? 0),
      lastError: row.last_error ? String(row.last_error) : null,
      createdAt: String(row.created_at ?? nowIso()),
      updatedAt: String(row.updated_at ?? nowIso()),
    }));
  },

  async markTaskRunning(taskId: string): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();
      database.prepare('UPDATE task_queue SET status = ?, attempt_count = attempt_count + 1, updated_at = ? WHERE task_id = ?').run('RUNNING', nowIso(), taskId);
      appendTaskAudit(database, 'task_running', `Task ${taskId} running`, null, taskId);
      await persistDatabase(database);
    });
  },

  async markTaskCompleted(taskId: string): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();
      database.prepare('UPDATE task_queue SET status = ?, updated_at = ?, last_error = NULL WHERE task_id = ?').run('COMPLETED', nowIso(), taskId);
      appendTaskAudit(database, 'task_completed', `Task ${taskId} completed`, null, taskId);
      await persistDatabase(database);
    });
  },

  async markTaskFailed(taskId: string, error: string): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();
      database.prepare('UPDATE task_queue SET status = ?, updated_at = ?, last_error = ? WHERE task_id = ?').run('FAILED', nowIso(), error, taskId);
      appendTaskAudit(database, 'task_failed', `Task ${taskId} failed: ${error}`, null, taskId);
      await persistDatabase(database);
    });
  },

  async recoverInterruptedTasks(): Promise<number> {
    let recovered = 0;
    await queueWrite(async () => {
      const database = await getDatabase();
      const result = database.prepare('UPDATE task_queue SET status = ?, updated_at = ? WHERE status = ?').run('INTERRUPTED', nowIso(), 'RUNNING');
      recovered = result.changes;
      if (recovered > 0) {
        appendTaskAudit(database, 'task_recovered', `Recovered ${recovered} interrupted tasks`, null, null);
      }
      await persistDatabase(database);
    });
    return recovered;
  },

  async getTaskAuditLog(limit = 100): Promise<TaskAuditLogRecord[]> {
    const database = await getDatabase();
    const rows = database.prepare('SELECT id, event_type, job_id, task_id, details, created_at FROM task_audit_log ORDER BY id DESC LIMIT ?').all(Math.max(1, Math.min(limit, 500))) as Record<string, unknown>[];

    return rows.map(row => ({
      id: Number(row.id ?? 0),
      eventType: String(row.event_type ?? ''),
      jobId: row.job_id ? String(row.job_id) : null,
      taskId: row.task_id ? String(row.task_id) : null,
      details: String(row.details ?? ''),
      createdAt: String(row.created_at ?? nowIso()),
    }));
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    db = null;
    writeQueue = Promise.resolve();
    await rm(getDbPath(), { force: true });
  },
};
