import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot } from './governanceRepoService';
import { getPranaRuntimeConfig, type PranaRuntimeConfig } from './pranaRuntimeConfig';

const DB_FILE_NAME = 'runtime-config.sqlite';
const META_RUNTIME_CONFIG_KEY = 'runtime_config_snapshot';

export interface LocalRuntimeConfigSnapshot {
  seededAt: string;
  source: 'runtime-props';
  config: PranaRuntimeConfig;
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const nowIso = (): string => new Date().toISOString();
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
    CREATE TABLE IF NOT EXISTS runtime_config_meta (
      key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
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

const readSnapshot = async (): Promise<LocalRuntimeConfigSnapshot | null> => {
  const database = await getDatabase();
  const statement = database.prepare('SELECT payload_json FROM runtime_config_meta WHERE key = ?');
  statement.bind([META_RUNTIME_CONFIG_KEY]);

  if (!statement.step()) {
    statement.free();
    return null;
  }

  const row = statement.getAsObject() as { payload_json?: unknown };
  statement.free();

  if (typeof row.payload_json !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(row.payload_json) as LocalRuntimeConfigSnapshot;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.seededAt !== 'string' || !parsed.config) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeSnapshot = async (snapshot: LocalRuntimeConfigSnapshot): Promise<void> => {
  await queueWrite(async () => {
    const database = await getDatabase();
    const statement = database.prepare(`
      INSERT INTO runtime_config_meta (key, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `);

    statement.run([META_RUNTIME_CONFIG_KEY, JSON.stringify(snapshot), nowIso()]);
    statement.free();
    await persistDatabase(database);
  });
};

export const sqliteConfigStoreService = {
  async getRuntimeConfigSnapshot(): Promise<LocalRuntimeConfigSnapshot | null> {
    return readSnapshot();
  },

  async seedFromRuntimePropsIfEmpty(): Promise<LocalRuntimeConfigSnapshot | null> {
    const existing = await readSnapshot();
    if (existing) {
      return existing;
    }

    const runtimeConfig = getPranaRuntimeConfig();
    if (!runtimeConfig) {
      return null;
    }

    const snapshot: LocalRuntimeConfigSnapshot = {
      seededAt: nowIso(),
      source: 'runtime-props',
      config: runtimeConfig,
    };

    await writeSnapshot(snapshot);
    return snapshot;
  },

  async overwriteFromRuntimeProps(): Promise<LocalRuntimeConfigSnapshot | null> {
    const runtimeConfig = getPranaRuntimeConfig();
    if (!runtimeConfig) {
      return null;
    }

    const snapshot: LocalRuntimeConfigSnapshot = {
      seededAt: nowIso(),
      source: 'runtime-props',
      config: runtimeConfig,
    };

    await writeSnapshot(snapshot);
    return snapshot;
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    dbPromise = null;
    sqlRuntimePromise = null;
    writeQueue = Promise.resolve();
    await rm(getDbPath(), { force: true });
  },
};
