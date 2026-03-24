/**
 * Module Manifest Bridge
 *
 * Provides a decoupled way for Astra to access module manifests
 * without importing from @renderer. The renderer entry point registers
 * the manifest provider at startup via `setManifestProvider`.
 */

export interface ModuleManifest {
  id: string;
  title: string;
  enabled: boolean;
  ownership: string;
  route?: string | null;
}

type ManifestProvider = () => ModuleManifest[];

let _provider: ManifestProvider = () => [];

/**
 * Register the manifest provider at app startup.
 * This should be called once from the renderer entry point.
 */
export const setManifestProvider = (provider: ManifestProvider): void => {
  _provider = provider;
};

/**
 * List all registered module manifests.
 * Returns an empty list if no provider has been registered.
 */
export const listModuleManifests = (): ModuleManifest[] => {
  return _provider();
};
