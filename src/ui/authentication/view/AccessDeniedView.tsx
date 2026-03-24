import { FC } from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme as useMuiTheme,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from 'astra';

interface AccessDeniedViewProps {
  onRetry: () => void;
  onBackToLogin: () => void;
}

export const AccessDeniedView: FC<AccessDeniedViewProps> = ({ onRetry, onBackToLogin }) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: muiTheme.palette.background.paper,
        border: `1px solid ${muiTheme.palette.error.main}`,
        borderRadius: '12px',
        p: spacing.xxl,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: spacing.lg,
      }}
    >
      {/* Icon placeholder */}
      <Box
        sx={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: muiTheme.palette.error.main,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h4" sx={{ color: muiTheme.palette.error.contrastText, lineHeight: 1 }}>
          ✕
        </Typography>
      </Box>

      {/* Message */}
      <Box>
        <Typography variant="h3" sx={{ color: muiTheme.palette.text.primary, mb: spacing.sm }}>
          {literal['auth.denied.title']}
        </Typography>
        <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary, lineHeight: 1.6 }}>
          {literal['auth.denied.body']}
        </Typography>
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, width: '100%' }}>
        <Button variant="contained" color="error" fullWidth onClick={onRetry} sx={{ py: spacing.sm }}>
          {literal['auth.denied.retry']}
        </Button>
        <Button variant="outlined" fullWidth onClick={onBackToLogin} sx={{ py: spacing.sm }}>
          {literal['auth.denied.backToLogin']}
        </Button>
      </Box>
    </Box>
  );
};
