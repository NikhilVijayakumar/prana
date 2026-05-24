import { describe, expect, it } from 'vitest';
import { storageRulesService } from './storageRulesService';

describe('storageRulesService', () => {
  describe('check', () => {
    it('passes all rules for valid cache-only input', () => {
      const result = storageRulesService.check({
        vaultDomains: [],
        cacheDomains: [
          { domainKey: 'global_metadata', tableName: 'app_registry', storeName: 'hybrid-sync.sqlite' },
        ],
        appKey: 'test-app',
        appName: 'Test App',
      });

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(5);
    });

    it('passes all rules for valid cache+vault input with mirroring', () => {
      const result = storageRulesService.check({
        vaultDomains: [
          { domainKey: 'global_metadata', vaultPath: 'global_metadata/' },
          { domainKey: 'cron_scheduler_state', vaultPath: 'cron/' },
        ],
        cacheDomains: [
          { domainKey: 'global_metadata', tableName: 'app_registry', storeName: 'hybrid-sync.sqlite' },
          { domainKey: 'cron_scheduler_state', tableName: 'cron_jobs', storeName: 'queue.sqlite' },
          { domainKey: 'runtime_config', tableName: 'runtime_config_meta', storeName: 'config.sqlite' },
        ],
        appKey: 'test-app',
        appName: 'Test App',
      });

      expect(result.passed).toBe(true);
      expect(result.results.every((r) => r.passed)).toBe(true);
    });

    it('fails R3 mirror constraint when vault domain is not in cache', () => {
      const result = storageRulesService.check({
        vaultDomains: [
          { domainKey: 'vault_only_domain', vaultPath: 'vault/' },
        ],
        cacheDomains: [
          { domainKey: 'global_metadata', tableName: 'app_registry', storeName: 'hybrid-sync.sqlite' },
        ],
        appKey: 'test-app',
        appName: 'Test App',
      });

      expect(result.passed).toBe(false);
      const r3 = result.results.find((r) => r.ruleId === 'R3');
      expect(r3?.passed).toBe(false);
    });

    it('fails R5 when app key is empty', () => {
      const result = storageRulesService.check({
        vaultDomains: [],
        cacheDomains: [
          { domainKey: 'global_metadata', tableName: 'app_registry', storeName: 'hybrid-sync.sqlite' },
        ],
        appKey: '',
        appName: '',
      });

      expect(result.passed).toBe(false);
      const r5 = result.results.find((r) => r.ruleId === 'R5');
      expect(r5?.passed).toBe(false);
    });

    it('fails R2 when no cache domains declared', () => {
      const result = storageRulesService.check({
        vaultDomains: [],
        cacheDomains: [],
        appKey: 'test-app',
        appName: 'Test App',
      });

      expect(result.passed).toBe(false);
      const r2 = result.results.find((r) => r.ruleId === 'R2');
      expect(r2?.passed).toBe(false);
    });

    it('R1 passes when vault domains exist and app key is present', () => {
      const result = storageRulesService.check({
        vaultDomains: [
          { domainKey: 'global_metadata', vaultPath: 'global_metadata/' },
        ],
        cacheDomains: [
          { domainKey: 'global_metadata', tableName: 'app_registry', storeName: 'hybrid-sync.sqlite' },
        ],
        appKey: 'prana',
        appName: 'Prana Runtime',
      });

      const r1 = result.results.find((r) => r.ruleId === 'R1');
      expect(r1?.passed).toBe(true);
    });

    it('R4 always passes as domain-key stability is contract-validated', () => {
      const result = storageRulesService.check({
        vaultDomains: [],
        cacheDomains: [],
        appKey: '',
        appName: '',
      });

      const r4 = result.results.find((r) => r.ruleId === 'R4');
      expect(r4?.passed).toBe(true);
    });
  });
});
