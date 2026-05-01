import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getSqliteRoot, mkdirSafe } from './governanceRepoService';

const DB_FILE_NAME = 'auth.sqlite';
const LEGACY_AUTH_FILE_NAME = 'auth.json';
const AUTH_STATE_KEY = 'director_auth';

export interface AuthStoreRecord {
  directorName: string;
  email: string;
  passwordHash: string;
  otpHash: string | null;
  otpExpiresAt: number | null;
  lastPasswordResetAt: string;
  attemptCount?: number; // Brute force tracking: failed login attempts
  attemptLockUntil?: number; // Brute force tracking: timestamp when lockout expires
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const getDbPath = (): string => join(getSqliteRoot(), DB_FILE_NAME);
const getLegacyAuthPath = (): string => join(getSqliteRoot(), LEGACY_AUTH_FILE_NAME);

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
  await mkdirSafe(getSqliteRoot());
  await writeFile(getDbPath(), Buffer.from(bytes));
};

const initializeDatabase = async (): Promise<Database> => {
  const sqlRuntime = await getSqlRuntime();
  await mkdirSafe(getSqliteRoot());

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

const normalizeRecord = (payload: Record<string, unknown>): { record: AuthStoreRecord; changed: boolean } | null => {
  const directorName = typeof payload.directorName === 'string' ? payload.directorName : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  const passwordHash = typeof payload.passwordHash === 'string' ? payload.passwordHash : '';
  const lastPasswordResetAt =
    typeof payload.lastPasswordResetAt === 'string' ? payload.lastPasswordResetAt : new Date().toISOString();
  const attemptCount = typeof payload.attemptCount === 'number' ? payload.attemptCount : undefined;
  const attemptLockUntil = typeof payload.attemptLockUntil === 'number' ? payload.attemptLockUntil : undefined;

  if (!directorName || !email || !passwordHash) {
    return null;
  }

  const legacyOtpHash = typeof payload.tempPasswordHash === 'string' ? payload.tempPasswordHash : null;
  const legacyOtpExpiresAt =
    typeof payload.tempPasswordExpiresAt === 'number' && Number.isFinite(payload.tempPasswordExpiresAt)
      ? payload.tempPasswordExpiresAt
      : null;

  const hasOtpHash = 'otpHash' in payload;
  const hasOtpExpiresAt = 'otpExpiresAt' in payload;

  const otpHash = hasOtpHash
    ? (typeof payload.otpHash === 'string' || payload.otpHash === null ? payload.otpHash : null)
    : legacyOtpHash;
  const otpExpiresAt = hasOtpExpiresAt
    ? (typeof payload.otpExpiresAt === 'number' || payload.otpExpiresAt === null ? payload.otpExpiresAt : null)
    : legacyOtpExpiresAt;

  return {
    record: {
      directorName,
      email,
      passwordHash,
      otpHash,
      otpExpiresAt,
      lastPasswordResetAt,
      attemptCount,
      attemptLockUntil,
    },
    changed:
      'tempPasswordHash' in payload
      || 'tempPasswordExpiresAt' in payload
      || !hasOtpHash
      || !hasOtpExpiresAt,
  };
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
    const parsed = JSON.parse(row.payload_json) as Record<string, unknown>;
    const normalized = normalizeRecord(parsed);

    if (!normalized) {
      return null;
    }

    if (normalized.changed) {
      await writeRecord(normalized.record);
    }

    return normalized.record;
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
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized = normalizeRecord(parsed);

    if (normalized?.record.email && normalized.record.passwordHash) {
      await writeRecord(normalized.record);
      await rm(legacyPath, { force: true });
      return normalized.record;
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

  async clearOtpState(): Promise<void> {
    const existing = await this.get();
    if (!existing) {
      return;
    }

    await writeRecord({
      ...existing,
      otpHash: null,
      otpExpiresAt: null,
    });
  },
};
