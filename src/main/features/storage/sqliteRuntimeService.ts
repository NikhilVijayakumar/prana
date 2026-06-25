import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type SqliteServiceState = 'INITIALIZING' | 'READY' | 'CLOSING' | 'ERROR';

export interface ISqliteRuntimeService {
  initialize(dbPath: string): Promise<void>;
  getDb(): Database.Database;
  close(): void;
  isReady(): boolean;
}

class SqliteRuntimeService implements ISqliteRuntimeService {
  private db: Database.Database | null = null;
  private state: SqliteServiceState = 'INITIALIZING';

  async initialize(dbPath: string): Promise<void> {
    this.state = 'INITIALIZING';
    try {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      this.applyMigrations();
      this.state = 'READY';
    } catch (err) {
      this.state = 'ERROR';
      throw err;
    }
  }

  private applyMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prana_startup_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lifecycle_state TEXT NOT NULL,
        failing_service TEXT,
        reason TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS storage_jobs (
        job_id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 5,
        payload_ref TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        created_at TEXT NOT NULL,
        claimed_at TEXT,
        completed_at TEXT,
        failed_at TEXT,
        expires_at TEXT,
        error_reason TEXT,
        lane TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS storage_conflict_records (
        conflict_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        conflict_type TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        resolved_at TEXT,
        resolution TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS scheduler_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS application_registry (
        app_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        installed_at TEXT NOT NULL,
        status TEXT NOT NULL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS runtime_configuration (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS identity_accounts (
        account_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        email TEXT,
        linked_at TEXT NOT NULL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS update_metadata (
        app_id TEXT PRIMARY KEY,
        current_version TEXT NOT NULL,
        available_version TEXT,
        last_checked_at TEXT NOT NULL,
        last_applied_at TEXT
      );

      CREATE TABLE IF NOT EXISTS google_workspace_meta (
        resource_id TEXT PRIMARY KEY,
        resource_type TEXT NOT NULL,
        name TEXT NOT NULL,
        mime_type TEXT,
        last_synced_at TEXT NOT NULL,
        status TEXT NOT NULL,
        metadata TEXT
      );
    `);
  }

  getDb(): Database.Database {
    if (!this.db || this.state !== 'READY') {
      throw new Error(`SQLite Runtime Service is not ready (state: ${this.state})`);
    }
    return this.db;
  }

  close(): void {
    if (this.db) {
      this.state = 'CLOSING';
      this.db.close();
      this.db = null;
    }
  }

  isReady(): boolean {
    return this.state === 'READY' && this.db !== null;
  }
}

export const sqliteRuntimeService = new SqliteRuntimeService();
