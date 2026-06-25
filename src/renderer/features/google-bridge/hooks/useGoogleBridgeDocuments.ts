import { useDataState, ServerResponse, HttpStatusCode } from 'astra';
import { googleBridgeRepository } from '../repo/googleBridgeRepository';
import { GoogleBridgeDocumentsState } from '../model/googleBridge.state';
import { WorkspaceMetaRecord } from '../model/googleBridge.types';

export function useGoogleBridgeDocuments() {
  const [appState, execute] = useDataState<GoogleBridgeDocumentsState>();

  const load = (filter?: string) =>
    execute(async () => {
      const response = await googleBridgeRepository.listDocuments(filter);
      if (response.isError) {
        return ServerResponse.error<GoogleBridgeDocumentsState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<GoogleBridgeDocumentsState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { documents: (response.data ?? []) as WorkspaceMetaRecord[] } });
    });

  return { appState, load };
}
