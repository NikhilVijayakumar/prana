import { useState, useCallback } from 'react';
import { AuthRepo } from '../../authentication/repo/AuthRepo';

type SSHStatus = 'idle' | 'verifying' | 'verified' | 'failed';

export const useForgotPasswordViewModel = (
  onTempPassword: (tempPass: string) => void
) => {
  const repo = new AuthRepo();

  const [email, setEmail] = useState('');
  const [sshStatus, setSshStatus] = useState<SSHStatus>('idle');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleVerify = useCallback(async (): Promise<'verified' | 'ssh_failed' | 'email_mismatch'> => {
    if (sshStatus === 'verifying') return 'ssh_failed';
    setErrorKey(null);
    setSshStatus('verifying');

    const resp = await repo.verifySSH(email);

    if (resp.isSuccess && resp.data?.verified && resp.data.tempPassword) {
      setSshStatus('verified');
      onTempPassword(resp.data.tempPassword);
      return 'verified';
    } else {
      setSshStatus('failed');
      if (resp.statusMessage === 'email_mismatch') {
        setErrorKey('auth.error.emailMismatch');
        return 'email_mismatch';
      } else if (resp.statusMessage === 'ssh_unavailable') {
        setErrorKey('auth.error.sshUnavailable');
        return 'ssh_failed';
      } else {
        setErrorKey('auth.error.sshFailed');
        return 'ssh_failed';
      }
    }
  }, [email, sshStatus]);

  const handleRetry = useCallback(() => {
    setSshStatus('idle');
    setErrorKey(null);
  }, []);

  return {
    email,
    setEmail,
    sshStatus,
    errorKey,
    handleVerify,
    handleRetry,
  };
};
