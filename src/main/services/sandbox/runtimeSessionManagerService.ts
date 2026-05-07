import { randomUUID } from 'node:crypto'
import type {
  RuntimeState,
  RuntimeCapabilities,
  RuntimeHealth,
  RuntimeSession,
  SessionJournalEntry,
  SessionJournalEvent,
} from './sandboxTypes'

const MAX_JOURNAL_ENTRIES = 1000

const nowMs = (): number => Date.now()

const defaultHealth = (): RuntimeHealth => ({
  heartbeat: false,
  memoryUsage: 0,
  ipcLatency: 0,
  eventLoopLag: 0,
  lastActivity: nowMs(),
})

export const createRuntimeSessionManager = () => {
  const sessions = new Map<string, RuntimeSession>()
  const journal: SessionJournalEntry[] = []

  const appendJournal = (entry: Omit<SessionJournalEntry, 'entryId'>): void => {
    journal.unshift({ entryId: randomUUID(), ...entry })
    if (journal.length > MAX_JOURNAL_ENTRIES) {
      journal.length = MAX_JOURNAL_ENTRIES
    }
  }

  return {
    createSession(
      runtimeId: string,
      runtimeVersion: string,
      capabilities: RuntimeCapabilities,
    ): RuntimeSession {
      const session: RuntimeSession = {
        sessionId: randomUUID(),
        runtimeId,
        runtimeVersion,
        state: 'IDLE',
        startedAt: nowMs(),
        capabilities,
        hydrationVersion: 0,
        runtimeHealth: defaultHealth(),
        metadata: {},
      }
      sessions.set(session.sessionId, session)
      appendJournal({
        sessionId: session.sessionId,
        event: 'transition',
        to: 'IDLE',
        timestamp: session.startedAt,
      })
      return session
    },

    transitionState(sessionId: string, to: RuntimeState, reason?: string): boolean {
      const session = sessions.get(sessionId)
      if (!session) return false
      const from = session.state
      session.state = to
      appendJournal({ sessionId, event: 'transition', from, to, reason, timestamp: nowMs() })
      return true
    },

    updateHealth(sessionId: string, health: Partial<RuntimeHealth>): boolean {
      const session = sessions.get(sessionId)
      if (!session) return false
      Object.assign(session.runtimeHealth, health, { lastActivity: nowMs() })
      appendJournal({
        sessionId,
        event: 'heartbeat',
        timestamp: nowMs(),
        metadata: { memoryUsage: session.runtimeHealth.memoryUsage },
      })
      return true
    },

    setProcessId(sessionId: string, pid: number): void {
      const session = sessions.get(sessionId)
      if (session) session.processId = pid
    },

    recordCrash(sessionId: string, reason: string): void {
      const session = sessions.get(sessionId)
      if (!session) return
      session.state = 'FAILED'
      appendJournal({ sessionId, event: 'crash', reason, timestamp: nowMs() })
    },

    destroySession(sessionId: string): void {
      const session = sessions.get(sessionId)
      if (!session) return
      const from = session.state
      session.state = 'DESTROYED'
      appendJournal({ sessionId, event: 'transition', from, to: 'DESTROYED', timestamp: nowMs() })
      sessions.delete(sessionId)
    },

    getSession(sessionId: string): RuntimeSession | undefined {
      return sessions.get(sessionId)
    },

    listSessions(): RuntimeSession[] {
      return [...sessions.values()]
    },

    getJournal(sessionId?: string, limit = 100): SessionJournalEntry[] {
      const entries = sessionId
        ? journal.filter((e) => e.sessionId === sessionId)
        : journal
      return entries.slice(0, limit)
    },

    clearAll(): void {
      sessions.clear()
      journal.length = 0
    },
  }
}

export type RuntimeSessionManager = ReturnType<typeof createRuntimeSessionManager>

export const runtimeSessionManagerService = createRuntimeSessionManager()
