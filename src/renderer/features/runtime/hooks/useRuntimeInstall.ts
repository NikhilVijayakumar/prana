import { useDataState, ServerResponse, HttpStatusCode } from 'astra';
import { useEffect } from 'react';
import { runtimeRepository } from '../repo/runtimeRepository';
import { RuntimeInstallState } from '../model/runtime.state';
import { AppRegistryRecord, InstallProgressEvent } from '../model/runtime.types';

export function useRuntimeInstall() {
  const [appState, execute, setAppState] = useDataState<RuntimeInstallState>();

  useEffect(() => {
    const unsubscribe = runtimeRepository.onInstallProgress((data) => {
      const event = data as InstallProgressEvent;
      setAppState((prev) => ({
        ...prev,
        data: prev.data
          ? { ...prev.data, progress: event.progress, phase: event.phase }
          : { installResult: null, progress: event.progress, phase: event.phase }
      }));
    });
    return unsubscribe;
  }, []);

  const install = (appId: string, name: string, version: string) =>
    execute(async () => {
      const response = await runtimeRepository.install(appId, name, version);
      if (response.isError) {
        return ServerResponse.error<RuntimeInstallState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<RuntimeInstallState>({
        status: HttpStatusCode.SUCCESS,
        statusMessage: 'OK',
        data: { installResult: response.data as AppRegistryRecord, progress: 100, phase: 'DONE' }
      });
    });

  return { appState, install };
}
