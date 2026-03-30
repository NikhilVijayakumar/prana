export interface PranaConfigValidationResult {
  valid: boolean;
  errors: string[];
  issues: PranaConfigValidationIssue[];
}

export const MIN_VAULT_KDF_ITERATIONS = 100_000;
export const MIN_SYNC_PUSH_INTERVAL_MS = 30_000;

export type PranaConfigValidationIssueCode =
  | 'missing'
  | 'invalid_string'
  | 'invalid_number'
  | 'invalid_boolean';

export interface PranaConfigValidationIssue {
  key: string;
  expectedType: 'string' | 'number' | 'boolean';
  code: PranaConfigValidationIssueCode;
}

export interface PranaRuntimeConfig {
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
    specVersion?: string;
    tempZipExtension?: string;
    outputPrefix?: string;
    archivePassword: string;
    archiveSalt: string;
    kdfIterations: number;
    keepTempOnClose?: boolean;
  };
  sync: {
    pushIntervalMs?: number;
    cronEnabled?: boolean;
    pushCronExpression?: string;
    pullCronExpression?: string;
  };
  channels?: {
    telegramChannelId?: string;
    slackChannelId?: string;
    teamsChannelId?: string;
  };
  modelGateway?: {
    fallbackOrder?: string;
    lmStudio?: { baseUrl?: string; model?: string };
    openRouter?: { baseUrl?: string; model?: string; apiKey?: string };
    gemini?: { baseUrl?: string; model?: string; apiKey?: string };
  };
  google?: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    adminEmail?: string;
  };
  skills?: {
    path?: string;
  };
  virtualDrives?: {
    enabled?: boolean;
    rcloneBinaryPath?: string;
    systemDriveLetter?: string;
    vaultDriveLetter?: string;
    systemCryptPassword?: string;
    obscuredFileNames?: boolean;
  };
  registryRoot?: string;
  branding?: {
    appBrandName?: string;
    appTitlebarTagline?: string;
    appSplashSubtitle?: string;
    directorSenderEmail?: string;
    directorSenderName?: string;
    avatarBaseUrl?: string;
  };
}

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

const hasPositiveInteger = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value > 0;

const pushIssue = (
  issues: PranaConfigValidationIssue[],
  errors: string[],
  issue: PranaConfigValidationIssue,
  message: string,
): void => {
  issues.push(issue);
  errors.push(message);
};

export const validatePranaRuntimeConfig = (config: PranaRuntimeConfig | null): PranaConfigValidationResult => {
  if (!config) {
    return {
      valid: false,
      errors: ['Runtime config is not set. Host app must call setPranaRuntimeConfig() before Prana bootstrap.'],
      issues: [
        {
          key: 'runtimeConfig',
          expectedType: 'string',
          code: 'missing',
        },
      ],
    };
  }

  const issues: PranaConfigValidationIssue[] = [];
  const errors: string[] = [];

  if (!hasText(config.director?.name)) {
    pushIssue(
      issues,
      errors,
      {
        key: 'director.name',
        expectedType: 'string',
        code: 'missing',
      },
      'Missing required runtime field: director.name',
    );
  }
  if (!hasText(config.director?.email)) {
    pushIssue(
      issues,
      errors,
      {
        key: 'director.email',
        expectedType: 'string',
        code: 'missing',
      },
      'Missing required runtime field: director.email',
    );
  }
  if (!hasText(config.governance?.repoUrl)) {
    pushIssue(
      issues,
      errors,
      {
        key: 'governance.repoUrl',
        expectedType: 'string',
        code: 'missing',
      },
      'Missing required runtime field: governance.repoUrl',
    );
  }
  if (!hasText(config.governance?.repoPath)) {
    pushIssue(
      issues,
      errors,
      {
        key: 'governance.repoPath',
        expectedType: 'string',
        code: 'missing',
      },
      'Missing required runtime field: governance.repoPath',
    );
  }
  if (!hasText(config.vault?.archivePassword)) {
    pushIssue(
      issues,
      errors,
      {
        key: 'vault.archivePassword',
        expectedType: 'string',
        code: 'missing',
      },
      'Missing required runtime field: vault.archivePassword',
    );
  }
  if (!hasText(config.vault?.archiveSalt)) {
    pushIssue(
      issues,
      errors,
      {
        key: 'vault.archiveSalt',
        expectedType: 'string',
        code: 'missing',
      },
      'Missing required runtime field: vault.archiveSalt',
    );
  }
  const vaultKdfIterations = config.vault?.kdfIterations;
  if (!hasPositiveInteger(vaultKdfIterations) || vaultKdfIterations < MIN_VAULT_KDF_ITERATIONS) {
    pushIssue(
      issues,
      errors,
      {
        key: 'vault.kdfIterations',
        expectedType: 'number',
        code: vaultKdfIterations === undefined ? 'missing' : 'invalid_number',
      },
      `Invalid required runtime field: vault.kdfIterations must be an integer >= ${MIN_VAULT_KDF_ITERATIONS}.`,
    );
  }

  const syncPushIntervalMs = config.sync?.pushIntervalMs;
  const hasValidSyncPushInterval =
    typeof syncPushIntervalMs === 'number'
    && Number.isInteger(syncPushIntervalMs)
    && syncPushIntervalMs > 0
    && syncPushIntervalMs >= MIN_SYNC_PUSH_INTERVAL_MS;
  if (!hasValidSyncPushInterval) {
    pushIssue(
      issues,
      errors,
      {
        key: 'sync.pushIntervalMs',
        expectedType: 'number',
        code: syncPushIntervalMs === undefined ? 'missing' : 'invalid_number',
      },
      `Invalid required runtime field: sync.pushIntervalMs must be an integer >= ${MIN_SYNC_PUSH_INTERVAL_MS}.`,
    );
  }

  if (typeof config.sync?.cronEnabled !== 'boolean') {
    pushIssue(
      issues,
      errors,
      {
        key: 'sync.cronEnabled',
        expectedType: 'boolean',
        code: config.sync?.cronEnabled === undefined ? 'missing' : 'invalid_boolean',
      },
      'Invalid required runtime field: sync.cronEnabled must be boolean.',
    );
  }

  if (!hasText(config.sync?.pushCronExpression)) {
    pushIssue(
      issues,
      errors,
      {
        key: 'sync.pushCronExpression',
        expectedType: 'string',
        code: config.sync?.pushCronExpression === undefined ? 'missing' : 'invalid_string',
      },
      'Invalid required runtime field: sync.pushCronExpression must be non-empty.',
    );
  }

  if (!hasText(config.sync?.pullCronExpression)) {
    pushIssue(
      issues,
      errors,
      {
        key: 'sync.pullCronExpression',
        expectedType: 'string',
        code: config.sync?.pullCronExpression === undefined ? 'missing' : 'invalid_string',
      },
      'Invalid required runtime field: sync.pullCronExpression must be non-empty.',
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    issues,
  };
};
