/**
 * ProtocolInterceptor - NemoClaw-Style Security Enforcement
 *
 * Acts as a middleware that intercepts ALL agent execution requests
 * and validates them against:
 * 1. Agent role-based access control (RBAC)
 * 2. Data classification policies
 * 3. Communication channel restrictions
 * 4. Global security protocols
 * 5. Hard constraints (e.g., "Eva cannot deploy code")
 *
 * Philosophy:
 * - BLOCK dangerous actions (better false positive than security breach)
 * - ESCALATE edge cases to Eva (compliance officer)
 * - LOG everything (immutable audit trail)
 * - NO silent failures (always inform Director/Eva)
 *
 * File: src/main/services/protocolInterceptor.ts
 */

import { v4 as generateUUID } from 'uuid';
import { auditLogService, AUDIT_ACTIONS } from './auditLogService';
import { orchestrationManager } from './orchestrationManager';
import { queueService } from './queueService';
import { registryRuntimeStoreService } from './registryRuntimeStoreService';
import {
  Protocol,
  ProtocolRule,
  ProtocolViolation,
  InterceptionAction,
  InterceptionContext,
  InterceptionResult,
  WorkOrderPriority,
} from './types/orchestrationTypes';

/**
 * Represents agent constraints (loaded from registry)
 */
interface AgentConstraints {
  personaId: string;
  role: string;
  constraints: string[]; // Things agent CAN'T do
  canApproveUpTo?: string; // Approval authority level
  approvedProtocols: string[];
  approvedChannels: string[];
}

/**
 * ProtocolInterceptor: The "Eva" gatekeeper for all agent actions
 *
 * Main algorithm (4-stage security pipeline):
 * 1. Auth & Authorization: Verify agent identity + role
 * 2. Input Validation: Check data classification + PII
 * 3. Constraint Enforcement: Verify agent can perform action
 * 4. Protocol Compliance: Cross-check against registered protocols
 */
export class ProtocolInterceptor {
  private protocolRegistry: Map<string, Protocol> = new Map();
  private violationLog: ProtocolViolation[] = [];
  private lastRuntimeProtocolHydrationAt: number = 0;

  constructor() {
    this.initializeProtocols();
  }

  /**
   * Initialize built-in protocols (loaded from src/core/registry/protocols/)
    * Runtime-approved protocol IDs are additionally loaded from SQLite.
   */
  private initializeProtocols(): void {
    const protocols: Protocol[] = [
      {
        id: 'rbac-protocol',
        title: 'Role-Based Access Control',
        description: 'Ensures agents only perform actions within their role scope',
        rules: [
          {
            id: 'eva-cannot-deploy',
            type: 'rbac_check',
            description: 'Compliance officer (Eva) cannot deploy code',
            config: {
              personaId: 'eva',
              forbiddenActions: ['deploy', 'push', 'merge'],
              severity: 'CRITICAL',
              violationAction: 'block',
            },
          },
          {
            id: 'eva-cannot-approve-budget',
            type: 'rbac_check',
            description: 'Compliance officer (Eva) cannot approve expenditures',
            config: {
              personaId: 'eva',
              forbiddenActions: ['approve_budget', 'allocate_funds', 'sign_contract'],
              severity: 'CRITICAL',
              violationAction: 'block',
            },
          },
          {
            id: 'julia-cannot-approve-budget',
            type: 'rbac_check',
            description: 'CTO (Julia) cannot approve large expenditures alone',
            config: {
              personaId: 'julia',
              forbiddenActions: ['approve_budget_over_100k'],
              severity: 'HIGH',
              violationAction: 'escalate',
            },
          },
          {
            id: 'mira-cannot-approve-anything',
            type: 'rbac_check',
            description: 'Secretary (Mira) cannot approve anything',
            config: {
              personaId: 'mira',
              forbiddenActions: ['.*_approval', '.*_approval', 'approve_.*'],
              severity: 'CRITICAL',
              violationAction: 'block',
            },
          },
        ],
      },
      {
        id: 'data-classification-protocol',
        title: 'Data Classification & Sensitivity',
        description: 'Controls which providers can access which data levels',
        rules: [
          {
            id: 'restricted-data-local-only',
            type: 'data_classification_check',
            description: 'RESTRICTED data (PII, keys) must stay on local LM Studio',
            config: {
              allowedClassifications: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
              forbiddenClassifications: ['RESTRICTED'],
              allowedProviders: ['lmstudio'],
              severity: 'CRITICAL',
              violationAction: 'block',
            },
          },
          {
            id: 'confidential-data-cloud-caution',
            type: 'data_classification_check',
            description: 'CONFIDENTIAL data requires explicit approval before cloud transmission',
            config: {
              classificationLevel: 'CONFIDENTIAL',
              requiresApprovalFor: ['openrouter', 'gemini'],
              severity: 'HIGH',
              violationAction: 'escalate',
            },
          },
        ],
      },
      {
        id: 'channel-protocol',
        title: 'Communication Channel Control',
        description: 'Runtime onboarding policy defines channel access for all agents',
        rules: [],
      },
    ];

    protocols.forEach(p => this.protocolRegistry.set(p.id, p));
  }

  private async hydrateRuntimeProtocols(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastRuntimeProtocolHydrationAt < 5_000) {
      return;
    }

    const runtimeProtocolIds = await registryRuntimeStoreService.listRuntimeProtocolIds();
    for (const protocolId of runtimeProtocolIds) {
      if (this.protocolRegistry.has(protocolId)) {
        continue;
      }

      this.protocolRegistry.set(protocolId, {
        id: protocolId,
        title: protocolId,
        description: 'Runtime-approved protocol loaded from SQLite registry cache',
        rules: [],
      });
    }

    this.lastRuntimeProtocolHydrationAt = now;
  }

  /**
   * MAIN ENTRY POINT: Intercept and validate agent action
   *
   * Returns:
   * - action: ALLOW | WARN | BLOCK | ESCALATE_TO_EVA
   * - violations: List of all violations detected
   * - recommendations: Suggestions for remediation
   */
  async interceptAndValidate(context: InterceptionContext): Promise<InterceptionResult> {
    await this.hydrateRuntimeProtocols();
    await orchestrationManager.reloadFromRuntimeStore();

    const violations: ProtocolViolation[] = [];

    // Step 1: Load agent constraints
    const constraints = await this.loadAgentConstraints(context.agentId);

    // Step 2: Run hardcoded constraint checks (e.g., "Eva cannot deploy")
    for (const constraint of constraints.constraints) {
      const violation = this.checkConstraint(constraint, context, constraints);
      if (violation) {
        violations.push(violation);
      }
    }

    // Step 3: Run protocol-based checks
    for (const protocol of this.protocolRegistry.values()) {
      for (const rule of protocol.rules) {
        const violation = await this.validateRule(rule, context, constraints);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    const runtimeChannelViolation = await this.validateRuntimeChannelPolicy(context);
    if (runtimeChannelViolation) {
      violations.push(runtimeChannelViolation);
    }

    // Step 4: Determine final action
    const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
    const escalateViolations = violations.filter(v => v.action === 'escalate');
    const warnViolations = violations.filter(v => v.action === 'warn');

    let action: InterceptionAction;

    if (criticalViolations.length > 0) {
      action = InterceptionAction.BLOCK;
      await auditLogService.appendTransaction(AUDIT_ACTIONS.PROTOCOL_VIOLATION_CRITICAL, {
        workOrderId: context.workOrderId,
        agentId: context.agentId,
        violationCount: criticalViolations.length,
        violations: criticalViolations.map(v => v.ruleId).join(', '),
        correlationId: context.workOrderId,
      });
    } else if (escalateViolations.length > 0) {
      action = InterceptionAction.ESCALATE_TO_EVA;
      await this.escalateToEva(context, escalateViolations);
      await auditLogService.appendTransaction(AUDIT_ACTIONS.PROTOCOL_ESCALATION_INITIATED, {
        workOrderId: context.workOrderId,
        agentId: context.agentId,
        violationCount: escalateViolations.length,
        escalatedTo: 'eva',
        correlationId: context.workOrderId,
      });
    } else if (warnViolations.length > 0) {
      action = InterceptionAction.WARN;
      await auditLogService.appendTransaction(AUDIT_ACTIONS.PROTOCOL_VIOLATION_WARN, {
        workOrderId: context.workOrderId,
        agentId: context.agentId,
        violationCount: warnViolations.length,
        correlationId: context.workOrderId,
      });
    } else {
      action = InterceptionAction.ALLOW;
      await auditLogService.appendTransaction(AUDIT_ACTIONS.PROTOCOL_VALIDATION_PASSED, {
        workOrderId: context.workOrderId,
        agentId: context.agentId,
        protocolsChecked: this.protocolRegistry.size,
        correlationId: context.workOrderId,
      });
    }

    // Log all violations
    violations.forEach(v => this.violationLog.push(v));

    return {
      action,
      violations,
    };
  }

  /**
   * Algorithm: Check hard constraint against action
   *
   * Example: Eva has constraint "Cannot deploy code"
   * If action involves "deploy", => violation
   */
  private checkConstraint(
    constraint: string,
    context: InterceptionContext,
    _agentConstraints: AgentConstraints
  ): ProtocolViolation | null {
    // Simple pattern matching: if constraint keywords appear in workflow/action
    // This is a placeholder; real implementation would parse constraints more rigorously

    const constraintKeywords = constraint.toLowerCase().split(' ');
    const contextStr = `${context.workflowId} ${context.inputData?.action ?? ''}`.toLowerCase();

    const matches = constraintKeywords.some(keyword => contextStr.includes(keyword));

    if (!matches) {
      return null; // No violation
    }

    return {
      id: generateUUID(),
      severity: 'CRITICAL',
      ruleId: `agent-constraint-${context.agentId}`,
      description: `Agent constraint violated: "${constraint}"`,
      action: 'block',
      timestamp: new Date().toISOString(),
      agentId: context.agentId,
      workOrderId: context.workOrderId,
      violationDetails: {
        constraint,
        contextAction: context.inputData?.action,
      },
    };
  }

  /**
   * Algorithm: Validate a single protocol rule
   */
  private async validateRule(
    rule: ProtocolRule,
    context: InterceptionContext,
    constraints: AgentConstraints
  ): Promise<ProtocolViolation | null> {
    switch (rule.type) {
      case 'rbac_check':
        return this.validateRBACRule(rule, context, constraints);

      case 'data_classification_check':
        return this.validateDataClassificationRule(rule, context);

      case 'channel_check':
        return this.validateChannelRule(rule, context, constraints);

      default:
        return null;
    }
  }

  /**
   * Validate RBAC (Role-Based Access Control) rule
   */
  private validateRBACRule(
    rule: ProtocolRule,
    context: InterceptionContext,
    constraints: AgentConstraints
  ): ProtocolViolation | null {
    const config = rule.config as any;

    // If rule is specific to a persona and we're NOT that persona, skip
    if (config.personaId && config.personaId !== context.agentId) {
      return null;
    }

    // Check if this action is forbidden for this persona
    const forbiddenActions = config.forbiddenActions || [];
    const actionStr = context.inputData?.action || '';

    for (const forbidden of forbiddenActions) {
      // Support simple regex patterns like "approve.*"
      const pattern = new RegExp(forbidden, 'i');
      if (pattern.test(actionStr)) {
        return {
          id: generateUUID(),
          severity: config.severity || 'HIGH',
          ruleId: rule.id,
          description: rule.description,
          action: config.violationAction || 'block',
          timestamp: new Date().toISOString(),
          agentId: context.agentId,
          workOrderId: context.workOrderId,
          violationDetails: {
            forbiddenAction: forbidden,
            attemptedAction: actionStr,
            personaRole: constraints.role,
          },
        };
      }
    }

    return null;
  }

  /**
   * Validate data classification rule
   */
  private validateDataClassificationRule(
    rule: ProtocolRule,
    context: InterceptionContext
  ): ProtocolViolation | null {
    const config = rule.config as any;
    const dataClass = context.dataClassification || 'PUBLIC';

    // Check if data classification is forbidden
    const forbiddenClassifications = config.forbiddenClassifications || [];
    if (forbiddenClassifications.includes(dataClass)) {
      return {
        id: generateUUID(),
        severity: config.severity || 'CRITICAL',
        ruleId: rule.id,
        description: rule.description,
        action: config.violationAction || 'block',
        timestamp: new Date().toISOString(),
        agentId: context.agentId,
        workOrderId: context.workOrderId,
        violationDetails: {
          dataClassification: dataClass,
          forbiddenClassifications,
          reason: `Data classification "${dataClass}" requires local processing only`,
        },
      };
    }

    // If CONFIDENTIAL class, should check if approval is needed
    if (dataClass === 'CONFIDENTIAL' && config.requiresApprovalFor) {
      // In production, would check if Eva has pre-approved this
      // For now, just note it
    }

    return null;
  }

  /**
   * Validate channel availability rule
   */
  private validateChannelRule(
    rule: ProtocolRule,
    context: InterceptionContext,
    constraints: AgentConstraints
  ): ProtocolViolation | null {
    const config = rule.config as any;
    const requestedChannels = context.requestedChannels || [];

    // Check if any requested channel is forbidden
    const forbiddenChannels = config.forbiddenChannels || [];
    const blockedChannels = requestedChannels.filter(ch => forbiddenChannels.includes(ch));

    if (blockedChannels.length > 0) {
      return {
        id: generateUUID(),
        severity: config.severity || 'MEDIUM',
        ruleId: rule.id,
        description: rule.description,
        action: config.violationAction || 'warn',
        timestamp: new Date().toISOString(),
        agentId: context.agentId,
        workOrderId: context.workOrderId,
        violationDetails: {
          blockedChannels,
          allowedChannels: constraints.approvedChannels,
        },
      };
    }

    return null;
  }

  /**
   * Load agent's constraints from registry
   */
  private async loadAgentConstraints(personaId: string): Promise<AgentConstraints> {
    const runtimePersona = await registryRuntimeStoreService.getRuntimePersona(personaId);
    if (runtimePersona) {
      return {
        personaId,
        role: runtimePersona.role,
        constraints: runtimePersona.constraints,
        approvedProtocols: runtimePersona.approvedProtocols,
        approvedChannels: runtimePersona.approvedChannels,
      };
    }

    const persona = orchestrationManager.getPersona(personaId);

    if (!persona) {
      throw new Error(`Persona not found: ${personaId}`);
    }

    return {
      personaId,
      role: persona.role,
      constraints: persona.constraints || [],
      approvedProtocols: persona.approvedProtocols || [],
      approvedChannels: persona.approvedChannels || [],
    };
  }

  private async validateRuntimeChannelPolicy(context: InterceptionContext): Promise<ProtocolViolation | null> {
    const channelDetails = await registryRuntimeStoreService.getRuntimeChannelDetails();
    if (!channelDetails || (context.requestedChannels ?? []).length === 0) {
      return null;
    }

    const requestedChannels = (context.requestedChannels ?? []).map((channel) => channel.toLowerCase());
    const globallyAllowed = new Set(channelDetails.allowedChannels.map((channel) => channel.toLowerCase()));
    const agentAllowed = channelDetails.approvedAgentsForChannels[context.agentId.toLowerCase()] ?? [];
    const scopedAllowed = new Set(agentAllowed.map((channel) => channel.toLowerCase()));

    const globallyBlocked = requestedChannels.filter((channel) => globallyAllowed.size > 0 && !globallyAllowed.has(channel));
    if (globallyBlocked.length > 0) {
      return {
        id: generateUUID(),
        severity: 'WARNING',
        ruleId: 'runtime-channel-global-allowlist',
        description: 'Requested channels are outside approved onboarding channel scope',
        action: 'block',
        timestamp: new Date().toISOString(),
        agentId: context.agentId,
        workOrderId: context.workOrderId,
        violationDetails: {
          blockedChannels: globallyBlocked,
          allowedChannels: Array.from(globallyAllowed.values()),
          provider: channelDetails.provider,
        },
      };
    }

    if (scopedAllowed.size > 0) {
      const scopedBlocked = requestedChannels.filter((channel) => !scopedAllowed.has(channel));
      if (scopedBlocked.length > 0) {
        return {
          id: generateUUID(),
          severity: 'WARNING',
          ruleId: 'runtime-channel-agent-scope',
          description: 'Requested channels are not approved for this agent in onboarding runtime policy',
          action: 'block',
          timestamp: new Date().toISOString(),
          agentId: context.agentId,
          workOrderId: context.workOrderId,
          violationDetails: {
            blockedChannels: scopedBlocked,
            allowedChannels: Array.from(scopedAllowed.values()),
          },
        };
      }
    }

    return null;
  }

  /**
   * Escalate to Eva (Compliance Officer) for review
   */
  private async escalateToEva(
    context: InterceptionContext,
    violations: ProtocolViolation[]
  ): Promise<void> {
    // Create a work order for Eva to review
    const escalationWorkOrder = {
      id: generateUUID(),
      directorIntentId: 'ESCALATION_FROM_INTERCEPTOR',
      priority: 'URGENT' as WorkOrderPriority,
      targetPersonaId: 'eva',
      status: 'QUEUED' as const,
      createdAt: new Date().toISOString(),
      auditTrailRef: await auditLogService.createTransaction(AUDIT_ACTIONS.INTERCEPTION_ESCALATION, {
        originalWorkOrderId: context.workOrderId,
        agentId: context.agentId,
        violations: violations.map(v => v.ruleId).join(', '),
        correlationId: context.workOrderId,
      }),
    };

    // Enqueue it
    const queueResult = await queueService.enqueue(escalationWorkOrder.id, escalationWorkOrder.priority, {
      laneType: 'SYSTEM',
      taskType: 'protocol-escalation',
      payloadMeta: {
        escalationTargetPersona: 'eva',
        sourceWorkOrderId: context.workOrderId,
      },
      dedupeKey: `protocol-escalation:${context.workOrderId}`,
    });

    await auditLogService.appendTransaction(AUDIT_ACTIONS.ESCALATION_QUEUED, {
      workOrderId: context.workOrderId,
      escalationTargetPersona: 'eva',
      queueEntryId: queueResult.entry?.id,
      correlationId: context.workOrderId,
    });
  }

  /**
   * Get all violations logged so far
   */
  getViolationLog(): ProtocolViolation[] {
    return [...this.violationLog];
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(period: { startDate: string; endDate: string }): any {
    const periodViolations = this.violationLog.filter(v => {
      const vTime = new Date(v.timestamp).getTime();
      const startTime = new Date(period.startDate).getTime();
      const endTime = new Date(period.endDate).getTime();
      return vTime >= startTime && vTime <= endTime;
    });

    return {
      period,
      totalViolations: periodViolations.length,
      bySeverity: {
        critical: periodViolations.filter(v => v.severity === 'CRITICAL').length,
        warnings: periodViolations.filter(v => v.severity === 'WARNING').length,
        info: periodViolations.filter(v => v.severity === 'INFO').length,
      },
      byAction: {
        blocked: periodViolations.filter(v => v.action === 'block').length,
        escalated: periodViolations.filter(v => v.action === 'escalate').length,
        warned: periodViolations.filter(v => v.action === 'warn').length,
      },
    };
  }
}

// Singleton instance
export const protocolInterceptor = new ProtocolInterceptor();
