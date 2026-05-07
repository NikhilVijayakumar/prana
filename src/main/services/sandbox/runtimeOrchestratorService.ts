import { randomUUID } from 'node:crypto'
import type { RuntimeState, ContainerType, ContainerDescriptor } from './sandboxTypes'

const VALID_TRANSITIONS: Record<RuntimeState, RuntimeState[]> = {
  IDLE: ['CREATED', 'FAILED'],
  CREATED: ['PREPARING', 'FAILED'],
  PREPARING: ['STARTING', 'FAILED'],
  STARTING: ['RUNNING', 'FAILED'],
  RUNNING: ['SUSPENDING', 'STOPPING', 'FAILED'],
  SUSPENDING: ['RUNNING', 'STOPPING', 'FAILED'],
  STOPPING: ['DESTROYED', 'FAILED'],
  DESTROYED: [],
  FAILED: ['IDLE'],
}

export const createRuntimeOrchestrator = () => {
  const containers = new Map<string, ContainerDescriptor>()

  const validateTransition = (current: RuntimeState, target: RuntimeState): void => {
    if (!VALID_TRANSITIONS[current].includes(target)) {
      throw new Error(`invalid state transition: ${current} → ${target}`)
    }
  }

  return {
    createContainer(type: ContainerType, sessionId?: string): ContainerDescriptor {
      const container: ContainerDescriptor = {
        containerId: randomUUID(),
        type,
        state: 'IDLE',
        sessionId,
        startedAt: Date.now(),
      }
      containers.set(container.containerId, container)
      return container
    },

    transition(containerId: string, target: RuntimeState): void {
      const container = containers.get(containerId)
      if (!container) throw new Error(`container not found: ${containerId}`)
      validateTransition(container.state, target)
      container.state = target
      if (target === 'DESTROYED') {
        containers.delete(containerId)
      }
    },

    destroyContainer(containerId: string): void {
      containers.delete(containerId)
    },

    getState(containerId: string): RuntimeState | undefined {
      return containers.get(containerId)?.state
    },

    getContainer(containerId: string): ContainerDescriptor | undefined {
      return containers.get(containerId)
    },

    listContainers(): ContainerDescriptor[] {
      return [...containers.values()]
    },

    getActiveModuleContainer(): ContainerDescriptor | undefined {
      return [...containers.values()].find(
        (c) => c.type === 'module' && c.state === 'RUNNING',
      )
    },

    hasActiveModule(): boolean {
      return [...containers.values()].some(
        (c) => c.type === 'module' && c.state === 'RUNNING',
      )
    },
  }
}

export type RuntimeOrchestrator = ReturnType<typeof createRuntimeOrchestrator>

export const runtimeOrchestratorService = createRuntimeOrchestrator()
