import {
  AgentCapability,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentTool,
} from '../agentBaseProtocol';
import { sharedPromptPipeline } from '../agentExecutionService';

/**
 * Arya - Chief Executive Officer
 *
 * Role: Sets strategic direction, approves major decisions, and reviews operational health.
 * Workflow: Review strategic context -> Evaluate trade-offs -> Set direction -> Authorize budgets -> Approve critical decisions.
 */

const ARYA_TOOLS: AgentTool[] = [
  {
    name: 'StrategyBoard',
    type: 'Skill',
    description: 'Provides strategic roadmap and alignment with market trends.',
    policy: 'default',
  },
  {
    name: 'MilestoneRule',
    type: 'Rule',
    description: 'Enforces quarterly milestones and strategic alignment.',
    policy: 'default',
  },
  {
    name: 'BoardBrief',
    type: 'Script',
    description: 'Generates executive summary and board-level insights.',
    policy: 'default',
  },
];

const ARYA_CONSTRAINTS = [
  'Align all decisions with quarterly strategic goals.',
  'Require consensus from Nora (CFO) on any budget >$500k.',
  'Delegate operational details to respective department heads.',
  'Flag any off-strategy initiatives for review.',
  'Maintain 90-day rolling strategic clarity.',
];

export const aryaAgent: AgentCapability = {
  agentId: 'arya',
  role: 'ceo',
  name: 'Arya',
  tools: ARYA_TOOLS,
  constraints: ARYA_CONSTRAINTS,

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const systemPrompt = sharedPromptPipeline.buildSystemPrompt(this, context);
    const userPrompt = sharedPromptPipeline.buildUserPrompt(this, context);

    const modelOutput = await sharedPromptPipeline.callModel(systemPrompt, userPrompt);

    if (!modelOutput) {
      throw new Error('Arya: Model call failed');
    }

    const result = sharedPromptPipeline.parseModelOutput(modelOutput, this);

    // Arya-specific logic: strategic direction
    const strategyArtifact = {
      id: `a_arya_${Date.now()}_strategy`,
      agentId: this.agentId,
      workOrderId: context.workOrderId,
      type: 'decision' as const,
      content: {
        strategicAlignment: 'ON_TRACK',
        keyThrusts: ['Product leadership', 'Market penetration', 'Team scaling'],
        quarterlyGoal: 'Q2 2026: $2M ARR milestone',
        riskProfile: 'Medium',
        recommendedAction: 'Maintain current velocity with focus on talent acquisition.',
        budgetCeiling: 750000,
        approvalRequired: false,
      },
      timestamp: new Date().toISOString(),
      requiresDirectorApproval: false,
    };

    result.artifacts.push(strategyArtifact);

    // Check for strategic alignment concerns
    if (!context.workOrder.message || context.workOrder.message.length === 0) {
      result.riskFlags.push('WARNING: Work order lacks strategic context');
    }

    if (context.priority === 'CRITICAL' || context.priority === 'URGENT') {
      result.recommendation = `Critical decision detected. Strategic alignment confirmed. Proceed with executive authorization.`;
      result.requiresDirectorReview = true;
    } else {
      result.recommendation = `Initiative aligns with Q2 strategy. Delegate to department head for execution.`;
    }

    return result;
  },

  canDelegate(targetAgentId: string): boolean {
    // Arya can delegate to any department head for execution
    // Typically: Nora (Finance), Elina (Operations), Maya (Funding), Dani (Marketing), Sofia (Design)
    return ['nora', 'elina', 'maya', 'dani', 'sofia'].includes(targetAgentId);
  },

  async delegate(targetAgentId: string, _context: AgentExecutionContext, reason: string) {
    console.log(`[Arya] Delegating strategic initiative to ${targetAgentId}: ${reason}`);
    return null;
  },
};
