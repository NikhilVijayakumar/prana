import { FC } from 'react';
import { Box, Typography, Card, LinearProgress, useTheme as useMuiTheme, Badge, Button } from '@mui/material';
import { spacing } from 'astra';
import { OnboardingAgentStatus } from '../repo/OnboardingRepo';

interface KpiGeneratorViewProps {
  statuses: OnboardingAgentStatus[];
  generatedAt: string;
  isLoading: boolean;
  onGenerate: () => Promise<void>;
}

export const KpiGeneratorView: FC<KpiGeneratorViewProps> = ({ statuses, generatedAt, isLoading, onGenerate }) => {
  const muiTheme = useMuiTheme();
  const allDone = statuses.length > 0 && statuses.every((agent) => agent.status === 'DONE');
  const generatedAtLabel = generatedAt ? new Date(generatedAt).toLocaleString() : 'Not generated yet';

  return (
    <Box sx={{ width: '100%', py: spacing.md }}>
      <Typography variant="h5" sx={{ mb: spacing.md, color: muiTheme.palette.text.primary }}>
        Generating Strategic KPIs
      </Typography>
      <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary, mb: spacing.xl }}>
        Each virtual executive is analyzing your company context to define domain-specific metrics.
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.md }}>
        <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
          Last generated: {generatedAtLabel}
        </Typography>
        <Button variant="contained" onClick={() => void onGenerate()} disabled={isLoading}>
          {allDone ? 'Regenerate KPIs' : 'Generate KPIs'}
        </Button>
      </Box>

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
        gap: spacing.md 
      }}>
        {statuses.map((agent) => (
          <Card key={agent.id} sx={{ 
            p: spacing.md, 
            backgroundColor: muiTheme.palette.background.default,
            border: `1px solid ${muiTheme.palette.divider}`,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="body2Bold" sx={{ color: muiTheme.palette.text.primary }}>
                  {agent.name}
                </Typography>
                <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
                  {agent.role}
                </Typography>
              </Box>
              <Badge 
                badgeContent={agent.kpiCount} 
                color="primary" 
                invisible={agent.kpiCount === 0}
              />
            </Box>

            <Box sx={{ mt: spacing.md }}>
              <Typography variant="captionBold" sx={{ 
                color: isLoading
                  ? muiTheme.palette.primary.main
                  : agent.status === 'DONE'
                    ? muiTheme.palette.success.main
                    : muiTheme.palette.text.secondary,
                display: 'block', mb: '4px'
              }}>
                {isLoading && agent.status === 'QUEUED' ? 'GENERATING' : agent.status}
              </Typography>
              {isLoading ? (
                <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
              ) : (
                <Box sx={{ height: 4, borderRadius: 2, backgroundColor: agent.status === 'DONE' ? muiTheme.palette.success.main : muiTheme.palette.divider }} />
              )}
            </Box>

            {isLoading && (
              <Box sx={{ 
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                background: `linear-gradient(90deg, transparent, ${muiTheme.palette.action.hover}, transparent)`,
                animation: 'shimmer 2s infinite linear',
                pointerEvents: 'none'
              }} />
            )}
          </Card>
        ))}
      </Box>
    </Box>
  );
};
