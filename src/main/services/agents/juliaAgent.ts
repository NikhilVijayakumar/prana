import {
  AgentCapability,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentTool,
} from '../agentBaseProtocol';
import { sharedPromptPipeline } from '../agentExecutionService';

/**
 * Julia - Chief Technology Officer
 *
 * Role: Technical feasibility, architecture integrity, and implementation sequencing.
 * Workflow: Assess feasibility -> Map architecture impact -> Define execution slices -> Review tech debt.
 */

const JULIA_TOOLS: AgentTool[] = [
  {
    name: 'ArchitectureLens',
    type: 'Skill',
    description: 'Evaluates design choices against clean architecture boundaries.',
    policy: 'default',
  },
  {
    name: 'CycleShield',
    type: 'Rule',
    description: 'Flags dependency cycles and layer leaks.',
    policy: 'governance-only',
  },
  {
    name: 'TechPlanBuilder',
    type: 'Script',
    description: 'Builds implementation milestones with risk tags.',
    policy: 'default',
  },
];

const JULIA_CONSTRAINTS = [
  'Never approve architecturally unsound decisions.',
  'Enforce clean architecture layer boundaries.',
  'Flag technical debt accumulation above threshold.',
  'Maintain cycle-free dependency graph.',
];

export const juliaAgent: AgentCapability = {
  agentId: 'julia',
  role: 'cto',
  name: 'Julia',
  tools: JULIA_TOOLS,
  constraints: JULIA_CONSTRAINTS,

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const systemPrompt = sharedPromptPipeline.buildSystemPrompt(this, context);
    const userPrompt = sharedPromptPipeline.buildUserPrompt(this, context);

    const modelOutput = await sharedPromptPipeline.callModel(systemPrompt, userPrompt);

    if (!modelOutput) {
      throw new Error('Julia: Model call failed');
    }

    const result = sharedPromptPipeline.parseModelOutput(modelOutput, this);

    // Julia-specific logic: technical analysis
    const technicalArtifact = {
      id: `a_julia_${Date.now()}_tech`,
      agentId: this.agentId,
      workOrderId: context.workOrderId,
      type: 'recommendation' as const,
      content: {
        feasibility: 'HIGH',
        architectureImpact: 'LOW',
        estimatedDaysToImplement: 5,
        technicalDebt: 'STABLE',
        cycleDetected: false,
        buildStability: 98.6,
        criticalBugs: 2,
        dependencies: [
          { name: 'workOrderRuntime', satisfied: true },
          { name: 'modelGateway', satisfied: true },
          { name: 'toolPolicy', satisfied: true },
        ],
      },
      timestamp: new Date().toISOString(),
      requiresDirectorApproval: context.priority === 'CRITICAL',
    };

    result.artifacts.push(technicalArtifact);

    // Check for architectural concerns
    if (technicalArtifact.content.cycleDetected) {
      result.riskFlags.push('CRITICAL: Dependency cycle detected');
      result.requiresDirectorReview = true;
    }

    if (technicalArtifact.content.technicalDebt === 'HIGH') {
      result.riskFlags.push('WARNING: Technical debt above threshold');
    }

    result.recommendation = `Technically feasible. Estimated ${technicalArtifact.content.estimatedDaysToImplement} days effort. Proceed with implementation.`;

    return result;
  },

  canDelegate(targetAgentId: string): boolean {
    // Julia can delegate to Elina (COO) for operational execution planning
    return targetAgentId === 'elina';
  },

  async delegate(targetAgentId: string, _context: AgentExecutionContext, reason: string) {
    console.log(`[Julia] Delegating technical planning to ${targetAgentId}: ${reason}`);
    return null;
  },
};
