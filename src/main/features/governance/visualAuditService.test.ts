import { describe, expect, it } from 'vitest';
import { buildDesignAuditPayload } from './visualAuditService';

describe('visualAuditService', () => {
  it('creates a healthy payload for secure signals', () => {
    const payload = buildDesignAuditPayload({
      complianceOverallStatus: 'secure',
      complianceViolationsCount: 0,
      queuePendingCount: 0,
      blockedSkillsCount: 0,
      degradedProviderCount: 0,
    });

    expect(payload.metrics).toHaveLength(4);
    expect(payload.overallHealth).toBeGreaterThanOrEqual(80);
    expect(payload.tokensSynced).toBe(true);
  });

  it('degrades health and token sync for warning/critical signals', () => {
    const payload = buildDesignAuditPayload({
      complianceOverallStatus: 'critical',
      complianceViolationsCount: 4,
      queuePendingCount: 5,
      blockedSkillsCount: 2,
      degradedProviderCount: 2,
    });

    expect(payload.overallHealth).toBeLessThan(90);
    expect(payload.tokensSynced).toBe(false);
    expect(payload.metrics.some((metric) => metric.status !== 'pass')).toBe(true);
  });

  it('includes storage governance audit section when storage rules input is provided', () => {
    const payload = buildDesignAuditPayload({
      complianceOverallStatus: 'secure',
      complianceViolationsCount: 0,
      queuePendingCount: 0,
      blockedSkillsCount: 0,
      degradedProviderCount: 0,
      storageRulesInput: {
        vaultDomains: [
          { domainKey: 'global_metadata', vaultPath: 'global_metadata/' },
        ],
        cacheDomains: [
          { domainKey: 'global_metadata', tableName: 'app_registry', storeName: 'hybrid-sync.sqlite' },
          { domainKey: 'runtime_config', tableName: 'runtime_config_meta', storeName: 'config.sqlite' },
        ],
        appKey: 'prana',
        appName: 'Prana Runtime',
      },
    });

    expect(payload.storageGovernance).toBeDefined();
    expect(payload.storageGovernance?.totalRules).toBe(5);
    expect(payload.storageGovernance?.passedRules).toBeGreaterThan(0);
    expect(payload.storageGovernance?.summary).toBe('pass');
  });

  it('reports storage governance failure when rules are violated', () => {
    const payload = buildDesignAuditPayload({
      complianceOverallStatus: 'secure',
      complianceViolationsCount: 0,
      queuePendingCount: 0,
      blockedSkillsCount: 0,
      degradedProviderCount: 0,
      storageRulesInput: {
        vaultDomains: [
          { domainKey: 'orphan_vault_domain', vaultPath: 'orphan/' },
        ],
        cacheDomains: [
          { domainKey: 'global_metadata', tableName: 'app_registry', storeName: 'hybrid-sync.sqlite' },
        ],
        appKey: '',
        appName: '',
      },
    });

    expect(payload.storageGovernance).toBeDefined();
    expect(payload.storageGovernance?.failedRules).toBeGreaterThan(0);
    expect(payload.storageGovernance?.summary).toBe('fail');
  });

  it('omits storage governance section when input is not provided', () => {
    const payload = buildDesignAuditPayload({
      complianceOverallStatus: 'secure',
      complianceViolationsCount: 0,
      queuePendingCount: 0,
      blockedSkillsCount: 0,
      degradedProviderCount: 0,
    });

    expect(payload.storageGovernance).toBeUndefined();
  });
});
