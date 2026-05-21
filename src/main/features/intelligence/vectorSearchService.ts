import { pipeline } from '@xenova/transformers';

export interface VectorSearchResult {
  embeddingId: string;
  score: number;
  metadata: Record<string, any>;
}

export interface VectorSearchQuery {
  namespace?: string;
  query: string;
  limit?: number;
}

export class VectorSearchService {
  private extractor: any = null;
  private semanticCache = new Map<string, { vector: number[], metadata: Record<string, any>, namespace?: string }>();

  constructor() {
    this.initExtractor();
  }

  private async initExtractor() {
    try {
      this.extractor = await pipeline('feature-extraction', 'Xenova/bge-micro-v2');
      console.log("[VectorSearchService] BGE-Micro initialized successfully.");
    } catch (err) {
      console.warn("[VectorSearchService] Failed to initialize BGE-micro-v2:", err);
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  public async indexDocument(docId: string, text: string, metadata: Record<string, any> = {}, namespace?: string): Promise<void> {
    if (!this.extractor) {
      await this.initExtractor();
    }
    if (!this.extractor) return; 

    metadata.text = metadata.text || text;

    const out = await this.extractor(text, { pooling: 'mean', normalize: true });
    const vector = Array.from(out.data) as number[];
    this.semanticCache.set(docId, { vector, metadata, namespace });
  }

  public async search(query: string, k: number = 5): Promise<{docId: string, score: number}[]> {
     const results = await this.query({ query, limit: k });
     return results.map(r => ({ docId: r.embeddingId, score: r.score }));
  }

  public async query(input: VectorSearchQuery): Promise<VectorSearchResult[]> {
    if (!this.extractor) {
      await this.initExtractor();
    }
    if (!this.extractor || this.semanticCache.size === 0) return [];

    const out = await this.extractor(input.query, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(out.data) as number[];

    const results: VectorSearchResult[] = [];
    for (const [docId, doc] of this.semanticCache.entries()) {
      if (input.namespace && doc.namespace && doc.namespace !== input.namespace) continue;
      
      const score = this.cosineSimilarity(queryVector, doc.vector);
      results.push({ embeddingId: docId, score, metadata: doc.metadata });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, input.limit ?? 5);
  }

  public clear(): void {
    this.semanticCache.clear();
  }
}

export const vectorSearchService = new VectorSearchService();
