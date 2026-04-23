import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CronExpressionParser } from 'cron-parser';
import { getAppDataRoot, mkdirSafe } from './governanceRepoService';
import { hookSystemService } from './hookSystemService';
import {
  CronJobRecoveryPolicy,
  CronJobStateRecord,
  governanceLifecycleQueueStoreService,
} from './governanceLifecycleQueueStoreService';
import {
  SYNC_PULL_CRON_JOB_ID,
  SYNC_PUSH_CRON_JOB_ID,
  syncProviderService,
} from './syncProviderService';
import { getRuntimeBootstrapConfig } from './runtimeConfigService';

export type CronRunStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED_OVERLAP';

export interface CronJob {
  id: string;
  name: string;
  expression: string;
  target: string;
  recoveryPolicy: CronJobRecoveryPolicy;
  enabled: boolean;
  retentionDays: number;
  maxRuntimeMs: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: CronRunStatus | null;
  lastRunSource: 'scheduler' | 'manual' | null;
  runCount: number;
  running: boolean;
}

export interface CronTelemetry {
  totalJobs: number;
  enabledJobs: number;
  runningJobs: number;
  totalRuns: number;
  failedRuns: number;
  skippedOverlapRuns: number;
  schedulerActive: boolean;
  lastTickAt: string | null;
  recovery: CronRecoverySummary;
}

export interface CronRecoverySummary {
  recoveredInterruptedTasks: number;
  missedJobsDetected: number;
  missedJobsEnqueued: number;
  duplicatePreventions: number;
  processedTasks: number;
  failedTasks: number;
  completedAt: string | null;
}

interface PersistedCronState {
  jobs: CronJob[];
  updatedAt: string;
}

type CronJobExecutor = () => Promise<void>;

const STORE_FILE = 'cron-schedules.json';
const TICK_INTERVAL_MS = 30_000;
const LOCK_TIMEOUT_MS = 30_000;
const MAX_CATCH_UP_WINDOWS_PER_SWEEP = 96;
let initialized = false;
let tickTimer: NodeJS.Timeout | null = null;
let lastTickAt: string | null = null;
let latestRecoverySummary: CronRecoverySummary = {
  recoveredInterruptedTasks: 0,
  missedJobsDetected: 0,
  missedJobsEnqueued: 0,
  duplicatePreventions: 0,
  processedTasks: 0,
  failedTasks: 0,
  completedAt: null,
};

const jobs = new Map<string, CronJob>();
const customJobExecutorsByJobId = new Map<string, CronJobExecutor>();
const customJobExecutorsByTarget = new Map<string, CronJobExecutor>();

const nowIso = (): string => new Date().toISOString();

const getStorePath = (): string => join(getAppDataRoot(), STORE_FILE);

const cloneJob = (job: CronJob): CronJob => ({ ...job });
const cloneRecoverySummary = (): CronRecoverySummary => ({ ...latestRecoverySummary });

const getSyncCronDefaults = (): {
  pushCronExpression: string;
  pullCronExpression: string;
  cronEnabled: boolean;
} => {
  try {
    const sync = getRuntimeBootstrapConfig().sync;
    return {
      pushCronExpression: sync.pushCronExpression,
      pullCronExpression: sync.pullCronExpression,
      cronEnabled: sync.cronEnabled,
    };
  } catch {
    // Test environments can initialize cron before runtime bootstrap.
    return {
      pushCronExpression: '*/30 * * * *',
      pullCronExpression: '*/30 * * * *',
      cronEnabled: true,
    };
  }
};

const defaultJobs = (): CronJob[] => {
  const now = new Date();
  const syncConfig = getSyncCronDefaults();
  return [
    {
      id: 'job-daily-brief',
      name: 'Daily Brief Compilation',
      expression: '0 8 * * *',
      target: 'DAILY_BRIEF',
      recoveryPolicy: 'RUN_ONCE',
      enabled: true,
      retentionDays: 30,
      maxRuntimeMs: 5000,
      nextRunAt: computeNextRunIso('0 8 * * *', now),
      lastRunAt: null,
      lastRunStatus: null,
      lastRunSource: null,
      runCount: 0,
      running: false,
    },
    {
      id: 'job-weekly-review',
      name: 'Weekly Review Compilation',
      expression: '0 9 * * 5',
      target: 'WEEKLY_REVIEW',
      recoveryPolicy: 'RUN_ONCE',
      enabled: true,
      retentionDays: 60,
      maxRuntimeMs: 8000,
      nextRunAt: computeNextRunIso('0 9 * * 5', now),
      lastRunAt: null,
      lastRunStatus: null,
      lastRunSource: null,
      runCount: 0,
      running: false,
    },
    {
      id: SYNC_PUSH_CRON_JOB_ID,
      name: 'Registry Sync Push (DB -> Vault)',
      expression: syncConfig.pushCronExpression,
      target: 'SYNC_PUSH',
      recoveryPolicy: 'RUN_ONCE',
      enabled: syncConfig.cronEnabled,
      retentionDays: 30,
      maxRuntimeMs: 30_000,
      nextRunAt: computeNextRunIso(syncConfig.pushCronExpression, now),
      lastRunAt: null,
      lastRunStatus: null,
      lastRunSource: null,
      runCount: 0,
      running: false,
    },
    {
      id: SYNC_PULL_CRON_JOB_ID,
      name: 'Registry Sync Pull (Vault -> DB)',
      expression: syncConfig.pullCronExpression,
      target: 'SYNC_PULL',
      recoveryPolicy: 'RUN_ONCE',
      enabled: syncConfig.cronEnabled,
      retentionDays: 30,
      maxRuntimeMs: 30_000,
      nextRunAt: computeNextRunIso(syncConfig.pullCronExpression, now),
      lastRunAt: null,
      lastRunStatus: null,
      lastRunSource: null,
      runCount: 0,
      running: false,
    },
  ];
};

const runJobAction = async (job: CronJob): Promise<void> => {
  const customExecutor = customJobExecutorsByJobId.get(job.id) ?? customJobExecutorsByTarget.get(job.target);
  if (customExecutor) {
    await customExecutor();
    return;
  }

  if (job.id === SYNC_PUSH_CRON_JOB_ID || job.target === 'SYNC_PUSH') {
    await syncProviderService.triggerBackgroundPush();
    return;
  }

  if (job.id === SYNC_PULL_CRON_JOB_ID || job.target === 'SYNC_PULL') {
    await syncProviderService.triggerBackgroundPull();
    return;
  }
};

const ensureStoreExists = async (): Promise<void> => {
  await mkdirSafe(getAppDataRoot());
  const path = getStorePath();

  if (!existsSync(path)) {
    const seeded: PersistedCronState = {
      jobs: defaultJobs(),
      updatedAt: nowIso(),
    };
    await writeFile(path, JSON.stringify(seeded, null, 2), 'utf8');
  }
};

const readStore = async (): Promise<PersistedCronState> => {
  await ensureStoreExists();
  const raw = await readFile(getStorePath(), 'utf8');
  const parsed = JSON.parse(raw) as PersistedCronState;
  return {
    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : defaultJobs(),
    updatedAt: parsed.updatedAt ?? nowIso(),
  };
};

const mapStateRecordToJob = (record: CronJobStateRecord): CronJob => {
  const computedNextRun = computeNextRunIso(record.expression, new Date());
  return {
    id: record.id,
    name: record.name,
    expression: record.expression,
    target: record.target,
    recoveryPolicy: record.recoveryPolicy,
    enabled: record.status === 'active',
    retentionDays: Math.max(7, record.retentionDays || 30),
    maxRuntimeMs: Math.max(1000, record.maxRuntimeMs || 5000),
    nextRunAt: record.nextRunAt ?? computedNextRun,
    lastRunAt: record.lastRunAt,
    lastRunStatus: null,
    lastRunSource: null,
    runCount: 0,
    running: false,
  };
};

const persistJobState = async (job: CronJob): Promise<void> => {
  await governanceLifecycleQueueStoreService.upsertCronJob({
    id: job.id,
    name: job.name,
    expression: job.expression,
    target: job.target,
    status: job.enabled ? 'active' : 'paused',
    recoveryPolicy: job.recoveryPolicy,
    retentionDays: job.retentionDays,
    maxRuntimeMs: job.maxRuntimeMs,
    lastRunAt: job.lastRunAt,
    nextRunAt: job.nextRunAt,
  });
};

const loadJobsFromDatabase = async (): Promise<void> => {
  const stored = await governanceLifecycleQueueStoreService.listCronJobs();
  jobs.clear();
  for (const record of stored) {
    const normalized = mapStateRecordToJob(record);
    jobs.set(normalized.id, normalized);
  }
};

const importJobsToDatabase = async (records: CronJob[]): Promise<void> => {
  for (const record of records) {
    await governanceLifecycleQueueStoreService.upsertCronJob({
      id: record.id,
      name: record.name,
      expression: record.expression,
      target: record.target,
      status: record.enabled ? 'active' : 'paused',
      recoveryPolicy: record.recoveryPolicy,
      retentionDays: Math.max(7, record.retentionDays || 30),
      maxRuntimeMs: Math.max(1000, record.maxRuntimeMs || 5000),
      lastRunAt: record.lastRunAt,
      nextRunAt: record.nextRunAt,
    });
  }
};

const migrateLegacyStoreIfNeeded = async (): Promise<void> => {
  const existing = await governanceLifecycleQueueStoreService.listCronJobs();
  if (existing.length > 0) {
    return;
  }

  if (!existsSync(getStorePath())) {
    await importJobsToDatabase(defaultJobs());
    return;
  }

  const legacy = await readStore();
  const records: CronJob[] = [];
  for (const job of legacy.jobs) {
    if (!validateExpression(job.expression)) {
      continue;
    }

    const normalized: CronJob = {
      id: job.id,
      name: job.name,
      expression: job.expression,
      target: job.target?.trim() || job.id,
      recoveryPolicy: job.recoveryPolicy ?? 'RUN_ONCE',
      enabled: job.enabled !== false,
      retentionDays: Math.max(7, job.retentionDays || 30),
      maxRuntimeMs: Math.max(1000, job.maxRuntimeMs || 5000),
      nextRunAt: job.nextRunAt ?? computeNextRunIso(job.expression, new Date()),
      lastRunAt: job.lastRunAt ?? null,
      lastRunStatus: null,
      lastRunSource: null,
      runCount: 0,
      running: false,
    };
    records.push(normalized);
  }

  if (records.length === 0) {
    records.push(...defaultJobs());
  }

  await importJobsToDatabase(records);
};

const validateExpression = (expression: string): boolean => {
  try {
    CronExpressionParser.parse(expression, { currentDate: new Date() });
    return true;
  } catch {
    return false;
  }
};

const computeNextRunDate = (expression: string, fromDate: Date): Date | null => {
  try {
    const parsed = CronExpressionParser.parse(expression, {
      currentDate: fromDate,
    });
    return parsed.next().toDate();
  } catch {
    return null;
  }
};

const computeDueOccurrences = (job: CronJob, now: Date): string[] => {
  if (!job.nextRunAt) {
    return [];
  }

  const firstDueTime = Date.parse(job.nextRunAt);
  if (Number.isNaN(firstDueTime) || firstDueTime > now.getTime()) {
    return [];
  }

  const occurrences: string[] = [job.nextRunAt];
  let cursor = new Date(firstDueTime + 1000);

  for (let i = 1; i < MAX_CATCH_UP_WINDOWS_PER_SWEEP; i += 1) {
    const next = computeNextRunDate(job.expression, cursor);
    if (!next || next.getTime() > now.getTime()) {
      break;
    }

    occurrences.push(next.toISOString());
    cursor = new Date(next.getTime() + 1000);
  }

  return occurrences;
};

const computeNextRunIso = (expression: string, fromDate: Date): string | null => {
  const date = computeNextRunDate(expression, fromDate);
  return date ? date.toISOString() : null;
};

const markRun = (
  job: CronJob,
  status: CronRunStatus,
  source: 'scheduler' | 'manual',
  completedAt: Date,
): void => {
  job.lastRunAt = completedAt.toISOString();
  job.lastRunStatus = status;
  job.lastRunSource = source;
  job.runCount += 1;
  job.nextRunAt = computeNextRunIso(job.expression, completedAt);
};

const persistExecution = async (payload: {
  job: CronJob;
  startedAt: string;
  completedAt: string;
  status: CronRunStatus;
  source: 'scheduler' | 'manual' | 'recovery';
  errorMessage?: string;
}): Promise<void> => {
  await governanceLifecycleQueueStoreService.appendCronExecutionLog({
    jobId: payload.job.id,
    startedAt: payload.startedAt,
    completedAt: payload.completedAt,
    status:
      payload.status === 'SUCCESS'
        ? 'success'
        : payload.status === 'FAILED'
          ? 'failed'
          : 'skipped_overlap',
    errorMessage: payload.errorMessage ?? null,
    source: payload.source,
  });
};

const getJobPriority = (jobId: string): number => {
  if (jobId === SYNC_PULL_CRON_JOB_ID) {
    return 0;
  }
  if (jobId === SYNC_PUSH_CRON_JOB_ID) {
    return 1;
  }
  return 2;
};

const enqueueDueJobs = async (
  now: Date,
  source: 'SCHEDULED' | 'MISSED',
): Promise<{
  detected: number;
  enqueued: number;
  duplicatePreventions: number;
}> => {
  const dueJobs: Array<{ job: CronJob; scheduledFor: string }> = [];
  let detected = 0;

  for (const job of jobs.values()) {
    if (!job.enabled || !job.nextRunAt) {
      continue;
    }

    const dueOccurrences = computeDueOccurrences(job, now);
    if (dueOccurrences.length === 0) {
      continue;
    }

    detected += dueOccurrences.length;

    if (source === 'MISSED' && job.recoveryPolicy === 'SKIP') {
      job.nextRunAt = computeNextRunIso(job.expression, now);
      await persistJobState(job);
      continue;
    }

    if (source === 'MISSED' && job.recoveryPolicy === 'RUN_ONCE') {
      dueJobs.push({ job, scheduledFor: dueOccurrences[0] });
      job.nextRunAt = computeNextRunIso(job.expression, now);
      await persistJobState(job);
      continue;
    }

    for (const scheduledFor of dueOccurrences) {
      dueJobs.push({ job, scheduledFor });
    }

    const lastDue = dueOccurrences[dueOccurrences.length - 1];
    job.nextRunAt = computeNextRunIso(job.expression, new Date(Date.parse(lastDue) + 1000));
    await persistJobState(job);
  }

  dueJobs.sort((a, b) => {
    const delta = getJobPriority(a.job.id) - getJobPriority(b.job.id);
    if (delta !== 0) {
      return delta;
    }
    return a.job.name.localeCompare(b.job.name);
  });

  let enqueued = 0;
  let duplicatePreventions = 0;

  for (const entry of dueJobs) {
    const { job, scheduledFor } = entry;

    const result = await governanceLifecycleQueueStoreService.enqueueTask({
      jobId: job.id,
      jobName: job.name,
      scheduledFor,
      source,
    });
    if (result.inserted) {
      enqueued += 1;
    }
    if (result.duplicatePrevented) {
      duplicatePreventions += 1;
    }
  }

  return {
    detected,
    enqueued,
    duplicatePreventions,
  };
};

const processPendingTaskQueue = async (): Promise<{
  processed: number;
  failed: number;
}> => {
  const pending = await governanceLifecycleQueueStoreService.listPendingTasks();
  pending.sort((a, b) => {
    const timeDelta = Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    const priorityDelta = getJobPriority(a.jobId) - getJobPriority(b.jobId);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return a.createdAt.localeCompare(b.createdAt);
  });

  let processed = 0;
  let failed = 0;

  for (const task of pending) {
    const job = jobs.get(task.jobId);
    if (!job) {
      await governanceLifecycleQueueStoreService.markTaskFailed(task.taskId, `Unknown cron job: ${task.jobId}`);
      processed += 1;
      failed += 1;
      continue;
    }

    await governanceLifecycleQueueStoreService.markTaskRunning(task.taskId);
    const status = await executeJob(job, task.source === 'SCHEDULED' ? 'scheduler' : 'manual');
    processed += 1;

    if (status === 'SUCCESS' || status === 'SKIPPED_OVERLAP') {
      await governanceLifecycleQueueStoreService.markTaskCompleted(task.taskId);
    } else {
      await governanceLifecycleQueueStoreService.markTaskFailed(task.taskId, 'Cron execution failed');
      failed += 1;
    }
  }

  return {
    processed,
    failed,
  };
};

const executeJob = async (
  job: CronJob,
  source: 'scheduler' | 'manual',
): Promise<CronRunStatus> => {
  const startedAt = nowIso();

  if (job.running) {
    const completedAt = new Date();
    markRun(job, 'SKIPPED_OVERLAP', source, completedAt);
    await persistJobState(job);
    await persistExecution({
      job,
      startedAt,
      completedAt: completedAt.toISOString(),
      status: 'SKIPPED_OVERLAP',
      source,
      errorMessage: 'Job execution skipped because previous run is still in progress.',
    });
    return 'SKIPPED_OVERLAP';
  }

  const lockResult = await governanceLifecycleQueueStoreService.acquireCronLock({
    jobId: job.id,
    lockTimeoutMs: LOCK_TIMEOUT_MS,
  });
  if (!lockResult.acquired) {
    const completedAt = new Date();
    markRun(job, 'SKIPPED_OVERLAP', source, completedAt);
    await persistJobState(job);
    await persistExecution({
      job,
      startedAt,
      completedAt: completedAt.toISOString(),
      status: 'SKIPPED_OVERLAP',
      source,
      errorMessage: 'Cron lock acquisition failed.',
    });
    return 'SKIPPED_OVERLAP';
  }

  job.running = true;

  try {
    await runJobAction(job);
    await hookSystemService.emitAndWait('schedule.tick', {
      jobId: job.id,
      scheduleName: job.name,
      source,
    });
    const completedAt = new Date();
    markRun(job, 'SUCCESS', source, completedAt);
    await persistJobState(job);
    await persistExecution({
      job,
      startedAt,
      completedAt: completedAt.toISOString(),
      status: 'SUCCESS',
      source,
    });
    return 'SUCCESS';
  } catch (error) {
    const completedAt = new Date();
    markRun(job, 'FAILED', source, completedAt);
    await persistJobState(job);
    await persistExecution({
      job,
      startedAt,
      completedAt: completedAt.toISOString(),
      status: 'FAILED',
      source,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return 'FAILED';
  } finally {
    job.running = false;
    await governanceLifecycleQueueStoreService.releaseCronLock(job.id);
  }
};

const tickInternal = async (): Promise<void> => {
  const now = new Date();
  lastTickAt = now.toISOString();

  await enqueueDueJobs(now, 'SCHEDULED');
  await processPendingTaskQueue();
};

const startTimer = (): void => {
  if (tickTimer) {
    return;
  }

  tickTimer = setInterval(() => {
    void tickInternal();
  }, TICK_INTERVAL_MS);
};

const ensureInitialized = async (): Promise<void> => {
  if (initialized) {
    return;
  }

  await migrateLegacyStoreIfNeeded();
  await loadJobsFromDatabase();

  const recoveredInterruptedTasks = await governanceLifecycleQueueStoreService.recoverInterruptedTasks();
  const missedSummary = await enqueueDueJobs(new Date(), 'MISSED');
  const processedSummary = await processPendingTaskQueue();

  latestRecoverySummary = {
    recoveredInterruptedTasks,
    missedJobsDetected: missedSummary.detected,
    missedJobsEnqueued: missedSummary.enqueued,
    duplicatePreventions: missedSummary.duplicatePreventions,
    processedTasks: processedSummary.processed,
    failedTasks: processedSummary.failed,
    completedAt: nowIso(),
  };

  startTimer();
  initialized = true;
};

export const cronSchedulerService = {
  async initialize(): Promise<void> {
    await ensureInitialized();
  },

  async listJobs(): Promise<CronJob[]> {
    await ensureInitialized();
    return [...jobs.values()].map(cloneJob).sort((a, b) => a.name.localeCompare(b.name));
  },

  async upsertJob(input: {
    id: string;
    name: string;
    expression: string;
    target?: string;
    recoveryPolicy?: CronJobRecoveryPolicy;
    enabled?: boolean;
    retentionDays?: number;
    maxRuntimeMs?: number;
  }): Promise<CronJob> {
    await ensureInitialized();

    if (!input.id.trim()) {
      throw new Error('Cron job id is required.');
    }
    if (!input.name.trim()) {
      throw new Error('Cron job name is required.');
    }
    if (!validateExpression(input.expression)) {
      throw new Error('Invalid cron expression. Supported: */N * * * *, M H * * *, M H * * DOW');
    }

    const existing = jobs.get(input.id);
    const baseDate = new Date();

    const nextRunAt = computeNextRunIso(input.expression, baseDate);
    const merged: CronJob = {
      id: input.id,
      name: input.name,
      expression: input.expression,
      target: input.target?.trim() || existing?.target || input.id,
      recoveryPolicy: input.recoveryPolicy ?? existing?.recoveryPolicy ?? 'RUN_ONCE',
      enabled: input.enabled ?? existing?.enabled ?? true,
      retentionDays: Math.max(7, input.retentionDays ?? existing?.retentionDays ?? 30),
      maxRuntimeMs: Math.max(1000, input.maxRuntimeMs ?? existing?.maxRuntimeMs ?? 5000),
      nextRunAt,
      lastRunAt: existing?.lastRunAt ?? null,
      lastRunStatus: existing?.lastRunStatus ?? null,
      lastRunSource: existing?.lastRunSource ?? null,
      runCount: existing?.runCount ?? 0,
      running: existing?.running ?? false,
    };

    jobs.set(input.id, merged);
    await persistJobState(merged);
    return cloneJob(merged);
  },

  async removeJob(jobId: string): Promise<boolean> {
    await ensureInitialized();
    const removed = jobs.delete(jobId);
    if (removed) {
      await governanceLifecycleQueueStoreService.removeCronJob(jobId);
    }
    return removed;
  },

  async pauseJob(jobId: string): Promise<CronJob | null> {
    await ensureInitialized();
    const job = jobs.get(jobId);
    if (!job) {
      return null;
    }

    job.enabled = false;
    await persistJobState(job);
    return cloneJob(job);
  },

  async resumeJob(jobId: string): Promise<CronJob | null> {
    await ensureInitialized();
    const job = jobs.get(jobId);
    if (!job) {
      return null;
    }

    job.enabled = true;
    job.nextRunAt = computeNextRunIso(job.expression, new Date());
    await persistJobState(job);
    return cloneJob(job);
  },

  async runNow(jobId: string): Promise<CronJob | null> {
    await ensureInitialized();
    const job = jobs.get(jobId);
    if (!job) {
      return null;
    }

    await executeJob(job, 'manual');
    return cloneJob(job);
  },

  async tick(): Promise<void> {
    await ensureInitialized();
    await tickInternal();
  },

  async getTelemetry(): Promise<CronTelemetry> {
    await ensureInitialized();
    const all = [...jobs.values()];

    return {
      totalJobs: all.length,
      enabledJobs: all.filter((job) => job.enabled).length,
      runningJobs: all.filter((job) => job.running).length,
      totalRuns: all.reduce((sum, job) => sum + job.runCount, 0),
      failedRuns: all.filter((job) => job.lastRunStatus === 'FAILED').length,
      skippedOverlapRuns: all.filter((job) => job.lastRunStatus === 'SKIPPED_OVERLAP').length,
      schedulerActive: tickTimer !== null,
      lastTickAt,
      recovery: cloneRecoverySummary(),
    };
  },

  async dispose(): Promise<void> {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    initialized = false;
  },

  __computeNextRunForTesting(expression: string, fromIso: string): string | null {
    return computeNextRunIso(expression, new Date(fromIso));
  },

  async __resetForTesting(): Promise<void> {
    await this.dispose();
    jobs.clear();
    customJobExecutorsByJobId.clear();
    customJobExecutorsByTarget.clear();
    lastTickAt = null;
    latestRecoverySummary = {
      recoveredInterruptedTasks: 0,
      missedJobsDetected: 0,
      missedJobsEnqueued: 0,
      duplicatePreventions: 0,
      processedTasks: 0,
      failedTasks: 0,
      completedAt: null,
    };
    await mkdirSafe(getAppDataRoot());
    const seeded: PersistedCronState = {
      jobs: defaultJobs(),
      updatedAt: nowIso(),
    };
    await writeFile(getStorePath(), JSON.stringify(seeded, null, 2), 'utf8');
    for (const job of seeded.jobs) {
      await governanceLifecycleQueueStoreService.upsertCronJob({
        id: job.id,
        name: job.name,
        expression: job.expression,
        target: job.target,
        status: job.enabled ? 'active' : 'paused',
        recoveryPolicy: job.recoveryPolicy,
        retentionDays: job.retentionDays,
        maxRuntimeMs: job.maxRuntimeMs,
        lastRunAt: job.lastRunAt,
        nextRunAt: job.nextRunAt,
      });
    }
  },

  async __setJobStateForTesting(jobId: string, patch: Partial<CronJob>): Promise<CronJob | null> {
    await ensureInitialized();
    const job = jobs.get(jobId);
    if (!job) {
      return null;
    }

    Object.assign(job, patch);
    if (!job.target) {
      job.target = job.id;
    }
    if (!job.recoveryPolicy) {
      job.recoveryPolicy = 'RUN_ONCE';
    }
    await persistJobState(job);
    return cloneJob(job);
  },

  registerJobExecutor(jobId: string, executor: CronJobExecutor): void {
    if (!jobId.trim()) {
      throw new Error('Cron executor job id is required.');
    }
    customJobExecutorsByJobId.set(jobId, executor);
  },

  registerExecutor(target: string, executor: CronJobExecutor): void {
    if (!target.trim()) {
      throw new Error('Cron executor target is required.');
    }
    customJobExecutorsByTarget.set(target, executor);
  },

  unregisterJobExecutor(jobId: string): void {
    customJobExecutorsByJobId.delete(jobId);
  },

  unregisterExecutor(target: string): void {
    customJobExecutorsByTarget.delete(target);
  },

  unregisterJobExecutorsByPrefix(prefix: string): void {
    for (const key of [...customJobExecutorsByJobId.keys()]) {
      if (key.startsWith(prefix)) {
        customJobExecutorsByJobId.delete(key);
      }
    }
  },
};
