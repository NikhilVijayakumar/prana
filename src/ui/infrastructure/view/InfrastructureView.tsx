import { FC } from 'react';
import { Box, Typography, Button, useTheme as useMuiTheme } from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';
import { InfrastructurePayload } from '../repo/InfrastructureRepo';

interface InfrastructureProps {
  payload: InfrastructurePayload | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const InfrastructureView: FC<InfrastructureProps> = ({ payload, isLoading, onRefresh }) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

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

        </Box>
      )}
    </Box>
  );
};
