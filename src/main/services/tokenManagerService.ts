import { getEncoding, Tiktoken } from 'js-tiktoken';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRegistryRuntimeConfig } from './registryRuntimeService';

export type ContextProvider = 'lmstudio' | 'openrouter' | 'gemini' | 'custom';

export interface ResolvedContextWindow {
  contextWindow: number;
  reservedOutputTokens: number;
  compactThresholdTokens: number;
  highWaterMarkRatio: number;
}

export interface ModelProviderConfigInput {
  provider: ContextProvider;
  model?: string;
  contextWindow?: number;          // User-supplied, takes priority
  reservedOutputTokens?: number;   // User-supplied, takes priority
}

interface RegistryContextWindowEntry {
  contextWindow?: number;
  reservedOutputTokens?: number;
  highWaterMarkRatio?: number;
}

interface RegistryModelContextWindows {
  default_context_window?: number;
  providers?: Record<string, RegistryContextWindowEntry>;
  model_overrides?: Record<string, Record<string, RegistryContextWindowEntry>>;
}

interface RegistryRootShape {
  model_config?: {
    model_context_windows?: RegistryModelContextWindows;
  };
}

const getRegistryFilePath = (): string => {
  return join(
    getRegistryRuntimeConfig().registryRoot,
    'data-inputs',
    'model-gateway-config-registry.json',
  );
};

const DEFAULT_CONTEXT_WINDOW = 32_000;
const DEFAULT_RESERVED_OUTPUT = 2_048;
const DEFAULT_HIGH_WATER_RATIO = 0.8;

/**
 * Factory function to create a token manager.
 * Eliminates module-level state for encoder cache.
 */
export const createTokenManager = () => {
  // Instance-level state (not module-level)
  let encoder: Tiktoken | null = null;

  const clampNumber = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
  };

  const safeNumber = (value: unknown, fallback: number): number => {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  };

  const getEncoder = (): Tiktoken | null => {
    if (encoder) {
      return encoder;
    }

    try {
      encoder = getEncoding('o200k_base');
      return encoder;
    } catch {
      return null;
    }
  };

  const estimateTokenFallback = (text: string): number => {
    // Keep deterministic behavior if tokenizer is unavailable.
    return Math.max(1, Math.ceil(text.length / 4));
  };

  const readModelContextWindows = (): RegistryModelContextWindows | null => {
    try {
      const raw = readFileSync(getRegistryFilePath(), 'utf8');
      const parsed = JSON.parse(raw) as RegistryRootShape;
      return parsed.model_config?.model_context_windows ?? null;
    } catch {
      return null;
    }
  };

  const resolveProviderDefaults = (
    provider: ContextProvider,
    windows: RegistryModelContextWindows | null,
  ): RegistryContextWindowEntry => {
    if (!windows?.providers) {
      return {};
    }

    return windows.providers[provider] ?? {};
  };

  const resolveModelOverride = (
    provider: ContextProvider,
    model: string | undefined,
    windows: RegistryModelContextWindows | null,
  ): RegistryContextWindowEntry => {
    if (!model || !windows?.model_overrides) {
      return {};
    }

    const providerOverrides = windows.model_overrides[provider];
    if (!providerOverrides) {
      return {};
    }

    return providerOverrides[model] ?? {};
  };

  return {
    countTextTokens(text: string): number {
      const normalized = text.trim();
      if (!normalized) {
        return 0;
      }

      const activeEncoder = getEncoder();
      if (!activeEncoder) {
        return estimateTokenFallback(normalized);
      }

      try {
        return activeEncoder.encode(normalized).length;
      } catch {
        return estimateTokenFallback(normalized);
      }
    },

    countMessages(messages: Array<{ role: string; content: string }>): number {
      if (!Array.isArray(messages) || messages.length === 0) {
        return 0;
      }

      return messages.reduce((sum, message) => {
        const roleOverhead = this.countTextTokens(message.role) + 2;
        return sum + roleOverhead + this.countTextTokens(message.content);
      }, 0);
    },

    resolveContextWindow(providerOrConfig: ContextProvider | ModelProviderConfigInput, model?: string): ResolvedContextWindow {
      // Handle both: legacy (provider, model) and new (ModelProviderConfigInput) signatures
      let provider: ContextProvider;
      let userContextWindow: number | undefined;
      let userReservedOutput: number | undefined;

      if (typeof providerOrConfig === 'string') {
        provider = providerOrConfig;
        model = model;
      } else {
        provider = providerOrConfig.provider;
        model = providerOrConfig.model ?? model;
        userContextWindow = providerOrConfig.contextWindow;
        userReservedOutput = providerOrConfig.reservedOutputTokens;
      }

      const windows = readModelContextWindows();
      const providerDefaults = resolveProviderDefaults(provider, windows);
      const modelOverride = resolveModelOverride(provider, model, windows);

      // Priority:
      // 1. User-supplied values (from model config)
      // 2. Registry model override
      // 3. Registry provider default
      // 4. Hardcoded default

      const contextWindow = clampNumber(
        safeNumber(
          userContextWindow ?? modelOverride.contextWindow ?? providerDefaults.contextWindow,
          safeNumber(windows?.default_context_window, DEFAULT_CONTEXT_WINDOW),
        ),
        1_024,
        4_000_000,
      );

      const reservedOutputTokens = clampNumber(
        safeNumber(
          userReservedOutput ?? modelOverride.reservedOutputTokens ?? providerDefaults.reservedOutputTokens,
          DEFAULT_RESERVED_OUTPUT,
        ),
        256,
        contextWindow - 1,
      );

      const highWaterMarkRatio = clampNumber(
        safeNumber(
          modelOverride.highWaterMarkRatio ?? providerDefaults.highWaterMarkRatio,
          DEFAULT_HIGH_WATER_RATIO,
        ),
        0.3,
        0.95,
      );

      const compactThresholdTokens = Math.max(
        1_024,
        Math.floor(contextWindow * highWaterMarkRatio),
      );

      return {
        contextWindow,
        reservedOutputTokens,
        compactThresholdTokens,
        highWaterMarkRatio,
      };
    },

    __resetForTesting(): void {
      encoder = null;
    },
  };
};

// Backward compatibility - creates a default instance
export const tokenManagerService = createTokenManager();
