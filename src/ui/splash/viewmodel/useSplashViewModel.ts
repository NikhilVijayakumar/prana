import { useEffect, useState } from 'react';
import { useDataState, StateType } from 'astra';
import { AuthRepo } from '../../authentication/repo/AuthRepo';
import { ModelGatewayRepo } from '@prana/ui/repo/modelGateway';

export const useSplashViewModel = (onComplete: () => void, onSshFailure: () => void) => {
  // useDataState returns: [state, execute, setAppState]
  const [bootState, , setBootState] = useDataState<boolean>();
  const [statusMessage, setStatusMessage] = useState<string>('');
  const authRepo = new AuthRepo();
  const modelGatewayRepo = new ModelGatewayRepo();

  useEffect(() => {
    let isMounted = true;

    const runBootSequence = async () => {
      setBootState(prev => ({ ...prev, state: StateType.LOADING }));

      const sshStatus = await authRepo.checkSSHStatus();
      if (!isMounted) return;

      if (!sshStatus.data?.verified) {
        setStatusMessage(sshStatus.data?.message ?? 'SSH verification failed.');
        setBootState(prev => ({ ...prev, state: StateType.COMPLETED, isSuccess: false }));
        setTimeout(() => {
          if (isMounted) onSshFailure();
        }, 300);
        return;
      }
      
      // Simulate mounting encrypted vault
      await new Promise(r => setTimeout(r, 800));
      if (!isMounted) return;

      const gatewayStatus = await modelGatewayRepo.probeGateway();
      if (!isMounted) return;

      if (!gatewayStatus.data?.activeProvider) {
        // Model gateway is optional – warn but proceed to login
        const fallbackMessage = gatewayStatus.data?.statuses[0]?.message ?? 'No model provider is reachable.';
        console.warn('[DHI] Model gateway probe failed (non-blocking):', fallbackMessage);
        setStatusMessage('Model gateway unavailable – proceeding to login.');
      } else {
        setStatusMessage(
          `Model gateway active: ${gatewayStatus.data.activeProvider}/${gatewayStatus.data.activeModel}`,
        );
      }

      setBootState(prev => ({ ...prev, state: StateType.COMPLETED, isSuccess: true }));
      
      setTimeout(() => {
        if (isMounted) onComplete();
      }, 400); // Brief pause on success before navigating away
    };

    runBootSequence();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    state: bootState,
    statusMessage,
  };
};
