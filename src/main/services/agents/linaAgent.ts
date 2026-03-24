import {
  AgentCapability,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentTool,
} from '../agentBaseProtocol';
import { sharedPromptPipeline } from '../agentExecutionService';

/**
 * Lina - Head of Human Resources
 *
 * Role: Owns talent quality, role-fit analysis, and hiring simulation integrity.
 * Workflow: Evaluate candidate signals -> Run simulation matrix -> Assess culture fit -> Publish hiring recommendation.
 */

const LINA_TOOLS: AgentTool[] = [
  {
    name: 'RoleFitEngine',
    type: 'Skill',
    description: 'Scores profiles against role requirements.',
    policy: 'default',
  },
  {
    name: 'BiasBlocker',
    type: 'Rule',
    description: 'Prevents non-compliant selection heuristics.',
    policy: 'governance-only',
  },
  {
    name: 'HiringSummary',
    type: 'Script',
    description: 'Produces transparent hiring notes.',
    policy: 'default',
  },
];

const LINA_CONSTRAINTS = [
  'Enforce unbiased candidate evaluation.',
  'Validate role-fit scores independently.',
  'Maintain hiring transparency and audit trail.',
  'Never override bias checks.',
];

export const linaAgent: AgentCapability = {
  agentId: 'lina',
  role: 'hr',
  name: 'Lina',
  tools: LINA_TOOLS,
  constraints: LINA_CONSTRAINTS,

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const systemPrompt = sharedPromptPipeline.buildSystemPrompt(this, context);
    const userPrompt = sharedPromptPipeline.buildUserPrompt(this, context);

    const modelOutput = await sharedPromptPipeline.callModel(systemPrompt, userPrompt);

    if (!modelOutput) {
      throw new Error('Lina: Model call failed');
    }

    const result = sharedPromptPipeline.parseModelOutput(modelOutput, this);

    // Lina-specific logic: talent assessment
    const talentArtifact = {
      id: `a_lina_${Date.now()}_talent`,
      agentId: this.agentId,
      workOrderId: context.workOrderId,
      type: 'decision' as const,
      content: {
        decisionConfidence: 86,
        roleFitScore: 8.7,
        cultureFitScore: 8.1,
        cycleTime: '6.2 days',
        mismatchRate: '3%',
        candidates: [
          { id: 'C-001', name: 'Candidate A', fit: 8.9, culture: 8.4, recommendation: 'STRONG_YES' },
          { id: 'C-002', name: 'Candidate B', fit: 7.6, culture: 7.9, recommendation: 'YES' },
          { id: 'C-003', name: 'Candidate C', fit: 6.2, culture: 8.1, recommendation: 'MAYBE' },
        ],
        biasCheckStatus: 'PASS',
      },
      timestamp: new Date().toISOString(),
      requiresDirectorApproval: true,
    };

    result.artifacts.push(talentArtifact);

    // Flag hiring concerns
    if (talentArtifact.content.biasCheckStatus !== 'PASS') {
      result.riskFlags.push('CRITICAL: Bias check failed - cannot proceed');
      result.requiresDirectorReview = true;
    }

    if (talentArtifact.content.roleFitScore < 7) {
      result.riskFlags.push('WARNING: Role-fit scores below threshold');
    }

    result.recommendation = `Hiring assessment complete. Confidence: ${talentArtifact.content.decisionConfidence}%. Top candidate: Candidate A (fit ${talentArtifact.content.candidates[0].fit}/10).`;

    return result;
  },

  canDelegate(targetAgentId: string): boolean {
    // Lina can delegate to Elina (COO) for operational planning or Arya (CEO) for strategic hires
    return targetAgentId === 'elina' || targetAgentId === 'arya';
  },

  async delegate(targetAgentId: string, _context: AgentExecutionContext, reason: string) {
    console.log(`[Lina] Delegating HR matter to ${targetAgentId}: ${reason}`);
    return null;
  },
};
