import { SyncStatusSnapshot, WorkspaceMetaRecord } from './googleBridge.types';

export interface GoogleBridgeStatusState {
  status: SyncStatusSnapshot;
}

export interface GoogleBridgeDocumentsState {
  documents: WorkspaceMetaRecord[];
}
