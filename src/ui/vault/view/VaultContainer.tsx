import { FC } from 'react';
import { AppStateHandler } from 'astra';
import { useVaultViewModel } from '../viewmodel/useVaultViewModel';
import { VaultView } from './VaultView';
import { PranaModuleErrorBoundary } from 'prana/ui/common/PranaModuleErrorBoundary';
import { throwPranaUiError, throwMappedPranaError } from 'prana/ui/common/errors/pranaFailFast';

export const VaultContainer: FC = () => {
  const {
    state,
    ingestFromDialog,
    approveAndPublish,
    isIngesting,
    isPublishing,
    lastIngestedCount,
    publishMessage,
    moduleError,
  } = useVaultViewModel();

  if (moduleError) {
    throwPranaUiError(moduleError);
  }

  if ((state as { isError?: boolean }).isError) {
    throwMappedPranaError({
      error: (state as { statusMessage?: string }).statusMessage ?? 'Vault state failed to load.',
      source: 'container',
      category: 'runtime',
      title: 'Vault Screen Error',
    });
  }

  return (
    <PranaModuleErrorBoundary>
      <AppStateHandler appState={state}>
        <VaultView
          files={state.data ?? []}
          onUpload={ingestFromDialog}
          onApproveAndPublish={approveAndPublish}
          isIngesting={isIngesting}
          isPublishing={isPublishing}
          lastIngestedCount={lastIngestedCount}
          publishMessage={publishMessage}
        />
      </AppStateHandler>
    </PranaModuleErrorBoundary>
  );
};
