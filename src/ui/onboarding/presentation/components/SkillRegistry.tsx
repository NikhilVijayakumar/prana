/**
 * SkillRegistry Component
 * Global skill browser and assignment for Virtual Employees
 */

import { FC, useMemo, useState } from 'react';
import {
  Box,
  Card,
  Checkbox,
  Typography,
  useTheme as useMuiTheme,
  TextField,
  FormControlLabel,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';
import { VirtualEmployeeProfile } from '../../domain/onboarding.types';
import AddIcon from '@mui/icons-material/Add';

interface SkillRegistryProps {
  employee: VirtualEmployeeProfile;
  globalSkills: Map<string, string>;
  selectedSkillIds: string[];
  onUpdateSkills: (skillIds: string[]) => void;
  validationErrors: string[];
}

/**
 * SkillRegistry Component
 */
export const SkillRegistry: FC<SkillRegistryProps> = ({
  globalSkills,
  selectedSkillIds,
  onUpdateSkills,
  validationErrors,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();
  const [filterText, setFilterText] = useState('');
  const [addCustomSkillOpen, setAddCustomSkillOpen] = useState(false);
  const [customSkillName, setCustomSkillName] = useState('');
  const [customSkillDesc, setCustomSkillDesc] = useState('');

  // Filter skills by search text
  const filteredSkills = useMemo(() => {
    if (!filterText) return Array.from(globalSkills.keys());
    return Array.from(globalSkills.keys()).filter((skillId) =>
      skillId.toLowerCase().includes(filterText.toLowerCase())
    );
  }, [globalSkills, filterText]);

  const handleSkillToggle = (skillId: string) => {
    const newSelectedIds = selectedSkillIds.includes(skillId)
      ? selectedSkillIds.filter((id) => id !== skillId)
      : [...selectedSkillIds, skillId];
    onUpdateSkills(newSelectedIds);
  };

  const handleAddCustomSkill = () => {
    if (!customSkillName.trim()) {
      return;
    }

    const customSkillId = `custom-${customSkillName.toLowerCase().replace(/\s+/g, '-')}`;
    const newSelectedIds = [...selectedSkillIds, customSkillId];
    onUpdateSkills(newSelectedIds);

    // Reset form
    setCustomSkillName('');
    setCustomSkillDesc('');
    setAddCustomSkillOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {/* Info Alert */}
      <Alert severity="info">{literal['onboarding.skillRegistry.help']}</Alert>

      {/* Search Filter */}
      <TextField
        placeholder={literal['onboarding.skillRegistry.searchLabel']}
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        size="small"
        fullWidth
        sx={{ mb: spacing.md }}
      />

      {/* Global Skills List */}
      <Card sx={{ p: spacing.lg, border: `1px solid ${muiTheme.palette.divider}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.md }}>
          <Typography variant="body2Bold">{literal['onboarding.skillRegistry.globalSkillsTitle']}</Typography>
          <Button
            startIcon={<AddIcon />}
            size="small"
            onClick={() => setAddCustomSkillOpen(true)}
          >
            {literal['onboarding.skillRegistry.addCustomSkill']}
          </Button>
        </Box>

        <Stack spacing={spacing.sm}>
          {filteredSkills.length === 0 ? (
            <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
              {literal['onboarding.skillRegistry.noMatch']}
            </Typography>
          ) : (
            filteredSkills.map((skillId) => (
              <FormControlLabel
                key={skillId}
                control={
                  <Checkbox
                    checked={selectedSkillIds.includes(skillId)}
                    onChange={() => handleSkillToggle(skillId)}
                  />
                }
                label={
                  <Box sx={{ ml: spacing.sm }}>
                    <Typography variant="body2">{skillId}</Typography>
                    <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
                      {globalSkills.get(skillId)?.substring(0, 80)}...
                    </Typography>
                  </Box>
                }
              />
            ))
          )}
        </Stack>
      </Card>

      {/* Selected Skills Summary */}
      {selectedSkillIds.length > 0 && (
        <Card sx={{ p: spacing.lg, border: `1px solid ${muiTheme.palette.divider}`, backgroundColor: muiTheme.palette.success.light }}>
          <Typography variant="body2Bold" sx={{ mb: spacing.sm }}>
            {literal['onboarding.skillRegistry.selectedCount']}: {selectedSkillIds.length}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
            {selectedSkillIds.map((skillId) => (
              <Box
                key={skillId}
                sx={{
                  padding: '4px 12px',
                  backgroundColor: muiTheme.palette.primary.main,
                  color: muiTheme.palette.primary.contrastText,
                  borderRadius: '16px',
                  fontSize: '0.85rem',
                }}
              >
                {skillId}
              </Box>
            ))}
          </Box>
        </Card>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert severity="error">
          {validationErrors.map((error, idx) => (
            <Typography key={idx} variant="body2">
              • {error}
            </Typography>
          ))}
        </Alert>
      )}

      {/* Add Custom Skill Dialog */}
      <Dialog open={addCustomSkillOpen} onClose={() => setAddCustomSkillOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{literal['onboarding.skillRegistry.addCustomSkillTitle']}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md, pt: spacing.md }}>
          <TextField
            label={literal['onboarding.skillRegistry.customSkillName']}
            value={customSkillName}
            onChange={(e) => setCustomSkillName(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label={literal['onboarding.skillRegistry.customSkillDesc']}
            value={customSkillDesc}
            onChange={(e) => setCustomSkillDesc(e.target.value)}
            multiline
            rows={3}
            fullWidth
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ p: spacing.md }}>
          <Button onClick={() => setAddCustomSkillOpen(false)}>{literal['global.cancel']}</Button>
          <Button onClick={handleAddCustomSkill} variant="contained" disabled={!customSkillName.trim()}>
            {literal['global.add']}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SkillRegistry;
