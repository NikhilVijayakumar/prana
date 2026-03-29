import { FC } from 'react';
import { AppStateHandler, StateType } from 'astra';
import { useInfrastructureViewModel } from '../viewmodel/useInfrastructureViewModel';
import { InfrastructureView } from './InfrastructureView';
import { PranaModuleErrorBoundary } from 'prana/ui/common/PranaModuleErrorBoundary';
import { throwPranaUiError, throwMappedPranaError } from 'prana/ui/common/errors/pranaFailFast';

export const InfrastructureContainer: FC = () => {
  const { infraState, reload, moduleError } = useInfrastructureViewModel();

  if (moduleError) {
    throwPranaUiError(moduleError);
  }

  if ((infraState as { isError?: boolean }).isError) {
    throwMappedPranaError({
      error: (infraState as { statusMessage?: string }).statusMessage ?? 'Infrastructure state failed to load.',
      source: 'container',
      category: 'runtime',
      title: 'Infrastructure Screen Error',
    });
  }

  return (
    <PranaModuleErrorBoundary>
      <AppStateHandler appState={infraState}>
        <InfrastructureView 
          payload={infraState.data || null}
          isLoading={infraState.state === StateType.LOADING}
          onRefresh={reload}
        />
      </AppStateHandler>
    </PranaModuleErrorBoundary>
  );
};
