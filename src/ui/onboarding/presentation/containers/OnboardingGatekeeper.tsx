/**
 * OnboardingGatekeeper Container
 * Master orchestrator for 3-Phase Onboarding
 * Manages navigation between phases and final commit logic
 */

import { FC, useEffect } from 'react';
import { Box, CircularProgress, Alert, useTheme as useMuiTheme } from '@mui/material';
import { MultiStepProgressIndicator, ProgressStep, StepStatus, useLanguage } from 'astra/components';
import { spacing } from 'astra';
import { OnboardingPhaseStatus, OnboardingState } from '../../domain/onboarding.types';

interface OnboardingGatekeeperProps {
  state: OnboardingState;
  isLoading?: boolean;
  onPhaseChange?: (phase: 1 | 2 | 3) => void;
}

const mapStatusToStepStatus = (status: OnboardingPhaseStatus): StepStatus => {
  if (status === 'committed') {
    return 'completed';
  }
  if (status === 'locked') {
    return 'blocked';
  }
  return status;
};

/**
 * OnboardingGatekeeper: Main component
 * Renders the appropriate phase UI based on current state
 */
export const OnboardingGatekeeper: FC<OnboardingGatekeeperProps> = ({
  state,
  isLoading = false,
  onPhaseChange,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();
  const steps: ProgressStep[] = [
    {
      id: 'phase-1',
      label: literal['onboarding.phase1.shortLabel'],
      shortLabel: literal['onboarding.phase1.shortLabel'],
      status: mapStatusToStepStatus(state.phase1.status),
    },
    {
      id: 'phase-2',
      label: literal['onboarding.phase2.shortLabel'],
      shortLabel: literal['onboarding.phase2.shortLabel'],
      status: mapStatusToStepStatus(state.phase2.status),
    },
    {
      id: 'phase-3',
      label: literal['onboarding.phase3.shortLabel'],
      shortLabel: literal['onboarding.phase3.shortLabel'],
      status: mapStatusToStepStatus(state.phase3.status),
    },
  ];

  // Handle phase transitions
  useEffect(() => {
    if (onPhaseChange) {
      onPhaseChange(state.currentPhase);
    }
  }, [state.currentPhase, onPhaseChange]);

  // Show loading during commit
  if (isLoading || state.isCommitting) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: spacing.lg,
          backgroundColor: muiTheme.palette.background.default,
        }}
      >
        <CircularProgress />
        <Alert severity="info">{literal['onboarding.committing']}</Alert>
      </Box>
    );
  }

  // Render root layout
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: muiTheme.palette.background.default,
        padding: spacing.xl,
      }}
    >
      {/* Step Indicator */}
      <Box sx={{ marginBottom: spacing.xl }}>
        <MultiStepProgressIndicator
          steps={steps}
          currentStepId={`phase-${state.currentPhase}`}
        />
      </Box>

      {/* Error Alert (if any) */}
      {state.commitError && (
        <Alert severity="error" sx={{ marginBottom: spacing.lg }}>
          {state.commitError}
        </Alert>
      )}

      {/* Phase Content (rendered by parent component via children) */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {/* Content will be injected by parent or as children prop */}
      </Box>
    </Box>
  );
};

export default OnboardingGatekeeper;
