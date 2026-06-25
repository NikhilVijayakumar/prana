import { IpcService, ServerResponse } from 'astra';
import { SyncStatusSnapshot, WorkspaceMetaRecord } from '../model/googleBridge.types';

const ipc = new IpcService();

export const googleBridgeRepository = {
  getStatus(): Promise<ServerResponse<SyncStatusSnapshot>> {
    return ipc.invoke('google-bridge:status');
  },

  listDocuments(filter?: string): Promise<ServerResponse<WorkspaceMetaRecord[]>> {
    return ipc.invoke('google-bridge:list-documents', { filter });
  },

  getDocument(fileId: string): Promise<ServerResponse<WorkspaceMetaRecord>> {
    return ipc.invoke('google-bridge:get-document', { file_id: fileId });
  },

  triggerSync(folderId?: string): Promise<ServerResponse<boolean>> {
    return ipc.invoke('google-bridge:trigger-sync', { folder_id: folderId });
  },

  authenticate(): Promise<ServerResponse<boolean>> {
    return ipc.invoke('google-bridge:authenticate');
  },

  onSyncProgress(callback: (data: unknown) => void): () => void {
    return ipc.receive('google-bridge:sync-progress', callback);
  }
};
