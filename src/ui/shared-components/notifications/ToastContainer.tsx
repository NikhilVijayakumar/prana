import React from 'react';
import {
  Snackbar,
  Alert,
  Stack,
  styled,
  keyframes,
} from '@mui/material';
import { useToastContext } from '../../context/ToastContext';

const slideIn = keyframes`
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const StyledSnackbar = styled(Snackbar)`
  animation: ${slideIn} 0.3s ease-in-out;
`;

/**
 * Global toast notification system using context
 * Renders all queued toasts stacked on top of each other
 *
 * Usage: Add <ToastContainer /> to your app root
 */
export const ToastContainer: React.FC = () => {
  const { toasts, dismiss } = useToastContext();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <Stack
      spacing={1}
      sx={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        maxWidth: '500px',
      }}
    >
      {toasts.slice(-3).map((toast, index) => (
        <StyledSnackbar
          key={toast.id}
          open={true}
          autoHideDuration={
            toast.severity === 'critical'
              ? undefined
              : toast.severity === 'error'
                ? 6000
                : 4000
          }
          onClose={() => dismiss(toast.id)}
          sx={{
            animation: `${slideIn} 0.3s ease-in-out`,
            animationDelay: `${index * 50}ms`,
          }}
        >
          <Alert
            onClose={() => dismiss(toast.id)}
            severity={
              toast.severity === 'critical'
                ? 'error'
                : (toast.severity as 'success' | 'error' | 'info' | 'warning')
            }
            sx={{
              width: '100%',
              backgroundColor:
                toast.severity === 'critical'
                  ? 'error.dark'
                  : undefined,
              color: toast.severity === 'critical' ? 'white' : undefined,
              fontWeight: toast.severity === 'critical' ? 600 : undefined,
              boxShadow:
                toast.severity === 'critical'
                  ? '0 4px 20px rgba(211, 47, 47, 0.4)'
                  : undefined,
            }}
          >
            {toast.message}
          </Alert>
        </StyledSnackbar>
      ))}
    </Stack>
  );
};
