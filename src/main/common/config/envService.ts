import { getPranaPlatformRuntime } from './pranaPlatformRuntime';

// Deprecated adapter retained to avoid immediate breakage in integrations.
// This adapter reads only host-injected runtimeVariables and never touches process/import.meta env.
export const readMainEnv = (key: string): string | undefined => {
  const value = getPranaPlatformRuntime().runtimeVariables?.[key];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const readMainEnvAlias = (neutralKey: string, legacyKey: string): string | undefined => {
  return readMainEnv(neutralKey) ?? readMainEnv(legacyKey);
};
