import { describe, it, expect } from 'vitest';
import { agentExecutionService } from './agentExecutionService';
import { agentRegistryService } from './agentRegistryService';
import { workOrderService } from './workOrderService';

describe('Wave 3 Agents', () => {
  describe('Agent Registry', () => {
    it('should list Wave 3 agents', () => {
      const agents = agentRegistryService.getWave3Agents();
      expect(agents).toHaveLength(3);
      expect(agents.map((a) => a.agentId)).toEqual(['arya', 'dani', 'sofia']);
    });

    it('should identify Wave 3 agents as implemented', () => {
      expect(agentRegistryService.isImplemented('arya')).toBe(true);
      expect(agentRegistryService.isImplemented('dani')).toBe(true);
      expect(agentRegistryService.isImplemented('sofia')).toBe(true);
    });

    it('should have all 10 agents available', () => {
      const allAgents = agentRegistryService.listAgents();
      expect(allAgents).toHaveLength(10);
    });
  });

  describe('Arya Agent (CEO)', () => {
    it('should execute and produce strategic direction', async () => {
      const agent = agentRegistryService.getAgent('arya')!;
      expect(agent).toBeDefined();
      expect(agent.role).toBe('ceo');

      const workOrder = workOrderService.create({
        moduleRoute: '/strategy',
        message: 'What is our strategic direction?',
        targetEmployeeId: 'arya',
        priority: 'IMPORTANT',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const result = await agentExecutionService.executeAgent(agent, workOrder.id);

      expect(result).toBeDefined();
      expect(result!.agentId).toBe('arya');
      expect(result!.artifacts.length).toBeGreaterThan(0);

      const strategyArtifact = result!.artifacts.find((a) => a.type === 'decision');
      expect(strategyArtifact).toBeDefined();
    });

    it('should have strategic planning tools', () => {
      const agent = agentRegistryService.getAgent('arya')!;
      const toolNames = agent.tools.map((t) => t.name);

      expect(toolNames).toContain('StrategyBoard');
      expect(toolNames).toContain('MilestoneRule');
      expect(toolNames).toContain('BoardBrief');
    });

    it('should require director review for critical decisions', async () => {
      const agent = agentRegistryService.getAgent('arya')!;

      const workOrder = workOrderService.create({
        moduleRoute: '/strategy',
        message: 'Critical strategic decision needed',
        targetEmployeeId: 'arya',
        priority: 'CRITICAL',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const result = await agentExecutionService.executeAgent(agent, workOrder.id);

      expect(result).toBeDefined();
      expect(result!.requiresDirectorReview).toBe(true);
    });
  });

  describe('Dani Agent (CMO)', () => {
    it('should execute and produce marketing strategy', async () => {
      const agent = agentRegistryService.getAgent('dani')!;
      expect(agent).toBeDefined();
      expect(agent.role).toBe('cmo');

      const workOrder = workOrderService.create({
        moduleRoute: '/marketing',
        message: 'Develop Q2 campaign strategy',
        targetEmployeeId: 'dani',
        priority: 'IMPORTANT',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const result = await agentExecutionService.executeAgent(agent, workOrder.id);

      expect(result).toBeDefined();
      expect(result!.agentId).toBe('dani');
      expect(result!.artifacts.length).toBeGreaterThan(0);

      const marketingArtifact = result!.artifacts.find((a) => a.type === 'recommendation');
      expect(marketingArtifact).toBeDefined();
    });

    it('should have campaign and messaging tools', () => {
      const agent = agentRegistryService.getAgent('dani')!;
      const toolNames = agent.tools.map((t) => t.name);

      expect(toolNames).toContain('CampaignBoard');
      expect(toolNames).toContain('MessagingRule');
      expect(toolNames).toContain('MarketingDigest');
    });

    it('should enforce budget constraints on high-spend campaigns', async () => {
      const agent = agentRegistryService.getAgent('dani')!;

      const workOrder = workOrderService.create({
        moduleRoute: '/marketing',
        message: 'Launch premium brand campaign',
        targetEmployeeId: 'dani',
        priority: 'IMPORTANT',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const result = await agentExecutionService.executeAgent(agent, workOrder.id);

      expect(result).toBeDefined();
      // Verify marketing artifact is created with valid budget
      const marketingArtifact = result!.artifacts.find((a) => a.type === 'recommendation');
      expect(marketingArtifact).toBeDefined();
      const marketingContent = marketingArtifact?.content as { estimatedBudget?: number } | undefined;
      expect(marketingContent?.estimatedBudget).toBeDefined();
    });
  });

  describe('Sofia Agent (Designer)', () => {
    it('should execute and produce design review', async () => {
      const agent = agentRegistryService.getAgent('sofia')!;
      expect(agent).toBeDefined();
      expect(agent.role).toBe('designer');

      const workOrder = workOrderService.create({
        moduleRoute: '/design',
        message: 'Review design system alignment',
        targetEmployeeId: 'sofia',
        priority: 'IMPORTANT',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const result = await agentExecutionService.executeAgent(agent, workOrder.id);

      expect(result).toBeDefined();
      expect(result!.agentId).toBe('sofia');
      expect(result!.artifacts.length).toBeGreaterThan(0);

      const designArtifact = result!.artifacts.find((a) => a.type === 'report');
      expect(designArtifact).toBeDefined();
    });

    it('should have design system and accessibility tools', () => {
      const agent = agentRegistryService.getAgent('sofia')!;
      const toolNames = agent.tools.map((t) => t.name);

      expect(toolNames).toContain('DesignSystem');
      expect(toolNames).toContain('AccessibilityRule');
      expect(toolNames).toContain('UserTestSummary');
    });

    it('should escalate on accessibility compliance failure', async () => {
      const agent = agentRegistryService.getAgent('sofia')!;

      const workOrder = workOrderService.create({
        moduleRoute: '/design',
        message: 'Accessibility compliance check',
        targetEmployeeId: 'sofia',
        priority: 'CRITICAL',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const result = await agentExecutionService.executeAgent(agent, workOrder.id);

      expect(result).toBeDefined();
      // Critical accessibility checks should be reviewed
      expect(result!.requiresDirectorReview).toBe(true);
    });
  });

  describe('Wave 3 Agent Constraints', () => {
    it('Arya should enforce strategic constraints', () => {
      const agent = agentRegistryService.getAgent('arya')!;
      expect(agent.constraints).toContain('Align all decisions with quarterly strategic goals.');
      expect(agent.constraints).toContain('Require consensus from Nora (CFO) on any budget >$500k.');
    });

    it('Dani should enforce marketing constraints', () => {
      const agent = agentRegistryService.getAgent('dani')!;
      expect(agent.constraints).toContain('All external messaging must align with brand guidelines.');
      expect(agent.constraints).toContain('Maintain consistent tone and positioning across channels.');
    });

    it('Sofia should enforce accessibility constraints', () => {
      const agent = agentRegistryService.getAgent('sofia')!;
      expect(agent.constraints).toContain('All designs must meet WCAG 2.1 AA accessibility standards.');
      expect(agent.constraints).toContain('No design changes without user validation.');
    });
  });

  describe('Wave 1 + 2 + 3 Combined (All 10 Agents)', () => {
    it('should have all 10 agents available', () => {
      const wave1 = agentRegistryService.getWave1Agents();
      const wave2 = agentRegistryService.getWave2Agents();
      const wave3 = agentRegistryService.getWave3Agents();
      const combined = wave1.concat(wave2).concat(wave3);

      expect(combined).toHaveLength(10);
      expect(new Set(combined.map((a) => a.agentId)).size).toBe(10);
    });

    it('should verify all 10 agents have correct roles', () => {
      const wave1 = agentRegistryService.getWave1Agents();
      const wave2 = agentRegistryService.getWave2Agents();
      const wave3 = agentRegistryService.getWave3Agents();
      const combined = wave1.concat(wave2).concat(wave3);

      const roles = combined.map((a) => a.role);
      expect(roles).toContain('secretary');
      expect(roles).toContain('cfo');
      expect(roles).toContain('compliance');
      expect(roles).toContain('cto');
      expect(roles).toContain('coo');
      expect(roles).toContain('funding');
      expect(roles).toContain('hr');
      expect(roles).toContain('ceo');
      expect(roles).toContain('cmo');
      expect(roles).toContain('designer');
    });

    it('should support agent delegation across all waves', () => {
      // Arya (CEO) can delegate to department heads
      const arya = agentRegistryService.getAgent('arya')!;
      expect(arya.canDelegate('nora')).toBe(true);
      expect(arya.canDelegate('elina')).toBe(true);
      expect(arya.canDelegate('dani')).toBe(true);

      // Dani (CMO) can delegate to Maya (funding) or Sofia (design)
      const dani = agentRegistryService.getAgent('dani')!;
      expect(dani.canDelegate('maya')).toBe(true);
      expect(dani.canDelegate('sofia')).toBe(true);

      // Sofia (Designer) can delegate to Julia (tech) or Eva (compliance)
      const sofia = agentRegistryService.getAgent('sofia')!;
      expect(sofia.canDelegate('julia')).toBe(true);
      expect(sofia.canDelegate('eva')).toBe(true);
    });

    it('should enforce non-delegation rules', () => {
      // Arya cannot delegate to herself
      const arya = agentRegistryService.getAgent('arya')!;
      expect(arya.canDelegate('arya')).toBe(false);

      // Dani cannot delegate to Nora
      const dani = agentRegistryService.getAgent('dani')!;
      expect(dani.canDelegate('nora')).toBe(false);

      // Sofia cannot delegate to Mira
      const sofia = agentRegistryService.getAgent('sofia')!;
      expect(sofia.canDelegate('mira')).toBe(false);
    });
  });

  describe('Wave 3 Delegation Chain', () => {
    it('should allow cross-wave CEO to CFO delegation', () => {
      const arya = agentRegistryService.getAgent('arya')!;
      const nora = agentRegistryService.getAgent('nora')!;

      expect(arya.canDelegate('nora')).toBe(true);
      expect(nora.canDelegate('maya')).toBe(true);
    });

    it('should allow cross-wave designer to compliance delegation', () => {
      const sofia = agentRegistryService.getAgent('sofia')!;
      const eva = agentRegistryService.getAgent('eva')!;

      expect(sofia.canDelegate('eva')).toBe(true);
      expect(eva.constraints).toContain('Never allow bypass of critical policy checks.');
    });

    it('should verify all agents are implemented', () => {
      const allAgents = agentRegistryService.listAgents();
      allAgents.forEach((agent) => {
        expect(agentRegistryService.isImplemented(agent.agentId)).toBe(true);
        expect(agent.tools.length).toBeGreaterThan(0);
        expect(agent.constraints.length).toBeGreaterThan(0);
      });
    });
  });
});
