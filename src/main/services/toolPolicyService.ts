export type ToolPolicyDecision = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

export type ToolPolicyReasonCode =
  | 'allowed'
  | 'director_approval_required'
  | 'mutation_approval_required'
  | 'loop_detected'
  | 'quota_exceeded'
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
  quotaBlocks: number;
  pathBlocks: number;
  reflections: number;
  reflectionMismatches: number;
  lastDecisionAt: string | null;
}

export interface ToolPolicyReflectionRequest {
  actor: string;
  action: string;
  target?: string;
  approvedByUser?: boolean;
  policyDecision: ToolPolicyDecision;
  result: 'SUCCESS' | 'FAILURE';
  metadata?: Record<string, unknown>;
}

export interface ToolPolicyReflectionEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  mutationClass: MutationClass | 'none';
  policyDecision: ToolPolicyDecision;
  result: 'SUCCESS' | 'FAILURE';
  approvedByUser: boolean;
  policyFit: boolean;
  message: string;
}

type MutationClass = 'write' | 'delete' | 'publish' | 'exec' | 'escalation';

const LOOP_WINDOW_MS = 60_000;
const LOOP_THRESHOLD = 5;

const DEFAULT_MAX_ACTIVE_SUBAGENTS = 64;
const DEFAULT_MAX_SUBAGENT_DEPTH = 12;

const mutationPolicyMatrix: Array<{ mutationClass: MutationClass; pattern: RegExp }> = [
  { mutationClass: 'publish', pattern: /(^|\.)publish($|\.)/i },
  { mutationClass: 'delete', pattern: /(^|\.)(delete|remove|reject)($|\.)/i },
  { mutationClass: 'write', pattern: /(^|\.)(write|save|approve|update|create|commit)($|\.)/i },
  { mutationClass: 'exec', pattern: /(^|\.)(exec|execute|run)($|\.)/i },
  { mutationClass: 'escalation', pattern: /(^|\.)escalate($|\.)/i },
];

const evaluations: Array<{
  timestampMs: number;
  actor: string;
  action: string;
  target: string;
}> = [];

const audits: ToolPolicyAuditEntry[] = [];
const reflections: ToolPolicyReflectionEntry[] = [];

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

const toNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const getMutationClass = (action: string): MutationClass | null => {
  for (const rule of mutationPolicyMatrix) {
    if (rule.pattern.test(action)) {
      return rule.mutationClass;
    }
  }

  return null;
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

    const mutationClass = getMutationClass(action);
    if (mutationClass && request.approvedByUser !== true) {
      return pushAudit(
        request,
        'REQUIRE_APPROVAL',
        action === 'vault.publish' ? 'director_approval_required' : 'mutation_approval_required',
        `Action ${action} is in mutation class ${mutationClass} and requires explicit user confirmation.`,
      );
    }

    if (action === 'subagents.spawn') {
      const depth = toNumber(request.metadata?.depth, 0);
      const activeSubagents = toNumber(request.metadata?.activeSubagents, 0);
      const maxDepth = toNumber(request.metadata?.maxDepth, DEFAULT_MAX_SUBAGENT_DEPTH);
      const maxActiveSubagents = toNumber(
        request.metadata?.maxActiveSubagents,
        DEFAULT_MAX_ACTIVE_SUBAGENTS,
      );

      if (depth > maxDepth) {
        return pushAudit(
          request,
          'DENY',
          'quota_exceeded',
          `Subagent spawn denied: current depth ${depth} exceeded policy maxDepth ${maxDepth}.`,
        );
      }

      if (activeSubagents >= maxActiveSubagents) {
        return pushAudit(
          request,
          'DENY',
          'quota_exceeded',
          `Subagent spawn denied: active subagents ${activeSubagents} reached maxActiveSubagents ${maxActiveSubagents}.`,
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

  reflect(request: ToolPolicyReflectionRequest): ToolPolicyReflectionEntry {
    const mutationClass = getMutationClass(request.action);
    const policyFit = mutationClass ? request.approvedByUser === true : true;
    const entry: ToolPolicyReflectionEntry = {
      id: `tpol_ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: nowIso(),
      actor: request.actor,
      action: request.action,
      target: request.target ?? 'n/a',
      mutationClass: mutationClass ?? 'none',
      policyDecision: request.policyDecision,
      result: request.result,
      approvedByUser: request.approvedByUser === true,
      policyFit,
      message: policyFit
        ? 'Reflection passed: action execution aligns with policy constraints.'
        : 'Reflection mismatch: mutating action completed without user approval evidence.',
    };

    reflections.unshift(entry);
    if (reflections.length > 200) {
      reflections.length = 200;
    }

    return entry;
  },

  listReflections(limit = 25): ToolPolicyReflectionEntry[] {
    return reflections.slice(0, Math.max(0, limit));
  },

  getTelemetry(): ToolPolicyTelemetry {
    const totalEvaluations = audits.length;
    const allowed = audits.filter((entry) => entry.decision === 'ALLOW').length;
    const denied = audits.filter((entry) => entry.decision === 'DENY').length;
    const approvalRequired = audits.filter((entry) => entry.decision === 'REQUIRE_APPROVAL').length;
    const loopBlocks = audits.filter((entry) => entry.reasonCode === 'loop_detected').length;
    const quotaBlocks = audits.filter((entry) => entry.reasonCode === 'quota_exceeded').length;
    const pathBlocks = audits.filter((entry) => entry.reasonCode === 'path_restricted').length;
    const reflectionMismatches = reflections.filter((entry) => !entry.policyFit).length;

    return {
      totalEvaluations,
      allowed,
      denied,
      approvalRequired,
      loopBlocks,
      quotaBlocks,
      pathBlocks,
      reflections: reflections.length,
      reflectionMismatches,
      lastDecisionAt: audits[0]?.timestamp ?? null,
    };
  },

  __resetForTesting(): void {
    evaluations.length = 0;
    audits.length = 0;
    reflections.length = 0;
  },
};
