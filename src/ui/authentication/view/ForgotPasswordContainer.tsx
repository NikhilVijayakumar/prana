import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForgotPasswordViewModel } from '../viewmodel/useForgotPasswordViewModel';
import { ForgotPasswordView } from './ForgotPasswordView';
import { PranaModuleErrorBoundary } from 'prana/ui/common/PranaModuleErrorBoundary';
import { throwPranaUiError } from 'prana/ui/common/errors/pranaFailFast';

export const ForgotPasswordContainer: FC = () => {
  const navigate = useNavigate();

  const vm = useForgotPasswordViewModel(
    () => {
      // Email verified - UI responds via flowStatus
    },
    () => {
      navigate('/reset-password');
    }
  );

  if (vm.moduleError) {
    throwPranaUiError(vm.moduleError);
  }

  const handleVerifyEmail = async () => {
    const result = await vm.handleVerifyEmail();
    if (result === 'failed') {
      navigate('/access-denied');
    }
  };

  const handleVerifyCode = async () => {
    const result = await vm.handleVerifyCode();
    if (result === 'failed') {
      // Stay on current step, error is shown via errorKey
    }
  };

  const isEmailStep = vm.flowStatus === 'idle' || vm.flowStatus === 'verifying_email' || vm.flowStatus === 'failed';
  const isCodeStep = vm.flowStatus === 'email_verified' || vm.flowStatus === 'verifying_code';

  return (
    <PranaModuleErrorBoundary>
      <ForgotPasswordView
        email={vm.email}
        code={vm.code}
        flowStatus={vm.flowStatus}
        errorKey={vm.errorKey}
        onEmailChange={vm.setEmail}
        onCodeChange={vm.setCode}
        onVerifyEmail={handleVerifyEmail}
        onVerifyCode={handleVerifyCode}
        onBackToLogin={() => navigate('/login')}
        isEmailStep={isEmailStep}
        isCodeStep={isCodeStep}
      />
    </PranaModuleErrorBoundary>
  );
};