import { FC, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Archive as ArchiveIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { ContextCompactionIndicator } from './ContextCompactionIndicator';
import { DigestReviewPanel } from './ContextDigestReviewPanel';
import { SessionRolloverPreviewModal } from './ContextSessionRolloverPreview';

interface ContextEngineDebugPanelProps {
  sessionId: string;
  onSessionChange?: (newSessionId: string) => void;
}

/**
 * Demo/Debug Panel integrating all context engine UI components.
 * This component showcases how to use the compaction indicator,
 * digest review panel, and session rollover preview together.
 */
export const ContextEngineDebugPanel: FC<ContextEngineDebugPanelProps> = ({
  sessionId,
  onSessionChange,
}) => {
  const [digestPanelOpen, setDigestPanelOpen] = useState(false);
  const [rolloverPreviewOpen, setRolloverPreviewOpen] = useState(false);
  const [compactionTriggered, setCompactionTriggered] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const handleSendMessage = async (): Promise<void> => {
    if (!message.trim()) return;

    setSendingMessage(true);
    try {
      await (window as any).api.context?.ingest({
        sessionId,
        role: 'user',
        content: message,
      });
      setMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCompact = async (): Promise<void> => {
    try {
      const result = await (window as any).api.context?.compact({
        sessionId,
        reason: 'manual-debug',
      });
      setCompactionTriggered(result?.digestId || 'unknown');
    } catch (err) {
      console.error('Failed to compact:', err);
    }
  };

  const handleStageChange = (stage: string): void => {
    console.log(`Context optimization stage changed: ${stage}`);
  };

  const handleSelectDigest = (digest: any): void => {
    console.log('Selected digest:', digest.id);
  };

  const handleRolloverConfirm = (newSessionId: string, summary?: string): void => {
    console.log(`Session rolled over to: ${newSessionId}${summary ? ` (${summary.slice(0, 50)}...)` : ''}`);
    onSessionChange?.(newSessionId);
  };

  return (
    <Card>
      <CardHeader
        title="Context Engine Control"
        subheader={`Session: ${sessionId}`}
        action={<MoreVertIcon />}
      />
      <CardContent>
        <Stack spacing={2}>
          {/* Compaction Indicator */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Memory Status
            </Typography>
            <ContextCompactionIndicator
              sessionId={sessionId}
              pollIntervalMs={3000}
              onStageChange={handleStageChange}
            />
          </Box>

          {/* Message Ingestion */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Add Message to Context
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                placeholder="Enter message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sendingMessage}
                size="small"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !sendingMessage) {
                    void handleSendMessage();
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleSendMessage}
                disabled={!message.trim() || sendingMessage}
              >
                Send
              </Button>
            </Stack>
          </Box>

          {/* Actions */}
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HistoryIcon />}
              onClick={() => setDigestPanelOpen(true)}
            >
              View Digests
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={handleCompact}
            >
              Compact Now
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArchiveIcon />}
              onClick={() => setRolloverPreviewOpen(true)}
            >
              Rollover Session
            </Button>
          </Stack>

          {/* Compaction Status */}
          {compactionTriggered && (
            <Alert severity="success">
              Compaction completed! Digest ID: {compactionTriggered}
            </Alert>
          )}
        </Stack>
      </CardContent>

      {/* Digest Review Panel */}
      <DigestReviewPanel
        sessionId={sessionId}
        open={digestPanelOpen}
        onClose={() => setDigestPanelOpen(false)}
        onSelectDigest={handleSelectDigest}
      />

      {/* Session Rollover Preview Modal */}
      <SessionRolloverPreviewModal
        sourceSessionId={sessionId}
        open={rolloverPreviewOpen}
        onClose={() => setRolloverPreviewOpen(false)}
        onConfirm={handleRolloverConfirm}
      />
    </Card>
  );
};
