import { WorkOrderRecord } from './workOrderService';

/**
 * Agent Base Protocol
 *
 * Defines the interface and lifecycle for all 10 virtual employees.
 * Each agent executes within a work order context, producing structured synthesis for review.
 */

export type AgentRole =
  | 'secretary'
  | 'ceo'
  | 'cfo'
  | 'cto'
  | 'coo'
  | 'compliance'
  | 'cmo'
  | 'designer'
  | 'hr'
  | 'funding';

export type AgentToolPolicy = 'default' | 'restricted' | 'governance-only';

export interface AgentExecutionContext {
  workOrderId: string;
  workOrder: WorkOrderRecord;
  targetEmployeeId: string;
  directorMessage: string;
  moduleRoute: string;
  priority: 'CRITICAL' | 'URGENT' | 'IMPORTANT' | 'ROUTINE';
  timestamp: string;
}

/**
 * Tool definition scoped to agent role.
 * Each agent has a subset of available tools defined at config time.
 */
export interface AgentTool {
  name: string;
  type: 'Skill' | 'Rule' | 'Script';
  description: string;
  requiresApproval?: boolean;
  policy?: AgentToolPolicy;
}

/**
 * Represents a work artifact produced during agent execution.
 * Stored in audit log for transparency and approval.
 */
export interface AgentExecutionArtifact {
  id: string;
  agentId: string;
  workOrderId: string;
  type: 'recommendation' | 'alert' | 'decision' | 'synthesis' | 'report';
  content: unknown;
  timestamp: string;
  requiresDirectorApproval: boolean;
}

/**
 * Result of an agent execution.
 * Contains synthesis, any decision, and artifacts for Director review.
 */
export interface AgentExecutionResult {
  workOrderId: string;
  agentId: string;
  agentRole: AgentRole;
  synthesis: string;
  executionTime: number;
  artifacts: AgentExecutionArtifact[];
  riskFlags: string[];
  recommendation: string | null;
  requiresDirectorReview: boolean;
}

export type AgentExecutionFailureReason =
  | 'work_order_not_found'
  | 'invalid_work_order_state'
  | 'all_providers_failed'
  | 'agent_execution_error';

export interface AgentProviderFailureDetail {
  provider: 'lm-studio' | 'openrouter' | 'gemini-cli';
  error: string;
}

export interface AgentExecutionFailure {
  success: false;
  workOrderId: string;
  agentId: string;
  failureReason: AgentExecutionFailureReason;
  message: string;
  providerFailures: AgentProviderFailureDetail[];
}

export interface AgentExecutionSuccess {
  success: true;
  result: AgentExecutionResult;
}

export type AgentExecutionOutcome = AgentExecutionSuccess | AgentExecutionFailure;

/**
 * Protocol: AgentCapability
 * Defines what an agent can do.
 * All agent implementations satisfy this contract.
 */
export interface AgentCapability {
  agentId: string;
  role: AgentRole;
  name: string;
  tools: AgentTool[];
  constraints: string[];

  /**
   * Execute the agent against a work order in EXECUTING state.
   * Returns synthesis and artifacts.
   * On error, throws with descriptive message for audit.
   */
  execute(context: AgentExecutionContext): Promise<AgentExecutionResult>;

  /**
   * Delegates to another agent (if eligible).
   * Returns new work order ID if delegation succeeds.
   */
  canDelegate(targetAgentId: string): boolean;
  delegate(
    targetAgentId: string,
    context: AgentExecutionContext,
    reason: string,
  ): Promise<string | null>;
}

/**
 * Protocol: SharedPromptPipeline
 * Orchestrates common prompt/response patterns across agents.
 */
export interface SharedPromptPipeline {
  /**
   * Build a role-specific system prompt for the agent.
   */
  buildSystemPrompt(agent: AgentCapability, context: AgentExecutionContext): string;

  /**
   * Build the user request prompt incorporating director intent.
   */
  buildUserPrompt(agent: AgentCapability, context: AgentExecutionContext): string;

  /**
   * Call model gateway and parse response.
   * Returns synthesis or null if failed.
   */
  callModel(systemPrompt: string, userPrompt: string): Promise<string | null>;

  /**
   * Returns diagnostics from the most recent callModel invocation.
   */
  getLastModelFailure(): AgentProviderFailureDetail[];

  /**
   * Parse model output into structured synthesis.
   */
  parseModelOutput(output: string, agent: AgentCapability): AgentExecutionResult;
}

/**
 * Protocol: AgentToolPolicy
 * Enforces what tools an agent can invoke.
 */
export interface AgentToolPolicyProvider {
  /**
   * Check if agent can use tool given context.
   * Returns { allowed, reason, requiresApproval }
   */
  checkTool(agentId: string, toolName: string, context: AgentExecutionContext): {
    allowed: boolean;
    reason: string;
    requiresApproval: boolean;
  };

  /**
   * Log tool invocation for audit trail.
   */
  logToolUse(agentId: string, toolName: string, context: AgentExecutionContext, result: string): void;
}

/**
 * Protocol: AgentOutputPersistence
 * Stores artifacts and executions for later retrieval and director review.
 */
export interface AgentOutputStore {
  /**
   * Store execution result and artifacts.
   */
  save(result: AgentExecutionResult): Promise<void>;

  /**
   * Retrieve artifacts for a work order by agent.
   */
  getArtifactsByWorkOrder(workOrderId: string): Promise<AgentExecutionArtifact[]>;

  /**
   * List all recent executions for an agent.
   */
  getRecentExecutions(agentId: string, limit?: number): Promise<AgentExecutionResult[]>;

  /**
   * Retrieve a specific artifact.
   */
  getArtifact(artifactId: string): Promise<AgentExecutionArtifact | null>;
}

/**
 * Wave 1 Agent IDs
 */
export const WAVE_1_AGENTS = ['mira', 'nora', 'eva', 'julia'];

/**
 * Wave 2 Agent IDs
 */
export const WAVE_2_AGENTS = ['elina', 'maya', 'lina'];

/**
 * Wave 3 Agent IDs
 */
export const WAVE_3_AGENTS = ['arya', 'dani', 'sofia'];

/**
 * All agent IDs
 */
export const ALL_AGENTS = [...WAVE_1_AGENTS, ...WAVE_2_AGENTS, ...WAVE_3_AGENTS];
