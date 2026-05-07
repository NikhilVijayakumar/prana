import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getAppDataRoot, mkdirSafe } from './governanceRepoService';

export type VirtualDriveId = 'system' | 'vault';
export type VirtualDriveStage = 'UNMOUNTED' | 'MOUNTING' | 'MOUNTED' | 'FAILED' | 'UNMOUNTING';

export interface VirtualDriveRecord {
  id: VirtualDriveId;
  stage: VirtualDriveStage;
  posture: 'SECURE' | 'DEGRADED' | 'UNAVAILABLE';
  providerId: string;
  mountPoint: string;
  sourcePath: string;
  resolvedPath: string;
  usedFallbackPath: boolean;
  pid: number | null;
  mountedAt: string | null;
  unmountedAt: string | null;
  activeSessionCount: number;
  retryCount: number;
  lastError: string | null;
  lastStderr: string | null;
}

let db: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const DB_FILE_NAME = 'mount-registry.sqlite';

const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);
const nowIso = (): string => new Date().toISOString();

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
    CREATE TABLE IF NOT EXISTS mount_registry (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL,
      posture TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      mount_point TEXT NOT NULL,
      source_path TEXT NOT NULL,
      resolved_path TEXT NOT NULL,
      used_fallback_path INTEGER NOT NULL DEFAULT 0,
      pid INTEGER,
      mounted_at TEXT,
      unmounted_at TEXT,
      active_session_count INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_stderr TEXT
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

const mapRow = (row: Record<string, unknown>): VirtualDriveRecord => ({
  id: String(row.id ?? '') as VirtualDriveId,
  stage: String(row.stage ?? 'UNMOUNTED') as VirtualDriveStage,
  posture: String(row.posture ?? 'UNAVAILABLE') as VirtualDriveRecord['posture'],
  providerId: String(row.provider_id ?? ''),
  mountPoint: String(row.mount_point ?? ''),
  sourcePath: String(row.source_path ?? ''),
  resolvedPath: String(row.resolved_path ?? ''),
  usedFallbackPath: Boolean(row.used_fallback_path),
  pid: typeof row.pid === 'number' ? row.pid : null,
  mountedAt: row.mounted_at ? String(row.mounted_at) : null,
  unmountedAt: row.unmounted_at ? String(row.unmounted_at) : null,
  activeSessionCount: Number(row.active_session_count ?? 0),
  retryCount: Number(row.retry_count ?? 0),
  lastError: row.last_error ? String(row.last_error) : null,
  lastStderr: row.last_stderr ? String(row.last_stderr) : null,
});

export const mountRegistryService = {
  upsert(record: VirtualDriveRecord): VirtualDriveRecord {
    const cloned = { ...record };
    queueWrite(async () => {
      const database = await getDatabase();
      database.prepare(`
        INSERT OR REPLACE INTO mount_registry (
          id, stage, posture, provider_id, mount_point, source_path,
          resolved_path, used_fallback_path, pid, mounted_at, unmounted_at,
          active_session_count, retry_count, last_error, last_stderr
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cloned.id,
        cloned.stage,
        cloned.posture,
        cloned.providerId,
        cloned.mountPoint,
        cloned.sourcePath,
        cloned.resolvedPath,
        cloned.usedFallbackPath ? 1 : 0,
        cloned.pid,
        cloned.mountedAt,
        cloned.unmountedAt,
        cloned.activeSessionCount,
        cloned.retryCount,
        cloned.lastError,
        cloned.lastStderr
      );
      await persistDatabase(database);
    });
    return cloned;
  },

  async get(id: VirtualDriveId): Promise<VirtualDriveRecord | null> {
    const database = await getDatabase();
    const row = database.prepare('SELECT * FROM mount_registry WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  },

  async list(): Promise<VirtualDriveRecord[]> {
    const database = await getDatabase();
    const rows = database.prepare('SELECT * FROM mount_registry ORDER BY id ASC').all() as Record<string, unknown>[];
    return rows.map(mapRow);
  },

  clear(id: VirtualDriveId): void {
    queueWrite(async () => {
      const database = await getDatabase();
      database.prepare('DELETE FROM mount_registry WHERE id = ?').run(id);
      await persistDatabase(database);
    });
  },

  reset(): void {
    queueWrite(async () => {
      const database = await getDatabase();
      database.prepare('DELETE FROM mount_registry').run();
      await persistDatabase(database);
    });
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    db = null;
    writeQueue = Promise.resolve();
    await rm(getDbPath(), { force: true });
  },
};

// Re-export types for backward compatibility
export type { VirtualDriveRecord as default };
