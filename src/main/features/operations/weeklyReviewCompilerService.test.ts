import { describe, expect, it } from 'vitest';
import { buildWeeklyReviewPayload } from './weeklyReviewCompilerService';

describe('weeklyReviewCompilerService', () => {
  it('builds payload with expected schedule stats', () => {
    const payload = buildWeeklyReviewPayload({
      weekEnding: '2026-03-20',
      healthyProviderCount: 1,
      totalProviderCount: 3,
      activeProvider: 'lmstudio',
      blockedSkillCount: 2,
      totalSkillCount: 10,
      vaultFileCount: 21,
      schedules: [
        { enabled: true, lastRunStatus: 'SUCCESS' },
        { enabled: false, lastRunStatus: 'FAILED' },
      ],
      lastTickAt: '2026-03-19T10:00:00.000Z',
    });

    expect(payload.reports).toHaveLength(3);
    expect(payload.scheduleStatus.enabledJobs).toBe(1);
    expect(payload.scheduleStatus.successfulJobs).toBe(1);
    expect(payload.scheduleStatus.failedJobs).toBe(1);
  });

  it('flags provider and skills issues in report content', () => {
    const payload = buildWeeklyReviewPayload({
      weekEnding: '2026-03-20',
      healthyProviderCount: 0,
      totalProviderCount: 2,
      activeProvider: null,
      blockedSkillCount: 3,
      totalSkillCount: 8,
      vaultFileCount: 3,
      schedules: [],
      lastTickAt: null,
    });

    const juliaReport = payload.reports.find((report) => report.agent === 'Julia');
    const evaReport = payload.reports.find((report) => report.agent === 'Eva');

    expect(juliaReport?.slips.length).toBeGreaterThan(0);
    expect(evaReport?.slips.length).toBeGreaterThan(0);
    expect(payload.scheduleStatus.totalJobs).toBe(0);
  });
});
