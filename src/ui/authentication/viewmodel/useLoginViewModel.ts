import { useState, useCallback, useEffect } from 'react';
import { AuthRepo } from '../../authentication/repo/AuthRepo';
import { volatileSessionStore } from '../state/volatileSessionStore';

const MAX_ATTEMPTS_SOFT = 3;
const MAX_ATTEMPTS_HARD = 10;
const LOCKOUT_SOFT_MS = 60_000;
const LOCKOUT_HARD_MS = 300_000;
const LOCKOUT_TS_KEY = 'dhi_lockout_until';
const LOCKOUT_COUNT_KEY = 'dhi_lockout_count';

export const useLoginViewModel = (onSuccess: (isFirstInstall: boolean) => void) => {
  const repo = new AuthRepo();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number>(() => {
    const saved = localStorage.getItem(LOCKOUT_TS_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });

  const isLocked = Date.now() < lockedUntil;
  const lockRemainingSeconds = isLocked ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0;

  useEffect(() => {
    if (!isLocked) return;
    const timer = setInterval(() => {
      if (Date.now() >= lockedUntil) {
        setLockedUntil(0);
        localStorage.removeItem(LOCKOUT_TS_KEY);
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil, isLocked]);

  const handleLogin = useCallback(async () => {
    if (isLocked || isLoading) return;
    setErrorKey(null);
    setIsLoading(true);

    try {
      const resp = await repo.login(email, password);

      if (resp.isSuccess && resp.data) {
        volatileSessionStore.setSessionToken(resp.data.sessionToken);
        volatileSessionStore.setOnboardingStatus(resp.data.isFirstInstall ? 'NOT_STARTED' : 'COMPLETED');
        localStorage.removeItem(LOCKOUT_TS_KEY);
        localStorage.removeItem(LOCKOUT_COUNT_KEY);
        onSuccess(resp.data.isFirstInstall);
      } else {
        if (resp.statusMessage === 'ssh_unavailable') {
          setErrorKey('auth.error.sshUnavailable');
          return;
        }

        if (resp.statusMessage === 'email_mismatch') {
          setErrorKey('auth.error.emailMismatch');
          return;
        }

        const prevCount = parseInt(localStorage.getItem(LOCKOUT_COUNT_KEY) ?? '0', 10);
        const newCount = prevCount + 1;
        localStorage.setItem(LOCKOUT_COUNT_KEY, String(newCount));

        if (newCount >= MAX_ATTEMPTS_HARD) {
          const until = Date.now() + LOCKOUT_HARD_MS;
          localStorage.setItem(LOCKOUT_TS_KEY, String(until));
          setLockedUntil(until);
          setErrorKey('auth.error.lockedExtended');
        } else if (newCount >= MAX_ATTEMPTS_SOFT) {
          const until = Date.now() + LOCKOUT_SOFT_MS;
          localStorage.setItem(LOCKOUT_TS_KEY, String(until));
          setLockedUntil(until);
          setErrorKey('auth.error.locked');
        } else {
          setErrorKey('auth.error.invalid');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, password, isLocked, isLoading]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    errorKey,
    isLocked,
    lockRemainingSeconds,
    handleLogin,
  };
};
