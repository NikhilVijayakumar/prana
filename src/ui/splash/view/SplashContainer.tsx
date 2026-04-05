import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSplashViewModel } from '../viewmodel/useSplashViewModel';
import { SplashView } from './SplashView';
import { StateType } from 'astra';
import { volatileSessionStore } from 'prana/ui/authentication/state/volatileSessionStore';
import { getFirstEnabledMainRoute } from 'prana/ui/constants/moduleRegistry';
import { PranaModuleErrorBoundary } from 'prana/ui/common/PranaModuleErrorBoundary';
import { throwPranaUiError } from 'prana/ui/common/errors/pranaFailFast';

export const SplashContainer: FC = () => {
  const navigate = useNavigate();
  
  const handleComplete = () => {
    const hasSession = volatileSessionStore.hasSession();

    if (!hasSession) {
      navigate('/login');
      return;
    }

    navigate(getFirstEnabledMainRoute());
  };

  const handleSshFailure = () => {
    navigate('/access-denied');
  };

  const { state, statusMessage, moduleError, isError, errorCode, isDegraded, bootProgress, bootCurrentState, onRetry } = useSplashViewModel(handleComplete, handleSshFailure);

  if (moduleError) {
    throwPranaUiError(moduleError);
  }

  return (
    <PranaModuleErrorBoundary>
      <SplashView 
        isLoading={state.state === StateType.LOADING} 
        isSuccess={state.isSuccess} 
        statusMessage={statusMessage}
        isError={isError}
        errorCode={errorCode}
        isDegraded={isDegraded}
        bootProgress={bootProgress}
        bootCurrentState={bootCurrentState}
        onRetry={onRetry}
      />
    </PranaModuleErrorBoundary>
  );
};
