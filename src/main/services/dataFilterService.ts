import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import {
  ApprovedRuntimeWritePayload,
  RuntimeChannelDetails,
} from './registryRuntimeStoreService';

const REGISTRY_SYNC_SCHEMA = 'registry-sync.v1';

const SYNC_ROOT_RELATIVE_PATHS = [
  ['company'],
  ['product-details.json'],
  ['agents'],
  ['skills'],
  ['protocols'],
  ['kpis'],
  ['data-inputs'],
  ['workflows'],
] as const;

const SYNC_TEXT_FILE_EXTENSIONS = new Set(['.json', '.yaml', '.yml']);

const LOCAL_ONLY_FILE_HINTS = [
  'model',
  'channel',
  'credential',
  'token',
  'auth',
  'cache',
  'embedding',
  'vector',
  'session',
  'chat-history',
  'prompt-cache',
];

export interface RegistrySyncRuntimeState {
  committedAt: string;
  contextByStep: Record<string, Record<string, string>>;
  approvalByStep: Record<string, 'PENDING' | 'DRAFT' | 'APPROVED'>;
  agentMappings: Record<string, {
    skills: string[];
    protocols: string[];
    kpis: string[];
    workflows: string[];
  }>;
  channelDetails: Pick<RuntimeChannelDetails, 'provider' | 'allowedChannels' | 'approvedAgentsForChannels' | 'channelAccessRules'>;
}

export interface RegistrySyncFileRecord {
  path: string;
  checksumSha256: string;
  content: string;
}

export interface RegistrySyncSnapshot {
  schemaVersion: string;
  generatedAt: string;
  runtime: RegistrySyncRuntimeState;
  files: RegistrySyncFileRecord[];
  integrity: {
    manifestChecksumSha256: string;
    fileChecksums: Record<string, string>;
  };
}

interface BuildRegistrySyncSnapshotInput {
  generatedAt: string;
  runtimeState: ApprovedRuntimeWritePayload & {
    channelDetails: RuntimeChannelDetails;
  };
  registryRootPath?: string;
}

interface ResolveRegistryRootResult {
  rootPath: string;
  found: boolean;
}

const normalizeContent = (value: string): string => value.replace(/\r\n/g, '\n');

const computeChecksum = (content: string): string => {
  return createHash('sha256').update(content, 'utf8').digest('hex');
};

const computeManifestChecksum = (fileChecksums: Record<string, string>): string => {
  const sortedEntries = Object.entries(fileChecksums).sort(([left], [right]) => left.localeCompare(right));
  const payload = sortedEntries.map(([path, checksum]) => `${path}:${checksum}`).join('\n');
  return computeChecksum(payload);
};

const isSyncEligibleFile = (path: string): boolean => {
  const lower = path.toLowerCase();
  if (!Array.from(SYNC_TEXT_FILE_EXTENSIONS.values()).some((extension) => lower.endsWith(extension))) {
    return false;
  }

  return !LOCAL_ONLY_FILE_HINTS.some((hint) => lower.includes(hint));
};

const listFilesRecursively = async (rootPath: string): Promise<string[]> => {
  const files: string[] = [];

  const visit = async (currentPath: string): Promise<void> => {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else {
        files.push(entryPath);
      }
    }
  };

  await visit(rootPath);
  return files;
};

const resolveRegistryRootPath = (override?: string): ResolveRegistryRootResult => {
  if (override && existsSync(override)) {
    return { rootPath: override, found: true };
  }

  const candidates = [
    join(process.cwd(), 'src', 'core', 'registry'),
    join(process.resourcesPath ?? '', 'app.asar.unpacked', 'src', 'core', 'registry'),
    join(process.resourcesPath ?? '', 'src', 'core', 'registry'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { rootPath: candidate, found: true };
    }
  }

  return { rootPath: candidates[0], found: false };
};

const readEligibleRegistryFiles = async (registryRootPath: string): Promise<RegistrySyncFileRecord[]> => {
  const records: RegistrySyncFileRecord[] = [];

  for (const relativeParts of SYNC_ROOT_RELATIVE_PATHS) {
    const targetPath = join(registryRootPath, ...relativeParts);
    if (!existsSync(targetPath)) {
      continue;
    }

    const targetStats = await stat(targetPath);
    const contentPaths = targetStats.isDirectory() ? await listFilesRecursively(targetPath) : [targetPath];

    for (const filePath of contentPaths) {
      const relativePath = relative(registryRootPath, filePath).split('\\').join('/');
      if (!isSyncEligibleFile(relativePath)) {
        continue;
      }

      const raw = await readFile(filePath, 'utf8');
      const normalized = normalizeContent(raw);
      records.push({
        path: relativePath,
        checksumSha256: computeChecksum(normalized),
        content: normalized,
      });
    }
  }

  return records.sort((left, right) => left.path.localeCompare(right.path));
};

const toSyncRuntimeState = (
  runtimeState: BuildRegistrySyncSnapshotInput['runtimeState'],
): RegistrySyncRuntimeState => {
  const filteredContext = Object.fromEntries(
    Object.entries(runtimeState.contextByStep).map(([stepId, context]) => {
      const sanitizedEntries = Object.entries(context).filter(([key]) => {
        const lower = key.toLowerCase();
        return !(
          lower.includes('token')
          || lower.includes('credential')
          || lower.includes('endpoint')
          || lower.includes('session')
          || lower.includes('auth')
          || lower.includes('cache')
          || lower.includes('embedding')
          || lower.includes('vector')
          || lower.includes('telegram_channel_id')
          || lower.includes('webhook_subscription_uri')
        );
      });
      return [stepId, Object.fromEntries(sanitizedEntries)] as const;
    }),
  );

  return {
    committedAt: runtimeState.committedAt,
    contextByStep: filteredContext,
    approvalByStep: runtimeState.approvalByStep,
    agentMappings: runtimeState.agentMappings,
    channelDetails: {
      provider: runtimeState.channelDetails.provider,
      allowedChannels: runtimeState.channelDetails.allowedChannels,
      approvedAgentsForChannels: runtimeState.channelDetails.approvedAgentsForChannels,
      channelAccessRules: runtimeState.channelDetails.channelAccessRules,
    },
  };
};

const verifySnapshotIntegrity = (snapshot: RegistrySyncSnapshot): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];
  const computedChecksums: Record<string, string> = {};

  for (const file of snapshot.files) {
    const expected = file.checksumSha256;
    const actual = computeChecksum(normalizeContent(file.content));
    computedChecksums[file.path] = actual;

    if (expected !== actual) {
      issues.push(`Checksum mismatch for ${file.path}`);
    }

    const listed = snapshot.integrity.fileChecksums[file.path];
    if (!listed || listed !== expected) {
      issues.push(`Integrity map mismatch for ${file.path}`);
    }
  }

  const manifest = computeManifestChecksum(computedChecksums);
  if (snapshot.integrity.manifestChecksumSha256 !== manifest) {
    issues.push('Manifest checksum mismatch');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};

export const dataFilterService = {
  async buildRegistrySyncSnapshot(input: BuildRegistrySyncSnapshotInput): Promise<RegistrySyncSnapshot> {
    const { rootPath, found } = resolveRegistryRootPath(input.registryRootPath);
    const files = found ? await readEligibleRegistryFiles(rootPath) : [];
    const fileChecksums = Object.fromEntries(files.map((file) => [file.path, file.checksumSha256]));

    return {
      schemaVersion: REGISTRY_SYNC_SCHEMA,
      generatedAt: input.generatedAt,
      runtime: toSyncRuntimeState(input.runtimeState),
      files,
      integrity: {
        manifestChecksumSha256: computeManifestChecksum(fileChecksums),
        fileChecksums,
      },
    };
  },

  validateSnapshotIntegrity(snapshot: RegistrySyncSnapshot): { valid: boolean; issues: string[] } {
    return verifySnapshotIntegrity(snapshot);
  },
};
