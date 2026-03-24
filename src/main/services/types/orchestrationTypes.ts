/**
 * Federated Orchestration Shared Types
 *
 * Defines all interfaces and types for the multi-agent orchestration system.
 * These are used across OrchestrationManager, RecoveryService, ProtocolInterceptor,
 * WorkflowEngine, and AuditLogService.
 *
 * File: src/main/services/types/orchestrationTypes.ts
 */

/**
 * ============================================================================
 * PRIORITY & QUEUE TYPES
 * ============================================================================
 */

export type WorkOrderPriority = 'CRITICAL' | 'URGENT' | 'IMPORTANT' | 'ROUTINE';

export enum WorkOrderStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ESCALATED = 'ESCALATED',
}

export interface WorkOrder {
  id: string;
  createdAt: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  targetPersonaId: string;
  directorIntentId: string;
}

/**
 * ============================================================================
 * AGENT & PERSONA TYPES
 * ============================================================================
 */

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  rank?: number; // 1-10 (10 = Director)
  constraints?: string[];
  approvedProtocols?: string[];
  approvedChannels?: string[];
  workflows?: string[];
}

export interface AgentCapability {
  agentId: string;
  role: string;
  name: string;
  tools: Array<{
    name: string;
    type: 'Skill' | 'Rule' | 'Script' | 'Service';
    description: string;
  }>;
  constraints: string[];
}

/**
 * ============================================================================
 * WORKFLOW TYPES (Goose-style step execution)
 * ============================================================================
 */

export interface Workflow {
  id: string;
  title: string;
  description: string;
  personaId: string;
  applicablePriorities?: WorkOrderPriority[];
  steps: WorkflowStep[];
  outputChannels?: string[];
  dataClassification?: DataClassification;
}

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  executionConfig: StepExecutionConfig;
}

export interface StepExecutionConfig {
  command: string;
  timeout_seconds?: number; // Default: 300 (5 min)
  success_checks?: SuccessCheck[];
  on_failure?: string; // Cleanup command
  on_failure_timeout_seconds?: number; // Default: 600 (10 min)
  max_retries?: number; // Default: 3
  backoff_multiplier?: number; // Default: 2
  max_backoff_ms?: number; // Default: 30000
}

/**
 * Success validation check (used by RecoveryService)
 */
export type SuccessCheck = ShellCheck | AssertionCheck | HttpCheck;

export interface ShellCheck {
  type: 'shell';
  command: string;
}

export interface AssertionCheck {
  type: 'assertion';
  assertion: string;
}

export interface HttpCheck {
  type: 'http_check';
  http_url: string;
  expected_status?: number;
}

export enum StepExecutionResult {
  SUCCESS = 'SUCCESS',
  FAILURE_RECOVERABLE = 'FAILURE_RECOVERABLE',
  FAILURE_PERMANENT = 'FAILURE_PERMANENT',
  ESCALATED = 'ESCALATED',
}

export interface WorkflowExecutionResult {
  status: 'completed' | 'failed' | 'escalated';
  output?: any;
  error?: string;
  escalationReason?: string;
  stepsExecuted?: number;
}

/**
 * ============================================================================
 * RECOVERY & RETRY TYPES (Goose pattern)
 * ============================================================================
 */

export interface RetryConfig {
  max_retries: number;
  checks: SuccessCheck[];
  on_failure?: string;
  timeout_seconds?: number;
  on_failure_timeout_seconds?: number;
}

export enum ErrorClassification {
  TRANSIENT = 'transient', // Retriable (timeout, rate limit, network)
  PERMANENT = 'permanent', // Not retriable (auth error, bad config)
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  isRetriable: boolean;
  classification: ErrorClassification;
  reason: string;
  message: string;
}

/**
 * ============================================================================
 * SECURITY & COMPLIANCE TYPES (NemoClaw pattern)
 * ============================================================================
 */

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface Protocol {
  id: string;
  title: string;
  description: string;
  rules: ProtocolRule[];
}

export interface ProtocolRule {
  id: string;
  type: 'data_classification_check' | 'channel_check' | 'rbac_check' | 'custom';
  description: string;
  config: Record<string, any>;
}

export interface ProtocolViolation {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  ruleId: string;
  description: string;
  action: 'allow' | 'warn' | 'block' | 'escalate';
  timestamp: string;
  agentId: string;
  workOrderId: string;
  violationDetails: Record<string, any>;
}

export enum InterceptionAction {
  ALLOW = 'allow',
  WARN = 'warn',
  BLOCK = 'block',
  ESCALATE_TO_EVA = 'escalate_to_eva',
}

export interface InterceptionContext {
  agentId: string;
  workOrderId: string;
  workflowId: string;
  inputData: any;
  requestedChannels?: string[];
  dataClassification?: DataClassification;
}

export interface InterceptionResult {
  action: InterceptionAction;
  violations: ProtocolViolation[];
}

/**
 * ============================================================================
 * AUDIT & COMPLIANCE TYPES
 * ============================================================================
 */

export enum AuditActionType {
  INTENT_RECEIVED = 'INTENT_RECEIVED',
  INTENT_ROUTED = 'INTENT_ROUTED',
  WORK_ORDER_CREATED = 'WORK_ORDER_CREATED',
  PROTOCOL_VALIDATION = 'PROTOCOL_VALIDATION',
  PROTOCOL_VIOLATION = 'PROTOCOL_VIOLATION',
  WORKFLOW_STARTED = 'WORKFLOW_STARTED',
  STEP_STARTED = 'STEP_STARTED',
  STEP_COMPLETED = 'STEP_COMPLETED',
  STEP_FAILED = 'STEP_FAILED',
  STEP_RETRY = 'STEP_RETRY',
  WORKFLOW_COMPLETED = 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED = 'WORKFLOW_FAILED',
  ESCALATION_TO_EVA = 'ESCALATION_TO_EVA',
  COMPLIANCE_CHECK_PASSED = 'COMPLIANCE_CHECK_PASSED',
  COMPLIANCE_CHECK_FAILED = 'COMPLIANCE_CHECK_FAILED',
}

export enum AuditResultType {
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  FAILURE = 'FAILURE',
  ESCALATED = 'ESCALATED',
}

export interface AuditRecord {
  id: string; // UUID
  timestamp: string; // ISO 8601
  actor: string; // Agent ID
  action: AuditActionType;
  target: string; // What was affected
  result: AuditResultType;
  parentTxnId?: string; // Cryptographic chain reference
  details?: Record<string, any>; // Contextual metadata
}

export interface AuditTrail {
  totalRecords: number;
  records: AuditRecord[];
}

/**
 * ============================================================================
 * CHANNEL & MESSAGING TYPES
 * ============================================================================
 */

export type ChannelType = 'internal-chat' | 'telegram' | 'webhook' | 'api';

export enum ChannelTransmissionMode {
  NOTIFY_ONLY = 'notify-only',
  INTERACTIVE = 'interactive',
  GOVERNANCE_ONLY = 'governance-only',
}

export interface ChannelMessage {
  id: string;
  channel: ChannelType;
  senderId: string; // Email or Telegram ID
  content: string;
  attachments?: string[];
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface ChannelConfig {
  channel: ChannelType;
  transmissionModes: ChannelTransmissionMode[];
  defaultMode: ChannelTransmissionMode;
  retryPolicy?: RetryPolicy;
  auditRequired: boolean;
}

export interface RetryPolicy {
  maxRetries: number;
  initialIntervalMs: number;
  backoffMultiplier: number;
  maxIntervalMs: number;
}

/**
 * ============================================================================
 * EXECUTION CONTEXT TYPES
 * ============================================================================
 */

export interface ExecutionContext {
  workOrderId: string;
  personaId: string;
  workflowId: string;
  stepId: string;
  env: Record<string, string>;
  resetState: () => Promise<void>;
  artifacts: Map<string, any>;
}

export interface ExecutionEnvironment {
  variables: Record<string, string>;
  secrets?: Record<string, string>;
  workspaceRoot: string;
}

/**
 * ============================================================================
 * ORCHESTRATION RESULT TYPES
 * ============================================================================
 */

export interface OrchestrationResult {
  success: boolean;
  workOrderId: string;
  personaId: string;
  queuePosition?: number;
  message: string;
  auditTrailRef: string;
}

export interface WorkflowExecutionStatus {
  workOrderId: string;
  status: WorkOrderStatus;
  personaId: string;
  percentComplete: number;
  currentStep?: string;
  errorMessage?: string;
  lastUpdated: string;
}

/**
 * ============================================================================
 * COMPLIANCE & REPORTING TYPES
 * ============================================================================
 */

export interface ComplianceReport {
  period: { startDate: string; endDate: string };
  totalTransactions: number;
  successRate: number;
  violations: ProtocolViolation[];
  actorSummary: Record<string, number>;
  actionSummary: Record<AuditActionType, number>;
}

export interface DecisionTrace {
  transactionId: string;
  chain: AuditRecord[];
  originalIntentId: string;
  finalStatus: WorkOrderStatus;
  totalDuration: number;
}
