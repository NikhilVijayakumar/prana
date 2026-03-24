import { beforeEach, describe, expect, it } from 'vitest';
import { operationsService } from './operationsService';
import { workOrderService } from './workOrderService';
import { queueService } from './queueService';

describe('operationsService Phase E Pack 2', () => {
  beforeEach(() => {
    workOrderService.__resetForTesting();
    queueService.__resetForTesting();
  });

  it('builds suite agents from live registry', async () => {
    const payload = await operationsService.getSuitePayload();

    expect(payload.agents).toHaveLength(10);
    expect(payload.agents.some((agent) => agent.name === 'Mira')).toBe(true);
    expect(payload.agents.some((agent) => agent.name === 'Arya')).toBe(true);
    expect(payload.agents.some((agent) => agent.name === 'Sofia')).toBe(true);
  });

  it('maps suite status from live work-order activity', async () => {
    const runningOrder = workOrderService.create({
      moduleRoute: '/triage',
      message: 'Running work',
      targetEmployeeId: 'mira',
      priority: 'IMPORTANT',
    });
    workOrderService.updateState(runningOrder.id, 'EXECUTING');

    const waitingOrder = workOrderService.create({
      moduleRoute: '/strategy',
      message: 'Queued work',
      targetEmployeeId: 'arya',
      priority: 'URGENT',
    });
    workOrderService.updateState(waitingOrder.id, 'QUEUED');

    const payload = await operationsService.getSuitePayload();

    const mira = payload.agents.find((agent) => agent.name === 'Mira');
    const arya = payload.agents.find((agent) => agent.name === 'Arya');

    expect(mira?.status).toBe('EXECUTING');
    expect(arya?.status).toBe('WAITING');
  });

  it('exposes WAITING_ON_ROLE status when collaboration is blocked on another role', async () => {
    const blockedOrder = workOrderService.create({
      moduleRoute: '/growth',
      message: 'Global campaign orchestration',
      targetEmployeeId: 'mira',
      priority: 'URGENT',
    });

    workOrderService.setWaitingOnRole(blockedOrder.id, 'dani');

    const payload = await operationsService.getSuitePayload();
    const mira = payload.agents.find((agent) => agent.name === 'Mira');

    expect(mira?.status).toBe('WAITING_ON_DANI');
  });
});
