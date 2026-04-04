import { contextBridge, ipcRenderer } from 'electron'

// Minimal preload bridge for integration verification and app config checks.
contextBridge.exposeInMainWorld('api', {
  app: {
    getBootstrapConfig: () => ipcRenderer.invoke('app:get-bootstrap-config'),
    bootstrapHost: (payload: { config: unknown }) =>
      ipcRenderer.invoke('app:bootstrap-host', payload),
    getRuntimeConfig: () => ipcRenderer.invoke('app:get-runtime-config'),
    getBrandingConfig: () => ipcRenderer.invoke('app:get-branding-config'),
    getIntegrationStatus: () => ipcRenderer.invoke('app:get-integration-status'),
    getStartupStatus: () => ipcRenderer.invoke('app:get-startup-status')
  },
  email: {
    configureAccount: (payload: {
      accountId?: string
      label: string
      address: string
      provider: 'gmail' | 'outlook' | 'imap-generic'
      imapHost: string
      imapPort: number
      useTls: boolean
      cronSchedule: 'once_daily' | 'twice_daily'
      cronTimes: string[]
      isActive: boolean
    }) => ipcRenderer.invoke('email:configure-account', payload),
    listAccounts: () => ipcRenderer.invoke('email:list-accounts'),
    fetchUnread: (payload: { accountId: string; source?: 'MANUAL' | 'CRON' | 'WEBHOOK' }) =>
      ipcRenderer.invoke('email:fetch-unread', payload),
    fetchAllAccounts: (payload?: { source?: 'MANUAL' | 'CRON' | 'WEBHOOK' }) =>
      ipcRenderer.invoke('email:fetch-all-accounts', payload),
    getTriageSummary: () => ipcRenderer.invoke('email:get-triage-summary'),
    selectForDraft: (payload: { actionItemIds: string[]; action: 'DRAFT_REPLY' | 'COMPOSE_NEW' }) =>
      ipcRenderer.invoke('email:select-for-draft', payload),
    composeNewDraft: (payload: { subject: string; recipientAddress: string | null }) =>
      ipcRenderer.invoke('email:compose-new-draft', payload),
    contributeToDraft: (payload: {
      draftId: string
      agentId: string
      sectionIndex: number
      content: string
    }) => ipcRenderer.invoke('email:contribute-to-draft', payload),
    getDraft: (payload: { draftId: string }) => ipcRenderer.invoke('email:get-draft', payload),
    approveDraft: (payload: { draftId: string }) =>
      ipcRenderer.invoke('email:approve-draft', payload),
    sendDraft: (payload: { draftId: string }) => ipcRenderer.invoke('email:send-draft', payload),
    markBatchRead: (payload: {
      accountId: string
      batchId: string
      directorConfirmed?: boolean
      humanConfirmed?: boolean
    }) => ipcRenderer.invoke('email:mark-batch-read', payload),
    getBatchHistory: (payload?: { accountId?: string }) =>
      ipcRenderer.invoke('email:get-batch-history', payload),
    listKnowledgeContext: (payload?: {
      agentId?: string
      accountId?: string
      query?: string
      limit?: number
    }) => ipcRenderer.invoke('email:list-knowledge-context', payload),
    saveKnowledgeContext: (payload: {
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
    }) => ipcRenderer.invoke('email:save-knowledge-context', payload),
    cleanupKnowledgeContext: (payload?: {
      maxRows?: number
      maxRowsPerAgent?: number
      maxAgeDays?: number
    }) => ipcRenderer.invoke('email:cleanup-knowledge-context', payload),
    startBrowserSession: (payload: { draftId: string; url: string; headless?: boolean }) =>
      ipcRenderer.invoke('email:browser-session-start', payload),
    startGmailHumanLoop: (payload: { accountId: string; draftId?: string; inboxUrl?: string }) =>
      ipcRenderer.invoke('email:gmail-human-loop-start', payload),
    resumeGmailSession: (payload: {
      accountId: string
      draftId?: string
      inboxUrl?: string
      headless?: boolean
    }) => ipcRenderer.invoke('email:gmail-human-loop-resume', payload),
    notifyGmailPubSub: (payload: {
      accountId?: string
      emailAddress?: string
      historyId?: string
      triggerBrowserFallbackOnFailure?: boolean
      inboxUrl?: string
    }) => ipcRenderer.invoke('email:gmail-pubsub-notify', payload),
    listBrowserSessions: () => ipcRenderer.invoke('email:browser-session-list'),
    navigateBrowserSession: (payload: { sessionId: string; url: string }) =>
      ipcRenderer.invoke('email:browser-session-navigate', payload),
    snapshotBrowserSession: (payload: { sessionId: string }) =>
      ipcRenderer.invoke('email:browser-session-snapshot', payload),
    stopBrowserSession: (payload: { sessionId: string }) =>
      ipcRenderer.invoke('email:browser-session-stop', payload)
  }
})
