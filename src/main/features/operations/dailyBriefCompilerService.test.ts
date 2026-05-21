import { describe, expect, it } from 'vitest';
import { buildDailyBriefPayload } from './dailyBriefCompilerService';

describe('dailyBriefCompilerService', () => {
  it('builds payload with warning classifications for unhealthy signals', () => {
    const payload = buildDailyBriefPayload({
      fallbackOrder: ['lmstudio', 'openrouter'],
      unhealthyProviderNames: ['openrouter'],
      blockedSkillCount: 2,
      vaultFileCount: 14,
      schedules: [
        { enabled: true, nextRunAt: '2026-03-20T08:00:00.000Z', lastRunAt: '2026-03-19T08:00:00.000Z' },
      ],
      localeDate: '3/19/2026',
    });

    expect(payload.topRequests).toHaveLength(3);
    expect(payload.topRequests[0]?.classification).toBe('CRITICAL');
    expect(payload.functionStatuses.some((status) => status.health === 'warning')).toBe(true);
    expect(payload.scheduleStatus.enabledJobs).toBe(1);
  });

  it('builds payload with healthy statuses when signals are clean', () => {
    const payload = buildDailyBriefPayload({
      fallbackOrder: ['lmstudio'],
      unhealthyProviderNames: [],
      blockedSkillCount: 0,
      vaultFileCount: 5,
      schedules: [],
      localeDate: '3/19/2026',
    });

    expect(payload.functionStatuses.every((status) => status.health === 'ok')).toBe(true);
    expect(payload.scheduleStatus.totalJobs).toBe(0);
    expect(payload.scheduleStatus.nextRunAt).toBeNull();
  });
});
