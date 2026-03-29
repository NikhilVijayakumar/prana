import { HttpStatusCode, ServerResponse } from 'astra';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

export interface PendingFile {
  id: string;
  filename: string;
  relativePath: string;
  agent: string;
  size: string;
  classification: 'T1' | 'T2' | 'T3' | 'T4';
}

export interface VaultNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  relativePath: string;
  children?: VaultNode[];
  size?: string;
}

export interface VaultPayload {
  status: 'LOCKED' | 'UNLOCKED' | 'SYNCING';
  lastSync: string;
  pendingFiles: PendingFile[];
  directoryTree: VaultNode[];
}

export interface VaultFileContent {
  fileName: string;
  relativePath: string;
  encoding: 'text' | 'base64';
  mimeType: string;
  content: string;
}

export interface MemorySearchHit {
  chunkId: string;
  relativePath: string;
  title: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  chunkIndex: number;
  score: number;
  semanticScore: number;
  keywordScore: number;
  excerpt: string;
  route: 'LOCAL_ONLY' | 'LOCAL_PREFERRED';
}

export interface MemorySearchPayload {
  query: string;
  route: 'LOCAL_ONLY' | 'LOCAL_PREFERRED';
  latencyMs: number;
  results: MemorySearchHit[];
}

export interface MemoryHealthPayload {
  status: 'healthy' | 'warning' | 'critical';
  stats: {
    documentCount: number;
    chunkCount: number;
    lastIndexedAt: string | null;
    averageChunkTokens: number;
  };
  indexPath: string;
  message: string;
}

interface MemoryReindexPayload {
  documentCount: number;
  chunkCount: number;
}

export class VaultKnowledgeRepo {
  async getVaultData(): Promise<ServerResponse<VaultPayload>> {
    const payload = await safeIpcCall(
      'vaultKnowledge.getSnapshot',
      () => window.api.vaultKnowledge.getSnapshot(),
      (value) => typeof value === 'object' && value !== null,
    );

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Loaded',
      data: payload,
    } as ServerResponse<VaultPayload>;
  }

  async readFile(relativePath: string): Promise<ServerResponse<VaultFileContent>> {
    const payload = await safeIpcCall(
      'vaultKnowledge.readFile',
      () => window.api.vaultKnowledge.readFile(relativePath),
      (value) => typeof value === 'object' && value !== null,
    );

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Loaded',
      data: payload,
    } as ServerResponse<VaultFileContent>;
  }

  async approve(relativePath: string): Promise<ServerResponse<VaultPayload>> {
    const payload = await safeIpcCall(
      'vaultKnowledge.approve',
      () => window.api.vaultKnowledge.approve(relativePath),
      (value) => typeof value === 'object' && value !== null,
    );

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Approved',
      data: payload,
    } as ServerResponse<VaultPayload>;
  }

  async reject(relativePath: string): Promise<ServerResponse<VaultPayload>> {
    const payload = await safeIpcCall(
      'vaultKnowledge.reject',
      () => window.api.vaultKnowledge.reject(relativePath),
      (value) => typeof value === 'object' && value !== null,
    );

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Rejected',
      data: payload,
    } as ServerResponse<VaultPayload>;
  }

  async searchMemory(query: string, limit = 8): Promise<ServerResponse<MemorySearchPayload>> {
    const payload = await safeIpcCall('memory.query', () => window.api.memory.query({
      query,
      limit,
      pathPrefixes: ['data/', 'agent-temp/'],
      allowedClassifications: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
    }), (value) => typeof value === 'object' && value !== null);

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Memory search loaded',
      data: payload,
    } as ServerResponse<MemorySearchPayload>;
  }

  async getMemoryHealth(): Promise<ServerResponse<MemoryHealthPayload>> {
    const payload = await safeIpcCall(
      'memory.health',
      () => window.api.memory.health(),
      (value) => typeof value === 'object' && value !== null,
    );

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Memory health loaded',
      data: payload,
    } as ServerResponse<MemoryHealthPayload>;
  }

  async reindexMemory(): Promise<ServerResponse<{ documentCount: number; chunkCount: number }>> {
    const payload = await safeIpcCall<MemoryReindexPayload>(
      'memory.reindexDirectory',
      () => window.api.memory.reindexDirectory(),
      (value) => typeof value === 'object' && value !== null,
    );

    return {
      isSuccess: true,
      isError: false,
      status: HttpStatusCode.SUCCESS,
      statusMessage: 'Memory reindexed',
      data: {
        documentCount: payload.documentCount,
        chunkCount: payload.chunkCount,
      },
    } as ServerResponse<{ documentCount: number; chunkCount: number }>;
  }
}
