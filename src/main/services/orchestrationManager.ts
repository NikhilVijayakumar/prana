/**
 * OrchestrationManager - Federated Multi-Agent Orchestration
 *
 * Synthesizes patterns from:
 * - OpenClaw: Intent classification + persona routing
 * - NemoClaw: Protocol enforcement + compliance gating
 * - Goose: Failure recovery + step validation
 *
 * Responsibility:
 * 1. Accept Director intent (natural language)
 * 2. Classify priority (CRITICAL/URGENT/IMPORTANT/ROUTINE)
 * 3. Auto-select target persona (Eva, Julia, Nora, etc.)
 * 4. Validate persona has required protocols
 * 5. Select appropriate workflow
 * 6. Delegate to selected agent via queue
 *
 * File: src/main/services/orchestrationManager.ts
 */

import { v4 as generateUUID } from 'uuid';
import { queueService } from './queueService';
import { auditLogService, AUDIT_ACTIONS } from './auditLogService';
import { registryRuntimeStoreService } from './registryRuntimeStoreService';
import { WorkOrderPriority } from './workOrderService';

/**
 * Represents a Director's natural-language intent
 * This is the entry point for the entire federated system
 */
export interface DirectorIntent {
  id: string; // UUID
  timestamp: string; // ISO 8601
  message: string; // Natural language input
  explicitTargetPersonaId?: string; // Optional override (e.g., "redirect to eva")
  sessionId: string; // Trace linkage
  metadata?: Record<string, any>; // Channel, user ID, etc.
}

/**
 * Enhanced WorkOrder with federated metadata
 */
export interface FederatedWorkOrder {
  id: string;
  directorIntentId: string;
  priority: WorkOrderPriority;
  targetPersonaId: string;
  targetWorkflowId?: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ESCALATED';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  failureReason?: string;
  auditTrailRef: string; // Parent audit transaction ID
}

/**
 * Persona definition (represents a specialized agent)
 */
export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  rank?: number; // 1-10 (10 = Director, 0 = System)
  constraints?: string[]; // Actions this agent CAN'T do
  approvedProtocols?: string[]; // Protocols this agent must follow
  approvedChannels?: string[]; // Communication channels allowed
  workflows?: string[]; // Workflow IDs this agent can execute
}

/**
 * Workflow definition (represents a repeatable process for a persona)
 */
export interface Workflow {
  id: string;
  personaId: string;
  title: string;
  description: string;
  applicablePriorities?: WorkOrderPriority[]; // Which priorities can use this workflow
  steps: WorkflowStep[];
  outputChannels?: string[]; // Where to route the result
  dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
}

/**
 * Individual step within a workflow
 */
export interface WorkflowStep {
  id: string;
  title: string;
  executionConfig: StepExecutionConfig;
}

/**
 * Configuration for a single step's execution (used by RecoveryService)
 */
export interface StepExecutionConfig {
  command: string;
  timeout_seconds?: number;
  success_checks?: SuccessCheck[];
  on_failure?: string;
  on_failure_timeout_seconds?: number;
  max_retries?: number;
  backoff_multiplier?: number;
}

/**
 * Success validation check (shell command or assertion)
 */
export interface SuccessCheck {
  type: 'shell' | 'assertion' | 'http_check';
  command?: string;
  assertion?: string;
  http_url?: string;
}

/**
 * Result of orchestration
 */
export interface OrchestrationResult {
  success: boolean;
  workOrderId: string;
  personaId: string;
  queuePosition?: number;
  message: string;
  auditTrailRef: string;
}

/**
 * Internal routing decision
 */
interface RoutingDecision {
  personaId: string;
  priority: WorkOrderPriority;
  confidence: number; // 0-100 (100 = explicit override, 80+ = keyword match, <50 = fallback)
  reason: string;
}

/**
 * The main orchestration service
 * Implements the "Best of 3" approach from OpenClaw + NemoClaw + Goose
 */
export class OrchestrationManager {
  private personaRegistry: Map<string, AgentPersona> = new Map();
  private workflowRegistry: Map<string, Workflow> = new Map();
  private lastRuntimeHydrationAt: number = 0;

  constructor() {
    this.initializePersonaRegistry();
    this.initializeWorkflowRegistry();
  }

  /**
    * Initialize built-in personas (10 virtual employees)
    * This is a safe fallback when approved runtime data is not yet present in SQLite.
   */
  private initializePersonaRegistry(): void {
    const personas: AgentPersona[] = [
      {
        id: 'arya',
        name: 'Arya Vestergaard',
        role: 'CEO - Strategic Alignment',
        rank: 8,
        constraints: ['Cannot execute technical tasks', 'Cannot approve contracts alone'],
        approvedProtocols: ['strategic-alignment-protocol', 'communication-style'],
        approvedChannels: ['internal-chat'],
        workflows: ['strategic-alignment-workflow'],
      },
      {
        id: 'eva',
        name: 'Eva',
        role: 'Compliance Officer & Chief Gatekeeper',
        rank: 9,
        constraints: ['Cannot approve expenditure', 'Cannot deploy code', 'Cannot override protocols alone'],
        approvedProtocols: [
          'audit-trail-integrity-protocol',
          'security-protocol',
          'compliance-gate-protocol',
          'privacy-by-design-protocol',
        ],
        approvedChannels: ['internal-chat', 'audit-trail'],
        workflows: ['protocol-validation-workflow', 'compliance-audit-workflow'],
      },
      {
        id: 'julia',
        name: 'Julia',
        role: 'CTO - Engineering Leadership',
        rank: 7,
        constraints: ['Cannot approve expenditure > 100k', 'Cannot hire staff'],
        approvedProtocols: ['clean-architecture-gate-protocol', 'technical-debt-threshold-protocol'],
        approvedChannels: ['internal-chat'],
        workflows: ['code-deploy-workflow', 'system-architecture-workflow'],
      },
      {
        id: 'nora',
        name: 'Nora',
        role: 'CFO - Financial Operations',
        rank: 7,
        constraints: ['Cannot override security protocols', 'Cannot make hiring decisions'],
        approvedProtocols: ['capital-allocation-protocol', 'self-healing-budget-protocol'],
        approvedChannels: ['internal-chat'],
        workflows: ['budget-allocation-workflow', 'financial-forecast-workflow'],
      },
      {
        id: 'sofia',
        name: 'Sofia',
        role: 'Design Lead - Visual & UX',
        rank: 6,
        constraints: ['Cannot approve budget', 'Cannot make technical decisions'],
        approvedProtocols: ['visual-token-governance-protocol', 'brand-consistency-audit-protocol'],
        approvedChannels: ['internal-chat'],
        workflows: ['design-system-workflow', 'accessibility-audit-workflow'],
      },
      {
        id: 'lina',
        name: 'Lina',
        role: 'HR Lead - People Operations',
        rank: 6,
        constraints: ['Cannot approve expenditure alone', 'Cannot make engineering decisions'],
        approvedProtocols: ['onboarding-sequencing-protocol', 'competency-calibration-protocol'],
        approvedChannels: ['internal-chat'],
        workflows: ['hiring-workflow', 'onboarding-workflow'],
      },
      {
        id: 'mira',
        name: 'Mira',
        role: 'Secretary & Command Router',
        rank: 5,
        constraints: ['Cannot approve anything', 'Cannot override routing decisions'],
        approvedProtocols: ['communication-style', 'intent-parsing-protocol'],
        approvedChannels: ['internal-chat', 'telegram'],
        workflows: ['command-routing-workflow', 'brief-composition-workflow'],
      },
      {
        id: 'elina',
        name: 'Elina',
        role: 'Operations Manager - Execution Excellence',
        rank: 5,
        constraints: ['Cannot make strategy decisions', 'Cannot override Eva'],
        approvedProtocols: ['operational-integrity-protocol', 'queue-prioritization-protocol'],
        approvedChannels: ['internal-chat'],
        workflows: ['workflow-execution-workflow', 'escalation-management-workflow'],
      },
      {
        id: 'dani',
        name: 'Dani',
        role: 'Data Lead - Analytics & Insights',
        rank: 6,
        constraints: ['Cannot make operational decisions', 'Cannot approve budget'],
        approvedProtocols: ['privacy-by-design-protocol', 'ephemeral-analytics-generation-protocol'],
        approvedChannels: ['internal-chat'],
        workflows: ['analytics-generation-workflow', 'reporting-workflow'],
      },
      {
        id: 'maya',
        name: 'Maya',
        role: 'Product Manager - Feature Excellence',
        rank: 6,
        constraints: ['Cannot override technical decisions', 'Cannot approve budget alone'],
        approvedProtocols: ['product-track-separation-protocol', 'launch-sequencing-protocol'],
        approvedChannels: ['internal-chat'],
        workflows: ['product-launch-workflow', 'feature-prioritization-workflow'],
      },
    ];

    personas.forEach(p => this.personaRegistry.set(p.id, p));
  }

  /**
   * Initialize workflow registry
   * Runtime-approved workflows are loaded from SQLite at execution time.
   */
  private initializeWorkflowRegistry(): void {
    // Intentionally empty for bootstrap. Runtime workflows are loaded from SQLite.
  }

  /**
   * Refresh registry from approved runtime state in SQLite.
   * Throttled to avoid hitting disk on every call.
   */
  private async hydrateRuntimeRegistry(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastRuntimeHydrationAt < 5_000) {
      return;
    }

    const runtimePersonas = await registryRuntimeStoreService.listRuntimePersonas();
    if (runtimePersonas.length > 0) {
      this.personaRegistry.clear();
      runtimePersonas.forEach((persona) => {
        this.personaRegistry.set(persona.id, {
          id: persona.id,
          name: persona.name,
          role: persona.role,
          constraints: persona.constraints,
          approvedProtocols: persona.approvedProtocols,
          approvedChannels: persona.approvedChannels,
          workflows: persona.workflows,
        });
      });
    }

    const runtimeWorkflows = await registryRuntimeStoreService.listRuntimeWorkflows();
    if (runtimeWorkflows.length > 0) {
      this.workflowRegistry.clear();
      runtimeWorkflows.forEach((workflow) => {
        this.workflowRegistry.set(workflow.id, {
          id: workflow.id,
          personaId: workflow.personaId,
          title: workflow.title,
          description: workflow.description,
          steps: [],
        });
      });
    }

    this.lastRuntimeHydrationAt = now;
  }

  async reloadFromRuntimeStore(): Promise<void> {
    await this.hydrateRuntimeRegistry(true);
  }

  /**
   * MAIN ENTRY POINT: Process Director intent and orchestrate execution
   *
   * Algorithm:
   * 1. Accept Director intent
   * 2. Classify priority
   * 3. Select target persona
   * 4. Select appropriate workflow
   * 5. Validate security/compliance
   * 6. Enqueue work order
   */
  async orchestrateIntent(intent: DirectorIntent): Promise<OrchestrationResult> {
    await this.hydrateRuntimeRegistry();

    // Step 1: Log the intent arrival
    const intentAuditRef = await auditLogService.createTransaction(AUDIT_ACTIONS.INTENT_RECEIVED, {
      intentId: intent.id,
      message: intent.message.substring(0, 100), // First 100 chars only for audit
      correlationId: intent.id,
    });

    try {
      // Step 2: Classify priority (deterministic regex-based)
      const priority = this.determinePriority(intent.message);

      // Step 3: Select target persona (deterministic keyword-based)
      const routingDecision = this.selectTargetPersona(intent);
      const personaId = routingDecision.personaId;

      // Step 4: Validate persona exists and has required protocols
      const persona = this.personaRegistry.get(personaId);
      if (!persona) {
        throw new Error(`Persona not found: ${personaId}`);
      }

      // Step 5: Select appropriate workflow for this persona + priority
      const workflowId = await this.selectWorkflow(personaId, priority);

      // Step 6: Create federated work order
      const workOrder = this.createFederatedWorkOrder(
        intent.id,
        priority,
        personaId,
        workflowId,
        intentAuditRef
      );

      // Step 7: Log routing decision
      await auditLogService.appendTransaction(AUDIT_ACTIONS.INTENT_ROUTED, {
        intentId: intent.id,
        personaId,
        priority,
        workflowId,
        routingConfidence: routingDecision.confidence,
        routingReason: routingDecision.reason,
        parentTxnId: intentAuditRef,
        correlationId: intent.id,
      });

      // Step 8: Enqueue work order via existing queue service
      const queueResult = this.enqueueWorkOrder(workOrder);

      if (!queueResult.queueAccepted) {
        throw new Error(`Queue full: ${queueResult.queueReason}`);
      }

      // Step 9: Log successful orchestration
      await auditLogService.appendTransaction(AUDIT_ACTIONS.WORK_ORDER_CREATED, {
        workOrderId: workOrder.id,
        personaId,
        queueEntryId: queueResult.queueEntryId,
        parentTxnId: intentAuditRef,
        correlationId: intent.id,
      });

      return {
        success: true,
        workOrderId: workOrder.id,
        personaId,
        queuePosition: this.getQueuePosition(workOrder.id),
        message: `Work order routed to ${persona.name} (${persona.role})`,
        auditTrailRef: workOrder.auditTrailRef,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Log failure
      await auditLogService.appendTransaction(AUDIT_ACTIONS.ORCHESTRATION_FAILED, {
        intentId: intent.id,
        error: errorMsg,
        parentTxnId: intentAuditRef,
        correlationId: intent.id,
      });

      return {
        success: false,
        workOrderId: 'ERROR',
        personaId: 'system',
        message: `Orchestration failed: ${errorMsg}`,
        auditTrailRef: intentAuditRef,
      };
    }
  }

  /**
   * Algorithm: Classify intent priority (OpenClaw pattern)
   * Uses deterministic regex matching, not ML confidence
   *
   * Returns: CRITICAL | URGENT | IMPORTANT | ROUTINE
   */
  private determinePriority(message: string): WorkOrderPriority {
    const normalized = message.toLowerCase();

    if (/(critical|p0|breach|outage|security|urgent-security|crisis|emergency)/.test(normalized)) {
      return 'CRITICAL';
    }

    if (/(urgent|asap|today|high\s+priority|immediately|blocking)/.test(normalized)) {
      return 'URGENT';
    }

    if (/(important|review|investigate|follow\s+up|analyze|audit)/.test(normalized)) {
      return 'IMPORTANT';
    }

    return 'ROUTINE';
  }

  /**
   * Algorithm: Select target persona (OpenClaw pattern)
   * Uses deterministic keyword-based routing
   *
   * Returns: { personaId, priority, confidence, reason }
   */
  private selectTargetPersona(intent: DirectorIntent): RoutingDecision {
    // Explicit override?
    if (intent.explicitTargetPersonaId) {
      return {
        personaId: intent.explicitTargetPersonaId,
        priority: this.determinePriority(intent.message),
        confidence: 100, // Explicit override = 100% confidence
        reason: 'Explicit target specified by Director',
      };
    }

    const msg = intent.message.toLowerCase();

    // Keyword-based routing (deterministic)
    const routes: [RegExp, string, string][] = [
      // [pattern, personaId, reason]
      [/(compliance|audit|policy|security|regulatory|gate|approval|protocol)/, 'eva', 'Compliance keyword detected'],
      [/(finance|budget|burn|runway|cash|ledger|allocation|funding|invoice|expense)/, 'nora', 'Finance keyword detected'],
      [/(tech|code|build|deploy|api|service|infrastructure|test|devops|database)/, 'julia', 'Technical keyword detected'],
      [/(design|ui|ux|visual|token|contrast|accessibility|component|theme)/, 'sofia', 'Design keyword detected'],
      [/(hire|interview|candidate|onboard|hr|recruiting|staff)/, 'lina', 'HR keyword detected'],
      [/(executive|strategy|alignment|governance|decision|sync|milestone)/, 'arya', 'Strategic keyword detected'],
      [/(data|analytics|report|insight|metric|dashboard|query)/, 'dani', 'Analytics keyword detected'],
      [/(product|feature|launch|prioritization|roadmap)/, 'maya', 'Product keyword detected'],
      [/(ops|operations|execution|workflow|task|process)/, 'elina', 'Ops keyword detected'],
    ];

    for (const [pattern, personaId, reason] of routes) {
      if (pattern.test(msg)) {
        return {
          personaId,
          priority: this.determinePriority(intent.message),
          confidence: 85, // Keyword match = 85% confidence
          reason,
        };
      }
    }

    // Fallback to Mira (Secretary & default router)
    return {
      personaId: 'mira',
      priority: this.determinePriority(intent.message),
      confidence: 50, // No keyword match = default fallback
      reason: 'No specific keyword detected; routing to Secretary for triage',
    };
  }

  /**
   * Algorithm: Select appropriate workflow for persona + priority
   *
   * Steps:
   * 1. Load all workflows available for this persona
   * 2. Filter by priority compatibility
   * 3. Return best match or raise error if none available
   */
  private async selectWorkflow(personaId: string, priority: WorkOrderPriority): Promise<string | undefined> {
    await this.hydrateRuntimeRegistry();

    const persona = this.personaRegistry.get(personaId);
    if (!persona || !persona.workflows || persona.workflows.length === 0) {
      // No specific workflow; system will use default execution path
      return undefined;
    }

    for (const workflowId of persona.workflows) {
      const workflow = this.workflowRegistry.get(workflowId);
      if (!workflow) {
        continue;
      }
      if (!workflow.applicablePriorities || workflow.applicablePriorities.length === 0) {
        return workflow.id;
      }
      if (workflow.applicablePriorities.includes(priority)) {
        return workflow.id;
      }
    }

    return persona.workflows[0];
  }

  /**
   * Create a federated work order with all necessary metadata
   */
  private createFederatedWorkOrder(
    directorIntentId: string,
    priority: WorkOrderPriority,
    personaId: string,
    workflowId: string | undefined,
    auditTrailRef: string
  ): FederatedWorkOrder {
    return {
      id: generateUUID(),
      directorIntentId,
      priority,
      targetPersonaId: personaId,
      targetWorkflowId: workflowId,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
      auditTrailRef,
    };
  }

  /**
   * Enqueue work order via queue service
   * Uses existing queueService infrastructure
   */
  private enqueueWorkOrder(
    workOrder: FederatedWorkOrder
  ): { queueAccepted: boolean; queueReason: 'ok' | 'queue_full' | 'crisis_reserve'; queueEntryId: string | null } {
    const result = queueService.enqueue(workOrder.id, workOrder.priority);

    return {
      queueAccepted: result.accepted,
      queueReason: result.reason,
      queueEntryId: result.entry?.id || null,
    };
  }

  /**
   * Get current queue position for a work order
   */
  private getQueuePosition(_workOrderId: string): number | undefined {
    // Would query queueService for position
    // Placeholder: return undefined for now
    return undefined;
  }

  /**
   * Get a persona's profile (for UI/debugging)
   */
  getPersona(personaId: string): AgentPersona | undefined {
    return this.personaRegistry.get(personaId);
  }

  /**
   * List all available personas
   */
  listPersonas(): AgentPersona[] {
    return Array.from(this.personaRegistry.values());
  }

  /**
   * Validate that a persona can perform a specific action
   * Used by ProtocolInterceptor to enforce constraints
   */
  isActionAllowedForPersona(personaId: string, action: string): boolean {
    const persona = this.personaRegistry.get(personaId);
    if (!persona || !persona.constraints) {
      return true; // No constraints = all actions allowed
    }

    // Check if action matches any constraint
    return !persona.constraints.some(constraint => action.toLowerCase().includes(constraint.toLowerCase()));
  }
}

// Singleton instance
export const orchestrationManager = new OrchestrationManager();
