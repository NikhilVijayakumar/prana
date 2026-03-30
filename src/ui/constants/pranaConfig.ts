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

/* ------------------------------------------------------------------ */
/*  Cold-Vault Branding Context                                       */
/*  Replaces volatile window.__pranaBrandingConfig prop-drilling.      */
/*  Falls back to window global for backward compat (deprecated).      */
/* ------------------------------------------------------------------ */

import { createContext, useContext, useState, useEffect, type FC, type ReactNode } from 'react';

const BrandingContext = createContext<Partial<PranaBrandingConfig>>({});

/**
 * @deprecated Read branding from `window.__pranaBrandingConfig` is deprecated.
 * Use the `app:get-branding-config` IPC handler via the `BrandingProvider` context.
 */
const resolveWindowFallback = (): Partial<PranaBrandingConfig> => {
  if (typeof window === 'undefined') {
    return {};
  }

  const injected = (
    (window as any).__pranaBrandingConfig ?? (window as any).__pranaTestBrandingConfig
  ) as Partial<PranaBrandingConfig> | undefined;

  return injected ?? {};
};

const fetchBrandingFromIpc = async (): Promise<Partial<PranaBrandingConfig>> => {
  try {
    if (typeof window !== 'undefined' && (window as any).api?.app?.getBrandingConfig) {
      const result = await (window as any).api.app.getBrandingConfig();
      if (result && typeof result === 'object') {
        return result as Partial<PranaBrandingConfig>;
      }
    }
  } catch {
    // IPC unavailable — fall through to window global
  }

  return {};
};

const mergeBranding = (
  ipc: Partial<PranaBrandingConfig>,
  fallback: Partial<PranaBrandingConfig>,
): Partial<PranaBrandingConfig> => {
  const merged: Partial<PranaBrandingConfig> = { ...fallback };
  for (const key of Object.keys(ipc) as Array<keyof PranaBrandingConfig>) {
    const value = ipc[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      (merged as any)[key] = value;
    }
  }
  return merged;
};

export const BrandingProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<Partial<PranaBrandingConfig>>(() => resolveWindowFallback());

  useEffect(() => {
    let cancelled = false;

    void fetchBrandingFromIpc().then((ipcBranding) => {
      if (cancelled) return;
      setBranding((prev) => mergeBranding(ipcBranding, prev));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
};

export const useBranding = (): Partial<PranaBrandingConfig> => {
  return useContext(BrandingContext);
};
