/**
 * ModelProviderForm Component
 * Configuration form for individual model providers (LM Studio, OpenRouter, Gemini)
 */

import { FC, useState } from 'react';
import {
  Box,
  Card,
  TextField,
  Checkbox,
  Typography,
  IconButton,
  useTheme as useMuiTheme,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';
import { ModelProviderConfig } from '../../domain/onboarding.types';
import TestTubesIcon from '@mui/icons-material/Science';

interface ModelProviderFormProps {
  provider: 'lmstudio' | 'openrouter' | 'gemini';
  config: ModelProviderConfig;
  isPrimary: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onFieldChange: (field: 'endpoint' | 'model' | 'api_key', value: string) => void;
  onTestConnection?: (provider: 'lmstudio' | 'openrouter' | 'gemini') => Promise<boolean>;
  validationErrors: string[];
}

/**
 * ModelProviderForm Component
 */
export const ModelProviderForm: FC<ModelProviderFormProps> = ({
  provider,
  config,
  isPrimary,
  onEnabledChange,
  onFieldChange,
  onTestConnection,
  validationErrors,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<boolean | null>(null);

  const handleTestConnection = async () => {
    if (!onTestConnection) return;

    setIsTestingConnection(true);
    setTestConnectionResult(null);

    try {
      const result = await onTestConnection(provider);
      setTestConnectionResult(result);
    } catch {
      setTestConnectionResult(false);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const providerTitle = literal[`onboarding.phase3.provider.${provider}`];

  return (
    <Card
      sx={{
        p: spacing.lg,
        border: `2px solid ${isPrimary ? muiTheme.palette.primary.main : muiTheme.palette.divider}`,
        backgroundColor: isPrimary ? muiTheme.palette.primary.light : muiTheme.palette.background.paper,
        transition: 'all 0.2s',
      }}
    >
      {/* Header: Provider Name + Enable Checkbox + Primary Badge */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.md }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Checkbox
            checked={config.enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          <Typography variant="body2Bold">{providerTitle}</Typography>
          {isPrimary && (
            <Typography
              variant="micro"
              sx={{
                padding: '2px 8px',
                backgroundColor: muiTheme.palette.primary.main,
                color: muiTheme.palette.primary.contrastText,
                borderRadius: '12px',
              }}
            >
              {literal['onboarding.phase3.primaryBadge']}
            </Typography>
          )}
        </Box>

        {/* Test Connection Button */}
        {config.enabled && (
          <IconButton
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            size="small"
            title={literal['onboarding.phase3.testConnectionButton']}
          >
            {isTestingConnection ? <CircularProgress size={20} /> : <TestTubesIcon fontSize="small" />}
          </IconButton>
        )}
      </Box>

      {/* Test Connection Result */}
      {testConnectionResult !== null && (
        <Alert
          severity={testConnectionResult ? 'success' : 'error'}
          sx={{ mb: spacing.md }}
        >
          {testConnectionResult
            ? literal['onboarding.phase3.connectionSuccess']
            : literal['onboarding.phase3.connectionFailed']}
        </Alert>
      )}

      {/* Configuration Fields */}
      {config.enabled && (
        <Stack spacing={spacing.md}>
          {/* Endpoint */}
          <TextField
            fullWidth
            label={literal['onboarding.phase3.endpointLabel']}
            value={config.endpoint}
            onChange={(e) => onFieldChange('endpoint', e.target.value)}
            size="small"
            placeholder={
              provider === 'lmstudio'
                ? 'http://localhost:1234/v1'
                : provider === 'openrouter'
                  ? 'https://openrouter.ai/api/v1'
                  : 'https://generativelanguage.googleapis.com/v1beta/openai/'
            }
          />

          {/* Model Name */}
          <TextField
            fullWidth
            label={literal['onboarding.phase3.modelLabel']}
            value={config.model}
            onChange={(e) => onFieldChange('model', e.target.value)}
            size="small"
            placeholder={
              provider === 'lmstudio'
                ? 'mistral-7b-instruct'
                : provider === 'openrouter'
                  ? 'anthropic/claude-3-sonnet'
                  : 'gemini-2.0-flash'
            }
          />

          {/* API Key (optional for LM Studio, required for others) */}
          {provider !== 'lmstudio' && (
            <TextField
              fullWidth
              label={literal['onboarding.phase3.apiKeyLabel']}
              type="password"
              value={config.api_key}
              onChange={(e) => onFieldChange('api_key', e.target.value)}
              size="small"
              placeholder={`${provider}-*****`}
              helperText={literal['onboarding.phase3.apiKeyHelper']}
            />
          )}

          {/* Fallback Provider */}
          {config.fallback_to && (
            <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
              {literal['onboarding.phase3.fallbackLabel']}: {config.fallback_to}
            </Typography>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert severity="error">
              {validationErrors.map((error, idx) => (
                <Typography key={idx} variant="body2">
                  • {error}
                </Typography>
              ))}
            </Alert>
          )}
        </Stack>
      )}

      {/* Disabled State */}
      {!config.enabled && (
        <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary, fontStyle: 'italic' }}>
          {literal['onboarding.phase3.disabledHint']}
        </Typography>
      )}
    </Card>
  );
};

export default ModelProviderForm;
