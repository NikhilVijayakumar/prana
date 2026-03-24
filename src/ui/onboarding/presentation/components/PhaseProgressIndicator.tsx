/**
 * PhaseProgressIndicator Component
 * Visual step indicator showing progress through 3 phases of onboarding
 */

import { FC } from 'react';
import { Box, Step, StepLabel, Stepper, SxProps, Theme, Typography, useTheme as useMuiTheme } from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from 'astra';
import { OnboardingPhaseStatus } from '../../domain/onboarding.types';

interface PhaseProgressIndicatorProps {
  currentPhase: 1 | 2 | 3;
  phase1Status: OnboardingPhaseStatus;
  phase2Status: OnboardingPhaseStatus;
  phase3Status: OnboardingPhaseStatus;
  sx?: SxProps<Theme>;
}

/**
 * Maps phase status to step index (0 = Phase 1, 1 = Phase 2, 2 = Phase 3)
 */
const getActiveStep = (currentPhase: number): number => {
  return currentPhase - 1;
};

/**
 * PhaseProgressIndicator Component
 */
export const PhaseProgressIndicator: FC<PhaseProgressIndicatorProps> = ({
  currentPhase,
  phase1Status,
  phase2Status,
  phase3Status,
  sx,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

  const phases = [
    { label: 'onboarding.phase1.shortLabel', status: phase1Status },
    { label: 'onboarding.phase2.shortLabel', status: phase2Status },
    { label: 'onboarding.phase3.shortLabel', status: phase3Status },
  ];

  return (
    <Box sx={sx}>
      {/* Main Stepper */}
      <Stepper
        activeStep={getActiveStep(currentPhase)}
        alternativeLabel
        sx={{
          backgroundColor: muiTheme.palette.background.paper,
          padding: spacing.lg,
          borderRadius: '12px',
          border: `1px solid ${muiTheme.palette.divider}`,
        }}
      >
        {phases.map((phase, index) => (
          <Step
            key={index}
            completed={phase.status === 'committed'}
            disabled={phase.status === 'locked'}
          >
            <StepLabel>{literal[phase.label]}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Status Legend */}
      <Box
        sx={{
          display: 'flex',
          gap: spacing.lg,
          marginTop: spacing.md,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        {phases.map((phase, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <Box
              sx={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor:
                  phase.status === 'committed'
                    ? muiTheme.palette.success.main
                    : phase.status === 'in-progress'
                      ? muiTheme.palette.info.main
                      : phase.status === 'locked'
                        ? muiTheme.palette.action.disabled
                        : muiTheme.palette.action.hover,
              }}
            />
            <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
              {phase.status === 'committed'
                ? literal['onboarding.status.committed']
                : phase.status === 'in-progress'
                  ? literal['onboarding.status.inProgress']
                  : phase.status === 'locked'
                    ? literal['onboarding.status.locked']
                    : literal['onboarding.status.notStarted']}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default PhaseProgressIndicator;
