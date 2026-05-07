import { createRuntimeOrchestrator } from './runtimeOrchestratorService'
import { createRuntimeSessionManager } from './runtimeSessionManagerService'
import { createSandboxSupervisor } from './sandboxSupervisorService'
import { sandboxIpcGateway } from './sandboxIpcGateway'
import { runtimeImageManagerService } from './runtimeImageManagerService'
import { startupOrchestratorService } from '../startupOrchestratorService'
import type { RuntimeCapabilities, RuntimeImage, RuntimeSession } from './sandboxTypes'

export type EngineState = 'uninitialized' | 'booting' | 'operational' | 'failed' | 'shutdown'

export interface SandboxRuntimeEngineConfig {
  suppressHostBoot?: boolean
  onBootProgress?: (stage: string, state: string) => void
}

export const createSandboxRuntimeEngine = (config: SandboxRuntimeEngineConfig = {}) => {
  const orchestrator = createRuntimeOrchestrator()
  const sessionManager = createRuntimeSessionManager()
  const supervisor = createSandboxSupervisor(orchestrator, sessionManager)

  let engineState: EngineState = 'uninitialized'
  let hostContainerId: string | null = null
  let hostSessionId: string | null = null

  const assertOperational = (): void => {
    if (engineState !== 'operational') {
      throw new Error(`sandbox engine is not operational (current state: ${engineState})`)
    }
  }

  return {
    // The Host Runtime Container boot process is the Startup Orchestrator.
    // The Runtime Orchestrator only accepts module lifecycle requests after this completes.
    async initialize(): Promise<void> {
      if (engineState !== 'uninitialized') return

      engineState = 'booting'

      const hostContainer = orchestrator.createContainer('host')
      hostContainerId = hostContainer.containerId
      orchestrator.transition(hostContainerId, 'CREATED')
      orchestrator.transition(hostContainerId, 'PREPARING')
      orchestrator.transition(hostContainerId, 'STARTING')

      if (!config.suppressHostBoot) {
        const bootResult = await startupOrchestratorService.runStartupSequence((event) => {
          config.onBootProgress?.(event.stage?.id ?? '', event.currentState ?? '')
        })

        if (bootResult.overallStatus === 'BLOCKED') {
          orchestrator.transition(hostContainerId!, 'FAILED')
          engineState = 'failed'
          throw new Error('host container boot failed: startup orchestrator blocked')
        }
      }

      orchestrator.transition(hostContainerId!, 'RUNNING')

      const hostSession = sessionManager.createSession('host', '1.0.0', {
        sqlite: { read: true, write: true },
        vault: { read: true, write: true },
        notifications: { emit: true },
        sync: { read: true },
      })
      hostSessionId = hostSession.sessionId
      sessionManager.transitionState(hostSessionId, 'RUNNING')

      // SQLite and Vault containers start with the host and share its session
      const sqliteContainer = orchestrator.createContainer('sqlite', hostSessionId)
      orchestrator.transition(sqliteContainer.containerId, 'CREATED')
      orchestrator.transition(sqliteContainer.containerId, 'RUNNING')

      engineState = 'operational'
    },

    async startModuleContainer(
      image: RuntimeImage,
      capabilities: RuntimeCapabilities,
    ): Promise<RuntimeSession> {
      assertOperational()

      if (orchestrator.hasActiveModule()) {
        throw new Error(
          'a runtime module container is already active — only one may execute simultaneously',
        )
      }

      const moduleContainer = orchestrator.createContainer('module')
      orchestrator.transition(moduleContainer.containerId, 'CREATED')
      orchestrator.transition(moduleContainer.containerId, 'PREPARING')

      const session = sessionManager.createSession(image.id, image.version, capabilities)
      sessionManager.transitionState(session.sessionId, 'STARTING')
      orchestrator.transition(moduleContainer.containerId, 'STARTING')
      orchestrator.transition(moduleContainer.containerId, 'RUNNING')
      sessionManager.transitionState(session.sessionId, 'RUNNING')

      supervisor.startMonitoring(session.sessionId)

      return session
    },

    async stopModuleContainer(sessionId: string): Promise<void> {
      const activeContainer = orchestrator.getActiveModuleContainer()
      if (!activeContainer) return

      supervisor.stopMonitoring()

      orchestrator.transition(activeContainer.containerId, 'STOPPING')
      sessionManager.transitionState(sessionId, 'STOPPING')
      orchestrator.transition(activeContainer.containerId, 'DESTROYED')
      sessionManager.destroySession(sessionId)
    },

    getEngineState(): EngineState {
      return engineState
    },

    getHostSessionId(): string | null {
      return hostSessionId
    },

    listContainers() {
      return orchestrator.listContainers()
    },

    getOrchestrator() {
      return orchestrator
    },

    getSessionManager() {
      return sessionManager
    },

    getSupervisor() {
      return supervisor
    },

    getIpcGateway() {
      return sandboxIpcGateway
    },

    getImageManager() {
      return runtimeImageManagerService
    },

    async shutdown(): Promise<void> {
      supervisor.stopMonitoring()
      sessionManager.clearAll()
      engineState = 'shutdown'
    },
  }
}

export type SandboxRuntimeEngine = ReturnType<typeof createSandboxRuntimeEngine>

export const sandboxRuntimeEngine = createSandboxRuntimeEngine()
