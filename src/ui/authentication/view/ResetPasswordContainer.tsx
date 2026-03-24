import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResetPasswordViewModel } from '../viewmodel/useResetPasswordViewModel';
import { ResetPasswordView } from './ResetPasswordView';

export const ResetPasswordContainer: FC = () => {
  const navigate = useNavigate();

  const vm = useResetPasswordViewModel(() => {
    navigate('/login', { replace: true });
  });

  return (
    <ResetPasswordView
      newPassword={vm.newPassword}
      confirmPassword={vm.confirmPassword}
      isLoading={vm.isLoading}
      isValid={vm.isValid}
      errorKey={vm.errorKey}
      validation={vm.validation}
      onNewPasswordChange={vm.setNewPassword}
      onConfirmPasswordChange={vm.setConfirmPassword}
      onSubmit={vm.handleReset}
    />
  );
};
