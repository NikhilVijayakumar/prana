import { useEffect } from 'react';
import { useDataState } from 'astra';
import { InfrastructureRepo, InfrastructurePayload } from '../repo/InfrastructureRepo';
import { useFailFastAsync } from 'prana/ui/common/errors/useFailFastAsync';

export const useInfrastructureViewModel = () => {
  const repo = new InfrastructureRepo();
  const [infraState, executeLoad] = useDataState<InfrastructurePayload>();
  const { fatalError, clearFatalError, runSafely } = useFailFastAsync('viewmodel');

  const reload = async () => {
    await runSafely(() => executeLoad(() => repo.getSystemHealth()), {
      category: 'ipc',
      title: 'Infrastructure Load Error',
      userMessage: 'Infrastructure status could not be loaded.',
      swallow: true,
    });
  };

  useEffect(() => {
    void reload();
  }, []);

  return {
    infraState,
    reload,
    moduleError: fatalError,
    clearModuleError: clearFatalError,
  };
};
