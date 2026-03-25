const normalizeEnvValue = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

export const APP_BRAND_NAME = normalizeEnvValue(import.meta.env.VITE_APP_BRAND_NAME, 'Prana Workspace');

export const APP_TITLEBAR_TAGLINE = normalizeEnvValue(
  import.meta.env.VITE_APP_TITLEBAR_TAGLINE,
  'Instruments powered by Prana Engine',
);

export const APP_SPLASH_SUBTITLE = normalizeEnvValue(
  import.meta.env.VITE_APP_SPLASH_SUBTITLE,
  'Booting instruments powered by Prana Engine...',
);

export const DIRECTOR_SENDER_EMAIL = normalizeEnvValue(
  import.meta.env.VITE_DIRECTOR_SENDER_EMAIL,
  'director@prana.local',
);

export const DIRECTOR_SENDER_NAME = normalizeEnvValue(import.meta.env.VITE_DIRECTOR_SENDER_NAME, 'Director');
