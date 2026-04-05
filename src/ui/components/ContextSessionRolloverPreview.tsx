import { FC, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  TextField,
  useTheme as useMuiTheme,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

interface ContextNewSessionPreview {
  sourceSessionId: string;
  suggestedSessionId: string;
  summary: string;
  generatedAt: string;
}

interface SessionRolloverPreviewProps {
  sourceSessionId: string;
  open: boolean;
  onClose: () => void;
  onConfirm?: (targetSessionId: string, summary?: string) => void;
  onCancel?: () => void;
}

export const SessionRolloverPreviewModal: FC<SessionRolloverPreviewProps> = ({
  sourceSessionId,
  open,
  onClose,
  onConfirm,
  onCancel,
}) => {
  const theme = useMuiTheme();
  const [preview, setPreview] = useState<ContextNewSessionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [summaryOverride, setSummaryOverride] = useState<string>('');

  const fetchPreview = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await safeIpcCall('context:prepare-new-context', async () => {
        return (window as any).api.context?.prepareNewContext({
          sessionId: sourceSessionId,
        });
      });

      if (result?.suggestedSessionId) {
        setPreview(result as ContextNewSessionPreview);
        setSummaryOverride('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate session preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchPreview();
    }
  }, [open, sourceSessionId]);

  const handleConfirm = async (): Promise<void> => {
    if (!preview) return;

    setConfirming(true);
    try {
      await safeIpcCall('context:start-new-with-context', async () => {
        return (window as any).api.context?.startNewWithContext({
          sourceSessionId: preview.sourceSessionId,
          targetSessionId: preview.suggestedSessionId,
          summaryOverride: summaryOverride.trim() || undefined,
        });
      });

      onConfirm?.(preview.suggestedSessionId, summaryOverride || preview.summary);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start new session');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = (): void => {
    onCancel?.();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6">Session Rollover Preview</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
            {sourceSessionId}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && preview && (
          <Stack spacing={3}>
            {/* Source Session */}
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Current Session
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {preview.sourceSessionId}
              </Typography>
            </Paper>

            {/* Arrow */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <ArrowForwardIcon
                sx={{ transform: 'rotate(-90deg)', color: 'primary.main', fontSize: 32 }}
              />
            </Box>

            {/* Target Session */}
            <Paper sx={{ p: 2, bgcolor: 'primary.lighter', border: `2px solid ${theme.palette.primary.main}` }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                New Session
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  bgcolor: 'background.paper',
                  p: 1,
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  wordBreak: 'break-all',
                }}
              >
                {preview.suggestedSessionId}
              </Typography>
            </Paper>

            <Divider />

            {/* Summary */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Carryover Summary
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary' }}>
                The following summary will be carried over to preserve context continuity.
              </Typography>
              <Paper
                sx={{
                  p: 1.5,
                  bgcolor: 'background.paper',
                  maxHeight: 200,
                  overflow: 'auto',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  mb: 2,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                {preview.summary}
              </Paper>

              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                (Optional) Override Summary
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary' }}>
                Leave empty to use the auto-generated summary above.
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Enter custom summary here (optional)..."
                value={summaryOverride}
                onChange={(e) => setSummaryOverride(e.target.value)}
                disabled={confirming}
                variant="outlined"
                size="small"
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'info.lighter', borderRadius: 1 }}>
              <CheckCircleIcon sx={{ color: 'info.main', fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: 'info.dark' }}>
                The original session will be archived and remain queryable via digest history.
              </Typography>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} disabled={confirming}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!preview || confirming || loading}
          startIcon={confirming ? <CircularProgress size={20} /> : <ArrowForwardIcon />}
        >
          {confirming ? 'Starting...' : 'Start New Session'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
