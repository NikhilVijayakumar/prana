import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { getSqliteRoot, mkdirSafe } from './governanceRepoService';
import { syncStoreService } from './syncStoreService';

const DB_FILE_NAME = 'business-context.sqlite';

export interface BusinessContextRecord {
  contextId: string;
  contextType: 'company' | 'product';
  payload: Record<string, unknown>;
  status: 'DRAFT' | 'APPROVED';
  updatedAt: string;
}

let db: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const getDbPath = (): string => join(getSqliteRoot(), DB_FILE_NAME);
const nowIso = (): string => new Date().toISOString();

const persistDatabase = async (database: Database): Promise<void> => {
  const buffer = database.serialize();
  await mkdirSafe(getSqliteRoot());
  await writeFile(getDbPath(), Buffer.from(buffer));
};

const initializeDatabase = async (): Promise<Database> => {
  await mkdirSafe(getSqliteRoot());

  let database: Database;
  if (existsSync(getDbPath())) {
    database = new Database(getDbPath());
  } else {
    database = new Database(':memory:');
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS business_context (
      context_id TEXT PRIMARY KEY,
      context_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

const mapRow = (row: Record<string, unknown>): BusinessContextRecord => {
  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(row.payload_json ?? '{}')) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    }
  } catch {
    payload = {};
  }

  return {
    contextId: String(row.context_id ?? ''),
    contextType: String(row.context_type ?? 'company') as BusinessContextRecord['contextType'],
    payload,
    status: String(row.status ?? 'DRAFT') as BusinessContextRecord['status'],
    updatedAt: String(row.updated_at ?? nowIso()),
  };
};

export const businessContextStoreService = {
  async upsertContext(input: {
    contextId: string;
    contextType: BusinessContextRecord['contextType'];
    payload: Record<string, unknown>;
    status: BusinessContextRecord['status'];
  }): Promise<BusinessContextRecord> {
    const record: BusinessContextRecord = {
      contextId: input.contextId,
      contextType: input.contextType,
      payload: input.payload,
      status: input.status,
      updatedAt: nowIso(),
    };

    await queueWrite(async () => {
      const database = await getDatabase();
      database.prepare(`
        INSERT OR REPLACE INTO business_context (context_id, context_type, payload_json, status, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        record.contextId,
        record.contextType,
        JSON.stringify(record.payload),
        record.status,
        record.updatedAt
      );
      await persistDatabase(database);
    });

    await syncStoreService.upsertSyncLineageRecord({
      recordKey: `business-context:${record.contextId}`,
      tableName: 'business_context',
      syncStatus: record.status === 'APPROVED' ? 'PENDING_UPDATE' : 'LOCAL_ONLY',
      payload: JSON.stringify(record),
      lastModified: record.updatedAt,
    });

    return record;
  },

  async getContext(contextId: string): Promise<BusinessContextRecord | null> {
    const database = await getDatabase();
    const row = database.prepare('SELECT * FROM business_context WHERE context_id = ?').get(contextId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  },

  async listContexts(contextType?: BusinessContextRecord['contextType']): Promise<BusinessContextRecord[]> {
    const database = await getDatabase();
    const rows = contextType
      ? database.prepare('SELECT * FROM business_context WHERE context_type = ? ORDER BY updated_at DESC').all(contextType) as Record<string, unknown>[]
      : database.prepare('SELECT * FROM business_context ORDER BY updated_at DESC').all() as Record<string, unknown>[];

    return rows.map(mapRow);
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    db = null;
    writeQueue = Promise.resolve();
    await rm(getDbPath(), { force: true });
  },
};
