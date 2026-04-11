import { FC } from 'react';
// @ts-expect-error - Astra typings bug drops AppStateHandler named export
import { AppStateHandler, StateType } from 'astra';
import { useInfrastructureViewModel } from '../viewmodel/useInfrastructureViewModel';
import { InfrastructureView } from './InfrastructureView';
import { PranaModuleErrorBoundary } from 'prana/ui/common/PranaModuleErrorBoundary';
import { throwPranaUiError, throwMappedPranaError } from 'prana/ui/common/errors/pranaFailFast';

export const InfrastructureContainer: FC = () => {
  const {
    infraState,
    reload,
    moduleError,
    actionMessage,
    isGoogleActionRunning,
    runGoogleDriveSync,
    ensureGoogleDriveSyncSchedule,
    publishGooglePolicyDocument,
    pullGoogleDocumentToVault,
  } = useInfrastructureViewModel();

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
          actionMessage={actionMessage}
          isGoogleActionRunning={isGoogleActionRunning}
          onRunGoogleDriveSync={runGoogleDriveSync}
          onEnsureGoogleDriveSyncSchedule={ensureGoogleDriveSyncSchedule}
          onPublishGooglePolicyDocument={publishGooglePolicyDocument}
          onPullGoogleDocumentToVault={pullGoogleDocumentToVault}
        />
      </AppStateHandler>
    </PranaModuleErrorBoundary>
  );
};
