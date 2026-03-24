import { beforeEach, describe, expect, it } from 'vitest';
import { operationsService } from './operationsService';
import { workOrderService } from './workOrderService';
import { queueService } from './queueService';

describe('operationsService Phase E Pack 1', () => {
  beforeEach(() => {
    workOrderService.__resetForTesting();
    queueService.__resetForTesting();
  });

  it('maps live work orders into triage payload', async () => {
    const planned = workOrderService.create({
      moduleRoute: '/triage',
      message: 'Investigate queue anomaly',
      targetEmployeeId: 'mira',
      priority: 'IMPORTANT',
    });
    workOrderService.updateState(planned.id, 'QUEUED');

    const completed = workOrderService.create({
      moduleRoute: '/governance',
      message: 'Finalize compliance review',
      targetEmployeeId: 'eva',
      priority: 'URGENT',
    });
    workOrderService.updateState(completed.id, 'COMPLETED');

    const payload = await operationsService.getTriagePayload();

    const queuedItem = payload.find((item) => item.id === planned.id);
    const completedItem = payload.find((item) => item.id === completed.id);

    expect(queuedItem).toBeDefined();
    expect(queuedItem?.status).toBe('PENDING');
    expect(completedItem).toBeDefined();
    expect(completedItem?.status).toBe('CLEARED');
  });

  it('returns empty triage payload when no runtime work orders exist', async () => {
    const payload = await operationsService.getTriagePayload();

    expect(payload).toEqual([]);
  });

  it('applies ANALYZE triage action to live work order', async () => {
    const workOrder = workOrderService.create({
      moduleRoute: '/queue-monitor',
      message: 'Analyze this request',
      targetEmployeeId: 'elina',
      priority: 'ROUTINE',
    });
    workOrderService.updateState(workOrder.id, 'QUEUED');

    const payload = await operationsService.applyTriageAction(workOrder.id, 'ANALYZE');

    const updated = workOrderService.get(workOrder.id);
    const triageItem = payload.find((item) => item.id === workOrder.id);

    expect(updated?.state).toBe('EXECUTING');
    expect(triageItem?.status).toBe('ANALYSIS');
  });

  it('applies CLEAR triage action to live work order', async () => {
    const workOrder = workOrderService.create({
      moduleRoute: '/queue-monitor',
      message: 'Clear this request',
      targetEmployeeId: 'mira',
      priority: 'ROUTINE',
    });
    workOrderService.updateState(workOrder.id, 'EXECUTING');

    const payload = await operationsService.applyTriageAction(workOrder.id, 'CLEAR');

    const updated = workOrderService.get(workOrder.id);
    const triageItem = payload.find((item) => item.id === workOrder.id);

    expect(updated?.state).toBe('COMPLETED');
    expect(triageItem?.status).toBe('CLEARED');
  });

  it('uses live queue entries for queue monitor tasks', async () => {
    const workOrder = workOrderService.create({
      moduleRoute: '/triage',
      message: 'Route this to queue',
      targetEmployeeId: 'mira',
      priority: 'IMPORTANT',
    });

    const queued = queueService.enqueue(workOrder.id, workOrder.priority);
    expect(queued.accepted).toBe(true);

    const payload = await operationsService.getQueueMonitorPayload();

    expect(payload.tasks.length).toBeGreaterThan(0);
    expect(payload.tasks.some((task) => task.id === queued.entry?.id)).toBe(true);
  });

  it('returns empty queue monitor task list when runtime queue is empty', async () => {
    const payload = await operationsService.getQueueMonitorPayload();

    expect(payload.tasks).toEqual([]);
    expect(payload.activeCount).toBe(0);
    expect(payload.pendingCount).toBe(0);
  });
});
