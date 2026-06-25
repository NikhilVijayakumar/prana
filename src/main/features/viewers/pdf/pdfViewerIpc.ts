import { ipcMain } from 'electron';
import { ServerResponse, HttpStatusCode } from 'astra';

export interface PdfFetchRequest {
  source: 'runtime' | 'vault';
  path: string;
  documentId?: string;
}

export interface PdfDocumentContent {
  documentId: string;
  source: 'runtime' | 'vault';
  content: string; // base64-encoded PDF bytes
  path: string;
  sizeBytes: number;
}

export interface PdfProvenanceMetadata {
  documentId: string;
  source: 'vault' | 'google' | 'system';
  originPath: string;
  createdAt: string;
  lastModified: string;
}

/**
 * Service interface for resolving PDF document bytes by path.
 * Consuming applications inject real implementations (runtimeDocumentStore, vaultService).
 * Default implementation delegates to the filesystem.
 */
export interface IPdfDocumentResolver {
  exists(path: string): Promise<boolean>;
  sizeBytes(path: string): Promise<number>;
  readBytes(path: string): Promise<Buffer>;
}

async function defaultFsResolver(): Promise<IPdfDocumentResolver> {
  const { readFile, stat } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  return {
    exists: async (p) => existsSync(p),
    sizeBytes: async (p) => (await stat(p)).size,
    readBytes: async (p) => readFile(p),
  };
}

let _resolver: IPdfDocumentResolver | null = null;

export function setPdfDocumentResolver(resolver: IPdfDocumentResolver): void {
  _resolver = resolver;
}

const VALID_SOURCES = new Set<string>(['runtime', 'vault']);

export function registerPdfViewerIpcHandlers(): void {
  ipcMain.handle('viewer-pdf:fetch', async (_e, payload: PdfFetchRequest) => {
    try {
      if (!payload.path) {
        return ServerResponse.error({ status: HttpStatusCode.BAD_REQUEST, statusMessage: 'Invalid request: path is required' });
      }

      if (!payload.source || !VALID_SOURCES.has(payload.source)) {
        return ServerResponse.error({ status: HttpStatusCode.BAD_REQUEST, statusMessage: `Invalid source: must be 'runtime' or 'vault'` });
      }

      const resolver = _resolver ?? await defaultFsResolver();

      if (!(await resolver.exists(payload.path))) {
        return ServerResponse.error({ status: HttpStatusCode.NOT_FOUND, statusMessage: `Document not found: ${payload.path}` });
      }

      const size = await resolver.sizeBytes(payload.path);
      const rawBuffer = await resolver.readBytes(payload.path);
      const base64 = rawBuffer.toString('base64');

      const response: PdfDocumentContent = {
        documentId: payload.documentId ?? payload.path,
        source: payload.source,
        content: base64,
        path: payload.path,
        sizeBytes: size
      };

      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: response });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('viewer-pdf:fetch-provenance', async (_e, payload: { documentId: string }) => {
    try {
      if (!payload.documentId) {
        return ServerResponse.error({ status: HttpStatusCode.BAD_REQUEST, statusMessage: 'documentId is required' });
      }

      // Stub: real implementation resolves from runtimeDocumentStore / vaultService
      const meta: PdfProvenanceMetadata = {
        documentId: payload.documentId,
        source: 'system',
        originPath: payload.documentId,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: meta });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // Fire-and-forget observability channel — stub until telemetry service is implemented
  ipcMain.on('viewer-pdf:log-event', (_e, _payload: { eventType: string; documentId?: string; detail?: string }) => {
    // TODO: forward to telemetry service when available (L3 §4.2)
  });
}
