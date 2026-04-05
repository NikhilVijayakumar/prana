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
  cron: {
    list: () => ipcRenderer.invoke('cron:list'),
    upsert: (payload: {
      id: string
      name: string
      expression: string
      target?: string
      recoveryPolicy?: 'SKIP' | 'RUN_ONCE' | 'CATCH_UP'
      enabled?: boolean
      retentionDays?: number
      maxRuntimeMs?: number
    }) => ipcRenderer.invoke('cron:upsert', payload),
    remove: (payload: { id: string }) => ipcRenderer.invoke('cron:remove', payload),
    pause: (payload: { id: string }) => ipcRenderer.invoke('cron:pause', payload),
    resume: (payload: { id: string }) => ipcRenderer.invoke('cron:resume', payload),
    runNow: (payload: { id: string }) => ipcRenderer.invoke('cron:run-now', payload),
    tick: () => ipcRenderer.invoke('cron:tick'),
    telemetry: () => ipcRenderer.invoke('cron:telemetry')
  },
  operations: {
    getInfrastructure: () => ipcRenderer.invoke('operations:get-infrastructure'),
    createCronProposal: (payload: {
      id: string
      name: string
      expression: string
      retentionDays?: number
      maxRuntimeMs?: number
    }) => ipcRenderer.invoke('operations:create-cron-proposal', payload),
    listCronProposals: (payload?: {
      status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN'
    }) => ipcRenderer.invoke('operations:list-cron-proposals', payload),
    reviewCronProposal: (payload: {
      proposalId: string
      status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN'
      reviewer: string
      reviewNote?: string
    }) => ipcRenderer.invoke('operations:review-cron-proposal', payload),
    getGoogleBridgeSnapshot: () => ipcRenderer.invoke('operations:get-google-bridge-snapshot'),
    runGoogleDriveSync: (payload?: { source?: 'MANUAL' | 'CRON' }) =>
      ipcRenderer.invoke('operations:run-google-drive-sync', payload),
    ensureGoogleDriveSyncSchedule: () =>
      ipcRenderer.invoke('operations:ensure-google-drive-sync-schedule'),
    publishGooglePolicyDocument: (payload: { policyId: string; htmlContent: string }) =>
      ipcRenderer.invoke('operations:publish-google-policy-document', payload),
    pullGoogleDocumentToVault: (payload: { documentId: string; vaultTargetPath: string }) =>
      ipcRenderer.invoke('operations:pull-google-document-to-vault', payload)
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
  },
  visual: {
    seedDefaultTemplates: () => ipcRenderer.invoke('visual:seed-default-templates'),
    registerTemplate: (payload: {
      templateId: string
      version: string
      templateType: 'document' | 'presentation' | 'slide' | 'poster' | 'table'
      name: string
      supportedFormats: Array<'html' | 'docs' | 'slides' | 'sheets' | 'pdf' | 'ppt'>
      htmlContent: string
      requiredVariables?: string[]
    }) => ipcRenderer.invoke('visual:register-template', payload),
    validateTemplate: (payload: {
      templateId: string
      version: string
      templateType: 'document' | 'presentation' | 'slide' | 'poster' | 'table'
      name: string
      supportedFormats: Array<'html' | 'docs' | 'slides' | 'sheets' | 'pdf' | 'ppt'>
      htmlContent: string
      requiredVariables?: string[]
    }) => ipcRenderer.invoke('visual:validate-template', payload),
    listTemplates: (payload?: {
      templateType?: 'document' | 'presentation' | 'slide' | 'poster' | 'table'
      includeContent?: boolean
    }) => ipcRenderer.invoke('visual:list-templates', payload),
    listTemplateVersions: (payload: { templateId: string; includeContent?: boolean }) =>
      ipcRenderer.invoke('visual:list-template-versions', payload),
    getTemplate: (payload: { templateId: string; version?: string; includeContent?: boolean }) =>
      ipcRenderer.invoke('visual:get-template', payload),
    previewTemplate: (payload: {
      templateId: string
      version?: string
      data: Record<string, unknown>
      injectTokenStyles?: boolean
    }) => ipcRenderer.invoke('visual:preview-template', payload),
    getTokenSnapshot: () => ipcRenderer.invoke('visual:get-token-snapshot'),
    retryTemplateSync: () => ipcRenderer.invoke('visual:retry-template-sync')
  },
  channels: {
    routeMessage: (payload: {
      senderId: string
      senderName?: string
      channelId: string
      roomId: string
      accountId?: string
      messageText: string
      timestampIso?: string
      sessionId?: string
      explicitTargetPersonaId?: string
      isDirector?: boolean
      dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'
      metadata?: Record<string, unknown>
    }) => ipcRenderer.invoke('channels:route-message', payload),
    getCapabilities: () => ipcRenderer.invoke('channels:get-capabilities'),
    routeInternalMessage: (payload: {
      message: string
      senderId: string
      senderName?: string
      moduleRoute: string
      targetPersonaId?: string
      roomId?: string
      sessionId?: string
      timestampIso?: string
      isDirector?: boolean
      metadata?: Record<string, unknown>
    }) => ipcRenderer.invoke('channels:route-internal-message', payload),
    routeTelegramMessage: (payload: {
      message: string
      senderId: string
      senderName?: string
      chatId?: string
      timestampIso?: string
      sessionId?: string
      explicitTargetPersonaId?: string
      isDirector?: boolean
      dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'
      metadata?: Record<string, unknown>
    }) => ipcRenderer.invoke('channels:route-telegram-message', payload),
    listConversations: (payload?: {
      channel?: 'internal-chat' | 'telegram' | 'whatsapp' | 'webhook' | 'api' | string
      limit?: number
    }) => ipcRenderer.invoke('channels:list-conversations', payload),
    getConversationHistory: (payload: { conversationKey: string; limit?: number }) =>
      ipcRenderer.invoke('channels:get-conversation-history', payload)
  },
  workOrders: {
    submitDirectorRequest: (payload: {
      moduleRoute: string
      targetEmployeeId?: string
      message: string
      timestampIso?: string
    }) => ipcRenderer.invoke('work-orders:submit-director-request', payload),
    startNext: () => ipcRenderer.invoke('work-orders:start-next'),
    processNextToReview: () => ipcRenderer.invoke('work-orders:process-next'),
    complete: (payload: { workOrderId: string; summary?: string }) =>
      ipcRenderer.invoke('work-orders:complete', payload),
    fail: (payload: { workOrderId: string; error?: string }) =>
      ipcRenderer.invoke('work-orders:fail', payload),
    approve: (payload: { workOrderId: string; summary?: string }) =>
      ipcRenderer.invoke('work-orders:approve', payload),
    reject: (payload: { workOrderId: string; error?: string }) =>
      ipcRenderer.invoke('work-orders:reject', payload),
    list: () => ipcRenderer.invoke('work-orders:list'),
    get: (payload: { id: string }) => ipcRenderer.invoke('work-orders:get', payload),
    listQueue: () => ipcRenderer.invoke('work-orders:queue-list')
  },
  context: {
    bootstrapSession: (payload: {
      sessionId: string
      budget?: {
        maxTokens?: number
        reservedOutputTokens?: number
        compactThresholdTokens?: number
        highWaterMarkRatio?: number
      }
      modelConfig?: {
        provider: 'lmstudio' | 'openrouter' | 'gemini' | 'custom'
        model?: string
        contextWindow?: number
        reservedOutputTokens?: number
      }
    }) => ipcRenderer.invoke('context:bootstrap-session', payload),
    ingest: (payload: { sessionId: string; role: 'system' | 'user' | 'assistant' | 'tool'; content: string }) =>
      ipcRenderer.invoke('context:ingest', payload),
    ingestBatch: (payload: {
      sessionId: string
      messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>
    }) => ipcRenderer.invoke('context:ingest-batch', payload),
    assemble: (payload: { sessionId: string; maxTokensOverride?: number }) =>
      ipcRenderer.invoke('context:assemble', payload),
    compact: (payload: { sessionId: string; reason?: string }) =>
      ipcRenderer.invoke('context:compact', payload),
    afterTurn: (payload: { sessionId: string }) =>
      ipcRenderer.invoke('context:after-turn', payload),
    prepareNewContext: (payload: { sessionId: string }) =>
      ipcRenderer.invoke('context:prepare-new-context', payload),
    startNewWithContext: (payload: {
      sourceSessionId: string
      targetSessionId: string
      summaryOverride?: string
    }) => ipcRenderer.invoke('context:start-new-with-context', payload),
    getLatestDigest: (payload: { sessionId: string }) =>
      ipcRenderer.invoke('context:get-latest-digest', payload),
    listDigests: (payload: { sessionId: string; limit?: number }) =>
      ipcRenderer.invoke('context:list-digests', payload),
    getSessionSnapshot: (payload: { sessionId: string }) =>
      ipcRenderer.invoke('context:get-session-snapshot', payload),
    listSessions: () => ipcRenderer.invoke('context:list-sessions'),
    getTelemetry: () => ipcRenderer.invoke('context:get-telemetry'),
    disposeSession: (payload: { sessionId: string }) =>
      ipcRenderer.invoke('context:dispose-session', payload),
    prepareSubagentSpawn: (payload: { parentSessionId: string; childSessionId: string }) =>
      ipcRenderer.invoke('context:prepare-subagent-spawn', payload),
    onSubagentEnded: (payload: { parentSessionId: string; childSessionId: string; summary: string }) =>
      ipcRenderer.invoke('context:on-subagent-ended', payload)
  }
    },
    notifications: {
      list: (payload?: {
        filters?: {
          priority?: Array<'INFO' | 'WARN' | 'CRITICAL' | 'ACTION'>
          source?: string
          startTime?: string
          endTime?: string
          unreadOnly?: boolean
        }
        limit?: number
        offset?: number
      }) => ipcRenderer.invoke('notifications:list', payload),
      getUnreadCount: () => ipcRenderer.invoke('notifications:get-unread-count'),
      markRead: (payload: { notificationIds: string[] }) =>
        ipcRenderer.invoke('notifications:mark-read', payload),
      markDismissed: (payload: { notificationIds: string[] }) =>
        ipcRenderer.invoke('notifications:mark-dismissed', payload),
      recordAction: (payload: { notificationId: string; action: 'VIEWED' | 'DISMISSED' | 'ACTIONED' }) =>
        ipcRenderer.invoke('notifications:record-action', payload),
      getTelemetry: () => ipcRenderer.invoke('notifications:get-telemetry'),
      cleanup: (payload?: { days?: number }) =>
        ipcRenderer.invoke('notifications:cleanup', payload)
    }
  })
