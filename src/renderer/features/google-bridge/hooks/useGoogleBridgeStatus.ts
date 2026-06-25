import { useDataState, ServerResponse, HttpStatusCode } from 'astra';
import { googleBridgeRepository } from '../repo/googleBridgeRepository';
import { GoogleBridgeStatusState } from '../model/googleBridge.state';
import { SyncStatusSnapshot } from '../model/googleBridge.types';

export function useGoogleBridgeStatus() {
  const [appState, execute] = useDataState<GoogleBridgeStatusState>();

  const load = () =>
    execute(async () => {
      const response = await googleBridgeRepository.getStatus();
      if (response.isError) {
        return ServerResponse.error<GoogleBridgeStatusState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<GoogleBridgeStatusState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { status: response.data as SyncStatusSnapshot } });
    });

  const authenticate = () =>
    execute(async () => {
      const authResponse = await googleBridgeRepository.authenticate();
      if (authResponse.isError) {
        return ServerResponse.error<GoogleBridgeStatusState>({ status: authResponse.status, statusMessage: authResponse.statusMessage });
      }
      const response = await googleBridgeRepository.getStatus();
      if (response.isError) {
        return ServerResponse.error<GoogleBridgeStatusState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<GoogleBridgeStatusState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { status: response.data as SyncStatusSnapshot } });
    });

  const triggerSync = () =>
    execute(async () => {
      const syncResponse = await googleBridgeRepository.triggerSync();
      if (syncResponse.isError) {
        return ServerResponse.error<GoogleBridgeStatusState>({ status: syncResponse.status, statusMessage: syncResponse.statusMessage });
      }
      const response = await googleBridgeRepository.getStatus();
      if (response.isError) {
        return ServerResponse.error<GoogleBridgeStatusState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<GoogleBridgeStatusState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { status: response.data as SyncStatusSnapshot } });
    });

  return { appState, load, authenticate, triggerSync };
}
