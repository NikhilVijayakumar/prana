import type { RuntimeSession } from './sandboxTypes'
import type { RuntimeOrchestrator } from './runtimeOrchestratorService'
import type { RuntimeSessionManager } from './runtimeSessionManagerService'
import { vaidyarService } from '../vaidyarService'

const MONITOR_INTERVAL_MS = 5_000
const HEARTBEAT_TIMEOUT_MS = 15_000
const MEMORY_THRESHOLD_BYTES = 512 * 1024 * 1024
const IPC_LATENCY_THRESHOLD_MS = 2_000

export type SupervisorAction = 'recover' | 'restart' | 'destroy' | 'none'

export interface SupervisorReport {
  sessionId: string
  healthy: boolean
  actions: SupervisorAction[]
  checks: {
    heartbeat: boolean
    memory: boolean
    ipcLatency: boolean
    vaidyarClear: boolean
  }
  evaluatedAt: number
}

export const createSandboxSupervisor = (
  orchestrator: RuntimeOrchestrator,
  sessionManager: RuntimeSessionManager,
) => {
  let monitorInterval: ReturnType<typeof setInterval> | null = null
  let activeSessionId: string | null = null

  const evaluateSession = async (session: RuntimeSession): Promise<SupervisorReport> => {
    const now = Date.now()
    const timeSinceActivity = now - session.runtimeHealth.lastActivity
    const heartbeatOk =
      session.runtimeHealth.heartbeat && timeSinceActivity < HEARTBEAT_TIMEOUT_MS
    const memoryOk = session.runtimeHealth.memoryUsage < MEMORY_THRESHOLD_BYTES
    const ipcOk = session.runtimeHealth.ipcLatency < IPC_LATENCY_THRESHOLD_MS

    let vaidyarClear = true
    try {
      let report = vaidyarService.getReport()
      // If no prior report exists (e.g. suppressHostBoot in dev mode), run a fresh on-demand check
      if (!report || !report.timestamp) {
        report = await vaidyarService.runOnDemandDiagnostics()
      }
      vaidyarClear = report.overall_status !== 'Blocked'
    } catch {
      // Vaidyar unavailable — supervisor continues without blocking signals
    }

    const actions: SupervisorAction[] = []
    if (!vaidyarClear) {
      actions.push('destroy')
    } else if (!heartbeatOk) {
      actions.push('recover')
    } else if (!memoryOk) {
      actions.push('restart')
    }

    return {
      sessionId: session.sessionId,
      healthy: actions.length === 0,
      actions,
      checks: { heartbeat: heartbeatOk, memory: memoryOk, ipcLatency: ipcOk, vaidyarClear },
      evaluatedAt: now,
    }
  }

  const applyActions = (report: SupervisorReport, containerId: string): void => {
    if (report.actions.includes('destroy') || report.actions.includes('recover')) {
      try {
        orchestrator.transition(containerId, 'STOPPING')
        orchestrator.transition(containerId, 'DESTROYED')
      } catch {
        orchestrator.destroyContainer(containerId)
      }
      sessionManager.recordCrash(
        report.sessionId,
        `supervisor forced teardown: ${report.actions.join(', ')}`,
      )
    }
  }

  return {
    startMonitoring(sessionId: string): void {
      activeSessionId = sessionId
      if (monitorInterval) clearInterval(monitorInterval)

      monitorInterval = setInterval(() => {
        if (!activeSessionId) return
        const session = sessionManager.getSession(activeSessionId)
        if (!session || session.state !== 'RUNNING') return

        const activeContainer = orchestrator.getActiveModuleContainer()
        if (!activeContainer) return

        evaluateSession(session)
          .then((report) => {
            if (!report.healthy) applyActions(report, activeContainer.containerId)
          })
          .catch(() => {
            // supervisor evaluation failed — monitoring continues on next tick
          })
      }, MONITOR_INTERVAL_MS)
    },

    stopMonitoring(): void {
      if (monitorInterval) {
        clearInterval(monitorInterval)
        monitorInterval = null
      }
      activeSessionId = null
    },

    async evaluateNow(sessionId: string): Promise<SupervisorReport | null> {
      const session = sessionManager.getSession(sessionId)
      if (!session) return null
      return evaluateSession(session)
    },
  }
}

export type SandboxSupervisor = ReturnType<typeof createSandboxSupervisor>
