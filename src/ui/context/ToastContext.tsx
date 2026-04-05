import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  severity: 'success' | 'error' | 'info' | 'warning' | 'critical';
  message: string;
}

export interface ToastContextType {
  toasts: ToastMessage[];
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
  showCritical: (message: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (severity: ToastMessage['severity'], message: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastMessage = { id, severity, message };

      setToasts(prev => [...prev, newToast]);

      // Auto-dismiss non-critical toasts after delay
      const delays: Record<ToastMessage['severity'], number> = {
        success: 4000,
        error: 6000,
        info: 4000,
        warning: 5000,
        critical: 0, // No auto-dismiss
      };

      if (delays[severity] > 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, delays[severity]);
      }
    },
    []
  );

  const showSuccess = useCallback((message: string) => {
    addToast('success', message);
  }, [addToast]);

  const showError = useCallback((message: string) => {
    addToast('error', message);
  }, [addToast]);

  const showInfo = useCallback((message: string) => {
    addToast('info', message);
  }, [addToast]);

  const showWarning = useCallback((message: string) => {
    addToast('warning', message);
  }, [addToast]);

  const showCritical = useCallback((message: string) => {
    addToast('critical', message);
  }, [addToast]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const value: ToastContextType = {
    toasts,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showCritical,
    dismiss,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToastContext = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};
