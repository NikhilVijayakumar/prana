/**
 * Phase1EmployeeManager Container
 * Manages Virtual Employee Persona editing and skill assignment
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
} from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';
import { Phase1DraftState, VirtualEmployeeProfile } from '../../domain/onboarding.types';
import { EmployeeProfileEditor } from '../components/EmployeeProfileEditor';
import { SkillRegistry } from '../components/SkillRegistry';

interface Phase1EmployeeManagerProps {
  phase1Draft: Phase1DraftState;
  onUpdateDraft: (draft: Partial<Phase1DraftState>) => void;
  onCommit: () => Promise<void>;
  isCommitting: boolean;
  globalSkills: Map<string, string>;
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
 * Phase1EmployeeManager Component
 */
export const Phase1EmployeeManager: FC<Phase1EmployeeManagerProps> = ({
  phase1Draft,
  onUpdateDraft,
  onCommit,
  isCommitting,
  globalSkills,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();
  const [tabValue, setTabValue] = useState(0);
  const [selectedEmployeeIndex, setSelectedEmployeeIndex] = useState<number>(0);

  const selectedEmployee = phase1Draft.employees[selectedEmployeeIndex];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEmployeeSelect = (index: number) => {
    setSelectedEmployeeIndex(index);
    setTabValue(0); // Switch to profiles tab
  };

  const handleUpdateEmployee = (updatedEmployee: VirtualEmployeeProfile) => {
    const updatedEmployees = [...phase1Draft.employees];
    updatedEmployees[selectedEmployeeIndex] = updatedEmployee;
    onUpdateDraft({ employees: updatedEmployees });
  };

  const handleUpdateSkills = (skillIds: string[]) => {
    if (!selectedEmployee) return;

    const updatedEmployee: VirtualEmployeeProfile = {
      ...selectedEmployee,
      skills: skillIds.map((skillId) => ({
        skill_id: skillId,
        skill_name: skillId, // Would be fetched from global skills
        source: `skills/${skillId}.md`,
        description: '',
      })),
    };

    handleUpdateEmployee(updatedEmployee);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, maxWidth: '1200px', margin: '0 auto' }}>
      {/* Info Alert */}
      <Alert severity="info">{literal['onboarding.phase1.help']}</Alert>

      {/* Tab Navigation */}
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        sx={{
          borderBottom: `1px solid ${muiTheme.palette.divider}`,
        }}
      >
        <Tab label={literal['onboarding.phase1.tabProfiles']} />
        <Tab label={literal['onboarding.phase1.tabSkills']} disabled={!selectedEmployee} />
      </Tabs>

      {/* Tab Panel 1: Employee Selector & Profile Editor */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', gap: spacing.lg }}>
          {/* Employee Selector (Grid) */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: spacing.sm,
              minWidth: '300px',
            }}
          >
            {phase1Draft.employees.map((emp, idx) => (
              <Button
                key={emp.id}
                variant={selectedEmployeeIndex === idx ? 'contained' : 'outlined'}
                onClick={() => handleEmployeeSelect(idx)}
                sx={{
                  flexDirection: 'column',
                  padding: spacing.sm,
                  height: 'auto',
                  minHeight: '80px',
                }}
              >
                <Typography variant="body2Bold">{emp.name}</Typography>
                <Typography variant="micro" sx={{ mt: spacing.xs }}>
                  {emp.role_title}
                </Typography>
              </Button>
            ))}
          </Box>

          {/* Profile Editor */}
          {selectedEmployee && (
            <Card
              sx={{
                flex: 1,
                padding: spacing.lg,
                border: `1px solid ${muiTheme.palette.divider}`,
                backgroundColor: muiTheme.palette.background.paper,
              }}
            >
              <EmployeeProfileEditor
                employee={selectedEmployee}
                validationErrors={phase1Draft.validationErrors[selectedEmployee.id] || []}
                onUpdate={handleUpdateEmployee}
              />
            </Card>
          )}
        </Box>
      </TabPanel>

      {/* Tab Panel 2: Skill Registry & Assignment */}
      <TabPanel value={tabValue} index={1}>
        {selectedEmployee && (
          <SkillRegistry
            employee={selectedEmployee}
            globalSkills={globalSkills}
            selectedSkillIds={selectedEmployee.skills.map((s) => s.skill_id)}
            onUpdateSkills={handleUpdateSkills}
            validationErrors={phase1Draft.validationErrors[`${selectedEmployee.id}.skills`] || []}
          />
        )}
      </TabPanel>

      {/* Validation Errors Summary */}
      {Object.keys(phase1Draft.validationErrors).length > 0 && (
        <Alert severity="error">{literal['onboarding.validationErrors']}</Alert>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end', marginTop: spacing.xl }}>
        <Button variant="outlined" disabled={isCommitting}>
          {literal['global.cancel']}
        </Button>
        <Button
          variant="contained"
          disabled={isCommitting || !phase1Draft.employees.length}
          onClick={onCommit}
        >
          {isCommitting ? literal['onboarding.committing'] : literal['onboarding.saveAndNext']}
        </Button>
      </Box>
    </Box>
  );
};

export default Phase1EmployeeManager;
