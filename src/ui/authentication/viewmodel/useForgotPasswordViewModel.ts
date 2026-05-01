import { useState, useCallback } from 'react';
import { AuthRepo } from '../../authentication/repo/AuthRepo';
import { useFailFastAsync } from 'prana/ui/common/errors/useFailFastAsync';

type FlowStatus = 'idle' | 'verifying_email' | 'email_verified' | 'verifying_code' | 'code_verified' | 'failed';

export const useForgotPasswordViewModel = (
  onEmailVerified: () => void,
  onCodeVerified: () => void
) => {
  const repo = new AuthRepo();
  const { fatalError, clearFatalError, runSafely } = useFailFastAsync('viewmodel');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [flowStatus, setFlowStatus] = useState<FlowStatus>('idle');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [codeHash, setCodeHash] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<number | null>(null);

  const handleVerifyEmail = useCallback(async (): Promise<'email_verified' | 'failed'> => {
    if (flowStatus !== 'idle') return 'failed';
    setErrorKey(null);
    setFlowStatus('verifying_email');

    const resp = await runSafely(() => repo.verifySSH(email), {
      category: 'ipc',
      title: 'Email Verification Error',
      userMessage: 'Email could not be verified.',
      swallow: true,
    });
    if (!resp) {
      setFlowStatus('failed');
      return 'failed';
    }

    if (resp.isSuccess) {
      setFlowStatus('email_verified');
      onEmailVerified();
      return 'email_verified';
    } else {
      setFlowStatus('failed');
      if (resp.statusMessage === 'email_mismatch') {
        setErrorKey('auth.error.emailMismatch');
      } else {
        setErrorKey('auth.error.emailVerificationFailed');
      }
      return 'failed';
    }
  }, [email, flowStatus]);

  const handleVerifyCode = useCallback(async (): Promise<'code_verified' | 'failed'> => {
    if (flowStatus !== 'email_verified' || !codeHash) return 'failed';
    setErrorKey(null);
    setFlowStatus('verifying_code');

    const resp = await runSafely(() => repo.verifyCode(code, codeHash, codeExpiry ?? undefined), {
      category: 'ipc',
      title: 'Code Verification Error',
      userMessage: 'Code could not be verified.',
      swallow: true,
    });
    if (!resp) {
      setFlowStatus('failed');
      return 'failed';
    }

    if (resp.isSuccess && resp.data?.verified) {
      setFlowStatus('code_verified');
      onCodeVerified();
      return 'code_verified';
    } else {
      setFlowStatus('failed');
      setErrorKey('auth.error.invalidCode');
      return 'failed';
    }
  }, [flowStatus, code, codeHash, codeExpiry]);

  const handleRetry = useCallback(() => {
    setFlowStatus('idle');
    setErrorKey(null);
    setCode('');
    setCodeHash(null);
    setCodeExpiry(null);
  }, []);

  const setCodeVerificationDetails = useCallback((hash: string, expiry: number | null) => {
    setCodeHash(hash);
    setCodeExpiry(expiry);
  }, []);

  return {
    email,
    setEmail,
    code,
    setCode,
    flowStatus,
    errorKey,
    handleVerifyEmail,
    handleVerifyCode,
    handleRetry,
    setCodeVerificationDetails,
    moduleError: fatalError,
    clearModuleError: clearFatalError,
  };
};
