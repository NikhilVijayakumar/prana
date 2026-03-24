import { FC } from 'react';
import { Alert, Box, Button, Chip, Typography, useTheme as useMuiTheme } from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';
import type { SyncStatusSnapshot } from '@dharma/schemas/domain';

interface SyncHealthWidgetProps {
  syncStatus: SyncStatusSnapshot | null;
  isLoading: boolean;
  isSyncActionRunning: boolean;
  onRefresh: () => void;
  onPushNow: () => void;
  onPullNow: () => void;
}

const formatTimestamp = (value: string | null, fallback: string): string => {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleString();
};

const formatIntegrityStatus = (valid: boolean | null, literal: Record<string, string>): string => {
  if (valid === true) {
    return literal['settings.sync.health.integrity.valid'];
  }

  if (valid === false) {
    return literal['settings.sync.health.integrity.invalid'];
  }

  return literal['settings.sync.health.integrity.unknown'];
};

export const SyncHealthWidget: FC<SyncHealthWidgetProps> = ({
  syncStatus,
  isLoading,
  isSyncActionRunning,
  onRefresh,
  onPushNow,
  onPullNow,
}) => {
  const { literal } = useLanguage();
  const muiTheme = useMuiTheme();

  return (
    <Box
      sx={{
        mb: spacing.xl,
        p: spacing.lg,
        border: `1px solid ${muiTheme.palette.divider}`,
        borderRadius: spacing.xs,
        backgroundColor: muiTheme.palette.background.paper,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.md }}>
        <Typography variant="h6" sx={{ color: muiTheme.palette.text.primary }}>
          {literal['settings.sync.health.title']}
        </Typography>
        <Button size="small" variant="outlined" onClick={onRefresh} disabled={isLoading || isSyncActionRunning}>
          {literal['settings.sync.health.refresh']}
        </Button>
      </Box>

      {!syncStatus ? (
        <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
          {literal['settings.sync.health.empty']}
        </Typography>
      ) : (
        <>
          {!!syncStatus.machineLockWarning && (
            <Alert severity="warning" sx={{ mb: spacing.md }}>
              {syncStatus.machineLockWarning}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, mb: spacing.md }}>
            <Chip
              size="small"
              label={`${literal['settings.sync.health.initialized']}: ${syncStatus.initialized ? literal['status.success'] : literal['status.idle']}`}
              color={syncStatus.initialized ? 'success' : 'default'}
            />
            <Chip
              size="small"
              label={`${literal['settings.sync.health.timer']}: ${syncStatus.pushTimerActive ? literal['status.success'] : literal['status.idle']}`}
              color={syncStatus.pushTimerActive ? 'success' : 'default'}
            />
            <Chip
              size="small"
              label={`${literal['settings.sync.health.integrity']}: ${formatIntegrityStatus(syncStatus.lastIntegrityCheck.valid, literal)}`}
              color={syncStatus.lastIntegrityCheck.valid === false ? 'error' : 'default'}
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: spacing.md }}>
            <Box>
              <Typography variant="body2Bold" sx={{ color: muiTheme.palette.text.primary }}>
                {literal['settings.sync.health.pull.title']}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: muiTheme.palette.text.secondary }}>
                {literal['settings.sync.health.lastRun']}: {formatTimestamp(syncStatus.lastPull.at, literal['global.na'])}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: muiTheme.palette.text.secondary }}>
                {literal['settings.status']}: {syncStatus.lastPull.status ?? literal['global.none']}
              </Typography>
              {syncStatus.lastPull.message && (
                <Typography variant="caption" sx={{ display: 'block', color: muiTheme.palette.text.secondary }}>
                  {syncStatus.lastPull.message}
                </Typography>
              )}
            </Box>

            <Box>
              <Typography variant="body2Bold" sx={{ color: muiTheme.palette.text.primary }}>
                {literal['settings.sync.health.push.title']}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: muiTheme.palette.text.secondary }}>
                {literal['settings.sync.health.lastRun']}: {formatTimestamp(syncStatus.lastPush.at, literal['global.na'])}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: muiTheme.palette.text.secondary }}>
                {literal['settings.status']}: {syncStatus.lastPush.status ?? literal['global.none']}
              </Typography>
              {syncStatus.lastPush.message && (
                <Typography variant="caption" sx={{ display: 'block', color: muiTheme.palette.text.secondary }}>
                  {syncStatus.lastPush.message}
                </Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ mt: spacing.md }}>
            <Typography variant="body2Bold" sx={{ color: muiTheme.palette.text.primary }}>
              {literal['settings.sync.health.queue.title']}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: muiTheme.palette.text.secondary }}>
              {literal['settings.sync.health.queue.pending']}: {syncStatus.queue.pendingOrFailed}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: muiTheme.palette.text.secondary }}>
              {literal['settings.sync.health.queue.running']}: {syncStatus.queue.running}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: muiTheme.palette.text.secondary }}>
              {literal['settings.sync.health.queue.completed']}: {syncStatus.queue.completed}
            </Typography>
          </Box>

          {syncStatus.lastIntegrityCheck.issues.length > 0 && (
            <Box sx={{ mt: spacing.md }}>
              <Typography variant="body2Bold" sx={{ color: muiTheme.palette.text.primary }}>
                {literal['settings.sync.health.integrity.issues']}
              </Typography>
              {syncStatus.lastIntegrityCheck.issues.map((issue) => (
                <Typography key={issue} variant="caption" sx={{ display: 'block', color: muiTheme.palette.error.main }}>
                  {issue}
                </Typography>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: spacing.sm, mt: spacing.lg }}>
            <Button variant="contained" onClick={onPullNow} disabled={isSyncActionRunning || isLoading}>
              {literal['settings.sync.health.pullNow']}
            </Button>
            <Button variant="outlined" onClick={onPushNow} disabled={isSyncActionRunning || isLoading}>
              {literal['settings.sync.health.pushNow']}
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};
