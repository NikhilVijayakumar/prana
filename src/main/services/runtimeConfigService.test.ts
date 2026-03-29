import { beforeEach, describe, expect, it } from 'vitest';
import {
  MIN_SYNC_PUSH_INTERVAL_MS,
  MIN_VAULT_KDF_ITERATIONS,
  setPranaRuntimeConfig,
  validatePranaRuntimeConfig,
  type PranaRuntimeConfig,
} from './pranaRuntimeConfig';
import { getRuntimeBootstrapConfig, getRuntimeIntegrationStatus } from './runtimeConfigService';

const createValidRuntimeConfig = (): PranaRuntimeConfig => ({
  director: {
    name: 'Director',
    email: 'director@example.com',
  },
  governance: {
    repoUrl: 'file:///tmp/governance',
    repoPath: '.prana/governance',
  },
  vault: {
    archivePassword: 'top-secret-value',
    archiveSalt: 'dGVzdC1zYWx0',
    kdfIterations: 210000,
  },
  sync: {
    pushIntervalMs: 120000,
    cronEnabled: true,
    pushCronExpression: '*/10 * * * *',
    pullCronExpression: '*/15 * * * *',
  },
});

describe('runtimeConfigService validation hardening', () => {
  beforeEach(() => {
    setPranaRuntimeConfig(createValidRuntimeConfig());
  });

  it('fails validation when required runtime keys are missing or invalid', () => {
    setPranaRuntimeConfig({
      ...createValidRuntimeConfig(),
      director: {
        name: '',
        email: 'director@example.com',
      },
      vault: {
        archivePassword: 'top-secret-value',
        archiveSalt: '',
        kdfIterations: 0,
      },
      sync: {
        pushIntervalMs: -1,
        cronEnabled: true,
        pushCronExpression: '',
        pullCronExpression: '*/15 * * * *',
      },
    });

    const result = validatePranaRuntimeConfig();

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.key)).toEqual(
      expect.arrayContaining([
        'director.name',
        'vault.archiveSalt',
        'vault.kdfIterations',
        'sync.pushIntervalMs',
        'sync.pushCronExpression',
      ]),
    );
    expect(result.errors.join(' ')).not.toContain('top-secret-value');
  });

  it('reports integration summary for required keys without exposing values', () => {
    setPranaRuntimeConfig({
      ...createValidRuntimeConfig(),
      governance: {
        repoUrl: '',
        repoPath: '.prana/governance',
      },
      sync: {
        ...createValidRuntimeConfig().sync,
        cronEnabled: undefined,
      },
    });

    const status = getRuntimeIntegrationStatus();

    expect(status.ready).toBe(false);
    expect(status.summary.total).toBe(11);
    expect(status.summary.missing).toBeGreaterThanOrEqual(2);
    expect(status.keys.find((key) => key.key === 'governance.repoUrl')?.issue).toBe('missing');
    expect(status.keys.find((key) => key.key === 'sync.cronEnabled')?.issue).toBe('missing');
  });

  it('throws fail-fast runtime error when bootstrap config is requested with invalid required keys', () => {
    setPranaRuntimeConfig({
      ...createValidRuntimeConfig(),
      vault: {
        archivePassword: '',
        archiveSalt: '',
        kdfIterations: 0,
      },
    });

    expect(() => getRuntimeBootstrapConfig()).toThrow('[PRANA_CONFIG_ERROR]');
  });

  it('rejects critical numeric values that previously would have been silently clamped', () => {
    setPranaRuntimeConfig({
      ...createValidRuntimeConfig(),
      vault: {
        ...createValidRuntimeConfig().vault,
        kdfIterations: MIN_VAULT_KDF_ITERATIONS - 1,
      },
      sync: {
        ...createValidRuntimeConfig().sync,
        pushIntervalMs: MIN_SYNC_PUSH_INTERVAL_MS - 1,
      },
    });

    const result = validatePranaRuntimeConfig();

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'vault.kdfIterations', code: 'invalid_number' }),
        expect.objectContaining({ key: 'sync.pushIntervalMs', code: 'invalid_number' }),
      ]),
    );
    expect(() => getRuntimeBootstrapConfig()).toThrow('[PRANA_CONFIG_ERROR]');
  });
});
