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
});
