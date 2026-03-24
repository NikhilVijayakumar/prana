import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot } from './governanceRepoService';

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

export interface TaskAuditLogRecord {
  id: number;
  eventType: string;
  jobId: string | null;
  taskId: string | null;
  details: string;
  createdAt: string;
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);

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
  await writeFile(getDbPath(), Buffer.from(bytes));
};

const initializeDatabase = async (): Promise<Database> => {
  const sqlRuntime = await getSqlRuntime();
  await mkdir(getAppDataRoot(), { recursive: true });

  let database: Database;
  if (existsSync(getDbPath())) {
    const raw = await readFile(getDbPath());
    database = new sqlRuntime.Database(new Uint8Array(raw));
  } else {
    database = new sqlRuntime.Database();
  }

  database.run(`
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

  database.run(`
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

  database.run(`
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

  database.run(`
    CREATE TABLE IF NOT EXISTS task_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      job_id TEXT,
      task_id TEXT,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
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

const queueWrite = async (operation: () => Promise<void>): Promise<void> => {
  writeQueue = writeQueue.then(operation, operation);
  await writeQueue;
};

const nowIso = (): string => new Date().toISOString();
const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
  const statement = database.prepare(
    'INSERT INTO task_audit_log (event_type, job_id, task_id, details, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  statement.run([eventType, jobId ?? null, taskId ?? null, details, nowIso()]);
  statement.free();
};

export const governanceLifecycleQueueStoreService = {
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
      const statement = database.prepare(`
        INSERT INTO lifecycle_drafts (draft_id, entity_type, entity_id, proposed_json, status, created_at, updated_at, reviewed_at, reviewer, review_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
      `);
      statement.run([
        record.draftId,
        record.entityType,
        record.entityId,
        JSON.stringify(record.proposed),
        record.status,
        record.createdAt,
        record.updatedAt,
      ]);
      statement.free();
      await persistDatabase(database);
    });

    return record;
  },

  async listLifecycleDrafts(status?: LifecycleDraftStatus): Promise<LifecycleDraftRecord[]> {
    const database = await getDatabase();
    const rows: LifecycleDraftRecord[] = [];
    const hasFilter = typeof status === 'string';
    const statement = hasFilter
      ? database.prepare('SELECT * FROM lifecycle_drafts WHERE status = ? ORDER BY created_at DESC')
      : database.prepare('SELECT * FROM lifecycle_drafts ORDER BY created_at DESC');

    if (hasFilter) {
      statement.bind([status]);
    }

    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>;
      rows.push({
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
      });
    }

    statement.free();
    return rows;
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
      const statement = database.prepare(`
        UPDATE lifecycle_drafts
        SET status = ?, updated_at = ?, reviewed_at = ?, reviewer = ?, review_note = ?
        WHERE draft_id = ?
      `);
      statement.run([
        payload.status,
        reviewedAt,
        reviewedAt,
        payload.reviewer,
        payload.reviewNote ?? null,
        payload.draftId,
      ]);
      statement.free();

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
      const statement = database.prepare(`
        INSERT INTO cron_proposals (proposal_id, job_id, name, expression, retention_days, max_runtime_ms, status, created_at, updated_at, reviewed_at, reviewer, review_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
      `);
      statement.run([
        record.proposalId,
        record.jobId,
        record.name,
        record.expression,
        record.retentionDays,
        record.maxRuntimeMs,
        record.status,
        record.createdAt,
        record.updatedAt,
      ]);
      statement.free();
      await persistDatabase(database);
    });

    return record;
  },

  async listCronProposals(status?: CronProposalStatus): Promise<CronProposalRecord[]> {
    const database = await getDatabase();
    const rows: CronProposalRecord[] = [];
    const hasFilter = typeof status === 'string';
    const statement = hasFilter
      ? database.prepare('SELECT * FROM cron_proposals WHERE status = ? ORDER BY created_at DESC')
      : database.prepare('SELECT * FROM cron_proposals ORDER BY created_at DESC');

    if (hasFilter) {
      statement.bind([status]);
    }

    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>;
      rows.push({
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
      });
    }

    statement.free();
    return rows;
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
      const statement = database.prepare(`
        UPDATE cron_proposals
        SET status = ?, updated_at = ?, reviewed_at = ?, reviewer = ?, review_note = ?
        WHERE proposal_id = ?
      `);
      statement.run([
        payload.status,
        reviewedAt,
        reviewedAt,
        payload.reviewer,
        payload.reviewNote ?? null,
        payload.proposalId,
      ]);
      statement.free();

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
  }): Promise<TaskQueueRecord> {
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

    await queueWrite(async () => {
      const database = await getDatabase();
      const statement = database.prepare(`
        INSERT INTO task_queue (task_id, job_id, job_name, scheduled_for, source, status, attempt_count, last_error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      statement.run([
        record.taskId,
        record.jobId,
        record.jobName,
        record.scheduledFor,
        record.source,
        record.status,
        record.attemptCount,
        null,
        record.createdAt,
        record.updatedAt,
      ]);
      statement.free();

      appendTaskAudit(database, 'task_enqueued', `Task ${record.taskId} enqueued (${record.source})`, record.jobId, record.taskId);
      await persistDatabase(database);
    });

    return record;
  },

  async listPendingTasks(): Promise<TaskQueueRecord[]> {
    const database = await getDatabase();
    const statement = database.prepare('SELECT * FROM task_queue WHERE status IN (?, ?) ORDER BY scheduled_for ASC');
    statement.bind(['PENDING', 'INTERRUPTED']);
    const rows: TaskQueueRecord[] = [];

    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>;
      rows.push({
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
      });
    }

    statement.free();
    return rows;
  },

  async markTaskRunning(taskId: string): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();
      const statement = database.prepare('UPDATE task_queue SET status = ?, attempt_count = attempt_count + 1, updated_at = ? WHERE task_id = ?');
      statement.run(['RUNNING', nowIso(), taskId]);
      statement.free();
      appendTaskAudit(database, 'task_running', `Task ${taskId} running`, null, taskId);
      await persistDatabase(database);
    });
  },

  async markTaskCompleted(taskId: string): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();
      const statement = database.prepare('UPDATE task_queue SET status = ?, updated_at = ?, last_error = NULL WHERE task_id = ?');
      statement.run(['COMPLETED', nowIso(), taskId]);
      statement.free();
      appendTaskAudit(database, 'task_completed', `Task ${taskId} completed`, null, taskId);
      await persistDatabase(database);
    });
  },

  async markTaskFailed(taskId: string, error: string): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();
      const statement = database.prepare('UPDATE task_queue SET status = ?, updated_at = ?, last_error = ? WHERE task_id = ?');
      statement.run(['FAILED', nowIso(), error, taskId]);
      statement.free();
      appendTaskAudit(database, 'task_failed', `Task ${taskId} failed: ${error}`, null, taskId);
      await persistDatabase(database);
    });
  },

  async recoverInterruptedTasks(): Promise<number> {
    let recovered = 0;
    await queueWrite(async () => {
      const database = await getDatabase();
      const statement = database.prepare('UPDATE task_queue SET status = ?, updated_at = ? WHERE status = ?');
      statement.run(['INTERRUPTED', nowIso(), 'RUNNING']);
      recovered = Number(database.exec('SELECT changes() AS count')[0]?.values?.[0]?.[0] ?? 0);
      statement.free();
      if (recovered > 0) {
        appendTaskAudit(database, 'task_recovered', `Recovered ${recovered} interrupted tasks`, null, null);
      }
      await persistDatabase(database);
    });
    return recovered;
  },

  async getTaskAuditLog(limit = 100): Promise<TaskAuditLogRecord[]> {
    const database = await getDatabase();
    const statement = database.prepare('SELECT id, event_type, job_id, task_id, details, created_at FROM task_audit_log ORDER BY id DESC LIMIT ?');
    statement.bind([Math.max(1, Math.min(limit, 500))]);
    const rows: TaskAuditLogRecord[] = [];

    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>;
      rows.push({
        id: Number(row.id ?? 0),
        eventType: String(row.event_type ?? ''),
        jobId: row.job_id ? String(row.job_id) : null,
        taskId: row.task_id ? String(row.task_id) : null,
        details: String(row.details ?? ''),
        createdAt: String(row.created_at ?? nowIso()),
      });
    }

    statement.free();
    return rows;
  },
};
