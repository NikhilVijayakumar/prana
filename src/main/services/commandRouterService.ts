import { queueService } from './queueService';
import {
  DirectorFeedbackRequest,
  WorkOrderPriority,
  WorkOrderRecord,
  workOrderService,
} from './workOrderService';
import { agentExecutionService } from './agentExecutionService';
import { agentRegistryService } from './agentRegistryService';

export interface RoutedRequestResult {
  workOrder: WorkOrderRecord;
  queueEntryId: string | null;
  queueAccepted: boolean;
  queueReason: 'ok' | 'queue_full' | 'crisis_reserve';
}

export interface ProcessedWorkOrderResult {
  workOrder: WorkOrderRecord;
  queueEntryId: string | null;
  progressedStates: Array<'EXECUTING' | 'SYNTHESIS' | 'REVIEW'>;
}

const determinePriority = (message: string): WorkOrderPriority => {
  const normalized = message.toLowerCase();
  if (/(critical|p0|urgent-security|breach|outage)/.test(normalized)) {
    return 'CRITICAL';
  }

  if (/(urgent|asap|today|high)/.test(normalized)) {
    return 'URGENT';
  }

  if (/(important|review|investigate|follow up)/.test(normalized)) {
    return 'IMPORTANT';
  }

  return 'ROUTINE';
};

const determineTargetEmployee = (request: DirectorFeedbackRequest): string => {
  if (request.targetEmployeeId && request.targetEmployeeId.trim()) {
    return request.targetEmployeeId.trim();
  }

  const normalized = `${request.moduleRoute} ${request.message}`.toLowerCase();

  if (/(compliance|audit|policy|regulatory)/.test(normalized)) {
    return 'eva';
  }
  if (/(fund|runway|burn|finance|budget|cfo)/.test(normalized)) {
    return 'nora';
  }
  if (/(hiring|candidate|hr|onboard)/.test(normalized)) {
    return 'lina';
  }
  if (/(design|ui|ux|token|contrast)/.test(normalized)) {
    return 'sofia';
  }
  if (/(tech|code|build|deploy|model|gateway)/.test(normalized)) {
    return 'julia';
  }

  return 'mira';
};

const isBroadCommand = (request: DirectorFeedbackRequest): boolean => {
  const normalized = `${request.moduleRoute} ${request.message}`.toLowerCase();
  return /(launch|campaign|program|initiative|cross-functional|cross functional|global workflow|orchestrate)/.test(normalized);
};

const GLOBAL_COLLABORATION_REQUIRED_AGENTS = ['mira', 'dani', 'sofia', 'eva', 'nora', 'elina'];

export const commandRouterService = {
  submitDirectorRequest(request: DirectorFeedbackRequest): RoutedRequestResult {
    const priority = determinePriority(request.message);
    const broadCommand = isBroadCommand(request);
    const targetEmployeeId = broadCommand ? 'mira' : determineTargetEmployee(request);

    const workOrder = workOrderService.create({
      moduleRoute: request.moduleRoute,
      message: request.message,
      targetEmployeeId,
      priority,
    });

    const planned = workOrderService.updateState(workOrder.id, 'PLANNED') ?? workOrder;

    if (broadCommand) {
      const unavailableAgents = GLOBAL_COLLABORATION_REQUIRED_AGENTS.filter((agentId) => !agentRegistryService.isImplemented(agentId));

      workOrderService.attachGlobalWorkflow(planned.id, 'product-campaign-global-collaboration');

      if (unavailableAgents.length > 0) {
        const blocked = workOrderService.setWaitingOnRole(planned.id, 'onboarding-registry-approval') ?? planned;
        return {
          workOrder: workOrderService.updateState(blocked.id, 'WAITING', {
            error: `global_workflow_blocked_missing_roles:${unavailableAgents.join(',')}`,
          }) ?? blocked,
          queueEntryId: null,
          queueAccepted: false,
          queueReason: 'crisis_reserve',
        };
      }

      workOrderService.addInternalMemo(planned.id, {
        fromAgentId: 'mira',
        toAgentId: 'dani',
        memoType: 'HANDOFF',
        priority,
        message: 'Director broad command received. Begin strategy intake for collaborative workflow.',
        contextPacket: {
          objective: request.message,
          moduleRoute: request.moduleRoute,
          workflowId: 'product-campaign-global-collaboration',
        },
      });

      workOrderService.addHandshake(planned.id, {
        fromAgentId: 'mira',
        toAgentId: 'dani',
        transferPointId: 'secretary-to-analyst',
        contextPacket: {
          objective: request.message,
          source: 'director',
        },
      });

      workOrderService.setWaitingOnRole(planned.id, 'dani');
    }

    const queue = queueService.enqueue(planned.id, planned.priority);

    if (queue.accepted && queue.entry) {
      const queued = workOrderService.updateState(planned.id, 'QUEUED') ?? planned;
      return {
        workOrder: queued,
        queueEntryId: queue.entry.id,
        queueAccepted: true,
        queueReason: queue.reason,
      };
    }

    const init = workOrderService.updateState(planned.id, 'INIT', { error: `queue_${queue.reason}` }) ?? planned;
    return {
      workOrder: init,
      queueEntryId: null,
      queueAccepted: false,
      queueReason: queue.reason,
    };
  },

  startNext(): RoutedRequestResult | null {
    const running = queueService.startNext();
    if (!running) {
      return null;
    }

    const workOrder = workOrderService.updateState(running.workOrderId, 'EXECUTING');
    if (!workOrder) {
      return null;
    }

    return {
      workOrder,
      queueEntryId: running.id,
      queueAccepted: true,
      queueReason: 'ok',
    };
  },

  complete(workOrderId: string, summary?: string): WorkOrderRecord | null {
    const workOrder = workOrderService.updateState(workOrderId, 'COMPLETED', { summary });
    if (!workOrder) {
      return null;
    }

    const queueEntry = queueService.findByWorkOrderId(workOrderId);
    if (queueEntry && queueEntry.status === 'RUNNING') {
      queueService.complete(queueEntry.id);
    }

    return workOrder;
  },

  fail(workOrderId: string, error?: string): WorkOrderRecord | null {
    const workOrder = workOrderService.updateState(workOrderId, 'FAILED', { error });
    if (!workOrder) {
      return null;
    }

    const queueEntry = queueService.findByWorkOrderId(workOrderId);
    if (queueEntry && queueEntry.status === 'RUNNING') {
      queueService.fail(queueEntry.id);
    }

    return workOrder;
  },

  processNextToReview(): ProcessedWorkOrderResult | null {
    const started = this.startNext();
    if (!started) {
      return null;
    }

    const progressedStates: Array<'EXECUTING' | 'SYNTHESIS' | 'REVIEW'> = ['EXECUTING'];

    // Execute the agent asynchronously
    (async () => {
      const agent = agentRegistryService.getAgent(started.workOrder.targetEmployeeId);
      if (agent && agentRegistryService.isImplemented(started.workOrder.targetEmployeeId)) {
        try {
          const outcome = await agentExecutionService.executeAgent(agent, started.workOrder.id);
          if (outcome.success) {
            // Update with agent synthesis
            workOrderService.updateState(started.workOrder.id, 'SYNTHESIS', {
              summary: outcome.result.synthesis,
            });
          } else {
            workOrderService.updateState(started.workOrder.id, 'FAILED', {
              error: outcome.message,
            });
          }
        } catch (error) {
          console.error('Agent execution failed:', error);
        }
      } else {
        // Fallback: generic synthesis if agent not implemented
        workOrderService.updateState(started.workOrder.id, 'SYNTHESIS', {
          summary: `Synthesis prepared for ${started.workOrder.targetEmployeeId.toUpperCase()} in ${started.workOrder.moduleRoute}.`,
        });
      }
    })();

    const synthesis = workOrderService.updateState(started.workOrder.id, 'SYNTHESIS', {
      summary: `Synthesis prepared for ${started.workOrder.targetEmployeeId.toUpperCase()} in ${started.workOrder.moduleRoute}.`,
    });

    if (!synthesis) {
      return null;
    }
    progressedStates.push('SYNTHESIS');

    const review = workOrderService.updateState(synthesis.id, 'REVIEW', {
      summary: synthesis.summary ?? undefined,
    });

    if (!review) {
      return null;
    }
    progressedStates.push('REVIEW');

    if (started.queueEntryId) {
      queueService.complete(started.queueEntryId);
    }

    return {
      workOrder: review,
      queueEntryId: started.queueEntryId,
      progressedStates,
    };
  },

  approve(workOrderId: string, summary?: string): WorkOrderRecord | null {
    return workOrderService.updateState(workOrderId, 'APPROVED', { summary });
  },

  reject(workOrderId: string, error?: string): WorkOrderRecord | null {
    return workOrderService.updateState(workOrderId, 'REJECTED', { error });
  },
};
