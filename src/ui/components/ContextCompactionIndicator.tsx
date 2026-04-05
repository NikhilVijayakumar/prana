import { FC, ReactNode, useEffect, useState } from 'react';
import {
  Box,
  LinearProgress,
  Chip,
  Tooltip,
  Stack,
  Typography,
  useTheme as useMuiTheme,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ScheduleSend as CompactingIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

export type ContextOptimizationStage = 'NORMAL' | 'WARNING' | 'COMPACTION_REQUIRED' | 'HARD_LIMIT';

interface CompactionIndicatorProps {
  sessionId: string;
  pollIntervalMs?: number;
  onStageChange?: (stage: ContextOptimizationStage) => void;
}

interface ContextSessionState {
  sessionId: string;
  totalTokens: number;
  budget: {
    maxTokens: number;
    reservedOutputTokens: number;
  };
  optimizationStage: ContextOptimizationStage;
  compactionCount: number;
  lastCompactionAt: string | null;
}

interface StageConfig {
  label: string;
  color: 'success' | 'warning' | 'error' | 'info';
  icon: ReactNode;
}

const stageConfig: Record<ContextOptimizationStage, StageConfig> = {
  NORMAL: {
    label: 'Normal',
    color: 'success',
    icon: <CheckCircleIcon fontSize="small" />,
  },
  WARNING: {
    label: 'Warning',
    color: 'warning',
    icon: <WarningIcon fontSize="small" />,
  },
  COMPACTION_REQUIRED: {
    label: 'Compacting',
    color: 'info',
    icon: <CompactingIcon fontSize="small" />,
  },
  HARD_LIMIT: {
    label: 'Critical',
    color: 'error',
    icon: <ErrorIcon fontSize="small" />,
  },
};

export const ContextCompactionIndicator: FC<CompactionIndicatorProps> = ({
  sessionId,
  pollIntervalMs = 5000,
  onStageChange,
}) => {
  const theme = useMuiTheme();
  const [state, setState] = useState<ContextSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionState = async (): Promise<void> => {
    try {
      const result = await safeIpcCall('context:get-session-snapshot', async () => {
        return (window as any).api.context?.getSessionSnapshot({
          sessionId,
        });
      });

      if (result?.sessionId) {
        if (state?.optimizationStage !== result.optimizationStage && onStageChange) {
          onStageChange(result.optimizationStage as ContextOptimizationStage);
        }
        setState(result as ContextSessionState);
        setError(null);
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch session state');
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSessionState();
    const interval = setInterval(() => {
      void fetchSessionState();
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [sessionId, pollIntervalMs]);

  if (loading) {
    return (
      <Box sx={{ p: 1 }}>
        <LinearProgress />
      </Box>
    );
  }

  if (error || !state) {
    return (
      <Tooltip title={error || 'Session state unavailable'}>
        <Chip
          icon={<ErrorIcon />}
          label="Error"
          size="small"
          color="error"
          variant="outlined"
        />
      </Tooltip>
    );
  }

  const config = stageConfig[state.optimizationStage];
  const usage = state.totalTokens / state.budget.maxTokens;
  const usagePercent = Math.round(usage * 100);

  const tooltipText = [
    `Tokens: ${state.totalTokens} / ${state.budget.maxTokens}`,
    `Usage: ${usagePercent}%`,
    `Compactions: ${state.compactionCount}`,
    state.lastCompactionAt
      ? `Last compact: ${new Date(state.lastCompactionAt).toLocaleTimeString()}`
      : 'Never compacted',
  ].join('\n');

  return (
    <Tooltip title={tooltipText}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          p: 1,
          borderRadius: 1,
          bgcolor:
            state.optimizationStage === 'NORMAL'
              ? 'success.lighter'
              : state.optimizationStage === 'WARNING'
                ? 'warning.lighter'
                : state.optimizationStage === 'COMPACTION_REQUIRED'
                  ? 'info.lighter'
                  : 'error.lighter',
        }}
      >
        <Chip
          icon={config.icon as React.ReactElement}
          label={config.label}
          size="small"
          color={config.color}
          variant="filled"
        />
        <Box sx={{ flexGrow: 1, minWidth: 120 }}>
          <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
            {usagePercent}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, usagePercent)}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: theme.palette.divider,
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                backgroundColor:
                  usagePercent < 70
                    ? theme.palette.success.main
                    : usagePercent < 85
                      ? theme.palette.warning.main
                      : usagePercent < 95
                        ? theme.palette.info.main
                        : theme.palette.error.main,
              },
            }}
          />
        </Box>
      </Stack>
    </Tooltip>
  );
};
