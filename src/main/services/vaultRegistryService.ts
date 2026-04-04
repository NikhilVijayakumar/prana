import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VaultAppMetadata } from './vaultMetadataService';

export interface VaultRegistryEntry {
  appKey: string;
  appName: string;
  rootPath: string;
  structureHash: string;
  mode: 'cache+vault';
  status: 'active';
  updatedAt: string;
}

export interface VaultGlobalRegistry {
  version: string;
  lastUpdated: string;
  applications: VaultRegistryEntry[];
}

const REGISTRY_FILE = 'global.metadata.json';
const REGISTRY_VERSION = '1.0.0';

const nowIso = (): string => new Date().toISOString();

const getRegistryPath = (workingRootPath: string): string => {
  return join(workingRootPath, REGISTRY_FILE);
};

const emptyRegistry = (): VaultGlobalRegistry => ({
  version: REGISTRY_VERSION,
  lastUpdated: nowIso(),
  applications: [],
});

export const vaultRegistryService = {
  getRegistryPath,

  async readRegistry(workingRootPath: string): Promise<VaultGlobalRegistry> {
    const registryPath = getRegistryPath(workingRootPath);
    if (!existsSync(registryPath)) {
      return emptyRegistry();
    }

    try {
      const raw = await readFile(registryPath, 'utf8');
      const parsed = JSON.parse(raw) as VaultGlobalRegistry;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.applications)) {
        return emptyRegistry();
      }
      return parsed;
    } catch {
      return emptyRegistry();
    }
  },

  async ensureRegistered(workingRootPath: string, metadata: VaultAppMetadata): Promise<VaultGlobalRegistry> {
    await mkdir(workingRootPath, { recursive: true });
    const registry = await this.readRegistry(workingRootPath);
    const nextEntry: VaultRegistryEntry = {
      appKey: metadata.appKey,
      appName: metadata.appName,
      rootPath: metadata.rootPath,
      structureHash: metadata.structureHash,
      mode: 'cache+vault',
      status: 'active',
      updatedAt: nowIso(),
    };

    const filtered = registry.applications.filter((entry) => entry.appKey !== metadata.appKey);
    filtered.push(nextEntry);
    filtered.sort((a, b) => a.appKey.localeCompare(b.appKey));

    const nextRegistry: VaultGlobalRegistry = {
      version: registry.version || REGISTRY_VERSION,
      lastUpdated: nowIso(),
      applications: filtered,
    };

    await writeFile(getRegistryPath(workingRootPath), JSON.stringify(nextRegistry, null, 2), 'utf8');
    return nextRegistry;
  },

  async validateRegistration(workingRootPath: string, appKey: string, structureHash?: string): Promise<{
    registered: boolean;
    structureMatches: boolean;
  }> {
    const registry = await this.readRegistry(workingRootPath);
    const entry = registry.applications.find((candidate) => candidate.appKey === appKey);
    if (!entry) {
      return {
        registered: false,
        structureMatches: false,
      };
    }

    return {
      registered: true,
      structureMatches: structureHash ? entry.structureHash === structureHash : true,
    };
  },
};
