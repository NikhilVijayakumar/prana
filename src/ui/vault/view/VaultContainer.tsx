import { FC } from 'react';
import { AppStateHandler } from 'astra';
import { useVaultViewModel } from '../viewmodel/useVaultViewModel';
import { VaultView } from './VaultView';

export const VaultContainer: FC = () => {
  const {
    state,
    ingestFromDialog,
    approveAndPublish,
    isIngesting,
    isPublishing,
    lastIngestedCount,
    publishMessage,
  } = useVaultViewModel();

  return (
    <AppStateHandler appState={state}>
      <VaultView
        files={state.data}
        onUpload={ingestFromDialog}
        onApproveAndPublish={approveAndPublish}
        isIngesting={isIngesting}
        isPublishing={isPublishing}
        lastIngestedCount={lastIngestedCount}
        publishMessage={publishMessage}
      />
    </AppStateHandler>
  );
};
