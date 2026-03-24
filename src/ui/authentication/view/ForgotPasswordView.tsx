import { FC } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Link,
  useTheme as useMuiTheme,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from 'astra';

type SSHStatus = 'idle' | 'verifying' | 'verified' | 'failed';

interface ForgotPasswordViewProps {
  email: string;
  sshStatus: SSHStatus;
  errorKey: string | null;
  tempPassword: string | null;
  onEmailChange: (v: string) => void;
  onVerify: () => void;
  onProceedReset: () => void;
  onBackToLogin: () => void;
}

export const ForgotPasswordView: FC<ForgotPasswordViewProps> = ({
  email,
  sshStatus,
  errorKey,
  tempPassword,
  onEmailChange,
  onVerify,
  onProceedReset,
  onBackToLogin,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();
  const isVerifying = sshStatus === 'verifying';
  const isVerified = sshStatus === 'verified';
  const isFailed = sshStatus === 'failed';

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: muiTheme.palette.background.paper,
        border: `1px solid ${muiTheme.palette.divider}`,
        borderRadius: '12px',
        p: spacing.xxl,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.lg,
      }}
    >
      {/* Header */}
      <Box>
        <Typography variant="h3" sx={{ color: muiTheme.palette.text.primary, mb: spacing.xs }}>
          {literal['auth.forgot.title']}
        </Typography>
        <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
          {literal['auth.forgot.subtitle']}
        </Typography>
      </Box>

      {/* Status chip */}
      {sshStatus !== 'idle' && (
        <Chip
          label={
            isVerifying
              ? literal['auth.forgot.sshVerifying']
              : isVerified
              ? literal['auth.forgot.sshVerified']
              : literal['auth.forgot.sshFailed']
          }
          color={isVerified ? 'success' : isFailed ? 'error' : 'default'}
          size="small"
          sx={{ alignSelf: 'flex-start' }}
        />
      )}

      {/* Error */}
      {errorKey && (
        <Alert severity="error" sx={{ borderRadius: '8px' }}>
          {literal[errorKey] ?? errorKey}
        </Alert>
      )}

      {/* Email field */}
      <TextField
        label={literal['auth.forgot.emailLabel']}
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        disabled={isVerifying || isVerified}
        fullWidth
        autoFocus
        size="small"
      />

      {/* Temp password reveal */}
      {isVerified && tempPassword && (
        <Box
          sx={{
            p: spacing.md,
            borderRadius: '8px',
            backgroundColor: muiTheme.palette.action.hover,
            border: `1px solid ${muiTheme.palette.divider}`,
          }}
        >
          <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary, mb: spacing.xs, display: 'block' }}>
            {literal['auth.forgot.tempPasswordLabel']}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: muiTheme.palette.text.primary,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
            }}
          >
            {tempPassword}
          </Typography>
        </Box>
      )}

      {/* Actions */}
      {!isVerified ? (
        <Button
          variant="contained"
          fullWidth
          disabled={isVerifying || !email}
          onClick={onVerify}
          sx={{ py: spacing.sm }}
        >
          {isVerifying ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            literal['auth.forgot.submit']
          )}
        </Button>
      ) : (
        <Button
          variant="contained"
          fullWidth
          onClick={onProceedReset}
          sx={{ py: spacing.sm }}
        >
          {literal['auth.forgot.proceedReset']}
        </Button>
      )}

      {/* Back to login */}
      <Box sx={{ textAlign: 'center' }}>
        <Link
          component="button"
          variant="body2"
          onClick={onBackToLogin}
          sx={{ color: muiTheme.palette.text.secondary, textDecorationColor: 'inherit' }}
        >
          {literal['auth.forgot.backToLogin']}
        </Link>
      </Box>
    </Box>
  );
};
