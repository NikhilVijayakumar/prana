export type WorkOrderPriority = 'CRITICAL' | 'URGENT' | 'IMPORTANT' | 'ROUTINE';

export type WorkOrderState =
  | 'INIT'
  | 'PLANNED'
  | 'QUEUED'
  | 'WAITING'
  | 'EXECUTING'
  | 'SYNTHESIS'
  | 'REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED';

export type InternalMemoType = 'RFI' | 'HANDOFF' | 'STATUS' | 'MILESTONE_REQUEST';

export interface WorkOrderInternalMemo {
  memoId: string;
  fromAgentId: string;
  toAgentId: string;
  memoType: InternalMemoType;
  priority: WorkOrderPriority;
  message: string;
  contextPacket: Record<string, unknown>;
  createdAt: string;
  resolvedAt: string | null;
}

export type WorkOrderHandshakeStatus = 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED' | 'REJECTED';

export interface WorkOrderHandshake {
  handshakeId: string;
  fromAgentId: string;
  toAgentId: string;
  transferPointId: string;
  status: WorkOrderHandshakeStatus;
  contextPacket: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderCollaboration {
  globalWorkflowId: string | null;
  internalMemos: WorkOrderInternalMemo[];
  handshakes: WorkOrderHandshake[];
}

export interface DirectorFeedbackRequest {
  moduleRoute: string;
  targetEmployeeId?: string;
  message: string;
  timestampIso: string;
}

export interface WorkOrderRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  moduleRoute: string;
  requester: 'DIRECTOR';
  message: string;
  targetEmployeeId: string;
  priority: WorkOrderPriority;
  state: WorkOrderState;
  waitingOnRole: string | null;
  summary: string | null;
  error: string | null;
  collaboration: WorkOrderCollaboration;
}

/**
 * Factory function to create a work order service.
 * This is transitional - will be fully DB-backed in v2.
 */
export const createWorkOrderService = () => {
  // Instance-level state (not module-level)
  let workOrderCounter = 1;
  const workOrders = new Map<string, WorkOrderRecord>();

  const createWorkOrderId = (): string => {
    const id = `WO-${String(workOrderCounter).padStart(4, '0')}`;
    workOrderCounter += 1;
    return id;
  };

  const createMemoId = (): string => `MEMO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createHandshakeId = (): string => `HS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    create(input: {
      moduleRoute: string;
      message: string;
      targetEmployeeId: string;
      priority: WorkOrderPriority;
    }): WorkOrderRecord {
      const now = new Date().toISOString();
      const record: WorkOrderRecord = {
        id: createWorkOrderId(),
        createdAt: now,
        updatedAt: now,
        moduleRoute: input.moduleRoute,
        requester: 'DIRECTOR',
        message: input.message,
        targetEmployeeId: input.targetEmployeeId,
        priority: input.priority,
        state: 'INIT',
        waitingOnRole: null,
        summary: null,
        error: null,
        collaboration: {
          globalWorkflowId: null,
          internalMemos: [],
          handshakes: [],
        },
      };

      workOrders.set(record.id, record);
      return record;
    },

    get(id: string): WorkOrderRecord | null {
      return workOrders.get(id) ?? null;
    },

    list(): WorkOrderRecord[] {
      return Array.from(workOrders.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    updateState(id: string, state: WorkOrderState, options?: { summary?: string; error?: string }): WorkOrderRecord | null {
      const existing = workOrders.get(id);
      if (!existing) {
        return null;
      }

      const updated: WorkOrderRecord = {
        ...existing,
        state,
        waitingOnRole: state === 'WAITING' ? existing.waitingOnRole : null,
        updatedAt: new Date().toISOString(),
        summary: options?.summary ?? existing.summary,
        error: options?.error ?? existing.error,
      };

      workOrders.set(id, updated);
      return updated;
    },

    setWaitingOnRole(id: string, role: string): WorkOrderRecord | null {
      const existing = workOrders.get(id);
      if (!existing) {
        return null;
      }

      const trimmedRole = role.trim();
      if (!trimmedRole) {
        return existing;
      }

      const updated: WorkOrderRecord = {
        ...existing,
        state: 'WAITING',
        waitingOnRole: trimmedRole,
        updatedAt: new Date().toISOString(),
      };

      workOrders.set(id, updated);
      return updated;
    },

    clearWaitingState(id: string): WorkOrderRecord | null {
      const existing = workOrders.get(id);
      if (!existing) {
        return null;
      }

      const updated: WorkOrderRecord = {
        ...existing,
        state: existing.state === 'WAITING' ? 'EXECUTING' : existing.state,
        waitingOnRole: null,
        updatedAt: new Date().toISOString(),
      };

      workOrders.set(id, updated);
      return updated;
    },

    attachGlobalWorkflow(id: string, workflowId: string): WorkOrderRecord | null {
      const existing = workOrders.get(id);
      if (!existing) {
        return null;
      }

      const updated: WorkOrderRecord = {
        ...existing,
        updatedAt: new Date().toISOString(),
        collaboration: {
          ...existing.collaboration,
          globalWorkflowId: workflowId.trim() || null,
        },
      };

      workOrders.set(id, updated);
      return updated;
    },

    addInternalMemo(
      id: string,
      payload: {
        fromAgentId: string;
        toAgentId: string;
        memoType: InternalMemoType;
        priority: WorkOrderPriority;
        message: string;
        contextPacket?: Record<string, unknown>;
      },
    ): WorkOrderInternalMemo | null {
      const existing = workOrders.get(id);
      if (!existing) {
        return null;
      }

      const memo: WorkOrderInternalMemo = {
        memoId: createMemoId(),
        fromAgentId: payload.fromAgentId,
        toAgentId: payload.toAgentId,
        memoType: payload.memoType,
        priority: payload.priority,
        message: payload.message,
        contextPacket: payload.contextPacket ?? {},
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };

      const updated: WorkOrderRecord = {
        ...existing,
        updatedAt: new Date().toISOString(),
        collaboration: {
          ...existing.collaboration,
          internalMemos: [memo, ...existing.collaboration.internalMemos],
        },
      };

      workOrders.set(id, updated);
      return memo;
    },

    addHandshake(
      id: string,
      payload: {
        fromAgentId: string;
        toAgentId: string;
        transferPointId: string;
        contextPacket?: Record<string, unknown>;
      },
    ): WorkOrderHandshake | null {
      const existing = workOrders.get(id);
      if (!existing) {
        return null;
      }

      const now = new Date().toISOString();
      const handshake: WorkOrderHandshake = {
        handshakeId: createHandshakeId(),
        fromAgentId: payload.fromAgentId,
        toAgentId: payload.toAgentId,
        transferPointId: payload.transferPointId,
        status: 'PENDING',
        contextPacket: payload.contextPacket ?? {},
        createdAt: now,
        updatedAt: now,
      };

      const updated: WorkOrderRecord = {
        ...existing,
        updatedAt: now,
        collaboration: {
          ...existing.collaboration,
          handshakes: [handshake, ...existing.collaboration.handshakes],
        },
      };

      workOrders.set(id, updated);
      return handshake;
    },

    updateHandshakeStatus(id: string, handshakeId: string, status: WorkOrderHandshakeStatus): WorkOrderRecord | null {
      const existing = workOrders.get(id);
      if (!existing) {
        return null;
      }

      let changed = false;
      const nextHandshakes = existing.collaboration.handshakes.map((handshake) => {
        if (handshake.handshakeId !== handshakeId) {
          return handshake;
        }

        changed = true;
        return {
          ...handshake,
          status,
          updatedAt: new Date().toISOString(),
        };
      });

      if (!changed) {
        return existing;
      }

      const updated: WorkOrderRecord = {
        ...existing,
        updatedAt: new Date().toISOString(),
        collaboration: {
          ...existing.collaboration,
          handshakes: nextHandshakes,
        },
      };

      workOrders.set(id, updated);
      return updated;
    },

    __resetForTesting(): void {
      workOrderCounter = 1;
      workOrders.clear();
    },
  };
};

// Backward compatibility - creates a default instance
export const workOrderService = createWorkOrderService();
