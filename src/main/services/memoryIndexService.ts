import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { getAppDataRoot, mkdirSafe } from './governanceRepoService';

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

const DB_FILE_NAME = 'memory-index.sqlite';
const VECTOR_SIZE = 64;
const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 120;

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.json', '.jsonl', '.csv']);

let db: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);
const nowIso = (): string => new Date().toISOString();

const persistDatabase = async (database: Database): Promise<void> => {
  const buffer = database.serialize();
  await mkdirSafe(getAppDataRoot());
  await writeFile(getDbPath(), Buffer.from(buffer));
};

const initializeDatabase = async (): Promise<Database> => {
  await mkdirSafe(getAppDataRoot());

  let database: Database;
  if (existsSync(getDbPath())) {
    database = new Database(getDbPath());
  } else {
    database = new Database(':memory:');
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS memory_documents (
      id TEXT PRIMARY KEY,
      relative_path TEXT NOT NULL,
      title TEXT NOT NULL,
      classification TEXT NOT NULL,
      checksum TEXT NOT NULL,
      chunk_count INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS memory_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      title TEXT NOT NULL,
      classification TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      token_count INTEGER NOT NULL,
      text TEXT NOT NULL,
      keywords_json TEXT NOT NULL,
      vector_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES memory_documents(id)
    );
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_chunks_document ON memory_chunks(document_id);
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_chunks_classification ON memory_chunks(classification);
  `);

  db = database;
  return database;
};

const getDatabase = async (): Promise<Database> => {
  if (!db) {
    await initializeDatabase();
  }
  return db!;
};

const queueWrite = async (operation: () => Promise<void>): Promise<void> => {
  writeQueue = writeQueue.then(operation, operation);
  await writeQueue;
};

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

const indexTextInternal = async (
  relativePath: string,
  content: string,
  classification: MemoryClassification,
): Promise<MemoryDocument> => {
  const database = await getDatabase();
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const documentId = toDocumentId(normalizedPath);
  const checksum = checksumFor(content);
  
  // Check if document exists and checksum matches
  const existing = database.prepare('SELECT chunk_count, updated_at FROM memory_documents WHERE id = ?').get(documentId) as { chunk_count?: number; updated_at?: string } | undefined;
  
  if (existing && existing.chunk_count === checksum) {
    // Return existing document
    return {
      id: documentId,
      relativePath: normalizedPath,
      title: basename(normalizedPath),
      classification,
      checksum,
      chunkCount: existing.chunk_count ?? 0,
      updatedAt: existing.updated_at ?? nowIso(),
    };
  }

  // Remove existing chunks for this document
  database.prepare('DELETE FROM memory_chunks WHERE document_id = ?').run(documentId);
  
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

  // Upsert document
  database.prepare(`
    INSERT OR REPLACE INTO memory_documents (id, relative_path, title, classification, checksum, chunk_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(documentId, normalizedPath, title, classification, checksum, split.length, updatedAt);
  
  // Insert chunks
  const chunkStmt = database.prepare(`
    INSERT INTO memory_chunks (id, document_id, relative_path, title, classification, chunk_index, token_count, text, keywords_json, vector_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
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
    
    chunkStmt.run(
      chunk.id,
      chunk.documentId,
      chunk.relativePath,
      chunk.title,
      chunk.classification,
      chunk.chunkIndex,
      chunk.tokenCount,
      chunk.text,
      JSON.stringify(chunk.keywords),
      JSON.stringify(chunk.vector),
      chunk.updatedAt
    );
  });
  
  chunkStmt.free();
  await persistDatabase(database);
  
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
    await getDatabase();
  },

  async indexText(input: {
    relativePath: string;
    content: string;
    classification?: MemoryClassification;
  }): Promise<MemoryDocument> {
    const classification = input.classification ?? classifyFromPath(input.relativePath);
    const doc = await indexTextInternal(input.relativePath, input.content, classification);
    return doc;
  },

  async indexFile(filePath: string, rootPath: string): Promise<MemoryDocument | null> {
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
    return doc;
  },

  async reindexDirectory(rootPath: string): Promise<MemoryIndexStats> {
    const resolvedRoot = resolve(rootPath);
    const files = await collectTextFiles(resolvedRoot);

    // Remove documents not in allowed paths
    const database = await getDatabase();
    const allowedPaths = new Set<string>();
    
    for (const file of files) {
      const content = await readFile(file, 'utf8');
      const relativePath = relative(resolvedRoot, file).replace(/\\/g, '/');
      allowedPaths.add(relativePath);
      await indexTextInternal(relativePath, content, classifyFromPath(relativePath));
    }

    // Remove documents not in allowed paths
    const allDocs = database.prepare('SELECT id, relative_path FROM memory_documents').all() as { id: string; relative_path: string }[];
    for (const doc of allDocs) {
      if (!allowedPaths.has(doc.relative_path)) {
        database.prepare('DELETE FROM memory_chunks WHERE document_id = ?').run(doc.id);
        database.prepare('DELETE FROM memory_documents WHERE id = ?').run(doc.id);
      }
    }
    
    await persistDatabase(database);
    return this.getStats();
  },

  async getDocumentCount(): Promise<number> {
    const database = await getDatabase();
    const row = database.prepare('SELECT COUNT(*) as cnt FROM memory_documents').get() as { cnt: number };
    return row.cnt;
  },

  async getChunkCount(): Promise<number> {
    const database = await getDatabase();
    const row = database.prepare('SELECT COUNT(*) as cnt FROM memory_chunks').get() as { cnt: number };
    return row.cnt;
  },

  async getStats(): Promise<MemoryIndexStats> {
    const database = await getDatabase();
    const docRow = database.prepare('SELECT COUNT(*) as cnt, AVG(chunk_count) as avg FROM memory_documents').get() as { cnt: number; avg?: number };
    const chunkRow = database.prepare('SELECT COUNT(*) as cnt FROM memory_chunks').get() as { cnt: number };
    
    // Get lastIndexedAt from the most recent document
    const lastRow = database.prepare('SELECT updated_at FROM memory_documents ORDER BY updated_at DESC LIMIT 1').get() as { updated_at?: string } | undefined;
    
    return {
      documentCount: docRow.cnt,
      chunkCount: chunkRow.cnt,
      lastIndexedAt: lastRow?.updated_at ?? null,
      averageChunkTokens: chunkRow.cnt > 0 ? Math.round((docRow.avg ?? 0) * 100) / 100 : 0,
    };
  },

  async getHealth(): Promise<MemoryIndexHealth> {
    const stats = await this.getStats();
    const status: MemoryIndexHealth['status'] = 
      stats.chunkCount === 0 ? 'warning' : stats.chunkCount < 20 ? 'warning' : 'healthy';
    
    return {
      status,
      stats,
      indexPath: getDbPath(),
      message: status === 'healthy' ? 'Memory index is healthy.' : 'Memory index has limited coverage.',
    };
  },

  async findDocumentsByPath(relativePath: string): Promise<MemoryDocument[]> {
    const database = await getDatabase();
    const rows = database.prepare('SELECT * FROM memory_documents WHERE relative_path LIKE ? ORDER BY updated_at DESC').all(`%${relativePath}%`) as Record<string, unknown>[];
    return rows.map(row => ({
      id: String(row.id ?? ''),
      relativePath: String(row.relative_path ?? ''),
      title: String(row.title ?? ''),
      classification: String(row.classification ?? 'PUBLIC') as MemoryClassification,
      checksum: String(row.checksum ?? ''),
      chunkCount: Number(row.chunk_count ?? 0),
      updatedAt: String(row.updated_at ?? nowIso()),
    }));
  },

  async getChunksByDocument(documentId: string): Promise<MemoryChunk[]> {
    const database = await getDatabase();
    const rows = database.prepare('SELECT * FROM memory_chunks WHERE document_id = ? ORDER BY chunk_index ASC').all(documentId) as Record<string, unknown>[];
    return rows.map(row => ({
      id: String(row.id ?? ''),
      documentId: String(row.document_id ?? ''),
      relativePath: String(row.relative_path ?? ''),
      title: String(row.title ?? ''),
      classification: String(row.classification ?? 'PUBLIC') as MemoryClassification,
      chunkIndex: Number(row.chunk_index ?? 0),
      tokenCount: Number(row.token_count ?? 0),
      text: String(row.text ?? ''),
      keywords: JSON.parse(String(row.keywords_json ?? '[]')) as string[],
      vector: JSON.parse(String(row.vector_json ?? '[]')) as number[],
      updatedAt: String(row.updated_at ?? nowIso()),
    }));
  },

  async searchChunks(query: string, limit = 20): Promise<MemoryChunk[]> {
    const database = await getDatabase();
    const queryLower = query.toLowerCase();
    const rows = database.prepare(`
      SELECT * FROM memory_chunks 
      WHERE text LIKE ? OR title LIKE ?
      ORDER BY chunk_index ASC
      LIMIT ?
    `).all(`%${queryLower}%`, `%${queryLower}%`, limit) as Record<string, unknown>[];
    
    return rows.map(row => ({
      id: String(row.id ?? ''),
      documentId: String(row.document_id ?? ''),
      relativePath: String(row.relative_path ?? ''),
      title: String(row.title ?? ''),
      classification: String(row.classification ?? 'PUBLIC') as MemoryClassification,
      chunkIndex: Number(row.chunk_index ?? 0),
      tokenCount: Number(row.token_count ?? 0),
      text: String(row.text ?? ''),
      keywords: JSON.parse(String(row.keywords_json ?? '[]')) as string[],
      vector: JSON.parse(String(row.vector_json ?? '[]')) as number[],
      updatedAt: String(row.updated_at ?? nowIso()),
    }));
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    db = null;
    writeQueue = Promise.resolve();
    await rm(getDbPath(), { force: true });
  },
};
