import { randomUUID } from 'node:crypto';
import { contextEngineService } from './contextEngineService';

export type SubagentStatus =
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface SubagentRecord {
  id: string;
  agentName: string;
  model: string;
  status: SubagentStatus;
  parentId: string | null;
  depth: number;
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  lastHeartbeatAt: string;
  summary: string | null;
  error: string | null;
}

export interface SubagentSpawnRequest {
  agentName: string;
  model?: string;
  parentId?: string;
  parentSessionId?: string;
  sessionId?: string;
}

export interface SubagentTreeNode {
  id: string;
  agentName: string;
  model: string;
  status: SubagentStatus;
  depth: number;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  children: SubagentTreeNode[];
}

export interface SubagentTelemetry {
  total: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  timedOut: number;
  maxDepthObserved: number;
  roots: number;
}

const DEFAULT_MODEL = 'lmstudio/default';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_ACTIVE_SUBAGENTS = 128;
const BASE_MAX_CHILDREN_PER_NODE = 8;

const nowIso = (): string => new Date().toISOString();

const records = new Map<string, SubagentRecord>();

const countDepthFromParent = (parentId: string | null): number => {
  if (!parentId) {
    return 0;
  }

  const parent = records.get(parentId);
  if (!parent) {
    return 0;
  }

  return parent.depth + 1;
};

const countRunningSubagents = (): number => {
  let total = 0;
  for (const record of records.values()) {
    if (record.status === 'RUNNING') {
      total += 1;
    }
  }
  return total;
};

const countRunningChildren = (parentId: string): number => {
  let total = 0;
  for (const record of records.values()) {
    if (record.parentId === parentId && record.status === 'RUNNING') {
      total += 1;
    }
  }
  return total;
};

const getAdaptiveChildLimit = (depth: number): number => {
  // As delegation gets deeper, taper branching to prevent runaway fan-out.
  return Math.max(2, BASE_MAX_CHILDREN_PER_NODE - Math.floor(depth / 3));
};

const collectAncestorAgents = (parentId: string | null): string[] => {
  const ancestors: string[] = [];
  let currentId = parentId;

  while (currentId) {
    const current = records.get(currentId);
    if (!current) {
      break;
    }

    ancestors.push(current.agentName.toLowerCase());
    currentId = current.parentId;
  }

  return ancestors;
};

const toTreeNode = (record: SubagentRecord): SubagentTreeNode => ({
  id: record.id,
  agentName: record.agentName,
  model: record.model,
  status: record.status,
  depth: record.depth,
  startedAt: record.startedAt,
  endedAt: record.endedAt,
  summary: record.summary,
  children: [],
});

const updateStatus = (
  id: string,
  status: Extract<SubagentStatus, 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT'>,
  summary?: string,
  error?: string,
): SubagentRecord => {
  const record = records.get(id);
  if (!record) {
    throw new Error(`Subagent ${id} not found.`);
  }

  if (record.status !== 'RUNNING') {
    return record;
  }

  record.status = status;
  record.endedAt = nowIso();
  record.summary = summary?.trim() || null;
  record.error = error?.trim() || null;

  if (record.parentId) {
    const parent = records.get(record.parentId);
    if (parent) {
      const safeSummary = record.summary ?? `${record.agentName} finished with status ${status}.`;
      contextEngineService.onSubagentEnded(parent.sessionId, record.sessionId, safeSummary);
    }
  }

  return record;
};

export const subagentService = {
  spawn(request: SubagentSpawnRequest): SubagentRecord {
    const agentName = request.agentName.trim();
    if (!agentName) {
      throw new Error('Subagent name is required.');
    }

    const parentId = request.parentId ?? null;
    const depth = countDepthFromParent(parentId);

    if (countRunningSubagents() >= MAX_ACTIVE_SUBAGENTS) {
      throw new Error(`Subagent spawn denied: active subagent limit ${MAX_ACTIVE_SUBAGENTS} reached.`);
    }

    if (parentId) {
      const parent = records.get(parentId);
      const parentDepth = parent?.depth ?? 0;
      const maxChildren = getAdaptiveChildLimit(parentDepth);
      const currentChildren = countRunningChildren(parentId);

      if (currentChildren >= maxChildren) {
        throw new Error(
          `Subagent spawn denied: adaptive branch limit reached for parent at depth ${parentDepth} (${currentChildren}/${maxChildren}).`,
        );
      }
    }

    const ancestorAgents = collectAncestorAgents(parentId);
    if (ancestorAgents.includes(agentName.toLowerCase())) {
      throw new Error('Subagent spawn denied: cycle detected in ancestor chain.');
    }

    const sessionId = request.sessionId?.trim() || `subagent-${randomUUID()}`;
    const parentSessionId = request.parentSessionId?.trim();

    if (parentSessionId) {
      contextEngineService.prepareSubagentSpawn(parentSessionId, sessionId);
    } else {
      contextEngineService.bootstrapSession(sessionId);
    }

    const startedAt = nowIso();
    const record: SubagentRecord = {
      id: `sag_${randomUUID()}`,
      agentName,
      model: request.model?.trim() || DEFAULT_MODEL,
      status: 'RUNNING',
      parentId,
      depth,
      sessionId,
      startedAt,
      endedAt: null,
      lastHeartbeatAt: startedAt,
      summary: null,
      error: null,
    };

    records.set(record.id, record);
    return record;
  },

  heartbeat(id: string): SubagentRecord {
    const record = records.get(id);
    if (!record) {
      throw new Error(`Subagent ${id} not found.`);
    }

    if (record.status === 'RUNNING') {
      record.lastHeartbeatAt = nowIso();
    }

    return record;
  },

  complete(id: string, summary?: string): SubagentRecord {
    return updateStatus(id, 'COMPLETED', summary);
  },

  fail(id: string, error?: string): SubagentRecord {
    return updateStatus(id, 'FAILED', undefined, error);
  },

  cancel(id: string, summary?: string): SubagentRecord {
    return updateStatus(id, 'CANCELLED', summary);
  },

  timeoutSweep(timeoutMs = DEFAULT_TIMEOUT_MS): SubagentRecord[] {
    const now = Date.now();
    const timedOut: SubagentRecord[] = [];

    for (const record of records.values()) {
      if (record.status !== 'RUNNING') {
        continue;
      }

      const lastBeat = Date.parse(record.lastHeartbeatAt);
      if (Number.isNaN(lastBeat)) {
        continue;
      }

      if (now - lastBeat > timeoutMs) {
        timedOut.push(updateStatus(record.id, 'TIMED_OUT', 'Timed out by sweep.'));
      }
    }

    return timedOut;
  },

  list(): SubagentRecord[] {
    return [...records.values()].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  },

  get(id: string): SubagentRecord | null {
    return records.get(id) ?? null;
  },

  getTree(): SubagentTreeNode[] {
    const nodeMap = new Map<string, SubagentTreeNode>();
    for (const record of records.values()) {
      nodeMap.set(record.id, toTreeNode(record));
    }

    const roots: SubagentTreeNode[] = [];

    for (const record of records.values()) {
      const node = nodeMap.get(record.id);
      if (!node) {
        continue;
      }

      if (record.parentId) {
        const parentNode = nodeMap.get(record.parentId);
        if (parentNode) {
          parentNode.children.push(node);
          continue;
        }
      }

      roots.push(node);
    }

    return roots.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  },

  getTelemetry(): SubagentTelemetry {
    const all = [...records.values()];

    const telemetry: SubagentTelemetry = {
      total: all.length,
      running: all.filter((record) => record.status === 'RUNNING').length,
      completed: all.filter((record) => record.status === 'COMPLETED').length,
      failed: all.filter((record) => record.status === 'FAILED').length,
      cancelled: all.filter((record) => record.status === 'CANCELLED').length,
      timedOut: all.filter((record) => record.status === 'TIMED_OUT').length,
      maxDepthObserved: all.reduce((max, record) => Math.max(max, record.depth), 0),
      roots: all.filter((record) => !record.parentId).length,
    };

    return telemetry;
  },

  dispose(id: string): boolean {
    return records.delete(id);
  },

  __resetForTesting(): void {
    records.clear();
  },
};
