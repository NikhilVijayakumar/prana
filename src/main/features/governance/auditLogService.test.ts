import { describe, expect, it } from 'vitest';
import { auditLogService, AUDIT_ACTIONS, parseAuditJsonLine } from './auditLogService';

describe('auditLogService', () => {
  it('parses a valid jsonl line', () => {
    const parsed = parseAuditJsonLine(
      '{"id":"LOG-1","timestamp":"2026-03-19T00:00:00.000Z","actor":"EVA","action":"AUDIT_PASS","target":"DEC-001","result":"SUCCESS"}',
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe('LOG-1');
    expect(parsed?.actor).toBe('EVA');
  });

  it('returns null for invalid json', () => {
    const parsed = parseAuditJsonLine('not-json');
    expect(parsed).toBeNull();
  });

  it('parses correlation and parent transaction metadata', () => {
    const parsed = parseAuditJsonLine(
      '{"id":"LOG-2","timestamp":"2026-03-19T00:00:00.000Z","actor":"SYSTEM","action":"INTENT_ROUTED","target":"INT-001","result":"RECORDED","parentTxnId":"ROOT-1","correlationId":"INT-001","metadata":{"intentId":"INT-001"}}',
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.parentTxnId).toBe('ROOT-1');
    expect(parsed?.correlationId).toBe('INT-001');
    expect(parsed?.metadata?.intentId).toBe('INT-001');
  });

  it('returns empty list when log file does not exist', async () => {
    const entries = await auditLogService.listEntries(5);
    expect(Array.isArray(entries)).toBe(true);
  });

  it('creates transaction ids and normalizes correlation metadata', async () => {
    const txnId = await auditLogService.createTransaction(AUDIT_ACTIONS.INTENT_RECEIVED, {
      intentId: 'intent-test-1',
    });

    expect(txnId).toBeTruthy();
    const entries = await auditLogService.listEntries(20);
    const created = entries.find((entry) => entry.id === txnId);
    expect(created).toBeTruthy();
    expect(created?.correlationId).toBe(txnId);
    expect(created?.metadata?.correlationId).toBe(txnId);
  });
});
