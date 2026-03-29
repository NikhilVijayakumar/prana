import { useState, useCallback, useMemo } from 'react';
import { AuthRepo } from '../../authentication/repo/AuthRepo';
import { useFailFastAsync } from 'prana/ui/common/errors/useFailFastAsync';

export const useResetPasswordViewModel = (onSuccess: () => void) => {
  const repo = new AuthRepo();
  const { fatalError, clearFatalError, runSafely } = useFailFastAsync('viewmodel');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const validation = useMemo(() => {
    const hasMinLength = newPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasMatch = newPassword === confirmPassword && confirmPassword.length > 0;
    return { hasMinLength, hasUppercase, hasNumber, hasMatch };
  }, [newPassword, confirmPassword]);

  const isValid =
    validation.hasMinLength &&
    validation.hasUppercase &&
    validation.hasNumber &&
    validation.hasMatch;

  const handleReset = useCallback(async () => {
    if (!isValid || isLoading) return;
    setErrorKey(null);
    setIsLoading(true);

    try {
      const resp = await runSafely(() => repo.resetPassword(newPassword), {
        category: 'ipc',
        title: 'Reset Password Error',
        userMessage: 'Password reset could not be completed.',
        swallow: true,
      });
      if (!resp) {
        return;
      }
      if (resp.isSuccess) {
        onSuccess();
      } else {
        if (resp.statusMessage === 'no_temp_password' || resp.statusMessage === 'temp_password_expired') {
          setErrorKey('auth.error.resetRequiresRecovery');
        } else {
          setErrorKey('auth.error.resetFailed');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [newPassword, isValid, isLoading]);

  return {
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isLoading,
    errorKey,
    isValid,
    validation,
    handleReset,
    moduleError: fatalError,
    clearModuleError: clearFatalError,
  };
};
