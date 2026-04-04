import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot } from './governanceRepoService';
import { vaultService } from './vaultService';
import { syncStoreService } from './syncStoreService';

const DB_FILE_NAME = 'runtime-documents.sqlite';

export type RuntimeDocumentSyncStatus = 'SYNCED' | 'PENDING';

interface RuntimeDocumentRecord {
  documentKey: string;
  content: string;
  syncStatus: RuntimeDocumentSyncStatus;
  updatedAt: string;
}

const PROJECTED_DOCUMENT_KEYS = [
  'org/administration/integrations/external-systems.config.json',
  'org/administration/integrations/google-sheets.mapping.json',
  'org/administration/staff/staff-registry.csv',
  'org/administration/feedback/google-forms.responses.json',
  'org/administration/evaluations/feedback-latest.json',
  'org/administration/evaluations/kpi-signals.json',
  'org/administration/evaluations/kpi-happiness-evaluation.latest.json',
  'org/administration/evaluations/kpi-happiness-escalations.latest.json',
  'org/administration/channels/twitter-trends.signals.json',
  'org/administration/evaluations/social-trend-policy-impact.latest.json',
  'org/administration/evaluations/social-trend-escalations.latest.json',
  'org/administration/policies/policy-index.json',
] as const;

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
    CREATE TABLE IF NOT EXISTS runtime_documents (
      document_key TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      sync_status TEXT NOT NULL,
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

const upsertDocument = async (
  documentKey: string,
  content: string,
  syncStatus: RuntimeDocumentSyncStatus,
): Promise<void> => {
  await queueWrite(async () => {
    const db = await getDatabase();
    const statement = db.prepare(`
      INSERT INTO runtime_documents (document_key, content, sync_status, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(document_key) DO UPDATE SET
        content = excluded.content,
        sync_status = excluded.sync_status,
        updated_at = excluded.updated_at
    `);

    statement.run([documentKey, content, syncStatus, nowIso()]);
    statement.free();
    await persistDatabase(db);
  });
};

const deleteDocument = async (documentKey: string): Promise<void> => {
  await queueWrite(async () => {
    const db = await getDatabase();
    const statement = db.prepare('DELETE FROM runtime_documents WHERE document_key = ?');
    statement.run([documentKey]);
    statement.free();
    await persistDatabase(db);
  });
};

const readDocument = async (documentKey: string): Promise<RuntimeDocumentRecord | null> => {
  const db = await getDatabase();
  const statement = db.prepare(`
    SELECT document_key, content, sync_status, updated_at
    FROM runtime_documents
    WHERE document_key = ?
  `);
  statement.bind([documentKey]);

  if (!statement.step()) {
    statement.free();
    return null;
  }

  const row = statement.getAsObject() as Record<string, unknown>;
  statement.free();

  return {
    documentKey: String(row.document_key ?? ''),
    content: String(row.content ?? ''),
    syncStatus: String(row.sync_status ?? 'SYNCED') as RuntimeDocumentSyncStatus,
    updatedAt: String(row.updated_at ?? nowIso()),
  };
};

const listPendingDocuments = async (): Promise<RuntimeDocumentRecord[]> => {
  const db = await getDatabase();
  const statement = db.prepare(`
    SELECT document_key, content, sync_status, updated_at
    FROM runtime_documents
    WHERE sync_status = 'PENDING'
    ORDER BY updated_at ASC
  `);

  const pending: RuntimeDocumentRecord[] = [];
  while (statement.step()) {
    const row = statement.getAsObject() as Record<string, unknown>;
    pending.push({
      documentKey: String(row.document_key ?? ''),
      content: String(row.content ?? ''),
      syncStatus: 'PENDING',
      updatedAt: String(row.updated_at ?? nowIso()),
    });
  }
  statement.free();
  return pending;
};

const normalizeDocumentKey = (documentKey: string): string => documentKey.replace(/\\/g, '/').replace(/^\/+/, '');

const readJsonObject = async <T extends object>(documentKey: string): Promise<T | null> => {
  const content = await runtimeDocumentStoreService.readText(documentKey);
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch {
    return null;
  }

  return null;
};

const readJsonArray = async <T>(documentKey: string): Promise<T[]> => {
  const content = await runtimeDocumentStoreService.readText(documentKey);
  if (!content) {
    return [];
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

export const runtimeDocumentStoreService = {
  projectedDocumentKeys: [...PROJECTED_DOCUMENT_KEYS],

  async seedFromVaultWorkspace(rootPath: string): Promise<void> {
    for (const documentKey of PROJECTED_DOCUMENT_KEYS) {
      const sourcePath = resolve(rootPath, documentKey);
      if (!sourcePath.startsWith(resolve(rootPath))) {
        continue;
      }

      if (!existsSync(sourcePath)) {
        await deleteDocument(documentKey);
        continue;
      }

      const content = await readFile(sourcePath, 'utf8');
      await upsertDocument(documentKey, content, 'SYNCED');
    }
  },

  async readText(documentKey: string): Promise<string | null> {
    const record = await readDocument(normalizeDocumentKey(documentKey));
    return record?.content ?? null;
  },

  async readJsonObject<T extends object>(documentKey: string): Promise<T | null> {
    return readJsonObject<T>(normalizeDocumentKey(documentKey));
  },

  async readJsonArray<T>(documentKey: string): Promise<T[]> {
    return readJsonArray<T>(normalizeDocumentKey(documentKey));
  },

  async writeText(documentKey: string, content: string, options?: { syncStatus?: RuntimeDocumentSyncStatus }): Promise<void> {
    await upsertDocument(normalizeDocumentKey(documentKey), content, options?.syncStatus ?? 'PENDING');
  },

  async writeJson(documentKey: string, content: unknown, options?: { syncStatus?: RuntimeDocumentSyncStatus }): Promise<void> {
    await upsertDocument(
      normalizeDocumentKey(documentKey),
      JSON.stringify(content, null, 2),
      options?.syncStatus ?? 'PENDING',
    );
  },

  async flushPendingToVault(commitMessage: string): Promise<{ flushed: number; synced: boolean }> {
    const pending = await listPendingDocuments();
    if (pending.length === 0) {
      return { flushed: 0, synced: true };
    }

    const lockOwner = `runtime-documents:${process.pid}`;
    const acquired = await syncStoreService.acquireSyncLock({
      owner: lockOwner,
      lockKey: 'global',
      ttlMs: 120_000,
    });
    if (!acquired) {
      throw new Error('Global storage sync lock is busy.');
    }

    try {
      await vaultService.initializeVault();
      const workingRoot = vaultService.getWorkingRootPath();

      for (const record of pending) {
        const targetPath = resolve(workingRoot, record.documentKey);
        if (!targetPath.startsWith(resolve(workingRoot))) {
          continue;
        }

        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, record.content, 'utf8');
        await syncStoreService.upsertSyncLineageRecord({
          recordKey: `runtime_document:${record.documentKey}`,
          tableName: 'runtime_documents',
          syncStatus: 'PENDING_UPDATE',
          payload: record.content,
          lastModified: record.updatedAt,
        });
      }

      await vaultService.publishVaultChanges({
        commitMessage,
        approvedByUser: true,
      });

      for (const record of pending) {
        await upsertDocument(record.documentKey, record.content, 'SYNCED');
        await syncStoreService.upsertSyncLineageRecord({
          recordKey: `runtime_document:${record.documentKey}`,
          tableName: 'runtime_documents',
          syncStatus: 'SYNCED',
          payload: record.content,
          lastModified: nowIso(),
        });
      }

      return { flushed: pending.length, synced: true };
    } finally {
      await vaultService.cleanupTemporaryWorkspace(true);
      await syncStoreService.releaseSyncLock({
        owner: lockOwner,
        lockKey: 'global',
      });
    }
  },

  async clear(documentKey: string): Promise<void> {
    await deleteDocument(normalizeDocumentKey(documentKey));
  },

  async dispose(): Promise<void> {
    const db = await dbPromise;
    if (db) {
      db.close();
    }
    dbPromise = null;
  },
};
