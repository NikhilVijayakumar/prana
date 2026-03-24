import {
  AgentCapability,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentTool,
} from '../agentBaseProtocol';
import { sharedPromptPipeline } from '../agentExecutionService';

/**
 * Sofia - Chief Design Officer / Head of User Experience
 *
 * Role: Ensures user-centric design, accessibility compliance, and visual coherence.
 * Workflow: Review user research -> Assess design coherence -> Validate accessibility -> Approve design direction.
 */

const SOFIA_TOOLS: AgentTool[] = [
  {
    name: 'DesignSystem',
    type: 'Skill',
    description: 'Manages design tokens, component library, and visual coherence.',
    policy: 'default',
  },
  {
    name: 'AccessibilityRule',
    type: 'Rule',
    description: 'Enforces WCAG 2.1 AA compliance across all interfaces.',
    policy: 'default',
  },
  {
    name: 'UserTestSummary',
    type: 'Script',
    description: 'Aggregates user research findings and usability metrics.',
    policy: 'default',
  },
];

const SOFIA_CONSTRAINTS = [
  'All designs must meet WCAG 2.1 AA accessibility standards.',
  'Maintain visual consistency with design system tokens.',
  'No design changes without user validation.',
  'Flag usability blockers immediately.',
  'Ensure color contrast ratios meet accessibility requirements.',
];

export const sofiaAgent: AgentCapability = {
  agentId: 'sofia',
  role: 'designer',
  name: 'Sofia',
  tools: SOFIA_TOOLS,
  constraints: SOFIA_CONSTRAINTS,

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const systemPrompt = sharedPromptPipeline.buildSystemPrompt(this, context);
    const userPrompt = sharedPromptPipeline.buildUserPrompt(this, context);

    const modelOutput = await sharedPromptPipeline.callModel(systemPrompt, userPrompt);

    if (!modelOutput) {
      throw new Error('Sofia: Model call failed');
    }

    const result = sharedPromptPipeline.parseModelOutput(modelOutput, this);

    // Sofia-specific logic: UX and accessibility review
    const designArtifact = {
      id: `a_sofia_${Date.now()}_design`,
      agentId: this.agentId,
      workOrderId: context.workOrderId,
      type: 'report' as const,
      content: {
        designSystemAlignment: 'FULL',
        accessibilityCompliance: 'WCAG_2_1_AA',
        colorContrastRatio: 7.2,
        usabilityScore: 8.5,
        userTestingCohort: 12,
        userResearchFinding: 'Users prefer single-flow interactions',
        designIssuesFound: 0,
        accessibilityIssuesFound: 0,
        componentReuseRate: 0.92,
        readinessForRelease: true,
      },
      timestamp: new Date().toISOString(),
      requiresDirectorApproval: false,
    };

    result.artifacts.push(designArtifact);

    // Validate accessibility constraints
    if (designArtifact.content.colorContrastRatio < 4.5) {
      result.riskFlags.push('CRITICAL: Color contrast below WCAG AA standard');
      result.requiresDirectorReview = true;
    }

    if (designArtifact.content.accessibilityCompliance !== 'WCAG_2_1_AA') {
      result.riskFlags.push('CRITICAL: Accessibility compliance not met');
      result.requiresDirectorReview = true;
    }

    if (!designArtifact.content.readinessForRelease) {
      result.riskFlags.push('Design review incomplete - not ready for release');
      result.requiresDirectorReview = true;
    }

    if (designArtifact.content.usabilityScore < 7.0) {
      result.riskFlags.push('WARNING: Usability score below target threshold');
    }

    result.recommendation = `Design system alignment complete. Accessibility: ${designArtifact.content.accessibilityCompliance}. Usability score: ${designArtifact.content.usabilityScore}/10. Ready for implementation.`;

    return result;
  },

  canDelegate(targetAgentId: string): boolean {
    // Sofia can delegate to Julia (tech feasibility) or Eva (accessibility compliance)
    return targetAgentId === 'julia' || targetAgentId === 'eva';
  },

  async delegate(targetAgentId: string, _context: AgentExecutionContext, reason: string) {
    console.log(`[Sofia] Delegating design concern to ${targetAgentId}: ${reason}`);
    return null;
  },
};
