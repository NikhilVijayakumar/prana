import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingViewModel } from '../viewmodel/useOnboardingViewModel';
import { OnboardingView } from './OnboardingView';
import { getFirstEnabledMainRoute } from 'prana/ui/constants/moduleRegistry';

export const OnboardingContainer: FC = () => {
  const navigate = useNavigate();
  
  const handleComplete = () => {
    navigate('/triage', { replace: true });
  };

  const vm = useOnboardingViewModel(handleComplete);

  return (
    <OnboardingView
      steps={vm.steps}
      stepStatusById={vm.stepStatusById}
      phaseTrackerById={vm.phaseTrackerById}
      currentStep={vm.currentStep}
      totalSteps={vm.totalSteps}
      currentStepConfig={vm.currentStepConfig}
      currentStepFields={vm.currentStepFields}
      canDirectorApproveAll={vm.canDirectorApproveAll}
      canApproveCurrentStep={vm.canApproveCurrentStep}
      canGoNext={vm.canGoNext}
      jsonError={vm.jsonError}
      commitError={vm.commitError}
      modelAccess={vm.modelAccess}
      summary={vm.summary}
      currentStepValidation={vm.currentStepValidation}
      guidanceByFieldKey={vm.guidanceByFieldKey}
      statusByFieldKey={vm.statusByFieldKey}
      isCommitting={vm.isCommitting}
      virtualProfiles={vm.virtualProfiles}
      profileAlignmentByAgent={vm.profileAlignmentByAgent}
      globalSkills={vm.globalSkills}
      selectedVirtualProfileId={vm.selectedVirtualProfileId}
      onSelectVirtualProfile={vm.setSelectedVirtualProfileId}
      onUpdateVirtualProfile={vm.updateVirtualProfile}
      onUpdateVirtualSkill={vm.updateVirtualSkill}
      onUpdateField={vm.updateField}
      onAddField={vm.addField}
      onRemoveField={vm.removeField}
      onApplyJson={vm.applyJson}
      onUpdateModelProvider={vm.updateModelProvider}
      onApproveStep={vm.approveCurrentStep}
      onJumpToStep={vm.jumpToStep}
      onNext={vm.goNext}
      onBack={vm.goBack}
      onGoHome={() => navigate(getFirstEnabledMainRoute())}
      onApproveAndCommit={() => {
        void vm.approveAndCommit();
      }}
    />
  );
};
