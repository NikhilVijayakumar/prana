import { ipcMain } from 'electron';
import { ServerResponse, HttpStatusCode } from 'astra';
import Database from 'better-sqlite3';

export type SyncStatus =
  | 'DISCOVERED'
  | 'METADATA_SYNCED'
  | 'EXTRACTED'
  | 'PROJECTED'
  | 'STORED'
  | 'STALE'
  | 'FAILED'
  | 'RETRY_PENDING'
  | 'SKIPPED';

export interface WorkspaceMetaRecord {
  resourceId: string;
  resourceType: 'document' | 'sheet' | 'slide' | 'unknown';
  name: string;
  mimeType?: string;
  lastSyncedAt: string;
  status: SyncStatus;
  metadata?: Record<string, unknown>;
}

export interface SyncStatusSnapshot {
  documentsDiscovered: number;
  documentsProcessed: number;
  extractionSuccessRate: number;
  apiErrorCount: number;
  staleCount: number;
  lastSyncAt?: string;
  isAuthenticated: boolean;
}

export type GoogleBridgePushCallback = (channel: string, data: unknown) => void;

class GoogleBridgeService {
  private db: Database.Database | null = null;
  private authenticated = false;
  private syncLocked = false;
  private pushCallback: GoogleBridgePushCallback | null = null;
  private metrics = {
    discovered: 0,
    processed: 0,
    extractionErrors: 0,
    apiErrors: 0
  };

  initialize(db: Database.Database, pushCallback?: GoogleBridgePushCallback): void {
    this.db = db;
    this.pushCallback = pushCallback ?? null;
  }

  async authenticate(): Promise<boolean> {
    // OAuth on port 3111 — stub; real implementation would start HTTP server
    try {
      this.authenticated = true;
      return true;
    } catch {
      this.authenticated = false;
      return false;
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  getStatus(): SyncStatusSnapshot {
    if (!this.db) throw new Error('GoogleBridgeService not initialized');

    const staleCount = (
      this.db
        .prepare(`SELECT COUNT(*) as c FROM google_workspace_meta WHERE status='STALE'`)
        .get() as { c: number }
    ).c;

    const lastRow = this.db
      .prepare(`SELECT MAX(last_synced_at) as last FROM google_workspace_meta`)
      .get() as { last: string | null };

    return {
      documentsDiscovered: this.metrics.discovered,
      documentsProcessed: this.metrics.processed,
      extractionSuccessRate:
        this.metrics.discovered > 0
          ? (this.metrics.processed / this.metrics.discovered) * 100
          : 0,
      apiErrorCount: this.metrics.apiErrors,
      staleCount,
      lastSyncAt: lastRow?.last ?? undefined,
      isAuthenticated: this.authenticated
    };
  }

  listDocuments(filter?: string): WorkspaceMetaRecord[] {
    if (!this.db) throw new Error('GoogleBridgeService not initialized');

    let query = 'SELECT * FROM google_workspace_meta';
    const params: unknown[] = [];

    if (filter) {
      query += ' WHERE name LIKE ?';
      params.push(`%${filter}%`);
    }

    const rows = this.db.prepare(query).all(...params) as Array<{
      resource_id: string;
      resource_type: string;
      name: string;
      mime_type: string | null;
      last_synced_at: string;
      status: string;
      metadata: string | null;
    }>;

    return rows.map((r) => ({
      resourceId: r.resource_id,
      resourceType: r.resource_type as WorkspaceMetaRecord['resourceType'],
      name: r.name,
      mimeType: r.mime_type ?? undefined,
      lastSyncedAt: r.last_synced_at,
      status: r.status as SyncStatus,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined
    }));
  }

  getDocument(fileId: string): WorkspaceMetaRecord | null {
    if (!this.db) throw new Error('GoogleBridgeService not initialized');

    const row = this.db
      .prepare('SELECT * FROM google_workspace_meta WHERE resource_id=?')
      .get(fileId) as {
      resource_id: string;
      resource_type: string;
      name: string;
      mime_type: string | null;
      last_synced_at: string;
      status: string;
      metadata: string | null;
    } | undefined;

    if (!row) return null;

    return {
      resourceId: row.resource_id,
      resourceType: row.resource_type as WorkspaceMetaRecord['resourceType'],
      name: row.name,
      mimeType: row.mime_type ?? undefined,
      lastSyncedAt: row.last_synced_at,
      status: row.status as SyncStatus,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  async triggerSync(folderId?: string): Promise<boolean> {
    if (!this.authenticated) return false;
    if (this.syncLocked) return false;

    this.syncLocked = true;
    try {
      // Stub: real implementation would run Discovery→Metadata→Extraction→Projection pipeline
      this.pushCallback?.('google-bridge:sync-progress', {
        file_id: folderId ?? 'root',
        status: 'DISCOVERED',
        stage: 'DISCOVERY'
      });
      this.metrics.discovered++;
      return true;
    } finally {
      this.syncLocked = false;
    }
  }

  upsertRecord(record: WorkspaceMetaRecord): void {
    if (!this.db) return;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO google_workspace_meta
         (resource_id, resource_type, name, mime_type, last_synced_at, status, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.resourceId,
        record.resourceType,
        record.name,
        record.mimeType ?? null,
        record.lastSyncedAt,
        record.status,
        record.metadata ? JSON.stringify(record.metadata) : null
      );
  }
}

export const googleBridgeService = new GoogleBridgeService();

export function registerGoogleBridgeIpcHandlers(): void {
  ipcMain.handle('google-bridge:status', () => {
    try {
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: googleBridgeService.getStatus() });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('google-bridge:list-documents', (_e, payload?: { filter?: string }) => {
    try {
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: googleBridgeService.listDocuments(payload?.filter) });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('google-bridge:get-document', (_e, payload: { file_id: string }) => {
    try {
      const doc = googleBridgeService.getDocument(payload.file_id);
      if (!doc) return ServerResponse.error({ status: HttpStatusCode.NOT_FOUND, statusMessage: `Document ${payload.file_id} not found` });
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: doc });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('google-bridge:trigger-sync', async (_e, payload?: { folder_id?: string }) => {
    try {
      const result = await googleBridgeService.triggerSync(payload?.folder_id);
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: result });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('google-bridge:authenticate', async () => {
    try {
      const result = await googleBridgeService.authenticate();
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: result });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });
}
