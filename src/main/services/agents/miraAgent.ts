import {
  AgentCapability,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentTool,
} from '../agentBaseProtocol';
import { sharedPromptPipeline } from '../agentExecutionService';

/**
 * Mira - Secretary & Command Router
 *
 * Role: Routes Director intent to correct owners, maintains coherent cross-module handoffs.
 * Workflow: Receive -> Resolve owner -> Route with constraints -> Collect responses -> Synthesize.
 */

const MIRA_TOOLS: AgentTool[] = [
  {
    name: 'CommandRouter',
    type: 'Skill',
    description: 'Routes requests to the correct owner with deterministic tags.',
    policy: 'default',
  },
  {
    name: 'EscalationRule',
    type: 'Rule',
    description: 'Escalate unresolved items above threshold latency.',
    policy: 'default',
  },
  {
    name: 'BriefComposer',
    type: 'Script',
    description: 'Generates concise operational briefs for the Director.',
    policy: 'default',
  },
];

const MIRA_CONSTRAINTS = [
  'Never bypass work order protocol.',
  'Maintain deterministic routing rules.',
  'Flag escalations above SLA threshold.',
  'Ensure all delegations are logged.',
];

export const miraAgent: AgentCapability = {
  agentId: 'mira',
  role: 'secretary',
  name: 'Mira',
  tools: MIRA_TOOLS,
  constraints: MIRA_CONSTRAINTS,

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const systemPrompt = sharedPromptPipeline.buildSystemPrompt(this, context);
    const userPrompt = sharedPromptPipeline.buildUserPrompt(this, context);

    const modelOutput = await sharedPromptPipeline.callModel(systemPrompt, userPrompt);

    if (!modelOutput) {
      throw new Error('Mira: Model call failed');
    }

    const result = sharedPromptPipeline.parseModelOutput(modelOutput, this);

    // Mira-specific logic: parse routing intent
    const routingArtifact = {
      id: `a_mira_${Date.now()}_routing`,
      agentId: this.agentId,
      workOrderId: context.workOrderId,
      type: 'decision' as const,
      content: {
        routingTarget: context.workOrder.targetEmployeeId,
        confidence: 0.95,
        reason: 'Primary owner from director feedback.',
      },
      timestamp: new Date().toISOString(),
      requiresDirectorApproval: false,
    };

    result.artifacts.push(routingArtifact);
    result.recommendation = `Route to ${context.workOrder.targetEmployeeId} for processing.`;

    return result;
  },

  canDelegate(targetAgentId: string): boolean {
    // Mira can delegate to any agent (secretary is the central router)
    return targetAgentId !== 'mira';
  },

  async delegate(targetAgentId: string, _context: AgentExecutionContext, reason: string) {
    // In Phase D, delegation is coordinated by command router
    // Mira logs delegation intent
    console.log(`[Mira] Delegating to ${targetAgentId}: ${reason}`);
    return null; // Real delegation handled by work order system
  },
};
