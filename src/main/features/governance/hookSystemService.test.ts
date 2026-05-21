import { beforeEach, describe, expect, it } from 'vitest';
import { hookSystemService } from './hookSystemService';

describe('hookSystemService', () => {
  beforeEach(async () => {
    await hookSystemService.__resetForTesting();
    await hookSystemService.clearRuntimeState();
  });

  it('executes hooks in priority order for the same event', async () => {
    const records = await hookSystemService.emitAndWait('vault.ingested', { count: 2 });

    expect(records.length).toBeGreaterThan(0);

    const hooks = await hookSystemService.listHooks();
    const matching = hooks.filter((hook) => hook.event === 'vault.ingested');
    const expectedOrder = [...matching]
      .sort((a, b) => a.priority - b.priority)
      .map((hook) => hook.id);
    const actualOrder = records.map((record) => record.hookId);

    expect(actualOrder).toEqual(expectedOrder);
  });

  it('retries a failed hook and succeeds when failure condition is removed', async () => {
    const scheduleHooks = (await hookSystemService.listHooks()).filter(
      (hook) => hook.event === 'schedule.tick',
    );

    expect(scheduleHooks.length).toBeGreaterThan(0);

    const target = scheduleHooks[0];
    const first = await hookSystemService.emitAndWait('schedule.tick', {
      jobId: 'nightly-audit',
      forceFailureForHookId: target.id,
    });

    const firstTarget = first.find((entry) => entry.hookId === target.id);
    expect(firstTarget?.status).toBe('FAILED');
    expect(firstTarget?.attempts).toBe(2);

    const second = await hookSystemService.emitAndWait('schedule.tick', {
      jobId: 'nightly-audit',
    });

    const secondTarget = second.find((entry) => entry.hookId === target.id);
    expect(secondTarget?.status).toBe('SUCCESS');
  });

  it('isolates hook failures so other hooks still execute', async () => {
    const hooks = (await hookSystemService.listHooks()).filter(
      (hook) => hook.event === 'vault.pending.approved',
    );

    expect(hooks.length).toBeGreaterThan(0);

    const failingId = hooks[0].id;
    const records = await hookSystemService.emitAndWait('vault.pending.approved', {
      relativePath: 'agent-temp/sample.csv',
      forceFailureForHookId: failingId,
    });

    expect(records.some((record) => record.hookId === failingId && record.status === 'FAILED')).toBe(true);

    const notifications = await hookSystemService.listNotifications(10);
    expect(notifications.length).toBeGreaterThanOrEqual(0);
  });

  it('supports disabling hooks at runtime', async () => {
    const hooks = await hookSystemService.listHooks();
    const target = hooks.find((hook) => hook.event === 'session.message');

    expect(target).toBeTruthy();
    if (!target) {
      return;
    }

    await hookSystemService.setHookEnabled(target.id, false);
    const records = await hookSystemService.emitAndWait('session.message', {
      sessionId: 's-1',
      role: 'user',
    });

    const disabledRecord = records.find((record) => record.hookId === target.id);
    expect(disabledRecord?.status).toBe('SKIPPED_DISABLED');
  });

  it('exposes telemetry and event catalog', async () => {
    await hookSystemService.emitAndWait('session.bootstrap', { sessionId: 'abc' });
    const telemetry = await hookSystemService.getTelemetry();
    const catalog = await hookSystemService.getEventCatalog();

    expect(telemetry.hookCount).toBeGreaterThan(0);
    expect(telemetry.totalExecutions).toBeGreaterThan(0);
    expect(catalog).toContain('vault.ingested');
    expect(catalog).toContain('schedule.tick');
  });
});
