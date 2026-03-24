import { beforeEach, describe, expect, it } from 'vitest';
import { operationsService } from './operationsService';
import { workOrderService } from './workOrderService';
import { queueService } from './queueService';

describe('operationsService Phase E Pack 3', () => {
  beforeEach(() => {
    workOrderService.__resetForTesting();
    queueService.__resetForTesting();
  });

  it('builds infrastructure activeAgents from live work orders and queue entries', async () => {
    const workOrderMira = workOrderService.create({
      moduleRoute: '/triage',
      message: 'Investigate escalation',
      targetEmployeeId: 'mira',
      priority: 'IMPORTANT',
    });
    workOrderService.updateState(workOrderMira.id, 'EXECUTING');

    const workOrderArya = workOrderService.create({
      moduleRoute: '/strategy',
      message: 'Review strategic plan',
      targetEmployeeId: 'arya',
      priority: 'URGENT',
    });
    workOrderService.updateState(workOrderArya.id, 'QUEUED');
    queueService.enqueue(workOrderArya.id, workOrderArya.priority);

    const payload = await operationsService.getInfrastructurePayload();

    expect(payload.activeAgents.length).toBeGreaterThan(0);
    expect(payload.activeAgents.some((name) => name.startsWith('Mira'))).toBe(true);
    expect(payload.activeAgents.some((name) => name.startsWith('Arya'))).toBe(true);
  });

  it('returns no active agents when runtime has no queued/running work', async () => {
    const completedOrder = workOrderService.create({
      moduleRoute: '/compliance',
      message: 'Finalize report',
      targetEmployeeId: 'eva',
      priority: 'ROUTINE',
    });
    workOrderService.updateState(completedOrder.id, 'COMPLETED');

    const payload = await operationsService.getInfrastructurePayload();

    expect(payload.activeAgents).toHaveLength(0);
  });

  it('includes core infrastructure metrics', async () => {
    const payload = await operationsService.getInfrastructurePayload();

    expect(payload.metrics.length).toBeGreaterThanOrEqual(5);
    expect(payload.metrics.some((metric) => metric.id === 'SYS-1')).toBe(true);
    expect(payload.metrics.some((metric) => metric.id === 'SYS-2')).toBe(true);
    expect(payload.metrics.some((metric) => metric.id === 'SYS-3')).toBe(true);
  });
});
