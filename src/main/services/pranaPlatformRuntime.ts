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

let platformRuntime: PranaPlatformRuntime = {};

export const setPranaPlatformRuntime = (runtime: PranaPlatformRuntime): void => {
  platformRuntime = {
    ...platformRuntime,
    ...runtime,
  };
};

export const getPranaPlatformRuntime = (): PranaPlatformRuntime => {
  return { ...platformRuntime };
};
