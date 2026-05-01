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

type FlowStatus = 'idle' | 'verifying_email' | 'email_verified' | 'verifying_code' | 'code_verified' | 'failed';

interface ForgotPasswordViewProps {
  email: string;
  code?: string;
  flowStatus: FlowStatus;
  errorKey: string | null;
  onEmailChange: (v: string) => void;
  onCodeChange?: (v: string) => void;
  onVerifyEmail: () => void;
  onVerifyCode?: () => void;
  onBackToLogin: () => void;
  isEmailStep?: boolean;
  isCodeStep?: boolean;
}

export const ForgotPasswordView: FC<ForgotPasswordViewProps> = ({
  email,
  code = '',
  flowStatus,
  errorKey,
  onEmailChange,
  onCodeChange,
  onVerifyEmail,
  onVerifyCode,
  onBackToLogin,
  isEmailStep = true,
  isCodeStep = false,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

  const isVerifyingEmail = flowStatus === 'verifying_email';
  const isEmailVerified = flowStatus === 'email_verified';
  const isVerifyingCode = flowStatus === 'verifying_code';
  const isCodeVerified = flowStatus === 'code_verified';
  const isFailed = flowStatus === 'failed';

  const getStatusLabel = () => {
    if (flowStatus === 'verifying_email') return literal['auth.forgot.verifyingEmail'];
    if (flowStatus === 'email_verified') return literal['auth.forgot.emailVerified'];
    if (flowStatus === 'verifying_code') return literal['auth.forgot.verifyingCode'];
    if (flowStatus === 'code_verified') return literal['auth.forgot.codeVerified'];
    if (flowStatus === 'failed') return literal['auth.forgot.verificationFailed'];
    return '';
  };

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
      <Box>
        <Typography variant="h3" sx={{ color: muiTheme.palette.text.primary, mb: spacing.xs }}>
          {literal['auth.forgot.title']}
        </Typography>
        <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
          {isEmailStep
            ? literal['auth.forgot.subtitle']
            : literal['auth.forgot.codeSubtitle']}
        </Typography>
      </Box>

      {flowStatus !== 'idle' && (
        <Chip
          label={getStatusLabel()}
          color={isEmailVerified || isCodeVerified ? 'success' : isFailed ? 'error' : 'default'}
          size="small"
          sx={{ alignSelf: 'flex-start' }}
        />
      )}

      {errorKey && (
        <Alert severity="error" sx={{ borderRadius: '8px' }}>
          {literal[errorKey] ?? errorKey}
        </Alert>
      )}

      {isEmailStep && (
        <TextField
          label={literal['auth.forgot.emailLabel']}
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={isVerifyingEmail || isEmailVerified}
          fullWidth
          autoFocus
          size="small"
        />
      )}

      {isCodeStep && (
        <TextField
          label={literal['auth.forgot.codeLabel']}
          type="text"
          value={code}
          onChange={(e) => onCodeChange?.(e.target.value)}
          disabled={isVerifyingCode || isCodeVerified}
          fullWidth
          autoFocus
          size="small"
          inputProps={{ maxLength: 6, pattern: '[0-9]*' }}
          placeholder="000000"
        />
      )}

      {isEmailStep && !isEmailVerified && (
        <Button
          variant="contained"
          fullWidth
          disabled={isVerifyingEmail || !email}
          onClick={onVerifyEmail}
          sx={{ py: spacing.sm }}
        >
          {isVerifyingEmail ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            literal['auth.forgot.submit']
          )}
        </Button>
      )}

      {isCodeStep && !isCodeVerified && onVerifyCode && (
        <Button
          variant="contained"
          fullWidth
          disabled={isVerifyingCode || !code || code.length < 6}
          onClick={onVerifyCode}
          sx={{ py: spacing.sm }}
        >
          {isVerifyingCode ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            literal['auth.forgot.verifyCode']
          )}
        </Button>
      )}

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