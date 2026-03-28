import { FC, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
  useTheme as useMuiTheme,
} from '@mui/material';

const REQUIRED_RENDERER_KEYS = [
  'VITE_APP_BRAND_NAME',
  'VITE_APP_TITLEBAR_TAGLINE',
  'VITE_APP_SPLASH_SUBTITLE',
  'VITE_DIRECTOR_SENDER_NAME',
  'VITE_DIRECTOR_SENDER_EMAIL',
] as const;

type RendererKey = (typeof REQUIRED_RENDERER_KEYS)[number];

interface RendererKeyStatus {
  key: RendererKey;
  present: boolean;
}

interface RuntimeIntegrationKeyStatus {
  key: string;
  legacyKey: string;
  expectedType: 'string' | 'number' | 'boolean';
  present: boolean;
  valid: boolean;
  source: 'neutral' | 'legacy' | 'missing';
  issue?: 'missing' | 'invalid_number' | 'invalid_boolean';
}

interface RuntimeIntegrationStatus {
  ready: boolean;
  summary: {
    total: number;
    available: number;
    missing: number;
    invalid: number;
  };
  keys: RuntimeIntegrationKeyStatus[];
}

interface StartupStageReport {
  id: string;
  label: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface StartupStatusReport {
  startedAt: string;
  finishedAt: string | null;
  overallStatus: 'READY' | 'DEGRADED' | 'BLOCKED';
  stages: StartupStageReport[];
}

interface IntegrationSnapshot {
  timestamp: string;
  bridgeAvailable: boolean;
  runtime: RuntimeIntegrationStatus | null;
  startup: StartupStatusReport | null;
  rendererKeys: RendererKeyStatus[];
  errors: string[];
}

interface IntegrationVerificationPageProps {
  onProceed?: () => void;
}

const collectRendererStatus = (): RendererKeyStatus[] => {
  return REQUIRED_RENDERER_KEYS.map((key) => ({
    key,
    present: Boolean(import.meta.env[key]?.trim()),
  }));
};

const collectRuntimeStatus = async (): Promise<{
  runtime: RuntimeIntegrationStatus | null;
  startup: StartupStatusReport | null;
  errors: string[];
  bridgeAvailable: boolean;
}> => {
  const errors: string[] = [];

  if (!window.api?.app?.getIntegrationStatus) {
    errors.push('Missing preload bridge: window.api.app.getIntegrationStatus');
    return {
      runtime: null,
      startup: null,
      errors,
      bridgeAvailable: false,
    };
  }

  try {
    const runtime = (await window.api.app.getIntegrationStatus()) as RuntimeIntegrationStatus;
    const startup = window.api?.app?.getStartupStatus
      ? ((await window.api.app.getStartupStatus()) as StartupStatusReport)
      : null;
    return {
      runtime,
      startup,
      errors,
      bridgeAvailable: true,
    };
  } catch {
    errors.push('Unable to fetch runtime integration status from main process.');
    return {
      runtime: null,
      startup: null,
      errors,
      bridgeAvailable: true,
    };
  }
};

const summarizeAvailability = (rendererKeys: RendererKeyStatus[]) => {
  const total = rendererKeys.length;
  const available = rendererKeys.filter((entry) => entry.present).length;
  return {
    total,
    available,
    missing: total - available,
  };
};

export const IntegrationVerificationPage: FC<IntegrationVerificationPageProps> = ({ onProceed }) => {
  const muiTheme = useMuiTheme();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<IntegrationSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      const rendererKeys = collectRendererStatus();
      const runtimeResult = await collectRuntimeStatus();

      if (!mounted) {
        return;
      }

      setSnapshot({
        timestamp: new Date().toISOString(),
        bridgeAvailable: runtimeResult.bridgeAvailable,
        runtime: runtimeResult.runtime,
        startup: runtimeResult.startup,
        rendererKeys,
        errors: runtimeResult.errors,
      });
      setLoading(false);
    };

    void run();

    return () => {
      mounted = false;
    };
  }, []);

  const rendererSummary = useMemo(() => summarizeAvailability(snapshot?.rendererKeys ?? []), [snapshot]);

  const runtimeReady = snapshot?.runtime?.ready ?? false;
  const rendererReady = rendererSummary.total > 0 && rendererSummary.missing === 0;
  const startupStages = snapshot?.startup?.stages ?? [];
  const requiredStageIds = new Set(['integration', 'governance', 'vault']);
  const requiredStartupStagesReady = startupStages
    .filter((stage) => requiredStageIds.has(stage.id))
    .every((stage) => stage.status === 'SUCCESS');

  const pageReady = Boolean(
    snapshot?.bridgeAvailable &&
      runtimeReady &&
      rendererReady &&
      (snapshot?.errors.length ?? 0) === 0 &&
      requiredStartupStagesReady,
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(140deg, ${muiTheme.palette.background.default} 0%, ${muiTheme.palette.background.paper} 100%)`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 3,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 980, borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2.5}>
            <Typography variant="h5" fontWeight={700}>
              Prana Integration Verification
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Startup contract check before login. Only key names are shown. No secret values are exposed.
            </Typography>

            {loading ? (
              <Stack direction="row" spacing={2} alignItems="center">
                <CircularProgress size={20} />
                <Typography variant="body2">Validating integration contract...</Typography>
              </Stack>
            ) : (
              <>
                {pageReady ? (
                  <Alert severity="success">Integration contract verified. Client app can proceed to authentication flow.</Alert>
                ) : (
                  <Alert severity="error">Integration contract failed. Fix missing or invalid keys before login.</Alert>
                )}

                {snapshot && snapshot.errors.length > 0 ? (
                  <Alert severity="warning">
                    <List dense>
                      {snapshot.errors.map((error) => (
                        <ListItem key={error} disableGutters>
                          <ListItemText primary={error} />
                        </ListItem>
                      ))}
                    </List>
                  </Alert>
                ) : null}

                <Divider />

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Card variant="outlined" sx={{ flex: 1 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={600}>
                        Renderer Keys
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Available: {rendererSummary.available}/{rendererSummary.total}
                      </Typography>
                      <List dense>
                        {(snapshot?.rendererKeys ?? []).map((entry) => (
                          <ListItem key={entry.key} disableGutters>
                            <ListItemText
                              primary={entry.key}
                              secondary={entry.present ? 'AVAILABLE' : 'MISSING'}
                              secondaryTypographyProps={{
                                color: entry.present ? 'success.main' : 'error.main',
                              }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ flex: 1 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={600}>
                        Main Runtime Keys
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Available: {snapshot?.runtime?.summary.available ?? 0}/{snapshot?.runtime?.summary.total ?? 0} | Invalid:{' '}
                        {snapshot?.runtime?.summary.invalid ?? 0}
                      </Typography>
                      <List dense>
                        {(snapshot?.runtime?.keys ?? []).map((entry) => (
                          <ListItem key={entry.key} disableGutters>
                            <ListItemText
                              primary={entry.key}
                              secondary={
                                !entry.present
                                  ? 'MISSING'
                                  : entry.valid
                                    ? `AVAILABLE (${entry.source.toUpperCase()})`
                                    : `INVALID (${entry.issue})`
                              }
                              secondaryTypographyProps={{
                                color: !entry.present || !entry.valid ? 'error.main' : 'success.main',
                              }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Stack>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Startup Orchestration
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Overall: {snapshot?.startup?.overallStatus ?? 'UNKNOWN'}
                    </Typography>

                    <List dense>
                      {(snapshot?.startup?.stages ?? []).map((stage) => (
                        <ListItem key={stage.id} disableGutters>
                          <ListItemText
                            primary={stage.label}
                            secondary={`${stage.status} | ${stage.message}`}
                            secondaryTypographyProps={{
                              color:
                                stage.status === 'SUCCESS'
                                  ? 'success.main'
                                  : stage.status === 'FAILED'
                                    ? 'error.main'
                                    : 'warning.main',
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>

                <Typography variant="caption" color="text.secondary">
                  Checked at: {snapshot?.timestamp}
                </Typography>

                <Stack direction="row" justifyContent="flex-end">
                  <Button variant="contained" disabled={!pageReady} onClick={() => onProceed?.()}>
                    Continue To Splash
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
