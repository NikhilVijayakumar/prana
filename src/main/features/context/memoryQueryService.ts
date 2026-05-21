import { performance } from 'node:perf_hooks';
import {
  memoryIndexService,
  type MemoryChunk,
  type MemoryClassification,
  type MemoryIndexHealth,
} from './memoryIndexService';

export interface MemoryQueryRequest {
  query: string;
  limit?: number;
  allowedClassifications?: MemoryClassification[];
  pathPrefixes?: string[];
}

export interface MemoryQueryResult {
  chunkId: string;
  relativePath: string;
  title: string;
  classification: MemoryClassification;
  chunkIndex: number;
  score: number;
  semanticScore: number;
  keywordScore: number;
  excerpt: string;
  route: 'LOCAL_ONLY' | 'LOCAL_PREFERRED';
}

export interface MemoryQueryResponse {
  query: string;
  results: MemoryQueryResult[];
  route: 'LOCAL_ONLY' | 'LOCAL_PREFERRED';
  latencyMs: number;
}

const classifySensitivityWeight = (classification: MemoryClassification): number => {
  if (classification === 'RESTRICTED') {
    return 1.08;
  }
  if (classification === 'CONFIDENTIAL') {
    return 1.04;
  }
  return 1;
};

const cosine = (a: number[], b: number[]): number => {
  if (a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) {
    return 0;
  }
  return dot / denom;
};

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
};

const toVector = (text: string): number[] => {
  const tokens = tokenize(text);
  const vector = new Array<number>(64).fill(0);
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) {
      hash = (hash * 33 + token.charCodeAt(i)) >>> 0;
    }
    vector[hash % vector.length] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
};

const keywordScore = (queryTokens: string[], chunk: MemoryChunk): number => {
  if (queryTokens.length === 0) {
    return 0;
  }

  const keywords = new Set(chunk.keywords);
  let matched = 0;
  for (const token of queryTokens) {
    if (keywords.has(token) || chunk.text.toLowerCase().includes(token)) {
      matched += 1;
    }
  }

  return matched / queryTokens.length;
};

const makeExcerpt = (text: string, queryTokens: string[]): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 220) {
    return normalized;
  }

  const lower = normalized.toLowerCase();
  let index = -1;
  for (const token of queryTokens) {
    index = lower.indexOf(token);
    if (index >= 0) {
      break;
    }
  }

  if (index < 0) {
    return `${normalized.slice(0, 220).trim()}...`;
  }

  const start = Math.max(0, index - 80);
  const end = Math.min(normalized.length, start + 220);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < normalized.length ? '...' : '';
  return `${prefix}${normalized.slice(start, end).trim()}${suffix}`;
};

const computeRoute = (request: MemoryQueryRequest): 'LOCAL_ONLY' | 'LOCAL_PREFERRED' => {
  const classifications = request.allowedClassifications ?? [];
  const sensitive = classifications.includes('CONFIDENTIAL') || classifications.includes('RESTRICTED');
  return sensitive ? 'LOCAL_ONLY' : 'LOCAL_PREFERRED';
};

const applyScopeFilter = (chunk: MemoryChunk, request: MemoryQueryRequest): boolean => {
  if (request.allowedClassifications && request.allowedClassifications.length > 0) {
    if (!request.allowedClassifications.includes(chunk.classification)) {
      return false;
    }
  }

  if (request.pathPrefixes && request.pathPrefixes.length > 0) {
    const matched = request.pathPrefixes.some((prefix) => chunk.relativePath.startsWith(prefix));
    if (!matched) {
      return false;
    }
  }

  return true;
};

export const memoryQueryService = {
  async query(request: MemoryQueryRequest): Promise<MemoryQueryResponse> {
    const startedAt = performance.now();
    const query = request.query.trim();
    if (!query) {
      return {
        query,
        route: computeRoute(request),
        latencyMs: 0,
        results: [],
      };
    }

    const route = computeRoute(request);
    const queryTokens = tokenize(query);
    const queryVector = toVector(query);
    const limit = Math.max(1, Math.min(100, request.limit ?? 8));

    const chunks = (await memoryIndexService.getChunks()).filter((chunk) => applyScopeFilter(chunk, request));

    const ranked: MemoryQueryResult[] = chunks
      .map((chunk) => {
        const semanticScore = cosine(queryVector, chunk.vector);
        const keyScore = keywordScore(queryTokens, chunk);
        const blended = semanticScore * 0.65 + keyScore * 0.35;
        const score = blended * classifySensitivityWeight(chunk.classification);

        return {
          chunkId: chunk.id,
          relativePath: chunk.relativePath,
          title: chunk.title,
          classification: chunk.classification,
          chunkIndex: chunk.chunkIndex,
          score,
          semanticScore,
          keywordScore: keyScore,
          excerpt: makeExcerpt(chunk.text, queryTokens),
          route,
        };
      })
      .filter((entry) => entry.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const latencyMs = Math.round((performance.now() - startedAt) * 100) / 100;
    return {
      query,
      results: ranked,
      route,
      latencyMs,
    };
  },

  async health(): Promise<MemoryIndexHealth> {
    return memoryIndexService.getHealth();
  },
};
