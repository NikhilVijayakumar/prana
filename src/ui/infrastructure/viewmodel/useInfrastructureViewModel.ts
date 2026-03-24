import { useEffect } from 'react';
import { useDataState } from 'astra';
import { InfrastructureRepo, InfrastructurePayload } from '../repo/InfrastructureRepo';

export const useInfrastructureViewModel = () => {
  const repo = new InfrastructureRepo();
  const [infraState, executeLoad] = useDataState<InfrastructurePayload>();

  useEffect(() => {
    executeLoad(() => repo.getSystemHealth());
  }, []);

  return {
    infraState,
    reload: () => executeLoad(() => repo.getSystemHealth())
  };
};
