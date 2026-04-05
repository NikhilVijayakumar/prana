import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { executeCommand } from './processService'

export interface ImapFetchAccount {
  accountId: string
  address: string
  imapHost: string
  imapPort: number
  useTls: boolean
  lastReadUID: number
}

const resolveWorkerPath = (): string => {
  const candidates = [
    join(process.cwd(), 'src', 'main', 'workers', 'email_imap_worker.py'),
    join(process.cwd(), 'out', 'main', 'workers', 'email_imap_worker.py'),
    join(process.cwd(), 'resources', 'workers', 'email_imap_worker.py')
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error('IMAP worker script not found. Expected email_imap_worker.py in workers path.')
}

const resolvePasswordEnvKey = (accountId: string): string => {
  const normalized = accountId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()
  return `PRANA_EMAIL_APP_PASSWORD_${normalized}`
}

const parseWorkerRows = (stdout: string): Array<Record<string, unknown>> => {
  const trimmed = stdout.trim()
  if (!trimmed) {
    return []
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!Array.isArray(parsed)) {
      throw new Error('IMAP worker output must be a JSON array.')
    }

    return parsed.filter(
      (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object'
    )
  } catch (error) {
    throw new Error(
      `IMAP worker output parsing failed: ${error instanceof Error ? error.message : 'invalid output'}`
    )
  }
}

export const emailImapService = {
  async fetchUnread(account: ImapFetchAccount, max = 50): Promise<Array<Record<string, unknown>>> {
    const workerPath = resolveWorkerPath()

    const passwordKey = resolvePasswordEnvKey(account.accountId)
    const password = process.env[passwordKey] ?? process.env.PRANA_EMAIL_APP_PASSWORD
    if (!password) {
      throw new Error(
        `Missing IMAP app password. Set ${passwordKey} (preferred) or PRANA_EMAIL_APP_PASSWORD.`
      )
    }

    const pythonCommand = process.env.PRANA_EMAIL_PYTHON_COMMAND ?? 'python'
    const args = [
      workerPath,
      '--host',
      account.imapHost,
      '--port',
      String(account.imapPort),
      '--use-tls',
      account.useTls ? 'true' : 'false',
      '--username',
      account.address,
      '--max',
      String(max),
      '--last-uid',
      String(Math.max(0, account.lastReadUID))
    ]

    const result = await executeCommand(pythonCommand, args, 25_000, undefined, {
      PRANA_IMAP_PASSWORD: password
    })

    if (!result.ok) {
      throw new Error(
        result.stderr.trim() || result.stdout.trim() || 'IMAP unread fetch worker execution failed'
      )
    }

    return parseWorkerRows(result.stdout)
  }
}
