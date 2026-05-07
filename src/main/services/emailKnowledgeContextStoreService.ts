import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { getAppDataRoot, mkdirSafe } from './governanceRepoService';

const DB_FILE_NAME = 'email-knowledge-context.sqlite';
const DEFAULT_MAX_ROWS = 5000;
const DEFAULT_MAX_ROWS_PER_AGENT = 1000;
const DEFAULT_MAX_AGE_DAYS = 120;

export interface EmailKnowledgeContextEntry {
  entryId: string;
  agentId: string;
  accountId: string | null;
  emailUid: number | null;
  threadKey: string | null;
  contextKind: 'INTAKE' | 'FOLLOW_UP' | 'REMINDER' | 'SUMMARY' | 'NOTE';
  subject: string | null;
  sender: string | null;
  summary: string;
  followUpAt: string | null;
  priority: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

let db: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const nowIso = (): string => new Date().toISOString();
const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);

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
    CREATE TABLE IF NOT EXISTS email_knowledge_context (
      entry_id TEXT PRIMARY KEY,
      source_key TEXT UNIQUE,
      agent_id TEXT NOT NULL,
      account_id TEXT,
      email_uid INTEGER,
      thread_key TEXT,
      context_kind TEXT NOT NULL,
      subject TEXT,
      sender TEXT,
      summary TEXT NOT NULL,
      follow_up_at TEXT,
      priority INTEGER NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS email_context_agent_updated_idx
    ON email_knowledge_context (agent_id, updated_at DESC);
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS email_context_last_seen_idx
    ON email_knowledge_context (last_seen_at ASC);
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
    return {};
  }
  return {};
};

const mapRow = (row: Record<string, unknown>): EmailKnowledgeContextEntry => ({
  entryId: String(row.entry_id ?? ''),
  agentId: String(row.agent_id ?? ''),
  accountId: row.account_id ? String(row.account_id) : null,
  emailUid:
    typeof row.email_uid === 'number'
      ? row.email_uid
      : row.email_uid
        ? Number(row.email_uid)
        : null,
  threadKey: row.thread_key ? String(row.thread_key) : null,
  contextKind: String(row.context_kind ?? 'NOTE') as EmailKnowledgeContextEntry['contextKind'],
  subject: row.subject ? String(row.subject) : null,
  sender: row.sender ? String(row.sender) : null,
  summary: String(row.summary ?? ''),
  followUpAt: row.follow_up_at ? String(row.follow_up_at) : null,
  priority: typeof row.priority === 'number' ? row.priority : Number(row.priority ?? 0),
  metadata: parseJsonObject(row.metadata_json),
  createdAt: String(row.created_at ?? nowIso()),
  updatedAt: String(row.updated_at ?? nowIso()),
  lastSeenAt: String(row.last_seen_at ?? nowIso()),
});

export const emailKnowledgeContextStoreService = {
  async upsertEntry(payload: {
    entryId?: string;
    sourceKey?: string | null;
    agentId: string;
    accountId?: string | null;
    emailUid?: number | null;
    threadKey?: string | null;
    contextKind: EmailKnowledgeContextEntry['contextKind'];
    subject?: string | null;
    sender?: string | null;
    summary: string;
    followUpAt?: string | null;
    priority?: number;
    metadata?: Record<string, unknown>;
  }): Promise<EmailKnowledgeContextEntry> {
    const now = nowIso();
    const entryId = payload.entryId ?? createId('ctx');
    const sourceKey = payload.sourceKey ?? null;

    await queueWrite(async () => {
      const db = await getDatabase();
      db.prepare(`
        INSERT OR REPLACE INTO email_knowledge_context (
          entry_id,
          source_key,
          agent_id,
          account_id,
          email_uid,
          thread_key,
          context_kind,
          subject,
          sender,
          summary,
          follow_up_at,
          priority,
          metadata_json,
          created_at,
          updated_at,
          last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entryId,
        sourceKey,
        payload.agentId,
        payload.accountId ?? null,
        payload.emailUid ?? null,
        payload.threadKey ?? null,
        payload.contextKind,
        payload.subject ?? null,
        payload.sender ?? null,
        payload.summary,
        payload.followUpAt ?? null,
        payload.priority ?? 0,
        JSON.stringify(payload.metadata ?? {}),
        now,
        now,
        now
      );
      await persistDatabase(db);
    });

    const entries = await this.listEntries({
      agentId: payload.agentId,
      sourceKey: sourceKey ?? undefined,
      limit: 1,
    });
    if (entries.length > 0) {
      return entries[0];
    }

    return {
      entryId,
      agentId: payload.agentId,
      accountId: payload.accountId ?? null,
      emailUid: payload.emailUid ?? null,
      threadKey: payload.threadKey ?? null,
      contextKind: payload.contextKind,
      subject: payload.subject ?? null,
      sender: payload.sender ?? null,
      summary: payload.summary,
      followUpAt: payload.followUpAt ?? null,
      priority: payload.priority ?? 0,
      metadata: payload.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    };
  },

  async listEntries(payload: {
    agentId?: string;
    accountId?: string;
    sourceKey?: string;
    query?: string;
    limit?: number;
  }): Promise<EmailKnowledgeContextEntry[]> {
    const db = await getDatabase();

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (payload.agentId) {
      conditions.push('agent_id = ?');
      params.push(payload.agentId);
    }

    if (payload.accountId) {
      conditions.push('account_id = ?');
      params.push(payload.accountId);
    }

    if (payload.sourceKey) {
      conditions.push('source_key = ?');
      params.push(payload.sourceKey);
    }

    if (payload.query && payload.query.trim().length > 0) {
      conditions.push('(summary LIKE ? OR subject LIKE ? OR sender LIKE ?)');
      const q = `%${payload.query.trim()}%`;
      params.push(q, q, q);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.max(1, Math.min(payload.limit ?? 100, 1000));

    const rows = db.prepare(`
      SELECT *
      FROM email_knowledge_context
      ${where}
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(...params, limit) as Record<string, unknown>[];

    return rows.map(mapRow);
  },

  async cleanup(payload?: {
    maxRows?: number;
    maxRowsPerAgent?: number;
    maxAgeDays?: number;
  }): Promise<{ deleted: number; remaining: number }> {
    const maxRows = Math.max(100, payload?.maxRows ?? DEFAULT_MAX_ROWS);
    const maxRowsPerAgent = Math.max(50, payload?.maxRowsPerAgent ?? DEFAULT_MAX_ROWS_PER_AGENT);
    const maxAgeDays = Math.max(1, payload?.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS);
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();

    let deleted = 0;

    await queueWrite(async () => {
      const db = await getDatabase();

      const deleteOld = db.prepare('DELETE FROM email_knowledge_context WHERE last_seen_at < ?');
      deleteOld.run(cutoff);
      deleted += deleteOld.run(cutoff).changes;

      const agentIds = (db.prepare('SELECT DISTINCT agent_id FROM email_knowledge_context').all() as Record<string, unknown>[])
        .map(row => String(row.agent_id ?? ''))
        .filter(id => id.length > 0);

      for (const agentId of agentIds) {
        const overRows = db.prepare(`
          SELECT entry_id
          FROM email_knowledge_context
          WHERE agent_id = ?
          ORDER BY updated_at DESC
          LIMIT -1 OFFSET ?
        `).all(agentId, maxRowsPerAgent) as Record<string, unknown>[];

        if (overRows.length > 0) {
          const delStmt = db.prepare('DELETE FROM email_knowledge_context WHERE entry_id = ?');
          for (const row of overRows) {
            delStmt.run(String(row.entry_id ?? ''));
          }
          deleted += overRows.length;
        }
      }

      const globalOverflow = db.prepare(`
        SELECT entry_id
        FROM email_knowledge_context
        ORDER BY updated_at DESC
        LIMIT -1 OFFSET ?
      `).all(maxRows) as Record<string, unknown>[];

      if (globalOverflow.length > 0) {
        const delStmt = db.prepare('DELETE FROM email_knowledge_context WHERE entry_id = ?');
        for (const row of globalOverflow) {
          delStmt.run(String(row.entry_id ?? ''));
        }
        deleted += globalOverflow.length;
      }

      await persistDatabase(db);
    });

    const remaining = await this.countEntries();
    return { deleted, remaining };
  },

  async countEntries(): Promise<number> {
    const db = await getDatabase();
    const row = db.prepare('SELECT COUNT(*) AS total FROM email_knowledge_context').get() as { total?: unknown };
    return Number(row?.total ?? 0);
  },

  async dispose(): Promise<void> {
    await writeQueue;
    if (db) {
      db.close();
    }
    db = null;
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    if (db) {
      db.close();
    }
    db = null;
    writeQueue = Promise.resolve();
    await rm(getDbPath(), { force: true });
  },
};
