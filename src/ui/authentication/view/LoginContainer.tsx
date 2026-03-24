import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoginViewModel } from '../viewmodel/useLoginViewModel';
import { LoginView } from './LoginView';

export const LoginContainer: FC = () => {
  const navigate = useNavigate();

  const vm = useLoginViewModel((isFirstInstall) => {
    navigate(isFirstInstall ? '/onboarding' : '/triage', { replace: true });
  });

  return (
    <LoginView
      email={vm.email}
      password={vm.password}
      isLoading={vm.isLoading}
      errorKey={vm.errorKey}
      isLocked={vm.isLocked}
      lockRemainingSeconds={vm.lockRemainingSeconds}
      onEmailChange={vm.setEmail}
      onPasswordChange={vm.setPassword}
      onSubmit={vm.handleLogin}
      onForgotPassword={() => navigate('/forgot-password')}
    />
  );
};
