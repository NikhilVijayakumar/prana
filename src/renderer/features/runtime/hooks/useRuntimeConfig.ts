import { useDataState, ServerResponse, HttpStatusCode } from 'astra';
import { runtimeRepository } from '../repo/runtimeRepository';
import { RuntimeConfigEntry } from '../model/runtime.types';

interface RuntimeConfigState {
  config: RuntimeConfigEntry | RuntimeConfigEntry[] | null;
}

export function useRuntimeConfig() {
  const [appState, execute] = useDataState<RuntimeConfigState>();

  const load = (key?: string) =>
    execute(async () => {
      const response = await runtimeRepository.getConfig(key);
      if (response.isError) {
        return ServerResponse.error<RuntimeConfigState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<RuntimeConfigState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { config: response.data as RuntimeConfigEntry | RuntimeConfigEntry[] | null } });
    });

  const set = (key: string, value: unknown) =>
    execute(async () => {
      const response = await runtimeRepository.setConfig(key, value);
      if (response.isError) {
        return ServerResponse.error<RuntimeConfigState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<RuntimeConfigState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { config: response.data as RuntimeConfigEntry } });
    });

  return { appState, load, set };
}
