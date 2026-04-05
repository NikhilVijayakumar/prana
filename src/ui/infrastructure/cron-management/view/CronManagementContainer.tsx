import { FC } from 'react';
import { PranaModuleErrorBoundary } from 'prana/ui/common/PranaModuleErrorBoundary';
import { throwPranaUiError } from 'prana/ui/common/errors/pranaFailFast';
import { useCronManagementViewModel } from '../viewmodel/useCronManagementViewModel';
import { CronManagementView } from './CronManagementView';

export const CronManagementContainer: FC = () => {
  const vm = useCronManagementViewModel();

  if (vm.moduleError) {
    throwPranaUiError(vm.moduleError);
  }

  return (
    <PranaModuleErrorBoundary>
      <CronManagementView
        jobs={vm.jobs}
        telemetry={vm.telemetry}
        proposals={vm.proposals}
        proposalStatusFilter={vm.proposalStatusFilter}
        onProposalStatusFilterChange={vm.setProposalStatusFilter}
        isLoading={vm.isLoading}
        isSaving={vm.isSaving}
        editorOpen={vm.editorOpen}
        editorState={vm.editorState}
        editorErrors={vm.editorErrors}
        editorMessage={vm.editorMessage}
        setEditorState={vm.setEditorState}
        proposalJobId={vm.proposalJobId}
        setProposalJobId={vm.setProposalJobId}
        onOpenCreateEditor={vm.openCreateEditor}
        onOpenEditEditor={vm.openEditEditor}
        onCloseEditor={vm.closeEditor}
        onSaveEditor={vm.saveEditor}
        onPause={vm.pauseJob}
        onResume={vm.resumeJob}
        onRunNow={vm.runNow}
        onRemove={vm.removeJob}
        onReload={vm.reload}
        onSubmitProposal={vm.submitProposalForJob}
        onReviewProposal={vm.reviewProposal}
      />
    </PranaModuleErrorBoundary>
  );
};
