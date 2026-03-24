import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, normalize, relative, resolve, sep } from 'node:path';
import {
  RegistryAgentTemplate,
  RegistryDataInputDefinition,
  RegistryKpiDefinition,
  RegistryKpiMinimumRequirementEntry,
  getRegistryRuntimeConfig,
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

let cache: RegistryCache | null = null;
let versionCounter = 0;

const normalizeRegistryRelativePath = (relativePath: string): string => relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

const ensureWithinRegistryRoot = (candidatePath: string): string => {
  const root = resolve(getRegistryRuntimeConfig().registryRoot);
  const absoluteCandidate = resolve(candidatePath);
  const isSamePath = absoluteCandidate === root;
  const isChildPath = absoluteCandidate.startsWith(`${root}${sep}`);

  if (!isSamePath && !isChildPath) {
    throw new Error('Invalid registry path access attempt.');
  }

  return absoluteCandidate;
};

const getRegistryRoot = (): string => getRegistryRuntimeConfig().registryRoot;

const getRegistryFileFingerprint = (): string => {
  return getRegistryRuntimeConfig().getRegistryFileFingerprint?.() ?? 'local-default-fingerprint';
};

const loadRegistrySnapshot = (versionCounter: number): { fingerprint: string; snapshot: RegistrySnapshot } => {
  return (
    getRegistryRuntimeConfig().loadRegistrySnapshot?.(versionCounter) ?? {
      fingerprint: `local-default-${versionCounter}`,
      snapshot: {
        version: `local-${versionCounter}`,
        loadedAt: new Date().toISOString(),
        onboarding: {},
        agents: [],
        kpiRequirements: [],
        skills: [],
        kpis: [],
        dataInputs: [],
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
    const absolutePath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      walkRegistryFiles(absolutePath, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const extension = extname(absolutePath).toLowerCase();
    if (SUPPORTED_REGISTRY_EXTENSIONS.has(extension)) {
      files.push(absolutePath);
    }
  }

  return files;
};

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

export const coreRegistryService = {
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

  getAgentTemplate(agentId: string): RegistryAgentTemplate | null {
    const snapshot = getLatestSnapshot();
    return snapshot.agents.find((entry) => entry.uid === agentId) ?? null;
  },

  getMinimumRequirements(stepId: string): RegistryKpiMinimumRequirementEntry[] {
    const snapshot = getLatestSnapshot();
    const requirements: RegistryKpiMinimumRequirementEntry[] = [];

    for (const schema of snapshot.kpiRequirements) {
      const match = schema.minimumRequirements.find((entry) => entry.stepId === stepId);
      if (match) {
        requirements.push(match);
      }
    }

    return requirements;
  },

  listSkills(): RegistrySkillDoc[] {
    const snapshot = getLatestSnapshot();
    return snapshot.skills;
  },

  listKpis(): RegistryKpiDefinition[] {
    const snapshot = getLatestSnapshot();
    return snapshot.kpis;
  },

  listDataInputs(): RegistryDataInputDefinition[] {
    const snapshot = getLatestSnapshot();
    return snapshot.dataInputs;
  },

  searchFiles(payload?: RegistryFileSearchPayload): RegistryFileSearchResult[] {
    const keyword = payload?.keyword?.trim().toLowerCase() ?? '';
    const section = payload?.section?.trim().toLowerCase() ?? '';
    const extensions = (payload?.extensions ?? []).map((entry) => entry.toLowerCase()).filter((entry) => entry.length > 0);
    const extensionSet = extensions.length > 0
      ? new Set(extensions.map((entry) => (entry.startsWith('.') ? entry : `.${entry}`)))
      : null;

    const root = getRegistryRoot();
    return walkRegistryFiles(root)
      .map((absolutePath) => {
        const relativePath = normalizeRegistryRelativePath(relative(root, absolutePath));
        const parts = relativePath.split('/');
        const topLevelSection = parts[0] ?? 'unknown';
        const extension = extname(absolutePath).toLowerCase();
        return {
          relativePath,
          section: topLevelSection,
          fileName: basename(absolutePath),
          extension,
        };
      })
      .filter((entry) => {
        if (section.length > 0 && !entry.relativePath.toLowerCase().startsWith(`${section}/`) && entry.section.toLowerCase() !== section) {
          return false;
        }
        if (keyword.length > 0 && !entry.relativePath.toLowerCase().includes(keyword)) {
          return false;
        }
        if (extensionSet && !extensionSet.has(entry.extension)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  },

  readFile(relativePath: string): RegistryFileReadResult {
    const absolutePath = resolveRegistryPath(relativePath);
    return {
      relativePath: normalizeRegistryRelativePath(relativePath),
      extension: extname(absolutePath).toLowerCase(),
      content: readFileSync(absolutePath, 'utf8').replace(/^\uFEFF/, ''),
    };
  },

  saveMarkdown(relativePath: string, content: string): { success: boolean; updatedAt: string } {
    const absolutePath = resolveRegistryPath(relativePath);
    if (extname(absolutePath).toLowerCase() !== '.md') {
      throw new Error('Only markdown files are editable through this endpoint.');
    }

    writeFileSync(absolutePath, content, 'utf8');
    forceReload();
    return {
      success: true,
      updatedAt: new Date().toISOString(),
    };
  },

  uploadFile(payload: { relativeDir: string; fileName: string; content: string }): { success: boolean; relativePath: string; updatedAt: string } {
    const relativeDir = normalizeRegistryRelativePath(payload.relativeDir);
    const fileName = payload.fileName.trim();

    if (!relativeDir) {
      throw new Error('Target directory is required.');
    }
    if (!fileName) {
      throw new Error('File name is required.');
    }

    const destinationDirectory = ensureWithinRegistryRoot(join(getRegistryRoot(), normalize(relativeDir)));
    const destinationPath = ensureWithinRegistryRoot(join(destinationDirectory, fileName));
    const extension = extname(destinationPath).toLowerCase();

    if (!SUPPORTED_REGISTRY_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported upload extension: ${extension}`);
    }

    mkdirSync(destinationDirectory, { recursive: true });
    writeFileSync(destinationPath, payload.content, 'utf8');
    forceReload();

    return {
      success: true,
      relativePath: normalizeRegistryRelativePath(relative(getRegistryRoot(), destinationPath)),
      updatedAt: new Date().toISOString(),
    };
  },
};
