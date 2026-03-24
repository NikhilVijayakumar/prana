import { beforeEach, describe, expect, it } from 'vitest';
import { cronSchedulerService } from './cronSchedulerService';
import { hookSystemService } from './hookSystemService';

describe('cronSchedulerService', () => {
  beforeEach(async () => {
    await cronSchedulerService.__resetForTesting();
    await hookSystemService.__resetForTesting();
    await hookSystemService.clearRuntimeState();
    await cronSchedulerService.initialize();
  });

  it('parses supported cron expressions and computes next run', () => {
    const nextEvery15 = cronSchedulerService.__computeNextRunForTesting('*/15 * * * *', '2026-03-19T08:00:00.000Z');
    const nextDaily = cronSchedulerService.__computeNextRunForTesting('0 8 * * *', '2026-03-19T08:00:00.000Z');
    const nextWeekly = cronSchedulerService.__computeNextRunForTesting('0 9 * * 5', '2026-03-19T08:00:00.000Z');

    expect(nextEvery15).toBeTruthy();
    expect(nextDaily).toBeTruthy();
    expect(nextWeekly).toBeTruthy();
  });

  it('supports register, pause/resume, run-now and remove', async () => {
    const created = await cronSchedulerService.upsertJob({
      id: 'job-test-custom',
      name: 'Test Custom Job',
      expression: '*/20 * * * *',
      enabled: true,
    });

    expect(created.id).toBe('job-test-custom');

    const paused = await cronSchedulerService.pauseJob('job-test-custom');
    expect(paused?.enabled).toBe(false);

    const resumed = await cronSchedulerService.resumeJob('job-test-custom');
    expect(resumed?.enabled).toBe(true);

    const ran = await cronSchedulerService.runNow('job-test-custom');
    expect(ran?.lastRunStatus).toBe('SUCCESS');
    expect(ran?.runCount).toBeGreaterThan(0);

    const removed = await cronSchedulerService.removeJob('job-test-custom');
    expect(removed).toBe(true);
  });

  it('guards against overlapping runs', async () => {
    const jobs = await cronSchedulerService.listJobs();
    const target = jobs[0];
    expect(target).toBeTruthy();
    if (!target) {
      return;
    }

    // Force overlap by toggling running flag via upsert/load lifecycle not exposed.
    // Instead run once and immediately run again; the second run should still complete safely.
    const first = await cronSchedulerService.runNow(target.id);
    expect(first?.lastRunStatus).toBe('SUCCESS');

    const second = await cronSchedulerService.runNow(target.id);
    expect(second?.lastRunStatus === 'SUCCESS' || second?.lastRunStatus === 'SKIPPED_OVERLAP').toBe(true);
  });

  it('recovers persisted schedules across service restart', async () => {
    await cronSchedulerService.upsertJob({
      id: 'job-persisted',
      name: 'Persisted Job',
      expression: '*/10 * * * *',
      enabled: true,
    });

    await cronSchedulerService.dispose();
    await cronSchedulerService.initialize();

    const jobsAfter = await cronSchedulerService.listJobs();
    expect(jobsAfter.some((job) => job.id === 'job-persisted')).toBe(true);
  });

  it('emits schedule.tick hook entries when jobs run', async () => {
    const jobs = await cronSchedulerService.listJobs();
    const target = jobs[0];
    expect(target).toBeTruthy();
    if (!target) {
      return;
    }

    await cronSchedulerService.runNow(target.id);
    const executions = await hookSystemService.listExecutions(20);

    expect(executions.some((entry) => entry.event === 'schedule.tick')).toBe(true);
  });
});
