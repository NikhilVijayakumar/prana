import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForgotPasswordViewModel } from '../viewmodel/useForgotPasswordViewModel';
import { ForgotPasswordView } from './ForgotPasswordView';
import { PranaModuleErrorBoundary } from 'prana/ui/common/PranaModuleErrorBoundary';
import { throwPranaUiError } from 'prana/ui/common/errors/pranaFailFast';

export const ForgotPasswordContainer: FC = () => {
  const navigate = useNavigate();
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const vm = useForgotPasswordViewModel((tempPass) => {
    setTempPassword(tempPass);
  });

  if (vm.moduleError) {
    throwPranaUiError(vm.moduleError);
  }

  const handleProceedReset = () => {
    navigate('/reset-password');
  };

  const handleVerify = async () => {
    const result = await vm.handleVerify();
    if (result === 'ssh_failed') {
      navigate('/access-denied');
    }
  };

  return (
    <PranaModuleErrorBoundary>
      <ForgotPasswordView
        email={vm.email}
        sshStatus={vm.sshStatus}
        errorKey={vm.errorKey}
        tempPassword={tempPassword}
        onEmailChange={vm.setEmail}
        onVerify={handleVerify}
        onProceedReset={handleProceedReset}
        onBackToLogin={() => navigate('/login')}
      />
    </PranaModuleErrorBoundary>
  );
};
