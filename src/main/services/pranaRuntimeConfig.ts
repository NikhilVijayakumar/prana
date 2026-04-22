import { z } from 'zod';

export const MIN_VAULT_KDF_ITERATIONS = 100_000;
export const MIN_SYNC_PUSH_INTERVAL_MS = 30_000;

const PranaRuntimeConfigSchema = z.object({
  director: z.object({
    name: z.string().min(1, { message: 'Missing required runtime field: director.name' }),
    email: z.string().email({ message: 'Missing required runtime field: director.email' }),
    password: z.string().optional(),
    passwordHash: z.string().optional(),
  }),
  governance: z.object({
    repoUrl: z.string().min(1, { message: 'Missing required runtime field: governance.repoUrl' }),
    repoPath: z.string().min(1, { message: 'Missing required runtime field: governance.repoPath' }),
    testBranch: z.string().optional(),
  }),
  vault: z.object({
    specVersion: z.string().optional(),
    tempZipExtension: z.string().optional(),
    outputPrefix: z.string().optional(),
    appKey: z.string().optional(),
    archivePassword: z.string().min(1, { message: 'Missing required runtime field: vault.archivePassword' }),
    archiveSalt: z.string().min(1, { message: 'Missing required runtime field: vault.archiveSalt' }),
    kdfIterations: z.number().int().min(MIN_VAULT_KDF_ITERATIONS, { message: `Invalid required runtime field: vault.kdfIterations must be an integer >= ${MIN_VAULT_KDF_ITERATIONS}.` }),
    keepTempOnClose: z.boolean().optional(),
  }),
  sync: z.object({
    pushIntervalMs: z.number().int().min(MIN_SYNC_PUSH_INTERVAL_MS, { message: `Invalid required runtime field: sync.pushIntervalMs must be an integer >= ${MIN_SYNC_PUSH_INTERVAL_MS}.` }),
    cronEnabled: z.boolean({ invalid_type_error: 'Invalid required runtime field: sync.cronEnabled must be boolean.', required_error: 'Invalid required runtime field: sync.cronEnabled must be boolean.' } as any),
    pushCronExpression: z.string().min(1, { message: 'Invalid required runtime field: sync.pushCronExpression must be non-empty.' }),
    pullCronExpression: z.string().min(1, { message: 'Invalid required runtime field: sync.pullCronExpression must be non-empty.' }),
  }),
  channels: z.object({
    telegramChannelId: z.string().optional(),
    slackChannelId: z.string().optional(),
    teamsChannelId: z.string().optional(),
  }).optional(),
  modelGateway: z.object({
    fallbackOrder: z.string().optional(),
    lmStudio: z.object({ baseUrl: z.string().optional(), model: z.string().optional() }).optional(),
    openRouter: z.object({ baseUrl: z.string().optional(), model: z.string().optional(), apiKey: z.string().optional() }).optional(),
    gemini: z.object({ baseUrl: z.string().optional(), model: z.string().optional(), apiKey: z.string().optional() }).optional(),
  }).optional(),
  google: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    refreshToken: z.string().optional(),
    adminEmail: z.string().optional(),
  }).optional(),
  skills: z.object({
    path: z.string().optional(),
  }).optional(),
  virtualDrives: z.object({
    enabled: z.boolean().optional(),
    rcloneBinaryPath: z.string().optional(),
    systemDriveLetter: z.string().optional(),
    vaultDriveLetter: z.string().optional(),
    systemCryptPassword: z.string().optional(),
    obscuredFileNames: z.boolean().optional(),
    failClosed: z.boolean().optional(),
    provider: z.object({
      type: z.string().optional(),
      rcloneBinaryPath: z.string().optional(),
    }).optional(),
    system: z.object({
      mountPoint: z.string().optional(),
      sourceSubpath: z.string().optional(),
      fallbackSubpath: z.string().optional(),
      remoteName: z.string().optional(),
      cryptPassword: z.string().optional(),
      allowFallback: z.boolean().optional(),
    }).optional(),
    vault: z.object({
      mountPoint: z.string().optional(),
      sourceSubpath: z.string().optional(),
      remoteName: z.string().optional(),
      cryptPassword: z.string().optional(),
      requireSessionMount: z.boolean().optional(),
    }).optional(),
  }).optional(),
  storage: z.object({
    cacheLocation: z.enum(['local', 'drive']).optional(),
  }).optional(),
  registryRoot: z.string().optional(),
  branding: z.object({
    appBrandName: z.string().optional(),
    appTitlebarTagline: z.string().optional(),
    appSplashSubtitle: z.string().optional(),
    directorSenderEmail: z.string().optional(),
    directorSenderName: z.string().optional(),
    avatarBaseUrl: z.string().optional(),
  }).optional(),
});

export type PranaRuntimeConfig = z.infer<typeof PranaRuntimeConfigSchema>;

export interface PranaConfigValidationResult {
  valid: boolean;
  errors: string[];
  issues: PranaConfigValidationIssue[];
}

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

const mapZodErrorToIssues = (zodError: z.ZodError): PranaConfigValidationIssue[] => {
  return zodError.issues.map(issue => {
    let expectedType: 'string' | 'number' | 'boolean' = 'string';
    let code: PranaConfigValidationIssueCode = 'missing';

    if (issue.code === 'invalid_type') {
      // Zod v3 provides 'received' as a string; Zod v4 may omit it entirely
      const received = (issue as any).received;
      const isMissing = received === 'undefined' || received === undefined;
      if (issue.expected === 'string') {
        expectedType = 'string';
        code = isMissing ? 'missing' : 'invalid_string';
      } else if (issue.expected === 'number') {
        expectedType = 'number';
        code = isMissing ? 'missing' : 'invalid_number';
      } else if (issue.expected === 'boolean') {
        expectedType = 'boolean';
        code = isMissing ? 'missing' : 'invalid_boolean';
      }
    } else if (issue.code === 'too_small') {
      // Zod v3 uses 'type', Zod v4 uses 'origin'
      const typeStr = (issue as any).origin ?? (issue as any).type;
      if (typeStr === 'string') {
          expectedType = 'string';
          code = 'invalid_string';
      }
      if (typeStr === 'number') {
          expectedType = 'number';
          code = 'invalid_number';
      }
    }

    return {
      key: issue.path.join('.'),
      expectedType,
      code,
    };
  });
};

export const validatePranaRuntimeConfig = (config: PranaRuntimeConfig | null): PranaConfigValidationResult => {
  if (!config) {
    return {
      valid: false,
      errors: ['Runtime config is not set. Host app must provide bootstrap config before calling app:bootstrap-host.'],
      issues: [
        {
          key: 'runtimeConfig',
          expectedType: 'string',
          code: 'missing',
        },
      ],
    };
  }

  const result = PranaRuntimeConfigSchema.safeParse(config);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(i => i.message),
      issues: mapZodErrorToIssues(result.error),
    };
  }

  return {
    valid: true,
    errors: [],
    issues: [],
  };
};

let runtimeConfigOverride: PranaRuntimeConfig | null = null;

export const setPranaRuntimeConfig = (config: PranaRuntimeConfig | null): void => {
  runtimeConfigOverride = config;
};

export const getPranaRuntimeConfig = (): PranaRuntimeConfig | null => {
  return runtimeConfigOverride;
};
