
import { CronExpressionParser } from 'cron-parser';
import { hookSystemService } from '../governance/hookSystemService';
import {
  CronJobRecoveryPolicy,
  CronJobStateRecord,
  governanceLifecycleQueueStoreService,
} from '../governance/governanceLifecycleQueueStoreService';
import {
  SYNC_PULL_CRON_JOB_ID,
  SYNC_PUSH_CRON_JOB_ID,
  syncProviderService,
} from '../sync/syncProviderService';
import { getRuntimeBootstrapConfig } from '../../common/config/runtimeConfigService';

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

const MAX_CATCH_UP_WINDOWS_PER_SWEEP = 96;

type CronJobExecutor = () => Promise<void>;

const parseCron = (expression: string, baseDate?: Date): ReturnType<typeof CronExpressionParser.parse> | null => {
  try {
    const opts = baseDate ? { currentDate: baseDate } : undefined;
    return CronExpressionParser.parse(expression, opts);
  } catch {
    return null;
  }
};

const computeNextRunIso = (expression: string, baseDate: Date): string => {
  const interval = parseCron(expression, baseDate);
  if (!interval) return '';
  try {
    const next = interval.next();
    if (next === null) return '';
    return typeof next.toISOString === 'function' ? next.toISOString() : String(next);
  } catch {
    return '';
  }
};

export const validateExpression = (expression: string): boolean => {
  if (!expression || typeof expression !== 'string') return false;
  const trimmed = expression.trim();
  if (!trimmed) return false;
  const interval = parseCron(trimmed);
  if (!interval) return false;
  try {
    const next = interval.next();
    return next !== null;
  } catch {
    return false;
  }
};

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
    return {
      pushCronExpression: '*/30 * * *',
      pullCronExpression: '*/30 * * *',
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
      recoveryPolicy: 'RUN_ONCE' as CronJobRecoveryPolicy,
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
      recoveryPolicy: 'RUN_ONCE' as CronJobRecoveryPolicy,
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
      recoveryPolicy: 'RUN_ONCE' as CronJobRecoveryPolicy,
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
      recoveryPolicy: 'RUN_ONCE' as CronJobRecoveryPolicy,
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

export const createCronScheduler = () => {
  let initialized = false;
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

  const enqueueDueJobs = async (now: Date, source: 'SCHEDULED' | 'MISSED'): Promise<{ detected: number; enqueued: number; duplicatePreventions: number }> => {
    let detected = 0;
    let enqueued = 0;
    let duplicatePreventions = 0;

    for (const job of jobs.values()) {
      if (!job.enabled || job.running) continue;
      if (!job.nextRunAt) continue;

      const nextRunTime = Date.parse(job.nextRunAt);
      if (Number.isNaN(nextRunTime)) continue;

      if (nextRunTime > now.getTime()) continue;

      detected++;

      if (source === 'MISSED' && job.recoveryPolicy === 'SKIP') {
        const newNextRun = computeNextRunIso(job.expression, new Date(nextRunTime + 1000));
        if (newNextRun) {
          job.nextRunAt = newNextRun;
        }
        continue;
      }

      if (source === 'MISSED' && job.recoveryPolicy === 'RUN_ONCE') {
        const result = await governanceLifecycleQueueStoreService.enqueueTask({
          jobId: job.id,
          jobName: job.name,
          scheduledFor: job.nextRunAt,
          source: 'RECOVERY',
        });
        if (result.duplicatePrevented) {
          duplicatePreventions++;
        }
        if (result.inserted) {
          enqueued++;
        }
        const newNextRun = computeNextRunIso(job.expression, new Date(nextRunTime + 1000));
        if (newNextRun) {
          job.nextRunAt = newNextRun;
        }
        continue;
      }

      if (source === 'MISSED' && job.recoveryPolicy === 'CATCH_UP') {
        let cursor = new Date(nextRunTime);
        let catchUpCount = 0;
        while (cursor.getTime() <= now.getTime() && catchUpCount < MAX_CATCH_UP_WINDOWS_PER_SWEEP) {
          const scheduledFor = cursor.toISOString();
          const result = await governanceLifecycleQueueStoreService.enqueueTask({
            jobId: job.id,
            jobName: job.name,
            scheduledFor,
            source: 'RECOVERY',
          });
          if (result.duplicatePrevented) {
            duplicatePreventions++;
          }
          if (result.inserted) {
            enqueued++;
          }
          const nextCursorStr = computeNextRunIso(job.expression, new Date(cursor.getTime() + 1000));
          if (!nextCursorStr) break;
          cursor = new Date(nextCursorStr);
          catchUpCount++;
        }
        const newNextRun = computeNextRunIso(job.expression, new Date(cursor.getTime() + 1000));
        if (newNextRun) {
          job.nextRunAt = newNextRun;
        }
        continue;
      }

      const result = await governanceLifecycleQueueStoreService.enqueueTask({
        jobId: job.id,
        jobName: job.name,
        scheduledFor: job.nextRunAt,
        source: source === 'SCHEDULED' ? 'SCHEDULED' : 'RECOVERY',
      });
      if (result.duplicatePrevented) {
        duplicatePreventions++;
      }
      if (result.inserted) {
        enqueued++;
      }
      const newNextRun = computeNextRunIso(job.expression, new Date(nextRunTime + 1000));
      if (newNextRun) {
        job.nextRunAt = newNextRun;
      }
    }

    return { detected, enqueued, duplicatePreventions };
  };

  const processPendingTaskQueue = async (): Promise<{ processed: number; failed: number }> => {
    const pendingTasks = await governanceLifecycleQueueStoreService.listPendingTasks();
    let processed = 0;
    let failed = 0;

    for (const task of pendingTasks) {
      const job = jobs.get(task.jobId);
      if (!job) {
        await governanceLifecycleQueueStoreService.markTaskFailed(task.taskId, 'Job not found');
        failed++;
        continue;
      }

      if (job.running) {
        continue;
      }

      job.running = true;
      await governanceLifecycleQueueStoreService.markTaskRunning(task.taskId);

      try {
        const lockResult = await governanceLifecycleQueueStoreService.acquireCronLock({
          jobId: job.id,
          lockTimeoutMs: job.maxRuntimeMs,
        });

        if (!lockResult.acquired) {
          job.running = false;
          processed++;
          continue;
        }

        const startedAt = nowIso();
        let runStatus: CronRunStatus = 'SUCCESS';
        let errorMessage: string | null = null;

        try {
          await runJobAction(job);
        } catch (err) {
          runStatus = 'FAILED';
          errorMessage = err instanceof Error ? err.message : 'Unknown error';
        }

        const completedAt = nowIso();
        job.lastRunAt = completedAt;
        job.lastRunStatus = runStatus;
        job.lastRunSource = 'scheduler';
        job.runCount++;
        job.running = false;

        if (runStatus === 'SUCCESS') {
          await governanceLifecycleQueueStoreService.markTaskCompleted(task.taskId);
        } else {
          await governanceLifecycleQueueStoreService.markTaskFailed(task.taskId, errorMessage ?? 'Unknown error');
        }

        await governanceLifecycleQueueStoreService.appendCronExecutionLog({
          jobId: job.id,
          startedAt,
          completedAt,
          status: runStatus === 'SUCCESS' ? 'success' : runStatus === 'FAILED' ? 'failed' : 'skipped_overlap',
          errorMessage,
          source: task.source === 'RECOVERY' ? 'recovery' : 'scheduler',
        });

        if (runStatus === 'SUCCESS') {
          processed++;
        } else {
          failed++;
        }

        await governanceLifecycleQueueStoreService.releaseCronLock(job.id);

        await hookSystemService.emitAndWait('schedule.tick', {
          jobId: job.id,
          jobName: job.name,
          status: runStatus,
          source: task.source,
        });

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
      } catch (err) {
        job.running = false;
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        await governanceLifecycleQueueStoreService.markTaskFailed(task.taskId, errMsg);
        failed++;
      }
    }

    return { processed, failed };
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

  const tickInternal = async (): Promise<void> => {
    const now = new Date();
    lastTickAt = now.toISOString();
    await enqueueDueJobs(now, 'SCHEDULED');
    await processPendingTaskQueue();
  };

  const ensureInitialized = async (): Promise<void> => {
    if (initialized) return;

    let stored = await governanceLifecycleQueueStoreService.listCronJobs();

    if (stored.length === 0) {
      const defaults = defaultJobs();
      for (const job of defaults) {
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
      stored = await governanceLifecycleQueueStoreService.listCronJobs();
    }

    stored.forEach((record) => {
      const job = mapStateRecordToJob(record);
      jobs.set(job.id, job);
    });

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

    initialized = true;
  };

  return {
    async initialize(): Promise<void> {
      await ensureInitialized();
    },

    async listJobs(): Promise<CronJob[]> {
      await ensureInitialized();
      return [...jobs.values()].map(j => ({ ...j })).sort((a, b) => a.name.localeCompare(b.name));
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
        throw new Error('Invalid cron expression. Supported: */N * * *, M H * *, M H * * DOW');
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
      await governanceLifecycleQueueStoreService.upsertCronJob({
        id: merged.id,
        name: merged.name,
        expression: merged.expression,
        target: merged.target,
        status: merged.enabled ? 'active' : 'paused',
        recoveryPolicy: merged.recoveryPolicy,
        retentionDays: merged.retentionDays,
        maxRuntimeMs: merged.maxRuntimeMs,
        lastRunAt: merged.lastRunAt,
        nextRunAt: merged.nextRunAt,
        createdAt: merged.lastRunAt ?? nowIso(),
        updatedAt: nowIso(),
      });
      return { ...merged };
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
      if (!job) return null;
      job.enabled = false;
      return { ...job };
    },

    async resumeJob(jobId: string): Promise<CronJob | null> {
      await ensureInitialized();
      const job = jobs.get(jobId);
      if (!job) return null;
      job.enabled = true;
      job.nextRunAt = computeNextRunIso(job.expression, new Date());
      return { ...job };
    },

    async runNow(jobId: string): Promise<CronJob | null> {
      await ensureInitialized();
      const job = jobs.get(jobId);
      if (!job) return null;

      if (job.running) {
        job.lastRunStatus = 'SKIPPED_OVERLAP';
        return { ...job };
      }

      job.running = true;

      try {
        const startedAt = nowIso();
        let runStatus: CronRunStatus = 'SUCCESS';
        let errorMessage: string | null = null;

        try {
          await runJobAction(job);
        } catch (err) {
          runStatus = 'FAILED';
          errorMessage = err instanceof Error ? err.message : 'Unknown error';
        }

        const completedAt = nowIso();
        job.lastRunAt = completedAt;
        job.lastRunStatus = runStatus;
        job.lastRunSource = 'manual';
        job.runCount++;
        job.running = false;

        await governanceLifecycleQueueStoreService.appendCronExecutionLog({
          jobId: job.id,
          startedAt,
          completedAt,
          status: runStatus === 'SUCCESS' ? 'success' : runStatus === 'FAILED' ? 'failed' : 'skipped_overlap',
          errorMessage,
          source: 'manual',
        });

        await hookSystemService.emitAndWait('schedule.tick', {
          jobId: job.id,
          jobName: job.name,
          status: runStatus,
          source: 'manual',
        });
      } catch (err) {
        job.running = false;
        job.lastRunStatus = 'FAILED';
      }

      return { ...job };
    },

    async tick(): Promise<void> {
      await ensureInitialized();
      await tickInternal();
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

    async getTelemetry(): Promise<CronTelemetry> {
      await ensureInitialized();
      const all = [...jobs.values()];
      return {
        totalJobs: all.length,
        enabledJobs: all.filter((j) => j.enabled).length,
        runningJobs: all.filter((j) => j.running).length,
        totalRuns: all.reduce((sum, j) => sum + j.runCount, 0),
        failedRuns: all.filter((j) => j.lastRunStatus === 'FAILED').length,
        skippedOverlapRuns: all.filter((j) => j.lastRunStatus === 'SKIPPED_OVERLAP').length,
        schedulerActive: false,
        lastTickAt,
        recovery: { ...latestRecoverySummary },
      };
    },

    async dispose(): Promise<void> {
      initialized = false;
      jobs.clear();
      customJobExecutorsByJobId.clear();
      customJobExecutorsByTarget.clear();
    },

    __computeNextRunForTesting(expression: string, baseIso: string): string {
      return computeNextRunIso(expression, new Date(baseIso));
    },

    async __setJobStateForTesting(jobId: string, state: Partial<Pick<CronJob, 'nextRunAt' | 'enabled' | 'running' | 'lastRunAt' | 'lastRunStatus' | 'runCount'>>): Promise<void> {
      const job = jobs.get(jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);
      Object.assign(job, state);
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
    },

    async __resetForTesting(): Promise<void> {
      initialized = false;
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
      jobs.clear();
      customJobExecutorsByJobId.clear();
      customJobExecutorsByTarget.clear();
    },
  };
};

export const cronSchedulerService = createCronScheduler();
