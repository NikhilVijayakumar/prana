/**
 * EmployeeProfileEditor Component
 * Form for editing individual Virtual Employee profile
 */

import { FC } from 'react';
import {
  Box,
  TextField,
  Card,
  Typography,
  useTheme as useMuiTheme,
  Avatar,
  Stack,
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from 'astra';
import { VirtualEmployeeProfile } from '../../domain/onboarding.types';

interface EmployeeProfileEditorProps {
  employee: VirtualEmployeeProfile;
  validationErrors: string[];
  onUpdate: (employee: VirtualEmployeeProfile) => void;
}

/**
 * EmployeeProfileEditor Component
 */
export const EmployeeProfileEditor: FC<EmployeeProfileEditorProps> = ({
  employee,
  validationErrors,
  onUpdate,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

  const handleNameChange = (value: string) => {
    onUpdate({ ...employee, name: value });
  };

  const handleGoalChange = (value: string) => {
    onUpdate({ ...employee, in_depth_goal: value });
  };

  const handleBackstoryChange = (value: string) => {
    onUpdate({ ...employee, in_depth_backstory: value });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {/* Header with Avatar */}
      <Box sx={{ display: 'flex', gap: spacing.md, alignItems: 'flex-start' }}>
        <Avatar
          src={employee.photo_path}
          sx={{
            width: 100,
            height: 100,
            bgcolor: muiTheme.palette.primary.main,
          }}
        >
          {employee.name.charAt(0)}
        </Avatar>

        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ mb: spacing.xs }}>
            {literal['onboarding.profileEditor.title']}
          </Typography>
          <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
            {employee.role_title}
          </Typography>
          <Typography variant="micro" sx={{ color: muiTheme.palette.primary.main, mt: spacing.xs }}>
            {employee.trigger_name} · {employee.trigger_designation}
          </Typography>
        </Box>
      </Box>

      {/* Name Field */}
      <TextField
        fullWidth
        label={literal['onboarding.profileEditor.nameLabel']}
        value={employee.name}
        onChange={(e) => handleNameChange(e.target.value)}
        size="small"
      />

      {/* Goal Field (Multiline) */}
      <TextField
        fullWidth
        label={literal['onboarding.profileEditor.goalLabel']}
        value={employee.in_depth_goal}
        onChange={(e) => handleGoalChange(e.target.value)}
        multiline
        rows={4}
        size="small"
        helperText={literal['onboarding.profileEditor.goalHelper']}
      />

      {/* Backstory Field (Multiline) */}
      <TextField
        fullWidth
        label={literal['onboarding.profileEditor.backstoryLabel']}
        value={employee.in_depth_backstory}
        onChange={(e) => handleBackstoryChange(e.target.value)}
        multiline
        rows={4}
        size="small"
        helperText={literal['onboarding.profileEditor.backstoryHelper']}
      />

      {/* Agent Design Info (Read-only) */}
      <Card
        sx={{
          p: spacing.md,
          border: `1px solid ${muiTheme.palette.divider}`,
          backgroundColor: muiTheme.palette.background.default,
        }}
      >
        <Typography variant="body2Bold" sx={{ mb: spacing.sm }}>
          {literal['onboarding.profileEditor.agentDesignTitle']}
        </Typography>
        <Stack spacing={spacing.xs}>
          <Box>
            <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
              {literal['onboarding.profileEditor.designation']}
            </Typography>
            <Typography variant="body2">{employee.agent_designation}</Typography>
          </Box>
          <Box>
            <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
              {literal['onboarding.profileEditor.crisisRole']}
            </Typography>
            <Typography variant="body2">{employee.crisis_protocol_role}</Typography>
          </Box>
        </Stack>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Box sx={{ p: spacing.md, backgroundColor: muiTheme.palette.error.light, borderRadius: '4px' }}>
          {validationErrors.map((error, idx) => (
            <Typography key={idx} variant="body2" sx={{ color: muiTheme.palette.error.main }}>
              • {error}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default EmployeeProfileEditor;
