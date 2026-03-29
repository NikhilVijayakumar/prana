import { FC, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
  useTheme as useMuiTheme,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from 'astra';
import { useNavigate } from 'react-router-dom';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

interface RuntimeChannelConfigurationPayload {
  provider: string;
  allowedChannels: string[];
  approvedAgentsForChannels: Record<string, string[]>;
  channelAccessRules: string;
  telegramChannelId: string;
  webhookSubscriptionUri: string;
  providerCredentials: string;
}

interface RuntimeChannelConfigurationForm {
  provider: string;
  telegramChannelId: string;
  webhookSubscriptionUri: string;
  providerCredentials: string;
  channelAccessRules: string;
  allowAllAgentsTelegram: boolean;
  approvedTelegramAgentsCsv: string;
  googleCredentialsPath?: string;
  mcpServerCommand?: string;
}

const createDefaultForm = (): RuntimeChannelConfigurationForm => ({
  provider: 'telegram',
  telegramChannelId: '',
  webhookSubscriptionUri: '',
  providerCredentials: '',
  channelAccessRules: 'director_only_inbound=true; allow_all_agents_telegram=true',
  allowAllAgentsTelegram: true,
  approvedTelegramAgentsCsv: '',
  googleCredentialsPath: '',
  mcpServerCommand: '',
});

const parseCsv = (raw: string): string[] => {
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
};

export const OnboardingChannelConfigurationContainer: FC = () => {
  const { literal } = useLanguage();
  const muiTheme = useMuiTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState<RuntimeChannelConfigurationForm>(createDefaultForm());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let active = true;

    const loadConfiguration = async () => {
      setIsLoading(true);
      try {
        const payload = await safeIpcCall<RuntimeChannelConfigurationPayload>(
          'operations.getRuntimeChannelConfiguration',
          () => window.api.operations.getRuntimeChannelConfiguration(),
          (value) => typeof value === 'object' && value !== null,
        );
        if (!active) {
          return;
        }

        const approvedTelegramAgents = Object.entries(payload.approvedAgentsForChannels)
          .filter(([, channels]) => (channels as string[]).map((channel) => channel.toLowerCase()).includes('telegram'))
          .map(([agentId]) => agentId)
          .sort((left, right) => left.localeCompare(right));

        setForm({
          provider: payload.provider || 'telegram',
          telegramChannelId: payload.telegramChannelId,
          webhookSubscriptionUri: payload.webhookSubscriptionUri,
          providerCredentials: payload.providerCredentials,
          channelAccessRules: payload.channelAccessRules,
          allowAllAgentsTelegram: approvedTelegramAgents.length === 0,
          approvedTelegramAgentsCsv: approvedTelegramAgents.join(', '),
          googleCredentialsPath: '', // Will parse from an expanded ruleset in real implementation
          mcpServerCommand: '',
        });
      } catch {
        if (active) {
          setFeedback({
            severity: 'error',
            message: literal['settings.channels.errorLoad'],
          });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadConfiguration();

    return () => {
      active = false;
    };
  }, [literal]);

  const updateField = (field: keyof RuntimeChannelConfigurationForm, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (connectionStatus === 'success' || connectionStatus === 'error') {
      setConnectionStatus('idle'); // Reset testing state if form changes
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('testing');
    setFeedback(null);
    try {
      // Mock validation logic
      await new Promise(resolve => setTimeout(resolve, 800));
      if (!form.providerCredentials && !form.googleCredentialsPath) {
         throw new Error("Missing required credentials");
      }
      setConnectionStatus('success');
      setFeedback({ severity: 'success', message: 'Connection Tested Successfully!' });
    } catch {
      setConnectionStatus('error');
      setFeedback({ severity: 'error', message: 'Connection Test Failed. Invalid tokens.' });
    } finally {
      setIsTesting(false);
    }
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const approvedAgentsForChannels = form.allowAllAgentsTelegram
        ? {}
        : Object.fromEntries(parseCsv(form.approvedTelegramAgentsCsv).map((agentId) => [agentId, ['telegram']]));

      const updated = await safeIpcCall<RuntimeChannelConfigurationPayload>(
        'operations.updateRuntimeChannelConfiguration',
        () =>
          window.api.operations.updateRuntimeChannelConfiguration({
            provider: form.provider.trim() || 'telegram',
            allowedChannels: ['internal-chat', 'telegram'],
            approvedAgentsForChannels,
            channelAccessRules: form.channelAccessRules.trim(),
            telegramChannelId: form.telegramChannelId.trim(),
            webhookSubscriptionUri: form.webhookSubscriptionUri.trim(),
            providerCredentials: form.providerCredentials.trim(),
          }),
        (value) => typeof value === 'object' && value !== null,
      );

      const approvedTelegramAgents = Object.entries(updated.approvedAgentsForChannels)
        .filter(([, channels]) => (channels as string[]).map((channel) => channel.toLowerCase()).includes('telegram'))
        .map(([agentId]) => agentId)
        .sort((left, right) => left.localeCompare(right));

      setForm({
        provider: updated.provider || 'telegram',
        telegramChannelId: updated.telegramChannelId,
        webhookSubscriptionUri: updated.webhookSubscriptionUri,
        providerCredentials: updated.providerCredentials,
        channelAccessRules: updated.channelAccessRules,
        allowAllAgentsTelegram: approvedTelegramAgents.length === 0,
        approvedTelegramAgentsCsv: approvedTelegramAgents.join(', '),
      });

      setFeedback({
        severity: 'success',
        message: literal['settings.channels.successSave'],
      });
    } catch {
      setFeedback({
        severity: 'error',
        message: literal['settings.channels.errorSave'],
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: spacing.xl, width: '100%', display: 'flex', justifyContent: 'center' }}>
      <Card
        sx={{
          width: 'min(860px, 100%)',
          p: spacing.xl,
          border: `1px solid ${muiTheme.palette.divider}`,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.md,
        }}
      >
        <Typography variant="h4">{literal['settings.channels.title']}</Typography>
        <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
          {literal['settings.channels.description']}
        </Typography>

        {feedback && <Alert severity={feedback.severity}>{feedback.message}</Alert>}

        <TextField
          size="small"
          label={literal['settings.channels.provider']}
          value={form.provider}
          onChange={(event) => updateField('provider', event.target.value)}
          disabled={isLoading || isSaving}
        />
        <TextField
          size="small"
          label={literal['settings.channels.telegramChannelId']}
          value={form.telegramChannelId}
          onChange={(event) => updateField('telegramChannelId', event.target.value)}
          disabled={isLoading || isSaving}
        />
        <TextField
          size="small"
          label={literal['settings.channels.webhookSubscriptionUri']}
          value={form.webhookSubscriptionUri}
          onChange={(event) => updateField('webhookSubscriptionUri', event.target.value)}
          disabled={isLoading || isSaving}
        />
        <TextField
          size="small"
          type="password"
          label={literal['settings.channels.providerCredentials']}
          value={form.providerCredentials}
          onChange={(event) => updateField('providerCredentials', event.target.value)}
          disabled={isLoading || isSaving}
        />

        <FormControlLabel
          control={
            <Switch
              checked={form.allowAllAgentsTelegram}
              onChange={(event) => updateField('allowAllAgentsTelegram', event.target.checked)}
              disabled={isLoading || isSaving}
            />
          }
          label={literal['settings.channels.allowAllAgentsTelegram']}
        />

        {!form.allowAllAgentsTelegram && (
          <TextField
            size="small"
            label={literal['settings.channels.approvedTelegramAgents']}
            placeholder={literal['settings.channels.approvedTelegramAgentsPlaceholder']}
            value={form.approvedTelegramAgentsCsv}
            onChange={(event) => updateField('approvedTelegramAgentsCsv', event.target.value)}
            disabled={isLoading || isSaving}
          />
        )}

        <TextField
          size="small"
          label="Google Workspace Credentials Path (Absolute)"
          placeholder="C:\path\to\credentials.json"
          value={form.googleCredentialsPath}
          onChange={(event) => updateField('googleCredentialsPath', event.target.value)}
          disabled={isLoading || isSaving}
        />

        <TextField
          size="small"
          label="MCP Server Command"
          placeholder="npx @modelcontextprotocol/server-brave-search"
          value={form.mcpServerCommand}
          onChange={(event) => updateField('mcpServerCommand', event.target.value)}
          disabled={isLoading || isSaving}
        />

        <TextField
          size="small"
          multiline
          minRows={3}
          label={literal['settings.channels.accessRules']}
          value={form.channelAccessRules}
          onChange={(event) => updateField('channelAccessRules', event.target.value)}
          disabled={isLoading || isSaving}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: spacing.md }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            {connectionStatus === 'success' && (
               <Typography variant="body2Bold" sx={{ color: 'success.main', display: 'flex', alignItems: 'center', gap: '4px' }}>
                 <CheckCircleOutlineIcon fontSize="small"/> Connected
               </Typography>
            )}
            {connectionStatus === 'error' && (
               <Typography variant="body2Bold" sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: '4px' }}>
                 <ErrorOutlineIcon fontSize="small"/> Error
               </Typography>
            )}
            {connectionStatus === 'testing' && (
               <Typography variant="body2Bold" sx={{ color: 'text.secondary' }}>
                 Testing...
               </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: spacing.sm }}>
            <Button variant="outlined" onClick={testConnection} disabled={isLoading || isSaving || isTesting}>
              Test Connection
            </Button>
            <Button variant="contained" onClick={saveConfiguration} disabled={isLoading || isSaving}>
              {literal['settings.channels.save']}
            </Button>
            <Button variant="contained" color="secondary" onClick={() => navigate('/triage')} disabled={connectionStatus !== 'success'}>
              Next
            </Button>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};
