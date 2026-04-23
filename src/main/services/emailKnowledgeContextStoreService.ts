import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import { getAppDataRoot, mkdirSafe } from './governanceRepoService'

const DB_FILE_NAME = 'email-knowledge-context.sqlite'
const DEFAULT_MAX_ROWS = 5000
const DEFAULT_MAX_ROWS_PER_AGENT = 1000
const DEFAULT_MAX_AGE_DAYS = 120

export interface EmailKnowledgeContextEntry {
  entryId: string
  agentId: string
  accountId: string | null
  emailUid: number | null
  threadKey: string | null
  contextKind: 'INTAKE' | 'FOLLOW_UP' | 'REMINDER' | 'SUMMARY' | 'NOTE'
  subject: string | null
  sender: string | null
  summary: string
  followUpAt: string | null
  priority: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  lastSeenAt: string
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null
let dbPromise: Promise<Database> | null = null
let writeQueue: Promise<void> = Promise.resolve()

const nowIso = (): string => new Date().toISOString()
const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME)

const resolveSqlJsAsset = (fileName: string): string => {
  const candidates = [
    join(process.cwd(), 'node_modules', 'sql.js', 'dist', fileName),
    join(
      process.resourcesPath ?? '',
      'app.asar.unpacked',
      'node_modules',
      'sql.js',
      'dist',
      fileName
    ),
    join(process.resourcesPath ?? '', 'node_modules', 'sql.js', 'dist', fileName)
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return fileName
}

const getSqlRuntime = async (): Promise<SqlJsStatic> => {
  if (!sqlRuntimePromise) {
    sqlRuntimePromise = initSqlJs({ locateFile: (fileName) => resolveSqlJsAsset(fileName) })
  }
  return sqlRuntimePromise
}

const persistDatabase = async (database: Database): Promise<void> => {
  const bytes = database.export()
  await mkdirSafe(getAppDataRoot())
  await writeFile(getDbPath(), Buffer.from(bytes))
}

const initializeDatabase = async (): Promise<Database> => {
  const sqlRuntime = await getSqlRuntime()
  await mkdirSafe(getAppDataRoot())

  const database = existsSync(getDbPath())
    ? new sqlRuntime.Database(new Uint8Array(await readFile(getDbPath())))
    : new sqlRuntime.Database()

  database.run(`
    CREATE TABLE IF NOT EXISTS email_knowledge_context (
      entry_id TEXT PRIMARY KEY,
      source_key TEXT UNIQUE,
      agent_id TEXT NOT NULL,
      account_id TEXT,
      email_uid INTEGER,
      thread_key TEXT,
      context_kind TEXT NOT NULL,
      subject TEXT,
      sender TEXT,
      summary TEXT NOT NULL,
      follow_up_at TEXT,
      priority INTEGER NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
  `)

  database.run(`
    CREATE INDEX IF NOT EXISTS email_context_agent_updated_idx
    ON email_knowledge_context (agent_id, updated_at DESC);
  `)

  database.run(`
    CREATE INDEX IF NOT EXISTS email_context_last_seen_idx
    ON email_knowledge_context (last_seen_at ASC);
  `)

  await persistDatabase(database)
  return database
}

const getDatabase = async (): Promise<Database> => {
  if (!dbPromise) {
    dbPromise = initializeDatabase()
  }
  return dbPromise
}

const queueWrite = async (operation: () => Promise<void>): Promise<void> => {
  writeQueue = writeQueue.then(operation, operation)
  await writeQueue
}

const parseJsonObject = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'string') {
    return {}
  }
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

const mapRow = (row: Record<string, unknown>): EmailKnowledgeContextEntry => ({
  entryId: String(row.entry_id ?? ''),
  agentId: String(row.agent_id ?? ''),
  accountId: row.account_id ? String(row.account_id) : null,
  emailUid:
    typeof row.email_uid === 'number'
      ? row.email_uid
      : row.email_uid
        ? Number(row.email_uid)
        : null,
  threadKey: row.thread_key ? String(row.thread_key) : null,
  contextKind: String(row.context_kind ?? 'NOTE') as EmailKnowledgeContextEntry['contextKind'],
  subject: row.subject ? String(row.subject) : null,
  sender: row.sender ? String(row.sender) : null,
  summary: String(row.summary ?? ''),
  followUpAt: row.follow_up_at ? String(row.follow_up_at) : null,
  priority: typeof row.priority === 'number' ? row.priority : Number(row.priority ?? 0),
  metadata: parseJsonObject(row.metadata_json),
  createdAt: String(row.created_at ?? nowIso()),
  updatedAt: String(row.updated_at ?? nowIso()),
  lastSeenAt: String(row.last_seen_at ?? nowIso())
})

export const emailKnowledgeContextStoreService = {
  async upsertEntry(payload: {
    entryId?: string
    sourceKey?: string | null
    agentId: string
    accountId?: string | null
    emailUid?: number | null
    threadKey?: string | null
    contextKind: EmailKnowledgeContextEntry['contextKind']
    subject?: string | null
    sender?: string | null
    summary: string
    followUpAt?: string | null
    priority?: number
    metadata?: Record<string, unknown>
  }): Promise<EmailKnowledgeContextEntry> {
    const now = nowIso()
    const entryId = payload.entryId ?? createId('ctx')
    const sourceKey = payload.sourceKey ?? null

    await queueWrite(async () => {
      const db = await getDatabase()
      const statement = db.prepare(`
        INSERT INTO email_knowledge_context (
          entry_id,
          source_key,
          agent_id,
          account_id,
          email_uid,
          thread_key,
          context_kind,
          subject,
          sender,
          summary,
          follow_up_at,
          priority,
          metadata_json,
          created_at,
          updated_at,
          last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_key) DO UPDATE SET
          agent_id = excluded.agent_id,
          account_id = excluded.account_id,
          email_uid = excluded.email_uid,
          thread_key = excluded.thread_key,
          context_kind = excluded.context_kind,
          subject = excluded.subject,
          sender = excluded.sender,
          summary = excluded.summary,
          follow_up_at = excluded.follow_up_at,
          priority = excluded.priority,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at,
          last_seen_at = excluded.last_seen_at
      `)

      statement.run([
        entryId,
        sourceKey,
        payload.agentId,
        payload.accountId ?? null,
        payload.emailUid ?? null,
        payload.threadKey ?? null,
        payload.contextKind,
        payload.subject ?? null,
        payload.sender ?? null,
        payload.summary,
        payload.followUpAt ?? null,
        payload.priority ?? 0,
        JSON.stringify(payload.metadata ?? {}),
        now,
        now,
        now
      ])
      statement.free()
      await persistDatabase(db)
    })

    const entries = await this.listEntries({
      agentId: payload.agentId,
      sourceKey: sourceKey ?? undefined,
      limit: 1
    })
    if (entries.length > 0) {
      return entries[0]
    }

    return {
      entryId,
      agentId: payload.agentId,
      accountId: payload.accountId ?? null,
      emailUid: payload.emailUid ?? null,
      threadKey: payload.threadKey ?? null,
      contextKind: payload.contextKind,
      subject: payload.subject ?? null,
      sender: payload.sender ?? null,
      summary: payload.summary,
      followUpAt: payload.followUpAt ?? null,
      priority: payload.priority ?? 0,
      metadata: payload.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now
    }
  },

  async listEntries(payload: {
    agentId?: string
    accountId?: string
    sourceKey?: string
    query?: string
    limit?: number
  }): Promise<EmailKnowledgeContextEntry[]> {
    const db = await getDatabase()

    const conditions: string[] = []
    const params: Array<string | number> = []

    if (payload.agentId) {
      conditions.push('agent_id = ?')
      params.push(payload.agentId)
    }

    if (payload.accountId) {
      conditions.push('account_id = ?')
      params.push(payload.accountId)
    }

    if (payload.sourceKey) {
      conditions.push('source_key = ?')
      params.push(payload.sourceKey)
    }

    if (payload.query && payload.query.trim().length > 0) {
      conditions.push('(summary LIKE ? OR subject LIKE ? OR sender LIKE ?)')
      const q = `%${payload.query.trim()}%`
      params.push(q, q, q)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = Math.max(1, Math.min(payload.limit ?? 100, 1000))

    const statement = db.prepare(`
      SELECT *
      FROM email_knowledge_context
      ${where}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `)

    statement.bind(params)

    const rows: EmailKnowledgeContextEntry[] = []
    while (statement.step()) {
      rows.push(mapRow(statement.getAsObject() as Record<string, unknown>))
    }
    statement.free()

    return rows
  },

  async cleanup(payload?: {
    maxRows?: number
    maxRowsPerAgent?: number
    maxAgeDays?: number
  }): Promise<{ deleted: number; remaining: number }> {
    const maxRows = Math.max(100, payload?.maxRows ?? DEFAULT_MAX_ROWS)
    const maxRowsPerAgent = Math.max(50, payload?.maxRowsPerAgent ?? DEFAULT_MAX_ROWS_PER_AGENT)
    const maxAgeDays = Math.max(1, payload?.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS)
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString()

    let deleted = 0

    await queueWrite(async () => {
      const db = await getDatabase()

      const deleteOld = db.prepare('DELETE FROM email_knowledge_context WHERE last_seen_at < ?')
      deleteOld.run([cutoff])
      deleteOld.free()
      deleted += db.getRowsModified()

      const agentsStmt = db.prepare('SELECT DISTINCT agent_id FROM email_knowledge_context')
      const agentIds: string[] = []
      while (agentsStmt.step()) {
        const row = agentsStmt.getAsObject() as Record<string, unknown>
        agentIds.push(String(row.agent_id ?? ''))
      }
      agentsStmt.free()

      for (const agentId of agentIds) {
        const overStmt = db.prepare(`
          SELECT entry_id
          FROM email_knowledge_context
          WHERE agent_id = ?
          ORDER BY updated_at DESC
          LIMIT -1 OFFSET ${maxRowsPerAgent}
        `)
        overStmt.bind([agentId])

        const toDelete: string[] = []
        while (overStmt.step()) {
          const row = overStmt.getAsObject() as Record<string, unknown>
          toDelete.push(String(row.entry_id ?? ''))
        }
        overStmt.free()

        if (toDelete.length > 0) {
          const delStmt = db.prepare('DELETE FROM email_knowledge_context WHERE entry_id = ?')
          for (const entryId of toDelete) {
            delStmt.run([entryId])
          }
          delStmt.free()
          deleted += toDelete.length
        }
      }

      const globalOverflowStmt = db.prepare(`
        SELECT entry_id
        FROM email_knowledge_context
        ORDER BY updated_at DESC
        LIMIT -1 OFFSET ${maxRows}
      `)
      const globalDeletes: string[] = []
      while (globalOverflowStmt.step()) {
        const row = globalOverflowStmt.getAsObject() as Record<string, unknown>
        globalDeletes.push(String(row.entry_id ?? ''))
      }
      globalOverflowStmt.free()

      if (globalDeletes.length > 0) {
        const delStmt = db.prepare('DELETE FROM email_knowledge_context WHERE entry_id = ?')
        for (const entryId of globalDeletes) {
          delStmt.run([entryId])
        }
        delStmt.free()
        deleted += globalDeletes.length
      }

      await persistDatabase(db)
    })

    const remaining = await this.countEntries()
    return { deleted, remaining }
  },

  async countEntries(): Promise<number> {
    const db = await getDatabase()
    const statement = db.prepare('SELECT COUNT(*) AS total FROM email_knowledge_context')
    statement.step()
    const row = statement.getAsObject() as Record<string, unknown>
    statement.free()
    return Number(row.total ?? 0)
  },

  async dispose(): Promise<void> {
    const db = await dbPromise
    if (db) {
      db.close()
    }
    dbPromise = null
  }
}
