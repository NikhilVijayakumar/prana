import { FC } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme as useMuiTheme,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';

interface PasswordStrength {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasMatch: boolean;
}

interface ResetPasswordViewProps {
  newPassword: string;
  confirmPassword: string;
  isLoading: boolean;
  isValid: boolean;
  errorKey: string | null;
  validation: PasswordStrength;
  onNewPasswordChange: (v: string) => void;
  onConfirmPasswordChange: (v: string) => void;
  onSubmit: () => void;
}

const StrengthItem: FC<{ met: boolean; label: string }> = ({ met, label }) => {
  const muiTheme = useMuiTheme();
  return (
    <ListItem disablePadding sx={{ py: '2px' }}>
      <ListItemIcon sx={{ minWidth: '20px' }}>
        <Box
          sx={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: met
              ? muiTheme.palette.success.main
              : muiTheme.palette.text.disabled,
          }}
        />
      </ListItemIcon>
      <ListItemText
        primary={label}
        primaryTypographyProps={{
          variant: 'caption',
          color: met ? 'text.primary' : 'text.disabled',
        }}
      />
    </ListItem>
  );
};

export const ResetPasswordView: FC<ResetPasswordViewProps> = ({
  newPassword,
  confirmPassword,
  isLoading,
  isValid,
  errorKey,
  validation,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && !isLoading) onSubmit();
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
          {literal['auth.reset.title']}
        </Typography>
        <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
          {literal['auth.reset.subtitle']}
        </Typography>
      </Box>

      {/* Error */}
      {errorKey && (
        <Alert severity="error" sx={{ borderRadius: '8px' }}>
          {literal[errorKey] ?? errorKey}
        </Alert>
      )}

      {/* Fields */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        <TextField
          label={literal['auth.reset.newPassword']}
          type="password"
          value={newPassword}
          onChange={(e) => onNewPasswordChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          fullWidth
          autoFocus
          size="small"
        />
        <TextField
          label={literal['auth.reset.confirmPassword']}
          type="password"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          fullWidth
          size="small"
          error={confirmPassword.length > 0 && !validation.hasMatch}
        />
      </Box>

      {/* Strength checklist */}
      {newPassword.length > 0 && (
        <List dense disablePadding sx={{ mt: -spacing.sm }}>
          <StrengthItem met={validation.hasMinLength} label={literal['auth.reset.strength.minLength']} />
          <StrengthItem met={validation.hasUppercase} label={literal['auth.reset.strength.uppercase']} />
          <StrengthItem met={validation.hasNumber} label={literal['auth.reset.strength.number']} />
          {confirmPassword.length > 0 && (
            <StrengthItem met={validation.hasMatch} label={literal['auth.reset.strength.match']} />
          )}
        </List>
      )}

      {/* Submit */}
      <Button
        variant="contained"
        fullWidth
        disabled={!isValid || isLoading}
        onClick={onSubmit}
        sx={{ py: spacing.sm }}
      >
        {isLoading ? (
          <CircularProgress size={18} color="inherit" />
        ) : (
          literal['auth.reset.submit']
        )}
      </Button>
    </Box>
  );
};
