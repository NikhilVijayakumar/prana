import { FC } from 'react';
import { AppStateHandler, StateType } from 'astra';
import { useInfrastructureViewModel } from '../viewmodel/useInfrastructureViewModel';
import { InfrastructureView } from './InfrastructureView';

export const InfrastructureContainer: FC = () => {
  const { infraState, reload } = useInfrastructureViewModel();

  return (
    <AppStateHandler appState={infraState}>
      <InfrastructureView 
        payload={infraState.data || null}
        isLoading={infraState.state === StateType.LOADING}
        onRefresh={reload}
      />
    </AppStateHandler>
  );
};
