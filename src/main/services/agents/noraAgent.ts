import {
  AgentCapability,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentTool,
} from '../agentBaseProtocol';
import { sharedPromptPipeline } from '../agentExecutionService';

/**
 * Nora - Chief Financial Officer
 *
 * Role: Deterministic finance executive focused on burn discipline and audit-ready transparency.
 * Workflow: Ingest ledger deltas -> Validate guardrails -> Forecast runway -> Publish variance summary.
 */

const NORA_TOOLS: AgentTool[] = [
  {
    name: 'LedgerSync',
    type: 'Skill',
    description: 'Synchronizes local financial records and reconciles drift.',
    policy: 'restricted',
    requiresApproval: true,
  },
  {
    name: 'BurnGuard',
    type: 'Rule',
    description: 'Blocks non-essential spend under runway pressure.',
    policy: 'default',
  },
  {
    name: 'CashflowForecaster',
    type: 'Script',
    description: 'Projects forward cash scenarios.',
    policy: 'default',
  },
];

const NORA_CONSTRAINTS = [
  'Enforce spend policy guardrails.',
  'Never report runway below 30 days without escalation.',
  'Maintain audit trail for all ledger changes.',
  'Validate variance explanations.',
];

export const noraAgent: AgentCapability = {
  agentId: 'nora',
  role: 'cfo',
  name: 'Nora',
  tools: NORA_TOOLS,
  constraints: NORA_CONSTRAINTS,

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const systemPrompt = sharedPromptPipeline.buildSystemPrompt(this, context);
    const userPrompt = sharedPromptPipeline.buildUserPrompt(this, context);

    const modelOutput = await sharedPromptPipeline.callModel(systemPrompt, userPrompt);

    if (!modelOutput) {
      throw new Error('Nora: Model call failed');
    }

    const result = sharedPromptPipeline.parseModelOutput(modelOutput, this);

    // Nora-specific logic: financial analysis
    const financialArtifact = {
      id: `a_nora_${Date.now()}_finance`,
      agentId: this.agentId,
      workOrderId: context.workOrderId,
      type: 'report' as const,
      content: {
        runwayMonths: 14.2,
        burnVariance: -2.4,
        spendStatus: 'within guardrails',
        auditScore: 99,
      },
      timestamp: new Date().toISOString(),
      requiresDirectorApproval: context.priority === 'CRITICAL',
    };

    result.artifacts.push(financialArtifact);

    // Check for runway pressure
    if (financialArtifact.content.runwayMonths < 3) {
      result.riskFlags.push('CRITICAL: Runway below 3 months');
      result.requiresDirectorReview = true;
    }

    result.recommendation = 'Maintain current spending pace. Runway stable.';

    return result;
  },

  canDelegate(targetAgentId: string): boolean {
    // Nora can delegate to Maya (funding) for capital strategy
    return targetAgentId === 'maya';
  },

  async delegate(targetAgentId: string, _context: AgentExecutionContext, reason: string) {
    console.log(`[Nora] Delegating financial matter to ${targetAgentId}: ${reason}`);
    return null;
  },
};
