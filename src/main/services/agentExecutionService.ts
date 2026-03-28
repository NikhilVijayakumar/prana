import {
  AgentCapability,
  AgentExecutionContext,
  AgentExecutionFailure,
  AgentExecutionFailureReason,
  AgentExecutionOutcome,
  AgentExecutionResult,
  AgentExecutionArtifact,
  AgentProviderFailureDetail,
  AgentOutputStore,
  SharedPromptPipeline,
} from './agentBaseProtocol';
import { workOrderService } from './workOrderService';
import { modelGatewayService } from './modelGatewayService';
import { localExecutionProviderService, ModelProviderType } from './localExecutionProviderService';
import { coreRegistryService } from './coreRegistryService';

const toLocalProviderType = (provider: 'lmstudio' | 'openrouter' | 'gemini'): ModelProviderType => {
  if (provider === 'lmstudio') {
    return 'lm-studio';
  }
  if (provider === 'openrouter') {
    return 'openrouter';
  }
  return 'gemini-cli';
};

const buildExecutionProviderOrder = async (): Promise<ModelProviderType[]> => {
  const probe = await modelGatewayService.probeGateway();
  const order = probe.fallbackOrder.map((provider) => toLocalProviderType(provider));

  if (probe.activeProvider) {
    const active = toLocalProviderType(probe.activeProvider);
    return [active, ...order.filter((provider) => provider !== active)];
  }

  return order;
};

let lastModelFailure: AgentProviderFailureDetail[] = [];

const normalizeFailureReason = (
  reason: AgentExecutionFailureReason,
  message: string,
  workOrderId: string,
  agentId: string,
  providerFailures: AgentProviderFailureDetail[] = [],
): AgentExecutionFailure => {
  return {
    success: false,
    workOrderId,
    agentId,
    failureReason: reason,
    message,
    providerFailures,
  };
};

/**
 * In-memory artifact store for Phase D
 * In future, this could be persisted to disk or database.
 */
class InMemoryAgentOutputStore implements AgentOutputStore {
  private artifacts: Map<string, unknown[]> = new Map();
  private executions: Array<AgentExecutionResult> = [];

  async save(result: AgentExecutionResult): Promise<void> {
    const key = `wo_${result.workOrderId}`;
    const current = this.artifacts.get(key) || [];
    current.push(...result.artifacts);
    this.artifacts.set(key, current);

    this.executions.unshift(result);
    if (this.executions.length > 500) {
      this.executions.pop();
    }
  }

  async getArtifactsByWorkOrder(workOrderId: string): Promise<AgentExecutionArtifact[]> {
    const key = `wo_${workOrderId}`;
    return (this.artifacts.get(key) || []) as AgentExecutionArtifact[];
  }

  async getRecentExecutions(agentId: string, limit = 10): Promise<AgentExecutionResult[]> {
    return this.executions.filter((ex) => ex.agentId === agentId).slice(0, limit);
  }

  async getArtifact(artifactId: string): Promise<AgentExecutionArtifact | null> {
    for (const artifacts of this.artifacts.values()) {
      const found = (artifacts as AgentExecutionArtifact[]).find((a) => a.id === artifactId);
      if (found) return found;
    }
    return null;
  }
}

export const agentOutputStore = new InMemoryAgentOutputStore();

/**
 * Shared Prompt Pipeline Implementation
 * Provides standard prompt building and model orchestration for all agents.
 */
export const sharedPromptPipeline: SharedPromptPipeline = {
  buildSystemPrompt(agent: AgentCapability, context: AgentExecutionContext): string {
    const tools = agent.tools
      .map((t) => `- ${t.name} (${t.type}): ${t.description}`)
      .join('\n  ');

    const constraints = agent.constraints.join('\n  - ');
    const registryAgent = coreRegistryService.getAgentTemplate(agent.agentId);
    const longTermObjectives = registryAgent?.objectives_long_term ?? [];
    const personalityTraits = registryAgent?.personality_traits ?? [];
    const interactionStyle = registryAgent?.interaction_style ?? '';
    const backstory = registryAgent?.backstory ?? '';

    const personaLines: string[] = [];
    if (longTermObjectives.length > 0) {
      personaLines.push(`Long-term objectives:\n  - ${longTermObjectives.join('\n  - ')}`);
    }
    if (personalityTraits.length > 0) {
      personaLines.push(`Personality traits: ${personalityTraits.join(', ')}`);
    }
    if (interactionStyle.trim().length > 0) {
      personaLines.push(`Interaction style: ${interactionStyle}`);
    }
    if (backstory.trim().length > 0) {
      personaLines.push(`Backstory: ${backstory}`);
    }

    const personaBlock =
      personaLines.length > 0
        ? `\nDeep persona context from registry:\n  ${personaLines.join('\n  ')}`
        : '';

    return `You are ${agent.name}, a virtual executive with role: ${agent.role}.

Your available tools:
  ${tools}

Your constraints:
  - ${constraints}
${personaBlock}

You are processing a Director request with priority: ${context.priority}.
Module context: ${context.moduleRoute}.

Respond with:
1. A brief analysis of the request
2. Your recommendation
3. Any risk flags or concerns
4. Required artifacts or next steps

Keep synthesis concise and actionable.`;
  },

  buildUserPrompt(_agent: AgentCapability, context: AgentExecutionContext): string {
    return `Director request (Priority: ${context.priority}):

"${context.directorMessage}"

Context: Module ${context.moduleRoute}
Work Order: ${context.workOrderId}

Please provide your synthesis and recommendation.`;
  },

  async callModel(_systemPrompt: string, _userPrompt: string): Promise<string | null> {
    const providerOrder = await buildExecutionProviderOrder();
    const failures: string[] = [];
    const providerFailures: AgentProviderFailureDetail[] = [];

    for (const provider of providerOrder) {
      const execution = await localExecutionProviderService.executeWithProvider({
        provider,
        systemPrompt: _systemPrompt,
        userPrompt: _userPrompt,
        maxTokens: 1400,
        temperature: 0.2,
      });

      if (execution.success && execution.output.trim().length > 0) {
        lastModelFailure = [];
        return execution.output;
      }

      const error = execution.error ?? 'empty output';
      failures.push(`${provider}: ${error}`);
      providerFailures.push({
        provider,
        error,
      });
    }

    lastModelFailure = providerFailures;
    console.error(`[Agent Pipeline] Model execution failed across providers. ${failures.join(' | ')}`);
    return null;
  },

  getLastModelFailure(): AgentProviderFailureDetail[] {
    return [...lastModelFailure];
  },

  parseModelOutput(output: string, agent: AgentCapability): AgentExecutionResult {
    const artifactId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return {
      workOrderId: 'pending',
      agentId: agent.agentId,
      agentRole: agent.role,
      synthesis: output,
      executionTime: Math.random() * 1000 + 100,
      artifacts: [
        {
          id: artifactId,
          agentId: agent.agentId,
          workOrderId: 'pending',
          type: 'synthesis',
          content: { synthesis: output },
          timestamp: new Date().toISOString(),
          requiresDirectorApproval: true,
        },
      ],
      riskFlags: [],
      recommendation: 'Proceed with synthesis review.',
      requiresDirectorReview: true,
    };
  },
};

/**
 * Agent Execution Service
 * Orchestrates the execution flow for agents.
 */
export const agentExecutionService = {
  /**
   * Execute an agent against a work order.
   * Work order must be in EXECUTING state.
   * Returns result with synthesis for Director review.
   */
  async executeAgent(
    agent: AgentCapability,
    workOrderId: string,
  ): Promise<AgentExecutionOutcome> {
    const workOrder = workOrderService.get(workOrderId);
    if (!workOrder) {
      console.error(`Work order not found: ${workOrderId}`);
      return normalizeFailureReason(
        'work_order_not_found',
        `Work order not found: ${workOrderId}`,
        workOrderId,
        agent.agentId,
      );
    }

    if (workOrder.state !== 'EXECUTING') {
      console.error(`Work order not in EXECUTING state: ${workOrder.state}`);
      return normalizeFailureReason(
        'invalid_work_order_state',
        `Work order not in EXECUTING state: ${workOrder.state}`,
        workOrderId,
        agent.agentId,
      );
    }

    const startTime = Date.now();

    try {
      const context: AgentExecutionContext = {
        workOrderId,
        workOrder,
        targetEmployeeId: agent.agentId,
        directorMessage: workOrder.message,
        moduleRoute: workOrder.moduleRoute,
        priority: workOrder.priority,
        timestamp: workOrder.updatedAt,
      };

      // Perform full agent execution via protocol
      const result = await agent.execute(context);

      // Update result with real work order ID
      result.workOrderId = workOrderId;
      result.artifacts.forEach((a) => (a.workOrderId = workOrderId));

      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;

      // Persist result
      await agentOutputStore.save(result);

      return {
        success: true,
        result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const providerFailures = sharedPromptPipeline.getLastModelFailure();
      const failureReason: AgentExecutionFailureReason =
        message.includes('Model call failed') || providerFailures.length > 0
          ? 'all_providers_failed'
          : 'agent_execution_error';

      console.error(`Agent ${agent.agentId} execution failed:`, error);
      workOrderService.updateState(workOrderId, 'FAILED', {
        error: `Agent execution error: ${message}`,
      });
      return normalizeFailureReason(
        failureReason,
        `Agent execution error: ${message}`,
        workOrderId,
        agent.agentId,
        providerFailures,
      );
    }
  },

  /**
   * Retrieve stored artifacts for a work order.
   */
  async getWorkOrderArtifacts(workOrderId: string) {
    return agentOutputStore.getArtifactsByWorkOrder(workOrderId);
  },

  /**
   * Get recent executions for an agent.
   */
  async getAgentExecutionHistory(agentId: string, limit?: number) {
    return agentOutputStore.getRecentExecutions(agentId, limit);
  },
};
