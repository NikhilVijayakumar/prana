import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getAppDataRoot } from './governanceRepoService'

export interface BrowserAgentSession {
  sessionId: string
  draftId: string
  status: 'ACTIVE' | 'FAILED' | 'CLOSED'
  startedAt: string
  updatedAt: string
  currentUrl: string
  title: string
  lastError: string | null
  profileId: string | null
  profilePath: string | null
}

export interface StartBrowserSessionPayload {
  draftId: string
  url: string
  headless?: boolean
  profileId?: string
  retainProfileOnStop?: boolean
  requireHumanLogin?: boolean
}

interface BrowserPage {
  goto(url: string, options?: { waitUntil?: 'domcontentloaded' }): Promise<void>
  title(): Promise<string>
  url(): string
  textContent(selector: string): Promise<string | null>
}

interface BrowserContext {
  pages(): BrowserPage[]
  newPage(): Promise<BrowserPage>
  close(): Promise<void>
}

interface ChromiumRuntime {
  launchPersistentContext(
    userDataDir: string,
    options: { headless: boolean }
  ): Promise<BrowserContext>
}

interface BrowserSessionRuntime {
  context: BrowserContext
  page: BrowserPage
  userDataDir: string
  retainProfileOnStop: boolean
}

const sessions = new Map<string, BrowserAgentSession>()
const runtimes = new Map<string, BrowserSessionRuntime>()

const nowIso = (): string => new Date().toISOString()

const createId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const getProfileRoot = (): string => join(getAppDataRoot(), 'browser-profiles')

const sanitizeProfileId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '_')

const resolveUserDataDir = async (payload: StartBrowserSessionPayload): Promise<string> => {
  if (payload.profileId && payload.profileId.trim().length > 0) {
    const safeId = sanitizeProfileId(payload.profileId.trim())
    const profilePath = join(getProfileRoot(), safeId)
    await mkdir(profilePath, { recursive: true })
    return profilePath
  }

  return mkdtemp(join(tmpdir(), 'prana-browser-'))
}

const updateSession = (
  sessionId: string,
  patch: Partial<BrowserAgentSession>
): BrowserAgentSession | null => {
  const existing = sessions.get(sessionId)
  if (!existing) {
    return null
  }

  const updated: BrowserAgentSession = {
    ...existing,
    ...patch,
    updatedAt: nowIso()
  }
  sessions.set(sessionId, updated)
  return updated
}

const loadChromium = async (): Promise<ChromiumRuntime> => {
  const mod = await import('@playwright/test')
  const chromium = (mod as unknown as { chromium?: ChromiumRuntime }).chromium
  if (!chromium) {
    throw new Error('Playwright chromium runtime is unavailable.')
  }
  return chromium
}

export const emailBrowserAgentService = {
  async startSession(payload: StartBrowserSessionPayload): Promise<BrowserAgentSession> {
    const sessionId = createId('browser')
    const startedAt = nowIso()
    const profileId = payload.profileId?.trim() || null
    const baseRecord: BrowserAgentSession = {
      sessionId,
      draftId: payload.draftId,
      status: 'FAILED',
      startedAt,
      updatedAt: startedAt,
      currentUrl: payload.url,
      title: '',
      lastError: null,
      profileId,
      profilePath: null
    }

    sessions.set(sessionId, baseRecord)

    try {
      const chromium = await loadChromium()
      const userDataDir = await resolveUserDataDir(payload)
      const headless = payload.requireHumanLogin ? false : (payload.headless ?? true)
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless
      })

      const page = context.pages()[0] ?? (await context.newPage())
      await page.goto(payload.url, { waitUntil: 'domcontentloaded' })

      const title = await page.title()
      const currentUrl = page.url()

      runtimes.set(sessionId, {
        context,
        page,
        userDataDir,
        retainProfileOnStop: payload.retainProfileOnStop ?? Boolean(profileId)
      })

      const updated = updateSession(sessionId, {
        status: 'ACTIVE',
        title,
        currentUrl,
        lastError: null,
        profilePath: userDataDir
      })

      return updated ?? baseRecord
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown browser session error'
      const failed = updateSession(sessionId, {
        status: 'FAILED',
        lastError: message
      })
      return (
        failed ?? {
          ...baseRecord,
          lastError: message
        }
      )
    }
  },

  listSessions(): BrowserAgentSession[] {
    return Array.from(sessions.values()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  },

  getSession(sessionId: string): BrowserAgentSession | null {
    return sessions.get(sessionId) ?? null
  },

  async navigate(sessionId: string, url: string): Promise<BrowserAgentSession> {
    const runtime = runtimes.get(sessionId)
    if (!runtime) {
      throw new Error('Browser session runtime is not active.')
    }

    await runtime.page.goto(url, { waitUntil: 'domcontentloaded' })
    const title = await runtime.page.title()
    const currentUrl = runtime.page.url()

    const updated = updateSession(sessionId, {
      currentUrl,
      title,
      lastError: null
    })

    if (!updated) {
      throw new Error('Browser session not found.')
    }

    return updated
  },

  async snapshot(sessionId: string): Promise<{
    session: BrowserAgentSession
    previewText: string
  }> {
    const runtime = runtimes.get(sessionId)
    const session = sessions.get(sessionId)
    if (!runtime || !session) {
      throw new Error('Browser session runtime is not active.')
    }

    const title = await runtime.page.title()
    const currentUrl = runtime.page.url()
    const bodyText = await runtime.page.textContent('body')
    const previewText = (bodyText ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000)

    const updated = updateSession(sessionId, {
      currentUrl,
      title,
      lastError: null
    })

    return {
      session: updated ?? session,
      previewText
    }
  },

  async stopSession(sessionId: string): Promise<BrowserAgentSession | null> {
    const runtime = runtimes.get(sessionId)
    const existing = sessions.get(sessionId) ?? null

    if (runtime) {
      try {
        await runtime.context.close()
      } catch {
        // Ignore close failures on teardown.
      }
      if (!runtime.retainProfileOnStop) {
        try {
          await rm(runtime.userDataDir, { recursive: true, force: true })
        } catch {
          // Ignore temp directory cleanup failures.
        }
      }
      runtimes.delete(sessionId)
    }

    if (!existing) {
      return null
    }

    const updated = updateSession(sessionId, {
      status: 'CLOSED'
    })

    return updated ?? existing
  }
}
