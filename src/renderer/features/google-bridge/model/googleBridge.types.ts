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

export interface SyncProgressEvent {
  file_id: string;
  status: SyncStatus;
  stage: string;
}
