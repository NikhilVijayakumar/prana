import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot } from './governanceRepoService';
import { getRuntimeBootstrapConfig } from './runtimeConfigService';
import { RegistrySyncSnapshot } from './dataFilterService';

const DB_FILE_NAME = 'hybrid-sync.sqlite';
const META_SYNC_STATE_KEY = 'registry_sync_state';
const ENVELOPE_MAGIC = 'DHI_VAULT_V1';

export type SyncQueueStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type SyncRecordStatus = 'SYNCED' | 'PENDING_UPDATE' | 'PENDING_DELETE' | 'LOCAL_ONLY';

interface RegistrySyncEnvelope {
  magic: string;
  algorithm: 'aes-256-gcm';
  kdf: 'pbkdf2-sha256';
  iterations: number;
  ivBase64: string;
  tagBase64: string;
  ciphertextBase64: string;
}

interface SyncStatePayload {
  sourceVersion: string;
  encryptedEnvelope: string;
  updatedAt: string;
}

export interface SyncQueueTask {
  taskId: string;
  reason: string;
  payloadJson: string;
  status: SyncQueueStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncLineageRecord {
  recordKey: string;
  tableName: string;
  syncStatus: SyncRecordStatus;
  vaultHash: string | null;
  lastModified: string;
  payloadHash: string;
  updatedAt: string;
}

export interface PromptCacheRecord {
  cacheKey: string;
  prompt: string;
  response: string;
  modelProvider: string;
  createdAt: string;
  expiresAt: string | null;
  hitCount: number;
  lastUsedAt: string;
}

export interface EmbeddingRecord {
  embeddingId: string;
  namespace: string;
  contentHash: string;
  vector: number[];
  metadata: Record<string, unknown>;
  updatedAt: string;
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let cachedDatabase: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const nowIso = (): string => new Date().toISOString();
const computePayloadHash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

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

const deriveVaultKey = (): Buffer => {
  const vault = getRuntimeBootstrapConfig().vault;
  return pbkdf2Sync(vault.archivePassword, vault.archiveSalt, vault.kdfIterations, 32, 'sha256');
};

const encryptForStore = (payload: RegistrySyncSnapshot): RegistrySyncEnvelope => {
  const key = deriveVaultKey();
  const specVersion = getRuntimeBootstrapConfig().vault.specVersion;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(specVersion, 'utf8'));

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    magic: ENVELOPE_MAGIC,
    algorithm: 'aes-256-gcm',
    kdf: 'pbkdf2-sha256',
    iterations: getRuntimeBootstrapConfig().vault.kdfIterations,
    ivBase64: iv.toString('base64'),
    tagBase64: tag.toString('base64'),
    ciphertextBase64: encrypted.toString('base64'),
  };
};

const decryptFromStore = (payload: string): RegistrySyncSnapshot => {
  const envelope = JSON.parse(payload) as RegistrySyncEnvelope;

  if (envelope.magic !== ENVELOPE_MAGIC) {
    throw new Error('Sync state envelope signature mismatch.');
  }

  const key = deriveVaultKey();
  const specVersion = getRuntimeBootstrapConfig().vault.specVersion;
  const iv = Buffer.from(envelope.ivBase64, 'base64');
  const tag = Buffer.from(envelope.tagBase64, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertextBase64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(specVersion, 'utf8'));
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as RegistrySyncSnapshot;
};

const initializeDatabase = async (): Promise<Database> => {
  const sqlRuntime = await getSqlRuntime();
  await mkdir(getAppDataRoot(), { recursive: true });

  const database = existsSync(getDbPath())
    ? new sqlRuntime.Database(new Uint8Array(await readFile(getDbPath())))
    : new sqlRuntime.Database();

  database.run(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      task_id TEXT PRIMARY KEY,
      reason TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS sync_lineage (
      record_key TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      sync_status TEXT NOT NULL,
      vault_hash TEXT,
      last_modified TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS prompt_cache (
      cache_key TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      model_provider TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      hit_count INTEGER NOT NULL,
      last_used_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS embedding_index (
      embedding_id TEXT PRIMARY KEY,
      namespace TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      vector_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await persistDatabase(database);
  cachedDatabase = database;
  return database;
};

const getDatabase = async (): Promise<Database> => {
  if (!dbPromise) {
    dbPromise = initializeDatabase();
  }
  return dbPromise;
};

const queueWriteOperation = async (operation: () => Promise<void>): Promise<void> => {
  writeQueue = writeQueue.then(operation, operation);
  await writeQueue;
};

const readSyncState = async (): Promise<SyncStatePayload | null> => {
  const db = await getDatabase();
  const statement = db.prepare('SELECT payload_json FROM sync_meta WHERE key = ?');
  statement.bind([META_SYNC_STATE_KEY]);

  if (!statement.step()) {
    statement.free();
    return null;
  }

  const row = statement.getAsObject() as { payload_json?: unknown };
  statement.free();

  if (typeof row.payload_json !== 'string') {
    return null;
  }

  return JSON.parse(row.payload_json) as SyncStatePayload;
};

const writeSyncState = async (payload: SyncStatePayload): Promise<void> => {
  await queueWriteOperation(async () => {
    const db = await getDatabase();
    const statement = db.prepare(`
      INSERT INTO sync_meta (key, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `);

    statement.run([META_SYNC_STATE_KEY, JSON.stringify(payload), nowIso()]);
    statement.free();
    await persistDatabase(db);
  });
};

const mapQueueRow = (row: Record<string, unknown>): SyncQueueTask => ({
  taskId: String(row.task_id ?? ''),
  reason: String(row.reason ?? ''),
  payloadJson: String(row.payload_json ?? '{}'),
  status: String(row.status ?? 'PENDING') as SyncQueueStatus,
  attempts: Number(row.attempts ?? 0),
  lastError: row.last_error ? String(row.last_error) : null,
  createdAt: String(row.created_at ?? nowIso()),
  updatedAt: String(row.updated_at ?? nowIso()),
});

const createTaskId = (): string => `sync-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const syncStoreService = {
  async dispose(): Promise<void> {
    await writeQueue;
    if (cachedDatabase) {
      cachedDatabase.close();
      cachedDatabase = null;
    }
    dbPromise = null;
  },

  async saveEncryptedRegistrySnapshot(snapshot: RegistrySyncSnapshot, sourceVersion: string): Promise<void> {
    const encryptedEnvelope = JSON.stringify(encryptForStore(snapshot));
    await writeSyncState({
      sourceVersion,
      encryptedEnvelope,
      updatedAt: nowIso(),
    });
  },

  async getDecryptedRegistrySnapshot(): Promise<{ sourceVersion: string; snapshot: RegistrySyncSnapshot } | null> {
    const payload = await readSyncState();
    if (!payload) {
      return null;
    }

    return {
      sourceVersion: payload.sourceVersion,
      snapshot: decryptFromStore(payload.encryptedEnvelope),
    };
  },

  async enqueuePushTask(reason: string, payload: Record<string, unknown>): Promise<SyncQueueTask> {
    const task: SyncQueueTask = {
      taskId: createTaskId(),
      reason,
      payloadJson: JSON.stringify(payload),
      status: 'PENDING',
      attempts: 0,
      lastError: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const statement = db.prepare(`
        INSERT INTO sync_queue (task_id, reason, payload_json, status, attempts, last_error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
      `);

      statement.run([
        task.taskId,
        task.reason,
        task.payloadJson,
        task.status,
        task.attempts,
        task.createdAt,
        task.updatedAt,
      ]);
      statement.free();
      await persistDatabase(db);
    });

    return task;
  },

  async clearEncryptedRegistrySnapshot(): Promise<void> {
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const statement = db.prepare('DELETE FROM sync_meta WHERE key = ?');
      statement.run([META_SYNC_STATE_KEY]);
      statement.free();
      await persistDatabase(db);
    });
  },

  async upsertSyncLineageRecord(input: {
    recordKey: string;
    tableName: string;
    syncStatus: SyncRecordStatus;
    payload: string;
    lastModified?: string;
    vaultHash?: string | null;
  }): Promise<SyncLineageRecord> {
    const record: SyncLineageRecord = {
      recordKey: input.recordKey,
      tableName: input.tableName,
      syncStatus: input.syncStatus,
      vaultHash: input.vaultHash ?? null,
      lastModified: input.lastModified ?? nowIso(),
      payloadHash: computePayloadHash(input.payload),
      updatedAt: nowIso(),
    };

    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const statement = db.prepare(`
        INSERT INTO sync_lineage (record_key, table_name, sync_status, vault_hash, last_modified, payload_hash, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(record_key) DO UPDATE SET
          table_name = excluded.table_name,
          sync_status = excluded.sync_status,
          vault_hash = excluded.vault_hash,
          last_modified = excluded.last_modified,
          payload_hash = excluded.payload_hash,
          updated_at = excluded.updated_at
      `);

      statement.run([
        record.recordKey,
        record.tableName,
        record.syncStatus,
        record.vaultHash,
        record.lastModified,
        record.payloadHash,
        record.updatedAt,
      ]);
      statement.free();
      await persistDatabase(db);
    });

    return record;
  },

  async getSyncLineageRecord(recordKey: string): Promise<SyncLineageRecord | null> {
    const db = await getDatabase();
    const statement = db.prepare('SELECT * FROM sync_lineage WHERE record_key = ?');
    statement.bind([recordKey]);

    if (!statement.step()) {
      statement.free();
      return null;
    }

    const row = statement.getAsObject() as Record<string, unknown>;
    statement.free();

    return {
      recordKey: String(row.record_key ?? ''),
      tableName: String(row.table_name ?? ''),
      syncStatus: String(row.sync_status ?? 'LOCAL_ONLY') as SyncRecordStatus,
      vaultHash: row.vault_hash ? String(row.vault_hash) : null,
      lastModified: String(row.last_modified ?? nowIso()),
      payloadHash: String(row.payload_hash ?? ''),
      updatedAt: String(row.updated_at ?? nowIso()),
    };
  },

  async listSyncLineageRecords(status?: SyncRecordStatus): Promise<SyncLineageRecord[]> {
    const db = await getDatabase();
    const statement = status
      ? db.prepare('SELECT * FROM sync_lineage WHERE sync_status = ? ORDER BY updated_at DESC')
      : db.prepare('SELECT * FROM sync_lineage ORDER BY updated_at DESC');

    if (status) {
      statement.bind([status]);
    }

    const records: SyncLineageRecord[] = [];
    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>;
      records.push({
        recordKey: String(row.record_key ?? ''),
        tableName: String(row.table_name ?? ''),
        syncStatus: String(row.sync_status ?? 'LOCAL_ONLY') as SyncRecordStatus,
        vaultHash: row.vault_hash ? String(row.vault_hash) : null,
        lastModified: String(row.last_modified ?? nowIso()),
        payloadHash: String(row.payload_hash ?? ''),
        updatedAt: String(row.updated_at ?? nowIso()),
      });
    }

    statement.free();
    return records;
  },

  async deleteSyncLineageRecord(recordKey: string): Promise<void> {
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const statement = db.prepare('DELETE FROM sync_lineage WHERE record_key = ?');
      statement.run([recordKey]);
      statement.free();
      await persistDatabase(db);
    });
  },

  async claimNextPendingTask(): Promise<SyncQueueTask | null> {
    const db = await getDatabase();
    const statement = db.prepare(`
      SELECT * FROM sync_queue
      WHERE status IN ('PENDING', 'FAILED')
      ORDER BY created_at ASC
      LIMIT 1
    `);

    if (!statement.step()) {
      statement.free();
      return null;
    }

    const row = statement.getAsObject() as Record<string, unknown>;
    statement.free();

    const task = mapQueueRow(row);

    await queueWriteOperation(async () => {
      const writeDb = await getDatabase();
      const update = writeDb.prepare(
        'UPDATE sync_queue SET status = ?, attempts = attempts + 1, updated_at = ?, last_error = NULL WHERE task_id = ?',
      );
      update.run(['RUNNING', nowIso(), task.taskId]);
      update.free();
      await persistDatabase(writeDb);
    });

    return {
      ...task,
      status: 'RUNNING',
      attempts: task.attempts + 1,
      updatedAt: nowIso(),
      lastError: null,
    };
  },

  async markTaskCompleted(taskId: string): Promise<void> {
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const statement = db.prepare('UPDATE sync_queue SET status = ?, updated_at = ?, last_error = NULL WHERE task_id = ?');
      statement.run(['COMPLETED', nowIso(), taskId]);
      statement.free();
      await persistDatabase(db);
    });
  },

  async markTaskFailed(taskId: string, error: string): Promise<void> {
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const statement = db.prepare('UPDATE sync_queue SET status = ?, updated_at = ?, last_error = ? WHERE task_id = ?');
      statement.run(['FAILED', nowIso(), error.slice(0, 1000), taskId]);
      statement.free();
      await persistDatabase(db);
    });
  },

  async recoverInterruptedTasks(): Promise<number> {
    let recovered = 0;

    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const statement = db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE status = ?');
      statement.bind(['RUNNING']);
      if (statement.step()) {
        const row = statement.getAsObject() as { count?: unknown };
        recovered = Number(row.count ?? 0);
      }
      statement.free();

      const update = db.prepare('UPDATE sync_queue SET status = ?, updated_at = ? WHERE status = ?');
      update.run(['FAILED', nowIso(), 'RUNNING']);
      update.free();
      await persistDatabase(db);
    });

    return recovered;
  },

  async listQueueTasks(limit = 50): Promise<SyncQueueTask[]> {
    const db = await getDatabase();
    const statement = db.prepare('SELECT * FROM sync_queue ORDER BY created_at DESC LIMIT ?');
    statement.bind([Math.max(1, limit)]);

    const rows: SyncQueueTask[] = [];
    while (statement.step()) {
      rows.push(mapQueueRow(statement.getAsObject() as Record<string, unknown>));
    }

    statement.free();
    return rows;
  },

  async cachePrompt(record: {
    cacheKey: string;
    prompt: string;
    response: string;
    modelProvider: string;
    expiresAt?: string;
  }): Promise<void> {
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const now = nowIso();
      const statement = db.prepare(`
        INSERT INTO prompt_cache (cache_key, prompt, response, model_provider, created_at, expires_at, hit_count, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
          prompt = excluded.prompt,
          response = excluded.response,
          model_provider = excluded.model_provider,
          expires_at = excluded.expires_at,
          last_used_at = excluded.last_used_at
      `);

      statement.run([
        record.cacheKey,
        record.prompt,
        record.response,
        record.modelProvider,
        now,
        record.expiresAt ?? null,
        now,
      ]);
      statement.free();
      await persistDatabase(db);
    });
  },

  async getCachedPrompt(cacheKey: string): Promise<PromptCacheRecord | null> {
    const db = await getDatabase();
    const statement = db.prepare('SELECT * FROM prompt_cache WHERE cache_key = ?');
    statement.bind([cacheKey]);

    if (!statement.step()) {
      statement.free();
      return null;
    }

    const row = statement.getAsObject() as Record<string, unknown>;
    statement.free();

    const expiresAt = row.expires_at ? String(row.expires_at) : null;
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      return null;
    }

    await queueWriteOperation(async () => {
      const writeDb = await getDatabase();
      const update = writeDb.prepare('UPDATE prompt_cache SET hit_count = hit_count + 1, last_used_at = ? WHERE cache_key = ?');
      update.run([nowIso(), cacheKey]);
      update.free();
      await persistDatabase(writeDb);
    });

    return {
      cacheKey: String(row.cache_key ?? ''),
      prompt: String(row.prompt ?? ''),
      response: String(row.response ?? ''),
      modelProvider: String(row.model_provider ?? ''),
      createdAt: String(row.created_at ?? nowIso()),
      expiresAt,
      hitCount: Number(row.hit_count ?? 0) + 1,
      lastUsedAt: nowIso(),
    };
  },

  async upsertEmbedding(record: {
    embeddingId: string;
    namespace: string;
    contentHash: string;
    vector: number[];
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const statement = db.prepare(`
        INSERT INTO embedding_index (embedding_id, namespace, content_hash, vector_json, metadata_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(embedding_id) DO UPDATE SET
          namespace = excluded.namespace,
          content_hash = excluded.content_hash,
          vector_json = excluded.vector_json,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
      `);

      statement.run([
        record.embeddingId,
        record.namespace,
        record.contentHash,
        JSON.stringify(record.vector),
        JSON.stringify(record.metadata ?? {}),
        nowIso(),
      ]);
      statement.free();
      await persistDatabase(db);
    });
  },

  async listEmbeddingsByNamespace(namespace: string): Promise<EmbeddingRecord[]> {
    const db = await getDatabase();
    const statement = db.prepare('SELECT * FROM embedding_index WHERE namespace = ? ORDER BY updated_at DESC');
    statement.bind([namespace]);

    const records: EmbeddingRecord[] = [];
    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>;
      const vector = (() => {
        try {
          return JSON.parse(String(row.vector_json ?? '[]')) as number[];
        } catch {
          return [];
        }
      })();

      const metadata = (() => {
        try {
          const parsed = JSON.parse(String(row.metadata_json ?? '{}')) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
          return {};
        } catch {
          return {};
        }
      })();

      records.push({
        embeddingId: String(row.embedding_id ?? ''),
        namespace: String(row.namespace ?? ''),
        contentHash: String(row.content_hash ?? ''),
        vector,
        metadata,
        updatedAt: String(row.updated_at ?? nowIso()),
      });
    }

    statement.free();
    return records;
  },

  async __resetForTesting(): Promise<void> {
    dbPromise = null;
    sqlRuntimePromise = null;
    writeQueue = Promise.resolve();
    if (existsSync(getDbPath())) {
      await rm(getDbPath(), { force: true });
    }
  },
};
