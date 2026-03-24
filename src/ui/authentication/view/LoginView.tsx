import { FC } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Link,
  useTheme as useMuiTheme,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';

interface LoginViewProps {
  email: string;
  password: string;
  isLoading: boolean;
  errorKey: string | null;
  isLocked: boolean;
  lockRemainingSeconds: number;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
  onForgotPassword: () => void;
}

export const LoginView: FC<LoginViewProps> = ({
  email,
  password,
  isLoading,
  errorKey,
  isLocked,
  lockRemainingSeconds,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLocked && !isLoading) onSubmit();
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
      {/* Header */}
      <Box>
        <Typography variant="h3" sx={{ color: muiTheme.palette.text.primary, mb: spacing.xs }}>
          {literal['auth.login.title']}
        </Typography>
        <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
          {literal['auth.login.subtitle']}
        </Typography>
      </Box>

      {/* Error / Lockout alert */}
      {errorKey && (
        <Alert severity="error" sx={{ borderRadius: '8px' }}>
          {literal[errorKey] ?? errorKey}
          {isLocked && lockRemainingSeconds > 0 && ` (${lockRemainingSeconds}s)`}
        </Alert>
      )}

      {/* Fields */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        <TextField
          label={literal['auth.email']}
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLocked || isLoading}
          fullWidth
          autoFocus
          size="small"
        />
        <TextField
          label={literal['auth.password']}
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLocked || isLoading}
          fullWidth
          size="small"
        />
      </Box>

      {/* Submit */}
      <Button
        variant="contained"
        fullWidth
        disabled={isLocked || isLoading || !email || !password}
        onClick={onSubmit}
        sx={{ py: spacing.sm }}
      >
        {isLoading ? (
          <CircularProgress size={18} color="inherit" />
        ) : (
          literal['auth.login.submit']
        )}
      </Button>

      {/* Forgot password link */}
      <Box sx={{ textAlign: 'center' }}>
        <Link
          component="button"
          variant="body2"
          onClick={onForgotPassword}
          sx={{ color: muiTheme.palette.text.secondary, textDecorationColor: 'inherit' }}
        >
          {literal['auth.login.forgotLink']}
        </Link>
      </Box>
    </Box>
  );
};
