import { beforeEach, describe, expect, it } from 'vitest';
import { commandRouterService } from './commandRouterService';
import { queueService } from './queueService';
import { workOrderService } from './workOrderService';

describe('work-order runtime flow', () => {
  beforeEach(() => {
    queueService.__resetForTesting();
    workOrderService.__resetForTesting();
  });

  it('executes submit -> processNext -> approve lifecycle', () => {
    const submitted = commandRouterService.submitDirectorRequest({
      moduleRoute: 'governance',
      message: 'important review for governance summary',
      timestampIso: new Date().toISOString(),
    });

    expect(submitted.queueAccepted).toBe(true);
    expect(submitted.workOrder.state).toBe('QUEUED');

    const processed = commandRouterService.processNextToReview();
    expect(processed).not.toBeNull();
    expect(processed?.workOrder.state).toBe('REVIEW');
    expect(processed?.progressedStates).toEqual(['EXECUTING', 'SYNTHESIS', 'REVIEW']);

    const approved = commandRouterService.approve(submitted.workOrder.id, 'Director approved');
    expect(approved?.state).toBe('APPROVED');
    expect(approved?.summary).toBe('Director approved');
  });

  it('supports rejection after review', () => {
    const submitted = commandRouterService.submitDirectorRequest({
      moduleRoute: 'compliance',
      message: 'critical compliance breach review',
      timestampIso: new Date().toISOString(),
    });

    commandRouterService.processNextToReview();
    const rejected = commandRouterService.reject(submitted.workOrder.id, 'Need additional evidence');

    expect(rejected?.state).toBe('REJECTED');
    expect(rejected?.error).toBe('Need additional evidence');
  });

  it('routes broad commands to secretary global workflow with handshake initialization', () => {
    const submitted = commandRouterService.submitDirectorRequest({
      moduleRoute: 'growth',
      message: 'Launch a new product campaign with cross-functional execution',
      timestampIso: new Date().toISOString(),
    });

    expect(submitted.workOrder.targetEmployeeId).toBe('mira');
    expect(submitted.workOrder.state).toBe('QUEUED');

    const stored = workOrderService.get(submitted.workOrder.id);
    expect(stored?.collaboration.globalWorkflowId).toBe('product-campaign-global-collaboration');
    expect((stored?.collaboration.handshakes.length ?? 0) > 0).toBe(true);
    expect((stored?.collaboration.internalMemos.length ?? 0) > 0).toBe(true);
    expect(stored?.waitingOnRole).toBeNull();
  });
});
