import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { getAppDataRoot, mkdirSafe } from './governanceRepoService';
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

export interface AppRegistryRecord {
  appId: number;
  appKey: string;
  appName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppVaultBlueprintRecord {
  blueprintId: number;
  appId: number;
  domainKey: string;
  relativePath: string;
  isRequired: boolean;
  lastSyncedAt: string | null;
  updatedAt: string;
}

export interface SyncLockRecord {
  lockKey: string;
  owner: string;
  acquiredAt: string;
  expiresAt: string | null;
}

let db: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const nowIso = (): string => new Date().toISOString();
const computePayloadHash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);

const persistDatabase = async (database: Database): Promise<void> => {
  const buffer = database.serialize();
  await mkdirSafe(getAppDataRoot());
  await writeFile(getDbPath(), Buffer.from(buffer));
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
  await mkdirSafe(getAppDataRoot());

  let database: Database;
  if (existsSync(getDbPath())) {
    database = new Database(getDbPath());
  } else {
    database = new Database(':memory:');
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.exec(`
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

  database.exec(`
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

  database.exec(`
    CREATE TABLE IF NOT EXISTS app_registry (
      app_id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_key TEXT UNIQUE NOT NULL,
      app_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS app_vault_blueprint (
      blueprint_id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      domain_key TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (app_id) REFERENCES app_registry(app_id),
      UNIQUE(app_id, domain_key)
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS sync_runtime_lock (
      lock_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      expires_at TEXT
    );
  `);

  database.exec(`
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

  database.exec(`
    CREATE TABLE IF NOT EXISTS embedding_index (
      embedding_id TEXT PRIMARY KEY,
      namespace TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      vector_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
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

const mapAppRegistryRow = (row: Record<string, unknown>): AppRegistryRecord => ({
  appId: Number(row.app_id ?? 0),
  appKey: String(row.app_key ?? ''),
  appName: String(row.app_name ?? ''),
  isActive: Number(row.is_active ?? 0) === 1,
  createdAt: String(row.created_at ?? nowIso()),
  updatedAt: String(row.updated_at ?? nowIso()),
});

const mapAppBlueprintRow = (row: Record<string, unknown>): AppVaultBlueprintRecord => ({
  blueprintId: Number(row.blueprint_id ?? 0),
  appId: Number(row.app_id ?? 0),
  domainKey: String(row.domain_key ?? ''),
  relativePath: String(row.relative_path ?? ''),
  isRequired: Number(row.is_required ?? 0) === 1,
  lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
  updatedAt: String(row.updated_at ?? nowIso()),
});

const mapSyncLockRow = (row: Record<string, unknown>): SyncLockRecord => ({
  lockKey: String(row.lock_key ?? ''),
  owner: String(row.owner ?? ''),
  acquiredAt: String(row.acquired_at ?? nowIso()),
  expiresAt: row.expires_at ? String(row.expires_at) : null,
});

export const syncStoreService = {
  async dispose(): Promise<void> {
    await writeQueue;
    if (db) {
      db.close();
      db = null;
    }
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
      const stmt = db.prepare(`
        INSERT INTO sync_queue (task_id, reason, payload_json, status, attempts, last_error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
      `);

      stmt.run([
        task.taskId,
        task.reason,
        task.payloadJson,
        task.status,
        task.attempts,
        task.createdAt,
        task.updatedAt,
      ]);
      stmt.free();
      await persistDatabase(db);
    });

    return task;
  },

  async clearEncryptedRegistrySnapshot(): Promise<void> {
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const stmt = db.prepare('DELETE FROM sync_meta WHERE key = ?');
      stmt.run([META_SYNC_STATE_KEY]);
      stmt.free();
      await persistDatabase(db);
    });
  },

  async ensureAppRegistered(input: {
    appKey: string;
    appName: string;
    isActive?: boolean;
  }): Promise<AppRegistryRecord> {
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const timestamp = nowIso();
      const stmt = db.prepare(`
        INSERT INTO app_registry (app_key, app_name, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(app_key) DO UPDATE SET
          app_name = excluded.app_name,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
      `);
      stmt.run([
        input.appKey,
        input.appName,
        input.isActive === false ? 0 : 1,
        timestamp,
        timestamp,
      ]);
      stmt.free();
      await persistDatabase(db);
    });

    const record = await this.getAppByKey(input.appKey);
    if (!record) {
      throw new Error(`Failed to register app ${input.appKey}.`);
    }
    return record;
  },

  async getAppByKey(appKey: string): Promise<AppRegistryRecord | null> {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM app_registry WHERE app_key = ?');
    stmt.bind([appKey]);

    const row = stmt.get() as Record<string, unknown> | undefined;
    stmt.free();

    if (!row) {
      return null;
    }
    return mapAppRegistryRow(row);
  },

  async listApps(): Promise<AppRegistryRecord[]> {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM app_registry ORDER BY app_key ASC');
    const rows = stmt.all() as Array<Record<string, unknown>>;
    stmt.free();

    return rows.map(row => mapAppRegistryRow(row));
  },

  async replaceVaultBlueprint(input: {
    appId: number;
    entries: Array<{
      domainKey: string;
      relativePath: string;
      isRequired?: boolean;
      lastSyncedAt?: string | null;
    }>;
  }): Promise<AppVaultBlueprintRecord[]> {
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const deleteStmt = db.prepare('DELETE FROM app_vault_blueprint WHERE app_id = ?');
      deleteStmt.run([input.appId]);
      deleteStmt.free();

      const insertStmt = db.prepare(`
        INSERT INTO app_vault_blueprint (app_id, domain_key, relative_path, is_required, last_synced_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const timestamp = nowIso();
      for (const entry of input.entries) {
        insertStmt.run([
          input.appId,
          entry.domainKey,
          entry.relativePath,
          entry.isRequired === false ? 0 : 1,
          entry.lastSyncedAt ?? null,
          timestamp,
        ]);
      }
      insertStmt.free();
      await persistDatabase(db);
    });

    return this.listVaultBlueprint(input.appId);
  },

  async listVaultBlueprint(appId: number): Promise<AppVaultBlueprintRecord[]> {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM app_vault_blueprint WHERE app_id = ? ORDER BY domain_key ASC');
    stmt.bind([appId]);
    const rows = stmt.all() as Array<Record<string, unknown>>;
    stmt.free();

    return rows.map(row => mapAppBlueprintRow(row));
  },

  async getSyncLock(lockKey = 'global'): Promise<SyncLockRecord | null> {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM sync_runtime_lock WHERE lock_key = ?');
    stmt.bind([lockKey]);

    const row = stmt.get() as Record<string, unknown> | undefined;
    stmt.free();

    if (!row) {
      return null;
    }
    return mapSyncLockRow(row);
  },

  async acquireSyncLock(input: { owner: string; lockKey?: string; ttlMs?: number }): Promise<boolean> {
    const lockKey = input.lockKey ?? 'global';
    const current = await this.getSyncLock(lockKey);
    const now = Date.now();
    const currentExpiresAt = current?.expiresAt ? Date.parse(current.expiresAt) : null;
    const lockExpired = currentExpiresAt !== null && !Number.isNaN(currentExpiresAt) && currentExpiresAt <= now;

    if (current && current.owner !== input.owner && !lockExpired) {
      return false;
    }

    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const timestamp = nowIso();
      const expiresAt = input.ttlMs ? new Date(Date.now() + input.ttlMs).toISOString() : null;
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO sync_runtime_lock (lock_key, owner, acquired_at, expires_at)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run([lockKey, input.owner, timestamp, expiresAt]);
      stmt.free();
      await persistDatabase(db);
    });

    return true;
  },

  async releaseSyncLock(input: { owner: string; lockKey?: string }): Promise<void> {
    const lockKey = input.lockKey ?? 'global';
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const stmt = db.prepare('DELETE FROM sync_runtime_lock WHERE lock_key = ? AND owner = ?');
      stmt.run([lockKey, input.owner]);
      stmt.free();
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
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO sync_lineage (record_key, table_name, sync_status, vault_hash, last_modified, payload_hash, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        record.recordKey,
        record.tableName,
        record.syncStatus,
        record.vaultHash,
        record.lastModified,
        record.payloadHash,
        record.updatedAt,
      ]);
      stmt.free();
      await persistDatabase(db);
    });

    return record;
  },

  async getSyncLineageRecord(recordKey: string): Promise<SyncLineageRecord | null> {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM sync_lineage WHERE record_key = ?');
    stmt.bind([recordKey]);

    const row = stmt.get() as Record<string, unknown> | undefined;
    stmt.free();

    if (!row) {
      return null;
    }

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
    let stmt;
    if (status) {
      stmt = db.prepare('SELECT * FROM sync_lineage WHERE sync_status = ? ORDER BY updated_at DESC');
      stmt.bind([status]);
    } else {
      stmt = db.prepare('SELECT * FROM sync_lineage ORDER BY updated_at DESC');
    }

    const rows = stmt.all() as Array<Record<string, unknown>>;
    stmt.free();

    return rows.map(row => ({
      recordKey: String(row.record_key ?? ''),
      tableName: String(row.table_name ?? ''),
      syncStatus: String(row.sync_status ?? 'LOCAL_ONLY') as SyncRecordStatus,
      vaultHash: row.vault_hash ? String(row.vault_hash) : null,
      lastModified: String(row.last_modified ?? nowIso()),
      payloadHash: String(row.payload_hash ?? ''),
      updatedAt: String(row.updated_at ?? nowIso()),
    }));
  },

  async deleteSyncLineageRecord(recordKey: string): Promise<void> {
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const stmt = db.prepare('DELETE FROM sync_lineage WHERE record_key = ?');
      stmt.run([recordKey]);
      stmt.free();
      await persistDatabase(db);
    });
  },

  async claimNextPendingTask(): Promise<SyncQueueTask | null> {
    const db = await getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM sync_queue
      WHERE status IN ('PENDING', 'FAILED')
      ORDER BY created_at ASC
      LIMIT 1
    `);

    const row = stmt.get() as Record<string, unknown> | undefined;
    stmt.free();

    if (!row) {
      return null;
    }

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
      const stmt = db.prepare('UPDATE sync_queue SET status = ?, updated_at = ?, last_error = NULL WHERE task_id = ?');
      stmt.run(['COMPLETED', nowIso(), taskId]);
      stmt.free();
      await persistDatabase(db);
    });
  },

  async markTaskFailed(taskId: string, error: string): Promise<void> {
    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const stmt = db.prepare('UPDATE sync_queue SET status = ?, updated_at = ?, last_error = ? WHERE task_id = ?');
      stmt.run(['FAILED', nowIso(), error.slice(0, 1000), taskId]);
      stmt.free();
      await persistDatabase(db);
    });
  },

  async recoverInterruptedTasks(): Promise<number> {
    let recovered = 0;

    await queueWriteOperation(async () => {
      const db = await getDatabase();
      const stmt = db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE status = ?');
      stmt.bind(['RUNNING']);
      const countRow = stmt.get() as { count?: unknown } | undefined;
      if (countRow) {
        recovered = Number(countRow.count ?? 0);
      }
      stmt.free();

      const update = db.prepare('UPDATE sync_queue SET status = ?, updated_at = ? WHERE status = ?');
      update.run(['FAILED', nowIso(), 'RUNNING']);
      update.free();
      await persistDatabase(db);
    });

    return recovered;
  },

  async listQueueTasks(limit = 50): Promise<SyncQueueTask[]> {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM sync_queue ORDER BY created_at DESC LIMIT ?');
    stmt.bind([Math.max(1, limit)]);
    const rows = stmt.all() as Array<Record<string, unknown>>;
    stmt.free();

    return rows.map(row => mapQueueRow(row));
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
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO prompt_cache (cache_key, prompt, response, model_provider, created_at, expires_at, hit_count, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `);

      stmt.run([
        record.cacheKey,
        record.prompt,
        record.response,
        record.modelProvider,
        now,
        record.expiresAt ?? null,
        now,
      ]);
      stmt.free();
      await persistDatabase(db);
    });
  },

  async getCachedPrompt(cacheKey: string): Promise<PromptCacheRecord | null> {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM prompt_cache WHERE cache_key = ?');
    stmt.bind([cacheKey]);

    const row = stmt.get() as Record<string, unknown> | undefined;
    stmt.free();

    if (!row) {
      return null;
    }

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
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO embedding_index (embedding_id, namespace, content_hash, vector_json, metadata_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        record.embeddingId,
        record.namespace,
        record.contentHash,
        JSON.stringify(record.vector),
        JSON.stringify(record.metadata ?? {}),
        nowIso(),
      ]);
      stmt.free();
      await persistDatabase(db);
    });
  },

  async listEmbeddingsByNamespace(namespace: string): Promise<EmbeddingRecord[]> {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM embedding_index WHERE namespace = ? ORDER BY updated_at DESC');
    stmt.bind([namespace]);
    const rows = stmt.all() as Array<Record<string, unknown>>;
    stmt.free();

    return rows.map(row => {
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

      return {
        embeddingId: String(row.embedding_id ?? ''),
        namespace: String(row.namespace ?? ''),
        contentHash: String(row.content_hash ?? ''),
        vector,
        metadata,
        updatedAt: String(row.updated_at ?? nowIso()),
      };
    });
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    if (db) {
      db.close();
      db = null;
    }
    writeQueue = Promise.resolve();
    if (existsSync(getDbPath())) {
      await rm(getDbPath(), { force: true });
    }
  },
};
