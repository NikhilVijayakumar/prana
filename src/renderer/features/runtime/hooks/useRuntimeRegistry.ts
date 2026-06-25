import { useDataState, ServerResponse, HttpStatusCode } from 'astra';
import { runtimeRepository } from '../repo/runtimeRepository';
import { RuntimeRegistryState } from '../model/runtime.state';
import { AppRegistryRecord } from '../model/runtime.types';

export function useRuntimeRegistry() {
  const [appState, execute] = useDataState<RuntimeRegistryState>();

  const load = () =>
    execute(async () => {
      const response = await runtimeRepository.listApplications();
      if (response.isError) {
        return ServerResponse.error<RuntimeRegistryState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<RuntimeRegistryState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { applications: (response.data ?? []) as AppRegistryRecord[] } });
    });

  const launch = (appId: string) =>
    execute(async () => {
      const launchResponse = await runtimeRepository.launch(appId);
      if (launchResponse.isError) {
        return ServerResponse.error<RuntimeRegistryState>({ status: launchResponse.status, statusMessage: launchResponse.statusMessage });
      }
      const response = await runtimeRepository.listApplications();
      if (response.isError) {
        return ServerResponse.error<RuntimeRegistryState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<RuntimeRegistryState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { applications: (response.data ?? []) as AppRegistryRecord[] } });
    });

  const stop = (appId: string) =>
    execute(async () => {
      const stopResponse = await runtimeRepository.stop(appId);
      if (stopResponse.isError) {
        return ServerResponse.error<RuntimeRegistryState>({ status: stopResponse.status, statusMessage: stopResponse.statusMessage });
      }
      const response = await runtimeRepository.listApplications();
      if (response.isError) {
        return ServerResponse.error<RuntimeRegistryState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<RuntimeRegistryState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { applications: (response.data ?? []) as AppRegistryRecord[] } });
    });

  return { appState, load, launch, stop };
}
