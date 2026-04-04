import { beforeEach, describe, expect, it } from 'vitest';
import { operationsService } from './operationsService';
import { workOrderService } from './workOrderService';
import { queueService } from './queueService';

describe('operationsService Phase E Pack 4', () => {
  beforeEach(async () => {
    workOrderService.__resetForTesting();
    await queueService.__resetForTesting();
  });

  it('daily brief top requests reflect live runtime work orders', async () => {
    const critical = workOrderService.create({
      moduleRoute: '/compliance',
      message: 'Critical policy issue',
      targetEmployeeId: 'eva',
      priority: 'CRITICAL',
    });
    workOrderService.updateState(critical.id, 'REVIEW');

    const important = workOrderService.create({
      moduleRoute: '/queue-monitor',
      message: 'Regular queue health check',
      targetEmployeeId: 'elina',
      priority: 'IMPORTANT',
    });
    workOrderService.updateState(important.id, 'EXECUTING');

    const payload = await operationsService.getDailyBriefPayload();

    expect(payload.topRequests.length).toBeGreaterThan(0);
    expect(payload.topRequests.some((request) => request.id === critical.id)).toBe(true);
    expect(payload.topRequests.some((request) => request.id === important.id)).toBe(true);
  });

  it('weekly review includes work-order load metrics in report content', async () => {
    const failed = workOrderService.create({
      moduleRoute: '/funding-digest',
      message: 'Funding digest failed run',
      targetEmployeeId: 'nora',
      priority: 'URGENT',
    });
    workOrderService.updateState(failed.id, 'FAILED');

    const open = workOrderService.create({
      moduleRoute: '/triage',
      message: 'Open triage thread',
      targetEmployeeId: 'mira',
      priority: 'IMPORTANT',
    });
    workOrderService.updateState(open.id, 'QUEUED');

    const payload = await operationsService.getWeeklyReviewPayload();

    const noraReport = payload.reports.find((report) => report.agent === 'Nora');
    const evaReport = payload.reports.find((report) => report.agent === 'Eva');

    expect(noraReport).toBeDefined();
    expect(noraReport?.improvements.some((improvement) => improvement.includes('Open work-order load'))).toBe(true);
    expect(evaReport).toBeDefined();
    expect(evaReport?.slips.length).toBeGreaterThan(0);
  });

  it('notifications include work-order runtime events', async () => {
    const order = workOrderService.create({
      moduleRoute: '/strategy',
      message: 'Strategy approval needed',
      targetEmployeeId: 'arya',
      priority: 'URGENT',
    });
    workOrderService.updateState(order.id, 'APPROVED');

    const payload = await operationsService.getNotificationPayload();

    expect(payload.items.some((item) => item.id === `NOTIF-WO-${order.id}`)).toBe(true);
  });
});
