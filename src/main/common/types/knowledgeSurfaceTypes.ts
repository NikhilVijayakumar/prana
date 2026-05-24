export type SurfaceDocumentState =
  | 'DISCOVERED'
  | 'METADATA_SYNCED'
  | 'EXTRACTED'
  | 'STORED'
  | 'INDEXED'
  | 'STALE'
  | 'FAILED';

export type SurfaceType = 'google-workspace' | 'generic';

export interface SurfaceDocument {
  fileId: string;
  name: string;
  type: 'doc' | 'sheet' | 'slide' | 'file';
  mimeType: string;
  lastModified: string;
  sizeBytes: number;
  state: SurfaceDocumentState;
  syncStatus: string;
  vaultPath: string | null;
  contentHash: string | null;
  extractedAt: string | null;
  storedAt: string | null;
  indexedAt: string | null;
  error: string | null;
}

export interface SurfaceCapabilities {
  supportsDiscovery: boolean;
  supportsExtraction: boolean;
  supportsIndexing: boolean;
  supportsWriteBack: boolean;
  requiresOAuth: boolean;
}

export interface SurfaceDiscoveryResult {
  surfaceId: string;
  discoveredAt: string;
  documentsFound: number;
  documents: SurfaceDocument[];
  errors: string[];
}

export interface SurfaceMetadataSyncResult {
  surfaceId: string;
  syncedAt: string;
  recordsUpdated: number;
  recordsCreated: number;
  errors: string[];
}

export interface SurfaceExtractionResult {
  surfaceId: string;
  extractedAt: string;
  docsExtracted: number;
  sheetsExtracted: number;
  slidesExtracted: number;
  errors: string[];
}

export interface SurfaceStorageResult {
  surfaceId: string;
  storedAt: string;
  cacheRecords: number;
  vaultRecords: number;
  errors: string[];
}

export interface SurfaceIndexingResult {
  surfaceId: string;
  indexedAt: string;
  documentsIndexed: number;
  errors: string[];
}

export interface SurfacePipelineReport {
  surfaceId: string;
  source: 'MANUAL' | 'CRON';
  startedAt: string;
  finishedAt: string;
  overallStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  discovery: SurfaceDiscoveryResult | null;
  metadataSync: SurfaceMetadataSyncResult | null;
  extraction: SurfaceExtractionResult | null;
  storage: SurfaceStorageResult | null;
  indexing: SurfaceIndexingResult | null;
  totalDocuments: number;
  processedDocuments: number;
  errors: string[];
}

export interface SurfaceSnapshot {
  surfaceId: string;
  surfaceType: SurfaceType;
  label: string;
  capabilities: SurfaceCapabilities;
  mode: 'live' | 'file-backed';
  isConnected: boolean;
  documentCount: number;
  lastPipelineRun: SurfacePipelineReport | null;
}

export interface KnowledgeSurface {
  readonly surfaceId: string;
  readonly surfaceType: SurfaceType;

  getCapabilities(): SurfaceCapabilities;
  getSnapshot(): SurfaceSnapshot;

  discover(input?: { folders?: string[]; mimeTypes?: string[] }): Promise<SurfaceDiscoveryResult>;
  syncMetadata(): Promise<SurfaceMetadataSyncResult>;
  extract(input?: { fileIds?: string[] }): Promise<SurfaceExtractionResult>;
  store(input?: { fileIds?: string[] }): Promise<SurfaceStorageResult>;
  index(input?: { fileIds?: string[] }): Promise<SurfaceIndexingResult>;

  runPipeline(source: 'MANUAL' | 'CRON'): Promise<SurfacePipelineReport>;
}
