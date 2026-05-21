export interface PranaPlatformRuntime {
  rendererUrl?: string;
  mode?: 'development' | 'production' | 'test';
  homeDir?: string;
  userProfileDir?: string;
  path?: string;
  gitSshCommand?: string;
  inheritedEnv?: Record<string, string>;
  runtimeVariables?: Record<string, string>;
}

/**
 * Factory function to create a prana platform runtime manager.
 * Eliminates module-level state.
 */
export const createPranaPlatformRuntime = () => {
  // Instance-level state (not module-level)
  let platformRuntime: PranaPlatformRuntime = {};

  return {
    set(runtime: PranaPlatformRuntime): void {
      platformRuntime = {
        ...platformRuntime,
        ...runtime,
      };
    },

    get(): PranaPlatformRuntime {
      return { ...platformRuntime };
    },

    update(partial: Partial<PranaPlatformRuntime>): void {
      platformRuntime = {
        ...platformRuntime,
        ...partial,
      };
    },

    __resetForTesting(): void {
      platformRuntime = {};
    },
  };
};

// Backward compatibility - creates a default instance and exports convenience functions
const defaultRuntime = createPranaPlatformRuntime();

export const setPranaPlatformRuntime = (runtime: PranaPlatformRuntime): void => {
  defaultRuntime.set(runtime);
};

export const getPranaPlatformRuntime = (): PranaPlatformRuntime => {
  return defaultRuntime.get();
};

// Export the default instance for direct use
export const pranaPlatformRuntime = defaultRuntime;
