import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

export type AppLifecycleStatus =
  | 'NOT_INSTALLED'
  | 'INSTALLING'
  | 'INSTALLED'
  | 'RUNNING'
  | 'STOPPED'
  | 'UPDATING'
  | 'UNINSTALLING'
  | 'FAILED'
  | 'CORRUPTED';

export interface AppRegistryRecord {
  appId: string;
  name: string;
  version: string;
  installedAt: string;
  status: AppLifecycleStatus;
  metadata?: Record<string, unknown>;
}

export interface IdentityAccount {
  accountId: string;
  provider: string;
  email?: string;
  linkedAt: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeConfigEntry {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface UpdateMetadata {
  appId: string;
  currentVersion: string;
  availableVersion?: string;
  lastCheckedAt: string;
  lastAppliedAt?: string;
}

class RuntimeService {
  private db: Database.Database | null = null;

  initialize(db: Database.Database): void {
    this.db = db;
  }

  // Identity
  getIdentity(): IdentityAccount | null {
    if (!this.db) throw new Error('RuntimeService not initialized');
    const row = this.db.prepare('SELECT * FROM identity_accounts LIMIT 1').get() as IdentityAccount | undefined;
    if (!row) return null;
    return { ...row, metadata: row.metadata ? JSON.parse(row.metadata as unknown as string) : undefined };
  }

  linkAccount(provider: string, email: string, metadata?: Record<string, unknown>): IdentityAccount {
    if (!this.db) throw new Error('RuntimeService not initialized');
    const account: IdentityAccount = {
      accountId: randomUUID(),
      provider,
      email,
      linkedAt: new Date().toISOString(),
      metadata
    };
    this.db
      .prepare(
        `INSERT OR REPLACE INTO identity_accounts (account_id, provider, email, linked_at, metadata)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(account.accountId, account.provider, account.email ?? null, account.linkedAt, JSON.stringify(account.metadata ?? null));
    return account;
  }

  validateSession(): boolean {
    return this.getIdentity() !== null;
  }

  // Application Registry
  listApplications(): AppRegistryRecord[] {
    if (!this.db) throw new Error('RuntimeService not initialized');
    const rows = this.db.prepare('SELECT * FROM application_registry').all() as AppRegistryRecord[];
    return rows.map((r) => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata as unknown as string) : undefined
    }));
  }

  getApplication(appId: string): AppRegistryRecord | null {
    if (!this.db) throw new Error('RuntimeService not initialized');
    const row = this.db
      .prepare('SELECT * FROM application_registry WHERE app_id=?')
      .get(appId) as AppRegistryRecord | undefined;
    if (!row) return null;
    return { ...row, metadata: row.metadata ? JSON.parse(row.metadata as unknown as string) : undefined };
  }

  installApplication(appId: string, name: string, version: string): AppRegistryRecord {
    if (!this.db) throw new Error('RuntimeService not initialized');
    const record: AppRegistryRecord = {
      appId,
      name,
      version,
      installedAt: new Date().toISOString(),
      status: 'INSTALLED'
    };
    this.db
      .prepare(
        `INSERT OR REPLACE INTO application_registry (app_id, name, version, installed_at, status, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(record.appId, record.name, record.version, record.installedAt, record.status, null);
    return record;
  }

  updateApplicationStatus(appId: string, status: AppLifecycleStatus): void {
    if (!this.db) throw new Error('RuntimeService not initialized');
    this.db
      .prepare('UPDATE application_registry SET status=? WHERE app_id=?')
      .run(status, appId);
  }

  // Configuration
  getConfig(key?: string): RuntimeConfigEntry | RuntimeConfigEntry[] | null {
    if (!this.db) throw new Error('RuntimeService not initialized');
    if (key) {
      const row = this.db
        .prepare('SELECT * FROM runtime_configuration WHERE key=?')
        .get(key) as RuntimeConfigEntry | undefined;
      return row ?? null;
    }
    return this.db.prepare('SELECT * FROM runtime_configuration').all() as RuntimeConfigEntry[];
  }

  setConfig(key: string, value: unknown): RuntimeConfigEntry {
    if (!this.db) throw new Error('RuntimeService not initialized');
    const entry: RuntimeConfigEntry = {
      key,
      value,
      updatedAt: new Date().toISOString()
    };
    this.db
      .prepare(
        `INSERT OR REPLACE INTO runtime_configuration (key, value, updated_at)
         VALUES (?, ?, ?)`
      )
      .run(key, JSON.stringify(value), entry.updatedAt);
    return entry;
  }

  // Updates
  checkUpdate(appId: string): UpdateMetadata | null {
    if (!this.db) throw new Error('RuntimeService not initialized');
    const now = new Date().toISOString();
    const existing = this.db
      .prepare('SELECT * FROM update_metadata WHERE app_id=?')
      .get(appId) as UpdateMetadata | undefined;

    const app = this.getApplication(appId);
    if (!app) return null;

    const record: UpdateMetadata = {
      appId,
      currentVersion: app.version,
      availableVersion: existing?.availableVersion,
      lastCheckedAt: now,
      lastAppliedAt: existing?.lastAppliedAt
    };

    this.db
      .prepare(
        `INSERT OR REPLACE INTO update_metadata (app_id, current_version, available_version, last_checked_at, last_applied_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(record.appId, record.currentVersion, record.availableVersion ?? null, record.lastCheckedAt, record.lastAppliedAt ?? null);

    return record;
  }

  applyUpdate(appId: string, newVersion: string): AppRegistryRecord {
    if (!this.db) throw new Error('RuntimeService not initialized');
    const app = this.getApplication(appId);
    if (!app) throw new Error(`Application ${appId} not found`);

    this.updateApplicationStatus(appId, 'UPDATING');
    this.db
      .prepare('UPDATE application_registry SET version=?, status=? WHERE app_id=?')
      .run(newVersion, 'INSTALLED', appId);
    this.db
      .prepare('UPDATE update_metadata SET current_version=?, last_applied_at=? WHERE app_id=?')
      .run(newVersion, new Date().toISOString(), appId);

    return this.getApplication(appId)!;
  }
}

export const runtimeService = new RuntimeService();
