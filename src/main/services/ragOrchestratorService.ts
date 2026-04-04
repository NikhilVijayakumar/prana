import { memoryQueryService } from './memoryQueryService';
import { vectorSearchService } from './vectorSearchService';

export interface RagContextItem {
  source: 'memory-query' | 'vector-search';
  relativePath: string;
  title: string;
  excerpt: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RagQueryResult {
  query: string;
  route: 'LOCAL_ONLY' | 'LOCAL_PREFERRED';
  contextItems: RagContextItem[];
  assembledContext: string;
}

const normalizeText = (value: unknown): string => {
  return typeof value === 'string' ? value : '';
};

export const ragOrchestratorService = {
  async query(input: {
    query: string;
    limit?: number;
    namespace?: string;
  }): Promise<RagQueryResult> {
    const [memoryResult, vectorResults] = await Promise.all([
      memoryQueryService.query({
        query: input.query,
        limit: input.limit ?? 6,
      }),
      vectorSearchService.query({
        namespace: input.namespace,
        query: input.query,
        limit: input.limit ?? 6,
      }),
    ]);

    const combined = new Map<string, RagContextItem>();

    for (const result of memoryResult.results) {
      combined.set(`memory:${result.chunkId}`, {
        source: 'memory-query',
        relativePath: result.relativePath,
        title: result.title,
        excerpt: result.excerpt,
        score: result.score,
      });
    }

    for (const result of vectorResults) {
      const relativePath = normalizeText(result.metadata.relativePath);
      const title = normalizeText(result.metadata.title) || relativePath || result.embeddingId;
      const excerpt = normalizeText(result.metadata.text)
        || normalizeText(result.metadata.summary)
        || title;

      combined.set(`vector:${result.embeddingId}`, {
        source: 'vector-search',
        relativePath,
        title,
        excerpt,
        score: result.score,
        metadata: result.metadata,
      });
    }

    const contextItems = [...combined.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, Math.min(12, input.limit ?? 8)));

    const assembledContext = contextItems
      .map((item, index) => `[${index + 1}] ${item.title} (${item.relativePath || 'unknown'})\n${item.excerpt}`)
      .join('\n\n');

    return {
      query: input.query.trim(),
      route: memoryResult.route,
      contextItems,
      assembledContext,
    };
  },
};
