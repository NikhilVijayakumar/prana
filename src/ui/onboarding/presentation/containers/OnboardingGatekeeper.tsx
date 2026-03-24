/**
 * OnboardingGatekeeper Container
 * Master orchestrator for 3-Phase Onboarding
 * Manages navigation between phases and final commit logic
 */

import { FC, useEffect } from 'react';
import { Box, CircularProgress, Alert, useTheme as useMuiTheme } from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';
import { OnboardingState } from '../../domain/onboarding.types';
import { PhaseProgressIndicator } from '../components/PhaseProgressIndicator';

interface OnboardingGatekeeperProps {
  state: OnboardingState;
  isLoading?: boolean;
  onPhaseChange?: (phase: 1 | 2 | 3) => void;
}

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
      <PhaseProgressIndicator
        currentPhase={state.currentPhase}
        phase1Status={state.phase1.status}
        phase2Status={state.phase2.status}
        phase3Status={state.phase3.status}
        sx={{ marginBottom: spacing.xl }}
      />

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
