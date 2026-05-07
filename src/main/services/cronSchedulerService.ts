import { CronExpressionParser } from 'cron-parser';
import { getAppDataRoot, mkdirSafe } from './governanceRepoService';
import { hookSystemService } from './hookSystemService';
import {
  CronJobRecoveryPolicy,
  CronJobStateRecord,
  governanceLifecycleQueueStoreService,
} from './governanceLifecycleQueueService';
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

const STORE_FILE = 'cron-schedules.json';
const TICK_INTERVAL_MS = 30_000;
const LOCK_TIMEOUT_MS = 30_000;
const MAX_CATCH_UP_WINDOWS_PER_SWEEP = 96;

interface PersistedCronState {
  jobs: CronJob[];
  updatedAt: string;
}

type CronJobExecutor = () => Promise<void>;

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

const computeNextRunIso = (expression: string, baseDate: Date): string => {
  try {
    const interval = CronExpressionParser.parseExpression(expression);
    const next = interval.next();
    return next ? next.toISOString() : '';
  } catch {
    return '';
  }
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

// This is now a factory function - no module-level state
export const createCronScheduler = () => {
  // Instance-level state (not module-level)
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
    // This would integrate with governanceLifecycleQueueStoreService
    // For now, return empty
    return { detected: 0, enqueued: 0, duplicatePreventions: 0 };
  };

  const processPendingTaskQueue = async (): Promise<{ processed: number; failed: number }> => {
    // This would integrate with governanceLifecycleQueueStoreService
    return { processed: 0, failed: 0 };
  };

  const tickInternal = async (): Promise<void> => {
    const now = new Date();
    lastTickAt = now.toISOString();
    
    await enqueueDueJobs(now, 'SCHEDULED');
    await processPendingTaskQueue();
  };

  // NOTE: setInterval removed - scheduler is now on-demand only
  // Call tick() manually or use external scheduler

  const ensureInitialized = async (): Promise<void> => {
    if (initialized) {
      return;
    }
    
    // Load jobs from governanceLifecycleQueueStoreService
    const stored = await governanceLifecycleQueueStoreService.listCronJobs();
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

  return {
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
        createdAt: existing?.lastRunAt ?? nowIso(),
        updatedAt: nowIso(),
      });
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
      if (!job) return null;
      
      job.enabled = false;
      await governanceLifecycleQueueStoreService.upsertCronJob({
        ...mapStateRecordToJob({
          ...job,
          status: 'paused',
        } as any),
      });
      return cloneJob(job);
    },

    async resumeJob(jobId: string): Promise<CronJob | null> {
      await ensureInitialized();
      const job = jobs.get(jobId);
      if (!job) return null;
      
      job.enabled = true;
      job.nextRunAt = computeNextRunIso(job.expression, new Date());
      await governanceLifecycleQueueStoreService.upsertCronJob({
        ...mapStateRecordToJob({
          ...job,
          status: 'active',
        } as any),
      });
      return cloneJob(job);
    },

    async runNow(jobId: string): Promise<CronJob | null> {
      await ensureInitialized();
      const job = jobs.get(jobId);
      if (!job) return null;
      
      await runJobAction(job);
      return cloneJob(job);
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
        enabledJobs: all.filter((job) => job.enabled).length,
        runningJobs: all.filter((job) => job.running).length,
        totalRuns: all.reduce((sum, job) => sum + job.runCount, 0),
        failedRuns: all.filter((job) => job.lastRunStatus === 'FAILED').length,
        skippedOverlapRuns: all.filter((job) => job.lastRunStatus === 'SKIPPED_OVERLAP').length,
        schedulerActive: false, // No more setInterval
        lastTickAt,
        recovery: cloneRecoverySummary(),
      };
    },

    async dispose(): Promise<void> {
      // No more tickTimer to clear
      initialized = false;
      jobs.clear();
      customJobExecutorsByJobId.clear();
      customJobExecutorsByTarget.clear();
    },

    __resetForTesting: {
      initialized: false,
      lastTickAt: null,
      latestRecoverySummary: {
        recoveredInterruptedTasks: 0,
        missedJobsDetected: 0,
        missedJobsEnqueued: 0,
        duplicatePreventions: 0,
        processedTasks: 0,
        failedTasks: 0,
        completedAt: null,
      },
      jobs: new Map<string, CronJob>(),
      customJobExecutorsByJobId: new Map<string, CronJobExecutor>(),
      customJobExecutorsByTarget: new Map<string, CronJobExecutor>(),
    },
  };
};

// Keep the old export for backward compatibility (but it's now a factory)
export const cronSchedulerService = createCronScheduler();
