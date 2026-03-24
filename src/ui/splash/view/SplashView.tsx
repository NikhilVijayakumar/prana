import { FC } from 'react';
import { Box, Typography, CircularProgress, useTheme as useMuiTheme } from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';

interface SplashViewProps {
  isLoading: boolean;
  isSuccess: boolean;
  statusMessage: string;
}

export const SplashView: FC<SplashViewProps> = ({ isLoading, isSuccess, statusMessage }) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

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
        Dhi & Vidhan
      </Typography>

      <Box sx={{ width: '320px', p: spacing.lg, borderRadius: '8px', border: `1px solid ${muiTheme.palette.divider}`, backgroundColor: muiTheme.palette.background.paper }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: spacing.md }}>
          <Typography variant="splashSubtitle" sx={{ color: muiTheme.palette.text.secondary, flexGrow: 1 }}>
            Booting instruments natively powered by Prana and Dharma...
          </Typography>
          {isLoading && <CircularProgress size={12} sx={{ color: muiTheme.palette.text.secondary }} />}
        </Box>

        <Typography variant="body2" sx={{ color: isSuccess ? muiTheme.palette.success.main : muiTheme.palette.text.primary, fontFamily: 'monospace' }}>
          {isSuccess ? literal['splash.ready'] : statusMessage || literal['splash.check.ssh']}
        </Typography>
      </Box>
    </Box>
  );
};
