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
  const [bootProgress, setBootProgress] = useState<number>(0);
  const [bootCurrentState, setBootCurrentState] = useState<string>('INIT');
  const [isError, setIsError] = useState<boolean>(false);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [isDegraded, setIsDegraded] = useState<boolean>(false);
  const authRepo = new AuthRepo();
  const modelGatewayRepo = new ModelGatewayRepo();
  const { fatalError, clearFatalError, runSafely } = useFailFastAsync('viewmodel');

  const startBootstrapSequence = async () => {
    // Reset error state when starting new sequence
    setIsError(false);
    setErrorCode(undefined);
    setIsDegraded(false);
    setBootState(prev => ({ ...prev, state: StateType.LOADING }));

    // Subscribe to progress events
    let unsubscribeProgress: (() => void) | null = null;
    if (window.api?.app?.onStartupProgress) {
      unsubscribeProgress = window.api.app.onStartupProgress((event: any) => {
        // Update progress display
        if (event.overallProgress !== undefined) {
          setBootProgress(event.overallProgress);
        }
        if (event.currentState !== undefined) {
          setBootCurrentState(event.currentState);
        }
        
        // Update status message from stage
        if (event.stage?.message) {
          setStatusMessage(event.stage.message);
          if (event.stage.errorCode) {
            setErrorCode(event.stage.errorCode);
          }
        }
      });
    }

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

    // Cleanup progress listener
    if (unsubscribeProgress) {
      unsubscribeProgress();
    }

    if (!startupStatus) {
      setBootState(prev => ({ ...prev, state: StateType.COMPLETED, isSuccess: false }));
      setIsError(true);
      return;
    }

    // Check overall status from orchestrator
    if (startupStatus.overallStatus === 'BLOCKED') {
      setStatusMessage(startupStatus.stages?.[0]?.message || 'Startup blocked: core services unavailable.');
      setErrorCode('STARTUP_BLOCKED');
      setBootState(prev => ({ ...prev, state: StateType.COMPLETED, isSuccess: false }));
      setIsError(true);
      return;
    }

    if (startupStatus.overallStatus === 'DEGRADED') {
      setIsDegraded(true);
      setStatusMessage('Startup completed in degraded mode: some recovery stages failed.');
      // Don't set isError for degraded - continue to complete
    }

    if (!hasRequiredStartupStagesReady(startupStatus)) {
      setStatusMessage('Startup orchestration did not pass required checks. Access blocked.');
      setBootState(prev => ({ ...prev, state: StateType.COMPLETED, isSuccess: false }));
      setIsError(true);
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
      setIsError(true);
      return;
    }

    if (!sshStatus.data?.verified) {
      setStatusMessage(sshStatus.data?.message ?? 'SSH verification failed.');
      setBootState(prev => ({ ...prev, state: StateType.COMPLETED, isSuccess: false }));
      setIsError(true);
      return;
    }
    
    // Simulate mounting encrypted vault
    await new Promise(r => setTimeout(r, 800));

    const gatewayStatus = await runSafely(() => modelGatewayRepo.probeGateway(), {
      category: 'ipc',
      title: 'Model Gateway Status Error',
      userMessage: 'Model gateway status could not be verified.',
      swallow: true,
    });
    if (!gatewayStatus) {
      setBootState(prev => ({ ...prev, state: StateType.COMPLETED, isSuccess: false }));
      setIsError(true);
      return;
    }

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
      onComplete();
    }, 400); // Brief pause on success before navigating away
  };

  const handleRetry = () => {
    setBootProgress(0);
    setBootCurrentState('INIT');
    void startBootstrapSequence();
  };

  useEffect(() => {
    void startBootstrapSequence();
  }, []);

  return {
    state: bootState,
    statusMessage,
    bootProgress,
    bootCurrentState,
    isError,
    errorCode,
    isDegraded,
    onRetry: handleRetry,
    moduleError: fatalError,
    clearModuleError: clearFatalError,
  };
    bootProgress,
    bootCurrentState,
    moduleError: fatalError,
    clearModuleError: clearFatalError,
  };
};
