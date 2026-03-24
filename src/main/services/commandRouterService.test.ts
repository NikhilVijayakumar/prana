import { beforeEach, describe, expect, it } from 'vitest';
import { commandRouterService } from './commandRouterService';
import { queueService } from './queueService';
import { workOrderService } from './workOrderService';

describe('commandRouterService', () => {
  beforeEach(() => {
    queueService.__resetForTesting();
    workOrderService.__resetForTesting();
  });

  it('routes compliance request to eva and enqueues it', () => {
    const result = commandRouterService.submitDirectorRequest({
      moduleRoute: 'compliance',
      message: 'urgent compliance audit review needed',
      timestampIso: new Date().toISOString(),
    });

    expect(result.queueAccepted).toBe(true);
    expect(result.workOrder.targetEmployeeId).toBe('eva');
    expect(result.workOrder.priority).toBe('URGENT');
    expect(result.workOrder.state).toBe('QUEUED');
  });

  it('starts next order and completes lifecycle', () => {
    const submitted = commandRouterService.submitDirectorRequest({
      moduleRoute: 'infrastructure',
      message: 'critical outage in gateway path',
      timestampIso: new Date().toISOString(),
    });

    const started = commandRouterService.startNext();
    expect(started?.workOrder.state).toBe('EXECUTING');

    const completed = commandRouterService.complete(submitted.workOrder.id, 'Issue resolved');
    expect(completed?.state).toBe('COMPLETED');
    expect(completed?.summary).toBe('Issue resolved');
  });
});
