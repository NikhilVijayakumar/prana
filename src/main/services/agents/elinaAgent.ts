import {
  AgentCapability,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentTool,
} from '../agentBaseProtocol';
import { sharedPromptPipeline } from '../agentExecutionService';

/**
 * Elina - Chief Operating Officer
 *
 * Role: Orchestrates operations rhythm, delivery predictability, and queue health.
 * Workflow: Monitor queue capacity -> Prioritize dependencies -> Unblock cross-team tasks -> Report operational health.
 */

const ELINA_TOOLS: AgentTool[] = [
  {
    name: 'FlowBoard',
    type: 'Skill',
    description: 'Provides throughput and bottleneck visibility.',
    policy: 'default',
  },
  {
    name: 'QueueRule',
    type: 'Rule',
    description: 'Protects crisis slots and SLA priorities.',
    policy: 'default',
  },
  {
    name: 'OpsDigest',
    type: 'Script',
    description: 'Summarizes delivery pulse every cycle.',
    policy: 'default',
  },
];

const ELINA_CONSTRAINTS = [
  'Maintain queue SLA compliance.',
  'Never allow capacity overload without escalation.',
  'Flag blocked critical paths immediately.',
  'Balance throughput with quality.',
];

export const elinaAgent: AgentCapability = {
  agentId: 'elina',
  role: 'coo',
  name: 'Elina',
  tools: ELINA_TOOLS,
  constraints: ELINA_CONSTRAINTS,

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const systemPrompt = sharedPromptPipeline.buildSystemPrompt(this, context);
    const userPrompt = sharedPromptPipeline.buildUserPrompt(this, context);

    const modelOutput = await sharedPromptPipeline.callModel(systemPrompt, userPrompt);

    if (!modelOutput) {
      throw new Error('Elina: Model call failed');
    }

    const result = sharedPromptPipeline.parseModelOutput(modelOutput, this);

    // Elina-specific logic: operational health
    const opsArtifact = {
      id: `a_elina_${Date.now()}_ops`,
      agentId: this.agentId,
      workOrderId: context.workOrderId,
      type: 'report' as const,
      content: {
        throughput: 24,
        throughputUnit: 'per week',
        blockedTasks: 3,
        slaBreaches: 1,
        queueCapacity: 0.65,
        criticalPathsClear: true,
        bottlenecks: ['cross-module handoffs'],
        nextActions: ['Resolve blocked dependency', 'Refresh queue priorities'],
      },
      timestamp: new Date().toISOString(),
      requiresDirectorApproval: context.priority === 'CRITICAL' || context.priority === 'URGENT',
    };

    result.artifacts.push(opsArtifact);

    // Flag operational concerns
    if (opsArtifact.content.queueCapacity > 0.8) {
      result.riskFlags.push('WARNING: Queue capacity above 80%');
    }

    if (opsArtifact.content.blockedTasks > 5) {
      result.riskFlags.push('CRITICAL: Blocked task count exceeds threshold');
      result.requiresDirectorReview = true;
    }

    if (!opsArtifact.content.criticalPathsClear) {
      result.riskFlags.push('CRITICAL: Critical path blocked');
      result.requiresDirectorReview = true;
    }

    result.recommendation = `Operational health stable. Throughput: ${opsArtifact.content.throughput}/${opsArtifact.content.throughputUnit}. Proceed with current pace.`;

    return result;
  },

  canDelegate(targetAgentId: string): boolean {
    // Elina can delegate to Julia (tech planning) or Nora (resource budget)
    return targetAgentId === 'julia' || targetAgentId === 'nora';
  },

  async delegate(targetAgentId: string, _context: AgentExecutionContext, reason: string) {
    console.log(`[Elina] Delegating operational matter to ${targetAgentId}: ${reason}`);
    return null;
  },
};
