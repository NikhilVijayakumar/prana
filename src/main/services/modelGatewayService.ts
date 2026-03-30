import { sqliteConfigStoreService } from './sqliteConfigStoreService';

type ProviderId = 'lmstudio' | 'openrouter' | 'gemini';

type ProviderHealth = 'healthy' | 'cooldown' | 'unavailable';

type FailureReason =
  | 'rate_limit'
  | 'overloaded'
  | 'billing'
  | 'auth'
  | 'auth_permanent'
  | 'model_not_found'
  | 'network'
  | 'unknown';

export interface ModelProviderStatus {
  provider: ProviderId;
  model: string;
  healthy: boolean;
  status: ProviderHealth;
  message: string;
  latencyMs: number | null;
  reason: FailureReason | null;
  cooldownUntil: number | null;
  cooldownRemainingMs: number;
  fromCooldownProbe: boolean;
}

export interface ModelGatewayProbeResult {
  activeProvider: ProviderId | null;
  activeModel: string | null;
  fallbackOrder: ProviderId[];
  statuses: ModelProviderStatus[];
  checkedAt: string;
}

interface ProviderSpec {
  provider: ProviderId;
  model: string;
  baseUrl: string;
  apiKey?: string;
}

interface ProviderCooldown {
  until: number;
  reason: FailureReason;
  message: string;
}

const DEFAULT_TIMEOUT_MS = 4_500;
const COOLDOWN_PROBE_WINDOW_MS = 30_000;

const providerCooldowns = new Map<ProviderId, ProviderCooldown>();

const normalizeProviderId = (provider: string): ProviderId => {
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'lmstudio' || normalized === 'lm-studio') {
    return 'lmstudio';
  }
  if (normalized === 'openrouter') {
    return 'openrouter';
  }
  if (normalized === 'google' || normalized === 'gemini' || normalized === 'google-gemini') {
    return 'gemini';
  }
  return 'lmstudio';
};

const normalizeUrl = (url: string): string => {
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const parseFallbackOrder = (): ProviderId[] => {
  const rawOrder = sqliteConfigStoreService.readSnapshotSync()?.config?.modelGateway?.fallbackOrder ?? 'lmstudio,openrouter,gemini';
  const entries = rawOrder
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => normalizeProviderId(value));

  const seen = new Set<ProviderId>();
  const order: ProviderId[] = ['lmstudio'];
  seen.add('lmstudio');

  for (const entry of entries) {
    if (seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    order.push(entry);
  }

  const defaults: ProviderId[] = ['lmstudio', 'openrouter', 'gemini'];
  for (const provider of defaults) {
    if (!seen.has(provider)) {
      order.push(provider);
    }
  }

  return order;
};

const getProviderSpecs = (): ProviderSpec[] => {
  const order = parseFallbackOrder();
  const modelGatewayConfig = sqliteConfigStoreService.readSnapshotSync()?.config?.modelGateway;

  const specs: Record<ProviderId, ProviderSpec> = {
    lmstudio: {
      provider: 'lmstudio',
      baseUrl: normalizeUrl(modelGatewayConfig?.lmStudio?.baseUrl ?? 'http://127.0.0.1:1234'),
      model: modelGatewayConfig?.lmStudio?.model ?? 'local-model',
    },
    openrouter: {
      provider: 'openrouter',
      baseUrl: normalizeUrl(modelGatewayConfig?.openRouter?.baseUrl ?? 'https://openrouter.ai/api/v1'),
      model: modelGatewayConfig?.openRouter?.model ?? 'openai/gpt-4o-mini',
      apiKey: modelGatewayConfig?.openRouter?.apiKey,
    },
    gemini: {
      provider: 'gemini',
      baseUrl: normalizeUrl(modelGatewayConfig?.gemini?.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta'),
      model: modelGatewayConfig?.gemini?.model ?? 'gemini-1.5-flash',
      apiKey: modelGatewayConfig?.gemini?.apiKey,
    },
  };

  return order.map((provider) => specs[provider]);
};

const classifyFailureReason = (statusCode: number | null, message: string): FailureReason => {
  const normalized = message.toLowerCase();

  if (statusCode === 401 || statusCode === 403) {
    return normalized.includes('invalid') || normalized.includes('revoked')
      ? 'auth_permanent'
      : 'auth';
  }
  if (statusCode === 404) {
    return 'model_not_found';
  }
  if (statusCode === 402) {
    return 'billing';
  }
  if (statusCode === 429) {
    return 'rate_limit';
  }
  if (statusCode !== null && statusCode >= 500) {
    return 'overloaded';
  }
  if (normalized.includes('rate limit') || normalized.includes('quota')) {
    return 'rate_limit';
  }
  if (normalized.includes('timeout') || normalized.includes('network')) {
    return 'network';
  }
  return 'unknown';
};

const resolveCooldownDurationMs = (reason: FailureReason): number => {
  if (reason === 'rate_limit' || reason === 'overloaded') {
    return 45_000;
  }
  if (reason === 'auth' || reason === 'auth_permanent' || reason === 'billing') {
    return 5 * 60_000;
  }
  if (reason === 'model_not_found') {
    return 10 * 60_000;
  }
  return 30_000;
};

const getCooldown = (provider: ProviderId): ProviderCooldown | null => {
  const cooldown = providerCooldowns.get(provider);
  if (!cooldown) {
    return null;
  }
  if (Date.now() >= cooldown.until) {
    providerCooldowns.delete(provider);
    return null;
  }
  return cooldown;
};

const putCooldown = (provider: ProviderId, reason: FailureReason, message: string): void => {
  providerCooldowns.set(provider, {
    reason,
    message,
    until: Date.now() + resolveCooldownDurationMs(reason),
  });
};

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
): Promise<{ response: Response | null; latencyMs: number; errorMessage: string | null }> => {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return {
      response,
      latencyMs: Date.now() - startedAt,
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed.';
    return {
      response: null,
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const probeProvider = async (
  spec: ProviderSpec,
): Promise<{
  ok: boolean;
  message: string;
  latencyMs: number | null;
  reason: FailureReason | null;
}> => {
  if (spec.provider !== 'lmstudio' && !spec.apiKey) {
    return {
      ok: false,
      message: 'API key not configured.',
      latencyMs: null,
      reason: 'auth',
    };
  }

  if (spec.provider === 'lmstudio') {
    const result = await fetchWithTimeout(`${spec.baseUrl}/v1/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!result.response) {
      return {
        ok: false,
        message: result.errorMessage ?? 'LM Studio connection failed.',
        latencyMs: result.latencyMs,
        reason: 'network',
      };
    }

    if (!result.response.ok) {
      const reason = classifyFailureReason(result.response.status, result.response.statusText);
      return {
        ok: false,
        message: `HTTP ${result.response.status}: ${result.response.statusText}`,
        latencyMs: result.latencyMs,
        reason,
      };
    }

    return {
      ok: true,
      message: 'LM Studio reachable.',
      latencyMs: result.latencyMs,
      reason: null,
    };
  }

  if (spec.provider === 'openrouter') {
    const result = await fetchWithTimeout(`${spec.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${spec.apiKey}`,
      },
    });

    if (!result.response) {
      return {
        ok: false,
        message: result.errorMessage ?? 'OpenRouter connection failed.',
        latencyMs: result.latencyMs,
        reason: 'network',
      };
    }

    if (!result.response.ok) {
      const body = await result.response.text();
      const reason = classifyFailureReason(result.response.status, body);
      return {
        ok: false,
        message: `HTTP ${result.response.status}: ${body || result.response.statusText}`,
        latencyMs: result.latencyMs,
        reason,
      };
    }

    return {
      ok: true,
      message: 'OpenRouter reachable.',
      latencyMs: result.latencyMs,
      reason: null,
    };
  }

  const result = await fetchWithTimeout(`${spec.baseUrl}/models?key=${encodeURIComponent(spec.apiKey ?? '')}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!result.response) {
    return {
      ok: false,
      message: result.errorMessage ?? 'Gemini connection failed.',
      latencyMs: result.latencyMs,
      reason: 'network',
    };
  }

  if (!result.response.ok) {
    const body = await result.response.text();
    const reason = classifyFailureReason(result.response.status, body);
    return {
      ok: false,
      message: `HTTP ${result.response.status}: ${body || result.response.statusText}`,
      latencyMs: result.latencyMs,
      reason,
    };
  }

  return {
    ok: true,
    message: 'Gemini reachable.',
    latencyMs: result.latencyMs,
    reason: null,
  };
};

const shouldProbeCooldownProvider = (cooldown: ProviderCooldown): boolean => {
  const remaining = cooldown.until - Date.now();
  return remaining <= COOLDOWN_PROBE_WINDOW_MS;
};

export const modelGatewayService = {
  async probeGateway(): Promise<ModelGatewayProbeResult> {
    const specs = getProviderSpecs();
    const statuses: ModelProviderStatus[] = [];

    for (const spec of specs) {
      const cooldown = getCooldown(spec.provider);
      if (cooldown && !shouldProbeCooldownProvider(cooldown)) {
        statuses.push({
          provider: spec.provider,
          model: spec.model,
          healthy: false,
          status: 'cooldown',
          message: cooldown.message,
          latencyMs: null,
          reason: cooldown.reason,
          cooldownUntil: cooldown.until,
          cooldownRemainingMs: Math.max(0, cooldown.until - Date.now()),
          fromCooldownProbe: false,
        });
        continue;
      }

      const probe = await probeProvider(spec);

      if (!probe.ok) {
        const reason = probe.reason ?? 'unknown';
        putCooldown(spec.provider, reason, probe.message);
        const appliedCooldown = getCooldown(spec.provider);

        statuses.push({
          provider: spec.provider,
          model: spec.model,
          healthy: false,
          status: 'unavailable',
          message: probe.message,
          latencyMs: probe.latencyMs,
          reason,
          cooldownUntil: appliedCooldown?.until ?? null,
          cooldownRemainingMs: appliedCooldown ? Math.max(0, appliedCooldown.until - Date.now()) : 0,
          fromCooldownProbe: Boolean(cooldown),
        });
        continue;
      }

      providerCooldowns.delete(spec.provider);
      statuses.push({
        provider: spec.provider,
        model: spec.model,
        healthy: true,
        status: 'healthy',
        message: probe.message,
        latencyMs: probe.latencyMs,
        reason: null,
        cooldownUntil: null,
        cooldownRemainingMs: 0,
        fromCooldownProbe: Boolean(cooldown),
      });
    }

    const active = statuses.find((entry) => entry.healthy) ?? null;

    return {
      activeProvider: active?.provider ?? null,
      activeModel: active?.model ?? null,
      fallbackOrder: specs.map((entry) => entry.provider),
      statuses,
      checkedAt: new Date().toISOString(),
    };
  },
};
