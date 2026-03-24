/**
 * Phase2KpiManager Container
 * Manages Company KPI Configuration
 */

import React, { FC, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Typography,
  useTheme as useMuiTheme,
  Tab,
  Tabs,
  Alert,
  TextField,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from 'astra';
import { Phase2DraftState, KpiDefinition, KpiTemplate } from '../../domain/onboarding.types';
import { KpiTemplateForm } from '../components/KpiTemplateForm';
import AddIcon from '@mui/icons-material/Add';

interface Phase2KpiManagerProps {
  phase2Draft: Phase2DraftState;
  onUpdateDraft: (draft: Partial<Phase2DraftState>) => void;
  onCommit: () => Promise<void>;
  isCommitting: boolean;
  kpiTemplates: KpiTemplate[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;
  return (
    <div hidden={value !== index} style={{ width: '100%' }}>
      {value === index && <Box sx={{ py: spacing.lg }}>{children}</Box>}
    </div>
  );
}

/**
 * Phase2KpiManager Component
 */
export const Phase2KpiManager: FC<Phase2KpiManagerProps> = ({
  phase2Draft,
  onUpdateDraft,
  onCommit,
  isCommitting,
  kpiTemplates,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleCompanyNameChange = (name: string) => {
    onUpdateDraft({ companyName: name });
  };

  const handleApplyTemplate = (template: KpiTemplate) => {
    const templateKpis: KpiDefinition[] = template.kpis.map((kpi, idx) => ({
      ...kpi,
      id: `kpi-${idx}`,
      owner_agent: kpi.suggested_owner_agent || 'system',
      source: 'template' as const,
    }));

    onUpdateDraft({
      templateSelected: template.id,
      kpis: templateKpis,
    });

    setTabValue(1); // Switch to editor
  };

  const handleUpdateKpi = (index: number, updatedKpi: KpiDefinition) => {
    const updatedKpis = [...phase2Draft.kpis];
    updatedKpis[index] = updatedKpi;
    onUpdateDraft({ kpis: updatedKpis });
  };

  const handleRemoveKpi = (index: number) => {
    const updatedKpis = phase2Draft.kpis.filter((_, idx) => idx !== index);
    onUpdateDraft({ kpis: updatedKpis });
  };

  const handleAddCustomKpi = () => {
    const newKpi: KpiDefinition = {
      id: `kpi-custom-${Date.now()}`,
      name: '',
      category: 'Custom',
      unit: '',
      target: 0,
      alert_threshold: 0,
      crisis_threshold: 0,
      evaluation_frequency: 'monthly',
      owner_agent: 'system',
      description: '',
      source: 'custom',
    };
    onUpdateDraft({ kpis: [...phase2Draft.kpis, newKpi] });
  };

  const handleUploadJson = async (file: File) => {
    try {
      const content = await file.text();
      const parsed = JSON.parse(content);

      if (parsed.kpis && Array.isArray(parsed.kpis)) {
        onUpdateDraft({
          companyName: parsed.company_name || phase2Draft.companyName,
          kpis: parsed.kpis,
        });
        setTabValue(1); // Switch to editor
      } else {
        onUpdateDraft({
          validationErrors: { ...phase2Draft.validationErrors, json: ['Invalid KPI JSON format'] },
        });
      }
    } catch (error) {
      onUpdateDraft({
        validationErrors: { ...phase2Draft.validationErrors, json: [String(error)] },
      });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, maxWidth: '1200px', margin: '0 auto' }}>
      {/* Info Alert */}
      <Alert severity="info">{literal['onboarding.phase2.help']}</Alert>

      {/* Tab Navigation */}
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        sx={{
          borderBottom: `1px solid ${muiTheme.palette.divider}`,
        }}
      >
        <Tab label={literal['onboarding.phase2.tabTemplate']} />
        <Tab label={literal['onboarding.phase2.tabEditor']} />
      </Tabs>

      {/* Tab Panel 1: Template Selection */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: spacing.lg }}>
          {kpiTemplates.map((template) => (
            <Card
              key={template.id}
              sx={{
                p: spacing.lg,
                border: `1px solid ${muiTheme.palette.divider}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: muiTheme.palette.primary.main,
                  boxShadow: muiTheme.shadows[4],
                },
              }}
              onClick={() => handleApplyTemplate(template)}
            >
              <Typography variant="body2Bold" sx={{ mb: spacing.sm }}>
                {template.name}
              </Typography>
              <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary, mb: spacing.md }}>
                {template.description}
              </Typography>
              <Typography variant="micro">
                {template.kpis.length} {literal['onboarding.phase2.kpisIncluded']}
              </Typography>
              <Typography variant="micro" sx={{ color: muiTheme.palette.primary.main }}>
                {template.company_stage}
              </Typography>
            </Card>
          ))}
        </Box>
      </TabPanel>

      {/* Tab Panel 2: KPI Editor */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          {/* Company Name Field */}
          <TextField
            fullWidth
            label={literal['onboarding.phase2.companyNameLabel']}
            value={phase2Draft.companyName || ''}
            onChange={(e) => handleCompanyNameChange(e.target.value)}
            size="small"
          />

          {/* KPI List Editor */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2Bold">
                {literal['onboarding.phase2.kpisEditorTitle']} ({phase2Draft.kpis.length})
              </Typography>
              <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={handleAddCustomKpi}
              >
                {literal['onboarding.phase2.addCustomKpi']}
              </Button>
            </Box>

            {phase2Draft.kpis.map((kpi, idx) => (
              <KpiTemplateForm
                key={kpi.id}
                kpi={kpi}
                index={idx}
                onUpdate={(updated) => handleUpdateKpi(idx, updated)}
                onRemove={() => handleRemoveKpi(idx)}
              />
            ))}
          </Box>

          {phase2Draft.kpis.length === 0 && (
            <Alert severity="warning">{literal['onboarding.phase2.noKpis']}</Alert>
          )}

          {/* Upload JSON Button */}
          <Button
            component="label"
            variant="outlined"
            fullWidth
          >
            {literal['onboarding.phase2.uploadJson']}
            <input
              hidden
              type="file"
              accept="application/json"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) handleUploadJson(file);
              }}
            />
          </Button>
        </Box>
      </TabPanel>

      {/* Validation Errors Summary */}
      {Object.keys(phase2Draft.validationErrors).length > 0 && (
        <Alert severity="error">{literal['onboarding.validationErrors']}</Alert>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end', marginTop: spacing.xl }}>
        <Button variant="outlined" disabled={isCommitting}>
          {literal['global.back']}
        </Button>
        <Button
          variant="contained"
          disabled={isCommitting || !phase2Draft.kpis.length}
          onClick={onCommit}
        >
          {isCommitting ? literal['onboarding.committing'] : literal['onboarding.saveAndNext']}
        </Button>
      </Box>
    </Box>
  );
};

export default Phase2KpiManager;
