import { beforeEach, describe, expect, it } from 'vitest';
import { contextEngineService } from './contextEngineService';

describe('contextEngineService', () => {
  beforeEach(() => {
    contextEngineService.__resetForTesting();
  });

  it('enforces assembly budget and preserves message ordering', async () => {
    contextEngineService.bootstrapSession('s-order', {
      maxTokens: 1024,
      reservedOutputTokens: 256,
      compactThresholdTokens: 900,
      highWaterMarkRatio: 0.8,
    });

    await contextEngineService.ingest('s-order', 'user', 'first short message');
    await contextEngineService.ingest('s-order', 'assistant', 'second short message');
    await contextEngineService.ingest('s-order', 'user', 'third short message');

    const assembled = contextEngineService.assemble('s-order', 270);

    expect(assembled.usedTokens).toBeLessThanOrEqual(assembled.budgetTokens);
    expect(assembled.messages.length).toBeGreaterThan(0);

    const createdAt = assembled.messages.map((message) => Date.parse(message.createdAt));
    const sorted = [...createdAt].sort((a, b) => a - b);
    expect(createdAt).toEqual(sorted);
  });

  it('compacts long sessions and updates compaction telemetry', async () => {
    contextEngineService.bootstrapSession('s-compact', {
      maxTokens: 1024,
      reservedOutputTokens: 256,
      compactThresholdTokens: 350,
      highWaterMarkRatio: 0.8,
    });

    for (let i = 0; i < 30; i += 1) {
      await contextEngineService.ingest(
        's-compact',
        i % 2 === 0 ? 'user' : 'assistant',
        `long message ${i} ${'x'.repeat(120)}`,
      );
    }

    const before = contextEngineService.getSessionSnapshot('s-compact');
    expect(before).toBeTruthy();

    const result = await contextEngineService.compact('s-compact', 'unit-test');

    expect(result.removedMessages).toBeGreaterThan(0);
    expect(result.afterTokens).toBeLessThan(result.beforeTokens);
    expect(result.digestId).toContain('digest_');

    const after = contextEngineService.getSessionSnapshot('s-compact');
    expect(after?.compactionCount).toBeGreaterThan(0);
    expect(after?.lastCompactionAt).toBeTruthy();
    expect((after?.summary?.length ?? 0) > 0).toBe(true);
  });

  it('keeps sessions isolated across independent ids', async () => {
    contextEngineService.bootstrapSession('session-a');
    contextEngineService.bootstrapSession('session-b');

    await contextEngineService.ingest('session-a', 'user', 'alpha-only marker payload');
    await contextEngineService.ingest('session-b', 'user', 'bravo-only marker payload');

    const assembledA = contextEngineService.assemble('session-a');
    const assembledB = contextEngineService.assemble('session-b');

    const textA = assembledA.messages.map((m) => m.content).join(' ');
    const textB = assembledB.messages.map((m) => m.content).join(' ');

    expect(textA.includes('alpha-only marker payload')).toBe(true);
    expect(textA.includes('bravo-only marker payload')).toBe(false);
    expect(textB.includes('bravo-only marker payload')).toBe(true);
    expect(textB.includes('alpha-only marker payload')).toBe(false);
  });

  it('supports delegated subagent context flow without leaking full parent history', async () => {
    contextEngineService.bootstrapSession('parent-session');

    for (let i = 0; i < 8; i += 1) {
      await contextEngineService.ingest('parent-session', 'user', `parent-msg-${i}`);
    }

    const child = contextEngineService.prepareSubagentSpawn('parent-session', 'child-session');
    const childAssembled = contextEngineService.assemble('child-session');

    const childText = childAssembled.messages.map((message) => message.content).join(' ');

    expect(child.sessionId).toBe('child-session');
    expect(childText.includes('parent-msg-7')).toBe(true);
    expect(childText.includes('parent-msg-0')).toBe(false);

    contextEngineService.onSubagentEnded('parent-session', 'child-session', 'delegated summary payload');
    const parentAfter = contextEngineService.assemble('parent-session');
    const parentText = parentAfter.messages.map((message) => message.content).join(' ');

    expect(parentText.includes('delegated summary payload')).toBe(true);
  });

  it('emits a warning stage before compaction when usage crosses 70 percent', async () => {
    contextEngineService.bootstrapSession('s-warning', {
      maxTokens: 1024,
      reservedOutputTokens: 256,
      compactThresholdTokens: 900,
      highWaterMarkRatio: 0.8,
    });

    await contextEngineService.ingest('s-warning', 'user', 'warning-message '.repeat(60));

    const snapshot = contextEngineService.getSessionSnapshot('s-warning');
    const telemetry = contextEngineService.getTelemetry();

    expect(snapshot?.optimizationStage).toBe('WARNING');
    expect(telemetry.recentEvents.some((event) => event.type === 'warning_state')).toBe(true);
  });

  it('forces a hard reset with summary injection when usage crosses 95 percent', async () => {
    contextEngineService.bootstrapSession('s-reset', {
      maxTokens: 1024,
      reservedOutputTokens: 256,
      compactThresholdTokens: 900,
      highWaterMarkRatio: 0.8,
    });

    for (let i = 0; i < 12; i += 1) {
      await contextEngineService.ingest(
        's-reset',
        i % 2 === 0 ? 'user' : 'assistant',
        `reset-message-${i} ${'y'.repeat(220)}`,
      );
    }

    const snapshot = contextEngineService.getSessionSnapshot('s-reset');
    const assembled = contextEngineService.assemble('s-reset');
    const telemetry = contextEngineService.getTelemetry();
    const text = assembled.messages.map((message) => message.content).join(' ');

    expect(snapshot?.hardResetCount).toBeGreaterThan(0);
    expect(text.includes('Forced Context Reset')).toBe(true);
    expect(telemetry.recentEvents.some((event) => event.type === 'hard_limit_reset')).toBe(true);
  });
});
