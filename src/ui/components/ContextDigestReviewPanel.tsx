import { FC, useEffect, useState } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Paper,
  useTheme as useMuiTheme,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

interface StoredHistoryDigest {
  id: string;
  sessionId: string;
  summary: string;
  metadataJson: string;
  beforeTokens: number;
  afterTokens: number;
  removedMessages: number;
  compactedAt: string;
  createdAt: string;
}

interface DigestReviewPanelProps {
  sessionId: string;
  open: boolean;
  onClose: () => void;
  onSelectDigest?: (digest: StoredHistoryDigest) => void;
}

interface ExpandedDigest {
  [key: string]: boolean;
}

export const DigestReviewPanel: FC<DigestReviewPanelProps> = ({
  sessionId,
  open,
  onClose,
  onSelectDigest,
}) => {
  const theme = useMuiTheme();
  const [digests, setDigests] = useState<StoredHistoryDigest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedDigest>({});
  const [selectedDigest, setSelectedDigest] = useState<StoredHistoryDigest | null>(null);

  const fetchDigests = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await safeIpcCall('context:list-digests', async () => {
        return (window as any).api.context?.listDigests({
          sessionId,
          limit: 20,
        });
      });

      if (Array.isArray(result)) {
        setDigests(result as StoredHistoryDigest[]);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch digests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchDigests();
    }
  }, [open, sessionId]);

  const handleToggleExpand = (digestId: string): void => {
    setExpanded((prev) => ({
      ...prev,
      [digestId]: !prev[digestId],
    }));
  };

  const handleSelectDigest = (digest: StoredHistoryDigest): void => {
    setSelectedDigest(digest);
    onSelectDigest?.(digest);
  };

  const renderSummaryPreview = (summary: string, isExpanded: boolean): string => {
    if (isExpanded) {
      return summary;
    }
    return summary.length > 200 ? `${summary.slice(0, 200)}...` : summary;
  };

  const parseMetadata = (metadataJson: string): Record<string, any> => {
    try {
      return JSON.parse(metadataJson);
    } catch {
      return {};
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Digest History
        <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Session: {sessionId}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && digests.length === 0 && (
          <Alert severity="info">No digests available for this session.</Alert>
        )}

        {!loading && digests.length > 0 && (
          <List sx={{ width: '100%' }}>
            {digests.map((digest, index) => {
              const isExpanded = expanded[digest.id] || false;
              const metadata = parseMetadata(digest.metadataJson);
              const compactionDate = new Date(digest.compactedAt);
              const compression = digest.beforeTokens > 0
                ? Math.round(((digest.beforeTokens - digest.afterTokens) / digest.beforeTokens) * 100)
                : 0;

              return (
                <Box key={digest.id}>
                  <ListItem
                    disablePadding
                    sx={{
                      bgcolor: selectedDigest?.id === digest.id ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <ListItemButton
                      onClick={() => handleSelectDigest(digest)}
                      sx={{ flex: 1 }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Typography variant="subtitle2">
                              Digest #{digests.length - index}
                            </Typography>
                            <Chip
                              label={`${compression}% reduction`}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              label={`${digest.removedMessages} msgs removed`}
                              size="small"
                              variant="filled"
                              color="secondary"
                            />
                          </Stack>
                        }
                        secondary={
                          <Stack spacing={1}>
                            <Typography variant="caption">
                              {compactionDate.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                              {renderSummaryPreview(digest.summary, isExpanded)}
                            </Typography>
                            {digest.summary.length > 200 && (
                              <Button
                                size="small"
                                startIcon={
                                  isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleExpand(digest.id);
                                }}
                              >
                                {isExpanded ? 'Show less' : 'Show more'}
                              </Button>
                            )}
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  </ListItem>

                  {isExpanded && (
                    <Paper
                      sx={{
                        m: 1,
                        p: 2,
                        bgcolor: 'background.default',
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <InfoIcon fontSize="small" />
                            Compaction Details
                          </Typography>
                          <Stack spacing={1} sx={{ ml: 1 }}>
                            <Typography variant="caption">
                              <strong>Tokens before:</strong> {digest.beforeTokens}
                            </Typography>
                            <Typography variant="caption">
                              <strong>Tokens after:</strong> {digest.afterTokens}
                            </Typography>
                            <Typography variant="caption">
                              <strong>Messages removed:</strong> {digest.removedMessages}
                            </Typography>
                            <Typography variant="caption">
                              <strong>Reason:</strong>{' '}
                              {metadata.reason || 'Not specified'}
                            </Typography>
                          </Stack>
                        </Box>

                        {metadata.currentGoal && (
                          <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              Current Goal
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                p: 1,
                                bgcolor: 'background.paper',
                                borderRadius: 1,
                                fontStyle: 'italic',
                              }}
                            >
                              {metadata.currentGoal}
                            </Typography>
                          </Box>
                        )}

                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Full Summary
                          </Typography>
                          <Paper
                            sx={{
                              p: 1.5,
                              bgcolor: 'background.paper',
                              maxHeight: 300,
                              overflow: 'auto',
                              fontSize: '0.875rem',
                              lineHeight: 1.6,
                            }}
                          >
                            {digest.summary}
                          </Paper>
                        </Box>
                      </Stack>
                    </Paper>
                  )}

                  {index < digests.length - 1 && <Divider />}
                </Box>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        {selectedDigest && (
          <Typography variant="caption" sx={{ flex: 1, textAlign: 'left', pl: 2 }}>
            Selected: {selectedDigest.id}
          </Typography>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
