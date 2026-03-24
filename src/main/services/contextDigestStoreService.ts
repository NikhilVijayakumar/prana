import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot } from './governanceRepoService';

const DB_FILE_NAME = 'context-history.sqlite';

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

  const database = existsSync(getDbPath())
    ? new sqlRuntime.Database(new Uint8Array(await readFile(getDbPath())))
    : new sqlRuntime.Database();

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

export const contextDigestStoreService = {
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
