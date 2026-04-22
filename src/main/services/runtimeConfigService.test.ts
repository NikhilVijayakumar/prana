import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MIN_SYNC_PUSH_INTERVAL_MS,
  MIN_VAULT_KDF_ITERATIONS,
  validatePranaRuntimeConfig,
  setPranaRuntimeConfig,
  type PranaRuntimeConfig,
} from './pranaRuntimeConfig';
import { sqliteConfigStoreService } from './sqliteConfigStoreService';
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
  beforeEach(async () => {
    // Must set in-memory runtime config before any DB operation —
    // sqliteCryptoUtil.getDbKey() depends on it for encryption key derivation.
    setPranaRuntimeConfig(createValidRuntimeConfig());
    await sqliteConfigStoreService.__resetForTesting();
    await sqliteConfigStoreService.seedFromRuntimePropsIfEmpty(createValidRuntimeConfig());
  });

  afterEach(() => {
    setPranaRuntimeConfig(null);
  });

  it('fails validation when required runtime keys are missing or invalid', async () => {
    const overrideConfig: any = {
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
    };

    await sqliteConfigStoreService.__resetForTesting();
    // Keep valid runtime config for DB encryption; seed and validate with invalid config
    await sqliteConfigStoreService.seedFromRuntimePropsIfEmpty(overrideConfig);
    const result = validatePranaRuntimeConfig(overrideConfig);

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

  it('reports integration summary for required keys without exposing values', async () => {
    const overrideConfig: any = {
      ...createValidRuntimeConfig(),
      governance: {
        repoUrl: '',
        repoPath: '.prana/governance',
      },
      sync: {
        ...createValidRuntimeConfig().sync,
        cronEnabled: undefined,
      },
    };

    await sqliteConfigStoreService.__resetForTesting();
    // Keep valid runtime config for DB encryption; seed with override for validation
    await sqliteConfigStoreService.seedFromRuntimePropsIfEmpty(overrideConfig);
    const status = getRuntimeIntegrationStatus();

    expect(status.ready).toBe(false);
    expect(status.summary.total).toBe(11);
    expect(status.summary.missing).toBeGreaterThanOrEqual(2);
    expect(status.keys.find((key) => key.key === 'governance.repoUrl')?.issue).toBe('invalid_string');
    expect(status.keys.find((key) => key.key === 'sync.cronEnabled')?.issue).toBe('missing');
  });

  it('throws fail-fast runtime error when bootstrap config is requested with invalid required keys', async () => {
    const overrideConfig: any = {
      ...createValidRuntimeConfig(),
      vault: {
        archivePassword: '',
        archiveSalt: '',
        kdfIterations: 0,
      },
    };

    await sqliteConfigStoreService.__resetForTesting();
    setPranaRuntimeConfig(createValidRuntimeConfig());
    await sqliteConfigStoreService.seedFromRuntimePropsIfEmpty(overrideConfig);

    expect(() => getRuntimeBootstrapConfig()).toThrow('[PRANA_CONFIG_ERROR]');
  });

  it('rejects critical numeric values that previously would have been silently clamped', async () => {
    const overrideConfig: any = {
      ...createValidRuntimeConfig(),
      vault: {
        ...createValidRuntimeConfig().vault,
        kdfIterations: MIN_VAULT_KDF_ITERATIONS - 1,
      },
      sync: {
        ...createValidRuntimeConfig().sync,
        pushIntervalMs: MIN_SYNC_PUSH_INTERVAL_MS - 1,
      },
    };

    await sqliteConfigStoreService.__resetForTesting();
    // Keep valid runtime config for DB encryption; seed with overrides for validation
    await sqliteConfigStoreService.seedFromRuntimePropsIfEmpty(overrideConfig);
    const result = validatePranaRuntimeConfig(overrideConfig);

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
