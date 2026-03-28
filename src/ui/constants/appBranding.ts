const requireRendererEnv = (key: keyof ImportMetaEnv): string => {
  const value = import.meta.env[key];
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(
      `[PRANA_CONFIG_ERROR] Missing required renderer env key: ${key}. ` +
        'Define all required VITE_* branding keys before loading Prana UI.',
    );
  }

  return trimmed;
};

export const APP_BRAND_NAME = requireRendererEnv('VITE_APP_BRAND_NAME');

export const APP_TITLEBAR_TAGLINE = requireRendererEnv('VITE_APP_TITLEBAR_TAGLINE');

export const APP_SPLASH_SUBTITLE = requireRendererEnv('VITE_APP_SPLASH_SUBTITLE');

export const DIRECTOR_SENDER_EMAIL = requireRendererEnv('VITE_DIRECTOR_SENDER_EMAIL');

export const DIRECTOR_SENDER_NAME = requireRendererEnv('VITE_DIRECTOR_SENDER_NAME');
