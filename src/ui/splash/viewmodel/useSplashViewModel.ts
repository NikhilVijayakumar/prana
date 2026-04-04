import { useEffect, useState } from 'react';
import { useDataState, StateType } from 'astra';
import { AuthRepo } from '../../authentication/repo/AuthRepo';
import { ModelGatewayRepo } from 'prana/ui/repo/modelGateway';
import { useFailFastAsync } from 'prana/ui/common/errors/useFailFastAsync';

const REQUIRED_STARTUP_STAGE_IDS = new Set(['integration', 'governance', 'vault']);

const hasRequiredStartupStagesReady = (startupStatus: any): boolean => {
  const stages = Array.isArray(startupStatus?.stages) ? startupStatus.stages : [];
  return stages
    .filter((stage: any) => REQUIRED_STARTUP_STAGE_IDS.has(stage.id))
    .every((stage: any) => stage.status === 'SUCCESS');
};

const resolveBootstrapConfig = async (): Promise<Record<string, unknown>> => {
  const windowConfig = window.__pranaBootstrapConfig;
  if (windowConfig && typeof windowConfig === 'object') {
    return windowConfig;
  }

  if (!window.api?.app?.getBootstrapConfig) {
    throw new Error('Missing preload bridge: app.getBootstrapConfig');
  }

  const ipcConfig = await window.api.app.getBootstrapConfig();
  if (ipcConfig && typeof ipcConfig === 'object') {
    return ipcConfig as Record<string, unknown>;
  }

  throw new Error('Host bootstrap config is unavailable. Splash bootstrap cannot start.');
};

export const useSplashViewModel = (onComplete: () => void, onSshFailure: () => void) => {
  // useDataState returns: [state, execute, setAppState]
  const [bootState, , setBootState] = useDataState<boolean>();
  const [statusMessage, setStatusMessage] = useState<string>('');
  const authRepo = new AuthRepo();
  const modelGatewayRepo = new ModelGatewayRepo();
  const { fatalError, clearFatalError, runSafely } = useFailFastAsync('viewmodel');

  useEffect(() => {
    let isMounted = true;

    const runBootSequence = async () => {
      setBootState(prev => ({ ...prev, state: StateType.LOADING }));

      const startupStatus = await runSafely(
        async () => {
          if (!window.api?.app?.bootstrapHost) {
            throw new Error('Missing preload bridge: app.bootstrapHost');
          }

          const config = await resolveBootstrapConfig();
          return window.api.app.bootstrapHost({ config });
        },
        {
          category: 'ipc',
          title: 'Startup Bootstrap Error',
          userMessage: 'Startup bootstrap could not be completed.',
          swallow: true,
        },
      );

      if (!startupStatus) {
        setBootState(prev => ({ ...prev, state: StateType.COMPLETED, isSuccess: false }));
        return;
      }

      if (!isMounted) return;

      if (!hasRequiredStartupStagesReady(startupStatus)) {
        setStatusMessage('Startup orchestration did not pass required checks. Access blocked.');
        setBootState(prev => ({ ...prev, state: StateType.COMPLETED, isSuccess: false }));
        setTimeout(() => {
          if (isMounted) onSshFailure();
        }, 300);
        return;
      }

      const sshStatus = await runSafely(() => authRepo.checkSSHStatus(), {
        category: 'ipc',
        title: 'Authentication Status Error',
        userMessage: 'Authentication status could not be verified.',
        swallow: true,
      });
      if (!sshStatus) {
        setBootState(prev => ({ ...prev, state: StateType.COMPLETED, isSuccess: false }));
        return;
      }
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

      const gatewayStatus = await runSafely(() => modelGatewayRepo.probeGateway(), {
        category: 'ipc',
        title: 'Model Gateway Status Error',
        userMessage: 'Model gateway status could not be verified.',
        swallow: true,
      });
      if (!gatewayStatus) {
        setBootState(prev => ({ ...prev, state: StateType.COMPLETED, isSuccess: false }));
        return;
      }
      if (!isMounted) return;

      if (!gatewayStatus.data?.activeProvider) {
        // Model gateway is optional – warn but proceed to login
        const fallbackMessage = gatewayStatus.data?.statuses[0]?.message ?? 'No model provider is reachable.';
        console.warn('[PRANA] Model gateway probe failed (non-blocking):', fallbackMessage);
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

    void runBootSequence();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    state: bootState,
    statusMessage,
    moduleError: fatalError,
    clearModuleError: clearFatalError,
  };
};
