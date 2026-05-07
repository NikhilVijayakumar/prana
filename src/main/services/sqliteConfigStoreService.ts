import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { getAppDataRoot, getStableAppDataRoot } from './governanceRepoService';
import { getPranaRuntimeConfig } from './pranaRuntimeConfig';
import type { PranaRuntimeConfig } from './pranaRuntimeConfig';
import { encryptSqliteBuffer, decryptSqliteBuffer } from './sqliteCryptoUtil';

const DB_FILE_NAME = 'runtime-config.sqlite';
const META_RUNTIME_CONFIG_KEY = 'runtime_config_snapshot';

export interface LocalRuntimeConfigSnapshot {
  seededAt: string;
  source: 'runtime-props';
  config: PranaRuntimeConfig;
}

let db: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const nowIso = (): string => new Date().toISOString();
const getConfigCacheRoot = (): string => {
  const cacheLocation = getPranaRuntimeConfig()?.storage?.cacheLocation;
  return cacheLocation === 'drive' ? getAppDataRoot() : getStableAppDataRoot();
};

const getDbPath = (): string => join(getConfigCacheRoot(), DB_FILE_NAME);

const persistDatabase = async (database: Database): Promise<void> => {
  const buffer = database.serialize();
  await mkdir(getConfigCacheRoot(), { recursive: true });
  await writeFile(getDbPath(), await encryptSqliteBuffer(Buffer.from(buffer)));
};

const initializeDatabase = async (): Promise<Database> => {
  await mkdir(getConfigCacheRoot(), { recursive: true });

  let database: Database;
  if (existsSync(getDbPath())) {
    const raw = await readFile(getDbPath());
    try {
      const decrypted = await decryptSqliteBuffer(Buffer.from(raw));
      const tempPath = `${getDbPath()}.tmp`;
      await writeFile(tempPath, decrypted);
      database = new Database(tempPath);
      database.close();
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
    CREATE TABLE IF NOT EXISTS runtime_config_meta (
      key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
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

const readSnapshot = async (): Promise<LocalRuntimeConfigSnapshot | null> => {
  const database = await getDatabase();
  const stmt = database.prepare('SELECT payload_json FROM runtime_config_meta WHERE key = ?');
  stmt.bind(META_RUNTIME_CONFIG_KEY);

  const row = stmt.get() as { payload_json?: unknown } | undefined;
  stmt.free();

  if (!row || typeof row.payload_json !== 'string') {
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

const readSnapshotSync = (): LocalRuntimeConfigSnapshot | null => {
  if (!db) return null;
  try {
    const row = db.prepare('SELECT payload_json FROM runtime_config_meta WHERE key = ?').get(META_RUNTIME_CONFIG_KEY) as { payload_json?: unknown } | undefined;
    if (!row || typeof row.payload_json !== 'string') return null;
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
    const stmt = database.prepare(`
      INSERT OR REPLACE INTO runtime_config_meta (key, payload_json, updated_at)
      VALUES (?, ?, ?)
    `);

    stmt.run([META_RUNTIME_CONFIG_KEY, JSON.stringify(snapshot), nowIso()]);
    stmt.free();
    await persistDatabase(database);
  });
};

export const sqliteConfigStoreService = {
  getDatabase,

  async getRuntimeConfigSnapshot(): Promise<LocalRuntimeConfigSnapshot | null> {
    return readSnapshot();
  },

  async seedFromRuntimePropsIfEmpty(runtimeConfig: PranaRuntimeConfig): Promise<LocalRuntimeConfigSnapshot | null> {
    const existing = await readSnapshot();
    if (existing) {
      return existing;
    }
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

  async overwriteFromRuntimeProps(runtimeConfig: PranaRuntimeConfig): Promise<LocalRuntimeConfigSnapshot | null> {
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

  async dispose(): Promise<void> {
    await writeQueue;
    if (db) {
      db.close();
      db = null;
    }
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    if (db) {
      db.close();
      db = null;
    }
    writeQueue = Promise.resolve();
    await rm(getDbPath(), { force: true });
  },
};
