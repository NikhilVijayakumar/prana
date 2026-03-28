import { getGovernanceRepoPath, getGovernanceRepoUrl } from './governanceRepoService';
import { readMainEnv } from './envService';

const DEFAULT_VAULT_SPEC_VERSION = 'v1';
const DEFAULT_VAULT_TEMP_ZIP_EXT = '.zip';
const DEFAULT_VAULT_OUTPUT_PREFIX = 'vault_export_';

interface RequiredRuntimeKey {
  neutralKey: string;
  legacyKey: string;
  expectedType: 'string' | 'number' | 'boolean';
}

const REQUIRED_RUNTIME_KEYS: RequiredRuntimeKey[] = [
  { neutralKey: 'PRANA_DIRECTOR_NAME', legacyKey: 'DHI_DIRECTOR_NAME', expectedType: 'string' },
  { neutralKey: 'PRANA_DIRECTOR_EMAIL', legacyKey: 'DHI_DIRECTOR_EMAIL', expectedType: 'string' },
  { neutralKey: 'PRANA_VAULT_ARCHIVE_PASSWORD', legacyKey: 'DHI_VAULT_ARCHIVE_PASSWORD', expectedType: 'string' },
  { neutralKey: 'PRANA_VAULT_ARCHIVE_SALT', legacyKey: 'DHI_VAULT_ARCHIVE_SALT', expectedType: 'string' },
  { neutralKey: 'PRANA_VAULT_KDF_ITERATIONS', legacyKey: 'DHI_VAULT_KDF_ITERATIONS', expectedType: 'number' },
  { neutralKey: 'PRANA_SYNC_PUSH_INTERVAL_MS', legacyKey: 'DHI_SYNC_PUSH_INTERVAL_MS', expectedType: 'number' },
  { neutralKey: 'PRANA_SYNC_CRON_ENABLED', legacyKey: 'DHI_SYNC_CRON_ENABLED', expectedType: 'boolean' },
  { neutralKey: 'PRANA_SYNC_PUSH_CRON_EXPRESSION', legacyKey: 'DHI_SYNC_PUSH_CRON_EXPRESSION', expectedType: 'string' },
  { neutralKey: 'PRANA_SYNC_PULL_CRON_EXPRESSION', legacyKey: 'DHI_SYNC_PULL_CRON_EXPRESSION', expectedType: 'string' },
];

const normalizeExtension = (extension: string): string => {
  return extension.startsWith('.') ? extension : `.${extension}`;
};

const readRuntimeEnv = (neutralKey: string, legacyKey: string): string | undefined => {
  return readMainEnv(neutralKey) ?? readMainEnv(legacyKey);
};

const readRuntimeEnvWithSource = (
  neutralKey: string,
  legacyKey: string,
): { value?: string; source: 'neutral' | 'legacy' | 'missing' } => {
  const neutral = readMainEnv(neutralKey);
  if (neutral) {
    return {
      value: neutral,
      source: 'neutral',
    };
  }

  const legacy = readMainEnv(legacyKey);
  if (legacy) {
    return {
      value: legacy,
      source: 'legacy',
    };
  }

  return {
    source: 'missing',
  };
};

export interface RuntimeIntegrationKeyStatus {
  key: string;
  legacyKey: string;
  expectedType: 'string' | 'number' | 'boolean';
  present: boolean;
  valid: boolean;
  source: 'neutral' | 'legacy' | 'missing';
  issue?: 'missing' | 'invalid_number' | 'invalid_boolean';
}

export interface RuntimeIntegrationStatus {
  ready: boolean;
  summary: {
    total: number;
    available: number;
    missing: number;
    invalid: number;
  };
  keys: RuntimeIntegrationKeyStatus[];
}

const evaluateRuntimeKey = (config: RequiredRuntimeKey): RuntimeIntegrationKeyStatus => {
  const result = readRuntimeEnvWithSource(config.neutralKey, config.legacyKey);
  const present = typeof result.value === 'string';

  if (!present) {
    return {
      key: config.neutralKey,
      legacyKey: config.legacyKey,
      expectedType: config.expectedType,
      present: false,
      valid: false,
      source: 'missing',
      issue: 'missing',
    };
  }

  if (config.expectedType === 'number') {
    const parsed = Number.parseInt(result.value as string, 10);
    if (Number.isNaN(parsed)) {
      return {
        key: config.neutralKey,
        legacyKey: config.legacyKey,
        expectedType: config.expectedType,
        present: true,
        valid: false,
        source: result.source,
        issue: 'invalid_number',
      };
    }
  }

  if (config.expectedType === 'boolean') {
    const normalized = (result.value as string).trim().toLowerCase();
    if (normalized !== 'true' && normalized !== 'false') {
      return {
        key: config.neutralKey,
        legacyKey: config.legacyKey,
        expectedType: config.expectedType,
        present: true,
        valid: false,
        source: result.source,
        issue: 'invalid_boolean',
      };
    }
  }

  return {
    key: config.neutralKey,
    legacyKey: config.legacyKey,
    expectedType: config.expectedType,
    present: true,
    valid: true,
    source: result.source,
  };
};

export const getRuntimeIntegrationStatus = (): RuntimeIntegrationStatus => {
  const keys = REQUIRED_RUNTIME_KEYS.map((entry) => evaluateRuntimeKey(entry));
  const missing = keys.filter((entry) => !entry.present).length;
  const invalid = keys.filter((entry) => entry.present && !entry.valid).length;
  const available = keys.filter((entry) => entry.present).length;

  return {
    ready: missing === 0 && invalid === 0,
    summary: {
      total: keys.length,
      available,
      missing,
      invalid,
    },
    keys,
  };
};

const assertRequiredRuntimeEnv = (): void => {
  const status = getRuntimeIntegrationStatus();
  const missingKeys = status.keys
    .filter((entry) => entry.issue === 'missing')
    .map((entry) => `${entry.key} (legacy: ${entry.legacyKey})`);
  const invalidKeys = status.keys
    .filter((entry) => entry.issue === 'invalid_number' || entry.issue === 'invalid_boolean')
    .map((entry) => `${entry.key} (${entry.issue})`);

  if (missingKeys.length > 0 || invalidKeys.length > 0) {
    const parts: string[] = [];
    if (missingKeys.length > 0) {
      parts.push(`missing: ${missingKeys.join(', ')}`);
    }
    if (invalidKeys.length > 0) {
      parts.push(`invalid: ${invalidKeys.join(', ')}`);
    }

    throw new Error(
      `[PRANA_CONFIG_ERROR] Runtime env validation failed (${parts.join('; ')}). ` +
        'Prana standalone integration requires these keys to be defined before bootstrap.',
    );
  }
};

const parseRequiredNumber = (value: string, key: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`[PRANA_CONFIG_ERROR] Invalid numeric value for ${key}: "${value}"`);
  }
  return parsed;
};

const parseRequiredBoolean = (value: string, key: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  throw new Error(`[PRANA_CONFIG_ERROR] Invalid boolean value for ${key}: "${value}". Use true|false.`);
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
  assertRequiredRuntimeEnv();

  const directorName = readRuntimeEnv('PRANA_DIRECTOR_NAME', 'DHI_DIRECTOR_NAME') as string;
  const directorEmail = readRuntimeEnv('PRANA_DIRECTOR_EMAIL', 'DHI_DIRECTOR_EMAIL') as string;
  const directorPassword = readRuntimeEnv('PRANA_DIRECTOR_PASSWORD', 'DHI_DIRECTOR_PASSWORD');
  const directorPasswordHash = readRuntimeEnv('PRANA_DIRECTOR_PASSWORD_HASH', 'DHI_DIRECTOR_PASSWORD_HASH');

  const vaultPassword = readRuntimeEnv('PRANA_VAULT_ARCHIVE_PASSWORD', 'DHI_VAULT_ARCHIVE_PASSWORD') as string;
  const vaultSalt = readRuntimeEnv('PRANA_VAULT_ARCHIVE_SALT', 'DHI_VAULT_ARCHIVE_SALT') as string;
  const vaultKdfIterationsRaw = readRuntimeEnv('PRANA_VAULT_KDF_ITERATIONS', 'DHI_VAULT_KDF_ITERATIONS') as string;
  const vaultKdfIterations = Math.max(100_000, parseRequiredNumber(vaultKdfIterationsRaw, 'PRANA_VAULT_KDF_ITERATIONS'));
  const keepTempOnClose = readRuntimeEnv('PRANA_VAULT_KEEP_TEMP_ON_CLOSE', 'DHI_VAULT_KEEP_TEMP_ON_CLOSE') === 'true';
  const syncPushIntervalRaw = readRuntimeEnv('PRANA_SYNC_PUSH_INTERVAL_MS', 'DHI_SYNC_PUSH_INTERVAL_MS') as string;
  const syncPushIntervalMs = Math.max(30_000, parseRequiredNumber(syncPushIntervalRaw, 'PRANA_SYNC_PUSH_INTERVAL_MS'));
  const syncCronEnabledRaw = readRuntimeEnv('PRANA_SYNC_CRON_ENABLED', 'DHI_SYNC_CRON_ENABLED') as string;
  const syncCronEnabled = parseRequiredBoolean(syncCronEnabledRaw, 'PRANA_SYNC_CRON_ENABLED');
  const syncPushCronExpression =
    readRuntimeEnv('PRANA_SYNC_PUSH_CRON_EXPRESSION', 'DHI_SYNC_PUSH_CRON_EXPRESSION') as string;
  const syncPullCronExpression =
    readRuntimeEnv('PRANA_SYNC_PULL_CRON_EXPRESSION', 'DHI_SYNC_PULL_CRON_EXPRESSION') as string;

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
      archivePassword: vaultPassword,
      archiveSalt: vaultSalt,
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