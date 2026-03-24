export type ToolPolicyDecision = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

export type ToolPolicyReasonCode =
  | 'allowed'
  | 'director_approval_required'
  | 'loop_detected'
  | 'depth_limit_exceeded'
  | 'path_restricted'
  | 'policy_denied';

export interface ToolPolicyRequest {
  actor: string;
  action: string;
  target?: string;
  approvedByUser?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ToolPolicyResult {
  decision: ToolPolicyDecision;
  reasonCode: ToolPolicyReasonCode;
  message: string;
}

export interface ToolPolicyAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  decision: ToolPolicyDecision;
  reasonCode: ToolPolicyReasonCode;
  message: string;
}

export interface ToolPolicyTelemetry {
  totalEvaluations: number;
  allowed: number;
  denied: number;
  approvalRequired: number;
  loopBlocks: number;
  pathBlocks: number;
  lastDecisionAt: string | null;
}

const LOOP_WINDOW_MS = 60_000;
const LOOP_THRESHOLD = 5;

const evaluations: Array<{
  timestampMs: number;
  actor: string;
  action: string;
  target: string;
}> = [];

const audits: ToolPolicyAuditEntry[] = [];

const nowIso = (): string => new Date().toISOString();

const isRestrictedTarget = (target: string): boolean => {
  const normalized = target.replace(/\\/g, '/').trim();

  if (normalized.includes('..')) {
    return true;
  }

  if (/^[a-zA-Z]:\//.test(normalized)) {
    return true;
  }

  if (normalized.startsWith('/')) {
    return true;
  }

  return false;
};

const cleanupLoopWindow = (nowMs: number): void => {
  while (evaluations.length > 0 && nowMs - evaluations[0].timestampMs > LOOP_WINDOW_MS) {
    evaluations.shift();
  }
};

const countRecentRepetitions = (actor: string, action: string, target: string): number => {
  return evaluations.filter(
    (entry) => entry.actor === actor && entry.action === action && entry.target === target,
  ).length;
};

const pushAudit = (
  request: ToolPolicyRequest,
  decision: ToolPolicyDecision,
  reasonCode: ToolPolicyReasonCode,
  message: string,
): ToolPolicyResult => {
  audits.unshift({
    id: `tpol_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: nowIso(),
    actor: request.actor,
    action: request.action,
    target: request.target ?? 'n/a',
    decision,
    reasonCode,
    message,
  });

  if (audits.length > 200) {
    audits.length = 200;
  }

  return {
    decision,
    reasonCode,
    message,
  };
};

export const toolPolicyService = {
  evaluate(request: ToolPolicyRequest): ToolPolicyResult {
    const nowMs = Date.now();
    const actor = request.actor.trim() || 'unknown';
    const action = request.action.trim();
    const target = request.target?.trim() || 'default';

    if (isRestrictedTarget(target)) {
      return pushAudit(
        request,
        'DENY',
        'path_restricted',
        `Target path is restricted by policy: ${target}`,
      );
    }

    cleanupLoopWindow(nowMs);
    evaluations.push({
      timestampMs: nowMs,
      actor,
      action,
      target,
    });

    const recentRepetitions = countRecentRepetitions(actor, action, target);
    if (recentRepetitions > LOOP_THRESHOLD) {
      return pushAudit(
        request,
        'DENY',
        'loop_detected',
        `Blocked repeated action pattern for ${actor}: ${action} on ${target}.`,
      );
    }

    if (action === 'vault.publish' && request.approvedByUser !== true) {
      return pushAudit(
        request,
        'REQUIRE_APPROVAL',
        'director_approval_required',
        'Vault publish requires explicit director approval.',
      );
    }

    if (action === 'subagents.spawn') {
      const depthRaw = request.metadata?.depth;
      const depth = typeof depthRaw === 'number' ? depthRaw : 0;
      if (depth > 3) {
        return pushAudit(
          request,
          'DENY',
          'depth_limit_exceeded',
          'Subagent spawn denied by policy depth limit.',
        );
      }
    }

    return pushAudit(request, 'ALLOW', 'allowed', 'Tool action allowed by policy.');
  },

  listAudits(): ToolPolicyAuditEntry[] {
    return [...audits];
  },

  listRecentAudits(limit = 10): ToolPolicyAuditEntry[] {
    return audits.slice(0, Math.max(0, limit));
  },

  getTelemetry(): ToolPolicyTelemetry {
    const totalEvaluations = audits.length;
    const allowed = audits.filter((entry) => entry.decision === 'ALLOW').length;
    const denied = audits.filter((entry) => entry.decision === 'DENY').length;
    const approvalRequired = audits.filter((entry) => entry.decision === 'REQUIRE_APPROVAL').length;
    const loopBlocks = audits.filter((entry) => entry.reasonCode === 'loop_detected').length;
    const pathBlocks = audits.filter((entry) => entry.reasonCode === 'path_restricted').length;

    return {
      totalEvaluations,
      allowed,
      denied,
      approvalRequired,
      loopBlocks,
      pathBlocks,
      lastDecisionAt: audits[0]?.timestamp ?? null,
    };
  },

  __resetForTesting(): void {
    evaluations.length = 0;
    audits.length = 0;
  },
};
