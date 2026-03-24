import { ChangeEvent, FC } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  CircularProgress,
  Divider,
  IconButton,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  useTheme as useMuiTheme,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';
import {
  DynamicFieldRecord,
  FieldValidationStatus,
  ModelAccessDraft,
  ModelProviderDraft,
  OnboardingStepConfig,
  PhaseTrackerStatus,
  ProfileAlignmentWarning,
} from '../viewmodel/useOnboardingViewModel';
import { DynamicProfileRenderer } from '@prana/ui/components/DynamicProfileRenderer';
import { LifecycleGlobalSkill, LifecycleProfileDraft } from '@prana/ui/state/LifecycleProvider';

interface SummarySection {
  stepId: string;
  titleKey: string;
  fields: DynamicFieldRecord[];
}

interface OnboardingViewProps {
  steps: OnboardingStepConfig[];
  stepStatusById: Record<string, 'PENDING' | 'DRAFT' | 'APPROVED'>;
  phaseTrackerById: Record<string, PhaseTrackerStatus>;
  currentStep: number;
  totalSteps: number;
  currentStepConfig: OnboardingStepConfig;
  currentStepFields: DynamicFieldRecord[];
  canDirectorApproveAll: boolean;
  canApproveCurrentStep: boolean;
  canGoNext: boolean;
  jsonError: string | null;
  commitError: string | null;
  modelAccess: ModelAccessDraft;
  summary: {
    sections: SummarySection[];
    modelAccess: ModelAccessDraft;
    kpiData: Record<string, string>;
  };
  currentStepValidation: FieldValidationStatus[];
  guidanceByFieldKey: Record<string, string>;
  statusByFieldKey: Record<string, FieldValidationStatus>;
  isCommitting: boolean;
  virtualProfiles: LifecycleProfileDraft[];
  profileAlignmentByAgent: Record<string, ProfileAlignmentWarning[]>;
  globalSkills: LifecycleGlobalSkill[];
  selectedVirtualProfileId: string;
  onSelectVirtualProfile: (agentId: string) => void;
  onUpdateVirtualProfile: (agentId: string, patch: Partial<LifecycleProfileDraft>) => void;
  onUpdateVirtualSkill: (skillId: string, markdown: string) => void;
  onUpdateField: (index: number, key: 'key' | 'value', value: string) => void;
  onAddField: () => void;
  onRemoveField: (index: number) => void;
  onApplyJson: (file: File) => Promise<void>;
  onUpdateModelProvider: (
    provider: keyof ModelAccessDraft,
    field: keyof ModelProviderDraft,
    value: string | boolean,
  ) => void;
  onApproveStep: () => void;
  onJumpToStep: (targetIndex: number) => void;
  onNext: () => void;
  onBack: () => void;
  onGoHome: () => void;
  onApproveAndCommit: () => void;
}

const providerOrder: Array<keyof ModelAccessDraft> = ['lmstudio', 'openrouter', 'gemini'];

const renderFieldRows = (
  fields: DynamicFieldRecord[],
  literal: Record<string, string>,
  guidanceByFieldKey: Record<string, string>,
  statusByFieldKey: Record<string, FieldValidationStatus>,
  onUpdateField: OnboardingViewProps['onUpdateField'],
  onRemoveField: OnboardingViewProps['onRemoveField'],
): React.ReactNode => {
  return fields.map((field, index) => (
    <Box key={`${index}-${field.key}`} sx={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: spacing.sm }}>
        <TextField
          value={field.key}
          onChange={(event) => onUpdateField(index, 'key', event.target.value)}
          label={literal['onboarding.dynamic.keyLabel']}
          size="small"
        />
        <TextField
          value={field.value}
          onChange={(event) => onUpdateField(index, 'value', event.target.value)}
          label={literal['onboarding.dynamic.valueLabel']}
          size="small"
        />
        <IconButton onClick={() => onRemoveField(index)} aria-label={literal['onboarding.dynamic.removeField']}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
      {field.key.trim().length > 0 && (
        <Typography variant="micro" sx={{ color: 'text.secondary' }}>
          {guidanceByFieldKey[field.key] ?? literal['onboarding.dynamic.noGuidance']}
        </Typography>
      )}
      {field.key.trim().length > 0 && statusByFieldKey[field.key] && (
        <Typography
          variant="micro"
          sx={{
            color:
              statusByFieldKey[field.key].mandatoryForEfficiency && !statusByFieldKey[field.key].isValid
                ? 'warning.main'
                : 'success.main',
          }}
        >
          {statusByFieldKey[field.key].mandatoryForEfficiency
            ? statusByFieldKey[field.key].isValid
              ? literal['onboarding.schema.mandatoryComplete']
              : literal['onboarding.schema.mandatoryMissing']
            : statusByFieldKey[field.key].isValid
              ? literal['onboarding.schema.optionalComplete']
              : literal['onboarding.schema.optionalMissing']}
          {statusByFieldKey[field.key].message ? ` • ${statusByFieldKey[field.key].message}` : ''}
        </Typography>
      )}
    </Box>
  ));
};

export const OnboardingView: FC<OnboardingViewProps> = ({
  steps,
  stepStatusById,
  phaseTrackerById,
  currentStep,
  totalSteps,
  currentStepConfig,
  currentStepFields,
  canDirectorApproveAll,
  canApproveCurrentStep,
  canGoNext,
  jsonError,
  commitError,
  modelAccess,
  summary,
  currentStepValidation,
  guidanceByFieldKey,
  statusByFieldKey,
  isCommitting,
  virtualProfiles,
  profileAlignmentByAgent,
  globalSkills,
  selectedVirtualProfileId,
  onSelectVirtualProfile,
  onUpdateVirtualProfile,
  onUpdateVirtualSkill,
  onUpdateField,
  onAddField,
  onRemoveField,
  onApplyJson,
  onUpdateModelProvider,
  onApproveStep,
  onJumpToStep,
  onNext,
  onBack,
  onGoHome,
  onApproveAndCommit,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

  const onJsonFilePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void onApplyJson(file);
    event.target.value = '';
  };

  const selectedVirtualProfile =
    virtualProfiles.find((entry) => entry.agentId === selectedVirtualProfileId) ?? virtualProfiles[0] ?? null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: spacing.xl }}>
      <Card
        sx={{
          width: 'min(980px, 96vw)',
          border: `1px solid ${muiTheme.palette.divider}`,
          backgroundColor: muiTheme.palette.background.paper,
          p: spacing.xl,
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.lg,
        }}
      >
        <Stepper activeStep={currentStep} alternativeLabel>
          {steps.map((step) => (
            <Step key={step.id}>
              <StepLabel>{literal[step.titleKey]}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Card sx={{ p: spacing.md, border: `1px solid ${muiTheme.palette.divider}`, backgroundColor: 'transparent' }}>
          <Typography variant="body2Bold" sx={{ mb: spacing.sm }}>
            {literal['onboarding.dashboard.phaseTracker']}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {steps.map((step, index) => {
              const tracker = phaseTrackerById[step.id];
              const trackerState = tracker?.state ?? 'LOCKED';
              const stateColor =
                trackerState === 'APPROVED'
                  ? 'success.main'
                  : trackerState === 'VALIDATED'
                    ? 'info.main'
                    : trackerState === 'DRAFT'
                    ? 'warning.main'
                    : 'text.secondary';

              return (
                <Box
                  key={`dashboard-${step.id}`}
                  sx={{
                    border: `1px solid ${muiTheme.palette.divider}`,
                    borderRadius: '8px',
                    p: spacing.sm,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing.xs,
                  }}
                >
                  <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
                    {literal[step.titleKey]}
                  </Typography>
                  <Typography variant="body2Bold" sx={{ color: stateColor }}>
                    {trackerState === 'APPROVED'
                      ? literal['onboarding.phase.state.approved']
                      : trackerState === 'VALIDATED'
                        ? literal['onboarding.phase.state.validated']
                        : trackerState === 'DRAFT'
                          ? literal['onboarding.phase.state.draft']
                          : literal['onboarding.phase.state.locked']}
                  </Typography>
                  {tracker?.requiresReverification && (
                    <Typography variant="micro" sx={{ color: 'warning.main' }}>
                      {literal['onboarding.phase.requiresReverification']}
                    </Typography>
                  )}
                  <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
                    {stepStatusById[step.id]}
                  </Typography>
                  <Button variant="outlined" size="small" onClick={() => onJumpToStep(index)}>
                    {literal['onboarding.dashboard.openDetail']}
                  </Button>
                </Box>
              );
            })}
          </Box>
        </Card>

        <Box>
          <Typography variant="h5" sx={{ color: muiTheme.palette.text.primary, mb: spacing.xs }}>
            {literal[currentStepConfig.titleKey]}
          </Typography>
          <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
            {literal[currentStepConfig.bodyKey]}
          </Typography>
        </Box>

        {jsonError && (
          <Alert severity="warning">{literal[jsonError] ?? jsonError}</Alert>
        )}

        {commitError && (
          <Alert severity="error">{literal[commitError] ?? commitError}</Alert>
        )}

        {currentStepConfig.kind === 'dynamic-form' && currentStepConfig.id === 'agent-profile-persona' && selectedVirtualProfile && (
          <DynamicProfileRenderer
            mode="WIZARD"
            profile={selectedVirtualProfile}
            profiles={virtualProfiles}
            globalSkills={globalSkills}
            alignmentWarnings={profileAlignmentByAgent[selectedVirtualProfile.agentId] ?? []}
            onSelectProfile={onSelectVirtualProfile}
            onProfileChange={(patch) => onUpdateVirtualProfile(selectedVirtualProfile.agentId, patch)}
            onGlobalSkillChange={onUpdateVirtualSkill}
          />
        )}

        {currentStepConfig.kind === 'dynamic-form' && currentStepConfig.id !== 'agent-profile-persona' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            <Alert severity="info">{literal['onboarding.dynamic.modeHelp']}</Alert>

            <Box sx={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={onAddField}>
                {literal['onboarding.dynamic.addField']}
              </Button>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                {literal['onboarding.dynamic.uploadJson']}
                <input hidden type="file" accept="application/json" onChange={onJsonFilePicked} />
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {renderFieldRows(
                currentStepFields,
                literal as Record<string, string>,
                guidanceByFieldKey,
                statusByFieldKey,
                onUpdateField,
                onRemoveField,
              )}
            </Box>

            {currentStepValidation.length > 0 && (
              <Alert severity={currentStepValidation.some((item) => item.mandatoryForEfficiency && !item.isValid) ? 'warning' : 'success'}>
                {currentStepValidation.some((item) => item.mandatoryForEfficiency && !item.isValid)
                  ? literal['onboarding.schema.stepNeedsAttention']
                  : literal['onboarding.schema.stepReady']}
              </Alert>
            )}

            {!canGoNext && (
              <Alert severity="warning">{literal['onboarding.guard.missingInput']}</Alert>
            )}
          </Box>
        )}

        {currentStepConfig.kind === 'infrastructure-finalization' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            <Alert severity="info">{literal['onboarding.modelAccess.volatileNotice']}</Alert>
            {providerOrder.map((providerId) => {
              const providerDraft = modelAccess[providerId];
              return (
                <Card
                  key={providerId}
                  sx={{ p: spacing.md, border: `1px solid ${muiTheme.palette.divider}`, backgroundColor: 'transparent' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: spacing.sm }}>
                    <Typography variant="body2Bold">{literal[`onboarding.modelAccess.${providerId}.title`]}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Checkbox
                        checked={providerDraft.enabled}
                        onChange={(event) => onUpdateModelProvider(providerId, 'enabled', event.target.checked)}
                      />
                      <Typography variant="body2">{literal['onboarding.modelAccess.enabled']}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}>
                    <TextField
                      size="small"
                      label={literal['onboarding.modelAccess.endpoint']}
                      value={providerDraft.endpoint}
                      onChange={(event) => onUpdateModelProvider(providerId, 'endpoint', event.target.value)}
                    />
                    <TextField
                      size="small"
                      label={literal['onboarding.modelAccess.model']}
                      value={providerDraft.model}
                      onChange={(event) => onUpdateModelProvider(providerId, 'model', event.target.value)}
                    />
                    <TextField
                      size="small"
                      label={literal['onboarding.modelAccess.apiKey']}
                      value={providerDraft.apiKey}
                      onChange={(event) => onUpdateModelProvider(providerId, 'apiKey', event.target.value)}
                    />
                  </Box>
                </Card>
              );
            })}

            <Card sx={{ p: spacing.md, border: `1px solid ${muiTheme.palette.divider}`, backgroundColor: 'transparent' }}>
              <Typography variant="body2Bold" sx={{ mb: spacing.sm }}>
                {literal['onboarding.final.registryToolsTitle']}
              </Typography>
              <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary, mb: spacing.sm }}>
                {literal['onboarding.final.registryToolsBody']}
              </Typography>
              <Box sx={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Button variant="outlined" onClick={() => window.location.assign('#/settings/agents')}>
                  {literal['onboarding.final.openLifecycleManager']}
                </Button>
                <Button variant="outlined" onClick={() => window.location.assign('#/settings/registry')}>
                  {literal['onboarding.final.openRegistryViewer']}
                </Button>
              </Box>
            </Card>
          </Box>
        )}

        {currentStepConfig.kind === 'infrastructure-finalization' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            <Alert severity="success">{literal['onboarding.final.summaryHelp']}</Alert>

            {summary.sections.map((section) => (
              <Card key={section.stepId} sx={{ p: spacing.md, border: `1px solid ${muiTheme.palette.divider}`, backgroundColor: 'transparent' }}>
                <Typography variant="body2Bold" sx={{ mb: spacing.sm }}>
                  {literal[section.titleKey]}
                </Typography>
                {section.fields.length === 0 ? (
                  <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
                    {literal['onboarding.final.emptySection']}
                  </Typography>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.xs }}>
                    {section.fields.map((field) => (
                      <Box key={`${section.stepId}-${field.key}`}>
                        <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
                          {field.key || literal['onboarding.dynamic.keyLabel']}
                        </Typography>
                        <Typography variant="body2">{field.value || literal['global.na']}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Card>
            ))}

            <Card sx={{ p: spacing.md, border: `1px solid ${muiTheme.palette.divider}`, backgroundColor: 'transparent' }}>
              <Typography variant="body2Bold" sx={{ mb: spacing.sm }}>
                {literal['onboarding.final.modelAccessTitle']}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                {providerOrder.map((providerId) => (
                  <Typography key={`summary-${providerId}`} variant="body2">
                    {literal[`onboarding.modelAccess.${providerId}.title`]}: {summary.modelAccess[providerId].enabled ? literal['status.success'] : literal['status.idle']}
                  </Typography>
                ))}
              </Box>
            </Card>

            <Card sx={{ p: spacing.md, border: `1px solid ${muiTheme.palette.divider}`, backgroundColor: 'transparent' }}>
              <Typography variant="body2Bold" sx={{ mb: spacing.sm }}>
                {literal['onboarding.final.kpiCommitPreview']}
              </Typography>
              {Object.keys(summary.kpiData).length === 0 ? (
                <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
                  {literal['onboarding.final.noKpis']}
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.xs }}>
                  {Object.entries(summary.kpiData).map(([key, value]) => (
                    <Box key={`kpi-${key}`}>
                      <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
                        {key}
                      </Typography>
                      <Typography variant="body2">{value}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Card>
          </Box>
        )}

        <Divider />

        {currentStepConfig.id !== 'infrastructure-finalization' && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={onApproveStep} disabled={isCommitting || !canApproveCurrentStep}>
              {literal['onboarding.action.approveStep']}
            </Button>
          </Box>
        )}

        {currentStepConfig.id === 'infrastructure-finalization' && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={onApproveStep} disabled={isCommitting || !canApproveCurrentStep}>
              {literal['onboarding.action.approveStep']}
            </Button>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: spacing.sm }}>
          <Box sx={{ display: 'flex', gap: spacing.sm }}>
            <Button variant="outlined" onClick={onBack} disabled={currentStep === 0 || isCommitting}>
              {literal['onboarding.action.back']}
            </Button>
            <Button variant="outlined" onClick={onGoHome} disabled={isCommitting}>
              {literal['onboarding.action.home']}
            </Button>
          </Box>

          {currentStep === totalSteps - 1 ? (
            <Button variant="contained" onClick={onApproveAndCommit} disabled={isCommitting || !canDirectorApproveAll}>
              {isCommitting ? <CircularProgress size={18} color="inherit" /> : literal['onboarding.action.directorApproveAll']}
            </Button>
          ) : (
            <Button variant="contained" onClick={onNext} disabled={isCommitting || !canGoNext}>
              {literal['onboarding.action.continue']}
            </Button>
          )}
        </Box>
      </Card>
    </Box>
  );
};
