import { describe, expect, it } from 'vitest';
import { buildFundingPayloadFromSignals } from './fundingDigestService';

describe('fundingDigestService', () => {
  it('builds payload from runtime signals when report is absent', () => {
    const payload = buildFundingPayloadFromSignals({
      blockedDecisions: 2,
      unresolvedTriage: 3,
      vaultFileCount: 12,
    });

    expect(payload.runwayMonths).toBeGreaterThan(0);
    expect(payload.burnRate.endsWith('/mo')).toBe(true);
    expect(payload.cashInBank.startsWith('$')).toBe(true);
    expect(payload.metrics).toHaveLength(3);
  });

  it('uses report values when provided and normalizes leads', () => {
    const payload = buildFundingPayloadFromSignals(
      {
        blockedDecisions: 0,
        unresolvedTriage: 0,
        vaultFileCount: 20,
      },
      {
        cashInBank: 500000,
        monthlyBurn: 25000,
        leads: [
          {
            id: 'L-10',
            name: 'Rina Patel',
            firm: 'North Star Ventures',
            stage: 'Due Diligence',
            confidence: 88,
          },
        ],
      },
    );

    expect(payload.runwayMonths).toBe(20);
    expect(payload.leads).toHaveLength(1);
    expect(payload.leads[0]?.name).toBe('Rina Patel');
    expect(payload.leads[0]?.stage).toBe('Due Diligence');
  });
});
