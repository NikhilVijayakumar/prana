import { FC } from 'react';
import { Box, Typography, CircularProgress, Button, useTheme as useMuiTheme, Alert } from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from 'astra';
import { assertRequiredBrandingFields, useBranding } from 'prana/ui/constants/pranaConfig';

interface SplashViewProps {
  isLoading: boolean;
  isSuccess: boolean;
  statusMessage: string;
  isError?: boolean;
  errorCode?: string;
  isDegraded?: boolean;
  onRetry?: () => void;
  bootProgress?: number;
  bootCurrentState?: string;
}

export const SplashView: FC<SplashViewProps> = ({ 
  isLoading, 
  isSuccess, 
  statusMessage,
  isError = false,
  errorCode,
  isDegraded = false,
  onRetry,
  bootProgress = 0,
  bootCurrentState = 'INIT',
}) => {
  const branding = useBranding();
  assertRequiredBrandingFields('SplashView', branding, ['appBrandName', 'appSplashSubtitle']);

  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();
  const appBrandName = branding.appBrandName as string;
  const appSplashSubtitle = branding.appSplashSubtitle as string;

  // Determine container styling based on state
  const getContainerBorderColor = () => {
    if (isError) return muiTheme.palette.error.main;
    if (isDegraded) return muiTheme.palette.warning.main;
    return muiTheme.palette.divider;
  };

  const getContainerBackgroundColor = () => {
    if (isError) return muiTheme.palette.error.dark;
    if (isDegraded) return muiTheme.palette.warning.dark;
    return muiTheme.palette.background.paper;
  };

  const getStatusTextColor = () => {
    if (isSuccess) return muiTheme.palette.success.main;
    if (isError) return muiTheme.palette.error.main;
    if (isDegraded) return muiTheme.palette.warning.main;
    return muiTheme.palette.text.primary;
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%',
      width: '100%'
    }}>
      <Typography variant="splashTitle" sx={{ color: muiTheme.palette.text.primary, mb: spacing.xl }}>
        {appBrandName}
      </Typography>

      <Box sx={{ width: '320px', p: spacing.lg, borderRadius: '8px', border: `2px solid ${getContainerBorderColor()}`, backgroundColor: getContainerBackgroundColor() }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: spacing.md }}>
          <Typography variant="splashSubtitle" sx={{ color: muiTheme.palette.text.secondary, flexGrow: 1 }}>
            {appSplashSubtitle}
          </Typography>
          {isLoading && <CircularProgress size={12} sx={{ color: muiTheme.palette.text.secondary }} />}
        </Box>

        <Typography variant="body2" sx={{ color: getStatusTextColor(), fontFamily: 'monospace', mb: spacing.md }}>
          {statusMessage || literal['splash.check.ssh']}
        </Typography>

        {/* Progress indicator */}
        {!isError && !isSuccess && (
          <Box sx={{ mb: spacing.md }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: spacing.sm }}>
              <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
                Progress: {bootProgress}%
              </Typography>
              <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
                State: {bootCurrentState}
              </Typography>
            </Box>
            <Box sx={{ height: '4px', backgroundColor: muiTheme.palette.divider, borderRadius: '2px', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', backgroundColor: isDegraded ? muiTheme.palette.warning.main : muiTheme.palette.primary.main, width: `${bootProgress}%`, transition: 'width 0.3s ease' }} />
            </Box>
          </Box>
        )}

        {/* Degraded status indicator */}
        {isDegraded && !isError && (
          <Alert severity="warning" sx={{ mb: spacing.md, fontSize: '0.875rem' }}>
            Degraded startup: Some recovery stages failed, but core services are operational.
          </Alert>
        )}

        {/* Error panel with retry button */}
        {isError && (
          <Box sx={{ mt: spacing.md }}>
            <Alert severity="error" sx={{ mb: spacing.md }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: spacing.sm }}>
                Startup failed {errorCode ? `(${errorCode})` : ''}
              </Typography>
              <Typography variant="caption" sx={{ color: 'inherit' }}>
                {statusMessage}
              </Typography>
            </Alert>
            {onRetry && (
              <Button 
                onClick={onRetry}
                variant="contained"
                color="error"
                size="small"
                fullWidth
                sx={{ textTransform: 'none', mb: spacing.sm }}
              >
                Retry Bootstrap
              </Button>
            )}
          </Box>
        )}

        {/* Success message */}
        {isSuccess && (
          <Typography variant="caption" sx={{ color: muiTheme.palette.success.main }}>
            {literal['splash.ready'] || 'Startup complete'}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
