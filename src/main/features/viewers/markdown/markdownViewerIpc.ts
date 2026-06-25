import { ipcMain } from 'electron';
import { ServerResponse, HttpStatusCode } from 'astra';

const VALID_OWNER_TYPES = new Set(['VAULT_DOCUMENT', 'SYSTEM_LOG', 'AUDIT_REPORT', 'GOOGLE_DOC']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface MarkdownLoadRequest {
  source: 'runtime' | 'vault';
  path: string;
  format: 'markdown';
  ownerType?: string;
}

export interface MarkdownLoadResponse {
  content: string;
  path: string;
  format: string;
  ownerType?: string;
}

/**
 * Service interface for resolving document content by path.
 * Consuming applications inject real implementations (runtimeDocumentStore, vaultService).
 * Default implementation delegates to the filesystem.
 */
export interface IMarkdownDocumentResolver {
  exists(path: string): Promise<boolean>;
  sizeBytes(path: string): Promise<number>;
  read(path: string): Promise<string>;
}

async function defaultFsResolver(): Promise<IMarkdownDocumentResolver> {
  const { readFile, stat } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  return {
    exists: async (p) => existsSync(p),
    sizeBytes: async (p) => (await stat(p)).size,
    read: async (p) => readFile(p, 'utf-8'),
  };
}

let _resolver: IMarkdownDocumentResolver | null = null;

export function setMarkdownDocumentResolver(resolver: IMarkdownDocumentResolver): void {
  _resolver = resolver;
}

export function registerMarkdownViewerIpcHandlers(): void {
  ipcMain.handle('markdownViewer:load', async (_e, payload: MarkdownLoadRequest) => {
    try {
      if (!payload.path || payload.format !== 'markdown') {
        return ServerResponse.error({ status: HttpStatusCode.BAD_REQUEST, statusMessage: 'Invalid request: path and format=markdown are required' });
      }

      const ownerType =
        payload.ownerType && VALID_OWNER_TYPES.has(payload.ownerType)
          ? payload.ownerType
          : undefined;

      const resolver = _resolver ?? await defaultFsResolver();

      if (!(await resolver.exists(payload.path))) {
        return ServerResponse.error({ status: HttpStatusCode.NOT_FOUND, statusMessage: `Document not found: ${payload.path}` });
      }

      const size = await resolver.sizeBytes(payload.path);
      if (size > MAX_FILE_SIZE_BYTES) {
        return ServerResponse.error({ status: HttpStatusCode.BAD_REQUEST, statusMessage: `Document exceeds maximum size of 10 MB` });
      }

      const raw = await resolver.read(payload.path);

      const response: MarkdownLoadResponse = {
        content: raw,
        path: payload.path,
        format: 'markdown',
        ...(ownerType ? { ownerType } : {})
      };

      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: response });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });
}
