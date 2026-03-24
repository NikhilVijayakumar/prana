import { beforeEach, describe, expect, it } from 'vitest';
import { operationsService } from './operationsService';
import { workOrderService } from './workOrderService';
import { queueService } from './queueService';

describe('operationsService Phase E Pack 5', () => {
  beforeEach(() => {
    workOrderService.__resetForTesting();
    queueService.__resetForTesting();
  });

  it('creates onboarding KPI registry for runtime agents', async () => {
    const payload = await operationsService.generateOnboardingKpis();

    expect(payload.registry.length).toBeGreaterThan(0);
    expect(payload.registry.every((record) => record.kpis.length >= 2)).toBe(true);
    expect(payload.statuses.every((status) => status.status === 'DONE')).toBe(true);
  });

  it('removes an onboarding KPI and returns updated payload', async () => {
    const generated = await operationsService.generateOnboardingKpis();
    const firstAgent = generated.registry[0];
    const firstKpi = firstAgent.kpis[0];

    const updated = await operationsService.removeOnboardingKpi(firstAgent.agentId, firstKpi.id);
    const agentAfterRemoval = updated.registry.find((record) => record.agentId === firstAgent.agentId);

    expect(agentAfterRemoval).toBeDefined();
    expect(agentAfterRemoval?.kpis.some((kpi) => kpi.id === firstKpi.id)).toBe(false);
  });

  it('reports queued onboarding statuses before generation', async () => {
    const payload = await operationsService.getOnboardingKpiPayload();

    expect(payload.statuses.length).toBeGreaterThan(0);
    expect(payload.statuses.every((status) => status.status === 'QUEUED' || status.status === 'DONE')).toBe(true);
  });

  it('builds employee profile payload from runtime agent registry and work orders', async () => {
    const order = workOrderService.create({
      moduleRoute: '/governance',
      message: 'Review governance packet',
      targetEmployeeId: 'eva',
      priority: 'URGENT',
    });
    workOrderService.updateState(order.id, 'COMPLETED');

    const profile = await operationsService.getEmployeeProfilePayload('eva');

    expect(profile.id).toBe('eva');
    expect(profile.tools.length).toBeGreaterThan(0);
    expect(profile.kpis.some((kpi) => kpi.name === 'Completed Work Orders')).toBe(true);
    expect(profile.receivesFrom.length).toBeGreaterThan(0);
  });

  it('persists expanded settings payload including engine and system preferences', async () => {
    const saved = await operationsService.saveSettings({
      language: 'en',
      preferredModelProvider: 'openrouter',
      themeMode: 'dark',
      reducedMotion: true,
    });

    const loaded = await operationsService.loadSettings();

    expect(saved).toBe(true);
    expect(loaded.language).toBe('en');
    expect(loaded.preferredModelProvider).toBe('openrouter');
    expect(loaded.themeMode).toBe('dark');
    expect(loaded.reducedMotion).toBe(true);
  });

  it('returns safe defaults for expanded settings fields', async () => {
    const loaded = await operationsService.loadSettings();

    expect(['lmstudio', 'openrouter', 'gemini']).toContain(loaded.preferredModelProvider);
    expect(['system', 'light', 'dark']).toContain(loaded.themeMode);
    expect(typeof loaded.reducedMotion).toBe('boolean');
  });
});
