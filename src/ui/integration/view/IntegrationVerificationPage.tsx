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
import { useBranding, type PranaBrandingConfig } from '../../constants/pranaConfig';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

const REQUIRED_RENDERER_FIELDS = [
  'appBrandName',
  'appTitlebarTagline',
  'appSplashSubtitle',
  'directorSenderName',
  'directorSenderEmail',
] as const;

type RendererField = (typeof REQUIRED_RENDERER_FIELDS)[number];

interface RendererKeyStatus {
  key: RendererField;
  present: boolean;
}

interface RuntimeIntegrationKeyStatus {
  key: string;
  expectedType: 'string' | 'number' | 'boolean';
  present: boolean;
  valid: boolean;
  source: 'config' | 'missing';
  issue?: 'missing' | 'invalid_string' | 'invalid_number' | 'invalid_boolean';
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
  errors?: string[];
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
  vaidyar: VaidyarReport | null;
  rendererKeys: RendererKeyStatus[];
  errors: string[];
}

type VaidyarLayerName = 'Storage' | 'Security' | 'Network' | 'Cognitive';
type VaidyarLayerStatus = 'Healthy' | 'Degraded' | 'Blocked';
type VaidyarCheckStatus = 'Healthy' | 'Degraded' | 'Blocked';

interface VaidyarCheckResult {
  check_id: string;
  status: VaidyarCheckStatus;
  message: string;
  severity: 'low' | 'medium' | 'high';
  failure_hint: string;
  latency_ms: number;
}

interface VaidyarLayerReport {
  name: VaidyarLayerName;
  status: VaidyarLayerStatus;
  checks: VaidyarCheckResult[];
}

interface VaidyarReport {
  timestamp: string;
  overall_status: VaidyarLayerStatus;
  execution_mode: 'bootstrap' | 'pulse' | 'on-demand';
  blocked_signals: string[];
  layers: VaidyarLayerReport[];
}

interface IntegrationVerificationPageProps {
  onProceed?: () => void;
}

const collectRendererStatus = (branding: Partial<PranaBrandingConfig>): RendererKeyStatus[] => {
  return REQUIRED_RENDERER_FIELDS.map((key) => ({
    key,
    present: Boolean(branding[key]?.trim()),
  }));
};

const collectRuntimeStatus = async (): Promise<{
  runtime: RuntimeIntegrationStatus | null;
  vaidyar: VaidyarReport | null;
  errors: string[];
  bridgeAvailable: boolean;
}> => {
  const errors: string[] = [];

  if (!window.api?.app?.getIntegrationStatus) {
    errors.push('Missing preload bridge: window.api.app.getIntegrationStatus');
    return {
      runtime: null,
      vaidyar: null,
      errors,
      bridgeAvailable: false,
    };
  }

  try {
    const [runtime, vaidyar] = await Promise.all([
      safeIpcCall<RuntimeIntegrationStatus>(
      'app.getIntegrationStatus',
      () => window.api.app.getIntegrationStatus(),
      (value) => typeof value === 'object' && value !== null,
      ),
      window.api.app.getVaidyarReport
        ? safeIpcCall<VaidyarReport>(
            'app.getVaidyarReport',
            () => window.api.app.getVaidyarReport(),
            (value) => typeof value === 'object' && value !== null,
          ).catch(() => null)
        : Promise.resolve(null),
    ]);

    return {
      runtime,
      vaidyar,
      errors,
      bridgeAvailable: true,
    };
  } catch {
    errors.push('Unable to fetch runtime integration status from main process.');
    return {
      runtime: null,
      vaidyar: null,
      errors,
      bridgeAvailable: true,
    };
  }
};

const getStatusColor = (status: VaidyarLayerStatus | VaidyarCheckStatus): 'success.main' | 'warning.main' | 'error.main' => {
  if (status === 'Healthy') {
    return 'success.main';
  }
  if (status === 'Degraded') {
    return 'warning.main';
  }
  return 'error.main';
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
  const branding = useBranding();
  const muiTheme = useMuiTheme();
  const [loading, setLoading] = useState(true);
  const [refreshingVaidyar, setRefreshingVaidyar] = useState(false);
  const [snapshot, setSnapshot] = useState<IntegrationSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async (forceVaidyarPulse: boolean = false) => {
      setLoading(true);
      const rendererKeys = collectRendererStatus(branding);
      if (forceVaidyarPulse) {
        await safeIpcCall(
          'app.runVaidyarOnDemand',
          () => window.api.app.runVaidyarOnDemand(),
          () => true,
        ).catch(() => null);
      }
      const runtimeResult = await collectRuntimeStatus();

      if (!mounted) {
        return;
      }

      setSnapshot({
        timestamp: new Date().toISOString(),
        bridgeAvailable: runtimeResult.bridgeAvailable,
        runtime: runtimeResult.runtime,
        startup: null,
        vaidyar: runtimeResult.vaidyar,
        rendererKeys,
        errors: runtimeResult.errors,
      });
      setLoading(false);
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [branding]);

  const refreshVaidyar = async (): Promise<void> => {
    setRefreshingVaidyar(true);
    const rendererKeys = collectRendererStatus(branding);

    await safeIpcCall(
      'app.runVaidyarOnDemand',
      () => window.api.app.runVaidyarOnDemand(),
      () => true,
    ).catch(() => null);

    const runtimeResult = await collectRuntimeStatus();
    setSnapshot({
      timestamp: new Date().toISOString(),
      bridgeAvailable: runtimeResult.bridgeAvailable,
      runtime: runtimeResult.runtime,
      startup: null,
      vaidyar: runtimeResult.vaidyar,
      rendererKeys,
      errors: runtimeResult.errors,
    });
    setRefreshingVaidyar(false);
  };

  const rendererSummary = useMemo(() => summarizeAvailability(snapshot?.rendererKeys ?? []), [snapshot]);

  const runtimeReady = snapshot?.runtime?.ready ?? false;
  const rendererReady = rendererSummary.total > 0 && rendererSummary.missing === 0;

  const pageReady = Boolean(
    snapshot?.bridgeAvailable &&
      runtimeReady &&
      rendererReady &&
      (snapshot?.errors.length ?? 0) === 0,
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
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          Vaidyar Runtime Integrity
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Mode: {snapshot?.vaidyar?.execution_mode ?? 'n/a'}
                        </Typography>
                      </Box>
                      <Button variant="outlined" size="small" onClick={() => void refreshVaidyar()} disabled={refreshingVaidyar}>
                        {refreshingVaidyar ? 'Refreshing…' : 'Run On-Demand Check'}
                      </Button>
                    </Stack>

                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      Overall Status:{' '}
                      <Typography component="span" fontWeight={700} color={getStatusColor(snapshot?.vaidyar?.overall_status ?? 'Degraded')}>
                        {snapshot?.vaidyar?.overall_status ?? 'Unavailable'}
                      </Typography>
                    </Typography>

                    {snapshot?.vaidyar?.blocked_signals && snapshot.vaidyar.blocked_signals.length > 0 ? (
                      <Alert severity="error" sx={{ mt: 1.5 }}>
                        Blocked Signals: {snapshot.vaidyar.blocked_signals.join(', ')}
                      </Alert>
                    ) : null}

                    <List dense sx={{ mt: 1 }}>
                      {(snapshot?.vaidyar?.layers ?? []).map((layer) => (
                        <ListItem key={layer.name} disableGutters sx={{ display: 'block', py: 1 }}>
                          <Typography variant="body2" fontWeight={700} color={getStatusColor(layer.status)}>
                            {layer.name}: {layer.status}
                          </Typography>
                          <List dense disablePadding>
                            {layer.checks.map((check) => (
                              <ListItem key={check.check_id} disableGutters sx={{ pl: 1 }}>
                                <ListItemText
                                  primary={`${check.check_id} (${check.severity.toUpperCase()})`}
                                  secondary={`${check.status} · ${check.message} · ${check.latency_ms}ms${
                                    check.status !== 'Healthy' ? ` · Hint: ${check.failure_hint}` : ''
                                  }`}
                                  secondaryTypographyProps={{
                                    color: getStatusColor(check.status),
                                  }}
                                />
                              </ListItem>
                            ))}
                          </List>
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
