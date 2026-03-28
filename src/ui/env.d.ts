/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_BRAND_NAME: string;
  readonly VITE_APP_TITLEBAR_TAGLINE: string;
  readonly VITE_APP_SPLASH_SUBTITLE: string;
  readonly VITE_DIRECTOR_SENDER_EMAIL: string;
  readonly VITE_DIRECTOR_SENDER_NAME: string;
}

declare global {
  interface Window {
    api: any;
  }
}

export {};
