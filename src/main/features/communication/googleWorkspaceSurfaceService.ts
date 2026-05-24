import { createHash } from 'node:crypto';
import type {
  KnowledgeSurface,
  SurfaceCapabilities,
  SurfaceDiscoveryResult,
  SurfaceDocument,
  SurfaceDocumentState,
  SurfaceExtractionResult,
  SurfaceIndexingResult,
  SurfaceMetadataSyncResult,
  SurfacePipelineReport,
  SurfaceSnapshot,
  SurfaceStorageResult,
} from '../../common/types/knowledgeSurfaceTypes';
import type { DocumentConversionService } from '../operations/documentConversionService';
import { runtimeDocumentStoreService } from '../operations/runtimeDocumentStoreService';
import { vectorSearchService } from '../intelligence/vectorSearchService';
import { sqliteConfigStoreService } from '../../common/storage/sqliteConfigStoreService';
import { wrappedFetch } from '../../common/utils/network/globalFetchWrapper';

const GOOGLE_API_BASE = 'https://www.googleapis.com';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const WORKSPACE_DOCUMENTS_STORE_KEY = 'org/google-workspace/documents.json';

interface DocRecord {
  fileId: string;
  name: string;
  type: SurfaceDocument['type'];
  mimeType: string;
  lastModified: string;
  sizeBytes: number;
  state: SurfaceDocumentState;
  vaultPath: string | null;
  contentHash: string | null;
  extractedAt: string | null;
  storedAt: string | null;
  indexedAt: string | null;
  error: string | null;
}

interface WorkspaceSurfaceState {
  documents: Record<string, DocRecord>;
  lastPipelineRun: SurfacePipelineReport | null;
}

interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  adminEmail: string;
}

const nowIso = (): string => new Date().toISOString();
const computeHash = (content: string): string =>
  createHash('sha256').update(content, 'utf8').digest('hex');
const isGoogleDocMime = (mime: string): boolean =>
  mime.startsWith('application/vnd.google-apps.');

const resolveCredentials = (): GoogleCredentials | null => {
  const googleConfig = sqliteConfigStoreService.readSnapshotSync()?.config?.google;
  if (!googleConfig?.clientId || !googleConfig?.clientSecret || !googleConfig?.refreshToken || !googleConfig?.adminEmail) {
    return null;
  }
  return googleConfig as GoogleCredentials;
};

const refreshAccessToken = async (credentials: GoogleCredentials): Promise<string> => {
  const res = await wrappedFetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  }, 10_000);

  if (!res.ok) {
    throw new Error(`[WorkspaceSurface] Token refresh failed: ${res.status}`);
  }

  const data = await res.json() as { access_token?: string };
  if (!data.access_token) {
    throw new Error('[WorkspaceSurface] Token refresh returned no access_token.');
  }

  return data.access_token;
};

const driveMimeToType = (mime: string): SurfaceDocument['type'] => {
  switch (mime) {
    case 'application/vnd.google-apps.document': return 'doc';
    case 'application/vnd.google-apps.spreadsheet': return 'sheet';
    case 'application/vnd.google-apps.presentation': return 'slide';
    default: return 'file';
  }
};

const classifyMimeGroup = (mime: string): 'doc' | 'sheet' | 'slide' | 'file' => {
  if (mime === 'application/vnd.google-apps.document') return 'doc';
  if (mime === 'application/vnd.google-apps.spreadsheet') return 'sheet';
  if (mime === 'application/vnd.google-apps.presentation') return 'slide';
  return 'file';
};

const GWT_DISCOVERY_FILTER = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
].join("','");

export const createWorkspaceSurface = (
  conversionService: DocumentConversionService | null,
): KnowledgeSurface => {
  const credentials = resolveCredentials();
  const surfaceId = 'google-workspace';
  const vaultBasePath = 'vault/google/';
  let lastPipelineRun: SurfacePipelineReport | null = null;
  let documents: Record<string, DocRecord> = {};

  const isLive = credentials !== null;

  const persistState = async (): Promise<void> => {
    const payload: WorkspaceSurfaceState = { documents, lastPipelineRun };
    await runtimeDocumentStoreService.writeText(
      WORKSPACE_DOCUMENTS_STORE_KEY,
      JSON.stringify(payload, null, 2),
    );
  };

  const loadState = async (): Promise<void> => {
    const raw = await runtimeDocumentStoreService.readText(WORKSPACE_DOCUMENTS_STORE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as WorkspaceSurfaceState;
        documents = parsed.documents ?? {};
        lastPipelineRun = parsed.lastPipelineRun ?? null;
      } catch {
        documents = {};
        lastPipelineRun = null;
      }
    }
  };

  const getAccessToken = async (): Promise<string> => {
    if (!credentials) {
      throw new Error('[WorkspaceSurface] No credentials available for live operation.');
    }
    return refreshAccessToken(credentials);
  };

  return {
    surfaceId,
    surfaceType: 'google-workspace',

    getCapabilities(): SurfaceCapabilities {
      return {
        supportsDiscovery: true,
        supportsExtraction: true,
        supportsIndexing: true,
        supportsWriteBack: false,
        requiresOAuth: true,
      };
    },

    getSnapshot(): SurfaceSnapshot {
      const liveCount = Object.values(documents).filter((d) => d.state !== 'FAILED').length;
      return {
        surfaceId,
        surfaceType: 'google-workspace',
        label: 'Google Workspace',
        capabilities: {
          supportsDiscovery: true,
          supportsExtraction: true,
          supportsIndexing: true,
          supportsWriteBack: false,
          requiresOAuth: true,
        },
        mode: isLive ? 'live' : 'file-backed',
        isConnected: isLive,
        documentCount: liveCount,
        lastPipelineRun,
      };
    },

    async discover(input): Promise<SurfaceDiscoveryResult> {
      const discoveredAt = nowIso();
      const errors: string[] = [];
      const discovered: SurfaceDocument[] = [];

      if (!isLive) {
        return { surfaceId, discoveredAt, documentsFound: 0, documents: [], errors: [] };
      }

      try {
        const token = await getAccessToken();
        const queryParts: string[] = [
          `mimeType in ('${GWT_DISCOVERY_FILTER}')`,
          'trashed = false',
        ];

        const folders = input?.folders;
        if (folders && folders.length > 0) {
          const parentFilter = folders.map((f) => `'${f}' in parents`).join(' or ');
          queryParts.push(`(${parentFilter})`);
        }

        const mimeOverrides = input?.mimeTypes;
        if (mimeOverrides && mimeOverrides.length > 0) {
          queryParts.length = 0;
          const mimeFilter = mimeOverrides.map((m) => `mimeType = '${m}'`).join(' or ');
          queryParts.push(`(${mimeFilter})`, 'trashed = false');
        }

        const query = queryParts.join(' and ');
        const q = encodeURIComponent(query);
        const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,size,owners/displayName,webViewLink),nextPageToken');
        let pageToken: string | undefined;
        const allFiles: any[] = [];

        do {
          const url = `${GOOGLE_API_BASE}/drive/v3/files?q=${q}&fields=${fields}&pageSize=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
          const res = await wrappedFetch(url, { headers: { Authorization: `Bearer ${token}` } }, 15_000);

          if (!res.ok) {
            errors.push(`Drive list failed: ${res.status}`);
            break;
          }

          const data = await res.json() as { files?: any[]; nextPageToken?: string };
          allFiles.push(...(data.files ?? []));
          pageToken = data.nextPageToken;
        } while (pageToken);

        for (const file of allFiles) {
          const docType = driveMimeToType(file.mimeType);
          const doc: SurfaceDocument = {
            fileId: file.id,
            name: file.name,
            type: docType,
            mimeType: file.mimeType,
            lastModified: file.modifiedTime ?? nowIso(),
            sizeBytes: file.size ? parseInt(String(file.size), 10) : 0,
            state: 'DISCOVERED',
            syncStatus: 'pending',
            vaultPath: null,
            contentHash: null,
            extractedAt: null,
            storedAt: null,
            indexedAt: null,
            error: null,
          };

          const existing = documents[file.id];
          if (existing) {
            doc.state = existing.state;
            doc.vaultPath = existing.vaultPath;
            doc.contentHash = existing.contentHash;
            doc.extractedAt = existing.extractedAt;
            doc.storedAt = existing.storedAt;
            doc.indexedAt = existing.indexedAt;
            doc.error = existing.error;
            doc.syncStatus = existing.syncStatus;
            const lastModChanged = existing.lastModified !== doc.lastModified;
            if (lastModChanged && (existing.state === 'INDEXED' || existing.state === 'STORED')) {
              doc.state = 'STALE';
              doc.syncStatus = 'stale';
            }
          }

          discovered.push(doc);
          documents[file.id] = doc;
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Discovery failed.');
      }

      await persistState();

      return {
        surfaceId,
        discoveredAt,
        documentsFound: discovered.length,
        documents: discovered,
        errors,
      };
    },

    async syncMetadata(): Promise<SurfaceMetadataSyncResult> {
      const syncedAt = nowIso();
      const errors: string[] = [];
      let recordsCreated = 0;
      let recordsUpdated = 0;

      for (const doc of Object.values(documents)) {
        if (doc.state === 'DISCOVERED' || doc.state === 'STALE') {
          doc.state = 'METADATA_SYNCED';
          doc.syncStatus = 'synced';
          doc.error = null;
          recordsUpdated++;
        }
        if (doc.state === 'FAILED') {
          doc.syncStatus = 'retry_pending';
          recordsUpdated++;
        }
      }

      if (Object.values(documents).length === 0) {
        errors.push('No documents discovered yet. Run discover() first.');
      }

      await persistState();

      return {
        surfaceId,
        syncedAt,
        recordsCreated,
        recordsUpdated,
        errors,
      };
    },

    async extract(input): Promise<SurfaceExtractionResult> {
      const extractedAt = nowIso();
      const errors: string[] = [];
      let docsExtracted = 0;
      let sheetsExtracted = 0;
      let slidesExtracted = 0;

      if (!isLive) {
        return { surfaceId, extractedAt, docsExtracted: 0, sheetsExtracted: 0, slidesExtracted: 0, errors: ['Offline mode — extraction skipped.'] };
      }

      const targetIds = input?.fileIds
        ? input.fileIds.filter((id) => documents[id])
        : Object.keys(documents);

      try {
        const token = await getAccessToken();

        for (const fileId of targetIds) {
          const doc = documents[fileId];
          if (!doc || doc.state === 'INDEXED') continue;
          if (doc.state === 'FAILED' && doc.error?.includes('Auth')) continue;

          try {
            switch (doc.type) {
              case 'doc': {
                const exportUrl = `${GOOGLE_API_BASE}/drive/v3/files/${fileId}/export?mimeType=text/html`;
                const res = await wrappedFetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } }, 30_000);

                if (!res.ok) {
                  errors.push(`Doc export failed for ${doc.name} (${fileId}): ${res.status}`);
                  doc.state = 'FAILED';
                  doc.error = `Export failed: ${res.status}`;
                  break;
                }

                const html = await res.text();
                let markdown = html;

                if (conversionService) {
                  const converted = await conversionService.convertContent({
                    sourceFormat: 'html',
                    targetFormat: 'markdown',
                    content: html,
                  });
                  markdown = converted.content;
                }

                const vaultKey = `${vaultBasePath}${fileId}.md`;
                const contentHash = computeHash(markdown);
                const existingContent = doc.contentHash;

                if (existingContent !== contentHash) {
                  await runtimeDocumentStoreService.writeText(vaultKey, markdown);
                  doc.vaultPath = vaultKey;
                  doc.contentHash = contentHash;
                }

                doc.extractedAt = nowIso();
                doc.state = 'EXTRACTED';
                doc.error = null;
                docsExtracted++;
                break;
              }

              case 'sheet': {
                const range = encodeURIComponent('Sheet1');
                const url = `${GOOGLE_API_BASE}/sheets/v4/spreadsheets/${fileId}/values/${range}`;
                const res = await wrappedFetch(url, { headers: { Authorization: `Bearer ${token}` } }, 30_000);

                if (!res.ok) {
                  errors.push(`Sheet export failed for ${doc.name} (${fileId}): ${res.status}`);
                  doc.state = 'FAILED';
                  doc.error = `Sheets read failed: ${res.status}`;
                  break;
                }

                const data = await res.json() as { values?: string[][] };
                const jsonContent = JSON.stringify(data.values ?? [], null, 2);
                const vaultKey = `${vaultBasePath}${fileId}.json`;
                const contentHash = computeHash(jsonContent);

                if (doc.contentHash !== contentHash) {
                  await runtimeDocumentStoreService.writeText(vaultKey, jsonContent);
                  doc.vaultPath = vaultKey;
                  doc.contentHash = contentHash;
                }

                doc.extractedAt = nowIso();
                doc.state = 'EXTRACTED';
                doc.error = null;
                sheetsExtracted++;
                break;
              }

              case 'slide': {
                const exportUrl = `${GOOGLE_API_BASE}/drive/v3/files/${fileId}/export?mimeType=text/plain`;
                const res = await wrappedFetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } }, 30_000);

                if (!res.ok) {
                  errors.push(`Slide export failed for ${doc.name} (${fileId}): ${res.status}`);
                  doc.state = 'FAILED';
                  doc.error = `Slides export failed: ${res.status}`;
                  break;
                }

                const text = await res.text();
                const markdownLines = text.split('\n').map((l) => l.trim() ? l : '').join('\n');
                const vaultKey = `${vaultBasePath}${fileId}.md`;
                const contentHash = computeHash(markdownLines);

                if (doc.contentHash !== contentHash) {
                  await runtimeDocumentStoreService.writeText(vaultKey, markdownLines);
                  doc.vaultPath = vaultKey;
                  doc.contentHash = contentHash;
                }

                doc.extractedAt = nowIso();
                doc.state = 'EXTRACTED';
                doc.error = null;
                slidesExtracted++;
                break;
              }

              default:
                break;
            }
          } catch (err) {
            errors.push(`Extraction error for ${doc.name}: ${err instanceof Error ? err.message : 'Unknown'}`);
            doc.state = 'FAILED';
            doc.error = err instanceof Error ? err.message : 'Unknown error';
          }
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Batch extraction failed.');
      }

      await persistState();

      return {
        surfaceId,
        extractedAt,
        docsExtracted,
        sheetsExtracted,
        slidesExtracted,
        errors,
      };
    },

    async store(input): Promise<SurfaceStorageResult> {
      const storedAt = nowIso();
      const errors: string[] = [];
      let cacheRecords = 0;
      let vaultRecords = 0;

      const targetIds = input?.fileIds
        ? input.fileIds.filter((id) => documents[id]?.state === 'EXTRACTED')
        : Object.values(documents)
            .filter((d) => d.state === 'EXTRACTED')
            .map((d) => d.fileId);

      for (const fileId of targetIds) {
        const doc = documents[fileId];
        if (!doc || !doc.vaultPath) {
          errors.push(`No vault path for ${doc?.name ?? fileId} — extract first.`);
          continue;
        }

        try {
          const content = await runtimeDocumentStoreService.readText(doc.vaultPath);
          if (!content) {
            errors.push(`Missing cached content for ${doc.name}`);
            doc.state = 'FAILED';
            doc.error = 'Missing cached content';
            continue;
          }

          await runtimeDocumentStoreService.flushPendingToVault(`workspace: store ${doc.name}`);

          doc.state = 'STORED';
          doc.storedAt = nowIso();
          doc.error = null;
          cacheRecords++;
          vaultRecords++;
        } catch (err) {
          errors.push(`Storage error for ${doc.name}: ${err instanceof Error ? err.message : 'Unknown'}`);
          doc.state = 'FAILED';
          doc.error = err instanceof Error ? err.message : 'Unknown';
        }
      }

      if (targetIds.length === 0 && errors.length === 0) {
        errors.push('No extracted documents to store.');
      }

      await persistState();

      return {
        surfaceId,
        storedAt,
        cacheRecords,
        vaultRecords,
        errors,
      };
    },

    async index(input): Promise<SurfaceIndexingResult> {
      const indexedAt = nowIso();
      const errors: string[] = [];
      let documentsIndexed = 0;

      const targetIds = input?.fileIds
        ? input.fileIds.filter((id) => documents[id]?.state === 'STORED')
        : Object.values(documents)
            .filter((d) => d.state === 'STORED')
            .map((d) => d.fileId);

      for (const fileId of targetIds) {
        const doc = documents[fileId];
        if (!doc || !doc.vaultPath) continue;

        try {
          const content = await runtimeDocumentStoreService.readText(doc.vaultPath);
          if (!content) {
            errors.push(`No content for ${doc.name} at ${doc.vaultPath}`);
            continue;
          }

          await vectorSearchService.indexDocument(
            `google-workspace:${fileId}`,
            content.substring(0, 50_000),
            {
              source: 'google-workspace',
              fileId,
              name: doc.name,
              type: doc.type,
              mimeType: doc.mimeType,
              lastModified: doc.lastModified,
              vaultPath: doc.vaultPath,
              text: content.substring(0, 2000),
            },
            'google-workspace',
          );

          doc.state = 'INDEXED';
          doc.indexedAt = nowIso();
          doc.error = null;
          documentsIndexed++;
        } catch (err) {
          errors.push(`Indexing error for ${doc.name}: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }

      if (targetIds.length === 0 && errors.length === 0) {
        errors.push('No stored documents to index.');
      }

      await persistState();

      return {
        surfaceId,
        indexedAt,
        documentsIndexed,
        errors,
      };
    },

    async runPipeline(source: 'MANUAL' | 'CRON'): Promise<SurfacePipelineReport> {
      const startedAt = nowIso();
      const overallErrors: string[] = [];

      await loadState();

      let discovery: SurfaceDiscoveryResult | null = null;
      let metadataSync: SurfaceMetadataSyncResult | null = null;
      let extraction: SurfaceExtractionResult | null = null;
      let storage: SurfaceStorageResult | null = null;
      let indexing: SurfaceIndexingResult | null = null;

      discovery = await this.discover();
      overallErrors.push(...discovery.errors);

      if (discovery.documentsFound > 0 || Object.values(documents).length > 0) {
        metadataSync = await this.syncMetadata();
        overallErrors.push(...metadataSync.errors);

        extraction = await this.extract();
        overallErrors.push(...extraction.errors);

        storage = await this.store();
        overallErrors.push(...storage.errors);

        indexing = await this.index();
        overallErrors.push(...indexing.errors);
      } else {
        metadataSync = await this.syncMetadata();
      }

      const finishedAt = nowIso();
      const totalDocuments = Object.values(documents).length;
      const processedDocuments = Object.values(documents).filter(
        (d) => d.state !== 'DISCOVERED' && d.state !== 'FAILED',
      ).length;

      let overallStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED';
      if (overallErrors.length === 0) {
        overallStatus = 'SUCCESS';
      } else if (processedDocuments > 0) {
        overallStatus = 'PARTIAL';
      } else {
        overallStatus = 'FAILED';
      }

      const report: SurfacePipelineReport = {
        surfaceId,
        source,
        startedAt,
        finishedAt,
        overallStatus,
        discovery,
        metadataSync,
        extraction,
        storage,
        indexing,
        totalDocuments,
        processedDocuments,
        errors: overallErrors,
      };

      lastPipelineRun = report;
      await persistState();

      return report;
    },
  };
};

export const googleWorkspaceSurface = createWorkspaceSurface(null);
