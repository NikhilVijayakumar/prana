/**
 * KpiTemplateForm Component
 * Form for editing individual KPI definitions
 */

import { FC } from 'react';
import {
  Box,
  Card,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Typography,
  Stack,
  useTheme as useMuiTheme,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from 'astra';
import { KpiDefinition } from '../../domain/onboarding.types';
import DeleteIcon from '@mui/icons-material/Delete';

interface KpiTemplateFormProps {
  kpi: KpiDefinition;
  index: number;
  onUpdate: (kpi: KpiDefinition) => void;
  onRemove: () => void;
}

const KPI_CATEGORIES = ['Financial', 'Growth', 'Engineering', 'Operations', 'Sales', 'Custom'];
const EVALUATION_FREQUENCIES = ['daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly'];

/**
 * KpiTemplateForm Component
 */
export const KpiTemplateForm: FC<KpiTemplateFormProps> = ({
  kpi,
  index,
  onUpdate,
  onRemove,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

  return (
    <Card
      sx={{
        p: spacing.lg,
        border: `1px solid ${muiTheme.palette.divider}`,
        backgroundColor: muiTheme.palette.background.paper,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: spacing.md }}>
        <Typography variant="body2Bold">
          {literal['onboarding.phase2.kpiLabel']} #{index + 1}
        </Typography>
        <IconButton onClick={onRemove} size="small" color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Stack spacing={spacing.md}>
        {/* Name */}
        <TextField
          fullWidth
          label={literal['onboarding.phase2.kpiNameLabel']}
          value={kpi.name}
          onChange={(e) => onUpdate({ ...kpi, name: e.target.value })}
          size="small"
        />

        {/* Grid: Category, Unit, Frequency */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.md }}>
          <FormControl size="small" fullWidth>
            <InputLabel>{literal['onboarding.phase2.categoryLabel']}</InputLabel>
            <Select
              value={kpi.category}
              label={literal['onboarding.phase2.categoryLabel']}
              onChange={(e) => onUpdate({ ...kpi, category: e.target.value as any })}
            >
              {KPI_CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label={literal['onboarding.phase2.unitLabel']}
            value={kpi.unit}
            onChange={(e) => onUpdate({ ...kpi, unit: e.target.value })}
            size="small"
            placeholder="USD, count, score, etc."
          />

          <FormControl size="small" fullWidth>
            <InputLabel>{literal['onboarding.phase2.frequencyLabel']}</InputLabel>
            <Select
              value={kpi.evaluation_frequency}
              label={literal['onboarding.phase2.frequencyLabel']}
              onChange={(e) => onUpdate({ ...kpi, evaluation_frequency: e.target.value as any })}
            >
              {EVALUATION_FREQUENCIES.map((freq) => (
                <MenuItem key={freq} value={freq}>
                  {freq}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Grid: Target, Alert Threshold, Crisis Threshold */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.md }}>
          <TextField
            label={literal['onboarding.phase2.targetLabel']}
            type="number"
            value={kpi.target}
            onChange={(e) => onUpdate({ ...kpi, target: parseFloat(e.target.value) || 0 })}
            size="small"
          />

          <TextField
            label={literal['onboarding.phase2.alertThresholdLabel']}
            type="number"
            value={kpi.alert_threshold}
            onChange={(e) => onUpdate({ ...kpi, alert_threshold: parseFloat(e.target.value) || 0 })}
            size="small"
          />

          <TextField
            label={literal['onboarding.phase2.crisisThresholdLabel']}
            type="number"
            value={kpi.crisis_threshold}
            onChange={(e) => onUpdate({ ...kpi, crisis_threshold: parseFloat(e.target.value) || 0 })}
            size="small"
          />
        </Box>

        {/* Owner Agent */}
        <TextField
          fullWidth
          label={literal['onboarding.phase2.ownerAgentLabel']}
          value={kpi.owner_agent}
          onChange={(e) => onUpdate({ ...kpi, owner_agent: e.target.value })}
          size="small"
          placeholder="e.g., nora, dani, julia"
        />

        {/* Description */}
        <TextField
          fullWidth
          label={literal['onboarding.phase2.descriptionLabel']}
          value={kpi.description}
          onChange={(e) => onUpdate({ ...kpi, description: e.target.value })}
          multiline
          rows={2}
          size="small"
        />
      </Stack>
    </Card>
  );
};

export default KpiTemplateForm;
