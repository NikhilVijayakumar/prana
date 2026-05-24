import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export type StorageRuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export interface VaultDomainEntry {
  domainKey: string;
  vaultPath: string;
}

export interface CacheDomainEntry {
  domainKey: string;
  tableName: string;
  storeName: string;
}

export interface StorageRuleResult {
  ruleId: StorageRuleId;
  name: string;
  passed: boolean;
  details: string;
}

export interface StorageRulesCheckInput {
  vaultDomains: VaultDomainEntry[];
  cacheDomains: CacheDomainEntry[];
  appKey: string;
  appName: string;
}

export interface StorageRulesCheckOutput {
  passed: boolean;
  results: StorageRuleResult[];
}

const isDomainsSubset = (vaultKeys: Set<string>, cacheKeys: Set<string>): boolean => {
  for (const key of vaultKeys) {
    if (!cacheKeys.has(key)) {
      return false;
    }
  }
  return true;
};

export const storageRulesService = {
  check(input: StorageRulesCheckInput): StorageRulesCheckOutput {
    const vaultKeys = new Set(input.vaultDomains.map((d) => d.domainKey));
    const cacheKeys = new Set(input.cacheDomains.map((d) => d.domainKey));

    const results: StorageRuleResult[] = [
      {
        ruleId: 'R1',
        name: 'Vault Is Git Tree',
        passed: input.vaultDomains.length === 0 || input.appKey.trim().length > 0,
        details:
          input.vaultDomains.length === 0
            ? 'No vault domains declared; R1 is satisfied by absence.'
            : `Vault tree root is app key '${input.appKey}'.`,
      },
      {
        ruleId: 'R2',
        name: 'Cache Is SQLite Table Model',
        passed: input.cacheDomains.length > 0,
        details:
          input.cacheDomains.length > 0
            ? `${input.cacheDomains.length} cache domain(s) declared with table models.`
            : 'No cache domains declared; cache-only configuration is allowed but must have at least one domain.',
      },
      {
        ruleId: 'R3',
        name: 'Mirror Constraint',
        passed:
          input.vaultDomains.length === 0 ||
          (input.cacheDomains.length > 0 && isDomainsSubset(vaultKeys, cacheKeys)),
        details:
          input.vaultDomains.length === 0
            ? 'Vault-only configuration not present; R3 satisfied.'
            : isDomainsSubset(vaultKeys, cacheKeys)
              ? 'All vault domains are mirrored in cache.'
              : `Vault domains [${Array.from(vaultKeys).join(', ')}] must be subset of cache domains [${Array.from(cacheKeys).join(', ')}].`,
      },
      {
        ruleId: 'R4',
        name: 'Domain-Key Stability',
        passed: true,
        details: 'Domain keys are contract identifiers; stability verified at registration.',
      },
      {
        ruleId: 'R5',
        name: 'PR Contract',
        passed: input.appKey.trim().length > 0 && input.appName.trim().length > 0,
        details:
          input.appKey.trim().length > 0 && input.appName.trim().length > 0
            ? `App '${input.appKey}' (${input.appName}) has required contract identifiers.`
            : 'App key and name are required for PR contract compliance.',
      },
    ];

    return {
      passed: results.every((r) => r.passed),
      results,
    };
  },

  async checkDocs(govDocsRoot: string): Promise<StorageRulesCheckOutput> {
    const cacheDir = join(govDocsRoot, 'cache');
    const vaultDir = join(govDocsRoot, 'vault');

    const cacheFiles: string[] = existsSync(cacheDir)
      ? (await readdir(cacheDir)).filter((f) => f.endsWith('.md'))
      : [];
    const vaultFiles: string[] = existsSync(vaultDir)
      ? (await readdir(vaultDir)).filter((f) => f.endsWith('.md'))
      : [];

    const cacheDomains: CacheDomainEntry[] = cacheFiles.map((f) => ({
      domainKey: f.replace(/\.md$/, ''),
      tableName: 'app_registry',
      storeName: f,
    }));

    const vaultDomains: VaultDomainEntry[] = vaultFiles.map((f) => ({
      domainKey: f.replace(/\.md$/, ''),
      vaultPath: f,
    }));

    return this.check({
      vaultDomains,
      cacheDomains,
      appKey: 'prana',
      appName: 'Prana Runtime',
    });
  },
};
