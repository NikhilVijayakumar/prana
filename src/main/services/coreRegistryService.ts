import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, normalize, relative, resolve, sep } from 'node:path';
import {
  RegistryAgentTemplate,
  RegistryDataInputDefinition,
  RegistryKpiDefinition,
  RegistrySkillDoc,
  RegistrySnapshot,
  RegistryVersionInfo,
} from './registryRuntimeService';

interface RegistryCache {
  fingerprint: string;
  snapshot: RegistrySnapshot;
}

interface RegistryFileSearchPayload {
  keyword?: string;
  section?: string;
  extensions?: string[];
}

interface RegistryFileSearchResult {
  relativePath: string;
  section: string;
  fileName: string;
  extension: string;
}

interface RegistryFileReadResult {
  relativePath: string;
  extension: string;
  content: string;
}

const SUPPORTED_REGISTRY_EXTENSIONS = new Set(['.json', '.yaml', '.yml', '.md']);

const getRegistryRoot = (): string => getRegistryRuntimeConfig().registryRoot;

const normalizeRegistryRelativePath = (relativePath: string): string => relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

const ensureWithinRegistryRoot = (candidatePath: string): string => {
  const root = resolve(getRegistryRoot());
  const absoluteCandidate = resolve(candidatePath);
  const isSamePath = absoluteCandidate === root;
  const isChildPath = absoluteCandidate.startsWith(`${root}${sep}`);
  
  if (!isSamePath && !isChildPath) {
    throw new Error('Invalid registry path access attempt.');
  }
  
  return absoluteCandidate;
};

const getRegistryFileFingerprint = (): string => {
  return getRegistryRuntimeConfig().getRegistryFileFingerprint?.() ?? 'local-default-fingerprint';
};

const loadRegistrySnapshot = (versionCounter: number): { fingerprint: string; snapshot: RegistrySnapshot } => {
  return (
    getRegistryRuntimeConfig().loadRegistrySnapshot?.(versionCounter) ?? {
      fingerprint: `local-${versionCounter}`,
      snapshot: {
        version: `local-${versionCounter}`,
        loadedAt: new Date().toISOString(),
        onboarding: {},
        agents: [],
        kpis: [],
        skills: [],
        kpis: [],
      },
    }
  );
};

const resolveRegistryPath = (relativePath: string): string => {
  const sanitized = normalizeRegistryRelativePath(relativePath);
  if (sanitized.length === 0) {
    throw new Error('Registry path cannot be empty.');
  }
  
  const absolutePath = ensureWithinRegistryRoot(join(getRegistryRoot(), sanitized));
  const extension = extname(absolutePath).toLowerCase();
  
  if (!SUPPORTED_REGISTRY_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported registry file extension: ${extension}`);
  }
  
  return absolutePath;
};

const walkRegistryFiles = (directoryPath: string, files: string[] = []): string[] => {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      walkRegistryFiles(full, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const extension = extname(full).toLowerCase();
    if (SUPPORTED_REGISTRY_EXTENSIONS.has(extension)) {
      files.push(full);
    }
  }
  return files;
};

/**
 * Factory function to create a core registry service.
 * This is transitional - will be fully DB-backed in v2.
 */
export const createCoreRegistry = () => {
  // Instance-level state (not module-level)
  let cache: RegistryCache | null = null;
  let versionCounter = 0;

  const ensureLoaded = (): RegistryCache => {
    if (cache !== null) {
      return cache;
    }
    
    versionCounter += 1;
    const loaded = loadRegistrySnapshot(versionCounter);
    cache = {
      fingerprint: loaded.fingerprint,
      snapshot: loaded.snapshot,
    };
    return cache;
  };

  const hasExternalChanges = (): boolean => {
    const current = ensureLoaded();
    return getRegistryFileFingerprint() !== current.fingerprint;
  };

  const forceReload = (): RegistrySnapshot => {
    versionCounter += 1;
    const loaded = loadRegistrySnapshot(versionCounter);
    cache = {
      fingerprint: loaded.fingerprint,
      snapshot: loaded.snapshot,
    };
    return loaded.snapshot;
  };

  const getLatestSnapshot = (): RegistrySnapshot => {
    const current = ensureLoaded();
    if (!hasExternalChanges()) {
      return current.snapshot;
    }
    return forceReload();
  };

  return {
    getSnapshot(): RegistrySnapshot {
      return getLatestSnapshot();
    },

    reload(): RegistrySnapshot {
      return forceReload();
    },

    getVersion(): RegistryVersionInfo {
      const current = ensureLoaded();
      return {
        version: current.snapshot.version,
        loadedAt: current.snapshot.loadedAt,
        fingerprint: current.fingerprint,
        hasExternalChanges: hasExternalChanges(),
      };
    },

    getRegistryRoot(): string {
      return getRegistryRoot();
    },

    getFileFingerprint(): string {
      return getRegistryFileFingerprint();
    },

    searchFiles(payload?: RegistryFileSearchPayload): RegistryFileSearchResult[] {
      const root = getRegistryRoot();
      const files = walkRegistryFiles(root);
      const allowedPaths = new Set<string>();
      
      const results: RegistryFileSearchResult[] = [];
      for (const file of files) {
        const relativePath = relative(root, file).replace(/\\/g, '/');
        const parts = relativePath.split('/');
        const topLevelSection = parts[0] ?? 'unknown';
        const extension = extname(file).toLowerCase();
        
        // Filter by section
        if (payload?.section && topLevelSection !== payload.section.toLowerCase()) {
          continue;
        }
        
        // Filter by keyword
        if (payload?.keyword) {
          const keyword = payload.keyword.toLowerCase();
          if (!relativePath.toLowerCase().includes(keyword)) {
            continue;
          }
        }
        
        // Filter by extensions
        if (payload?.extensions && payload.extensions.length > 0) {
          if (!payload.extensions.some(ext => extension === ext || extension === `.${ext}`)) {
            continue;
          }
        }
        
        allowedPaths.add(relativePath);
        results.push({
          relativePath,
          section: topLevelSection,
          fileName: basename(file),
          extension,
        });
      }
      return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    },

    readFile(relativePath: string): RegistryFileReadResult {
      const absolutePath = resolveRegistryPath(relativePath);
      const extension = extname(absolutePath).toLowerCase();
      const content = readFileSync(absolutePath, 'utf8').replace(/^\uFEFF/, '');
      return {
        relativePath: normalizeRegistryRelativePath(relative(esolve(getRegistryRoot()), absolutePath)),
        extension,
        content,
      };
    },

    saveFile(relativePath: string, content: string): { success: boolean; updatedAt: string } {
      const absolutePath = resolveRegistryPath(relativePath);
      writeFileSync(absolutePath, content, 'utf8');
      forceReload();
      return {
        success: true,
        updatedAt: new Date().toISOString(),
      };
    },

    listAgents(): RegistryAgentTemplate[] {
      const snapshot = getLatestSnapshot();
      return snapshot.agents;
    },

    listKpis(): RegistryKpiDefinition[] {
      const snapshot = getLatestSnapshot();
      return snapshot.kpis;
    },

    listSkills(): RegistrySkillDoc[] {
      const snapshot = getLatestSnapshot();
      return snapshot.skills;
    },

    listDataInputs(): RegistryDataInputDefinition[] {
      const snapshot = getLatestSnapshot();
      return snapshot.dataInputs;
    },

    __resetForTesting(): void {
      cache = null;
      versionCounter = 0;
    },
  };
};

// Backward compatibility - creates a default instance
export const coreRegistryService = createCoreRegistry();
