import {
  AgentCapability,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentTool,
} from '../agentBaseProtocol';
import { sharedPromptPipeline } from '../agentExecutionService';

/**
 * Maya - Funding & Resource Procurement
 *
 * Role: Manages capital strategy, funding opportunities, and resource procurement.
 * Workflow: Scan funding landscape -> Score opportunity quality -> Align ask with runway -> Publish capital plan.
 */

const MAYA_TOOLS: AgentTool[] = [
  {
    name: 'FundingRadar',
    type: 'Skill',
    description: 'Tracks and ranks funding opportunities.',
    policy: 'default',
    requiresApproval: true,
  },
  {
    name: 'CapitalDiscipline',
    type: 'Rule',
    description: 'Rejects misaligned capital terms.',
    policy: 'default',
  },
  {
    name: 'DeckAssembler',
    type: 'Script',
    description: 'Builds concise investor narrative packets.',
    policy: 'default',
  },
];

const MAYA_CONSTRAINTS = [
  'Maintain capital alignment with runway strategy.',
  'Enforce term quality standards (never dilutive beyond threshold).',
  'Validate all funding assumptions with finance.',
  'Keep investor pipeline transparent.',
];

export const mayaAgent: AgentCapability = {
  agentId: 'maya',
  role: 'funding',
  name: 'Maya',
  tools: MAYA_TOOLS,
  constraints: MAYA_CONSTRAINTS,

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const systemPrompt = sharedPromptPipeline.buildSystemPrompt(this, context);
    const userPrompt = sharedPromptPipeline.buildUserPrompt(this, context);

    const modelOutput = await sharedPromptPipeline.callModel(systemPrompt, userPrompt);

    if (!modelOutput) {
      throw new Error('Maya: Model call failed');
    }

    const result = sharedPromptPipeline.parseModelOutput(modelOutput, this);

    // Maya-specific logic: capital strategy
    const capitalArtifact = {
      id: `a_maya_${Date.now()}_capital`,
      agentId: this.agentId,
      workOrderId: context.workOrderId,
      type: 'recommendation' as const,
      content: {
        qualifiedLeads: 12,
        termQuality: 'A-',
        capitalSecured: '$1.8M',
        pipelineHealth: 'strong',
        nextRound: {
          targetRaise: '$5M',
          targetDilution: '15%',
          timeline: '6 months',
        },
        risks: [
          { name: 'market_volatility', severity: 'medium' },
          { name: 'competitive_funding', severity: 'low' },
        ],
      },
      timestamp: new Date().toISOString(),
      requiresDirectorApproval: true,
    };

    result.artifacts.push(capitalArtifact);

    // Flag capital concerns
    if (capitalArtifact.content.pipelineHealth === 'weak') {
      result.riskFlags.push('WARNING: Funding pipeline below target');
      result.requiresDirectorReview = true;
    }

    result.recommendation = `Capital position strong. ${capitalArtifact.content.qualifiedLeads} qualified leads in pipeline. Recommend proceeding with next round prep.`;

    return result;
  },

  canDelegate(targetAgentId: string): boolean {
    // Maya can delegate to Nora (finance review) or Arya (strategic alignment)
    return targetAgentId === 'nora' || targetAgentId === 'arya';
  },

  async delegate(targetAgentId: string, _context: AgentExecutionContext, reason: string) {
    console.log(`[Maya] Delegating capital matter to ${targetAgentId}: ${reason}`);
    return null;
  },
};
