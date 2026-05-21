import { beforeEach, describe, expect, it } from 'vitest';
import { governanceLifecycleQueueStoreService } from './governanceLifecycleQueueStoreService';

describe('governanceLifecycleQueueStoreService cron queue idempotency', () => {
  beforeEach(async () => {
    await governanceLifecycleQueueStoreService.__resetForTesting();
  });

  it('prevents duplicate enqueue for the same job due occurrence', async () => {
    const first = await governanceLifecycleQueueStoreService.enqueueTask({
      jobId: 'job-sync-pull',
      jobName: 'Registry Sync Pull',
      scheduledFor: '2026-03-29T00:00:00.000Z',
      source: 'MISSED',
    });

    const second = await governanceLifecycleQueueStoreService.enqueueTask({
      jobId: 'job-sync-pull',
      jobName: 'Registry Sync Pull',
      scheduledFor: '2026-03-29T00:00:00.000Z',
      source: 'MISSED',
    });

    expect(first.inserted).toBe(true);
    expect(first.duplicatePrevented).toBe(false);
    expect(second.inserted).toBe(false);
    expect(second.duplicatePrevented).toBe(true);
    expect(second.record.taskId).toBe(first.record.taskId);

    const pending = await governanceLifecycleQueueStoreService.listPendingTasks();
    expect(pending).toHaveLength(1);
  });

  it('stores cron job state and execution logs in scheduler tables', async () => {
    await governanceLifecycleQueueStoreService.upsertCronJob({
      id: 'job-daily',
      name: 'Daily Job',
      expression: '0 8 * * *',
      target: 'DAILY_JOB',
      status: 'active',
      recoveryPolicy: 'RUN_ONCE',
      retentionDays: 30,
      maxRuntimeMs: 5000,
      lastRunAt: null,
      nextRunAt: '2026-04-05T08:00:00.000Z',
    });

    const jobs = await governanceLifecycleQueueStoreService.listCronJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].target).toBe('DAILY_JOB');
    expect(jobs[0].recoveryPolicy).toBe('RUN_ONCE');

    await governanceLifecycleQueueStoreService.appendCronExecutionLog({
      jobId: 'job-daily',
      startedAt: '2026-04-05T08:00:00.000Z',
      completedAt: '2026-04-05T08:00:01.000Z',
      status: 'success',
      source: 'scheduler',
    });

    const logs = await governanceLifecycleQueueStoreService.listCronExecutionLogByJob('job-daily', 10);
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('success');
  });

  it('acquires and releases cron locks atomically', async () => {
    await governanceLifecycleQueueStoreService.upsertCronJob({
      id: 'job-lock',
      name: 'Lock Job',
      expression: '*/15 * * * *',
      target: 'LOCK_JOB',
      status: 'active',
      recoveryPolicy: 'RUN_ONCE',
      retentionDays: 30,
      maxRuntimeMs: 3000,
      lastRunAt: null,
      nextRunAt: '2026-04-05T08:15:00.000Z',
    });

    const first = await governanceLifecycleQueueStoreService.acquireCronLock({
      jobId: 'job-lock',
      lockTimeoutMs: 30_000,
    });
    const second = await governanceLifecycleQueueStoreService.acquireCronLock({
      jobId: 'job-lock',
      lockTimeoutMs: 30_000,
    });

    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);

    await governanceLifecycleQueueStoreService.releaseCronLock('job-lock');

    const third = await governanceLifecycleQueueStoreService.acquireCronLock({
      jobId: 'job-lock',
      lockTimeoutMs: 30_000,
    });
    expect(third.acquired).toBe(true);
  });
});
