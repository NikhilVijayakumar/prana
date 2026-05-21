import { describe, expect, it } from 'vitest';
import { buildHiringPayloadFromSignals } from './hiringSimService';

describe('hiringSimService', () => {
  it('builds fallback payload from runtime signals', () => {
    const payload = buildHiringPayloadFromSignals({
      blockedSkillCount: 2,
      totalSkillCount: 10,
      triageItemCount: 3,
      skillNames: ['TypeScript', 'React', 'Testing'],
    });

    expect(payload.openRolesCount).toBeGreaterThan(0);
    expect(payload.activeCandidates).toBeGreaterThan(0);
    expect(payload.candidates.length).toBe(payload.activeCandidates);
    expect(payload.candidates[0]?.keyStrengths.length).toBeGreaterThan(0);
  });

  it('uses report values when provided', () => {
    const payload = buildHiringPayloadFromSignals(
      {
        blockedSkillCount: 0,
        totalSkillCount: 8,
        triageItemCount: 1,
        skillNames: ['TypeScript'],
      },
      {
        openRolesCount: 5,
        averageTimeGaps: '11 days',
        candidates: [
          {
            id: 'C-10',
            name: 'Asha Menon',
            role: 'Platform Engineer',
            matchScore: 92,
            status: 'Technical Assessment',
            keyStrengths: ['Distributed Systems', 'Incident Response'],
          },
        ],
      },
    );

    expect(payload.openRolesCount).toBe(5);
    expect(payload.averageTimeGaps).toBe('11 days');
    expect(payload.candidates).toHaveLength(1);
    expect(payload.candidates[0]?.name).toBe('Asha Menon');
    expect(payload.candidates[0]?.matchScore).toBe(92);
  });
});
