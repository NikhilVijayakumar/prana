import { FC } from 'react';
import { AppStateHandler, StateType } from 'astra';
import { useVaultKnowledgeViewModel } from '../viewmodel/useVaultKnowledgeViewModel';
import { VaultKnowledgeView } from './VaultKnowledgeView';
import { PranaModuleErrorBoundary } from 'prana/ui/common/PranaModuleErrorBoundary';
import { throwPranaUiError, throwMappedPranaError } from 'prana/ui/common/errors/pranaFailFast';

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
    moduleError,
  } = useVaultKnowledgeViewModel();

  if (moduleError) {
    throwPranaUiError(moduleError);
  }

  if ((vaultState as { isError?: boolean }).isError) {
    throwMappedPranaError({
      error: (vaultState as { statusMessage?: string }).statusMessage ?? 'Vault knowledge state failed to load.',
      source: 'container',
      category: 'runtime',
      title: 'Vault Knowledge Screen Error',
    });
  }

  return (
    <PranaModuleErrorBoundary>
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
    </PranaModuleErrorBoundary>
  );
};
