import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot } from './governanceRepoService';

const DB_FILE_NAME = 'auth.sqlite';
const LEGACY_AUTH_FILE_NAME = 'auth.json';
const AUTH_STATE_KEY = 'director_auth';

export interface AuthStoreRecord {
  directorName: string;
  email: string;
  passwordHash: string;
  tempPasswordHash: string | null;
  tempPasswordExpiresAt: number | null;
  lastPasswordResetAt: string;
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);
const getLegacyAuthPath = (): string => join(getAppDataRoot(), LEGACY_AUTH_FILE_NAME);

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
    CREATE TABLE IF NOT EXISTS auth_meta (
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

const readRecord = async (): Promise<AuthStoreRecord | null> => {
  const db = await getDatabase();
  const statement = db.prepare('SELECT payload_json FROM auth_meta WHERE key = ?');
  statement.bind([AUTH_STATE_KEY]);

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
    const parsed = JSON.parse(row.payload_json) as AuthStoreRecord;
    return parsed;
  } catch {
    return null;
  }
};

const writeRecord = async (record: AuthStoreRecord): Promise<void> => {
  await queueWrite(async () => {
    const db = await getDatabase();
    const statement = db.prepare(`
      INSERT INTO auth_meta (key, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `);

    statement.run([AUTH_STATE_KEY, JSON.stringify(record), new Date().toISOString()]);
    statement.free();
    await persistDatabase(db);
  });
};

const migrateLegacyJsonIfPresent = async (): Promise<AuthStoreRecord | null> => {
  const legacyPath = getLegacyAuthPath();
  if (!existsSync(legacyPath)) {
    return null;
  }

  try {
    const raw = await readFile(legacyPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AuthStoreRecord>;
    const migrated: AuthStoreRecord = {
      directorName: typeof parsed.directorName === 'string' ? parsed.directorName : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      passwordHash: typeof parsed.passwordHash === 'string' ? parsed.passwordHash : '',
      tempPasswordHash: typeof parsed.tempPasswordHash === 'string' ? parsed.tempPasswordHash : null,
      tempPasswordExpiresAt:
        typeof parsed.tempPasswordExpiresAt === 'number' && Number.isFinite(parsed.tempPasswordExpiresAt)
          ? parsed.tempPasswordExpiresAt
          : null,
      lastPasswordResetAt:
        typeof parsed.lastPasswordResetAt === 'string' ? parsed.lastPasswordResetAt : new Date().toISOString(),
    };

    if (migrated.email && migrated.passwordHash) {
      await writeRecord(migrated);
      await rm(legacyPath, { force: true });
      return migrated;
    }
  } catch {
    return null;
  }

  return null;
};

export const authStoreService = {
  async get(): Promise<AuthStoreRecord | null> {
    const existing = await readRecord();
    if (existing) {
      return existing;
    }

    return migrateLegacyJsonIfPresent();
  },

  async save(record: AuthStoreRecord): Promise<void> {
    await writeRecord(record);
  },

  async clearTempPassword(): Promise<void> {
    const existing = await this.get();
    if (!existing) {
      return;
    }

    await writeRecord({
      ...existing,
      tempPasswordHash: null,
      tempPasswordExpiresAt: null,
    });
  },
};
