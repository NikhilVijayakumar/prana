import { localExecutionProviderService } from './localExecutionProviderService';
import { registryRuntimeStoreService } from './registryRuntimeStoreService';
import { ContextProvider, tokenManagerService } from './tokenManagerService';

export type RuntimeModelProviderId = 'lmstudio' | 'openrouter' | 'gemini';

export interface RuntimeModelProviderRecord {
  enabled: boolean;
  endpoint: string;
  model: string;
  apiKey: string;
  contextWindow?: number;
  reservedOutputTokens?: number;
}

export interface RuntimeModelAccessRecord {
  primaryProvider: RuntimeModelProviderId | null;
  providers: Record<RuntimeModelProviderId, RuntimeModelProviderRecord>;
}

export interface RuntimeContextModelConfig {
  provider: RuntimeModelProviderId;
  model?: string;
  contextWindow: number;
  reservedOutputTokens: number;
}

const PROVIDER_ORDER: RuntimeModelProviderId[] = ['lmstudio', 'openrouter', 'gemini'];

const DEFAULT_PROVIDERS: Record<RuntimeModelProviderId, RuntimeModelProviderRecord> = {
  lmstudio: {
    enabled: false,
    endpoint: 'http://localhost:1234/v1',
    model: 'local-model',
    apiKey: '',
  },
  openrouter: {
    enabled: false,
    endpoint: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    apiKey: '',
  },
  gemini: {
    enabled: false,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-1.5-flash',
    apiKey: '',
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return fallback;
};

const toString = (value: unknown, fallback: string): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
};

const isRuntimeProviderId = (value: unknown): value is RuntimeModelProviderId => (
  value === 'lmstudio' || value === 'openrouter' || value === 'gemini'
);

const toContextProvider = (provider: RuntimeModelProviderId): ContextProvider => {
  if (provider === 'lmstudio') {
    return 'lmstudio';
  }
  if (provider === 'openrouter') {
    return 'openrouter';
  }
  return 'gemini';
};

const mapLocalProviderType = (provider: string): RuntimeModelProviderId | null => {
  if (provider === 'lm-studio') {
    return 'lmstudio';
  }
  if (provider === 'openrouter') {
    return 'openrouter';
  }
  if (provider === 'gemini-cli') {
    return 'gemini';
  }
  return null;
};

const normalizeProvider = (
  provider: RuntimeModelProviderId,
  candidate: unknown,
): RuntimeModelProviderRecord => {
  const fallback = DEFAULT_PROVIDERS[provider];
  if (!isRecord(candidate)) {
    return { ...fallback };
  }

  const endpoint = toString(candidate.endpoint, fallback.endpoint).trim();
  const model = toString(candidate.model, fallback.model).trim();
  const resolvedWindow = tokenManagerService.resolveContextWindow({
    provider: toContextProvider(provider),
    model: model || fallback.model,
    contextWindow: toOptionalNumber(candidate.contextWindow),
    reservedOutputTokens: toOptionalNumber(candidate.reservedOutputTokens),
  });

  return {
    enabled: toBoolean(candidate.enabled, fallback.enabled),
    endpoint: endpoint || fallback.endpoint,
    model: model || fallback.model,
    apiKey: toString(candidate.apiKey, ''),
    contextWindow: resolvedWindow.contextWindow,
    reservedOutputTokens: resolvedWindow.reservedOutputTokens,
  };
};

const resolvePrimaryProvider = (
  candidate: unknown,
  providers: Record<RuntimeModelProviderId, RuntimeModelProviderRecord>,
): RuntimeModelProviderId | null => {
  if (isRuntimeProviderId(candidate) && providers[candidate].enabled) {
    return candidate;
  }

  return PROVIDER_ORDER.find((provider) => providers[provider].enabled) ?? null;
};

const normalizeInputProviders = (candidate: Record<string, unknown>): Record<RuntimeModelProviderId, RuntimeModelProviderRecord> => {
  const nestedProviders = isRecord(candidate.providers) ? candidate.providers : candidate;

  return {
    lmstudio: normalizeProvider('lmstudio', nestedProviders.lmstudio),
    openrouter: normalizeProvider('openrouter', nestedProviders.openrouter),
    gemini: normalizeProvider('gemini', nestedProviders.gemini),
  };
};

const buildRecord = (candidate: unknown): RuntimeModelAccessRecord | null => {
  if (!isRecord(candidate)) {
    return null;
  }

  const providers = normalizeInputProviders(candidate);
  return {
    primaryProvider: resolvePrimaryProvider(
      candidate.primaryProvider ?? candidate.primary_provider,
      providers,
    ),
    providers,
  };
};

const buildRecordFromLocalProviders = (): RuntimeModelAccessRecord | null => {
  const providers = { ...DEFAULT_PROVIDERS };

  for (const provider of localExecutionProviderService.listProvidersSafe()) {
    const runtimeProvider = mapLocalProviderType(provider.type);
    if (!runtimeProvider) {
      continue;
    }

    const resolvedWindow = tokenManagerService.resolveContextWindow({
      provider: toContextProvider(runtimeProvider),
      model: provider.model,
      contextWindow: provider.contextWindow,
      reservedOutputTokens: provider.reservedOutputTokens,
    });

    providers[runtimeProvider] = {
      enabled: provider.enabled,
      endpoint: provider.endpoint?.trim() || DEFAULT_PROVIDERS[runtimeProvider].endpoint,
      model: provider.model?.trim() || DEFAULT_PROVIDERS[runtimeProvider].model,
      apiKey: typeof provider.apiKey === 'string' ? provider.apiKey : '',
      contextWindow: resolvedWindow.contextWindow,
      reservedOutputTokens: resolvedWindow.reservedOutputTokens,
    };
  }

  const primaryProvider = PROVIDER_ORDER.find((provider) => providers[provider].enabled) ?? null;
  return primaryProvider ? { primaryProvider, providers } : null;
};

const toContextModelConfig = (
  provider: RuntimeModelProviderId,
  record: RuntimeModelProviderRecord,
): RuntimeContextModelConfig => ({
  provider,
  model: record.model || undefined,
  contextWindow: record.contextWindow ?? tokenManagerService.resolveContextWindow(toContextProvider(provider), record.model).contextWindow,
  reservedOutputTokens:
    record.reservedOutputTokens
    ?? tokenManagerService.resolveContextWindow(toContextProvider(provider), record.model).reservedOutputTokens,
});

export const runtimeModelAccessService = {
  normalizeRuntimeModelAccess(candidate: unknown): RuntimeModelAccessRecord | null {
    return buildRecord(candidate);
  },

  async getApprovedRuntimeModelAccess(): Promise<RuntimeModelAccessRecord | null> {
    return buildRecord(await registryRuntimeStoreService.getRuntimeModelAccess());
  },

  getLocalRuntimeModelAccess(): RuntimeModelAccessRecord | null {
    return buildRecordFromLocalProviders();
  },

  async resolveContextModelConfig(
    requested?: Partial<{ provider: RuntimeModelProviderId; model?: string; contextWindow?: number; reservedOutputTokens?: number }> | null,
  ): Promise<RuntimeContextModelConfig | null> {
    const approvedRuntime = await this.getApprovedRuntimeModelAccess();
    const localRuntime = this.getLocalRuntimeModelAccess();

    if (requested?.provider) {
      const approvedProvider = approvedRuntime?.providers[requested.provider];
      if (approvedProvider) {
        const resolvedWindow = tokenManagerService.resolveContextWindow({
          provider: toContextProvider(requested.provider),
          model: requested.model?.trim() || approvedProvider.model,
          contextWindow: requested.contextWindow ?? approvedProvider.contextWindow,
          reservedOutputTokens: requested.reservedOutputTokens ?? approvedProvider.reservedOutputTokens,
        });

        return {
          provider: requested.provider,
          model: requested.model?.trim() || approvedProvider.model || undefined,
          contextWindow: resolvedWindow.contextWindow,
          reservedOutputTokens: resolvedWindow.reservedOutputTokens,
        };
      }

      const localProvider = localRuntime?.providers[requested.provider];
      if (localProvider) {
        const resolvedWindow = tokenManagerService.resolveContextWindow({
          provider: toContextProvider(requested.provider),
          model: requested.model?.trim() || localProvider.model,
          contextWindow: requested.contextWindow ?? localProvider.contextWindow,
          reservedOutputTokens: requested.reservedOutputTokens ?? localProvider.reservedOutputTokens,
        });

        return {
          provider: requested.provider,
          model: requested.model?.trim() || localProvider.model || undefined,
          contextWindow: resolvedWindow.contextWindow,
          reservedOutputTokens: resolvedWindow.reservedOutputTokens,
        };
      }

      const resolvedWindow = tokenManagerService.resolveContextWindow({
        provider: toContextProvider(requested.provider),
        model: requested.model?.trim(),
        contextWindow: requested.contextWindow,
        reservedOutputTokens: requested.reservedOutputTokens,
      });

      return {
        provider: requested.provider,
        model: requested.model?.trim() || undefined,
        contextWindow: resolvedWindow.contextWindow,
        reservedOutputTokens: resolvedWindow.reservedOutputTokens,
      };
    }

    if (approvedRuntime?.primaryProvider) {
      return toContextModelConfig(
        approvedRuntime.primaryProvider,
        approvedRuntime.providers[approvedRuntime.primaryProvider],
      );
    }

    if (localRuntime?.primaryProvider) {
      return toContextModelConfig(
        localRuntime.primaryProvider,
        localRuntime.providers[localRuntime.primaryProvider],
      );
    }

    return null;
  },
};
