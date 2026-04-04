import { syncStoreService, type EmbeddingRecord } from './syncStoreService';
import { memoryIndexService } from './memoryIndexService';

export interface VectorSearchResult {
  embeddingId: string;
  namespace: string;
  contentHash: string;
  score: number;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

const cosine = (left: number[], right: number[]): number => {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  if (denominator === 0) {
    return 0;
  }

  return dot / denominator;
};

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
};

const toVector = (text: string, size: number): number[] => {
  const tokens = tokenize(text);
  const vector = new Array<number>(size).fill(0);
  for (const token of tokens) {
    let hash = 0;
    for (let index = 0; index < token.length; index += 1) {
      hash = (hash * 33 + token.charCodeAt(index)) >>> 0;
    }
    vector[hash % vector.length] += 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
};

export const vectorSearchService = {
  async indexMemoryNamespace(namespace = 'vault-memory'): Promise<{ indexed: number }> {
    const chunks = await memoryIndexService.getChunks();
    for (const chunk of chunks) {
      await syncStoreService.upsertEmbedding({
        embeddingId: chunk.id,
        namespace,
        contentHash: chunk.id,
        vector: chunk.vector,
        metadata: {
          relativePath: chunk.relativePath,
          title: chunk.title,
          classification: chunk.classification,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          keywords: chunk.keywords,
        },
      });
    }

    return {
      indexed: chunks.length,
    };
  },

  async query(input: {
    namespace?: string;
    query: string;
    limit?: number;
  }): Promise<VectorSearchResult[]> {
    const namespace = input.namespace ?? 'vault-memory';
    const embeddings = await syncStoreService.listEmbeddingsByNamespace(namespace);
    if (embeddings.length === 0) {
      return [];
    }

    const vectorSize = embeddings[0]?.vector.length || 64;
    const queryVector = toVector(input.query, vectorSize);
    const limit = Math.max(1, Math.min(50, input.limit ?? 8));

    return embeddings
      .map((embedding) => ({
        embeddingId: embedding.embeddingId,
        namespace: embedding.namespace,
        contentHash: embedding.contentHash,
        score: cosine(queryVector, embedding.vector),
        metadata: embedding.metadata,
        updatedAt: embedding.updatedAt,
      }))
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  },

  async previewNamespace(namespace = 'vault-memory'): Promise<EmbeddingRecord[]> {
    return syncStoreService.listEmbeddingsByNamespace(namespace);
  },
};
