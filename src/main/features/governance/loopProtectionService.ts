/**
 * LoopProtectionService - Channel-Agnostic Agent Loop Protection
 *
 * Implements max-turns and semantic (Cosine Similarity via BGE-micro) limits
 * to prevent agents hallucinating in loops indefinitely.
 */

import { pipeline } from '@xenova/transformers';

export class EscalationRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EscalationRequiredError';
  }
}

export class LoopProtectionService {
  private extractor: any = null;

  constructor() {
    this.initExtractor();
  }

  private async initExtractor() {
    try {
      // Lazy load the embedding pipeline
      // Will cache locally (typically in ./node_modules/.cache or system cache)
      this.extractor = await pipeline('feature-extraction', 'Xenova/bge-micro-v2');
      console.log("[LoopProtectionService] BGE-Micro initialized successfully.");
    } catch (err) {
      console.warn("[LoopProtectionService] Failed to initialize BGE-micro-v2:", err);
    }
  }

  /**
   * Calculates cosine similarity between two numeric arrays
   */
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

  /**
   * Intercept an ongoing conversation array. Throws EscalationRequiredError if limits are breached.
   *
   * @param taskId A unique string identifying the task, thread, or conversation ID.
   * @param messages Array of recent messages in chronological order.
   */
  public async intercept(taskId: string, messages: string[]): Promise<void> {
    // 1. Counter Limit Check
    // If the rolling context > 5 interactions, we strictly halt it.
    if (messages.length > 5) {
      throw new EscalationRequiredError(`Task ${taskId} exceeded max turns (5). Escalation required.`);
    }

    // 2. Semantic Similarity Check
    // Evaluates embeddings for the last 3 generated messages to detect cyclical hallucinations.
    if (messages.length >= 3 && this.extractor) {
      const last3 = messages.slice(-3);
      
      const embeddings = await Promise.all(
        last3.map(msg => this.extractor(msg, { pooling: 'mean', normalize: true }))
      );
      
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const sim = this.cosineSimilarity(
            Array.from(embeddings[i].data), 
            Array.from(embeddings[j].data)
          );
          
          // Cutoff threshold strictly defined as > 0.90
          if (sim > 0.9) {
             throw new EscalationRequiredError(
               `Semantic loop detected (similarity ${sim.toFixed(2)}) between messages in Task ${taskId}. Escalation required.`
             );
          }
        }
      }
    }
  }
}

export const loopProtectionService = new LoopProtectionService();
