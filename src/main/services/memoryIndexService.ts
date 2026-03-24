import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import { getAppDataRoot } from './governanceRepoService';

export type MemoryClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface MemoryChunk {
  id: string;
  documentId: string;
  relativePath: string;
  title: string;
  classification: MemoryClassification;
  chunkIndex: number;
  tokenCount: number;
  text: string;
  keywords: string[];
  vector: number[];
  updatedAt: string;
}

export interface MemoryDocument {
  id: string;
  relativePath: string;
  title: string;
  classification: MemoryClassification;
  checksum: string;
  chunkCount: number;
  updatedAt: string;
}

export interface MemoryIndexStats {
  documentCount: number;
  chunkCount: number;
  lastIndexedAt: string | null;
  averageChunkTokens: number;
}

export interface MemoryIndexHealth {
  status: 'healthy' | 'warning' | 'critical';
  stats: MemoryIndexStats;
  indexPath: string;
  message: string;
}

interface PersistedMemoryIndex {
  documents: MemoryDocument[];
  chunks: MemoryChunk[];
  lastIndexedAt: string | null;
}

const INDEX_FILE = 'memory-index.json';
const VECTOR_SIZE = 64;
const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 120;

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.json', '.jsonl', '.csv']);

let loaded = false;
let lastIndexedAt: string | null = null;

const documents = new Map<string, MemoryDocument>();
const chunks = new Map<string, MemoryChunk>();

const nowIso = (): string => new Date().toISOString();

const getIndexPath = (): string => join(getAppDataRoot(), INDEX_FILE);

const checksumFor = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return `h${hash.toString(16)}`;
};

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
};

const dedupeKeywords = (tokens: string[]): string[] => {
  const unique = new Set<string>();
  for (const token of tokens) {
    unique.add(token);
    if (unique.size >= 24) {
      break;
    }
  }
  return [...unique];
};

const toVector = (text: string): number[] => {
  const tokens = tokenize(text);
  const vector = new Array<number>(VECTOR_SIZE).fill(0);

  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) {
      hash = (hash * 33 + token.charCodeAt(i)) >>> 0;
    }
    vector[hash % VECTOR_SIZE] += 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
};

const splitIntoChunks = (text: string): string[] => {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= CHUNK_SIZE) {
    return [normalized];
  }

  const slices: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + CHUNK_SIZE);
    const slice = normalized.slice(cursor, end).trim();
    if (slice) {
      slices.push(slice);
    }
    if (end >= normalized.length) {
      break;
    }
    cursor = Math.max(cursor + 1, end - CHUNK_OVERLAP);
  }

  return slices;
};

const classifyFromPath = (relativePath: string): MemoryClassification => {
  const value = relativePath.toLowerCase();
  if (value.includes('agent-temp/') || value.includes('/raw/')) {
    return 'CONFIDENTIAL';
  }
  if (value.includes('decisions') || value.includes('kpi') || value.includes('ledger')) {
    return 'RESTRICTED';
  }
  if (value.includes('/processed/')) {
    return 'INTERNAL';
  }
  return 'PUBLIC';
};

const toDocumentId = (relativePath: string): string => `doc_${checksumFor(relativePath)}`;

const ensureLoaded = async (): Promise<void> => {
  if (loaded) {
    return;
  }

  await mkdir(getAppDataRoot(), { recursive: true });
  const indexPath = getIndexPath();

  if (!existsSync(indexPath)) {
    const seeded: PersistedMemoryIndex = {
      documents: [],
      chunks: [],
      lastIndexedAt: null,
    };
    await writeFile(indexPath, JSON.stringify(seeded, null, 2), 'utf8');
  }

  const raw = await readFile(indexPath, 'utf8');
  const parsed = JSON.parse(raw) as PersistedMemoryIndex;

  documents.clear();
  chunks.clear();

  for (const document of parsed.documents ?? []) {
    documents.set(document.id, document);
  }

  for (const chunk of parsed.chunks ?? []) {
    chunks.set(chunk.id, chunk);
  }

  lastIndexedAt = parsed.lastIndexedAt ?? null;
  loaded = true;
};

const persist = async (): Promise<void> => {
  const payload: PersistedMemoryIndex = {
    documents: [...documents.values()],
    chunks: [...chunks.values()],
    lastIndexedAt,
  };
  await writeFile(getIndexPath(), JSON.stringify(payload, null, 2), 'utf8');
};

const removeDocumentChunks = (documentId: string): void => {
  for (const [chunkId, chunk] of chunks.entries()) {
    if (chunk.documentId === documentId) {
      chunks.delete(chunkId);
    }
  }
};

const indexTextInternal = async (
  relativePath: string,
  content: string,
  classification: MemoryClassification,
): Promise<MemoryDocument> => {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const documentId = toDocumentId(normalizedPath);
  const checksum = checksumFor(content);
  const existing = documents.get(documentId);

  if (existing && existing.checksum === checksum) {
    return existing;
  }

  removeDocumentChunks(documentId);

  const title = basename(normalizedPath);
  const split = splitIntoChunks(content);
  const updatedAt = nowIso();

  const document: MemoryDocument = {
    id: documentId,
    relativePath: normalizedPath,
    title,
    classification,
    checksum,
    chunkCount: split.length,
    updatedAt,
  };
  documents.set(documentId, document);

  split.forEach((text, chunkIndex) => {
    const id = `chk_${checksumFor(`${documentId}:${chunkIndex}:${checksum}`)}`;
    const tokens = tokenize(text);
    const chunk: MemoryChunk = {
      id,
      documentId,
      relativePath: normalizedPath,
      title,
      classification,
      chunkIndex,
      tokenCount: tokens.length,
      text,
      keywords: dedupeKeywords(tokens),
      vector: toVector(text),
      updatedAt,
    };
    chunks.set(id, chunk);
  });

  lastIndexedAt = updatedAt;
  return document;
};

const collectTextFiles = async (rootPath: string): Promise<string[]> => {
  if (!existsSync(rootPath)) {
    return [];
  }

  const all: string[] = [];
  const walk = async (dirPath: string): Promise<void> => {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(extension)) {
        all.push(full);
      }
    }
  };

  await walk(rootPath);
  return all;
};

export const memoryIndexService = {
  async initialize(): Promise<void> {
    await ensureLoaded();
  },

  async indexText(input: {
    relativePath: string;
    content: string;
    classification?: MemoryClassification;
  }): Promise<MemoryDocument> {
    await ensureLoaded();
    const classification = input.classification ?? classifyFromPath(input.relativePath);
    const doc = await indexTextInternal(input.relativePath, input.content, classification);
    await persist();
    return doc;
  },

  async indexFile(filePath: string, rootPath: string): Promise<MemoryDocument | null> {
    await ensureLoaded();
    const resolvedRoot = resolve(rootPath);
    const resolvedFile = resolve(filePath);

    if (!resolvedFile.startsWith(resolvedRoot)) {
      return null;
    }

    const extension = extname(resolvedFile).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) {
      return null;
    }

    const content = await readFile(resolvedFile, 'utf8');
    const relativePath = relative(resolvedRoot, resolvedFile).replace(/\\/g, '/');
    const doc = await indexTextInternal(relativePath, content, classifyFromPath(relativePath));
    await persist();
    return doc;
  },

  async reindexDirectory(rootPath: string): Promise<MemoryIndexStats> {
    await ensureLoaded();
    const resolvedRoot = resolve(rootPath);
    const files = await collectTextFiles(resolvedRoot);

    const allowedPaths = new Set<string>();

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      const relativePath = relative(resolvedRoot, file).replace(/\\/g, '/');
      allowedPaths.add(relativePath);
      await indexTextInternal(relativePath, content, classifyFromPath(relativePath));
    }

    for (const [docId, document] of documents.entries()) {
      if (!allowedPaths.has(document.relativePath)) {
        documents.delete(docId);
        removeDocumentChunks(docId);
      }
    }

    lastIndexedAt = nowIso();
    await persist();
    return this.getStats();
  },

  async removePath(relativePath: string): Promise<boolean> {
    await ensureLoaded();
    const normalized = relativePath.replace(/\\/g, '/');
    const documentId = toDocumentId(normalized);

    if (!documents.has(documentId)) {
      return false;
    }

    documents.delete(documentId);
    removeDocumentChunks(documentId);
    lastIndexedAt = nowIso();
    await persist();
    return true;
  },

  async getChunks(): Promise<MemoryChunk[]> {
    await ensureLoaded();
    return [...chunks.values()].sort((a, b) => {
      if (a.relativePath !== b.relativePath) {
        return a.relativePath.localeCompare(b.relativePath);
      }
      return a.chunkIndex - b.chunkIndex;
    });
  },

  getStats(): MemoryIndexStats {
    const allChunks = [...chunks.values()];
    const averageChunkTokens = allChunks.length === 0
      ? 0
      : Math.round(allChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / allChunks.length);

    return {
      documentCount: documents.size,
      chunkCount: allChunks.length,
      lastIndexedAt,
      averageChunkTokens,
    };
  },

  async getHealth(): Promise<MemoryIndexHealth> {
    await ensureLoaded();
    const stats = this.getStats();

    const status: MemoryIndexHealth['status'] =
      stats.chunkCount === 0 ? 'warning' : stats.chunkCount < 20 ? 'warning' : 'healthy';

    return {
      status,
      stats,
      indexPath: getIndexPath(),
      message: status === 'healthy'
        ? 'Memory index is healthy.'
        : 'Memory index is available but has limited coverage.',
    };
  },

  async __resetForTesting(): Promise<void> {
    loaded = false;
    documents.clear();
    chunks.clear();
    lastIndexedAt = null;

    await mkdir(getAppDataRoot(), { recursive: true });
    const seeded: PersistedMemoryIndex = {
      documents: [],
      chunks: [],
      lastIndexedAt: null,
    };
    await writeFile(getIndexPath(), JSON.stringify(seeded, null, 2), 'utf8');

    loaded = true;
  },
};
