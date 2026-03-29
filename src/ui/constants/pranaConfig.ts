export interface PranaBrandingConfig {
  appBrandName: string;
  appTitlebarTagline: string;
  appSplashSubtitle: string;
  directorSenderEmail: string;
  directorSenderName: string;
  avatarBaseUrl?: string;
}

export interface PranaConfigValidationResult {
  valid: boolean;
  errors: string[];
}

let brandingConfig: Partial<PranaBrandingConfig> = {};

export const setPranaBrandingConfig = (config: Partial<PranaBrandingConfig>): void => {
  brandingConfig = {
    ...brandingConfig,
    ...config,
  };
};

export const getPranaBranding = (): Partial<PranaBrandingConfig> => {
  return { ...brandingConfig };
};

const REQUIRED_FIELDS: Array<keyof Omit<PranaBrandingConfig, 'avatarBaseUrl'>> = [
  'appBrandName',
  'appTitlebarTagline',
  'appSplashSubtitle',
  'directorSenderEmail',
  'directorSenderName',
];

export const validatePranaBranding = (): PranaConfigValidationResult => {
  const current = getPranaBranding();
  const errors = REQUIRED_FIELDS.flatMap((field) => {
    const value = current[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      return [`Missing required branding field: ${field}`];
    }

    return [];
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};
