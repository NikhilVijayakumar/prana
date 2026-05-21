import { createHash } from 'node:crypto';

export type ContextOptimizationStage = 'NORMAL' | 'WARNING' | 'COMPACTION_REQUIRED' | 'HARD_LIMIT';

export interface ContextMessageLike {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ContextOptimizationThresholds {
  warningRatio: number;
  compactionRatio: number;
  hardLimitRatio: number;
}

export interface ContextCompactionPlan {
  pinnedMessages: ContextMessageLike[];
  summarizationMessages: ContextMessageLike[];
  activeTailMessages: ContextMessageLike[];
}

const DEFAULT_THRESHOLDS: ContextOptimizationThresholds = {
  warningRatio: 0.7,
  compactionRatio: 0.85,
  hardLimitRatio: 0.95,
};

const PINNED_MESSAGE_PATTERN = /(history digest|current goal|core metadata|active kpi|director|system prompt)/i;
const EVICTABLE_MESSAGE_PATTERN = /(thought|chain[- ]of[- ]thought|reasoning trace|scratchpad|intermediate)/i;

const dedupeById = <T extends ContextMessageLike>(messages: T[]): T[] => {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  });
};

const isPinnedMessage = (message: ContextMessageLike, index: number): boolean => {
  if (index === 0 && message.role === 'system') {
    return true;
  }

  return message.role === 'system' && PINNED_MESSAGE_PATTERN.test(message.content);
};

const isEvictableMessage = (message: ContextMessageLike): boolean => (
  message.role === 'tool' || EVICTABLE_MESSAGE_PATTERN.test(message.content)
);

export const contextOptimizerService = {
  getThresholds(): ContextOptimizationThresholds {
    return { ...DEFAULT_THRESHOLDS };
  },

  resolveStage(totalTokens: number, maxTokens: number): ContextOptimizationStage {
    if (maxTokens <= 0) {
      return 'NORMAL';
    }

    const ratio = totalTokens / maxTokens;
    if (ratio >= DEFAULT_THRESHOLDS.hardLimitRatio) {
      return 'HARD_LIMIT';
    }
    if (ratio >= DEFAULT_THRESHOLDS.compactionRatio) {
      return 'COMPACTION_REQUIRED';
    }
    if (ratio >= DEFAULT_THRESHOLDS.warningRatio) {
      return 'WARNING';
    }
    return 'NORMAL';
  },

  createCompactionPlan<T extends ContextMessageLike>(messages: T[]): {
    pinnedMessages: T[];
    summarizationMessages: T[];
    activeTailMessages: T[];
  } {
    if (messages.length === 0) {
      return {
        pinnedMessages: [],
        summarizationMessages: [],
        activeTailMessages: [],
      };
    }

    const pinnedIndices = new Set<number>();
    messages.forEach((message, index) => {
      if (isPinnedMessage(message, index)) {
        pinnedIndices.add(index);
      }
    });

    const tailStart = Math.max(1, messages.length - Math.max(4, Math.floor(messages.length * 0.2)));

    const pinnedMessages = dedupeById(
      messages.filter((_message, index) => pinnedIndices.has(index)),
    );

    const summarizationMessages = messages.filter((_message, index) => (
      index >= 1
      && index < tailStart
      && !pinnedIndices.has(index)
    ));

    const activeTailMessages = dedupeById(
      messages
        .slice(tailStart)
        .filter((entry) => !isEvictableMessage(entry)),
    );

    return {
      pinnedMessages,
      summarizationMessages,
      activeTailMessages,
    };
  },

  createDeterministicEmbedding(text: string): number[] {
    const digest = createHash('sha256').update(text, 'utf8').digest();
    return Array.from({ length: 16 }, (_, index) => Number(digest[index] ?? 0) / 255);
  },
};
