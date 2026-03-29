export interface PranaConfigValidationResult {
  valid: boolean;
  errors: string[];
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
  registryRoot?: string;
}

let runtimeConfig: PranaRuntimeConfig | null = null;

export const setPranaRuntimeConfig = (config: PranaRuntimeConfig): void => {
  runtimeConfig = config;
};

export const getPranaRuntimeConfig = (): PranaRuntimeConfig | null => {
  return runtimeConfig;
};

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

const hasPositiveInteger = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value > 0;

export const validatePranaRuntimeConfig = (): PranaConfigValidationResult => {
  const config = getPranaRuntimeConfig();
  if (!config) {
    return {
      valid: false,
      errors: ['Runtime config is not set. Host app must call setPranaRuntimeConfig() before Prana bootstrap.'],
    };
  }

  const errors: string[] = [];

  if (!hasText(config.director?.name)) {
    errors.push('Missing required runtime field: director.name');
  }
  if (!hasText(config.director?.email)) {
    errors.push('Missing required runtime field: director.email');
  }
  if (!hasText(config.governance?.repoUrl)) {
    errors.push('Missing required runtime field: governance.repoUrl');
  }
  if (!hasText(config.governance?.repoPath)) {
    errors.push('Missing required runtime field: governance.repoPath');
  }
  if (!hasText(config.vault?.archivePassword)) {
    errors.push('Missing required runtime field: vault.archivePassword');
  }
  if (!hasText(config.vault?.archiveSalt)) {
    errors.push('Missing required runtime field: vault.archiveSalt');
  }
  if (!hasPositiveInteger(config.vault?.kdfIterations)) {
    errors.push('Invalid required runtime field: vault.kdfIterations must be a positive integer.');
  }

  if (config.sync?.pushIntervalMs !== undefined && !hasPositiveInteger(config.sync.pushIntervalMs)) {
    errors.push('Invalid runtime field: sync.pushIntervalMs must be a positive integer when provided.');
  }

  if (config.sync?.cronEnabled !== undefined && typeof config.sync.cronEnabled !== 'boolean') {
    errors.push('Invalid runtime field: sync.cronEnabled must be boolean when provided.');
  }

  if (config.sync?.pushCronExpression !== undefined && !hasText(config.sync.pushCronExpression)) {
    errors.push('Invalid runtime field: sync.pushCronExpression must be non-empty when provided.');
  }

  if (config.sync?.pullCronExpression !== undefined && !hasText(config.sync.pullCronExpression)) {
    errors.push('Invalid runtime field: sync.pullCronExpression must be non-empty when provided.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
