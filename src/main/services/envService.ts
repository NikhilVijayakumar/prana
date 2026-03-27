import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

/* ------------------------------------------------------------------ */
/*  Runtime .env loader                                                */
/*  electron-vite only does STATIC replacement of import.meta.env.*    */
/*  at build time. Dynamic key access (meta.env?.[key]) compiles to    */
/*  undefined. We therefore load .env into process.env at runtime.     */
/* ------------------------------------------------------------------ */

let dotEnvLoaded = false;

const loadDotEnv = (): void => {
  if (dotEnvLoaded) return;
  dotEnvLoaded = true;

  // Candidate locations for the .env file
  const candidates: string[] = [
    resolve('.env'),                                  // CWD (typical for dev)
    join(dirname(process.execPath), '.env'),          // next to the Electron binary
  ];

  // When running inside electron-vite dev, __dirname is out/main
  // The project root .env is two levels up.
  try {
    candidates.push(resolve(__dirname, '..', '..', '.env'));
  } catch {
    // __dirname may not exist in some exotic bundling scenarios – ignore
  }

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;

    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex < 0) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();

      // Only set if not already present (real env takes precedence)
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
    console.log('[PRANA] Loaded .env from:', envPath);
    return; // stop after the first file found
  }

  console.warn('[PRANA] No .env file found in candidates:', candidates);
};

// Load .env as soon as this module is imported
loadDotEnv();

/* ------------------------------------------------------------------ */

interface MainImportMeta {
  env?: Record<string, string | number | boolean | undefined>;
}

const readImportMetaEnv = (key: string): string | undefined => {
  const meta = import.meta as unknown as MainImportMeta;
  const value = meta.env?.[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
};

const normalizeValue = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const readMainEnv = (key: string): string | undefined => {
  // Priority: direct key in process.env -> MAIN_VITE_ prefixed key in process.env -> Vite injected
  const direct = normalizeValue(process.env[key]);
  if (direct) {
    return direct;
  }

  const prefixedKey = `MAIN_VITE_${key}`;
  const prefixed = normalizeValue(process.env[prefixedKey]);
  if (prefixed) {
    return prefixed;
  }

  const prefixedVite = normalizeValue(readImportMetaEnv(prefixedKey));
  if (prefixedVite) {
    return prefixedVite;
  }

  return normalizeValue(readImportMetaEnv(key));
};

export const readMainEnvAlias = (neutralKey: string, legacyKey: string): string | undefined => {
  return readMainEnv(neutralKey) ?? readMainEnv(legacyKey);
};
