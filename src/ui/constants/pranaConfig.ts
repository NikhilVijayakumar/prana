export interface PranaBrandingConfig {
  appBrandName: string;
  appTitlebarTagline: string;
  appSplashSubtitle: string;
  directorSenderEmail: string;
  directorSenderName: string;
  avatarBaseUrl?: string;
}

export const findMissingBrandingFields = (
  branding: Partial<PranaBrandingConfig>,
  requiredFields: Array<keyof PranaBrandingConfig>,
): string[] => {
  return requiredFields.filter((field) => {
    const value = branding[field];
    return typeof value !== 'string' || value.trim().length === 0;
  });
};

export const assertRequiredBrandingFields = (
  screenId: string,
  branding: Partial<PranaBrandingConfig>,
  requiredFields: Array<keyof PranaBrandingConfig>,
): void => {
  const missing = findMissingBrandingFields(branding, requiredFields);
  if (missing.length > 0) {
    throw new Error(`[PRANA_BRANDING_ERROR][${screenId}] Missing required branding props: ${missing.join(', ')}`);
  }
};
