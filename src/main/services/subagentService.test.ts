import { beforeEach, describe, expect, it } from 'vitest';
import { contextEngineService } from './contextEngineService';
import { subagentService } from './subagentService';

describe('subagentService', () => {
  beforeEach(() => {
    contextEngineService.__resetForTesting();
    subagentService.__resetForTesting();
  });

  it('spawns agents, tracks heartbeats, and completes lifecycle', () => {
    const record = subagentService.spawn({
      agentName: 'Coordinator',
      sessionId: 'sub-root-1',
    });

    expect(record.status).toBe('RUNNING');
    expect(record.depth).toBe(0);

    const heartbeated = subagentService.heartbeat(record.id);
    expect(heartbeated.lastHeartbeatAt).toBeTruthy();

    const completed = subagentService.complete(record.id, 'work done');
    expect(completed.status).toBe('COMPLETED');
    expect(completed.summary).toBe('work done');
  });

  it('enforces maximum depth for nested delegation', () => {
    const root = subagentService.spawn({ agentName: 'Root', sessionId: 'd0' });
    const d1 = subagentService.spawn({ agentName: 'D1', parentId: root.id, parentSessionId: root.sessionId, sessionId: 'd1' });
    const d2 = subagentService.spawn({ agentName: 'D2', parentId: d1.id, parentSessionId: d1.sessionId, sessionId: 'd2' });
    const d3 = subagentService.spawn({ agentName: 'D3', parentId: d2.id, parentSessionId: d2.sessionId, sessionId: 'd3' });

    expect(d3.depth).toBe(3);

    expect(() => {
      subagentService.spawn({
        agentName: 'D4',
        parentId: d3.id,
        parentSessionId: d3.sessionId,
        sessionId: 'd4',
      });
    }).toThrow(/max depth/i);
  });

  it('prevents cycle creation through ancestor name reuse', () => {
    const root = subagentService.spawn({ agentName: 'Planner', sessionId: 'cyc-root' });
    const child = subagentService.spawn({
      agentName: 'Worker',
      parentId: root.id,
      parentSessionId: root.sessionId,
      sessionId: 'cyc-child',
    });

    expect(() => {
      subagentService.spawn({
        agentName: 'Planner',
        parentId: child.id,
        parentSessionId: child.sessionId,
        sessionId: 'cyc-grandchild',
      });
    }).toThrow(/cycle/i);
  });

  it('times out stale running agents during sweep', async () => {
    const stale = subagentService.spawn({
      agentName: 'StaleRunner',
      sessionId: 'stale-session',
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    const timedOut = subagentService.timeoutSweep(1);

    expect(timedOut.length).toBe(1);
    expect(timedOut[0].id).toBe(stale.id);
    expect(timedOut[0].status).toBe('TIMED_OUT');
  });

  it('keeps orphaned children visible and allows cleanup', () => {
    const root = subagentService.spawn({ agentName: 'Parent', sessionId: 'orp-root' });
    const child = subagentService.spawn({
      agentName: 'Child',
      parentId: root.id,
      parentSessionId: root.sessionId,
      sessionId: 'orp-child',
    });

    const deleted = subagentService.dispose(root.id);
    expect(deleted).toBe(true);

    const tree = subagentService.getTree();
    expect(tree.some((node) => node.id === child.id)).toBe(true);

    const childDeleted = subagentService.dispose(child.id);
    expect(childDeleted).toBe(true);
    expect(subagentService.list().length).toBe(0);
  });
});
