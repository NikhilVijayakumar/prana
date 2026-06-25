import { useDataState, ServerResponse, HttpStatusCode } from 'astra';
import { runtimeRepository } from '../repo/runtimeRepository';
import { RuntimeIdentityState } from '../model/runtime.state';
import { IdentityAccount } from '../model/runtime.types';

export function useRuntimeIdentity() {
  const [appState, execute] = useDataState<RuntimeIdentityState>();

  const load = () =>
    execute(async () => {
      const response = await runtimeRepository.getIdentity();
      if (response.isError) {
        return ServerResponse.error<RuntimeIdentityState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<RuntimeIdentityState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { identity: response.data as IdentityAccount | null } });
    });

  const linkAccount = (provider: string, email: string) =>
    execute(async () => {
      const response = await runtimeRepository.linkAccount(provider, email);
      if (response.isError) {
        return ServerResponse.error<RuntimeIdentityState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<RuntimeIdentityState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { identity: response.data as IdentityAccount } });
    });

  return { appState, load, linkAccount };
}
