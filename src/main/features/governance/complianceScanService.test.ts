import { describe, expect, it } from 'vitest';
import { complianceScanService } from './complianceScanService';

describe('complianceScanService', () => {
  it('returns secure status when there are no violations', () => {
    const result = complianceScanService.scan({
      blockedSkillNames: [],
      degradedProviderNames: [],
      governanceFlaggedCount: 0,
      auditLogEntries: [],
    });

    expect(result.overallStatus).toBe('secure');
    expect(result.violationsCount).toBe(0);
    expect(result.adherenceScore).toBe(100);
    expect(result.checks.every((check) => check.status === 'pass')).toBe(true);
  });

  it('returns warning or critical when violations are present', () => {
    const result = complianceScanService.scan({
      blockedSkillNames: ['security-and-pitfalls'],
      degradedProviderNames: ['openrouter'],
      governanceFlaggedCount: 1,
      auditLogEntries: [
        {
          id: 'LOG-2',
          timestamp: '2026-03-19T01:00:00.000Z',
          actor: 'SYSTEM',
          action: 'POLICY_SCAN',
          target: 'repo',
          result: 'FLAGGED',
        },
      ],
    });

    expect(result.violationsCount).toBe(4);
    expect(result.overallStatus).toBe('critical');
    expect(result.adherenceScore).toBe(84);
    expect(result.checks.some((check) => check.status !== 'pass')).toBe(true);
  });
});
