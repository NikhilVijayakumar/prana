import { getGovernanceRepoPath, getGovernanceRepoUrl } from './governanceRepoService';
import { readMainEnv } from './envService';

const DEFAULT_DIRECTOR_NAME = 'Director';
const DEFAULT_DIRECTOR_EMAIL = 'director@dhi.local';
const DEFAULT_VAULT_SPEC_VERSION = 'v1';
const DEFAULT_VAULT_TEMP_ZIP_EXT = '.zip';
const DEFAULT_VAULT_OUTPUT_PREFIX = 'dhi_vault_export_';
const DEFAULT_VAULT_KDF_ITERATIONS = 210_000;
const DEFAULT_SYNC_PUSH_INTERVAL_MS = 120_000;
const DEFAULT_SYNC_CRON_ENABLED = true;
const DEFAULT_SYNC_PUSH_CRON_EXPRESSION = '*/10 * * * *';
const DEFAULT_SYNC_PULL_CRON_EXPRESSION = '*/15 * * * *';

const normalizeExtension = (extension: string): string => {
  return extension.startsWith('.') ? extension : `.${extension}`;
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
  const directorName = readMainEnv('DHI_DIRECTOR_NAME') ?? DEFAULT_DIRECTOR_NAME;
  const directorEmail = readMainEnv('DHI_DIRECTOR_EMAIL') ?? DEFAULT_DIRECTOR_EMAIL;
  const directorPassword = readMainEnv('DHI_DIRECTOR_PASSWORD');
  const directorPasswordHash = readMainEnv('DHI_DIRECTOR_PASSWORD_HASH');

  const vaultPassword = readMainEnv('DHI_VAULT_ARCHIVE_PASSWORD');
  const vaultSalt = readMainEnv('DHI_VAULT_ARCHIVE_SALT');
  const vaultKdfIterationsRaw = readMainEnv('DHI_VAULT_KDF_ITERATIONS');
  const vaultKdfIterations = vaultKdfIterationsRaw
    ? Math.max(100_000, Number.parseInt(vaultKdfIterationsRaw, 10) || DEFAULT_VAULT_KDF_ITERATIONS)
    : DEFAULT_VAULT_KDF_ITERATIONS;
  const keepTempOnClose = readMainEnv('DHI_VAULT_KEEP_TEMP_ON_CLOSE') === 'true';
  const syncPushIntervalRaw = readMainEnv('DHI_SYNC_PUSH_INTERVAL_MS');
  const syncPushIntervalMs = syncPushIntervalRaw
    ? Math.max(30_000, Number.parseInt(syncPushIntervalRaw, 10) || DEFAULT_SYNC_PUSH_INTERVAL_MS)
    : DEFAULT_SYNC_PUSH_INTERVAL_MS;
  const syncCronEnabledRaw = readMainEnv('DHI_SYNC_CRON_ENABLED');
  const syncCronEnabled = syncCronEnabledRaw ? syncCronEnabledRaw !== 'false' : DEFAULT_SYNC_CRON_ENABLED;
  const syncPushCronExpression =
    readMainEnv('DHI_SYNC_PUSH_CRON_EXPRESSION') ?? DEFAULT_SYNC_PUSH_CRON_EXPRESSION;
  const syncPullCronExpression =
    readMainEnv('DHI_SYNC_PULL_CRON_EXPRESSION') ?? DEFAULT_SYNC_PULL_CRON_EXPRESSION;

  if (!vaultPassword || !vaultSalt) {
    throw new Error(
      'Missing vault encryption env. Set DHI_VAULT_ARCHIVE_PASSWORD and DHI_VAULT_ARCHIVE_SALT (or MAIN_VITE_DHI_VAULT_ARCHIVE_PASSWORD and MAIN_VITE_DHI_VAULT_ARCHIVE_SALT).',
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
      specVersion: readMainEnv('DHI_VAULT_SPEC_VERSION') ?? DEFAULT_VAULT_SPEC_VERSION,
      tempZipExtension: normalizeExtension(
        readMainEnv('DHI_VAULT_TEMP_ZIP_EXT') ?? DEFAULT_VAULT_TEMP_ZIP_EXT,
      ),
      outputPrefix: readMainEnv('DHI_VAULT_OUTPUT_PREFIX') ?? DEFAULT_VAULT_OUTPUT_PREFIX,
      archivePassword: vaultPassword,
      archiveSalt: vaultSalt,
      kdfIterations: vaultKdfIterations,
      keepTempOnClose,
    },
    channels: {
      telegramChannelId: readMainEnv('DHI_TELEGRAM_CHANNEL_ID'),
      slackChannelId: readMainEnv('DHI_SLACK_CHANNEL_ID'),
      teamsChannelId: readMainEnv('DHI_TEAMS_CHANNEL_ID'),
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