import { useState, useCallback } from 'react';

import { useToastContext } from '../context/ToastContext';
export interface ToastState {
  severity: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

/**
 * Reusable toast notification hook.
 *
 * Eliminates the duplicated `useState<{ severity; message } | null>` pattern
 * found in AgentLifecycleManagerPage, EmployeeProfileView, SettingsView, etc.
 *
 * Usage:
 * ```tsx
 * const { toast, showSuccess, showError, dismiss } = useToast();
 * // ...
 * <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={dismiss}>
 *   <Alert severity={toast?.severity} onClose={dismiss}>{toast?.message}</Alert>
 * </Snackbar>
 * ```
 */
export const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showSuccess = useCallback((message: string) => {
    setToast({ severity: 'success', message });
  }, []);

  const showError = useCallback((message: string) => {
    setToast({ severity: 'error', message });
  }, []);

  const showInfo = useCallback((message: string) => {
    setToast({ severity: 'info', message });
  }, []);

  const showWarning = useCallback((message: string) => {
    setToast({ severity: 'warning', message });
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showSuccess, showError, showInfo, showWarning, dismiss };
};
