import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { getAppDataRoot, getGovernanceRepoPath, getGovernanceRepoUrl, mkdirSafe } from './governanceRepoService';
import { driveControllerService } from './driveControllerService';
import { executeCommand } from './processService';
import { getRuntimeBootstrapConfig } from './runtimeConfigService';
import { hookSystemService } from './hookSystemService';
import { memoryIndexService } from './memoryIndexService';
import { vaultMetadataService } from './vaultMetadataService';
import { vaultRegistryService } from './vaultRegistryService';
import { syncStoreService } from './syncStoreService';
import { PATH_TRAVERSAL_VIOLATION } from './virtualDriveProvider';

const DEFAULT_SCHEMA_FILE = 'schema_validation.json';
const DEFAULT_INDEX_FILE = 'vault_index.json';
const ENVELOPE_MAGIC_V1_CURRENT = 'PRANA_VAULT_V1';
const ENVELOPE_MAGIC_V1_LEGACY = 'DHI_VAULT_V1';
const STASH_MARKER_CURRENT = 'prana-vault-auto-stash';

export type VaultClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type VaultScanStatus = 'PENDING' | 'SCANNING' | 'CLEAN' | 'QUARANTINE';

export interface VaultFileRecord {
  id: string;
  filename: string;
  size: string;
  classification: VaultClassification;
  scanStatus: VaultScanStatus;
  uploadedAt: string;
  validationErrors?: string[];
}

interface SchemaDefinition {
  required_columns: string[];
}

interface SchemaValidationConfig {
  schemas: Record<string, SchemaDefinition>;
}

interface VaultArchiveFile {
  path: string;
  contentBase64: string;
}

interface VaultArchivePayload {
  specVersion: string;
  createdAt: string;
  files: VaultArchiveFile[];
}

interface VaultArchiveEnvelope {
  magic: string;
  algorithm: 'aes-256-gcm';
  kdf: 'pbkdf2-sha256';
  iterations: number;
  ivBase64: string;
  tagBase64: string;
  ciphertextBase64: string;
}

interface PublishVaultResult {
  success: boolean;
  archivePath: string;
  committed: boolean;
  pushed: boolean;
  hadStashedChanges: boolean;
  message: string;
}

interface PublishVaultOptions {
  commitMessage?: string;
  approvedByUser?: boolean;
}

interface SyncFromRemoteResult {
  success: boolean;
  message: string;
}

export interface VaultKnowledgePendingFile {
  id: string;
  filename: string;
  relativePath: string;
  agent: string;
  size: string;
  classification: 'T1' | 'T2' | 'T3' | 'T4';
}

export interface VaultKnowledgeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  relativePath: string;
  children?: VaultKnowledgeNode[];
  size?: string;
}

export interface VaultKnowledgeSnapshot {
  status: 'LOCKED' | 'UNLOCKED' | 'SYNCING';
  lastSync: string;
  pendingFiles: VaultKnowledgePendingFile[];
  directoryTree: VaultKnowledgeNode[];
}

export interface VaultFileReadResult {
  fileName: string;
  relativePath: string;
  encoding: 'text' | 'base64';
  mimeType: string;
  content: string;
}

const defaultSchema: SchemaValidationConfig = {
  schemas: {
    ledger: {
      required_columns: ['date', 'description', 'amount', 'category'],
    },
    jira_export: {
      required_columns: ['issue_key', 'status', 'assignee', 'story_points', 'sprint'],
    },
    analytics: {
      required_columns: ['page', 'views', 'bounce_rate', 'conversion'],
    },
  },
};

const getRuntimeVaultConfig = () => {
  return getRuntimeBootstrapConfig().vault;
};

const getTempRootDir = (): string => join(getAppDataRoot(), 'vault-temp');
const getWorkingRootDir = (): string => join(getTempRootDir(), 'working');
const getSnapshotDir = (): string => join(getTempRootDir(), 'snapshots');
const getArchiveDir = (): string => driveControllerService.getVaultArchiveRoot();
const getArchivePath = (): string => {
  const vaultConfig = getRuntimeVaultConfig();
  const fileName = `${vaultConfig.outputPrefix}${vaultConfig.specVersion}${vaultConfig.tempZipExtension}`;
  return join(getArchiveDir(), fileName);
};

const getStageDir = (): string => join(getWorkingRootDir(), 'data', 'stage');
const getRawDir = (): string => join(getWorkingRootDir(), 'data', 'raw');
const getDcmDir = (): string => join(getWorkingRootDir(), '.dcm');
const getSchemaFilePath = (): string => join(getDcmDir(), DEFAULT_SCHEMA_FILE);
const getIndexFilePath = (): string => join(getAppDataRoot(), DEFAULT_INDEX_FILE);

const refreshMemoryIndex = async (): Promise<void> => {
  await memoryIndexService.reindexDirectory(getWorkingRootDir());
};

const deriveVaultKey = (): Buffer => {
  const vaultConfig = getRuntimeVaultConfig();
  return pbkdf2Sync(
    vaultConfig.archivePassword,
    vaultConfig.archiveSalt,
    vaultConfig.kdfIterations,
    32,
    'sha256',
  );
};

const encryptVaultPayload = (payload: VaultArchivePayload): VaultArchiveEnvelope => {
  const key = deriveVaultKey();
  const vaultConfig = getRuntimeVaultConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(payload.specVersion, 'utf8'));

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    magic: ENVELOPE_MAGIC_V1_CURRENT,
    algorithm: 'aes-256-gcm',
    kdf: 'pbkdf2-sha256',
    iterations: vaultConfig.kdfIterations,
    ivBase64: iv.toString('base64'),
    tagBase64: tag.toString('base64'),
    ciphertextBase64: encrypted.toString('base64'),
  };
};

const decryptVaultEnvelope = (envelopeRaw: string): VaultArchivePayload => {
  let envelope: VaultArchiveEnvelope;
  try {
    envelope = JSON.parse(envelopeRaw) as VaultArchiveEnvelope;
  } catch {
    throw new Error('Vault archive is not a valid encrypted envelope.');
  }

  if (envelope.magic !== ENVELOPE_MAGIC_V1_CURRENT && envelope.magic !== ENVELOPE_MAGIC_V1_LEGACY) {
    throw new Error('Vault archive signature mismatch. Renaming to .zip will not produce an extractable file.');
  }

  const key = deriveVaultKey();
  const iv = Buffer.from(envelope.ivBase64, 'base64');
  const tag = Buffer.from(envelope.tagBase64, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertextBase64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  const runtimeVaultConfig = getRuntimeVaultConfig();
  decipher.setAAD(Buffer.from(runtimeVaultConfig.specVersion, 'utf8'));
  decipher.setAuthTag(tag);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error(
      'Unable to decrypt vault archive. Check PRANA_VAULT_ARCHIVE_PASSWORD and PRANA_VAULT_ARCHIVE_SALT (legacy DHI_* aliases are supported).',
    );
  }

  const payload = JSON.parse(plaintext.toString('utf8')) as VaultArchivePayload;

  if (payload.specVersion !== runtimeVaultConfig.specVersion) {
    throw new Error(
      `Vault spec mismatch. Archive=${payload.specVersion}, Runtime=${runtimeVaultConfig.specVersion}.`,
    );
  }

  return payload;
};

const collectFilesRecursively = async (rootPath: string): Promise<string[]> => {
  const allFiles: string[] = [];

  if (!existsSync(rootPath)) {
    return allFiles;
  }

  const walk = async (currentPath: string): Promise<void> => {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else {
        allFiles.push(entryPath);
      }
    }
  };

  await walk(rootPath);
  return allFiles;
};

const buildArchivePayload = async (): Promise<VaultArchivePayload> => {
  const workingRoot = getWorkingRootDir();
  const allFiles = await collectFilesRecursively(workingRoot);
  const files: VaultArchiveFile[] = [];

  for (const filePath of allFiles) {
    const relPath = relative(workingRoot, filePath).split('\\').join('/');
    const content = await readFile(filePath);
    files.push({
      path: relPath,
      contentBase64: content.toString('base64'),
    });
  }

  return {
    specVersion: getRuntimeVaultConfig().specVersion,
    createdAt: new Date().toISOString(),
    files,
  };
};

const materializePayloadToWorkingRoot = async (payload: VaultArchivePayload): Promise<void> => {
  const workingRoot = getWorkingRootDir();
  await rm(workingRoot, { recursive: true, force: true });
  await mkdir(workingRoot, { recursive: true });

  for (const file of payload.files) {
    const targetPath = resolve(workingRoot, file.path);
    if (!isPathInsideRoot(targetPath, workingRoot)) {
      continue;
    }

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, Buffer.from(file.contentBase64, 'base64'));
  }
};

const writeEncryptedArchiveFromWorkingRoot = async (): Promise<string> => {
  const archivePath = getArchivePath();
  await mkdir(getArchiveDir(), { recursive: true });

  const payload = await buildArchivePayload();
  const envelope = encryptVaultPayload(payload);
  await writeFile(archivePath, JSON.stringify(envelope, null, 2), 'utf8');
  return archivePath;
};

const hydrateWorkingRootFromArchiveIfPresent = async (): Promise<void> => {
  const archivePath = getArchivePath();
  if (!existsSync(archivePath)) {
    return;
  }

  const raw = await readFile(archivePath, 'utf8');
  const payload = decryptVaultEnvelope(raw);
  await materializePayloadToWorkingRoot(payload);
};

const isPathInsideRoot = (targetPath: string, rootPath: string): boolean => {
  const resolvedTarget = resolve(targetPath);
  const resolvedRoot = resolve(rootPath);
  return normalize(resolvedTarget).startsWith(normalize(resolvedRoot));
};

const bytesToHumanReadable = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const detectSchemaType = (fileName: string): 'ledger' | 'jira_export' | 'analytics' | null => {
  const lower = fileName.toLowerCase();
  if (lower.includes('ledger')) return 'ledger';
  if (lower.includes('jira')) return 'jira_export';
  if (lower.includes('analytics')) return 'analytics';
  return null;
};

const classifyData = (schemaType: string | null, headerColumns: string[]): VaultClassification => {
  const piiHints = ['ssn', 'account', 'phone', 'email', 'person', 'customer'];
  const hasPii = headerColumns.some((col) => piiHints.some((hint) => col.includes(hint)));

  if (hasPii || schemaType === 'ledger') return 'RESTRICTED';
  if (schemaType === 'jira_export' || schemaType === 'analytics') return 'INTERNAL';
  return 'CONFIDENTIAL';
};

const parseCsvHeaders = async (filePath: string): Promise<string[]> => {
  const content = await readFile(filePath, 'utf8');
  const [firstLine] = content.split(/\r?\n/);
  if (!firstLine) return [];
  return firstLine
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
};

const ensureVaultStore = async (): Promise<void> => {
  await mkdir(getTempRootDir(), { recursive: true });
  await mkdir(getSnapshotDir(), { recursive: true });
  await mkdirSafe(getAppDataRoot());
  await mkdir(getStageDir(), { recursive: true });
  await mkdir(getRawDir(), { recursive: true });
  await mkdir(getDcmDir(), { recursive: true });
  await mkdir(getArchiveDir(), { recursive: true });

  await hydrateWorkingRootFromArchiveIfPresent();

  await mkdir(getStageDir(), { recursive: true });
  await mkdir(getRawDir(), { recursive: true });
  await mkdir(getDcmDir(), { recursive: true });

  if (!existsSync(getSchemaFilePath())) {
    await writeFile(getSchemaFilePath(), JSON.stringify(defaultSchema, null, 2), 'utf8');
  }

  if (!existsSync(getIndexFilePath())) {
    await writeFile(getIndexFilePath(), JSON.stringify([]), 'utf8');
  }

  const metadata = await vaultMetadataService.ensureMetadata(getWorkingRootDir());
  await vaultRegistryService.ensureRegistered(getWorkingRootDir(), metadata);
  const appRecord = await syncStoreService.ensureAppRegistered({
    appKey: metadata.appKey,
    appName: metadata.appName,
    isActive: true,
  });
  await syncStoreService.replaceVaultBlueprint({
    appId: appRecord.appId,
    entries: metadata.domainKeys.map((domainKey) => ({
      domainKey,
      relativePath: `${metadata.rootPath}/${domainKey}`,
      isRequired: true,
      lastSyncedAt: metadata.generatedAt,
    })),
  });
};

const hasGitChanges = async (repoPath: string): Promise<boolean> => {
  const status = await executeCommand('git', ['status', '--porcelain'], 20_000, repoPath);
  return status.ok && status.stdout.trim().length > 0;
};

const stashChanges = async (repoPath: string): Promise<string | null> => {
  const hasChanges = await hasGitChanges(repoPath);
  if (!hasChanges) {
    return null;
  }

  const stashLabel = `${STASH_MARKER_CURRENT}-${Date.now()}`;

  const stashResult = await executeCommand(
    'git',
    ['stash', 'push', '-u', '-m', stashLabel],
    30_000,
    repoPath,
  );

  if (!stashResult.ok) {
    return null;
  }

  const listResult = await executeCommand('git', ['stash', 'list'], 20_000, repoPath);
  if (!listResult.ok) {
    return null;
  }

  const line = listResult.stdout
    .split(/\r?\n/)
    .find((value) => value.includes(stashLabel));

  if (!line) {
    return null;
  }

  const [stashRef] = line.split(':');
  return stashRef?.trim() || null;
};

const popStashIfPresent = async (repoPath: string, stashRef: string | null): Promise<void> => {
  if (!stashRef) {
    return;
  }

  const applyResult = await executeCommand('git', ['stash', 'apply', stashRef], 30_000, repoPath);
  if (!applyResult.ok) {
    throw new Error(applyResult.stderr.trim() || 'Failed to restore stashed changes.');
  }

  const dropResult = await executeCommand('git', ['stash', 'drop', stashRef], 20_000, repoPath);
  if (!dropResult.ok) {
    throw new Error(dropResult.stderr.trim() || 'Failed to clear temporary stash.');
  }
};

const normalizeGitRemote = (remote: string): string => {
  return remote
    .trim()
    .toLowerCase()
    .replace(/^ssh:\/\/git@/, 'git@')
    .replace(/\.git$/, '');
};

const assertDataRepoTarget = async (repoPath: string): Promise<void> => {
  const expectedRemote = normalizeGitRemote(getGovernanceRepoUrl());
  const originResult = await executeCommand('git', ['remote', 'get-url', 'origin'], 20_000, repoPath);

  if (!originResult.ok) {
    throw new Error('Unable to verify data repository origin before publishing vault changes.');
  }

  const actualRemote = normalizeGitRemote(originResult.stdout);
  if (!actualRemote || actualRemote !== expectedRemote) {
    throw new Error(
      `Vault publish blocked: repository origin mismatch. Expected=${expectedRemote}, Actual=${actualRemote || 'unknown'}.`,
    );
  }
};

const commitAndPushArchive = async (repoPath: string, archivePath: string, message: string): Promise<void> => {
  const archiveRelative = relative(repoPath, archivePath).split('\\').join('/');
  const addResult = await executeCommand('git', ['add', archiveRelative], 20_000, repoPath);
  if (!addResult.ok) {
    throw new Error(addResult.stderr.trim() || 'Failed to stage vault archive.');
  }

  const commitResult = await executeCommand('git', ['commit', '-m', message], 30_000, repoPath);
  if (!commitResult.ok) {
    const output = `${commitResult.stdout}\n${commitResult.stderr}`;
    if (/nothing to commit/i.test(output)) {
      return;
    }
    throw new Error(commitResult.stderr.trim() || commitResult.stdout.trim() || 'Failed to commit vault archive.');
  }

  const pushResult = await executeCommand('git', ['push'], 60_000, repoPath);
  if (!pushResult.ok) {
    throw new Error(pushResult.stderr.trim() || pushResult.stdout.trim() || 'Failed to push vault archive.');
  }
};

const readIndex = async (): Promise<VaultFileRecord[]> => {
  await ensureVaultStore();
  const raw = await readFile(getIndexFilePath(), 'utf8');
  return JSON.parse(raw) as VaultFileRecord[];
};

const writeIndex = async (records: VaultFileRecord[]): Promise<void> => {
  await writeFile(getIndexFilePath(), JSON.stringify(records, null, 2), 'utf8');
};

const validateAgainstSchema = async (
  filePath: string,
  schemaType: 'ledger' | 'jira_export' | 'analytics' | null,
): Promise<{ valid: boolean; errors: string[]; headers: string[] }> => {
  if (extname(filePath).toLowerCase() !== '.csv') {
    return { valid: true, errors: [], headers: [] };
  }

  const headers = await parseCsvHeaders(filePath);
  if (!schemaType) {
    return { valid: true, errors: [], headers };
  }

  const schemaRaw = await readFile(getSchemaFilePath(), 'utf8');
  const schemaConfig = JSON.parse(schemaRaw) as SchemaValidationConfig;
  const schema = schemaConfig.schemas[schemaType];

  if (!schema) {
    return { valid: true, errors: [], headers };
  }

  const errors = schema.required_columns
    .filter((column) => !headers.includes(column.toLowerCase()))
    .map((column) => `Missing required column: ${column}`);

  return {
    valid: errors.length === 0,
    errors,
    headers,
  };
};

const allowedViewerExtensions = new Set([
  '.csv',
  '.md',
  '.markdown',
  '.txt',
  '.json',
  '.jsonl',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
]);

const getMimeType = (extension: string): string => {
  const ext = extension.toLowerCase();
  if (ext === '.csv') return 'text/csv';
  if (ext === '.md' || ext === '.markdown') return 'text/markdown';
  if (ext === '.txt') return 'text/plain';
  if (ext === '.json') return 'application/json';
  if (ext === '.jsonl') return 'application/x-jsonlines';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
};

const isTextLikeExtension = (extension: string): boolean => {
  return ['.csv', '.md', '.markdown', '.txt', '.json', '.jsonl'].includes(extension.toLowerCase());
};

const buildTreeForDirectory = async (
  currentPath: string,
  rootPath: string,
  depth = 0,
): Promise<VaultKnowledgeNode[]> => {
  if (!existsSync(currentPath) || depth > 5) {
    return [];
  }

  const entries = await readdir(currentPath, { withFileTypes: true });
  const nodes: VaultKnowledgeNode[] = [];

  for (const entry of entries) {
    const entryPath = join(currentPath, entry.name);
    const relativePath = relative(rootPath, entryPath).split('\\').join('/');

    if (entry.isDirectory()) {
      const children = await buildTreeForDirectory(entryPath, rootPath, depth + 1);
      nodes.push({
        id: `DIR:${relativePath}`,
        name: entry.name,
        type: 'directory',
        relativePath,
        children,
      });
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (!allowedViewerExtensions.has(extension)) {
      continue;
    }

    const stats = await stat(entryPath);
    nodes.push({
      id: `FILE:${relativePath}`,
      name: entry.name,
      type: 'file',
      relativePath,
      size: bytesToHumanReadable(stats.size),
    });
  }

  return nodes.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === 'directory' ? -1 : 1;
  });
};

const listPendingFromAgentTemp = async (): Promise<VaultKnowledgePendingFile[]> => {
  const pendingRoot = join(getWorkingRootDir(), 'agent-temp');
  if (!existsSync(pendingRoot)) {
    return [];
  }

  const files = await collectFilesRecursively(pendingRoot);
  const pending: VaultKnowledgePendingFile[] = [];

  for (const filePath of files) {
    const fileName = basename(filePath);
    const relativePath = relative(getWorkingRootDir(), filePath).split('\\').join('/');
    const agent = relative(pendingRoot, dirname(filePath)).split('\\').join('/').split('/')[0] || 'unknown';
    const stats = await stat(filePath);

    const extension = extname(fileName).toLowerCase();
    const classification: VaultKnowledgePendingFile['classification'] = extension === '.csv'
      ? 'T3'
      : extension === '.json' || extension === '.jsonl'
        ? 'T2'
        : 'T2';

    pending.push({
      id: `PF:${relativePath}`,
      filename: fileName,
      relativePath,
      agent,
      size: bytesToHumanReadable(stats.size),
      classification,
    });
  }

  return pending.sort((a, b) => a.filename.localeCompare(b.filename));
};

const assertVaultRelativePath = (relativePath: string): string => {
  const normalizedRelative = relativePath.replace(/\\/g, '/');
  const fullPath = resolve(join(getWorkingRootDir(), normalizedRelative));

  if (!isPathInsideRoot(fullPath, getWorkingRootDir()) || !existsSync(fullPath)) {
    throw new PATH_TRAVERSAL_VIOLATION('Requested vault path is invalid.');
  }

  return fullPath;
};

const withVaultWorkspace = async <T>(operation: () => Promise<T>): Promise<T> => {
  return driveControllerService.withVaultDriveSession(async () => {
    await ensureVaultStore();
    try {
      return await operation();
    } finally {
      await vaultService.cleanupTemporaryWorkspace(true);
    }
  });
};

export const vaultService = {
  async initializeVault(): Promise<void> {
    await ensureVaultStore();
  },

  async createTempSnapshot(label = 'manual'): Promise<string> {
    return withVaultWorkspace(async () => {
      const archivePath = await writeEncryptedArchiveFromWorkingRoot();
      const snapshotName = `${Date.now()}_${label}${getRuntimeVaultConfig().tempZipExtension}`;
      const snapshotPath = join(getSnapshotDir(), snapshotName);
      await copyFile(archivePath, snapshotPath);
      return snapshotPath;
    });
  },

  async resumeFromSnapshot(snapshotPath: string): Promise<void> {
    await withVaultWorkspace(async () => {
      const absolutePath = resolve(snapshotPath);
      if (!isPathInsideRoot(absolutePath, getSnapshotDir()) || !existsSync(absolutePath)) {
        throw new Error('Snapshot path is invalid.');
      }

      const raw = await readFile(absolutePath, 'utf8');
      const payload = decryptVaultEnvelope(raw);
      await materializePayloadToWorkingRoot(payload);
    });
  },

  async publishVaultChanges(options?: PublishVaultOptions): Promise<PublishVaultResult> {
    return withVaultWorkspace(async () => {
      const repoPath = getGovernanceRepoPath();
      const timestamp = new Date().toISOString();
      const message = options?.commitMessage?.trim() || `vault: publish ${timestamp}`;
      const approvedByUser = options?.approvedByUser === true;

      const archivePath = await writeEncryptedArchiveFromWorkingRoot();
      if (!approvedByUser) {
        return {
          success: true,
          archivePath,
          committed: false,
          pushed: false,
          hadStashedChanges: false,
          message: 'Vault archive saved locally. Awaiting explicit user approval for commit and push.',
        };
      }

      await assertDataRepoTarget(repoPath);

      const stashRef = await stashChanges(repoPath);
      const hadStashedChanges = Boolean(stashRef);
      let committed = false;
      let pushed = false;

      try {
        const beforeStatus = await executeCommand('git', ['status', '--porcelain', '--', relative(repoPath, archivePath)], 20_000, repoPath);
        const hasArchiveDelta = beforeStatus.ok && beforeStatus.stdout.trim().length > 0;

        if (hasArchiveDelta) {
          await commitAndPushArchive(repoPath, archivePath, message);
          committed = true;
          pushed = true;
        }

        return {
          success: true,
          archivePath,
          committed,
          pushed,
          hadStashedChanges,
          message: hasArchiveDelta ? 'Vault archive published.' : 'No archive changes to publish.',
        };
      } finally {
        await hookSystemService.emit('schedule.tick', {
          jobId: 'vault.publish',
          approvedByUser,
          committed,
          pushed,
        });
        if (hadStashedChanges) {
          await popStashIfPresent(repoPath, stashRef);
        }
      }
    });
  },

  async syncFromRemoteVault(): Promise<SyncFromRemoteResult> {
    await ensureVaultStore();
    const repoPath = getGovernanceRepoPath();

    if (!existsSync(join(repoPath, '.git'))) {
      return {
        success: false,
        message: 'Governance repository is not available for remote pull.',
      };
    }

    const pullResult = await executeCommand('git', ['pull', '--ff-only'], 60_000, repoPath);
    if (!pullResult.ok) {
      return {
        success: false,
        message: pullResult.stderr.trim() || pullResult.stdout.trim() || 'Failed to pull remote governance repository.',
      };
    }

    await hydrateWorkingRootFromArchiveIfPresent();
    return {
      success: true,
      message: 'Pulled latest governance repository and hydrated vault workspace.',
    };
  },

  async cleanupTemporaryWorkspace(force = false): Promise<void> {
    const keepTemp = getRuntimeVaultConfig().keepTempOnClose;
    if (keepTemp && !force) {
      return;
    }

    await rm(getWorkingRootDir(), { recursive: true, force: true });
  },

  async listFiles(): Promise<VaultFileRecord[]> {
    return withVaultWorkspace(async () => {
      const records = await readIndex();
      return [...records].sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
    });
  },

  async getKnowledgeSnapshot(): Promise<VaultKnowledgeSnapshot> {
    return withVaultWorkspace(async () => {
      const workingRoot = getWorkingRootDir();
      const status: VaultKnowledgeSnapshot['status'] = existsSync(workingRoot) ? 'UNLOCKED' : 'LOCKED';
      const lastSync = new Date().toISOString();

      const directoryTree = await buildTreeForDirectory(workingRoot, workingRoot);
      const pendingFiles = await listPendingFromAgentTemp();

      return {
        status,
        lastSync,
        pendingFiles,
        directoryTree,
      };
    });
  },

  async readKnowledgeFile(relativePath: string): Promise<VaultFileReadResult> {
    return withVaultWorkspace(async () => {
      const filePath = assertVaultRelativePath(relativePath);
      const fileName = basename(filePath);
      const extension = extname(fileName).toLowerCase();
      const mimeType = getMimeType(extension);

      if (isTextLikeExtension(extension)) {
        const content = await readFile(filePath, 'utf8');
        return {
          fileName,
          relativePath: relativePath.replace(/\\/g, '/'),
          encoding: 'text',
          mimeType,
          content,
        };
      }

      const binary = await readFile(filePath);
      return {
        fileName,
        relativePath: relativePath.replace(/\\/g, '/'),
        encoding: 'base64',
        mimeType,
        content: binary.toString('base64'),
      };
    });
  },

  async approvePendingFile(relativePath: string): Promise<VaultKnowledgeSnapshot> {
    return withVaultWorkspace(async () => {
      const sourcePath = assertVaultRelativePath(relativePath);
      const normalizedRelative = relativePath.replace(/\\/g, '/');

      if (!normalizedRelative.startsWith('agent-temp/')) {
        throw new Error('Only agent-temp files can be approved.');
      }

      const targetPath = join(getWorkingRootDir(), 'data', 'processed', basename(sourcePath));
      await mkdir(dirname(targetPath), { recursive: true });
      await rename(sourcePath, targetPath);
      await writeEncryptedArchiveFromWorkingRoot();
      await refreshMemoryIndex();
      await hookSystemService.emit('vault.pending.approved', { relativePath });

      const workingRoot = getWorkingRootDir();
      return {
        status: 'UNLOCKED',
        lastSync: new Date().toISOString(),
        pendingFiles: await listPendingFromAgentTemp(),
        directoryTree: await buildTreeForDirectory(workingRoot, workingRoot),
      };
    });
  },

  async rejectPendingFile(relativePath: string): Promise<VaultKnowledgeSnapshot> {
    return withVaultWorkspace(async () => {
      const sourcePath = assertVaultRelativePath(relativePath);
      const normalizedRelative = relativePath.replace(/\\/g, '/');

      if (!normalizedRelative.startsWith('agent-temp/')) {
        throw new Error('Only agent-temp files can be rejected.');
      }

      await rm(sourcePath, { recursive: false, force: true });
      await writeEncryptedArchiveFromWorkingRoot();
      await refreshMemoryIndex();
      await hookSystemService.emit('vault.pending.rejected', { relativePath });

      const workingRoot = getWorkingRootDir();
      return {
        status: 'UNLOCKED',
        lastSync: new Date().toISOString(),
        pendingFiles: await listPendingFromAgentTemp(),
        directoryTree: await buildTreeForDirectory(workingRoot, workingRoot),
      };
    });
  },

  async ingestPaths(sourcePaths: string[]): Promise<VaultFileRecord[]> {
    return withVaultWorkspace(async () => {
      const workingRoot = getWorkingRootDir();
      const index = await readIndex();
      const created: VaultFileRecord[] = [];

      for (const sourcePath of sourcePaths) {
        const sourceAbsolutePath = resolve(sourcePath);
        if (!existsSync(sourceAbsolutePath)) {
          continue;
        }

        const fileName = basename(sourceAbsolutePath);
        const timestamp = Date.now();
        const stageFileName = `${timestamp}_${fileName}`;
        const stagePath = join(getStageDir(), stageFileName);

        if (!isPathInsideRoot(stagePath, workingRoot)) {
          continue;
        }

        await copyFile(sourceAbsolutePath, stagePath);

        const schemaType = detectSchemaType(fileName);
        const validation = await validateAgainstSchema(stagePath, schemaType);
        const classification = classifyData(schemaType, validation.headers);

        const destinationPath = join(getRawDir(), stageFileName);
        let status: VaultScanStatus = 'CLEAN';

        if (validation.valid) {
          await rename(stagePath, destinationPath);
        } else {
          status = 'QUARANTINE';
        }

        const fileStats = await stat(validation.valid ? destinationPath : stagePath);
        const record: VaultFileRecord = {
          id: `VLT-${randomUUID()}`,
          filename: fileName,
          size: bytesToHumanReadable(fileStats.size),
          classification,
          scanStatus: status,
          uploadedAt: new Date().toISOString(),
          validationErrors: validation.errors.length > 0 ? validation.errors : undefined,
        };

        index.unshift(record);
        created.push(record);
      }

      await writeIndex(index);
      await writeEncryptedArchiveFromWorkingRoot();
      await refreshMemoryIndex();
      await hookSystemService.emit('vault.ingested', { count: created.length });
      return created;
    });
  },

  getWorkingRootPath(): string {
    return getWorkingRootDir();
  },
};
