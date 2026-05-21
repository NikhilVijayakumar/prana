import { describe, expect, it } from 'vitest';
import { buildDesignAuditPayload } from './visualAuditService';

describe('visualAuditService', () => {
  it('creates a healthy payload for secure signals', () => {
    const payload = buildDesignAuditPayload({
      complianceOverallStatus: 'secure',
      complianceViolationsCount: 0,
      queuePendingCount: 0,
      blockedSkillsCount: 0,
      degradedProviderCount: 0,
    });

    expect(payload.metrics).toHaveLength(4);
    expect(payload.overallHealth).toBeGreaterThanOrEqual(80);
    expect(payload.tokensSynced).toBe(true);
  });

  it('degrades health and token sync for warning/critical signals', () => {
    const payload = buildDesignAuditPayload({
      complianceOverallStatus: 'critical',
      complianceViolationsCount: 4,
      queuePendingCount: 5,
      blockedSkillsCount: 2,
      degradedProviderCount: 2,
    });

    expect(payload.overallHealth).toBeLessThan(90);
    expect(payload.tokensSynced).toBe(false);
    expect(payload.metrics.some((metric) => metric.status !== 'pass')).toBe(true);
  });
});
