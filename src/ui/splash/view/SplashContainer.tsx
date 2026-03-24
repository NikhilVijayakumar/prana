import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSplashViewModel } from '../viewmodel/useSplashViewModel';
import { SplashView } from './SplashView';
import { StateType } from 'astra';
import { volatileSessionStore } from '@prana/ui/authentication/state/volatileSessionStore';
import { getFirstEnabledMainRoute } from '@prana/ui/constants/moduleRegistry';

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

  const { state, statusMessage } = useSplashViewModel(handleComplete, handleSshFailure);

  return (
    <SplashView 
      isLoading={state.state === StateType.LOADING} 
      isSuccess={state.isSuccess} 
      statusMessage={statusMessage}
    />
  );
};
