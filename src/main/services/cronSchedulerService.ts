import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getAppDataRoot } from './governanceRepoService';
import { hookSystemService } from './hookSystemService';
import { governanceLifecycleQueueStoreService } from './governanceLifecycleQueueStoreService';
import { readMainEnvAlias } from './envService';
import {
  SYNC_PULL_CRON_JOB_ID,
  SYNC_PUSH_CRON_JOB_ID,
  syncProviderService,
} from './syncProviderService';

export type CronRunStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED_OVERLAP';

export interface CronJob {
  id: string;
  name: string;
  expression: string;
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
}

interface PersistedCronState {
  jobs: CronJob[];
  updatedAt: string;
}

const STORE_FILE = 'cron-schedules.json';
const TICK_INTERVAL_MS = 30_000;
const DEFAULT_SYNC_CRON_ENABLED = true;
const DEFAULT_SYNC_PUSH_CRON_EXPRESSION = '*/10 * * * *';
const DEFAULT_SYNC_PULL_CRON_EXPRESSION = '*/15 * * * *';

let initialized = false;
let tickTimer: NodeJS.Timeout | null = null;
let lastTickAt: string | null = null;

const jobs = new Map<string, CronJob>();

const nowIso = (): string => new Date().toISOString();

const getStorePath = (): string => join(getAppDataRoot(), STORE_FILE);

const cloneJob = (job: CronJob): CronJob => ({ ...job });

const defaultJobs = (): CronJob[] => {
  const now = new Date();
  const syncCronEnabledRaw = readMainEnvAlias('PRANA_SYNC_CRON_ENABLED', 'DHI_SYNC_CRON_ENABLED');
  const syncCronEnabled = syncCronEnabledRaw ? syncCronEnabledRaw !== 'false' : DEFAULT_SYNC_CRON_ENABLED;
  const syncPushCronExpression =
    readMainEnvAlias('PRANA_SYNC_PUSH_CRON_EXPRESSION', 'DHI_SYNC_PUSH_CRON_EXPRESSION') ?? DEFAULT_SYNC_PUSH_CRON_EXPRESSION;
  const syncPullCronExpression =
    readMainEnvAlias('PRANA_SYNC_PULL_CRON_EXPRESSION', 'DHI_SYNC_PULL_CRON_EXPRESSION') ?? DEFAULT_SYNC_PULL_CRON_EXPRESSION;
  return [
    {
      id: 'job-daily-brief',
      name: 'Daily Brief Compilation',
      expression: '0 8 * * *',
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
      expression: syncPushCronExpression,
      enabled: syncCronEnabled,
      retentionDays: 30,
      maxRuntimeMs: 30_000,
      nextRunAt: computeNextRunIso(syncPushCronExpression, now),
      lastRunAt: null,
      lastRunStatus: null,
      lastRunSource: null,
      runCount: 0,
      running: false,
    },
    {
      id: SYNC_PULL_CRON_JOB_ID,
      name: 'Registry Sync Pull (Vault -> DB)',
      expression: syncPullCronExpression,
      enabled: syncCronEnabled,
      retentionDays: 30,
      maxRuntimeMs: 30_000,
      nextRunAt: computeNextRunIso(syncPullCronExpression, now),
      lastRunAt: null,
      lastRunStatus: null,
      lastRunSource: null,
      runCount: 0,
      running: false,
    },
  ];
};

const runJobAction = async (job: CronJob): Promise<void> => {
  if (job.id === SYNC_PUSH_CRON_JOB_ID) {
    await syncProviderService.triggerBackgroundPush();
    return;
  }

  if (job.id === SYNC_PULL_CRON_JOB_ID) {
    await syncProviderService.triggerBackgroundPull();
    return;
  }
};

const ensureStoreExists = async (): Promise<void> => {
  await mkdir(getAppDataRoot(), { recursive: true });
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

const writeStore = async (): Promise<void> => {
  const persisted: PersistedCronState = {
    jobs: [...jobs.values()].map(cloneJob),
    updatedAt: nowIso(),
  };
  await writeFile(getStorePath(), JSON.stringify(persisted, null, 2), 'utf8');
};

const parseInteger = (value: string): number | null => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
};

const isWildcard = (value: string): boolean => value.trim() === '*';

const parseEveryMinutes = (field: string): number | null => {
  const match = field.match(/^\*\/(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const n = parseInteger(match[1]);
  if (!n || n < 1 || n > 59) {
    return null;
  }

  return n;
};

const validateExpression = (expression: string): boolean => {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }

  const [min, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (parseEveryMinutes(min) !== null && isWildcard(hour) && isWildcard(dayOfMonth) && isWildcard(month) && isWildcard(dayOfWeek)) {
    return true;
  }

  const minNum = parseInteger(min);
  if (minNum === null || minNum < 0 || minNum > 59) {
    return false;
  }

  if (!isWildcard(hour)) {
    const hourNum = parseInteger(hour);
    if (hourNum === null || hourNum < 0 || hourNum > 23) {
      return false;
    }
  }

  if (!isWildcard(dayOfMonth) || !isWildcard(month)) {
    return false;
  }

  if (!isWildcard(dayOfWeek)) {
    const dowNum = parseInteger(dayOfWeek);
    if (dowNum === null || dowNum < 0 || dowNum > 6) {
      return false;
    }
  }

  return true;
};

const computeNextRunDate = (expression: string, fromDate: Date): Date | null => {
  if (!validateExpression(expression)) {
    return null;
  }

  const parts = expression.trim().split(/\s+/);
  const [min, hour, _dayOfMonth, _month, dayOfWeek] = parts;

  const everyMinutes = parseEveryMinutes(min);
  if (everyMinutes !== null) {
    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);

    while (next.getMinutes() % everyMinutes !== 0) {
      next.setMinutes(next.getMinutes() + 1);
    }

    return next;
  }

  const minute = parseInteger(min);
  const hourValue = isWildcard(hour) ? null : parseInteger(hour);
  const dayValue = isWildcard(dayOfWeek) ? null : parseInteger(dayOfWeek);
  if (minute === null) {
    return null;
  }

  const candidate = new Date(fromDate);
  candidate.setSeconds(0, 0);

  for (let i = 0; i < 8 * 24 * 60; i += 1) {
    candidate.setMinutes(candidate.getMinutes() + 1);

    if (candidate.getMinutes() !== minute) {
      continue;
    }

    if (hourValue !== null && candidate.getHours() !== hourValue) {
      continue;
    }

    if (dayValue !== null && candidate.getDay() !== dayValue) {
      continue;
    }

    return candidate;
  }

  return null;
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

const enqueueDueJobs = async (now: Date, source: 'SCHEDULED' | 'MISSED'): Promise<void> => {
  const dueJobs: Array<{ job: CronJob; scheduledFor: string }> = [];

  for (const job of jobs.values()) {
    if (!job.enabled || !job.nextRunAt) {
      continue;
    }

    const next = Date.parse(job.nextRunAt);
    if (Number.isNaN(next) || next > now.getTime()) {
      continue;
    }

    dueJobs.push({ job, scheduledFor: job.nextRunAt });
  }

  const priority = (jobId: string): number => {
    if (jobId === SYNC_PULL_CRON_JOB_ID) {
      return 0;
    }
    if (jobId === SYNC_PUSH_CRON_JOB_ID) {
      return 1;
    }
    return 2;
  };

  dueJobs.sort((a, b) => {
    const delta = priority(a.job.id) - priority(b.job.id);
    if (delta !== 0) {
      return delta;
    }
    return a.job.name.localeCompare(b.job.name);
  });

  for (const entry of dueJobs) {
    const { job, scheduledFor } = entry;

    await governanceLifecycleQueueStoreService.enqueueTask({
      jobId: job.id,
      jobName: job.name,
      scheduledFor,
      source,
    });

    // Advance next run immediately so repeated sweeps do not duplicate queue inserts.
    job.nextRunAt = computeNextRunIso(job.expression, now);
  }
};

const processPendingTaskQueue = async (): Promise<void> => {
  const pending = await governanceLifecycleQueueStoreService.listPendingTasks();

  for (const task of pending) {
    const job = jobs.get(task.jobId);
    if (!job) {
      await governanceLifecycleQueueStoreService.markTaskFailed(task.taskId, `Unknown cron job: ${task.jobId}`);
      continue;
    }

    await governanceLifecycleQueueStoreService.markTaskRunning(task.taskId);
    const status = await executeJob(job, task.source === 'SCHEDULED' ? 'scheduler' : 'manual');

    if (status === 'SUCCESS' || status === 'SKIPPED_OVERLAP') {
      await governanceLifecycleQueueStoreService.markTaskCompleted(task.taskId);
    } else {
      await governanceLifecycleQueueStoreService.markTaskFailed(task.taskId, 'Cron execution failed');
    }
  }
};

const executeJob = async (
  job: CronJob,
  source: 'scheduler' | 'manual',
): Promise<CronRunStatus> => {
  if (job.running) {
    markRun(job, 'SKIPPED_OVERLAP', source, new Date());
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
    markRun(job, 'SUCCESS', source, new Date());
    return 'SUCCESS';
  } catch {
    markRun(job, 'FAILED', source, new Date());
    return 'FAILED';
  } finally {
    job.running = false;
  }
};

const tickInternal = async (): Promise<void> => {
  const now = new Date();
  lastTickAt = now.toISOString();

  await enqueueDueJobs(now, 'SCHEDULED');
  await processPendingTaskQueue();

  await writeStore();
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

  const persisted = await readStore();
  jobs.clear();

  for (const job of persisted.jobs) {
    if (!validateExpression(job.expression)) {
      continue;
    }

    const normalized: CronJob = {
      ...job,
      enabled: job.enabled !== false,
      retentionDays: Math.max(7, job.retentionDays || 30),
      maxRuntimeMs: Math.max(1000, job.maxRuntimeMs || 5000),
      running: false,
      nextRunAt: job.nextRunAt ?? computeNextRunIso(job.expression, new Date()),
    };

    jobs.set(job.id, normalized);
  }

  if (jobs.size === 0) {
    for (const job of defaultJobs()) {
      jobs.set(job.id, job);
    }
  }

  await governanceLifecycleQueueStoreService.recoverInterruptedTasks();
  await enqueueDueJobs(new Date(), 'MISSED');
  await processPendingTaskQueue();

  await writeStore();
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
    await writeStore();
    return cloneJob(merged);
  },

  async removeJob(jobId: string): Promise<boolean> {
    await ensureInitialized();
    const removed = jobs.delete(jobId);
    if (removed) {
      await writeStore();
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
    await writeStore();
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
    await writeStore();
    return cloneJob(job);
  },

  async runNow(jobId: string): Promise<CronJob | null> {
    await ensureInitialized();
    const job = jobs.get(jobId);
    if (!job) {
      return null;
    }

    await executeJob(job, 'manual');
    await writeStore();
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
    lastTickAt = null;
    await mkdir(getAppDataRoot(), { recursive: true });
    const seeded: PersistedCronState = {
      jobs: defaultJobs(),
      updatedAt: nowIso(),
    };
    await writeFile(getStorePath(), JSON.stringify(seeded, null, 2), 'utf8');
  },
};
