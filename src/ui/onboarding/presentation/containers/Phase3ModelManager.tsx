/**
 * Phase3ModelManager Container
 * Manages Local Model Configuration (Privacy Layer)
 */

import { FC } from 'react';
import {
  Box,
  Button,
  Card,
  Typography,
  useTheme as useMuiTheme,
  Alert,
  Stack,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';
import { Phase3DraftState } from '../../domain/onboarding.types';
import { ModelProviderForm } from '../components/ModelProviderForm';

interface Phase3ModelManagerProps {
  phase3Draft: Phase3DraftState;
  onUpdateDraft: (draft: Partial<Phase3DraftState>) => void;
  onCommit: () => Promise<void>;
  isCommitting: boolean;
  onTestConnection?: (provider: 'lmstudio' | 'openrouter' | 'gemini') => Promise<boolean>;
}

const PROVIDER_ORDER: Array<'lmstudio' | 'openrouter' | 'gemini'> = ['lmstudio', 'openrouter', 'gemini'];

/**
 * Phase3ModelManager Component
 */
export const Phase3ModelManager: FC<Phase3ModelManagerProps> = ({
  phase3Draft,
  onUpdateDraft,
  onCommit,
  isCommitting,
  onTestConnection,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

  const handleProviderChange = (
    provider: 'lmstudio' | 'openrouter' | 'gemini',
    enabled: boolean
  ) => {
    const updatedProviders = {
      ...phase3Draft.providers,
      [provider]: {
        ...phase3Draft.providers[provider],
        enabled,
      },
    };

    // If enabling a provider, set as primary
    if (enabled) {
      onUpdateDraft({
        primaryProvider: provider,
        providers: updatedProviders,
      });
    } else {
      onUpdateDraft({ providers: updatedProviders });
    }
  };

  const handleProviderFieldChange = (
    provider: 'lmstudio' | 'openrouter' | 'gemini',
    field: 'endpoint' | 'model' | 'api_key',
    value: string
  ) => {
    const updatedProviders = {
      ...phase3Draft.providers,
      [provider]: {
        ...phase3Draft.providers[provider],
        [field]: value,
      },
    };
    onUpdateDraft({ providers: updatedProviders });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, maxWidth: '900px', margin: '0 auto' }}>
      {/* Privacy Notice */}
      <Alert severity="warning">
        <Typography variant="body2Bold" sx={{ mb: spacing.sm }}>
          {literal['onboarding.phase3.privacyWarningTitle']}
        </Typography>
        <Typography variant="body2">
          {literal['onboarding.phase3.privacyWarningBody']}
        </Typography>
      </Alert>

      {/* Info Alert */}
      <Alert severity="info">{literal['onboarding.phase3.help']}</Alert>

      {/* Primary Provider Selection */}
      <Card sx={{ p: spacing.lg, border: `1px solid ${muiTheme.palette.divider}` }}>
        <Typography variant="body2Bold" sx={{ mb: spacing.md }}>
          {literal['onboarding.phase3.primaryProviderLabel']}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.sm }}>
          {PROVIDER_ORDER.map((provider) => (
            <Button
              key={provider}
              variant={phase3Draft.primaryProvider === provider ? 'contained' : 'outlined'}
              onClick={() => onUpdateDraft({ primaryProvider: provider })}
              disabled={!phase3Draft.providers[provider].enabled}
            >
              {literal[`onboarding.phase3.provider.${provider}`]}
            </Button>
          ))}
        </Box>
      </Card>

      {/* Provider Configuration Cards */}
      <Stack spacing={spacing.md}>
        {PROVIDER_ORDER.map((provider) => (
          <ModelProviderForm
            key={provider}
            provider={provider}
            config={phase3Draft.providers[provider]}
            isPrimary={phase3Draft.primaryProvider === provider}
            onEnabledChange={(enabled) => handleProviderChange(provider, enabled)}
            onFieldChange={(field, value) => handleProviderFieldChange(provider, field as any, value)}
            onTestConnection={onTestConnection}
            validationErrors={phase3Draft.validationErrors[`providers.${provider}`] || []}
          />
        ))}
      </Stack>

      {/* Execution Policy */}
      <Card sx={{ p: spacing.lg, border: `1px solid ${muiTheme.palette.divider}` }}>
        <Typography variant="body2Bold" sx={{ mb: spacing.md }}>
          {literal['onboarding.phase3.executionPolicyTitle']}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.md }}>
          {/* These are typically not editable in UI, but shown for reference */}
          <Typography variant="micro">
            <strong>{literal['onboarding.phase3.timeoutLabel']}:</strong> {phase3Draft.executionPolicy.timeout_seconds}s
          </Typography>
          <Typography variant="micro">
            <strong>{literal['onboarding.phase3.retriesLabel']}:</strong> {phase3Draft.executionPolicy.max_retries}
          </Typography>
          <Typography variant="micro">
            <strong>{literal['onboarding.phase3.cacheLabel']}:</strong>{' '}
            {phase3Draft.executionPolicy.cache_responses ? literal['status.enabled'] : literal['status.disabled']}
          </Typography>
        </Box>
      </Card>

      {/* Validation Errors Summary */}
      {Object.keys(phase3Draft.validationErrors).length > 0 && (
        <Alert severity="error">{literal['onboarding.validationErrors']}</Alert>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end', marginTop: spacing.xl }}>
        <Button variant="outlined" disabled={isCommitting}>
          {literal['global.back']}
        </Button>
        <Button
          variant="contained"
          disabled={isCommitting}
          onClick={onCommit}
        >
          {isCommitting ? literal['onboarding.committing'] : literal['onboarding.complete']}
        </Button>
      </Box>
    </Box>
  );
};

export default Phase3ModelManager;
