import { AgentCapability } from './agentBaseProtocol';
import { miraAgent } from './agents/miraAgent';
import { noraAgent } from './agents/noraAgent';
import { evaAgent } from './agents/evaAgent';
import { juliaAgent } from './agents/juliaAgent';
import { elinaAgent } from './agents/elinaAgent';
import { mayaAgent } from './agents/mayaAgent';
import { linaAgent } from './agents/linaAgent';
import { aryaAgent } from './agents/aryaAgent';
import { daniAgent } from './agents/daniAgent';
import { sofiaAgent } from './agents/sofiaAgent';

/**
 * Factory function to create an agent registry.
 * This is transitional - will be fully DB-backed in v2.
 */
export const createAgentRegistry = () => {
  const agentRegistry = new Map<string, AgentCapability>();

  // Register Wave 1 agents
  agentRegistry.set('mira', miraAgent);
  agentRegistry.set('nora', noraAgent);
  agentRegistry.set('eva', evaAgent);
  agentRegistry.set('julia', juliaAgent);

  // Register Wave 2 agents
  agentRegistry.set('elina', elinaAgent);
  agentRegistry.set('maya', mayaAgent);
  agentRegistry.set('lina', linaAgent);

  // Register Wave 3 agents
  agentRegistry.set('arya', aryaAgent);
  agentRegistry.set('dani', daniAgent);
  agentRegistry.set('sofia', sofiaAgent);

  return {
    /**
     * Get an agent by ID.
     * Returns null if not found or not yet implemented.
     */
    getAgent(agentId: string): AgentCapability | null {
      return agentRegistry.get(agentId) ?? null;
    },

    /**
     * List all registered agents.
     */
    listAgents(): AgentCapability[] {
      return Array.from(agentRegistry.values());
    },

    /**
     * Check if agent is implemented (Wave 1+).
     */
    isImplemented(agentId: string): boolean {
      const agent = agentRegistry.get(agentId);
      if (!agent) return false;
      // Wave 1 agents have non-empty tools
      return agent.tools.length > 0;
    },

    /**
     * Get Wave 1 implemented agents.
     */
    getWave1Agents(): AgentCapability[] {
      return ['mira', 'nora', 'eva', 'julia'].map((id) => agentRegistry.get(id)!).filter(Boolean);
    },

    /**
     * Get Wave 2 implemented agents.
     */
    getWave2Agents(): AgentCapability[] {
      return ['elina', 'maya', 'lina'].map((id) => agentRegistry.get(id)!).filter(Boolean);
    },

    /**
     * Get Wave 3 implemented agents.
     */
    getWave3Agents(): AgentCapability[] {
      return ['arya', 'dani', 'sofia'].map((id) => agentRegistry.get(id)!).filter(Boolean);
    },

    /**
     * Register a new agent (for future phases).
     */
    registerAgent(agent: AgentCapability): void {
      agentRegistry.set(agent.agentId, agent);
    },
  };
};

// Backward compatibility - creates a default instance
export const agentRegistryService = createAgentRegistry();
