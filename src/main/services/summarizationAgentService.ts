import { localExecutionProviderService, ModelProviderType } from './localExecutionProviderService';

export interface SummarizationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface SummarizationInput {
  sessionId: string;
  initialInstruction: string;
  currentGoal: string;
  coreMetadata: string;
  previousDigest: string | null;
  middleMessages: SummarizationMessage[];
}

const buildPrompt = (input: SummarizationInput): { systemPrompt: string; userPrompt: string } => {
  const systemPrompt = [
    'You are SummarizationAgent, optimized for fast context compaction.',
    'Return concise, loss-aware markdown summary for agent continuity.',
    'Do not invent facts. Keep unresolved tasks explicit.',
    'Output sections exactly:',
    '1) Decisions',
    '2) Extracted Data',
    '3) Unresolved Tasks',
    '4) Risks',
    '5) Next-Step Intent',
  ].join('\n');

  const middle = input.middleMessages
    .map((message, index) => `${index + 1}. [${message.role}] ${message.content}`)
    .join('\n');

  const userPrompt = [
    `Session: ${input.sessionId}`,
    `Initial Instruction: ${input.initialInstruction || 'N/A'}`,
    `Current Goal: ${input.currentGoal || 'N/A'}`,
    `Core Metadata: ${input.coreMetadata || 'N/A'}`,
    `Previous Digest: ${input.previousDigest || 'none'}`,
    'Conversation Segment to summarize:',
    middle || 'No middle messages to summarize.',
  ].join('\n\n');

  return { systemPrompt, userPrompt };
};

const deterministicFallback = (input: SummarizationInput): string => {
  const decisions: string[] = [];
  const extractedData: string[] = [];
  const unresolvedTasks: string[] = [];
  const risks: string[] = [];

  for (const message of input.middleMessages) {
    const normalized = message.content.trim();
    if (!normalized) {
      continue;
    }

    if (/(decid|approved|final|resolved)/i.test(normalized)) {
      decisions.push(normalized.slice(0, 200));
    }

    if (/(json|schema|config|endpoint|model|token|limit|threshold)/i.test(normalized)) {
      extractedData.push(normalized.slice(0, 200));
    }

    if (/(todo|pending|follow up|next|need to|should)/i.test(normalized) || /\?$/.test(normalized)) {
      unresolvedTasks.push(normalized.slice(0, 200));
    }

    if (/(risk|blocker|error|fail|crash|regression)/i.test(normalized)) {
      risks.push(normalized.slice(0, 200));
    }
  }

  const nextIntent = input.currentGoal || 'Continue current objective while preserving governance constraints.';

  const pick = (entries: string[]): string[] => {
    const deduped = Array.from(new Set(entries));
    return deduped.slice(0, 6);
  };

  return [
    '### Decisions',
    ...(pick(decisions).length > 0 ? pick(decisions).map((entry) => `- ${entry}`) : ['- No explicit decisions captured.']),
    '### Extracted Data',
    ...(pick(extractedData).length > 0 ? pick(extractedData).map((entry) => `- ${entry}`) : ['- No critical data extracted.']),
    '### Unresolved Tasks',
    ...(pick(unresolvedTasks).length > 0 ? pick(unresolvedTasks).map((entry) => `- ${entry}`) : ['- No unresolved tasks detected.']),
    '### Risks',
    ...(pick(risks).length > 0 ? pick(risks).map((entry) => `- ${entry}`) : ['- No explicit risks detected.']),
    '### Next-Step Intent',
    `- ${nextIntent}`,
  ].join('\n');
};

const resolveSummarizerProvider = (): ModelProviderType | null => {
  const providers = localExecutionProviderService.listProvidersSafe();
  const preferred: ModelProviderType[] = ['lm-studio', 'openrouter', 'gemini-cli'];

  for (const provider of preferred) {
    const matched = providers.find((entry) => entry.type === provider && entry.enabled);
    if (matched) {
      return provider;
    }
  }

  return null;
};

export const summarizationAgentService = {
  async summarize(input: SummarizationInput): Promise<string> {
    const provider = resolveSummarizerProvider();

    if (!provider) {
      return deterministicFallback(input);
    }

    const prompt = buildPrompt(input);
    const response = await localExecutionProviderService.executeWithProvider({
      provider,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      maxTokens: 700,
      temperature: 0.2,
    });

    const output = response.output.trim();
    if (!response.success || !output) {
      return deterministicFallback(input);
    }

    return output;
  },
};
