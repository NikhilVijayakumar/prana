import { encryptSqliteBuffer, decryptSqliteBuffer } from './sqliteCryptoUtil';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { getSqliteRoot, mkdirSafe } from './governanceRepoService';

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

let db: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const getDbPath = (): string => join(getSqliteRoot(), DB_FILE_NAME);

const persistDatabase = async (database: Database): Promise<void> => {
  const buffer = database.serialize();
  await mkdirSafe(getSqliteRoot());
  await writeFile(getDbPath(), await encryptSqliteBuffer(Buffer.from(buffer)));
};

const initializeDatabase = async (): Promise<Database> => {
  await mkdirSafe(getSqliteRoot());

  let database: Database;
  if (existsSync(getDbPath())) {
    const raw = await readFile(getDbPath());
    try {
      const decrypted = await decryptSqliteBuffer(Buffer.from(raw));
      const tempPath = `${getDbPath()}.tmp`;
      await writeFile(tempPath, decrypted);
      database = new Database(tempPath);
    } catch {
      const tempPath = `${getDbPath()}.tmp`;
      await writeFile(tempPath, raw);
      database = new Database(tempPath);
    }
  } else {
    database = new Database(':memory:');
  }

  database.exec(`
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

  database.exec('CREATE INDEX IF NOT EXISTS idx_history_digests_session ON history_digests(session_id, compacted_at DESC);');

  database.exec(`
    CREATE TABLE IF NOT EXISTS context_session_state (
      session_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      last_summary TEXT,
      archived_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  database.exec(`
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

  database.exec('CREATE INDEX IF NOT EXISTS idx_chat_history_raw_session ON chat_history_raw(session_id, created_at DESC);');

  database.exec(`
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

  database.exec('CREATE INDEX IF NOT EXISTS idx_chat_context_active_session ON chat_context_active(session_id, active_rank ASC);');

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

export const contextDigestStoreService = {
  async dispose(): Promise<void> {
    await writeQueue;
    if (db) {
      db.close();
      db = null;
    }
  },

  async ensureSessionActive(sessionId: string, summary?: string | null): Promise<void> {
    await queueWrite(async () => {
      const db = await getDatabase();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO context_session_state (session_id, status, last_summary, archived_at, updated_at)
        VALUES (?, 'ACTIVE', ?, NULL, ?)
      `);

      const now = new Date().toISOString();
      stmt.run([sessionId, summary ?? null, now]);
      stmt.free();
      await persistDatabase(db);
    });
  },

  async archiveSession(sessionId: string, summary?: string | null): Promise<void> {
    await queueWrite(async () => {
      const db = await getDatabase();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO context_session_state (session_id, status, last_summary, archived_at, updated_at)
        VALUES (?, 'ARCHIVED', ?, ?, ?)
      `);

      const now = new Date().toISOString();
      stmt.run([sessionId, summary ?? null, now, now]);
      stmt.free();
      await persistDatabase(db);
    });
  },

  async appendRawMessage(payload: UpsertRawMessagePayload): Promise<void> {
    await queueWrite(async () => {
      const db = await getDatabase();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO chat_history_raw (id, session_id, role, content, token_estimate, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        payload.id,
        payload.sessionId,
        payload.role,
        payload.content,
        payload.tokenEstimate,
        payload.createdAt,
        payload.payloadJson,
      ]);
      stmt.free();
      await persistDatabase(db);
    });
  },

  async replaceActiveContext(payload: ReplaceActiveContextPayload): Promise<void> {
    await queueWrite(async () => {
      const db = await getDatabase();
      const deleteStmt = db.prepare('DELETE FROM chat_context_active WHERE session_id = ?');
      deleteStmt.run([payload.sessionId]);
      deleteStmt.free();

      const insertStmt = db.prepare(`
        INSERT INTO chat_context_active (session_id, message_id, role, content, token_estimate, created_at, active_rank)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      payload.messages.forEach((message, index) => {
        insertStmt.run([
          payload.sessionId,
          message.id,
          message.role,
          message.content,
          message.tokenEstimate,
          message.createdAt,
          index,
        ]);
      });

      insertStmt.free();
      await persistDatabase(db);
    });
  },

  async createDigest(payload: CreateDigestPayload): Promise<StoredHistoryDigest> {
    const createdAt = new Date().toISOString();

    await queueWrite(async () => {
      const db = await getDatabase();
      const stmt = db.prepare(`
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

      stmt.run([
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
      stmt.free();
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
    const stmt = db.prepare(`
      SELECT id, session_id, summary, metadata_json, before_tokens, after_tokens, removed_messages, compacted_at, created_at
      FROM history_digests
      WHERE session_id = ?
      ORDER BY compacted_at DESC
      LIMIT 1
    `);

    stmt.bind([sessionId]);
    const row = stmt.get() as Record<string, unknown> | undefined;
    stmt.free();

    if (!row) {
      return null;
    }

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
    const stmt = db.prepare(`
      SELECT id, session_id, summary, metadata_json, before_tokens, after_tokens, removed_messages, compacted_at, created_at
      FROM history_digests
      WHERE session_id = ?
      ORDER BY compacted_at DESC
      LIMIT ?
    `);

    stmt.bind([sessionId, safeLimit]);
    const rows = stmt.all() as Array<Record<string, unknown>>;
    stmt.free();

    return rows.map(row => ({
      id: typeof row.id === 'string' ? row.id : '',
      sessionId: typeof row.session_id === 'string' ? row.session_id : sessionId,
      summary: typeof row.summary === 'string' ? row.summary : '',
      metadataJson: typeof row.metadata_json === 'string' ? row.metadata_json : '{}',
      beforeTokens: Number(row.before_tokens ?? 0),
      afterTokens: Number(row.after_tokens ?? 0),
      removedMessages: Number(row.removed_messages ?? 0),
      compactedAt: typeof row.compacted_at === 'string' ? row.compacted_at : '',
      createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    }));
  },
};
