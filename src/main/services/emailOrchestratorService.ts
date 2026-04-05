import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runtimeDocumentStoreService } from './runtimeDocumentStoreService'
import { getAppDataRoot } from './governanceRepoService'
import { emailBrowserAgentService } from './emailBrowserAgentService'
import { cronSchedulerService } from './cronSchedulerService'
import { emailKnowledgeContextStoreService } from './emailKnowledgeContextStoreService'
import { emailImapService } from './emailImapService'

export interface EmailAccount {
  accountId: string
  label: string
  address: string
  provider: 'gmail' | 'outlook' | 'imap-generic'
  imapHost: string
  imapPort: number
  useTls: boolean
  credentials: 'runtime-local'
  cronSchedule: 'once_daily' | 'twice_daily'
  cronTimes: string[]
  lastReadUID: number
  lastCheckTimestamp: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface EmailActionItem {
  id: string
  accountId: string
  emailUid: number
  subject: string
  sender: string
  senderDomain: string
  receivedAt: string
  bodyPreview: string
  priority: 'CRITICAL' | 'URGENT' | 'IMPORTANT' | 'ROUTINE'
  department: string
  directorAction: 'DRAFT_REPLY' | 'COMPOSE_NEW' | 'FYI' | 'ARCHIVE' | null
  status: 'PENDING_TRIAGE' | 'TRIAGED' | 'SELECTED' | 'DRAFT_IN_PROGRESS' | 'DRAFT_SAVED'
  assignedAgentIds: string[]
  batchId: string
  isSpam: boolean
}

export interface SharedDraft {
  draftId: string
  actionItemId: string | null
  draftType: 'REPLY' | 'NEW_COMPOSITION'
  subject: string
  recipientAddress: string | null
  mergedContent: string
  status: 'IN_PROGRESS' | 'AWAITING_REVIEW' | 'APPROVED' | 'DISCARDED'
  version: number
  createdAt: string
  updatedAt: string
}

export interface DraftContribution {
  contributionId: string
  draftId: string
  agentId: string
  sectionIndex: number
  content: string
  contributedAt: string
  version: number
}

export interface EmailBatchRecord {
  batchId: string
  accountId: string | 'ALL'
  createdAt: string
  source: 'MANUAL' | 'CRON' | 'WEBHOOK'
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL'
  fetched: number
  createdActionItems: number
  duplicateCount: number
  message: string
}

interface EmailOrchestratorStore {
  accounts: EmailAccount[]
  actionItems: EmailActionItem[]
  drafts: SharedDraft[]
  contributions: DraftContribution[]
  batches: EmailBatchRecord[]
}

const STORE_FILE = 'email-orchestrator.json'
const MAX_BATCH_HISTORY = 200
const EMAIL_HEARTBEAT_JOB_PREFIX = 'job-email-heartbeat-'

const nowIso = (): string => new Date().toISOString()

const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const sanitizeCronSegment = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '_')

const parseTime = (value: string): { hour: number; minute: number } | null => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return null
  }

  const hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  return { hour, minute }
}

const normalizeHeartbeatTimes = (account: EmailAccount): string[] => {
  const fallback = account.cronSchedule === 'twice_daily' ? ['07:00', '19:00'] : ['07:00']
  const parsed = account.cronTimes
    .map((entry) => parseTime(entry))
    .filter((entry): entry is { hour: number; minute: number } => Boolean(entry))
    .map(
      (entry) => `${String(entry.hour).padStart(2, '0')}:${String(entry.minute).padStart(2, '0')}`
    )

  const deduped = [...new Set(parsed)]
  if (deduped.length === 0) {
    return fallback
  }

  return account.cronSchedule === 'twice_daily' ? deduped.slice(0, 2) : deduped.slice(0, 1)
}

const toDailyExpression = (hhmm: string): string => {
  const parsed = parseTime(hhmm)
  if (!parsed) {
    return '0 7 * * *'
  }
  return `${parsed.minute} ${parsed.hour} * * *`
}

const heartbeatJobId = (accountId: string, index: number): string =>
  `${EMAIL_HEARTBEAT_JOB_PREFIX}${sanitizeCronSegment(accountId)}-${index}`

const getStorePath = (): string => join(getAppDataRoot(), STORE_FILE)

const defaultStore = (): EmailOrchestratorStore => ({
  accounts: [],
  actionItems: [],
  drafts: [],
  contributions: [],
  batches: []
})

const ensureStore = async (): Promise<void> => {
  await mkdir(getAppDataRoot(), { recursive: true })
  if (!existsSync(getStorePath())) {
    await writeFile(getStorePath(), JSON.stringify(defaultStore(), null, 2), 'utf8')
  }
}

const loadStore = async (): Promise<EmailOrchestratorStore> => {
  await ensureStore()
  try {
    const raw = await readFile(getStorePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<EmailOrchestratorStore>
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
      contributions: Array.isArray(parsed.contributions) ? parsed.contributions : [],
      batches: Array.isArray(parsed.batches) ? parsed.batches : []
    }
  } catch {
    return defaultStore()
  }
}

const saveStore = async (store: EmailOrchestratorStore): Promise<void> => {
  await ensureStore()
  await writeFile(getStorePath(), JSON.stringify(store, null, 2), 'utf8')
}

const resolveDepartment = (subject: string, senderDomain: string): string => {
  const value = `${subject} ${senderDomain}`.toLowerCase()
  if (value.includes('invoice') || value.includes('finance') || value.includes('billing')) {
    return 'finance'
  }
  if (value.includes('policy') || value.includes('legal') || value.includes('compliance')) {
    return 'compliance'
  }
  if (value.includes('hiring') || value.includes('candidate') || value.includes('hr')) {
    return 'hr'
  }
  if (value.includes('ops') || value.includes('incident') || value.includes('delivery')) {
    return 'operations'
  }
  if (value.includes('strategy') || value.includes('roadmap')) {
    return 'strategy'
  }
  if (value.includes('design') || value.includes('ui') || value.includes('ux')) {
    return 'design'
  }
  return 'general'
}

const resolvePriority = (subject: string): EmailActionItem['priority'] => {
  const normalized = subject.toLowerCase()
  if (
    normalized.includes('critical') ||
    normalized.includes('outage') ||
    normalized.includes('urgent:')
  ) {
    return 'CRITICAL'
  }
  if (normalized.includes('urgent') || normalized.includes('asap')) {
    return 'URGENT'
  }
  if (normalized.includes('important')) {
    return 'IMPORTANT'
  }
  return 'ROUTINE'
}

const resolveAssignedAgents = (department: string): string[] => {
  switch (department) {
    case 'finance':
      return ['nora']
    case 'compliance':
      return ['eva']
    case 'hr':
      return ['lina']
    case 'operations':
      return ['elina']
    case 'strategy':
      return ['arya']
    case 'design':
      return ['sofia']
    default:
      return ['mira']
  }
}

const toEmailUid = (entry: Record<string, unknown>): number => {
  const candidates = [entry.uid, entry.id, entry.messageId, entry.threadId]
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return Math.floor(candidate)
    }
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      const parsed = Number(candidate)
      if (Number.isFinite(parsed)) {
        return Math.floor(parsed)
      }
    }
  }
  return Math.floor(Date.now() / 1000)
}

const toSender = (entry: Record<string, unknown>): string => {
  const sender =
    typeof entry.from === 'string'
      ? entry.from
      : typeof entry.sender === 'string'
        ? entry.sender
        : 'unknown@unknown'
  return sender
}

const toSubject = (entry: Record<string, unknown>): string => {
  const subject = typeof entry.subject === 'string' ? entry.subject : '(no subject)'
  return subject
}

const toBodyPreview = (entry: Record<string, unknown>): string => {
  const body =
    typeof entry.snippet === 'string'
      ? entry.snippet
      : typeof entry.body === 'string'
        ? entry.body
        : ''
  return body.replace(/\s+/g, ' ').trim().slice(0, 500)
}

const runImapUnreadFetch = async (
  account: EmailAccount,
  max = 50
): Promise<Array<Record<string, unknown>>> => {
  return emailImapService.fetchUnread(
    {
      accountId: account.accountId,
      address: account.address,
      imapHost: account.imapHost,
      imapPort: account.imapPort,
      useTls: account.useTls,
      lastReadUID: account.lastReadUID
    },
    max
  )
}

const containsRestrictedContent = (content: string): boolean => {
  const forbiddenPatterns = [
    /BEGIN\s+(RSA|OPENSSH)\s+PRIVATE\s+KEY/i,
    /vault[_\s-]?key/i,
    /archivePassword/i,
    /archiveSalt/i
  ]

  return forbiddenPatterns.some((pattern) => pattern.test(content))
}

const mergeDraftContributions = (
  draft: SharedDraft,
  contributions: DraftContribution[]
): string => {
  const ordered = contributions
    .filter((entry) => entry.draftId === draft.draftId)
    .sort((a, b) => {
      const sectionDelta = a.sectionIndex - b.sectionIndex
      if (sectionDelta !== 0) {
        return sectionDelta
      }
      const versionDelta = a.version - b.version
      if (versionDelta !== 0) {
        return versionDelta
      }
      return a.contributedAt.localeCompare(b.contributedAt)
    })

  return ordered.map((entry) => `## ${entry.agentId}\n\n${entry.content.trim()}`).join('\n\n')
}

const pushBatch = (store: EmailOrchestratorStore, batch: EmailBatchRecord): void => {
  store.batches.unshift(batch)
  if (store.batches.length > MAX_BATCH_HISTORY) {
    store.batches.length = MAX_BATCH_HISTORY
  }
}

export const emailOrchestratorService = {
  async configureAccount(
    input: Omit<
      EmailAccount,
      'accountId' | 'createdAt' | 'updatedAt' | 'lastCheckTimestamp' | 'lastReadUID' | 'credentials'
    > & {
      accountId?: string
    }
  ): Promise<EmailAccount> {
    const store = await loadStore()
    const now = nowIso()

    const existing = input.accountId
      ? store.accounts.find((entry) => entry.accountId === input.accountId)
      : null
    const account: EmailAccount = {
      accountId: existing?.accountId ?? createId('acct'),
      label: input.label,
      address: input.address,
      provider: input.provider,
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      useTls: input.useTls,
      credentials: 'runtime-local',
      cronSchedule: input.cronSchedule,
      cronTimes: input.cronTimes,
      lastReadUID: existing?.lastReadUID ?? 0,
      lastCheckTimestamp: existing?.lastCheckTimestamp ?? now,
      isActive: input.isActive,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }

    if (existing) {
      store.accounts = store.accounts.map((entry) =>
        entry.accountId === existing.accountId ? account : entry
      )
    } else {
      store.accounts.unshift(account)
    }

    await saveStore(store)

    await this.syncHeartbeatSchedules()
    return account
  },

  async syncHeartbeatSchedules(): Promise<{ configuredJobs: string[]; removedJobs: string[] }> {
    const store = await loadStore()
    const accounts = [...store.accounts]
    const activeAccounts = accounts.filter((entry) => entry.isActive)

    const existingJobs = await cronSchedulerService.listJobs()
    const existingHeartbeatJobs = existingJobs.filter((job) =>
      job.id.startsWith(EMAIL_HEARTBEAT_JOB_PREFIX)
    )
    const removedJobs: string[] = []

    for (const job of existingHeartbeatJobs) {
      const removed = await cronSchedulerService.removeJob(job.id)
      if (removed) {
        removedJobs.push(job.id)
      }
      cronSchedulerService.unregisterJobExecutor(job.id)
    }

    const configuredJobs: string[] = []
    for (const account of activeAccounts) {
      const times = normalizeHeartbeatTimes(account)

      for (let index = 0; index < times.length; index += 1) {
        const hhmm = times[index]
        const id = heartbeatJobId(account.accountId, index)
        const expression = toDailyExpression(hhmm)

        await cronSchedulerService.upsertJob({
          id,
          name: `Email Heartbeat ${account.label} (${hhmm})`,
          expression,
          enabled: true,
          retentionDays: 30,
          maxRuntimeMs: 30_000
        })

        cronSchedulerService.registerJobExecutor(id, async () => {
          const batch = await this.fetchUnread(account.accountId, 'CRON')
          if (batch.status === 'FAILED' && account.provider === 'gmail') {
            await emailBrowserAgentService.startSession({
              draftId: `gmail-cron-fallback-${account.accountId}`,
              url: 'https://mail.google.com/mail/u/0/#inbox',
              headless: false,
              profileId: `gmail-${account.accountId}`,
              retainProfileOnStop: true,
              requireHumanLogin: true
            })
          }
        })

        configuredJobs.push(id)
      }
    }

    return {
      configuredJobs,
      removedJobs
    }
  },

  async listAccounts(): Promise<EmailAccount[]> {
    const store = await loadStore()
    return [...store.accounts].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  },

  async fetchUnread(
    accountId: string,
    source: 'MANUAL' | 'CRON' | 'WEBHOOK' = 'MANUAL'
  ): Promise<EmailBatchRecord> {
    const store = await loadStore()
    const account = store.accounts.find((entry) => entry.accountId === accountId)
    if (!account) {
      throw new Error('Email account not found.')
    }

    const batchId = createId('batch')
    const createdAt = nowIso()

    try {
      const rows = await runImapUnreadFetch(account, 50)

      let createdActionItems = 0
      let duplicateCount = 0
      let highestUid = account.lastReadUID

      for (const row of rows) {
        const emailUid = toEmailUid(row)
        highestUid = Math.max(highestUid, emailUid)

        const duplicate = store.actionItems.find(
          (entry) => entry.accountId === account.accountId && entry.emailUid === emailUid
        )
        if (duplicate) {
          duplicateCount += 1
          continue
        }

        const sender = toSender(row)
        const subject = toSubject(row)
        const senderDomain = sender.includes('@') ? sender.split('@')[1] : 'unknown'
        const department = resolveDepartment(subject, senderDomain)

        const actionItem: EmailActionItem = {
          id: createId('act'),
          accountId: account.accountId,
          emailUid,
          subject,
          sender,
          senderDomain,
          receivedAt: typeof row.internalDate === 'string' ? row.internalDate : createdAt,
          bodyPreview: toBodyPreview(row),
          priority: resolvePriority(subject),
          department,
          directorAction: null,
          status: 'TRIAGED',
          assignedAgentIds: resolveAssignedAgents(department),
          batchId,
          isSpam: false
        }

        store.actionItems.unshift(actionItem)
        for (const assignedAgentId of actionItem.assignedAgentIds) {
          await emailKnowledgeContextStoreService.upsertEntry({
            sourceKey: `intake:${account.accountId}:${emailUid}:${assignedAgentId}`,
            agentId: assignedAgentId,
            accountId: account.accountId,
            emailUid,
            threadKey:
              typeof row.threadId === 'string'
                ? row.threadId
                : typeof row.threadId === 'number'
                  ? String(row.threadId)
                  : `uid:${emailUid}`,
            contextKind: 'INTAKE',
            subject,
            sender,
            summary: `${subject}\n${toBodyPreview(row)}`,
            priority:
              resolvePriority(subject) === 'CRITICAL'
                ? 4
                : resolvePriority(subject) === 'URGENT'
                  ? 3
                  : resolvePriority(subject) === 'IMPORTANT'
                    ? 2
                    : 1,
            metadata: {
              department,
              senderDomain,
              batchId,
              source
            }
          })
        }
        createdActionItems += 1
      }

      const updatedAccount: EmailAccount = {
        ...account,
        lastReadUID: highestUid,
        lastCheckTimestamp: createdAt,
        updatedAt: createdAt
      }
      store.accounts = store.accounts.map((entry) =>
        entry.accountId === account.accountId ? updatedAccount : entry
      )

      const batch: EmailBatchRecord = {
        batchId,
        accountId,
        createdAt,
        source,
        status: duplicateCount > 0 && createdActionItems === 0 ? 'PARTIAL' : 'SUCCESS',
        fetched: rows.length,
        createdActionItems,
        duplicateCount,
        message: `Fetched ${rows.length} messages for ${account.label}`
      }
      pushBatch(store, batch)
      await emailKnowledgeContextStoreService.cleanup()

      await saveStore(store)
      return batch
    } catch (error) {
      const batch: EmailBatchRecord = {
        batchId,
        accountId,
        createdAt,
        source,
        status: 'FAILED',
        fetched: 0,
        createdActionItems: 0,
        duplicateCount: 0,
        message: error instanceof Error ? error.message : 'Unread fetch failed'
      }
      pushBatch(store, batch)
      await saveStore(store)
      return batch
    }
  },

  async fetchAllAccounts(
    source: 'MANUAL' | 'CRON' | 'WEBHOOK' = 'MANUAL'
  ): Promise<EmailBatchRecord[]> {
    const accounts = await this.listAccounts()
    const active = accounts.filter((entry) => entry.isActive)

    const output: EmailBatchRecord[] = []
    for (const account of active) {
      output.push(await this.fetchUnread(account.accountId, source))
    }
    return output
  },

  async getTriageSummary(): Promise<{
    total: number
    byPriority: Record<EmailActionItem['priority'], number>
    byDepartment: Record<string, number>
    pendingDirectorAction: number
    pendingHumanAction: number
  }> {
    const store = await loadStore()
    const byPriority: Record<EmailActionItem['priority'], number> = {
      CRITICAL: 0,
      URGENT: 0,
      IMPORTANT: 0,
      ROUTINE: 0
    }
    const byDepartment: Record<string, number> = {}

    for (const item of store.actionItems) {
      byPriority[item.priority] += 1
      byDepartment[item.department] = (byDepartment[item.department] ?? 0) + 1
    }

    return {
      total: store.actionItems.length,
      byPriority,
      byDepartment,
      pendingDirectorAction: store.actionItems.filter((entry) => entry.directorAction === null)
        .length,
      pendingHumanAction: store.actionItems.filter((entry) => entry.directorAction === null).length
    }
  },

  async selectForDraft(payload: {
    actionItemIds: string[]
    action: 'DRAFT_REPLY' | 'COMPOSE_NEW'
  }): Promise<SharedDraft[]> {
    const store = await loadStore()
    const drafts: SharedDraft[] = []

    for (const actionItemId of payload.actionItemIds) {
      const item = store.actionItems.find((entry) => entry.id === actionItemId)
      if (!item) {
        continue
      }

      item.directorAction = payload.action
      item.status = 'DRAFT_IN_PROGRESS'

      const draft: SharedDraft = {
        draftId: createId('draft'),
        actionItemId: item.id,
        draftType: payload.action === 'DRAFT_REPLY' ? 'REPLY' : 'NEW_COMPOSITION',
        subject: item.subject,
        recipientAddress: item.sender,
        mergedContent: '',
        status: 'IN_PROGRESS',
        version: 1,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }

      store.drafts.unshift(draft)
      drafts.push(draft)
    }

    await saveStore(store)
    return drafts
  },

  async composeNewDraft(payload: {
    subject: string
    recipientAddress: string | null
  }): Promise<SharedDraft> {
    const store = await loadStore()
    const draft: SharedDraft = {
      draftId: createId('draft'),
      actionItemId: null,
      draftType: 'NEW_COMPOSITION',
      subject: payload.subject,
      recipientAddress: payload.recipientAddress,
      mergedContent: '',
      status: 'IN_PROGRESS',
      version: 1,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }

    store.drafts.unshift(draft)
    await saveStore(store)
    return draft
  },

  async contributeToDraft(payload: {
    draftId: string
    agentId: string
    sectionIndex: number
    content: string
  }): Promise<DraftContribution> {
    const store = await loadStore()
    const draft = store.drafts.find((entry) => entry.draftId === payload.draftId)
    if (!draft) {
      throw new Error('Draft not found.')
    }

    const currentVersion = Math.max(
      0,
      ...store.contributions
        .filter((entry) => entry.draftId === draft.draftId)
        .map((entry) => entry.version)
    )

    const contribution: DraftContribution = {
      contributionId: createId('ctrb'),
      draftId: draft.draftId,
      agentId: payload.agentId,
      sectionIndex: payload.sectionIndex,
      content: payload.content,
      contributedAt: nowIso(),
      version: currentVersion + 1
    }

    store.contributions.unshift(contribution)
    draft.mergedContent = mergeDraftContributions(draft, store.contributions)
    draft.status = 'AWAITING_REVIEW'
    draft.version += 1
    draft.updatedAt = nowIso()

    await saveStore(store)
    return contribution
  },

  async getDraft(draftId: string): Promise<{
    draft: SharedDraft
    contributions: DraftContribution[]
  } | null> {
    const store = await loadStore()
    const draft = store.drafts.find((entry) => entry.draftId === draftId)
    if (!draft) {
      return null
    }

    const contributions = store.contributions
      .filter((entry) => entry.draftId === draftId)
      .sort((a, b) => a.sectionIndex - b.sectionIndex)

    return {
      draft: {
        ...draft,
        mergedContent: mergeDraftContributions(draft, store.contributions)
      },
      contributions
    }
  },

  async approveDraft(draftId: string): Promise<{
    success: boolean
    reason?: string
    draft?: SharedDraft
    vaultPath?: string
  }> {
    const store = await loadStore()
    const draft = store.drafts.find((entry) => entry.draftId === draftId)
    if (!draft) {
      return {
        success: false,
        reason: 'Draft not found.'
      }
    }

    const mergedContent = mergeDraftContributions(draft, store.contributions)
    if (!mergedContent.trim()) {
      return {
        success: false,
        reason: 'Draft has no contributions.'
      }
    }

    if (containsRestrictedContent(mergedContent)) {
      return {
        success: false,
        reason: 'Draft content failed pre-flight security checks.'
      }
    }

    const vaultPath = `org/administration/email/drafts/${draft.draftId}.md`
    const markdown = [
      `# ${draft.subject}`,
      '',
      `- Draft ID: ${draft.draftId}`,
      `- Type: ${draft.draftType}`,
      `- Recipient: ${draft.recipientAddress ?? 'N/A'}`,
      `- Approved At: ${nowIso()}`,
      '',
      mergedContent,
      ''
    ].join('\n')

    await runtimeDocumentStoreService.writeText(vaultPath, markdown)
    await runtimeDocumentStoreService.flushPendingToVault(`email draft approve ${draft.draftId}`)

    draft.mergedContent = mergedContent
    draft.status = 'APPROVED'
    draft.version += 1
    draft.updatedAt = nowIso()

    if (draft.actionItemId) {
      const actionItem = store.actionItems.find((entry) => entry.id === draft.actionItemId)
      if (actionItem) {
        actionItem.status = 'DRAFT_SAVED'
      }
    }

    await saveStore(store)

    return {
      success: true,
      draft,
      vaultPath
    }
  },

  async sendDraft(payload: { draftId: string }): Promise<{ success: false; reason: string }> {
    return {
      success: false,
      reason: `Strict non-send policy is active. Draft ${payload.draftId} remains in review-only mode and can only be sent by a human outside this system.`
    }
  },

  async markBatchRead(payload: {
    accountId: string
    batchId: string
    directorConfirmed?: boolean
    humanConfirmed?: boolean
  }): Promise<{ success: boolean; reason?: string }> {
    const confirmed = payload.humanConfirmed ?? payload.directorConfirmed ?? false
    if (!confirmed) {
      return {
        success: false,
        reason: 'Human confirmation is required for Clear Desk batch mark-as-read.'
      }
    }

    const store = await loadStore()
    const exists = store.batches.some(
      (entry) => entry.batchId === payload.batchId && entry.accountId === payload.accountId
    )
    if (!exists) {
      return {
        success: false,
        reason: 'Batch not found.'
      }
    }

    return {
      success: true
    }
  },

  async getBatchHistory(accountId?: string): Promise<EmailBatchRecord[]> {
    const store = await loadStore()
    if (!accountId) {
      return [...store.batches]
    }
    return store.batches.filter((entry) => entry.accountId === accountId)
  },

  async startBrowserFallbackSession(payload: { draftId: string; url: string; headless?: boolean }) {
    return emailBrowserAgentService.startSession(payload)
  },

  async startGmailHumanLoopSession(payload: {
    accountId: string
    draftId?: string
    inboxUrl?: string
  }) {
    const store = await loadStore()
    const account = store.accounts.find((entry) => entry.accountId === payload.accountId)
    if (!account) {
      throw new Error('Email account not found.')
    }
    if (account.provider !== 'gmail') {
      throw new Error('Human login bootstrap is supported only for Gmail accounts.')
    }

    const session = await emailBrowserAgentService.startSession({
      draftId: payload.draftId ?? `gmail-login-${account.accountId}`,
      url: payload.inboxUrl ?? 'https://mail.google.com/mail/u/0/#inbox',
      headless: false,
      profileId: `gmail-${account.accountId}`,
      retainProfileOnStop: true,
      requireHumanLogin: true
    })

    return {
      session,
      instructions:
        'Complete Gmail login in the opened browser, enable stay-signed-in behavior, then stop the session. Future runs with the same account will reuse this saved profile.'
    }
  },

  async resumeGmailSession(payload: {
    accountId: string
    draftId?: string
    inboxUrl?: string
    headless?: boolean
  }) {
    const store = await loadStore()
    const account = store.accounts.find((entry) => entry.accountId === payload.accountId)
    if (!account) {
      throw new Error('Email account not found.')
    }
    if (account.provider !== 'gmail') {
      throw new Error('Saved browser profile reuse is supported only for Gmail accounts.')
    }

    return emailBrowserAgentService.startSession({
      draftId: payload.draftId ?? `gmail-resume-${account.accountId}`,
      url: payload.inboxUrl ?? 'https://mail.google.com/mail/u/0/#inbox',
      headless: payload.headless ?? false,
      profileId: `gmail-${account.accountId}`,
      retainProfileOnStop: true
    })
  },

  async handleGmailPubSubNotification(_payload: {
    accountId?: string
    emailAddress?: string
    historyId?: string
    triggerBrowserFallbackOnFailure?: boolean
    inboxUrl?: string
  }) {
    return {
      acknowledged: false,
      deprecated: true,
      reason:
        'Gmail Pub/Sub intake is disabled. Email ingestion is IMAP pulse-only (scheduler/manual fetch) with app-password authentication.'
    }
  },

  async listEmailKnowledgeContext(payload: {
    agentId?: string
    accountId?: string
    query?: string
    limit?: number
  }) {
    return emailKnowledgeContextStoreService.listEntries(payload)
  },

  async saveEmailKnowledgeContext(payload: {
    entryId?: string
    sourceKey?: string | null
    agentId: string
    accountId?: string | null
    emailUid?: number | null
    threadKey?: string | null
    contextKind: 'INTAKE' | 'FOLLOW_UP' | 'REMINDER' | 'SUMMARY' | 'NOTE'
    subject?: string | null
    sender?: string | null
    summary: string
    followUpAt?: string | null
    priority?: number
    metadata?: Record<string, unknown>
  }) {
    const saved = await emailKnowledgeContextStoreService.upsertEntry(payload)
    await emailKnowledgeContextStoreService.cleanup()
    return saved
  },

  async cleanupEmailKnowledgeContext(payload?: {
    maxRows?: number
    maxRowsPerAgent?: number
    maxAgeDays?: number
  }) {
    return emailKnowledgeContextStoreService.cleanup(payload)
  },

  async listBrowserFallbackSessions() {
    return emailBrowserAgentService.listSessions()
  },

  async navigateBrowserFallbackSession(payload: { sessionId: string; url: string }) {
    return emailBrowserAgentService.navigate(payload.sessionId, payload.url)
  },

  async snapshotBrowserFallbackSession(payload: { sessionId: string }) {
    return emailBrowserAgentService.snapshot(payload.sessionId)
  },

  async stopBrowserFallbackSession(payload: { sessionId: string }) {
    return emailBrowserAgentService.stopSession(payload.sessionId)
  }
}
