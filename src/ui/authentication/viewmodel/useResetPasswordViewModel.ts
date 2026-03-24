import { useState, useCallback, useMemo } from 'react';
import { AuthRepo } from '../../authentication/repo/AuthRepo';

export const useResetPasswordViewModel = (onSuccess: () => void) => {
  const repo = new AuthRepo();

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
      const resp = await repo.resetPassword(newPassword);
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
  };
};
