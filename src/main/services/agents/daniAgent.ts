import {
  AgentCapability,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentTool,
} from '../agentBaseProtocol';
import { sharedPromptPipeline } from '../agentExecutionService';

/**
 * Dani - Chief Marketing Officer
 *
 * Role: Drives market visibility, brand strategy, and messaging consistency.
 * Workflow: Assess market positioning -> Develop campaign strategy -> Ensure message alignment -> Track brand metrics.
 */

const DANI_TOOLS: AgentTool[] = [
  {
    name: 'CampaignBoard',
    type: 'Skill',
    description: 'Manages marketing campaigns and channel allocation.',
    policy: 'default',
  },
  {
    name: 'MessagingRule',
    type: 'Rule',
    description: 'Ensures brand consistency across all communications.',
    policy: 'default',
  },
  {
    name: 'MarketingDigest',
    type: 'Script',
    description: 'Aggregates market insights and campaign performance.',
    policy: 'default',
  },
];

const DANI_CONSTRAINTS = [
  'All external messaging must align with brand guidelines.',
  'Maintain consistent tone and positioning across channels.',
  'Flag competitive threats or market shifts immediately.',
  'Require Maya (funding) approval for campaigns exceeding $100k spend.',
  'Track brand sentiment and report weekly.',
];

export const daniAgent: AgentCapability = {
  agentId: 'dani',
  role: 'cmo',
  name: 'Dani',
  tools: DANI_TOOLS,
  constraints: DANI_CONSTRAINTS,

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const systemPrompt = sharedPromptPipeline.buildSystemPrompt(this, context);
    const userPrompt = sharedPromptPipeline.buildUserPrompt(this, context);

    const modelOutput = await sharedPromptPipeline.callModel(systemPrompt, userPrompt);

    if (!modelOutput) {
      throw new Error('Dani: Model call failed');
    }

    const result = sharedPromptPipeline.parseModelOutput(modelOutput, this);

    // Dani-specific logic: marketing strategy and brand alignment
    const marketingArtifact = {
      id: `a_dani_${Date.now()}_marketing`,
      agentId: this.agentId,
      workOrderId: context.workOrderId,
      type: 'recommendation' as const,
      content: {
        campaignFocus: 'Q2 Product Launch',
        channels: ['LinkedIn', 'Product Hunt', 'Tech Blogs'],
        messagingTheme: 'Enterprise AI Simplification',
        brandAlignment: 'FULL',
        estimatedReach: 150000,
        targetDemographic: 'Tech decision makers, CTOs',
        estimatedBudget: 75000,
        competitiveThreats: [],
        brandSentiment: 0.78,
      },
      timestamp: new Date().toISOString(),
      requiresDirectorApproval: false,
    };

    result.artifacts.push(marketingArtifact);

    // Check budget constraints
    if (marketingArtifact.content.estimatedBudget > 100000) {
      result.riskFlags.push('Budget exceeds $100k threshold - requires capital approval from Maya');
      result.requiresDirectorReview = true;
    }

    // Check brand alignment
    if (marketingArtifact.content.brandAlignment !== 'FULL') {
      result.riskFlags.push('WARNING: Campaign not fully aligned with brand guidelines');
    }

    if (marketingArtifact.content.brandSentiment < 0.6) {
      result.riskFlags.push('CONCERN: Brand sentiment declining');
      result.requiresDirectorReview = true;
    }

    result.recommendation = `Campaign strategy ready: "${marketingArtifact.content.messagingTheme}" via ${marketingArtifact.content.channels.join(', ')}. Budget: $${marketingArtifact.content.estimatedBudget}k. Proceed with cross-functional review.`;

    return result;
  },

  canDelegate(targetAgentId: string): boolean {
    // Dani can delegate to Maya (for campaign budgets) or Sofia (for creative execution)
    return targetAgentId === 'maya' || targetAgentId === 'sofia';
  },

  async delegate(targetAgentId: string, _context: AgentExecutionContext, reason: string) {
    console.log(`[Dani] Delegating marketing initiative to ${targetAgentId}: ${reason}`);
    return null;
  },
};
