import { useEffect, useMemo, useState } from 'react';
import { useFailFastAsync } from 'prana/ui/common/errors/useFailFastAsync';
import { CronManagementRepo, CronJobRecord, CronProposalRecord, CronRecoveryPolicy, CronTelemetry } from '../repo/CronManagementRepo';

export interface CronEditorState {
  id: string;
  name: string;
  expression: string;
  target: string;
  recoveryPolicy: CronRecoveryPolicy;
  enabled: boolean;
  retentionDays: number;
  maxRuntimeMs: number;
}

export interface CronEditorErrors {
  id?: string;
  name?: string;
  expression?: string;
  target?: string;
  retentionDays?: string;
  maxRuntimeMs?: string;
}

const createEmptyEditorState = (): CronEditorState => ({
  id: '',
  name: '',
  expression: '*/15 * * * *',
  target: '',
  recoveryPolicy: 'RUN_ONCE',
  enabled: true,
  retentionDays: 30,
  maxRuntimeMs: 5000,
});

const mapJobToEditorState = (job: CronJobRecord): CronEditorState => ({
  id: job.id,
  name: job.name,
  expression: job.expression,
  target: job.target,
  recoveryPolicy: job.recoveryPolicy,
  enabled: job.enabled,
  retentionDays: job.retentionDays,
  maxRuntimeMs: job.maxRuntimeMs,
});

export const useCronManagementViewModel = () => {
  const repo = useMemo(() => new CronManagementRepo(), []);
  const { fatalError, clearFatalError, runSafely } = useFailFastAsync('viewmodel');

  const [jobs, setJobs] = useState<CronJobRecord[]>([]);
  const [telemetry, setTelemetry] = useState<CronTelemetry | null>(null);
  const [proposals, setProposals] = useState<CronProposalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorState, setEditorState] = useState<CronEditorState>(createEmptyEditorState());
  const [editorErrors, setEditorErrors] = useState<CronEditorErrors>({});
  const [editorMessage, setEditorMessage] = useState<string | null>(null);
  const [proposalJobId, setProposalJobId] = useState('');
  const [proposalStatusFilter, setProposalStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN' | 'ALL'>('PENDING');

  const validateEditor = (candidate: CronEditorState): CronEditorErrors => {
    const errors: CronEditorErrors = {};

    const id = candidate.id.trim();
    const name = candidate.name.trim();
    const expression = candidate.expression.trim();
    const target = candidate.target.trim() || id;

    if (!id) {
      errors.id = 'Job id is required.';
    } else if (!/^[a-zA-Z0-9._:-]+$/.test(id)) {
      errors.id = 'Use letters, numbers, dot, underscore, colon, or dash only.';
    }

    if (!name) {
      errors.name = 'Job name is required.';
    } else {
      const normalized = name.toLowerCase();
      const duplicate = jobs.some(
        (job) => job.name.toLowerCase() === normalized && job.id !== id,
      );
      if (duplicate) {
        errors.name = 'Duplicate job name is not allowed.';
      }
    }

    if (!expression) {
      errors.expression = 'Cron expression is required.';
    } else if (expression.split(/\s+/).filter(Boolean).length < 5) {
      errors.expression = 'Expression should contain at least 5 cron fields.';
    }

    if (!target) {
      errors.target = 'Target executor key is required.';
    }

    if (!Number.isFinite(candidate.retentionDays) || candidate.retentionDays < 7) {
      errors.retentionDays = 'Retention must be at least 7 days.';
    }

    if (!Number.isFinite(candidate.maxRuntimeMs) || candidate.maxRuntimeMs < 1000) {
      errors.maxRuntimeMs = 'Max runtime must be at least 1000 ms.';
    }

    return errors;
  };

  const loadAll = async (): Promise<void> => {
    setIsLoading(true);
    await runSafely(async () => {
      const [jobsPayload, telemetryPayload, proposalsPayload] = await Promise.all([
        repo.listJobs(),
        repo.telemetry(),
        repo.listProposals(proposalStatusFilter === 'ALL' ? undefined : proposalStatusFilter),
      ]);
      setJobs(jobsPayload.sort((a, b) => a.name.localeCompare(b.name)));
      setTelemetry(telemetryPayload);
      setProposals(proposalsPayload);
    }, {
      category: 'ipc',
      title: 'Cron Load Error',
      userMessage: 'Cron schedules could not be loaded.',
      swallow: true,
    });
    setIsLoading(false);
  };

  useEffect(() => {
    void loadAll();
  }, [proposalStatusFilter]);

  const openCreateEditor = (): void => {
    setEditorState(createEmptyEditorState());
    setEditorErrors({});
    setEditorMessage(null);
    setEditorOpen(true);
  };

  const openEditEditor = (job: CronJobRecord): void => {
    setEditorState(mapJobToEditorState(job));
    setEditorErrors({});
    setEditorMessage(null);
    setEditorOpen(true);
  };

  const closeEditor = (): void => {
    setEditorErrors({});
    setEditorMessage(null);
    setEditorOpen(false);
  };

  const saveEditor = async (): Promise<void> => {
    const errors = validateEditor(editorState);
    setEditorErrors(errors);
    if (Object.keys(errors).length > 0) {
      setEditorMessage('Please fix validation errors before saving.');
      return;
    }

    setIsSaving(true);
    const trimmedTarget = editorState.target.trim() || editorState.id.trim();
    setEditorMessage(null);

    await runSafely(async () => {
      await repo.upsertJob({
        id: editorState.id.trim(),
        name: editorState.name.trim(),
        expression: editorState.expression.trim(),
        target: trimmedTarget,
        recoveryPolicy: editorState.recoveryPolicy,
        enabled: editorState.enabled,
        retentionDays: editorState.retentionDays,
        maxRuntimeMs: editorState.maxRuntimeMs,
      });
      setEditorOpen(false);
      setEditorErrors({});
      await loadAll();
    }, {
      category: 'ipc',
      title: 'Cron Save Error',
      userMessage: 'Cron job could not be saved. Verify expression and target.',
      swallow: true,
    });

    if (fatalError) {
      setEditorMessage('Save failed. Review the error and try again.');
    }

    setIsSaving(false);
  };

  const pauseJob = async (id: string): Promise<void> => {
    await runSafely(async () => {
      await repo.pauseJob(id);
      await loadAll();
    }, {
      category: 'ipc',
      title: 'Cron Pause Error',
      userMessage: 'Cron job could not be paused.',
      swallow: true,
    });
  };

  const resumeJob = async (id: string): Promise<void> => {
    await runSafely(async () => {
      await repo.resumeJob(id);
      await loadAll();
    }, {
      category: 'ipc',
      title: 'Cron Resume Error',
      userMessage: 'Cron job could not be resumed.',
      swallow: true,
    });
  };

  const runNow = async (id: string): Promise<void> => {
    await runSafely(async () => {
      await repo.runNow(id);
      await loadAll();
    }, {
      category: 'ipc',
      title: 'Cron Run Error',
      userMessage: 'Cron run-now action failed.',
      swallow: true,
    });
  };

  const removeJob = async (id: string): Promise<void> => {
    await runSafely(async () => {
      await repo.removeJob(id);
      await loadAll();
    }, {
      category: 'ipc',
      title: 'Cron Delete Error',
      userMessage: 'Cron job could not be removed.',
      swallow: true,
    });
  };

  const submitProposalForJob = async (jobId: string): Promise<void> => {
    const target = jobs.find((entry) => entry.id === jobId);
    if (!target) {
      return;
    }

    await runSafely(async () => {
      await repo.createProposal({
        id: target.id,
        name: target.name,
        expression: target.expression,
        retentionDays: target.retentionDays,
        maxRuntimeMs: target.maxRuntimeMs,
      });
      setProposalJobId('');
      await loadAll();
    }, {
      category: 'ipc',
      title: 'Cron Proposal Error',
      userMessage: 'Cron governance proposal could not be created.',
      swallow: true,
    });
  };

  const reviewProposal = async (
    proposalId: string,
    status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN',
  ): Promise<void> => {
    await runSafely(async () => {
      await repo.reviewProposal({
        proposalId,
        status,
        reviewer: 'DIRECTOR',
      });
      await loadAll();
    }, {
      category: 'ipc',
      title: 'Cron Proposal Review Error',
      userMessage: 'Proposal review action failed.',
      swallow: true,
    });
  };

  return {
    jobs,
    telemetry,
    proposals,
    proposalStatusFilter,
    setProposalStatusFilter,
    isLoading,
    isSaving,
    editorOpen,
    editorState,
    editorErrors,
    editorMessage,
    setEditorState,
    proposalJobId,
    setProposalJobId,
    openCreateEditor,
    openEditEditor,
    closeEditor,
    saveEditor,
    pauseJob,
    resumeJob,
    runNow,
    removeJob,
    submitProposalForJob,
    reviewProposal,
    reload: loadAll,
    moduleError: fatalError,
    clearModuleError: clearFatalError,
  };
};
