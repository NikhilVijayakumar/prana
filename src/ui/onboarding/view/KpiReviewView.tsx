import { FC, useEffect, useState } from 'react';
import { Box, Typography, Card, Button, Tabs, Tab, IconButton, useTheme as useMuiTheme, Divider, LinearProgress } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { spacing } from 'astra';
import { OnboardingAgentKpiRecord } from '../repo/OnboardingRepo';

interface KpiReviewViewProps {
  data: OnboardingAgentKpiRecord[];
  isLoading: boolean;
  onRemove: (agentId: string, kpiId: string) => Promise<void>;
}

export const KpiReviewView: FC<KpiReviewViewProps> = ({ data, isLoading, onRemove }) => {
  const muiTheme = useMuiTheme();
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (activeTab > 0 && activeTab >= data.length) {
      setActiveTab(data.length - 1);
    }
  }, [activeTab, data.length]);

  if (data.length === 0) {
    return (
      <Box sx={{ width: '100%', py: spacing.md }}>
        <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
          No KPI registry found yet. Generate KPIs in the previous step.
        </Typography>
      </Box>
    );
  }

  const selectedAgent = data[activeTab] ?? data[0];

  return (
    <Box sx={{ width: '100%', py: spacing.md }}>
      <Typography variant="h5" sx={{ mb: spacing.md, color: muiTheme.palette.text.primary }}>
        KPI Registry Review
      </Typography>
      <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary, mb: spacing.xl }}>
        Fine-tune the generated metrics for your strategic goals.
      </Typography>

      {isLoading && <LinearProgress sx={{ mb: spacing.md }} />}

      <Tabs 
        value={activeTab} 
        onChange={(_, val) => setActiveTab(val)} 
        sx={{ borderBottom: 1, borderColor: 'divider', mb: spacing.lg }}
      >
        {data.map((item) => (
          <Tab key={item.agentId} label={item.agent} sx={{ typography: 'micro' }} />
        ))}
      </Tabs>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        {selectedAgent.kpis.map((kpi) => (
          <Card key={kpi.id} sx={{ 
            p: spacing.md, 
            backgroundColor: muiTheme.palette.background.default,
            border: `1px solid ${muiTheme.palette.divider}`,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.sm
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2Bold" sx={{ color: muiTheme.palette.text.primary }}>
                {kpi.name}
              </Typography>
              <Box>
                <IconButton size="small"><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => void onRemove(selectedAgent.agentId, kpi.id)}><DeleteIcon fontSize="small" /></IconButton>
              </Box>
            </Box>
            
            <Divider />
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.md }}>
              <Box>
                <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>TARGET</Typography>
                <Typography variant="body2" sx={{ color: muiTheme.palette.text.primary }}>{kpi.target} {kpi.unit}</Typography>
              </Box>
              <Box>
                <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>THRESHOLD</Typography>
                <Typography variant="body2" sx={{ color: muiTheme.palette.warning.main }}>{kpi.threshold} {kpi.unit}</Typography>
              </Box>
              <Box>
                <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>UNIT</Typography>
                <Typography variant="body2" sx={{ color: muiTheme.palette.text.primary }}>{kpi.unit}</Typography>
              </Box>
            </Box>
          </Card>
        ))}

        {selectedAgent.kpis.length === 0 && (
          <Card sx={{ p: spacing.md, border: `1px solid ${muiTheme.palette.divider}` }}>
            <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
              No KPIs remain for {selectedAgent.agent}. Add one or regenerate from step 6.
            </Typography>
          </Card>
        )}
        
        <Button variant="outlined" sx={{ borderStyle: 'dashed', py: spacing.md }}>
          + Add Custom KPI for {selectedAgent.agent}
        </Button>
      </Box>
    </Box>
  );
};
