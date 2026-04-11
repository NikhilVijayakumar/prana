import { encryptSqliteBuffer, decryptSqliteBuffer } from './sqliteCryptoUtil';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot } from './governanceRepoService';

const DB_FILE_NAME = 'context-history.sqlite';

export type StoredContextSessionStatus = 'ACTIVE' | 'ARCHIVED';

export interface StoredHistoryDigest {
  id: string;
  sessionId: string;
  summary: string;
  metadataJson: string;
  beforeTokens: number;
  afterTokens: number;
  removedMessages: number;
  compactedAt: string;
  createdAt: string;
}

interface CreateDigestPayload {
  id: string;
  sessionId: string;
  summary: string;
  metadataJson: string;
  beforeTokens: number;
  afterTokens: number;
  removedMessages: number;
  compactedAt: string;
}

interface UpsertRawMessagePayload {
  id: string;
  sessionId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tokenEstimate: number;
  createdAt: string;
  payloadJson: string;
}

interface ReplaceActiveContextPayload {
  sessionId: string;
  messages: Array<{
    id: string;
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tokenEstimate: number;
    createdAt: string;
  }>;
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let cachedDatabase: Database | null = null;
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
    CREATE TABLE IF NOT EXISTS history_digests (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      before_tokens INTEGER NOT NULL,
      after_tokens INTEGER NOT NULL,
      removed_messages INTEGER NOT NULL,
      compacted_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  database.run('CREATE INDEX IF NOT EXISTS idx_history_digests_session ON history_digests(session_id, compacted_at DESC);');

  database.run(`
    CREATE TABLE IF NOT EXISTS context_session_state (
      session_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      last_summary TEXT,
      archived_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS chat_history_raw (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      token_estimate INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
  `);

  database.run('CREATE INDEX IF NOT EXISTS idx_chat_history_raw_session ON chat_history_raw(session_id, created_at DESC);');

  database.run(`
    CREATE TABLE IF NOT EXISTS chat_context_active (
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      token_estimate INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      active_rank INTEGER NOT NULL,
      PRIMARY KEY (session_id, message_id)
    );
  `);

  database.run('CREATE INDEX IF NOT EXISTS idx_chat_context_active_session ON chat_context_active(session_id, active_rank ASC);');

  await persistDatabase(database);
  cachedDatabase = database;
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

export const contextDigestStoreService = {
  async dispose(): Promise<void> {
    await writeQueue;
    if (cachedDatabase) {
      cachedDatabase.close();
      cachedDatabase = null;
    }
    dbPromise = null;
  },

  async ensureSessionActive(sessionId: string, summary?: string | null): Promise<void> {
    await queueWrite(async () => {
      const db = await getDatabase();
      const statement = db.prepare(`
        INSERT INTO context_session_state (session_id, status, last_summary, archived_at, updated_at)
        VALUES (?, 'ACTIVE', ?, NULL, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          status = 'ACTIVE',
          last_summary = excluded.last_summary,
          archived_at = NULL,
          updated_at = excluded.updated_at
      `);

      const now = new Date().toISOString();
      statement.run([sessionId, summary ?? null, now]);
      statement.free();
      await persistDatabase(db);
    });
  },

  async archiveSession(sessionId: string, summary?: string | null): Promise<void> {
    await queueWrite(async () => {
      const db = await getDatabase();
      const statement = db.prepare(`
        INSERT INTO context_session_state (session_id, status, last_summary, archived_at, updated_at)
        VALUES (?, 'ARCHIVED', ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          status = 'ARCHIVED',
          last_summary = excluded.last_summary,
          archived_at = excluded.archived_at,
          updated_at = excluded.updated_at
      `);

      const now = new Date().toISOString();
      statement.run([sessionId, summary ?? null, now, now]);
      statement.free();
      await persistDatabase(db);
    });
  },

  async appendRawMessage(payload: UpsertRawMessagePayload): Promise<void> {
    await queueWrite(async () => {
      const db = await getDatabase();
      const statement = db.prepare(`
        INSERT INTO chat_history_raw (id, session_id, role, content, token_estimate, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          role = excluded.role,
          content = excluded.content,
          token_estimate = excluded.token_estimate,
          created_at = excluded.created_at,
          payload_json = excluded.payload_json
      `);

      statement.run([
        payload.id,
        payload.sessionId,
        payload.role,
        payload.content,
        payload.tokenEstimate,
        payload.createdAt,
        payload.payloadJson,
      ]);
      statement.free();
      await persistDatabase(db);
    });
  },

  async replaceActiveContext(payload: ReplaceActiveContextPayload): Promise<void> {
    await queueWrite(async () => {
      const db = await getDatabase();
      const deleteStatement = db.prepare('DELETE FROM chat_context_active WHERE session_id = ?');
      deleteStatement.run([payload.sessionId]);
      deleteStatement.free();

      const insertStatement = db.prepare(`
        INSERT INTO chat_context_active (session_id, message_id, role, content, token_estimate, created_at, active_rank)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      payload.messages.forEach((message, index) => {
        insertStatement.run([
          payload.sessionId,
          message.id,
          message.role,
          message.content,
          message.tokenEstimate,
          message.createdAt,
          index,
        ]);
      });

      insertStatement.free();
      await persistDatabase(db);
    });
  },

  async createDigest(payload: CreateDigestPayload): Promise<StoredHistoryDigest> {
    const createdAt = new Date().toISOString();

    await queueWrite(async () => {
      const db = await getDatabase();
      const statement = db.prepare(`
        INSERT INTO history_digests (
          id,
          session_id,
          summary,
          metadata_json,
          before_tokens,
          after_tokens,
          removed_messages,
          compacted_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      statement.run([
        payload.id,
        payload.sessionId,
        payload.summary,
        payload.metadataJson,
        payload.beforeTokens,
        payload.afterTokens,
        payload.removedMessages,
        payload.compactedAt,
        createdAt,
      ]);
      statement.free();
      await persistDatabase(db);
    });

    return {
      id: payload.id,
      sessionId: payload.sessionId,
      summary: payload.summary,
      metadataJson: payload.metadataJson,
      beforeTokens: payload.beforeTokens,
      afterTokens: payload.afterTokens,
      removedMessages: payload.removedMessages,
      compactedAt: payload.compactedAt,
      createdAt,
    };
  },

  async getLatestDigest(sessionId: string): Promise<StoredHistoryDigest | null> {
    const db = await getDatabase();
    const statement = db.prepare(`
      SELECT id, session_id, summary, metadata_json, before_tokens, after_tokens, removed_messages, compacted_at, created_at
      FROM history_digests
      WHERE session_id = ?
      ORDER BY compacted_at DESC
      LIMIT 1
    `);

    statement.bind([sessionId]);
    if (!statement.step()) {
      statement.free();
      return null;
    }

    const row = statement.getAsObject() as Record<string, unknown>;
    statement.free();

    return {
      id: typeof row.id === 'string' ? row.id : '',
      sessionId: typeof row.session_id === 'string' ? row.session_id : sessionId,
      summary: typeof row.summary === 'string' ? row.summary : '',
      metadataJson: typeof row.metadata_json === 'string' ? row.metadata_json : '{}',
      beforeTokens: Number(row.before_tokens ?? 0),
      afterTokens: Number(row.after_tokens ?? 0),
      removedMessages: Number(row.removed_messages ?? 0),
      compactedAt: typeof row.compacted_at === 'string' ? row.compacted_at : '',
      createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    };
  },

  async listDigests(sessionId: string, limit = 20): Promise<StoredHistoryDigest[]> {
    const db = await getDatabase();
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const statement = db.prepare(`
      SELECT id, session_id, summary, metadata_json, before_tokens, after_tokens, removed_messages, compacted_at, created_at
      FROM history_digests
      WHERE session_id = ?
      ORDER BY compacted_at DESC
      LIMIT ?
    `);

    statement.bind([sessionId, safeLimit]);

    const rows: StoredHistoryDigest[] = [];
    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>;
      rows.push({
        id: typeof row.id === 'string' ? row.id : '',
        sessionId: typeof row.session_id === 'string' ? row.session_id : sessionId,
        summary: typeof row.summary === 'string' ? row.summary : '',
        metadataJson: typeof row.metadata_json === 'string' ? row.metadata_json : '{}',
        beforeTokens: Number(row.before_tokens ?? 0),
        afterTokens: Number(row.after_tokens ?? 0),
        removedMessages: Number(row.removed_messages ?? 0),
        compactedAt: typeof row.compacted_at === 'string' ? row.compacted_at : '',
        createdAt: typeof row.created_at === 'string' ? row.created_at : '',
      });
    }

    statement.free();
    return rows;
  },
};
