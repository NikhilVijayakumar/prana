import { beforeEach, describe, expect, it } from 'vitest';
import { memoryIndexService } from './memoryIndexService';
import { memoryQueryService } from './memoryQueryService';

describe('memoryQueryService', () => {
  beforeEach(async () => {
    await memoryIndexService.__resetForTesting();

    await memoryIndexService.indexText({
      relativePath: 'data/processed/triage.md',
      content:
        'Incident triage runbook explains escalation, root-cause notes, and customer impact updates.',
      classification: 'INTERNAL',
    });

    await memoryIndexService.indexText({
      relativePath: 'agent-temp/finance/kpi.txt',
      content:
        'Confidential KPI pack includes burn rate, revenue concentration, and fundraising exposure metrics.',
      classification: 'RESTRICTED',
    });
  });

  it('returns ranked semantic and keyword matches', async () => {
    const response = await memoryQueryService.query({
      query: 'incident triage escalation runbook',
      limit: 3,
      allowedClassifications: ['INTERNAL', 'PUBLIC'],
      pathPrefixes: ['data/processed/'],
    });

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0].relativePath).toBe('data/processed/triage.md');
    expect(response.results[0].score).toBeGreaterThan(0);
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('forces local-only route for sensitive classification scopes', async () => {
    const response = await memoryQueryService.query({
      query: 'revenue concentration metrics',
      allowedClassifications: ['RESTRICTED'],
      pathPrefixes: ['agent-temp/'],
      limit: 2,
    });

    expect(response.route).toBe('LOCAL_ONLY');
    expect(response.results.every((result) => result.classification === 'RESTRICTED')).toBe(true);
  });
});
