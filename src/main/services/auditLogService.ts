import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getAppDataRoot } from './governanceRepoService';

const AUDIT_LOG_FILE = 'audit_log.jsonl';

export const AUDIT_ACTIONS = {
  INTENT_RECEIVED: 'INTENT_RECEIVED',
  INTENT_ROUTED: 'INTENT_ROUTED',
  WORK_ORDER_CREATED: 'WORK_ORDER_CREATED',
  ORCHESTRATION_FAILED: 'ORCHESTRATION_FAILED',
  STEP_BACKOFF_WAIT: 'STEP_BACKOFF_WAIT',
  STEP_COMPLETED: 'STEP_COMPLETED',
  STEP_ERROR_CLASSIFIED: 'STEP_ERROR_CLASSIFIED',
  STEP_FAILED_PERMANENT: 'STEP_FAILED_PERMANENT',
  STEP_MAX_RETRIES_EXCEEDED: 'STEP_MAX_RETRIES_EXCEEDED',
  STEP_CLEANUP_EXECUTED: 'STEP_CLEANUP_EXECUTED',
  STEP_STATE_RESET: 'STEP_STATE_RESET',
  STEP_CLEANUP_FAILED: 'STEP_CLEANUP_FAILED',
  STEP_RETRY: 'STEP_RETRY',
  PROTOCOL_VIOLATION_CRITICAL: 'PROTOCOL_VIOLATION_CRITICAL',
  PROTOCOL_ESCALATION_INITIATED: 'PROTOCOL_ESCALATION_INITIATED',
  PROTOCOL_VIOLATION_WARN: 'PROTOCOL_VIOLATION_WARN',
  PROTOCOL_VALIDATION_PASSED: 'PROTOCOL_VALIDATION_PASSED',
  INTERCEPTION_ESCALATION: 'INTERCEPTION_ESCALATION',
  ESCALATION_QUEUED: 'ESCALATION_QUEUED',
  TELEGRAM_INTENT_RECEIVED: 'TELEGRAM_INTENT_RECEIVED',
  TELEGRAM_ROUTE_FAILED: 'TELEGRAM_ROUTE_FAILED',
  TELEGRAM_ROUTE_BLOCKED: 'TELEGRAM_ROUTE_BLOCKED',
  TELEGRAM_ROUTE_ESCALATED: 'TELEGRAM_ROUTE_ESCALATED',
  TELEGRAM_ROUTE_ACCEPTED: 'TELEGRAM_ROUTE_ACCEPTED',
  SYNC_STAGE_RECORDED: 'SYNC_STAGE_RECORDED',
  SYNC_COMMIT_SUCCEEDED: 'SYNC_COMMIT_SUCCEEDED',
  SYNC_DELETE_SUCCEEDED: 'SYNC_DELETE_SUCCEEDED',
  SYNC_COMMIT_FAILED: 'SYNC_COMMIT_FAILED',
  SYNC_REMOTE_MIRROR_APPLIED: 'SYNC_REMOTE_MIRROR_APPLIED',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  result: string;
  parentTxnId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

export const parseAuditJsonLine = (line: string): AuditLogRecord | null => {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isObject(parsed)) {
      return null;
    }

    const timestamp = typeof parsed['timestamp'] === 'string' ? parsed['timestamp'] : new Date().toISOString();
    const actor = typeof parsed['actor'] === 'string' ? parsed['actor'] : 'UNKNOWN';
    const action = typeof parsed['action'] === 'string' ? parsed['action'] : 'UNKNOWN_ACTION';
    const target = typeof parsed['target'] === 'string' ? parsed['target'] : 'UNKNOWN_TARGET';
    const result = typeof parsed['result'] === 'string' ? parsed['result'] : 'UNKNOWN';
    const parentTxnId = typeof parsed['parentTxnId'] === 'string' ? parsed['parentTxnId'] : undefined;
    const correlationId =
      typeof parsed['correlationId'] === 'string' ? parsed['correlationId'] : undefined;
    const metadata = isObject(parsed['metadata']) ? parsed['metadata'] : undefined;

    const generatedId = `${timestamp}:${actor}:${action}:${target}`;
    const id = typeof parsed['id'] === 'string' ? parsed['id'] : generatedId;

    return {
      id,
      timestamp,
      actor,
      action,
      target,
      result,
      parentTxnId,
      correlationId,
      metadata,
    };
  } catch {
    return null;
  }
};

const getAuditLogPath = (): string => {
  return join(getAppDataRoot(), AUDIT_LOG_FILE);
};

const appendAuditEntry = async (
  action: AuditAction,
  metadata: Record<string, unknown>,
  id?: string,
): Promise<string> => {
  const timestamp = new Date().toISOString();
  const txnId = id ?? randomUUID();
  const parentTxnId = typeof metadata['parentTxnId'] === 'string' ? metadata['parentTxnId'] : undefined;
  const correlationId =
    typeof metadata['correlationId'] === 'string'
      ? metadata['correlationId']
      : parentTxnId ?? txnId;
  const target =
    typeof metadata['workOrderId'] === 'string'
      ? metadata['workOrderId']
      : typeof metadata['intentId'] === 'string'
        ? metadata['intentId']
        : 'orchestration';
  const entry = {
    id: txnId,
    timestamp,
    actor: 'SYSTEM',
    action,
    target,
    result: 'RECORDED',
    parentTxnId,
    correlationId,
    metadata: {
      ...metadata,
      correlationId,
    },
  };

  await mkdir(getAppDataRoot(), { recursive: true });
  await appendFile(getAuditLogPath(), `${JSON.stringify(entry)}\n`, 'utf8');
  return txnId;
};

export const auditLogService = {
  async createTransaction(action: AuditAction, metadata: Record<string, unknown>): Promise<string> {
    return appendAuditEntry(action, metadata);
  },

  async appendTransaction(action: AuditAction, metadata: Record<string, unknown>): Promise<string> {
    return appendAuditEntry(action, metadata);
  },

  async listEntries(limit = 500): Promise<AuditLogRecord[]> {
    const auditPath = getAuditLogPath();
    if (!existsSync(auditPath)) {
      return [];
    }

    const raw = await readFile(auditPath, 'utf8');
    const parsed = raw
      .split('\n')
      .map((line) => parseAuditJsonLine(line))
      .filter((entry): entry is AuditLogRecord => entry !== null)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

    return parsed.slice(0, Math.max(0, limit));
  },
};
