import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot } from './governanceRepoService';
import { syncStoreService } from './syncStoreService';

const DB_FILE_NAME = 'business-context.sqlite';

export interface BusinessContextRecord {
  contextId: string;
  contextType: 'company' | 'product';
  payload: Record<string, unknown>;
  status: 'DRAFT' | 'APPROVED';
  updatedAt: string;
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);
const nowIso = (): string => new Date().toISOString();

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
    CREATE TABLE IF NOT EXISTS business_context (
      context_id TEXT PRIMARY KEY,
      context_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
      const statement = database.prepare(`
        INSERT INTO business_context (context_id, context_type, payload_json, status, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(context_id) DO UPDATE SET
          context_type = excluded.context_type,
          payload_json = excluded.payload_json,
          status = excluded.status,
          updated_at = excluded.updated_at
      `);

      statement.run([
        record.contextId,
        record.contextType,
        JSON.stringify(record.payload),
        record.status,
        record.updatedAt,
      ]);
      statement.free();
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
    const statement = database.prepare('SELECT * FROM business_context WHERE context_id = ?');
    statement.bind([contextId]);

    if (!statement.step()) {
      statement.free();
      return null;
    }

    const record = mapRow(statement.getAsObject() as Record<string, unknown>);
    statement.free();
    return record;
  },

  async listContexts(contextType?: BusinessContextRecord['contextType']): Promise<BusinessContextRecord[]> {
    const database = await getDatabase();
    const statement = contextType
      ? database.prepare('SELECT * FROM business_context WHERE context_type = ? ORDER BY updated_at DESC')
      : database.prepare('SELECT * FROM business_context ORDER BY updated_at DESC');

    if (contextType) {
      statement.bind([contextType]);
    }

    const output: BusinessContextRecord[] = [];
    while (statement.step()) {
      output.push(mapRow(statement.getAsObject() as Record<string, unknown>));
    }

    statement.free();
    return output;
  },
};
