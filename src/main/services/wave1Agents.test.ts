import { describe, it, expect } from 'vitest';
import { agentExecutionService } from './agentExecutionService';
import { agentRegistryService } from './agentRegistryService';
import { workOrderService } from './workOrderService';
import { commandRouterService } from './commandRouterService';

describe('Wave 1 Agents', () => {
  // Note: Tests create unique work orders, so no clearing needed between tests
  // Each test gets a fresh counter value

  describe('Agent Registry', () => {
    it('should list Wave 1 agents', () => {
      const agents = agentRegistryService.getWave1Agents();
      expect(agents).toHaveLength(4);
      expect(agents.map((a) => a.agentId)).toEqual(['mira', 'nora', 'eva', 'julia']);
    });

    it('should identify Wave 1 agents as implemented', () => {
      expect(agentRegistryService.isImplemented('mira')).toBe(true);
      expect(agentRegistryService.isImplemented('nora')).toBe(true);
      expect(agentRegistryService.isImplemented('eva')).toBe(true);
      expect(agentRegistryService.isImplemented('julia')).toBe(true);
    });

    it('should return null for unimplemented agents (Wave 3)', () => {
      // All 10 agents (Wave 1+2+3) now implemented
      expect(agentRegistryService.getAgent('arya')).not.toBeNull();
      expect(agentRegistryService.getAgent('dani')).not.toBeNull();
      expect(agentRegistryService.getAgent('sofia')).not.toBeNull();
    });
  });

  describe('Mira Agent', () => {
    it('should execute and produce routing synthesis', async () => {
      const agent = agentRegistryService.getAgent('mira')!;
      expect(agent).toBeDefined();
      expect(agent.role).toBe('secretary');

      const workOrder = workOrderService.create({
        moduleRoute: '/triage',
        message: 'Finance issue needs attention',
        targetEmployeeId: 'nora',
        priority: 'URGENT',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const outcome = await agentExecutionService.executeAgent(agent, workOrder.id);

      if (!outcome.success) {
        expect(outcome.failureReason).toBe('all_providers_failed');
        expect(outcome.providerFailures.length).toBeGreaterThan(0);
        return;
      }
      const result = outcome.result;
      expect(result.agentId).toBe('mira');
      expect(result.synthesis).toBeTruthy();
      expect(result.artifacts.length).toBeGreaterThan(0);
      expect(result.requiresDirectorReview).toBe(true);
    });

    it('should have routing tools configured', () => {
      const agent = agentRegistryService.getAgent('mira')!;
      const toolNames = agent.tools.map((t) => t.name);

      expect(toolNames).toContain('CommandRouter');
      expect(toolNames).toContain('EscalationRule');
      expect(toolNames).toContain('BriefComposer');
    });
  });

  describe('Nora Agent', () => {
    it('should execute and produce financial analysis', async () => {
      const agent = agentRegistryService.getAgent('nora')!;
      expect(agent).toBeDefined();
      expect(agent.role).toBe('cfo');

      const workOrder = workOrderService.create({
        moduleRoute: '/vault',
        message: 'What is our runway status?',
        targetEmployeeId: 'nora',
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
      expect(result.agentId).toBe('nora');
      expect(result.artifacts.length).toBeGreaterThan(0);
    });

    it('should flag runway concerns as critical', async () => {
      const agent = agentRegistryService.getAgent('nora')!;

      const workOrder = workOrderService.create({
        moduleRoute: '/vault',
        message: 'runway status',
        targetEmployeeId: 'nora',
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
      // Nora's financial report artifact is added after model synthesis
      const financialArtifact = result.artifacts.find((a) => a.type === 'report');
      expect(financialArtifact).toBeDefined();
      expect(financialArtifact!.type).toBe('report');
      expect(financialArtifact!.requiresDirectorApproval).toBe(true);
    });
  });

  describe('Eva Agent', () => {
    it('should execute and produce compliance analysis', async () => {
      const agent = agentRegistryService.getAgent('eva')!;
      expect(agent).toBeDefined();
      expect(agent.role).toBe('compliance');

      const workOrder = workOrderService.create({
        moduleRoute: '/governance',
        message: 'Is this deployment compliant?',
        targetEmployeeId: 'eva',
        priority: 'URGENT',
      });

      workOrderService.updateState(workOrder.id, 'EXECUTING');

      const outcome = await agentExecutionService.executeAgent(agent, workOrder.id);

      if (!outcome.success) {
        expect(outcome.failureReason).toBe('all_providers_failed');
        expect(outcome.providerFailures.length).toBeGreaterThan(0);
        return;
      }
      const result = outcome.result;
      expect(result.agentId).toBe('eva');
      expect(result.requiresDirectorReview).toBe(true);
    });

    it('should have governance-only tools', () => {
      const agent = agentRegistryService.getAgent('eva')!;
      const governanceTools = agent.tools.filter((t) => t.policy === 'governance-only');

      expect(governanceTools.length).toBe(3);
      expect(governanceTools.map((t) => t.name)).toContain('PolicyScanner');
      expect(governanceTools.map((t) => t.name)).toContain('NoBypass');
      expect(governanceTools.map((t) => t.name)).toContain('AuditExporter');
    });
  });

  describe('Julia Agent', () => {
    it('should execute and produce technical feasibility analysis', async () => {
      const agent = agentRegistryService.getAgent('julia')!;
      expect(agent).toBeDefined();
      expect(agent.role).toBe('cto');

      const workOrder = workOrderService.create({
        moduleRoute: '/infrastructure',
        message: 'Can we implement feature X?',
        targetEmployeeId: 'julia',
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
      expect(result.agentId).toBe('julia');
      expect(result.recommendation).toContain('Estimated');
    });

    it('should include architecture lens tool', () => {
      const agent = agentRegistryService.getAgent('julia')!;
      const toolNames = agent.tools.map((t) => t.name);

      expect(toolNames).toContain('ArchitectureLens');
      expect(toolNames).toContain('CycleShield');
      expect(toolNames).toContain('TechPlanBuilder');
    });
  });

  describe('Full Workflow Integration', () => {
    it('should execute Wave 1 agent via command router workflow', async () => {
      // Submit director request for Nora
      const submitted = await commandRouterService.submitDirectorRequest({
        moduleRoute: '/vault',
        targetEmployeeId: 'nora',
        message: 'Financial status check',
        timestampIso: new Date().toISOString(),
      });

      expect(submitted.queueAccepted).toBe(true);
      expect(submitted.workOrder.state).toBe('QUEUED');

      // Process through workflow
      const processed = await commandRouterService.processNextToReview();

      expect(processed).toBeDefined();
      expect(processed!.workOrder.state).toBe('REVIEW');
      expect(processed!.progressedStates).toEqual(['EXECUTING', 'SYNTHESIS', 'REVIEW']);

      // Retrieve work order
      const final = workOrderService.get(processed!.workOrder.id);
      expect(final).toBeDefined();
      expect(final!.summary).toBeTruthy();
    });

    it('should execute multiple agents in queue order', async () => {
      // Submit two requests
      const req1 = await commandRouterService.submitDirectorRequest({
        moduleRoute: '/vault',
        targetEmployeeId: 'nora',
        message: 'Finance check',
        timestampIso: new Date().toISOString(),
      });

      const req2 = await commandRouterService.submitDirectorRequest({
        moduleRoute: '/governance',
        targetEmployeeId: 'eva',
        message: 'Compliance check',
        timestampIso: new Date().toISOString(),
      });

      expect(req1.queueAccepted).toBe(true);
      expect(req2.queueAccepted).toBe(true);

      // Process first
      const proc1 = await commandRouterService.processNextToReview();
      expect(proc1!.workOrder.id).toBe(req1.workOrder.id);

      // Process second
      const proc2 = await commandRouterService.processNextToReview();
      expect(proc2!.workOrder.id).toBe(req2.workOrder.id);

      // Both should be in REVIEW
      expect(workOrderService.get(req1.workOrder.id)!.state).toBe('REVIEW');
      expect(workOrderService.get(req2.workOrder.id)!.state).toBe('REVIEW');
    });
  });

  describe('Agent Constraints', () => {
    it('Mira should enforce routing constraints', () => {
      const agent = agentRegistryService.getAgent('mira')!;
      expect(agent.constraints).toContain('Never bypass work order protocol.');
      expect(agent.constraints).toContain('Maintain deterministic routing rules.');
    });

    it('Eva should enforce compliance constraints', () => {
      const agent = agentRegistryService.getAgent('eva')!;
      expect(agent.constraints).toContain('Never allow bypass of critical policy checks.');
      expect(agent.constraints).toContain('Escalate violations immediately.');
    });

    it('Julia should enforce architectural constraints', () => {
      const agent = agentRegistryService.getAgent('julia')!;
      expect(agent.constraints).toContain('Never approve architecturally unsound decisions.');
      expect(agent.constraints).toContain('Enforce clean architecture layer boundaries.');
    });
  });
});
