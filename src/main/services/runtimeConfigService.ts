import { getPranaRuntimeConfig, validatePranaRuntimeConfig } from './pranaRuntimeConfig';

const DEFAULT_VAULT_SPEC_VERSION = 'v1';
const DEFAULT_VAULT_TEMP_ZIP_EXT = '.zip';
const DEFAULT_VAULT_OUTPUT_PREFIX = 'vault_export_';
const DEFAULT_SYNC_PUSH_INTERVAL_MS = 120_000;
const DEFAULT_SYNC_CRON_ENABLED = true;
const DEFAULT_SYNC_PUSH_CRON_EXPRESSION = '*/10 * * * *';
const DEFAULT_SYNC_PULL_CRON_EXPRESSION = '*/15 * * * *';

const normalizeExtension = (extension: string): string => {
  return extension.startsWith('.') ? extension : `.${extension}`;
};

export interface RuntimeIntegrationKeyStatus {
  key: string;
  expectedType: 'string' | 'number' | 'boolean';
  present: boolean;
  valid: boolean;
  source: 'config' | 'missing';
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
  errors: string[];
}

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

const getRequiredKeys = (): RuntimeIntegrationKeyStatus[] => {
  const config = getPranaRuntimeConfig();
  return [
    {
      key: 'director.name',
      expectedType: 'string',
      present: typeof config?.director?.name === 'string' && config.director.name.trim().length > 0,
      valid: typeof config?.director?.name === 'string' && config.director.name.trim().length > 0,
      source: config?.director?.name ? 'config' : 'missing',
      issue: typeof config?.director?.name === 'string' && config.director.name.trim().length > 0 ? undefined : 'missing',
    },
    {
      key: 'director.email',
      expectedType: 'string',
      present: typeof config?.director?.email === 'string' && config.director.email.trim().length > 0,
      valid: typeof config?.director?.email === 'string' && config.director.email.trim().length > 0,
      source: config?.director?.email ? 'config' : 'missing',
      issue: typeof config?.director?.email === 'string' && config.director.email.trim().length > 0 ? undefined : 'missing',
    },
    {
      key: 'vault.archivePassword',
      expectedType: 'string',
      present: typeof config?.vault?.archivePassword === 'string' && config.vault.archivePassword.trim().length > 0,
      valid: typeof config?.vault?.archivePassword === 'string' && config.vault.archivePassword.trim().length > 0,
      source: config?.vault?.archivePassword ? 'config' : 'missing',
      issue: typeof config?.vault?.archivePassword === 'string' && config.vault.archivePassword.trim().length > 0 ? undefined : 'missing',
    },
    {
      key: 'vault.archiveSalt',
      expectedType: 'string',
      present: typeof config?.vault?.archiveSalt === 'string' && config.vault.archiveSalt.trim().length > 0,
      valid: typeof config?.vault?.archiveSalt === 'string' && config.vault.archiveSalt.trim().length > 0,
      source: config?.vault?.archiveSalt ? 'config' : 'missing',
      issue: typeof config?.vault?.archiveSalt === 'string' && config.vault.archiveSalt.trim().length > 0 ? undefined : 'missing',
    },
    {
      key: 'vault.kdfIterations',
      expectedType: 'number',
      present: typeof config?.vault?.kdfIterations === 'number',
      valid: typeof config?.vault?.kdfIterations === 'number' && Number.isInteger(config.vault.kdfIterations) && config.vault.kdfIterations > 0,
      source: typeof config?.vault?.kdfIterations === 'number' ? 'config' : 'missing',
      issue:
        typeof config?.vault?.kdfIterations !== 'number'
          ? 'missing'
          : Number.isInteger(config.vault.kdfIterations) && config.vault.kdfIterations > 0
            ? undefined
            : 'invalid_number',
    },
    {
      key: 'sync.cronEnabled',
      expectedType: 'boolean',
      present: typeof config?.sync?.cronEnabled === 'boolean',
      valid: typeof config?.sync?.cronEnabled === 'boolean' || config?.sync?.cronEnabled === undefined,
      source: typeof config?.sync?.cronEnabled === 'boolean' ? 'config' : 'missing',
      issue:
        config?.sync?.cronEnabled === undefined
          ? undefined
          : typeof config.sync.cronEnabled === 'boolean'
            ? undefined
            : 'invalid_boolean',
    },
  ];
};

export const getRuntimeIntegrationStatus = (): RuntimeIntegrationStatus => {
  const keys = getRequiredKeys();
  const validation = validatePranaRuntimeConfig();
  const missing = keys.filter((entry) => !entry.present).length;
  const invalid = keys.filter((entry) => entry.present && !entry.valid).length;
  const available = keys.filter((entry) => entry.present).length;

  return {
    ready: validation.valid,
    summary: {
      total: keys.length,
      available,
      missing,
      invalid,
    },
    keys,
    errors: validation.errors,
  };
};

const assertRequiredRuntimeConfig = (): void => {
  const validation = validatePranaRuntimeConfig();
  if (!validation.valid) {
    throw new Error(`[PRANA_CONFIG_ERROR] Runtime config validation failed (${validation.errors.join('; ')}).`);
  }
};

export const getRuntimeBootstrapConfig = (): RuntimeBootstrapConfig => {
  assertRequiredRuntimeConfig();
  const config = getPranaRuntimeConfig()!;

  return {
    director: {
      name: config.director.name,
      email: config.director.email,
      password: config.director.password,
      passwordHash: config.director.passwordHash,
    },
    governance: {
      repoUrl: config.governance.repoUrl,
      repoPath: config.governance.repoPath,
    },
    vault: {
      specVersion: config.vault.specVersion ?? DEFAULT_VAULT_SPEC_VERSION,
      tempZipExtension: normalizeExtension(config.vault.tempZipExtension ?? DEFAULT_VAULT_TEMP_ZIP_EXT),
      outputPrefix: config.vault.outputPrefix ?? DEFAULT_VAULT_OUTPUT_PREFIX,
      archivePassword: config.vault.archivePassword,
      archiveSalt: config.vault.archiveSalt,
      kdfIterations: Math.max(100_000, config.vault.kdfIterations),
      keepTempOnClose: config.vault.keepTempOnClose ?? false,
    },
    channels: {
      telegramChannelId: config.channels?.telegramChannelId,
      slackChannelId: config.channels?.slackChannelId,
      teamsChannelId: config.channels?.teamsChannelId,
    },
    sync: {
      pushIntervalMs: Math.max(30_000, config.sync.pushIntervalMs ?? DEFAULT_SYNC_PUSH_INTERVAL_MS),
      cronEnabled: config.sync.cronEnabled ?? DEFAULT_SYNC_CRON_ENABLED,
      pushCronExpression: config.sync.pushCronExpression ?? DEFAULT_SYNC_PUSH_CRON_EXPRESSION,
      pullCronExpression: config.sync.pullCronExpression ?? DEFAULT_SYNC_PULL_CRON_EXPRESSION,
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
