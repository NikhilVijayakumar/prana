import { describe, it, expect } from 'vitest';
import { agentExecutionService } from './agentExecutionService';
import { agentRegistryService } from './agentRegistryService';
import { workOrderService } from './workOrderService';

describe('Wave 2 Agents', () => {
  describe('Agent Registry', () => {
    it('should list Wave 2 agents', () => {
      const agents = agentRegistryService.getWave2Agents();
      expect(agents).toHaveLength(3);
      expect(agents.map((a) => a.agentId)).toEqual(['elina', 'maya', 'lina']);
    });

    it('should identify Wave 2 agents as implemented', () => {
      expect(agentRegistryService.isImplemented('elina')).toBe(true);
      expect(agentRegistryService.isImplemented('maya')).toBe(true);
      expect(agentRegistryService.isImplemented('lina')).toBe(true);
    });

    it('should have all 7 agents available', () => {
      const allAgents = agentRegistryService.listAgents();
      expect(allAgents.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Elina Agent (COO)', () => {
    it('should execute and produce operational health analysis', async () => {
      const agent = agentRegistryService.getAgent('elina')!;
      expect(agent).toBeDefined();
      expect(agent.role).toBe('coo');

      const workOrder = workOrderService.create({
        moduleRoute: '/queue-monitor',
        message: 'What is our operational status?',
        targetEmployeeId: 'elina',
        priority: 'IMPORTANT',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const outcome = await agentExecutionService.executeAgent(agent, workOrder.id);

      if (!outcome.success) {
        expect(outcome.failureReason).toBe('all_providers_failed');
        expect(outcome.providerFailures.length).toBeGreaterThan(0);
        return;
      }
      const result = outcome.result;
      expect(result.agentId).toBe('elina');
      expect(result.artifacts.length).toBeGreaterThan(0);

      const opsArtifact = result.artifacts.find((a) => a.type === 'report');
      expect(opsArtifact).toBeDefined();
    });

    it('should have flow and queue management tools', () => {
      const agent = agentRegistryService.getAgent('elina')!;
      const toolNames = agent.tools.map((t) => t.name);

      expect(toolNames).toContain('FlowBoard');
      expect(toolNames).toContain('QueueRule');
      expect(toolNames).toContain('OpsDigest');
    });

    it('should flag critical queue overload', async () => {
      const agent = agentRegistryService.getAgent('elina')!;

      const workOrder = workOrderService.create({
        moduleRoute: '/queue-monitor',
        message: 'Queue is full, tasks are blocked',
        targetEmployeeId: 'elina',
        priority: 'CRITICAL',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const outcome = await agentExecutionService.executeAgent(agent, workOrder.id);

      if (!outcome.success) {
        expect(outcome.failureReason).toBe('all_providers_failed');
        expect(outcome.providerFailures.length).toBeGreaterThan(0);
        return;
      }
      const result = outcome.result;
      expect(result.requiresDirectorReview).toBe(true);
    });
  });

  describe('Maya Agent (Funding)', () => {
    it('should execute and produce capital strategy', async () => {
      const agent = agentRegistryService.getAgent('maya')!;
      expect(agent).toBeDefined();
      expect(agent.role).toBe('funding');

      const workOrder = workOrderService.create({
        moduleRoute: '/vault',
        message: 'What is our funding situation?',
        targetEmployeeId: 'maya',
        priority: 'IMPORTANT',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const outcome = await agentExecutionService.executeAgent(agent, workOrder.id);

      if (!outcome.success) {
        expect(outcome.failureReason).toBe('all_providers_failed');
        expect(outcome.providerFailures.length).toBeGreaterThan(0);
        return;
      }
      const result = outcome.result;
      expect(result.agentId).toBe('maya');
      expect(result.artifacts.length).toBeGreaterThan(0);

      const capitalArtifact = result.artifacts.find((a) => a.type === 'recommendation');
      expect(capitalArtifact).toBeDefined();
    });

    it('should have capital radar and disciplined terms tools', () => {
      const agent = agentRegistryService.getAgent('maya')!;
      const toolNames = agent.tools.map((t) => t.name);

      expect(toolNames).toContain('FundingRadar');
      expect(toolNames).toContain('CapitalDiscipline');
      expect(toolNames).toContain('DeckAssembler');
    });

    it('should always require director approval', async () => {
      const agent = agentRegistryService.getAgent('maya')!;

      const workOrder = workOrderService.create({
        moduleRoute: '/vault',
        message: 'funding check',
        targetEmployeeId: 'maya',
        priority: 'ROUTINE',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const outcome = await agentExecutionService.executeAgent(agent, workOrder.id);

      if (!outcome.success) {
        expect(outcome.failureReason).toBe('all_providers_failed');
        expect(outcome.providerFailures.length).toBeGreaterThan(0);
        return;
      }
      const result = outcome.result;
      const capitalArtifact = result.artifacts.find((a) => a.type === 'recommendation');
      expect(capitalArtifact!.requiresDirectorApproval).toBe(true);
    });
  });

  describe('Lina Agent (HR)', () => {
    it('should execute and produce talent assessment', async () => {
      const agent = agentRegistryService.getAgent('lina')!;
      expect(agent).toBeDefined();
      expect(agent.role).toBe('hr');

      const workOrder = workOrderService.create({
        moduleRoute: '/hiring-sim',
        message: 'Evaluate candidate fit for engineering role',
        targetEmployeeId: 'lina',
        priority: 'IMPORTANT',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const outcome = await agentExecutionService.executeAgent(agent, workOrder.id);

      if (!outcome.success) {
        expect(outcome.failureReason).toBe('all_providers_failed');
        expect(outcome.providerFailures.length).toBeGreaterThan(0);
        return;
      }
      const result = outcome.result;
      expect(result.agentId).toBe('lina');
      expect(result.artifacts.length).toBeGreaterThan(0);

      const talentArtifact = result.artifacts.find((a) => a.type === 'decision');
      expect(talentArtifact).toBeDefined();
    });

    it('should have unbiased evaluation and governance tools', () => {
      const agent = agentRegistryService.getAgent('lina')!;
      const toolNames = agent.tools.map((t) => t.name);

      expect(toolNames).toContain('RoleFitEngine');
      expect(toolNames).toContain('BiasBlocker');
      expect(toolNames).toContain('HiringSummary');
    });

    it('should escalate on bias check failure', async () => {
      const agent = agentRegistryService.getAgent('lina')!;

      const workOrder = workOrderService.create({
        moduleRoute: '/hiring-sim',
        message: 'Assess candidates for role',
        targetEmployeeId: 'lina',
        priority: 'CRITICAL',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const outcome = await agentExecutionService.executeAgent(agent, workOrder.id);

      if (!outcome.success) {
        expect(outcome.failureReason).toBe('all_providers_failed');
        expect(outcome.providerFailures.length).toBeGreaterThan(0);
        return;
      }
      const result = outcome.result;
      expect(result.requiresDirectorReview).toBe(true);
    });
  });

  describe('Wave 2 Agent Constraints', () => {
    it('Elina should enforce operational constraints', () => {
      const agent = agentRegistryService.getAgent('elina')!;
      expect(agent.constraints).toContain('Maintain queue SLA compliance.');
      expect(agent.constraints).toContain('Never allow capacity overload without escalation.');
    });

    it('Maya should enforce capital constraints', () => {
      const agent = agentRegistryService.getAgent('maya')!;
      expect(agent.constraints).toContain('Maintain capital alignment with runway strategy.');
      expect(agent.constraints).toContain('Enforce term quality standards (never dilutive beyond threshold).');
    });

    it('Lina should enforce HR constraints', () => {
      const agent = agentRegistryService.getAgent('lina')!;
      expect(agent.constraints).toContain('Enforce unbiased candidate evaluation.');
      expect(agent.constraints).toContain('Never override bias checks.');
    });
  });

  describe('Wave 1 + Wave 2 Combined', () => {
    it('should have 7 agents available', () => {
      const wave1 = agentRegistryService.getWave1Agents();
      const wave2 = agentRegistryService.getWave2Agents();
      const combined = wave1.concat(wave2);

      expect(combined).toHaveLength(7);
      expect(new Set(combined.map((a) => a.agentId)).size).toBe(7);
    });

    it('should support agent delegation across waves', () => {
      // Nora (CFO) can delegate to Maya (Funding)
      const nora = agentRegistryService.getAgent('nora')!;
      expect(nora.canDelegate('maya')).toBe(true);

      // Elina (COO) can delegate to Julia (CTO)
      const elina = agentRegistryService.getAgent('elina')!;
      expect(elina.canDelegate('julia')).toBe(true);

      // Lina (HR) can delegate to Elina (COO)
      const lina = agentRegistryService.getAgent('lina')!;
      expect(lina.canDelegate('elina')).toBe(true);
    });
  });
});
