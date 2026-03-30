/// <reference types="vite/client" />

declare global {
  interface Window {
    api: any;
    /** @deprecated Use `branding` in `app:bootstrap-host` config payload instead. Will be removed in a future release. */
    __pranaBrandingConfig?: Record<string, unknown>;
    /** @deprecated Test-only fallback. Will be removed in a future release. */
    __pranaTestBrandingConfig?: Record<string, unknown>;
  }
}

export {};
