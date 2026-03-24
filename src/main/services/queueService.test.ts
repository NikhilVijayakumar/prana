import { beforeEach, describe, expect, it } from 'vitest';
import { queueService } from './queueService';

describe('queueService', () => {
  beforeEach(() => {
    queueService.__resetForTesting();
  });

  it('reserves one slot for critical work orders', () => {
    for (let index = 0; index < 9; index += 1) {
      const result = queueService.enqueue(`WO-${index}`, 'IMPORTANT');
      expect(result.accepted).toBe(true);
    }

    const blockedNonCritical = queueService.enqueue('WO-10', 'ROUTINE');
    expect(blockedNonCritical.accepted).toBe(false);
    expect(blockedNonCritical.reason).toBe('crisis_reserve');

    const allowedCritical = queueService.enqueue('WO-11', 'CRITICAL');
    expect(allowedCritical.accepted).toBe(true);
  });

  it('starts highest-priority queued item first', () => {
    queueService.enqueue('WO-1', 'ROUTINE');
    queueService.enqueue('WO-2', 'URGENT');

    const started = queueService.startNext();

    expect(started).not.toBeNull();
    expect(started?.workOrderId).toBe('WO-2');
    expect(started?.status).toBe('RUNNING');
  });
});
