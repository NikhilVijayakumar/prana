import {
  validatePranaRuntimeConfig,
  type PranaConfigValidationIssue,
  type PranaRuntimeConfig,
} from './pranaRuntimeConfig';
import { sqliteConfigStoreService } from './sqliteConfigStoreService';

const DEFAULT_VAULT_SPEC_VERSION = 'v1';
const DEFAULT_VAULT_TEMP_ZIP_EXT = '.zip';
const DEFAULT_VAULT_OUTPUT_PREFIX = 'vault_export_';
const normalizeExtension = (extension: string): string => {
  return extension.startsWith('.') ? extension : `.${extension}`;
};

export interface RuntimeIntegrationKeyStatus {
  key: string;
  expectedType: 'string' | 'number' | 'boolean';
  present: boolean;
  valid: boolean;
  source: 'config' | 'missing';
  issue?: 'missing' | 'invalid_string' | 'invalid_number' | 'invalid_boolean';
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
    testBranch?: string;
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
  branding: {
    appBrandName: string;
    appTitlebarTagline: string;
    appSplashSubtitle: string;
    directorSenderEmail: string;
    directorSenderName: string;
    avatarBaseUrl: string;
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
  branding: {
    appBrandName: string;
    appTitlebarTagline: string;
    appSplashSubtitle: string;
    directorSenderEmail: string;
    directorSenderName: string;
    avatarBaseUrl: string;
  };
}

interface RequiredRuntimeKeyDescriptor {
  key: string;
  expectedType: 'string' | 'number' | 'boolean';
  readValue: (config: PranaRuntimeConfig | null) => unknown;
}

const REQUIRED_RUNTIME_KEYS: RequiredRuntimeKeyDescriptor[] = [
  {
    key: 'director.name',
    expectedType: 'string',
    readValue: (config) => config?.director?.name,
  },
  {
    key: 'director.email',
    expectedType: 'string',
    readValue: (config) => config?.director?.email,
  },
  {
    key: 'governance.repoUrl',
    expectedType: 'string',
    readValue: (config) => config?.governance?.repoUrl,
  },
  {
    key: 'governance.repoPath',
    expectedType: 'string',
    readValue: (config) => config?.governance?.repoPath,
  },
  {
    key: 'vault.archivePassword',
    expectedType: 'string',
    readValue: (config) => config?.vault?.archivePassword,
  },
  {
    key: 'vault.archiveSalt',
    expectedType: 'string',
    readValue: (config) => config?.vault?.archiveSalt,
  },
  {
    key: 'vault.kdfIterations',
    expectedType: 'number',
    readValue: (config) => config?.vault?.kdfIterations,
  },
  {
    key: 'sync.pushIntervalMs',
    expectedType: 'number',
    readValue: (config) => config?.sync?.pushIntervalMs,
  },
  {
    key: 'sync.cronEnabled',
    expectedType: 'boolean',
    readValue: (config) => config?.sync?.cronEnabled,
  },
  {
    key: 'sync.pushCronExpression',
    expectedType: 'string',
    readValue: (config) => config?.sync?.pushCronExpression,
  },
  {
    key: 'sync.pullCronExpression',
    expectedType: 'string',
    readValue: (config) => config?.sync?.pullCronExpression,
  },
];

const isPresentByType = (value: unknown, expectedType: RuntimeIntegrationKeyStatus['expectedType']): boolean => {
  if (expectedType === 'string') {
    return typeof value === 'string' && value.trim().length > 0;
  }

  return typeof value === expectedType;
};

const getRequiredKeys = (issues: PranaConfigValidationIssue[]): RuntimeIntegrationKeyStatus[] => {
  const config = sqliteConfigStoreService.readSnapshotSync()?.config ?? null;
  const issueByKey = new Map(issues.map((issue) => [issue.key, issue]));

  return REQUIRED_RUNTIME_KEYS.map((descriptor) => {
    const value = descriptor.readValue(config);
    const issue = issueByKey.get(descriptor.key);
    const present = isPresentByType(value, descriptor.expectedType);

    return {
      key: descriptor.key,
      expectedType: descriptor.expectedType,
      present,
      valid: issue === undefined,
      source: present ? 'config' : 'missing',
      issue: issue?.code,
    };
  });
};

const assertValidBootstrapConfig = (config: PranaRuntimeConfig | null): PranaRuntimeConfig => {
  const validation = validatePranaRuntimeConfig(config);
  if (!validation.valid) {
    throw new Error(`[PRANA_CONFIG_ERROR] ${validation.errors.join('; ')}`);
  }

  return config as PranaRuntimeConfig;
};

export const getRuntimeIntegrationStatus = (): RuntimeIntegrationStatus => {
  const config = sqliteConfigStoreService.readSnapshotSync()?.config ?? null;
  const validation = validatePranaRuntimeConfig(config);
  const keys = getRequiredKeys(validation.issues);
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

export const getRuntimeBootstrapConfig = (): RuntimeBootstrapConfig => {
  const rawConfig = assertValidBootstrapConfig(sqliteConfigStoreService.readSnapshotSync()?.config ?? null);
  const director = rawConfig?.director || {} as any;
  const governance = rawConfig?.governance || {} as any;
  const vault = rawConfig?.vault || {} as any;
  const sync = rawConfig?.sync || {} as any;
  const channels = rawConfig?.channels || {};

  return {
    director: {
      name: director.name || 'Prana User',
      email: director.email || 'user@prana.local',
      password: director.password,
      passwordHash: director.passwordHash,
    },
    governance: {
      repoUrl: governance.repoUrl || '',
      repoPath: governance.repoPath || '',
      testBranch: governance.testBranch || undefined,
    },
    vault: {
      specVersion: vault.specVersion ?? DEFAULT_VAULT_SPEC_VERSION,
      tempZipExtension: normalizeExtension(vault.tempZipExtension ?? DEFAULT_VAULT_TEMP_ZIP_EXT),
      outputPrefix: vault.outputPrefix ?? DEFAULT_VAULT_OUTPUT_PREFIX,
      archivePassword: vault.archivePassword || '',
      archiveSalt: vault.archiveSalt || '',
      kdfIterations: vault.kdfIterations || 100000,
      keepTempOnClose: vault.keepTempOnClose ?? false,
    },
    channels: {
      telegramChannelId: channels.telegramChannelId,
      slackChannelId: channels.slackChannelId,
      teamsChannelId: channels.teamsChannelId,
    },
    sync: {
      pushIntervalMs: sync.pushIntervalMs || 60000,
      cronEnabled: sync.cronEnabled ?? false,
      pushCronExpression: sync.pushCronExpression || '*/5 * * * *',
      pullCronExpression: sync.pullCronExpression || '*/5 * * * *',
    },
    branding: {
      appBrandName: rawConfig?.branding?.appBrandName || '',
      appTitlebarTagline: rawConfig?.branding?.appTitlebarTagline || '',
      appSplashSubtitle: rawConfig?.branding?.appSplashSubtitle || '',
      directorSenderEmail: rawConfig?.branding?.directorSenderEmail || '',
      directorSenderName: rawConfig?.branding?.directorSenderName || '',
      avatarBaseUrl: rawConfig?.branding?.avatarBaseUrl || '',
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
    branding: config.branding,
  };
};
