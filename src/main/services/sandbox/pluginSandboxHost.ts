import { fork, ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import type { RuntimeCapabilities, RuntimeImage, RuntimeImageManifest, SandboxFixture } from './sandboxTypes'
import { createRuntimeOrchestrator } from './runtimeOrchestratorService'
import { createRuntimeSessionManager } from './runtimeSessionManagerService'
import { createSandboxSupervisor } from './sandboxSupervisorService'
import { createSandboxIpcGateway } from './sandboxIpcGateway'
import { runtimeImageManagerService } from './runtimeImageManagerService'
import { notificationCentreService } from '../notificationCentreService'

const STUB_ENTRY = join(__dirname, 'runtimeStub.cjs')
const SHUTDOWN_TIMEOUT_MS = 5_000

export type PluginSandboxStatus = 'idle' | 'booting' | 'running' | 'stopping' | 'stopped' | 'crashed'

export interface PluginSandboxLaunchResult {
  sessionId: string
  containerId: string
  dbPath: string
}

// Writes fixture tables into a real SQLite DB at a temp path.
// Plugin queries this via IPC — identical to how it queries production SQLite.
const setupSqliteDb = (fixture?: SandboxFixture): { db: Database.Database; dbPath: string } => {
  const dir = join(tmpdir(), 'prana-sandbox')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const dbPath = join(dir, `sandbox-${randomUUID()}.sqlite`)

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')

  if (fixture) {
    for (const [tableName, rows] of Object.entries(fixture.tables)) {
      if (!Array.isArray(rows) || rows.length === 0) continue

      const cols = Object.keys(rows[0] as Record<string, unknown>)
      db.exec(
        `CREATE TABLE IF NOT EXISTS ${tableName} (${cols.map((c) => `${c} TEXT`).join(', ')})`,
      )

      const placeholders = cols.map(() => '?').join(', ')
      const insert = db.prepare(`INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`)
      const insertAll = db.transaction((data: unknown[]) => {
        for (const row of data) {
          const r = row as Record<string, unknown>
          insert.run(cols.map((c) => (r[c] === null || r[c] === undefined ? null : typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c]))))
        }
      })
      insertAll(rows)
    }
  }

  return { db, dbPath }
}

// Registers all host-side gateway handlers against the real SQLite DB.
// These are the same operations the real host exposes — plugin code is identical in both environments.
const registerHostHandlers = (
  gateway: ReturnType<typeof createSandboxIpcGateway>,
  db: Database.Database,
): void => {
  gateway.registerRoute('sqlite:read', async (payload) => {
    const { table, query } = payload as { table: string; query?: Record<string, unknown> }
    try {
      if (query && Object.keys(query).length > 0) {
        const conditions = Object.entries(query)
        const sql = `SELECT * FROM ${table} WHERE ${conditions.map(([k]) => `${k} = ?`).join(' AND ')}`
        const params = conditions.map(([, v]) => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
        return db.prepare(sql).all(...params)
      }
      return db.prepare(`SELECT * FROM ${table}`).all()
    } catch {
      return []
    }
  })

  gateway.registerRoute('sqlite:write', async (payload) => {
    const { table, rows } = payload as { table: string; rows: Record<string, unknown>[] }
    if (!rows.length) return { written: 0 }

    const cols = Object.keys(rows[0])
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS ${table} (${cols.map((c) => `${c} TEXT`).join(', ')})`)
    } catch { /* table already exists */ }

    const upsert = db.prepare(
      `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    )
    const writeAll = db.transaction((data: Record<string, unknown>[]) => {
      for (const row of data) {
        upsert.run(cols.map((c) => (row[c] === null || row[c] === undefined ? null : typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c]))))
      }
      return data.length
    })

    const written = writeAll(rows) as number
    return { written }
  })

  gateway.registerRoute('sqlite:exec', async (payload) => {
    const { sql } = payload as { sql: string }
    db.exec(sql)
  })

  gateway.registerRoute('notifications:emit', async (payload) => {
    const { eventType, payload: eventPayload } = payload as {
      eventType: string
      payload: Record<string, unknown>
    }
    await notificationCentreService.emit({
      eventType,
      priority: 'INFO',
      source: 'sandbox:plugin',
      message: eventType,
      payload: eventPayload ?? {},
    })
  })

  // Sync is read-only in sandbox — no vault, no actual reconciliation
  gateway.registerRoute('sync:read', async (payload) => {
    const { domainKey } = payload as { domainKey: string }
    return { domainKey, status: 'SANDBOX_MODE', lastSyncedAt: null }
  })
}

export const createPluginSandboxHost = () => {
  const orchestrator = createRuntimeOrchestrator()
  const sessionManager = createRuntimeSessionManager()
  // Each host instance gets its own gateway so route registrations don't leak across tests
  const gateway = createSandboxIpcGateway()
  const supervisor = createSandboxSupervisor(orchestrator, sessionManager)

  let runtimeProcess: ChildProcess | null = null
  let db: Database.Database | null = null
  let dbPath: string | null = null
  let containerId: string | null = null
  let sessionId: string | null = null
  let status: PluginSandboxStatus = 'idle'

  const teardownDb = (): void => {
    if (db) {
      try { db.close() } catch { /* ignore */ }
      db = null
    }
    if (dbPath && existsSync(dbPath)) {
      try { unlinkSync(dbPath) } catch { /* ignore */ }
      dbPath = null
    }
  }

  const onProcessMessage = async (msg: Record<string, unknown>): Promise<void> => {
    if (!sessionId || !containerId) return

    switch (msg.type) {
      case 'runtime:ready': {
        try {
          orchestrator.transition(containerId, 'RUNNING')
        } catch { /* may already be transitioning */ }
        sessionManager.transitionState(sessionId, 'RUNNING')
        if (typeof msg.pid === 'number') sessionManager.setProcessId(sessionId, msg.pid)
        status = 'running'
        supervisor.startMonitoring(sessionId)
        break
      }

      case 'runtime:heartbeat': {
        sessionManager.updateHealth(sessionId, {
          heartbeat: true,
          memoryUsage: typeof msg.memoryUsage === 'number' ? msg.memoryUsage : 0,
          eventLoopLag: typeof msg.eventLoopLag === 'number' ? msg.eventLoopLag : 0,
          lastActivity: Date.now(),
        })
        break
      }

      // The core bridge: plugin sends ipc:request → gateway validates capability → registered handler executes → ipc:response sent back.
      // Plugin code is identical whether running in sandbox or real host.
      case 'ipc:request': {
        const { requestId, messageType, payload } = msg as {
          requestId: string
          messageType: string
          payload: unknown
        }
        const session = sessionManager.getSession(sessionId)
        if (!session || !requestId || !messageType) break

        const ipcMessage = gateway.buildMessage(messageType, sessionId, session.runtimeId, payload)
        const result = await gateway.route(ipcMessage, session.capabilities)

        runtimeProcess?.send({ type: 'ipc:response', requestId, ...result })
        break
      }

      case 'runtime:crash': {
        status = 'crashed'
        sessionManager.recordCrash(
          sessionId,
          typeof msg.error === 'string' ? msg.error : 'unknown crash',
        )
        try {
          orchestrator.transition(containerId, 'FAILED')
        } catch {
          orchestrator.destroyContainer(containerId)
        }
        supervisor.stopMonitoring()
        break
      }

      case 'runtime:shutdown_ack': {
        status = 'stopped'
        sessionManager.destroySession(sessionId)
        try {
          orchestrator.transition(containerId, 'DESTROYED')
        } catch {
          orchestrator.destroyContainer(containerId)
        }
        supervisor.stopMonitoring()
        teardownDb()
        break
      }
    }
  }

  const onProcessExit = (code: number | null, signal: string | null): void => {
    if (status !== 'running' && status !== 'booting') return
    status = 'crashed'
    if (sessionId) {
      sessionManager.recordCrash(
        sessionId,
        `process exited unexpectedly: code=${code} signal=${signal}`,
      )
    }
    if (containerId) orchestrator.destroyContainer(containerId)
    supervisor.stopMonitoring()
    teardownDb()
    runtimeProcess = null
  }

  return {
    async launch(
      imagePath?: string,
      fixture?: SandboxFixture,
      capabilities: RuntimeCapabilities = { sqlite: { read: true, write: true } },
    ): Promise<PluginSandboxLaunchResult> {
      if (status !== 'idle' && status !== 'stopped') {
        throw new Error(`plugin sandbox host is already ${status} — call shutdown() first`)
      }

      status = 'booting'

      // Build real SQLite DB from fixture before process starts — plugin hydrates from it on boot
      const setup = setupSqliteDb(fixture)
      db = setup.db
      dbPath = setup.dbPath

      // Register all host-side handlers against the real DB
      registerHostHandlers(gateway, db)

      let image: RuntimeImage
      let entryPath: string

      if (imagePath) {
        image = await runtimeImageManagerService.resolveFromPath(imagePath)
        entryPath = image.entry
      } else {
        entryPath = STUB_ENTRY
        const stubManifest: RuntimeImageManifest = {
          schemaVersion: 1,
          runtime: { id: 'plugin.stub', version: '0.0.1', entry: entryPath },
          permissions: capabilities,
        }
        image = runtimeImageManagerService.resolveFromManifest(stubManifest, entryPath)
      }

      const container = orchestrator.createContainer('module')
      containerId = container.containerId
      orchestrator.transition(containerId, 'CREATED')
      orchestrator.transition(containerId, 'PREPARING')

      const session = sessionManager.createSession(image.id, image.version, capabilities)
      sessionId = session.sessionId
      sessionManager.transitionState(sessionId, 'STARTING')
      orchestrator.transition(containerId, 'STARTING')

      runtimeProcess = fork(entryPath, [], {
        silent: true,
        env: {
          ...process.env,
          SANDBOX_SESSION_ID: sessionId,
          SANDBOX_RUNTIME_ID: image.id,
          SANDBOX_RUNTIME_VERSION: image.version,
          // Plugin uses this path if it needs direct DB access during hydration bootstrap
          SANDBOX_SQLITE_PATH: dbPath,
        },
      })

      runtimeProcess.on('message', (msg) => void onProcessMessage(msg as Record<string, unknown>))
      runtimeProcess.on('exit', onProcessExit)

      runtimeProcess.stderr?.on('data', (chunk: Buffer) => {
        if (sessionId && (status === 'running' || status === 'booting')) {
          sessionManager.recordCrash(sessionId, `stderr: ${String(chunk).trim()}`)
        }
      })

      // Capability injection tells the plugin what it is allowed to request via IPC
      runtimeProcess.send({ type: 'capability:inject', capabilities })

      return { sessionId, containerId, dbPath }
    },

    async shutdown(): Promise<void> {
      if (!runtimeProcess || status === 'stopped' || status === 'idle') return

      status = 'stopping'
      supervisor.stopMonitoring()

      await new Promise<void>((resolve) => {
        const killTimer = setTimeout(() => {
          runtimeProcess?.kill('SIGKILL')
          teardownDb()
          resolve()
        }, SHUTDOWN_TIMEOUT_MS)

        runtimeProcess!.once('exit', () => {
          clearTimeout(killTimer)
          teardownDb()
          resolve()
        })

        runtimeProcess!.send({ type: 'runtime:shutdown' })
      })

      runtimeProcess = null
      status = 'stopped'
    },

    getStatus(): PluginSandboxStatus {
      return status
    },

    getSession() {
      return sessionId ? sessionManager.getSession(sessionId) : undefined
    },

    getContainer() {
      return containerId ? orchestrator.getContainer(containerId) : undefined
    },

    getJournal(limit = 50) {
      return sessionId ? sessionManager.getJournal(sessionId, limit) : []
    },

    async evaluateHealth() {
      if (!sessionId) return null
      return supervisor.evaluateNow(sessionId)
    },

    getGateway() {
      return gateway
    },

    getDbPath(): string | null {
      return dbPath
    },

    listContainers() {
      return orchestrator.listContainers()
    },
  }
}

export type PluginSandboxHost = ReturnType<typeof createPluginSandboxHost>

export const pluginSandboxHost = createPluginSandboxHost()
