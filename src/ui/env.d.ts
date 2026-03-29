/// <reference types="vite/client" />

declare global {
  interface Window {
    api: any;
    __pranaBrandingConfig?: Record<string, unknown>;
    __pranaTestBrandingConfig?: Record<string, unknown>;
  }
}

export {};
