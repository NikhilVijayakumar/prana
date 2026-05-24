import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { vaultService } from '../vault/vaultService'

const VAULT_FILES_TABLE = 'vault_files'
const VAULT_STAGING_TABLE = 'vault_staging'

// Projects vault file index into SQLite vault_files table on startup.
// Flushes vault_staging rows back to vault on shutdown.
// Both tables are accessible to host and plugins via sqlite:read/write IPC —
// no direct vault access required by either side.
export const createVaultSqliteSync = (db: Database.Database) => {
  const project = async (): Promise<void> => {
    let files: Awaited<ReturnType<typeof vaultService.listFiles>>
    try {
      files = await vaultService.listFiles()
    } catch {
      return // vault not available — skip projection silently
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS ${VAULT_FILES_TABLE} (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        size TEXT,
        classification TEXT,
        scan_status TEXT,
        uploaded_at TEXT
      )
    `)

    const insert = db.prepare(
      `INSERT OR REPLACE INTO ${VAULT_FILES_TABLE} (id, filename, size, classification, scan_status, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )

    const insertAll = db.transaction(() => {
      for (const f of files) {
        insert.run(f.id, f.filename, f.size, f.classification, f.scanStatus, f.uploadedAt)
      }
    })

    insertAll()
  }

  const flush = async (): Promise<void> => {
    const hasTable = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(VAULT_STAGING_TABLE) as { name: string } | undefined

    if (!hasTable) return

    const staged = db.prepare(`SELECT * FROM ${VAULT_STAGING_TABLE}`).all() as Array<{
      id: string
      filename: string
      content_base64: string
    }>

    if (staged.length === 0) return

    const tempDir = join(tmpdir(), `prana-vault-flush-${randomUUID()}`)
    try {
      await mkdir(tempDir, { recursive: true })
      const paths: string[] = []

      for (const entry of staged) {
        const dest = join(tempDir, entry.filename)
        await writeFile(dest, Buffer.from(entry.content_base64, 'base64'))
        paths.push(dest)
      }

      await vaultService.ingestPaths(paths)
      db.prepare(`DELETE FROM ${VAULT_STAGING_TABLE}`).run()
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

  return { project, flush }
}

export type VaultSqliteSync = ReturnType<typeof createVaultSqliteSync>
