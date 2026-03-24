import { getGovernanceRepoPath, getGovernanceRepoUrl } from './governanceRepoService';
import { readMainEnv } from './envService';

const DEFAULT_DIRECTOR_NAME = 'Director';
const DEFAULT_DIRECTOR_EMAIL = 'director@prana.local';
const DEFAULT_VAULT_SPEC_VERSION = 'v1';
const DEFAULT_VAULT_TEMP_ZIP_EXT = '.zip';
const DEFAULT_VAULT_OUTPUT_PREFIX = 'vault_export_';
const DEFAULT_VAULT_KDF_ITERATIONS = 210_000;
const DEFAULT_SYNC_PUSH_INTERVAL_MS = 120_000;
const DEFAULT_SYNC_CRON_ENABLED = true;
const DEFAULT_SYNC_PUSH_CRON_EXPRESSION = '*/10 * * * *';
const DEFAULT_SYNC_PULL_CRON_EXPRESSION = '*/15 * * * *';

const normalizeExtension = (extension: string): string => {
  return extension.startsWith('.') ? extension : `.${extension}`;
};

const readRuntimeEnv = (neutralKey: string, legacyKey: string): string | undefined => {
  return readMainEnv(neutralKey) ?? readMainEnv(legacyKey);
};

export interface RuntimeBootstrapConfig {
  director: {
    name: string;
    email: string;
    password?: string;
    passwordHash?: string;
  };
  governance: {
    repoUrl: string;
    repoPath: string;
  };
  vault: {
    specVersion: string;
    tempZipExtension: string;
    outputPrefix: string;
    archivePassword: string;
    archiveSalt: string;
    kdfIterations: number;
    keepTempOnClose: boolean;
  };
  channels: {
    telegramChannelId?: string;
    slackChannelId?: string;
    teamsChannelId?: string;
  };
  sync: {
    pushIntervalMs: number;
    cronEnabled: boolean;
    pushCronExpression: string;
    pullCronExpression: string;
  };
}

export interface PublicRuntimeConfig {
  directorName: string;
  directorEmail: string;
  governanceRepoUrl: string;
  governanceRepoPath: string;
  vaultSpecVersion: string;
  vaultTempZipExtension: string;
  vaultOutputPrefix: string;
  vaultKdfIterations: number;
  vaultKeepTempOnClose: boolean;
  channels: {
    telegramChannelId?: string;
    slackChannelId?: string;
    teamsChannelId?: string;
  };
  sync: {
    pushIntervalMs: number;
    cronEnabled: boolean;
    pushCronExpression: string;
    pullCronExpression: string;
  };
}

export const getRuntimeBootstrapConfig = (): RuntimeBootstrapConfig => {
  const directorName = readRuntimeEnv('PRANA_DIRECTOR_NAME', 'DHI_DIRECTOR_NAME') ?? DEFAULT_DIRECTOR_NAME;
  const directorEmail = readRuntimeEnv('PRANA_DIRECTOR_EMAIL', 'DHI_DIRECTOR_EMAIL') ?? DEFAULT_DIRECTOR_EMAIL;
  const directorPassword = readRuntimeEnv('PRANA_DIRECTOR_PASSWORD', 'DHI_DIRECTOR_PASSWORD');
  const directorPasswordHash = readRuntimeEnv('PRANA_DIRECTOR_PASSWORD_HASH', 'DHI_DIRECTOR_PASSWORD_HASH');

  const vaultPassword = readRuntimeEnv('PRANA_VAULT_ARCHIVE_PASSWORD', 'DHI_VAULT_ARCHIVE_PASSWORD');
  const vaultSalt = readRuntimeEnv('PRANA_VAULT_ARCHIVE_SALT', 'DHI_VAULT_ARCHIVE_SALT');
  const vaultKdfIterationsRaw = readRuntimeEnv('PRANA_VAULT_KDF_ITERATIONS', 'DHI_VAULT_KDF_ITERATIONS');
  const vaultKdfIterations = vaultKdfIterationsRaw
    ? Math.max(100_000, Number.parseInt(vaultKdfIterationsRaw, 10) || DEFAULT_VAULT_KDF_ITERATIONS)
    : DEFAULT_VAULT_KDF_ITERATIONS;
  const keepTempOnClose = readRuntimeEnv('PRANA_VAULT_KEEP_TEMP_ON_CLOSE', 'DHI_VAULT_KEEP_TEMP_ON_CLOSE') === 'true';
  const syncPushIntervalRaw = readRuntimeEnv('PRANA_SYNC_PUSH_INTERVAL_MS', 'DHI_SYNC_PUSH_INTERVAL_MS');
  const syncPushIntervalMs = syncPushIntervalRaw
    ? Math.max(30_000, Number.parseInt(syncPushIntervalRaw, 10) || DEFAULT_SYNC_PUSH_INTERVAL_MS)
    : DEFAULT_SYNC_PUSH_INTERVAL_MS;
  const syncCronEnabledRaw = readRuntimeEnv('PRANA_SYNC_CRON_ENABLED', 'DHI_SYNC_CRON_ENABLED');
  const syncCronEnabled = syncCronEnabledRaw ? syncCronEnabledRaw !== 'false' : DEFAULT_SYNC_CRON_ENABLED;
  const syncPushCronExpression =
    readRuntimeEnv('PRANA_SYNC_PUSH_CRON_EXPRESSION', 'DHI_SYNC_PUSH_CRON_EXPRESSION') ?? DEFAULT_SYNC_PUSH_CRON_EXPRESSION;
  const syncPullCronExpression =
    readRuntimeEnv('PRANA_SYNC_PULL_CRON_EXPRESSION', 'DHI_SYNC_PULL_CRON_EXPRESSION') ?? DEFAULT_SYNC_PULL_CRON_EXPRESSION;

  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const resolvedVaultPassword = vaultPassword ?? (isTestEnv ? 'test-only-prana-vault-password' : undefined);
  const resolvedVaultSalt = vaultSalt ?? (isTestEnv ? 'test-only-prana-vault-salt' : undefined);

  if (!resolvedVaultPassword || !resolvedVaultSalt) {
    throw new Error(
      'Missing vault encryption env. Set PRANA_VAULT_ARCHIVE_PASSWORD and PRANA_VAULT_ARCHIVE_SALT (legacy DHI_* aliases still supported).',
    );
  }

  return {
    director: {
      name: directorName,
      email: directorEmail,
      password: directorPassword,
      passwordHash: directorPasswordHash,
    },
    governance: {
      repoUrl: getGovernanceRepoUrl(),
      repoPath: getGovernanceRepoPath(),
    },
    vault: {
      specVersion: readRuntimeEnv('PRANA_VAULT_SPEC_VERSION', 'DHI_VAULT_SPEC_VERSION') ?? DEFAULT_VAULT_SPEC_VERSION,
      tempZipExtension: normalizeExtension(
        readRuntimeEnv('PRANA_VAULT_TEMP_ZIP_EXT', 'DHI_VAULT_TEMP_ZIP_EXT') ?? DEFAULT_VAULT_TEMP_ZIP_EXT,
      ),
      outputPrefix: readRuntimeEnv('PRANA_VAULT_OUTPUT_PREFIX', 'DHI_VAULT_OUTPUT_PREFIX') ?? DEFAULT_VAULT_OUTPUT_PREFIX,
      archivePassword: resolvedVaultPassword,
      archiveSalt: resolvedVaultSalt,
      kdfIterations: vaultKdfIterations,
      keepTempOnClose,
    },
    channels: {
      telegramChannelId: readRuntimeEnv('PRANA_TELEGRAM_CHANNEL_ID', 'DHI_TELEGRAM_CHANNEL_ID'),
      slackChannelId: readRuntimeEnv('PRANA_SLACK_CHANNEL_ID', 'DHI_SLACK_CHANNEL_ID'),
      teamsChannelId: readRuntimeEnv('PRANA_TEAMS_CHANNEL_ID', 'DHI_TEAMS_CHANNEL_ID'),
    },
    sync: {
      pushIntervalMs: syncPushIntervalMs,
      cronEnabled: syncCronEnabled,
      pushCronExpression: syncPushCronExpression,
      pullCronExpression: syncPullCronExpression,
    },
  };
};

export const getPublicRuntimeConfig = (): PublicRuntimeConfig => {
  const config = getRuntimeBootstrapConfig();

  return {
    directorName: config.director.name,
    directorEmail: config.director.email,
    governanceRepoUrl: config.governance.repoUrl,
    governanceRepoPath: config.governance.repoPath,
    vaultSpecVersion: config.vault.specVersion,
    vaultTempZipExtension: config.vault.tempZipExtension,
    vaultOutputPrefix: config.vault.outputPrefix,
    vaultKdfIterations: config.vault.kdfIterations,
    vaultKeepTempOnClose: config.vault.keepTempOnClose,
    channels: config.channels,
    sync: config.sync,
  };
};