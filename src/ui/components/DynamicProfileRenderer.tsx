import { FC, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme as useMuiTheme,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';
import { LifecycleGlobalSkill, LifecycleProfileDraft } from '../state/LifecycleProvider';

export type DynamicRendererMode = 'VIEW' | 'EDIT' | 'WIZARD';

interface DynamicProfileRendererProps {
  mode: DynamicRendererMode;
  profile: LifecycleProfileDraft;
  profiles: LifecycleProfileDraft[];
  globalSkills: LifecycleGlobalSkill[];
  alignmentWarnings?: Array<{ field: 'goal' | 'backstory' | 'skills' | 'kpis'; message: string }>;
  onSelectProfile?: (agentId: string) => void;
  onProfileChange?: (patch: Partial<LifecycleProfileDraft>) => void;
  onGlobalSkillChange?: (skillId: string, markdown: string) => void;
  onOpenRegistry?: () => void;
}

const asCsv = (entries: string[]): string => entries.join(', ');

const fromCsv = (csv: string): string[] => {
  return csv
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const DynamicProfileRenderer: FC<DynamicProfileRendererProps> = ({
  mode,
  profile,
  profiles,
  globalSkills,
  alignmentWarnings = [],
  onSelectProfile,
  onProfileChange,
  onGlobalSkillChange,
  onOpenRegistry,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();
  const [activeSkillId, setActiveSkillId] = useState<string>(profile.skills[0] ?? '');

  const editable = mode !== 'VIEW';

  const globalSkillMap = useMemo(() => {
    return globalSkills.reduce<Record<string, LifecycleGlobalSkill>>((acc, skill) => {
      acc[skill.id] = skill;
      return acc;
    }, {});
  }, [globalSkills]);

  const activeSkill = activeSkillId ? globalSkillMap[activeSkillId] : undefined;
  const warningByField = alignmentWarnings.reduce<Record<string, string>>((acc, warning) => {
    acc[warning.field] = warning.message;
    return acc;
  }, {});

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {mode === 'WIZARD' && (
        <Alert severity="info">{literal['lifecycle.wizard.modeHelp']}</Alert>
      )}

      {alignmentWarnings.length > 0 && (
        <Alert severity="warning">
          {alignmentWarnings.map((warning) => warning.message).join(' | ')}
        </Alert>
      )}

      {mode === 'WIZARD' && (
        <Select
          value={profile.agentId}
          size="small"
          onChange={(event) => onSelectProfile?.(event.target.value)}
        >
          {profiles.map((entry) => (
            <MenuItem key={entry.agentId} value={entry.agentId}>
              {entry.name} ({entry.role})
            </MenuItem>
          ))}
        </Select>
      )}

      <Card sx={{ p: spacing.md, border: `1px solid ${muiTheme.palette.divider}`, backgroundColor: 'transparent' }}>
        <Typography variant="h6" sx={{ mb: spacing.xs }}>{profile.name}</Typography>
        <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary, mb: spacing.md }}>{profile.role}</Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: spacing.md }}>
          <TextField
            size="small"
            label={literal['lifecycle.goal']}
            value={profile.goal}
            multiline
            minRows={3}
            disabled={!editable}
            error={Boolean(warningByField.goal)}
            helperText={warningByField.goal}
            onChange={(event) => onProfileChange?.({ goal: event.target.value })}
          />
          <TextField
            size="small"
            label={literal['lifecycle.backstory']}
            value={profile.backstory}
            multiline
            minRows={3}
            disabled={!editable}
            error={Boolean(warningByField.backstory)}
            helperText={warningByField.backstory}
            onChange={(event) => onProfileChange?.({ backstory: event.target.value })}
          />
        </Box>

        <Divider sx={{ my: spacing.md }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: spacing.md }}>
          <TextField
            size="small"
            label={literal['lifecycle.skillsCsv']}
            value={asCsv(profile.skills)}
            disabled={!editable}
            error={Boolean(warningByField.skills)}
            helperText={warningByField.skills}
            onChange={(event) => onProfileChange?.({ skills: fromCsv(event.target.value) })}
          />
          <TextField
            size="small"
            label={literal['lifecycle.kpisCsv']}
            value={asCsv(profile.kpis)}
            disabled={!editable}
            error={Boolean(warningByField.kpis)}
            helperText={warningByField.kpis}
            onChange={(event) => onProfileChange?.({ kpis: fromCsv(event.target.value) })}
          />
        </Box>

        <Box sx={{ mt: spacing.sm, display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
          {profile.skills.map((skillId) => (
            <Chip
              key={skillId}
              label={globalSkillMap[skillId]?.title ?? skillId}
              size="small"
              color={skillId === activeSkillId ? 'primary' : 'default'}
              onClick={() => setActiveSkillId(skillId)}
            />
          ))}
        </Box>
      </Card>

      {activeSkill && (
        <Card sx={{ p: spacing.md, border: `1px solid ${muiTheme.palette.divider}`, backgroundColor: 'transparent' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.sm }}>
            <Typography variant="body2Bold">{activeSkill.title}</Typography>
            {onOpenRegistry && (
              <Button size="small" variant="text" onClick={onOpenRegistry}>
                {literal['lifecycle.openSkillRegistry']}
              </Button>
            )}
          </Box>
          <TextField
            size="small"
            label={literal['lifecycle.skillMarkdown']}
            value={activeSkill.markdown}
            multiline
            minRows={6}
            disabled={!editable || !onGlobalSkillChange}
            onChange={(event) => onGlobalSkillChange?.(activeSkill.id, event.target.value)}
          />
        </Card>
      )}

      <Card sx={{ p: spacing.md, border: `1px solid ${muiTheme.palette.divider}`, backgroundColor: 'transparent' }}>
        <Typography variant="body2Bold" sx={{ mb: spacing.sm }}>{literal['lifecycle.kpiStatus']}</Typography>
        {profile.kpiStatus.map((kpi) => (
          <Box key={`${profile.agentId}-${kpi.name}`} sx={{ display: 'flex', justifyContent: 'space-between', py: spacing.xs }}>
            <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>{kpi.name}</Typography>
            <Typography
              variant="body2Bold"
              sx={{
                color:
                  kpi.trend === 'up'
                    ? muiTheme.palette.success.main
                    : kpi.trend === 'down'
                      ? muiTheme.palette.error.main
                      : muiTheme.palette.text.primary,
              }}
            >
              {kpi.value}
            </Typography>
          </Box>
        ))}
      </Card>
    </Box>
  );
};
