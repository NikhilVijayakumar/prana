import { useState, useCallback, useEffect } from 'react';
import { AuthRepo } from '../../authentication/repo/AuthRepo';
import { volatileSessionStore } from '../state/volatileSessionStore';
import {
  LOCKOUT_TS_STORAGE_KEY,
  LEGACY_LOCKOUT_TS_STORAGE_KEY,
  LOCKOUT_COUNT_STORAGE_KEY,
  LEGACY_LOCKOUT_COUNT_STORAGE_KEY,
  readStorageWithLegacy,
} from 'prana/ui/constants/storageKeys';
import { useFailFastAsync } from 'prana/ui/common/errors/useFailFastAsync';

const MAX_ATTEMPTS_SOFT = 3;
const MAX_ATTEMPTS_HARD = 10;
const LOCKOUT_SOFT_MS = 60_000;
const LOCKOUT_HARD_MS = 300_000;

export const useLoginViewModel = (onSuccess: (isFirstInstall: boolean) => void) => {
  const repo = new AuthRepo();
  const { fatalError, clearFatalError, runSafely } = useFailFastAsync('viewmodel');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number>(() => {
    const saved = readStorageWithLegacy(LOCKOUT_TS_STORAGE_KEY, LEGACY_LOCKOUT_TS_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });

  const isLocked = Date.now() < lockedUntil;
  const lockRemainingSeconds = isLocked ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0;

  useEffect(() => {
    if (!isLocked) return;
    const timer = setInterval(() => {
      if (Date.now() >= lockedUntil) {
        setLockedUntil(0);
        localStorage.removeItem(LOCKOUT_TS_STORAGE_KEY);
        localStorage.removeItem(LEGACY_LOCKOUT_TS_STORAGE_KEY);
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
      const resp = await runSafely(() => repo.login(email, password), {
        category: 'ipc',
        title: 'Login Service Error',
        userMessage: 'Login request could not be completed.',
        swallow: true,
      });
      if (!resp) {
        return;
      }

      if (resp.isSuccess && resp.data) {
        volatileSessionStore.setSessionToken(resp.data.sessionToken);
        volatileSessionStore.setOnboardingStatus(resp.data.isFirstInstall ? 'NOT_STARTED' : 'COMPLETED');
        localStorage.removeItem(LOCKOUT_TS_STORAGE_KEY);
        localStorage.removeItem(LEGACY_LOCKOUT_TS_STORAGE_KEY);
        localStorage.removeItem(LOCKOUT_COUNT_STORAGE_KEY);
        localStorage.removeItem(LEGACY_LOCKOUT_COUNT_STORAGE_KEY);
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

        const prevCount = parseInt(
          readStorageWithLegacy(LOCKOUT_COUNT_STORAGE_KEY, LEGACY_LOCKOUT_COUNT_STORAGE_KEY) ?? '0',
          10,
        );
        const newCount = prevCount + 1;
        localStorage.setItem(LOCKOUT_COUNT_STORAGE_KEY, String(newCount));

        if (newCount >= MAX_ATTEMPTS_HARD) {
          const until = Date.now() + LOCKOUT_HARD_MS;
          localStorage.setItem(LOCKOUT_TS_STORAGE_KEY, String(until));
          setLockedUntil(until);
          setErrorKey('auth.error.lockedExtended');
        } else if (newCount >= MAX_ATTEMPTS_SOFT) {
          const until = Date.now() + LOCKOUT_SOFT_MS;
          localStorage.setItem(LOCKOUT_TS_STORAGE_KEY, String(until));
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
    moduleError: fatalError,
    clearModuleError: clearFatalError,
  };
};
