import { beforeEach, describe, expect, it } from 'vitest';
import { queueService } from './queueService';

describe('queueService', () => {
  beforeEach(async () => {
    await queueService.__resetForTesting();
  });

  it('reserves one slot for critical work orders', async () => {
    for (let index = 0; index < 9; index += 1) {
      const result = await queueService.enqueue(`WO-${index}`, 'IMPORTANT');
      expect(result.accepted).toBe(true);
    }

    const blockedNonCritical = await queueService.enqueue('WO-10', 'ROUTINE');
    expect(blockedNonCritical.accepted).toBe(false);
    expect(blockedNonCritical.reason).toBe('crisis_reserve');

    const allowedCritical = await queueService.enqueue('WO-11', 'CRITICAL');
    expect(allowedCritical.accepted).toBe(true);
  });

  it('starts highest-priority queued item first', async () => {
    await queueService.enqueue('WO-1', 'ROUTINE');
    await queueService.enqueue('WO-2', 'URGENT');

    const started = await queueService.startNext();

    expect(started).not.toBeNull();
    expect(started?.workOrderId).toBe('WO-2');
    expect(started?.status).toBe('RUNNING');
  });
});
