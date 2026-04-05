import { FC, useState } from 'react';
import { Box, Typography, Button, useTheme as useMuiTheme, Card, CardContent, Stack, TextField, Alert, Divider } from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from 'astra';
import { InfrastructurePayload } from '../repo/InfrastructureRepo';
import { CronManagementContainer } from '../cron-management/view/CronManagementContainer';

interface InfrastructureProps {
  payload: InfrastructurePayload | null;
  isLoading: boolean;
  onRefresh: () => void;
  actionMessage: string | null;
  isGoogleActionRunning: boolean;
  onRunGoogleDriveSync: () => void;
  onEnsureGoogleDriveSyncSchedule: () => void;
  onPublishGooglePolicyDocument: (policyId: string, htmlContent: string) => void;
  onPullGoogleDocumentToVault: (documentId: string, vaultTargetPath: string) => void;
}

export const InfrastructureView: FC<InfrastructureProps> = ({
  payload,
  isLoading,
  onRefresh,
  actionMessage,
  isGoogleActionRunning,
  onRunGoogleDriveSync,
  onEnsureGoogleDriveSyncSchedule,
  onPublishGooglePolicyDocument,
  onPullGoogleDocumentToVault,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();
  const [policyId, setPolicyId] = useState('policy-demo');
  const [policyHtml, setPolicyHtml] = useState('<h1>Policy Draft</h1><p>Demo payload.</p>');
  const [documentId, setDocumentId] = useState('demo-doc');
  const [vaultTargetPath, setVaultTargetPath] = useState('org/google/demo-doc.md');

  return (
    <Box sx={{ p: spacing.xl, maxWidth: '1000px', mx: 'auto', animation: 'fadeIn 0.4s ease-out' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: spacing.xl }}>
        <Box>
           <Typography variant="h3" sx={{ color: muiTheme.palette.text.primary, mb: spacing.xs }}>
             {literal['infrastructure.title']}
           </Typography>
           <Typography variant="body1" sx={{ color: muiTheme.palette.text.secondary }}>
             {literal['infrastructure.subtitle']}
           </Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? literal['infrastructure.pinging'] : literal['infrastructure.pingIpcBridge']}
        </Button>
      </Box>

      {payload && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'space-between',
            p: spacing.lg, 
            backgroundColor: payload.crisisModeActive ? `${muiTheme.palette.error.main}10` : muiTheme.palette.background.paper, 
            border: `1px solid ${payload.crisisModeActive ? muiTheme.palette.error.main : muiTheme.palette.divider}`,
            borderRadius: '8px'
          }}>
             <Box>
               <Typography variant="micro" sx={{ color: payload.crisisModeActive ? muiTheme.palette.error.main : muiTheme.palette.text.secondary }}>{literal['infrastructure.stabilityMode']}</Typography>
               <Typography variant="h4" sx={{ color: payload.crisisModeActive ? muiTheme.palette.error.main : muiTheme.palette.success.main }}>
                 {payload.crisisModeActive ? literal['infrastructure.crisisProtocolActive'] : literal['infrastructure.nominal']}
               </Typography>
             </Box>
             <Box sx={{ textAlign: 'right' }}>
               <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>{literal['infrastructure.activeAgents']}</Typography>
               <Typography variant="h4" sx={{ color: muiTheme.palette.text.primary, fontVariantNumeric: 'tabular-nums' }}>
                 {payload.activeAgents.length}
               </Typography>
             </Box>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ color: muiTheme.palette.text.primary, mb: spacing.md }}>
              {literal['infrastructure.performanceTelemetry']}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
              {payload.metrics.map(metric => (
                <Box key={metric.id} sx={{ 
                  flex: '1 1 calc(33.333% - 16px)', 
                  p: spacing.md, 
                  backgroundColor: muiTheme.palette.background.paper, 
                  border: `1px solid ${muiTheme.palette.divider}`,
                  borderRadius: '8px'
                }}>
                  <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>{metric.label}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: spacing.sm, mt: spacing.xs }}>
                    <Typography variant="h5" sx={{ color: muiTheme.palette.text.primary, fontVariantNumeric: 'tabular-nums' }}>
                      {metric.value}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary, display: 'block', mt: spacing.xs }}>
                    {literal['infrastructure.target']}: {metric.threshold}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" sx={{ color: muiTheme.palette.text.primary }}>
                    Google Workspace Bridge
                  </Typography>
                  <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
                    Current sync status, scheduler registration, and document handoff controls.
                  </Typography>
                </Box>

                {actionMessage ? <Alert severity="success">{actionMessage}</Alert> : null}

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Card variant="outlined" sx={{ flex: 1 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                        Bridge Status
                      </Typography>
                      <Stack spacing={0.5}>
                        <Typography variant="body2">Mode: {payload.googleBridge?.mode ?? 'unavailable'}</Typography>
                        <Typography variant="body2">Sheets: {payload.googleBridge?.sheetsConnected ? 'connected' : 'disconnected'}</Typography>
                        <Typography variant="body2">Forms: {payload.googleBridge?.formsConnected ? 'connected' : 'disconnected'}</Typography>
                        <Typography variant="body2">Docs: {payload.googleBridge?.docsConnected ? 'connected' : 'disconnected'}</Typography>
                        <Typography variant="body2">
                          Last Sync: {payload.googleBridge?.latestSync?.finishedAt ?? 'none'}
                        </Typography>
                        <Typography variant="body2">
                          Last Result: {payload.googleBridge?.latestSync?.status ?? 'n/a'}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ flex: 1 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                        Bridge Actions
                      </Typography>
                      <Stack spacing={1}>
                        <Button variant="contained" disabled={isGoogleActionRunning} onClick={onRunGoogleDriveSync}>
                          Run Google Sync
                        </Button>
                        <Button variant="outlined" disabled={isGoogleActionRunning} onClick={onEnsureGoogleDriveSyncSchedule}>
                          Register Sync Schedule
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>

                <Divider />

                <Stack spacing={2}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Draft Publication
                  </Typography>
                  <TextField
                    label="Policy ID"
                    value={policyId}
                    onChange={(event) => setPolicyId(event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="HTML Content"
                    value={policyHtml}
                    onChange={(event) => setPolicyHtml(event.target.value)}
                    fullWidth
                    multiline
                    minRows={4}
                  />
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <Button
                      variant="contained"
                      disabled={isGoogleActionRunning}
                      onClick={() => onPublishGooglePolicyDocument(policyId, policyHtml)}
                    >
                      Publish Policy Doc
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={isGoogleActionRunning}
                      onClick={() => onPullGoogleDocumentToVault(documentId, vaultTargetPath)}
                    >
                      Pull Document To Vault
                    </Button>
                  </Stack>
                </Stack>

                <Stack spacing={2}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Pull / Handoff
                  </Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Google Document ID"
                      value={documentId}
                      onChange={(event) => setDocumentId(event.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Vault Target Path"
                      value={vaultTargetPath}
                      onChange={(event) => setVaultTargetPath(event.target.value)}
                      fullWidth
                    />
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

        </Box>
      )}

      <CronManagementContainer />
    </Box>
  );
};
