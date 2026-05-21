import { describe, expect, it } from 'vitest';
import { runtimeModelAccessService } from './runtimeModelAccessService';

describe('runtimeModelAccessService', () => {
  it('normalizes top-level onboarding model access into explicit context metadata', () => {
    const normalized = runtimeModelAccessService.normalizeRuntimeModelAccess({
      openrouter: {
        enabled: true,
        endpoint: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-4o-mini',
        apiKey: 'secret',
      },
    });

    expect(normalized?.primaryProvider).toBe('openrouter');
    expect(normalized?.providers.openrouter.contextWindow).toBeGreaterThan(0);
    expect(normalized?.providers.openrouter.reservedOutputTokens).toBeGreaterThan(0);
  });

  it('preserves explicit user overrides for context window budgeting', () => {
    const normalized = runtimeModelAccessService.normalizeRuntimeModelAccess({
      primary_provider: 'lmstudio',
      providers: {
        lmstudio: {
          enabled: true,
          endpoint: 'http://localhost:1234/v1',
          model: 'custom-local-model',
          contextWindow: 16000,
          reservedOutputTokens: 1200,
        },
      },
    });

    expect(normalized?.primaryProvider).toBe('lmstudio');
    expect(normalized?.providers.lmstudio.contextWindow).toBe(16000);
    expect(normalized?.providers.lmstudio.reservedOutputTokens).toBe(1200);
  });
});
