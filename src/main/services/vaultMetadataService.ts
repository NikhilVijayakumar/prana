import { basename, join } from 'node:path';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getRuntimeBootstrapConfig } from './runtimeConfigService';

export interface VaultAppMetadata {
  appKey: string;
  appName: string;
  rootPath: string;
  structureHash: string;
  generatedAt: string;
  domainKeys: string[];
}

const RESERVED_DOMAIN_KEYS = new Set(['.dcm', 'apps', 'global.metadata.json']);

const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'app';
};

const checksumFor = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return `sha256-lite:${hash.toString(16)}`;
};

const nowIso = (): string => new Date().toISOString();

const deriveAppIdentity = (): { appKey: string; appName: string } => {
  const config = getRuntimeBootstrapConfig();
  const appName = config.branding.appBrandName?.trim()
    || basename(config.governance.repoPath || 'app')
    || 'App';
  const appKey = slugify(config.vault.appKey || appName);
  return {
    appKey,
    appName,
  };
};

const listDomainKeys = async (workingRootPath: string): Promise<string[]> => {
  if (!existsSync(workingRootPath)) {
    return [];
  }

  const entries = await readdir(workingRootPath, { withFileTypes: true });
  const domainKeys = entries
    .filter((entry) => !RESERVED_DOMAIN_KEYS.has(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return domainKeys;
};

const getMetadataPath = (workingRootPath: string, appKey: string): string => {
  return join(workingRootPath, 'apps', appKey, '.metadata.json');
};

export const vaultMetadataService = {
  getMetadataPath,

  async buildCurrentMetadata(workingRootPath: string): Promise<VaultAppMetadata> {
    const identity = deriveAppIdentity();
    const domainKeys = await listDomainKeys(workingRootPath);
    const rootPath = `apps/${identity.appKey}`;
    const structureHash = checksumFor(JSON.stringify({ rootPath, domainKeys }));

    return {
      appKey: identity.appKey,
      appName: identity.appName,
      rootPath,
      structureHash,
      generatedAt: nowIso(),
      domainKeys,
    };
  },

  async ensureMetadata(workingRootPath: string): Promise<VaultAppMetadata> {
    const metadata = await this.buildCurrentMetadata(workingRootPath);
    const metadataPath = getMetadataPath(workingRootPath, metadata.appKey);
    await mkdir(join(workingRootPath, 'apps', metadata.appKey), { recursive: true });
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    return metadata;
  },

  async readMetadata(workingRootPath: string, appKey?: string): Promise<VaultAppMetadata | null> {
    const identity = deriveAppIdentity();
    const metadataPath = getMetadataPath(workingRootPath, appKey ?? identity.appKey);
    if (!existsSync(metadataPath)) {
      return null;
    }

    try {
      const raw = await readFile(metadataPath, 'utf8');
      const parsed = JSON.parse(raw) as VaultAppMetadata;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },

  async exists(workingRootPath: string, appKey?: string): Promise<boolean> {
    const metadata = await this.readMetadata(workingRootPath, appKey);
    if (!metadata) {
      return false;
    }

    const metadataPath = getMetadataPath(workingRootPath, metadata.appKey);
    const metadataStats = await stat(metadataPath);
    return metadataStats.isFile();
  },
};
