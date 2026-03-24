import { FC } from 'react';
import { AppStateHandler, StateType } from 'astra';
import { useVaultKnowledgeViewModel } from '../viewmodel/useVaultKnowledgeViewModel';
import { VaultKnowledgeView } from './VaultKnowledgeView';

export const VaultKnowledgeContainer: FC = () => {
  const {
    vaultState,
    previewState,
    memoryState,
    memoryHealthState,
    reload,
    previewFile,
    approvePending,
    rejectPending,
    searchMemory,
    reindexMemory,
    memoryQuery,
    setMemoryQuery,
    selectedPath,
    isApplyingAction,
    isReindexingMemory,
  } = useVaultKnowledgeViewModel();

  return (
    <AppStateHandler appState={vaultState}>
      <VaultKnowledgeView 
        payload={vaultState.data || null}
        preview={previewState.data || null}
        isLoading={vaultState.state === StateType.LOADING}
        isPreviewLoading={previewState.state === StateType.LOADING}
        memoryResults={memoryState.data || null}
        memoryHealth={memoryHealthState.data || null}
        isMemorySearching={memoryState.state === StateType.LOADING}
        memoryQuery={memoryQuery}
        selectedPath={selectedPath}
        isApplyingAction={isApplyingAction}
        isReindexingMemory={isReindexingMemory}
        onRefresh={reload}
        onPreviewFile={previewFile}
        onApprovePending={approvePending}
        onRejectPending={rejectPending}
        onSearchMemory={searchMemory}
        onMemoryQueryChange={setMemoryQuery}
        onReindexMemory={reindexMemory}
      />
    </AppStateHandler>
  );
};
