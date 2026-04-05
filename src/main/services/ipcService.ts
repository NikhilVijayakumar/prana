import { dialog, ipcMain } from 'electron'
import { authService } from './authService'
import { modelGatewayService } from './modelGatewayService'
import { getPublicRuntimeConfig, getRuntimeIntegrationStatus } from './runtimeConfigService'
import { sqliteConfigStoreService } from './sqliteConfigStoreService'
import { driveControllerService } from './driveControllerService'
import {
  PranaRuntimeConfig,
  getPranaRuntimeConfig,
  setPranaRuntimeConfig,
  validatePranaRuntimeConfig
} from './pranaRuntimeConfig'
import { skillSystemService } from './skillSystemService'
import { vaultService } from './vaultService'
import { operationsService } from './operationsService'
import { startupOrchestratorService } from './startupOrchestratorService'
import { contextEngineService, ContextMessageRole } from './contextEngineService'
import { subagentService } from './subagentService'
import { toolPolicyService } from './toolPolicyService'
import { hookSystemService, HookEventType } from './hookSystemService'
import { cronSchedulerService } from './cronSchedulerService'
import { memoryIndexService, MemoryClassification } from './memoryIndexService'
import { memoryQueryService } from './memoryQueryService'
import { commandRouterService } from './commandRouterService'
import { queueService } from './queueService'
import { workOrderService } from './workOrderService'
import { localExecutionProviderService, ModelProviderType } from './localExecutionProviderService'
import { skillRegistryService, SkillType } from './skillRegistry'
import { coreRegistryService } from './coreRegistryService'
import { channelRouterService } from './channelRouterService'
import { ChannelMessageEnvelope } from './types/channelAdapterTypes'
import { syncProviderService } from './syncProviderService'
import { runtimeModelAccessService } from './runtimeModelAccessService'
import { configureRegistryRuntime, RegistryRuntimeConfig } from './registryRuntimeService'
import { emailOrchestratorService } from './emailOrchestratorService'
import { templateService, VisualTemplateFormat, VisualTemplateType } from './templateService'
import { visualIdentityService } from './visualIdentityService'
import { notificationCentreService } from './notificationCentreService'
import { NotificationListFilters } from './notificationStoreService'
import { vaidyarService } from './vaidyarService'

const enforceToolPolicy = (payload: {
  actor: string
  action: string
  target?: string
  approvedByUser?: boolean
  metadata?: Record<string, unknown>
}) => {
  const policy = toolPolicyService.evaluate(payload)

  if (policy.decision !== 'ALLOW') {
    throw new Error(`${policy.reasonCode}: ${policy.message}`)
  }

  return policy
}

export const registerIpcHandlers = (options?: {
  registryRuntime?: Partial<RegistryRuntimeConfig>
}): void => {
  void templateService.ensureDefaultTemplates().catch((error) => {
    console.warn('[VISUAL_TEMPLATE_SEED_WARN] Unable to seed default visual templates:', error)
  })

  if (options?.registryRuntime) {
    configureRegistryRuntime(options.registryRuntime)
  }

  ipcMain.handle('app:get-bootstrap-config', async () => {
    return getPranaRuntimeConfig() ?? sqliteConfigStoreService.readSnapshotSync()?.config ?? null
  })

  ipcMain.handle('app:get-runtime-config', async () => {
    try {
      return getPublicRuntimeConfig()
    } catch (error) {
      return {
        errors: [error instanceof Error ? error.message : 'Runtime config unavailable.']
      }
    }
  })

  ipcMain.handle('app:get-integration-status', async () => {
    const status = getRuntimeIntegrationStatus()
    if (!status.ready) {
      return {
        ...status,
        ready: false
      }
    }

    return status
  })

  ipcMain.handle('app:get-branding-config', async () => {
    try {
      const publicConfig = getPublicRuntimeConfig()
      return publicConfig.branding
    } catch {
      return {
        appBrandName: '',
        appTitlebarTagline: '',
        appSplashSubtitle: '',
        directorSenderEmail: '',
        directorSenderName: '',
        avatarBaseUrl: ''
      }
    }
  })

  ipcMain.handle('app:bootstrap-host', async (_event, payload: { config: PranaRuntimeConfig }) => {
    try {
      const validation = validatePranaRuntimeConfig(payload.config)
      if (!validation.valid) {
        throw new Error(`Invalid host configuration: ${validation.errors.join('; ')}`)
      }

      setPranaRuntimeConfig(payload.config)
      if (payload.config.registryRoot) {
        configureRegistryRuntime({ registryRoot: payload.config.registryRoot })
      }
      await sqliteConfigStoreService.seedFromRuntimePropsIfEmpty(payload.config)

      const systemDriveStatus = await driveControllerService.initializeSystemDrive()
      if (!systemDriveStatus.success) {
        console.warn('[PRANA] System virtual drive mount degraded:', systemDriveStatus.message)
        if (driveControllerService.isFailClosedEnabled()) {
          return {
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            overallStatus: 'BLOCKED',
            stages: [
              {
                id: 'vault',
                label: 'Storage Bootstrap',
                status: 'FAILED',
                message: systemDriveStatus.message,
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString()
              }
            ],
            diagnostics: {
              virtualDrives: driveControllerService.getDiagnostics()
            }
          }
        }
      }

      const startupStatus = await startupOrchestratorService.runStartupSequence()
      if (startupStatus.overallStatus !== 'READY') {
        console.warn(
          '[PRANA] Startup orchestration completed with non-ready status:',
          startupStatus.overallStatus
        )
      }

      return startupStatus
    } catch (error) {
      console.error('[PRANA_BOOTSTRAP_ERROR] Fatal error during splash bootstrap:', error)
      return {
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        overallStatus: 'BLOCKED',
        stages: [
          {
            id: 'integration',
            label: 'Fatal Bootstrap Error',
            status: 'FAILED',
            message:
              error instanceof Error ? error.message : 'Unknown fatal error during bootstrap.',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString()
          }
        ]
      }
    }
  })

  ipcMain.handle('app:get-startup-status', async () => {
    return startupOrchestratorService.getLatestStartupStatus()
  })

  ipcMain.handle('app:get-vaidyar-report', async () => {
    return vaidyarService.getReport()
  })

  ipcMain.handle('app:run-vaidyar-pulse', async () => {
    return vaidyarService.runRuntimePulse()
  })

  ipcMain.handle('app:run-vaidyar-on-demand', async () => {
    return vaidyarService.runOnDemandDiagnostics()
  })

  ipcMain.handle('app:get-vaidyar-telemetry', async () => {
    return vaidyarService.getTelemetry()
  })

  ipcMain.handle('auth:get-status', async () => {
    return authService.getStatus()
  })

  ipcMain.handle('auth:login', async (_event, payload: { email: string; password: string }) => {
    return authService.login(payload.email, payload.password)
  })

  ipcMain.handle('auth:forgot-password', async (_event, payload: { email: string }) => {
    return authService.forgotPassword(payload.email)
  })

  ipcMain.handle('auth:reset-password', async (_event, payload: { newPassword: string }) => {
    return authService.resetPassword(payload.newPassword)
  })

  ipcMain.handle('settings:load', async () => {
    return operationsService.loadSettings()
  })

  ipcMain.handle(
    'settings:save',
    async (
      _event,
      payload: {
        language: string
        preferredModelProvider: 'lmstudio' | 'openrouter' | 'gemini'
        themeMode: 'system' | 'light' | 'dark'
        reducedMotion: boolean
        syncPushIntervalMs?: number
        syncCronEnabled?: boolean
        syncPushCronEnabled?: boolean
        syncPullCronEnabled?: boolean
        syncPushCronExpression?: string
        syncPullCronExpression?: string
        syncHealthAutoRefreshEnabled?: boolean
        syncHealthAutoRefreshIntervalMs?: number
      }
    ) => {
      return operationsService.saveSettings(payload)
    }
  )

  ipcMain.handle('sync:get-status', async () => {
    return syncProviderService.getStatus()
  })

  ipcMain.handle('sync:push-now', async () => {
    await syncProviderService.triggerBackgroundPush()
    return syncProviderService.getStatus()
  })

  ipcMain.handle('sync:pull-now', async () => {
    const result = await syncProviderService.triggerBackgroundPull()
    const status = await syncProviderService.getStatus()
    return {
      result,
      status
    }
  })

  ipcMain.handle('operations:get-runtime-channel-configuration', async () => {
    return operationsService.getRuntimeChannelConfiguration()
  })

  ipcMain.handle(
    'operations:update-runtime-channel-configuration',
    async (
      _event,
      payload: {
        provider: string
        allowedChannels: string[]
        approvedAgentsForChannels: Record<string, string[]>
        channelAccessRules: string
        telegramChannelId: string
        webhookSubscriptionUri: string
        providerCredentials: string
      }
    ) => {
      return operationsService.updateRuntimeChannelConfiguration(payload)
    }
  )

  ipcMain.handle('operations:get-administration-integration-snapshot', async () => {
    return operationsService.getAdministrationIntegrationSnapshot()
  })

  ipcMain.handle('operations:sync-administration-staff-registry', async () => {
    return operationsService.syncAdministrationStaffRegistry()
  })

  ipcMain.handle('operations:ingest-administration-feedback', async () => {
    return operationsService.ingestAdministrationFeedback()
  })

  ipcMain.handle(
    'operations:convert-document-content',
    async (
      _event,
      payload: {
        sourceFormat: 'markdown' | 'html' | 'docx'
        targetFormat: 'markdown' | 'html' | 'docx'
        content: string
      }
    ) => {
      return operationsService.convertDocumentContent(payload)
    }
  )

  ipcMain.handle(
    'operations:convert-document-file',
    async (
      _event,
      payload: {
        inputPath: string
        outputPath: string
        sourceFormat?: 'markdown' | 'html' | 'docx'
        targetFormat?: 'markdown' | 'html' | 'docx'
      }
    ) => {
      return operationsService.convertDocumentFile(payload)
    }
  )

  ipcMain.handle('operations:run-administration-kpi-happiness-evaluator', async () => {
    return operationsService.runAdministrationKpiHappinessEvaluator()
  })

  ipcMain.handle('operations:run-administration-social-trend-intelligence', async () => {
    return operationsService.runAdministrationSocialTrendIntelligence()
  })

  ipcMain.handle('operations:get-google-bridge-snapshot', async () => {
    return operationsService.getGoogleBridgeSnapshot()
  })

  ipcMain.handle(
    'operations:run-google-drive-sync',
    async (_event, payload?: { source?: 'MANUAL' | 'CRON' }) => {
      return operationsService.runGoogleDriveSync(payload)
    }
  )

  ipcMain.handle('operations:ensure-google-drive-sync-schedule', async () => {
    return operationsService.ensureGoogleDriveSyncSchedule()
  })

  ipcMain.handle(
    'operations:publish-google-policy-document',
    async (
      _event,
      payload: {
        policyId: string
        htmlContent: string
      }
    ) => {
      return operationsService.publishGooglePolicyDocument(payload)
    }
  )

  ipcMain.handle(
    'operations:pull-google-document-to-vault',
    async (
      _event,
      payload: {
        documentId: string
        vaultTargetPath: string
      }
    ) => {
      return operationsService.pullGoogleDocumentToVault(payload)
    }
  )

  ipcMain.handle('visual:seed-default-templates', async () => {
    return templateService.ensureDefaultTemplates()
  })

  ipcMain.handle(
    'visual:register-template',
    async (
      _event,
      payload: {
        templateId: string
        version: string
        templateType: VisualTemplateType
        name: string
        supportedFormats: VisualTemplateFormat[]
        htmlContent: string
        requiredVariables?: string[]
      }
    ) => {
      return templateService.registerTemplate(payload)
    }
  )

  ipcMain.handle(
    'visual:validate-template',
    async (
      _event,
      payload: {
        templateId: string
        version: string
        templateType: VisualTemplateType
        name: string
        supportedFormats: VisualTemplateFormat[]
        htmlContent: string
        requiredVariables?: string[]
      }
    ) => {
      return templateService.validateTemplate(payload)
    }
  )

  ipcMain.handle(
    'visual:list-templates',
    async (_event, payload?: { templateType?: VisualTemplateType; includeContent?: boolean }) => {
      return templateService.listTemplates(payload)
    }
  )

  ipcMain.handle(
    'visual:list-template-versions',
    async (_event, payload: { templateId: string; includeContent?: boolean }) => {
      return templateService.listTemplateVersions(payload)
    }
  )

  ipcMain.handle(
    'visual:get-template',
    async (
      _event,
      payload: { templateId: string; version?: string; includeContent?: boolean }
    ) => {
      return templateService.getTemplate(payload)
    }
  )

  ipcMain.handle(
    'visual:preview-template',
    async (
      _event,
      payload: {
        templateId: string
        version?: string
        data: Record<string, unknown>
        injectTokenStyles?: boolean
      }
    ) => {
      const tokenSnapshot = await visualIdentityService.getTokenSnapshot()
      const tokenStyleBlock =
        payload.injectTokenStyles === false
          ? ''
          : visualIdentityService.renderTokenStyleBlock(tokenSnapshot.tokens)

      const preview = await templateService.previewTemplate({
        templateId: payload.templateId,
        version: payload.version,
        data: payload.data,
        tokenStyleBlock,
      })

      return {
        ...preview,
        tokenVersion: tokenSnapshot.version,
        tokenChecksum: tokenSnapshot.checksum,
      }
    }
  )

  ipcMain.handle('visual:get-token-snapshot', async () => {
    return visualIdentityService.getTokenSnapshot()
  })

  ipcMain.handle('visual:retry-template-sync', async () => {
    return templateService.retryTemplateSync()
  })

  ipcMain.handle(
    'email:configure-account',
    async (
      _event,
      payload: {
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
      }
    ) => {
      return emailOrchestratorService.configureAccount(payload)
    }
  )

  ipcMain.handle('email:list-accounts', async () => {
    return emailOrchestratorService.listAccounts()
  })

  ipcMain.handle(
    'email:fetch-unread',
    async (_event, payload: { accountId: string; source?: 'MANUAL' | 'CRON' | 'WEBHOOK' }) => {
      return emailOrchestratorService.fetchUnread(payload.accountId, payload.source ?? 'MANUAL')
    }
  )

  ipcMain.handle(
    'email:fetch-all-accounts',
    async (_event, payload?: { source?: 'MANUAL' | 'CRON' | 'WEBHOOK' }) => {
      return emailOrchestratorService.fetchAllAccounts(payload?.source ?? 'MANUAL')
    }
  )

  ipcMain.handle('email:get-triage-summary', async () => {
    return emailOrchestratorService.getTriageSummary()
  })

  ipcMain.handle(
    'email:select-for-draft',
    async (
      _event,
      payload: {
        actionItemIds: string[]
        action: 'DRAFT_REPLY' | 'COMPOSE_NEW'
      }
    ) => {
      return emailOrchestratorService.selectForDraft(payload)
    }
  )

  ipcMain.handle(
    'email:compose-new-draft',
    async (
      _event,
      payload: {
        subject: string
        recipientAddress: string | null
      }
    ) => {
      return emailOrchestratorService.composeNewDraft(payload)
    }
  )

  ipcMain.handle(
    'email:contribute-to-draft',
    async (
      _event,
      payload: {
        draftId: string
        agentId: string
        sectionIndex: number
        content: string
      }
    ) => {
      return emailOrchestratorService.contributeToDraft(payload)
    }
  )

  ipcMain.handle('email:get-draft', async (_event, payload: { draftId: string }) => {
    return emailOrchestratorService.getDraft(payload.draftId)
  })

  ipcMain.handle('email:approve-draft', async (_event, payload: { draftId: string }) => {
    return emailOrchestratorService.approveDraft(payload.draftId)
  })

  ipcMain.handle('email:send-draft', async (_event, payload: { draftId: string }) => {
    return emailOrchestratorService.sendDraft(payload)
  })

  ipcMain.handle(
    'email:mark-batch-read',
    async (
      _event,
      payload: {
        accountId: string
        batchId: string
        directorConfirmed?: boolean
        humanConfirmed?: boolean
      }
    ) => {
      return emailOrchestratorService.markBatchRead(payload)
    }
  )

  ipcMain.handle('email:get-batch-history', async (_event, payload?: { accountId?: string }) => {
    return emailOrchestratorService.getBatchHistory(payload?.accountId)
  })

  ipcMain.handle(
    'email:browser-session-start',
    async (
      _event,
      payload: {
        draftId: string
        url: string
        headless?: boolean
      }
    ) => {
      return emailOrchestratorService.startBrowserFallbackSession(payload)
    }
  )

  ipcMain.handle(
    'email:gmail-human-loop-start',
    async (
      _event,
      payload: {
        accountId: string
        draftId?: string
        inboxUrl?: string
      }
    ) => {
      return emailOrchestratorService.startGmailHumanLoopSession(payload)
    }
  )

  ipcMain.handle(
    'email:gmail-human-loop-resume',
    async (
      _event,
      payload: {
        accountId: string
        draftId?: string
        inboxUrl?: string
        headless?: boolean
      }
    ) => {
      return emailOrchestratorService.resumeGmailSession(payload)
    }
  )

  ipcMain.handle(
    'email:gmail-pubsub-notify',
    async (
      _event,
      payload: {
        accountId?: string
        emailAddress?: string
        historyId?: string
        triggerBrowserFallbackOnFailure?: boolean
        inboxUrl?: string
      }
    ) => {
      return emailOrchestratorService.handleGmailPubSubNotification(payload)
    }
  )

  ipcMain.handle(
    'email:list-knowledge-context',
    async (
      _event,
      payload?: {
        agentId?: string
        accountId?: string
        query?: string
        limit?: number
      }
    ) => {
      return emailOrchestratorService.listEmailKnowledgeContext(payload ?? {})
    }
  )

  ipcMain.handle(
    'email:save-knowledge-context',
    async (
      _event,
      payload: {
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
      }
    ) => {
      return emailOrchestratorService.saveEmailKnowledgeContext(payload)
    }
  )

  ipcMain.handle(
    'email:cleanup-knowledge-context',
    async (
      _event,
      payload?: {
        maxRows?: number
        maxRowsPerAgent?: number
        maxAgeDays?: number
      }
    ) => {
      return emailOrchestratorService.cleanupEmailKnowledgeContext(payload)
    }
  )

  ipcMain.handle('email:browser-session-list', async () => {
    return emailOrchestratorService.listBrowserFallbackSessions()
  })

  ipcMain.handle(
    'email:browser-session-navigate',
    async (
      _event,
      payload: {
        sessionId: string
        url: string
      }
    ) => {
      return emailOrchestratorService.navigateBrowserFallbackSession(payload)
    }
  )

  ipcMain.handle(
    'email:browser-session-snapshot',
    async (_event, payload: { sessionId: string }) => {
      return emailOrchestratorService.snapshotBrowserFallbackSession(payload)
    }
  )

  ipcMain.handle('email:browser-session-stop', async (_event, payload: { sessionId: string }) => {
    return emailOrchestratorService.stopBrowserFallbackSession(payload)
  })

  ipcMain.handle('vault:list-files', async () => {
    return vaultService.listFiles()
  })

  ipcMain.handle('vault:select-and-ingest', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select files for vault ingestion',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Supported Files',
          extensions: ['csv', 'md', 'markdown', 'txt', 'json', 'pdf', 'xlsx']
        }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return []
    }

    return vaultService.ingestPaths(result.filePaths)
  })

  ipcMain.handle(
    'vault:publish',
    async (_event, payload?: { message?: string; approvedByUser?: boolean }) => {
      const policy = enforceToolPolicy({
        actor: 'DIRECTOR',
        action: 'vault.publish',
        target: 'governance-repository',
        approvedByUser: payload?.approvedByUser === true
      })

      try {
        const result = await vaultService.publishVaultChanges({
          commitMessage: payload?.message,
          approvedByUser: payload?.approvedByUser === true
        })

        toolPolicyService.reflect({
          actor: 'DIRECTOR',
          action: 'vault.publish',
          target: 'governance-repository',
          approvedByUser: payload?.approvedByUser === true,
          policyDecision: policy.decision,
          result: 'SUCCESS'
        })

        return result
      } catch (error) {
        toolPolicyService.reflect({
          actor: 'DIRECTOR',
          action: 'vault.publish',
          target: 'governance-repository',
          approvedByUser: payload?.approvedByUser === true,
          policyDecision: policy.decision,
          result: 'FAILURE'
        })
        throw error
      }
    }
  )

  ipcMain.handle('vault:create-snapshot', async (_event, payload?: { label?: string }) => {
    return vaultService.createTempSnapshot(payload?.label)
  })

  ipcMain.handle(
    'vault:resume-from-snapshot',
    async (_event, payload: { snapshotPath: string }) => {
      await vaultService.resumeFromSnapshot(payload.snapshotPath)
      return { success: true }
    }
  )

  ipcMain.handle('vault-knowledge:get-snapshot', async () => {
    return vaultService.getKnowledgeSnapshot()
  })

  ipcMain.handle('vault-knowledge:read-file', async (_event, payload: { relativePath: string }) => {
    enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'vault.knowledge.read',
      target: payload.relativePath
    })
    return vaultService.readKnowledgeFile(payload.relativePath)
  })

  ipcMain.handle(
    'vault-knowledge:approve',
    async (_event, payload: { relativePath: string; approvedByUser?: boolean }) => {
      const policy = enforceToolPolicy({
        actor: 'DIRECTOR',
        action: 'vault.knowledge.approve',
        target: payload.relativePath,
        approvedByUser: payload.approvedByUser === true
      })

      try {
        const result = await vaultService.approvePendingFile(payload.relativePath)
        toolPolicyService.reflect({
          actor: 'DIRECTOR',
          action: 'vault.knowledge.approve',
          target: payload.relativePath,
          approvedByUser: payload.approvedByUser === true,
          policyDecision: policy.decision,
          result: 'SUCCESS'
        })
        return result
      } catch (error) {
        toolPolicyService.reflect({
          actor: 'DIRECTOR',
          action: 'vault.knowledge.approve',
          target: payload.relativePath,
          approvedByUser: payload.approvedByUser === true,
          policyDecision: policy.decision,
          result: 'FAILURE'
        })
        throw error
      }
    }
  )

  ipcMain.handle(
    'vault-knowledge:reject',
    async (_event, payload: { relativePath: string; approvedByUser?: boolean }) => {
      const policy = enforceToolPolicy({
        actor: 'DIRECTOR',
        action: 'vault.knowledge.reject',
        target: payload.relativePath,
        approvedByUser: payload.approvedByUser === true
      })

      try {
        const result = await vaultService.rejectPendingFile(payload.relativePath)
        toolPolicyService.reflect({
          actor: 'DIRECTOR',
          action: 'vault.knowledge.reject',
          target: payload.relativePath,
          approvedByUser: payload.approvedByUser === true,
          policyDecision: policy.decision,
          result: 'SUCCESS'
        })
        return result
      } catch (error) {
        toolPolicyService.reflect({
          actor: 'DIRECTOR',
          action: 'vault.knowledge.reject',
          target: payload.relativePath,
          approvedByUser: payload.approvedByUser === true,
          policyDecision: policy.decision,
          result: 'FAILURE'
        })
        throw error
      }
    }
  )

  ipcMain.handle('model-gateway:probe', async () => {
    return modelGatewayService.probeGateway()
  })

  ipcMain.handle(
    'context-engine:bootstrap',
    async (
      _event,
      payload: {
        sessionId: string
        budget?: {
          maxTokens?: number
          reservedOutputTokens?: number
          compactThresholdTokens?: number
          highWaterMarkRatio?: number
        }
        modelConfig?: {
          provider?: 'lmstudio' | 'openrouter' | 'gemini'
          model?: string
          contextWindow?: number
          reservedOutputTokens?: number
        }
      }
    ) => {
      const resolvedModelConfig = await runtimeModelAccessService.resolveContextModelConfig(
        payload.modelConfig
      )
      const fallbackModelConfig = payload.modelConfig?.provider
        ? {
            provider: payload.modelConfig.provider,
            model: payload.modelConfig.model,
            contextWindow: payload.modelConfig.contextWindow,
            reservedOutputTokens: payload.modelConfig.reservedOutputTokens
          }
        : undefined
      const result = contextEngineService.bootstrapSession(
        payload.sessionId,
        payload.budget,
        resolvedModelConfig ?? fallbackModelConfig
      )
      await hookSystemService.emit('session.bootstrap', { sessionId: payload.sessionId })
      return result
    }
  )

  ipcMain.handle(
    'context-engine:ingest',
    async (_event, payload: { sessionId: string; role: ContextMessageRole; content: string }) => {
      const result = await contextEngineService.ingest(
        payload.sessionId,
        payload.role,
        payload.content
      )
      await hookSystemService.emit('session.message', {
        sessionId: payload.sessionId,
        role: payload.role
      })
      return result
    }
  )

  ipcMain.handle(
    'context-engine:ingest-batch',
    async (
      _event,
      payload: { sessionId: string; messages: Array<{ role: ContextMessageRole; content: string }> }
    ) => {
      return contextEngineService.ingestBatch(payload.sessionId, payload.messages)
    }
  )

  ipcMain.handle(
    'context-engine:assemble',
    async (_event, payload: { sessionId: string; maxTokensOverride?: number }) => {
      return contextEngineService.assemble(payload.sessionId, payload.maxTokensOverride)
    }
  )

  ipcMain.handle(
    'context-engine:compact',
    async (_event, payload: { sessionId: string; reason?: string }) => {
      return contextEngineService.compact(payload.sessionId, payload.reason)
    }
  )

  ipcMain.handle('context-engine:after-turn', async (_event, payload: { sessionId: string }) => {
    const result = await contextEngineService.afterTurn(payload.sessionId)
    await hookSystemService.emit('session.afterTurn', { sessionId: payload.sessionId })
    return result
  })

  ipcMain.handle(
    'context-engine:prepare-new-context',
    async (_event, payload: { sessionId: string }) => {
      return contextEngineService.prepareNewContext(payload.sessionId)
    }
  )

  ipcMain.handle(
    'context-engine:start-new-with-context',
    async (
      _event,
      payload: { sourceSessionId: string; targetSessionId: string; summaryOverride?: string }
    ) => {
      return contextEngineService.startNewWithContext(
        payload.sourceSessionId,
        payload.targetSessionId,
        payload.summaryOverride
      )
    }
  )

  ipcMain.handle(
    'context-engine:get-latest-digest',
    async (_event, payload: { sessionId: string }) => {
      return contextEngineService.getLatestDigest(payload.sessionId)
    }
  )

  ipcMain.handle(
    'context-engine:list-digests',
    async (_event, payload: { sessionId: string; limit?: number }) => {
      return contextEngineService.listDigests(payload.sessionId, payload.limit)
    }
  )

  ipcMain.handle(
    'context-engine:prepare-subagent-spawn',
    async (_event, payload: { parentSessionId: string; childSessionId: string }) => {
      return contextEngineService.prepareSubagentSpawn(
        payload.parentSessionId,
        payload.childSessionId
      )
    }
  )

  ipcMain.handle(
    'context-engine:on-subagent-ended',
    async (
      _event,
      payload: { parentSessionId: string; childSessionId: string; summary: string }
    ) => {
      return contextEngineService.onSubagentEnded(
        payload.parentSessionId,
        payload.childSessionId,
        payload.summary
      )
    }
  )

  ipcMain.handle('context-engine:get-session', async (_event, payload: { sessionId: string }) => {
    return contextEngineService.getSessionSnapshot(payload.sessionId)
  })

  ipcMain.handle('context-engine:list-sessions', async () => {
    return contextEngineService.listSessions()
  })

  ipcMain.handle('context-engine:get-telemetry', async () => {
    return contextEngineService.getTelemetry()
  })

  ipcMain.handle('context-engine:dispose', async (_event, payload: { sessionId: string }) => {
    return contextEngineService.disposeSession(payload.sessionId)
  })

  ipcMain.handle(
    'subagents:spawn',
    async (
      _event,
      payload: {
        agentName: string
        model?: string
        parentId?: string
        parentSessionId?: string
        sessionId?: string
        approvedByUser?: boolean
      }
    ) => {
      const parentDepth = payload.parentId ? (subagentService.get(payload.parentId)?.depth ?? 0) : 0
      const nextDepth = payload.parentId ? parentDepth + 1 : 0

      const policy = enforceToolPolicy({
        actor: payload.agentName,
        action: 'subagents.spawn',
        target: payload.parentId ?? 'root',
        approvedByUser: payload.approvedByUser === true,
        metadata: {
          depth: nextDepth,
          maxDepth: 12,
          activeSubagents: subagentService.getTelemetry().running,
          maxActiveSubagents: 128
        }
      })

      try {
        const result = subagentService.spawn(payload)
        toolPolicyService.reflect({
          actor: payload.agentName,
          action: 'subagents.spawn',
          target: payload.parentId ?? 'root',
          approvedByUser: payload.approvedByUser === true,
          policyDecision: policy.decision,
          result: 'SUCCESS',
          metadata: {
            nextDepth
          }
        })
        return result
      } catch (error) {
        toolPolicyService.reflect({
          actor: payload.agentName,
          action: 'subagents.spawn',
          target: payload.parentId ?? 'root',
          approvedByUser: payload.approvedByUser === true,
          policyDecision: policy.decision,
          result: 'FAILURE',
          metadata: {
            nextDepth
          }
        })
        throw error
      }
    }
  )

  ipcMain.handle('subagents:heartbeat', async (_event, payload: { id: string }) => {
    return subagentService.heartbeat(payload.id)
  })

  ipcMain.handle(
    'subagents:complete',
    async (_event, payload: { id: string; summary?: string }) => {
      return subagentService.complete(payload.id, payload.summary)
    }
  )

  ipcMain.handle('subagents:fail', async (_event, payload: { id: string; error?: string }) => {
    return subagentService.fail(payload.id, payload.error)
  })

  ipcMain.handle('subagents:cancel', async (_event, payload: { id: string; summary?: string }) => {
    return subagentService.cancel(payload.id, payload.summary)
  })

  ipcMain.handle('subagents:timeout-sweep', async (_event, payload?: { timeoutMs?: number }) => {
    return subagentService.timeoutSweep(payload?.timeoutMs)
  })

  ipcMain.handle('subagents:list', async () => {
    return subagentService.list()
  })

  ipcMain.handle('subagents:get', async (_event, payload: { id: string }) => {
    return subagentService.get(payload.id)
  })

  ipcMain.handle('subagents:tree', async () => {
    return subagentService.getTree()
  })

  ipcMain.handle('subagents:telemetry', async () => {
    return subagentService.getTelemetry()
  })

  ipcMain.handle('subagents:dispose', async (_event, payload: { id: string }) => {
    return subagentService.dispose(payload.id)
  })

  ipcMain.handle(
    'tool-policy:evaluate',
    async (
      _event,
      payload: {
        actor: string
        action: string
        target?: string
        approvedByUser?: boolean
        metadata?: Record<string, unknown>
      }
    ) => {
      return toolPolicyService.evaluate(payload)
    }
  )

  ipcMain.handle('tool-policy:list-audits', async () => {
    return toolPolicyService.listAudits()
  })

  ipcMain.handle('tool-policy:list-reflections', async (_event, payload?: { limit?: number }) => {
    return toolPolicyService.listReflections(payload?.limit)
  })

  ipcMain.handle('tool-policy:get-telemetry', async () => {
    return toolPolicyService.getTelemetry()
  })

  ipcMain.handle('hooks:list', async () => {
    return hookSystemService.listHooks()
  })

  ipcMain.handle(
    'hooks:set-enabled',
    async (_event, payload: { hookId: string; enabled: boolean }) => {
      return hookSystemService.setHookEnabled(payload.hookId, payload.enabled)
    }
  )

  ipcMain.handle('hooks:get-telemetry', async () => {
    return hookSystemService.getTelemetry()
  })

  ipcMain.handle('hooks:get-executions', async (_event, payload?: { limit?: number }) => {
    return hookSystemService.listExecutions(payload?.limit)
  })

  ipcMain.handle('hooks:get-notifications', async (_event, payload?: { limit?: number }) => {
    return hookSystemService.listNotifications(payload?.limit)
  })

  ipcMain.handle(
    'hooks:emit',
    async (
      _event,
      payload: { event: HookEventType; data?: Record<string, unknown>; wait?: boolean }
    ) => {
      if (payload.wait === true) {
        return hookSystemService.emitAndWait(payload.event, payload.data ?? {})
      }
      return hookSystemService.emit(payload.event, payload.data ?? {})
    }
  )

  ipcMain.handle('hooks:events', async () => {
    return hookSystemService.getEventCatalog()
  })

  // Notification centre handlers
  ipcMain.handle(
    'notifications:list',
    async (
      _event,
      payload?: { filters?: NotificationListFilters; limit?: number; offset?: number }
    ) => {
      try {
        return await notificationCentreService.getNotifications(
          payload?.filters,
          payload?.limit ?? 50,
          payload?.offset ?? 0
        )
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Failed to list notifications'
        )
      }
    }
  )

  ipcMain.handle('notifications:get-unread-count', async () => {
    try {
      return await notificationCentreService.getUnreadCount()
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Failed to get unread count'
      )
    }
  })

  ipcMain.handle(
    'notifications:mark-read',
    async (_event, payload: { notificationIds: string[] }) => {
      try {
        return await notificationCentreService.markRead(payload.notificationIds)
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Failed to mark notifications as read'
        )
      }
    }
  )

  ipcMain.handle(
    'notifications:mark-dismissed',
    async (_event, payload: { notificationIds: string[] }) => {
      try {
        return await notificationCentreService.markDismissed(payload.notificationIds)
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Failed to mark notifications as dismissed'
        )
      }
    }
  )

  ipcMain.handle(
    'notifications:record-action',
    async (
      _event,
      payload: { notificationId: string; action: 'VIEWED' | 'DISMISSED' | 'ACTIONED' }
    ) => {
      try {
        return await notificationCentreService.recordAction(
          payload.notificationId,
          payload.action
        )
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Failed to record action'
        )
      }
    }
  )

  ipcMain.handle('notifications:get-telemetry', async () => {
    try {
      return await notificationCentreService.getTelemetry()
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Failed to get telemetry'
      )
    }
  })

  ipcMain.handle('notifications:cleanup', async (_event, payload?: { days?: number }) => {
    try {
      return await notificationCentreService.cleanup(payload?.days ?? 7)
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Failed to cleanup notifications'
      )
    }
  })

  ipcMain.handle('cron:list', async () => {
    return cronSchedulerService.listJobs()
  })

  ipcMain.handle(
    'cron:upsert',
    async (
      _event,
      payload: {
        id: string
        name: string
        expression: string
        target?: string
        recoveryPolicy?: 'SKIP' | 'RUN_ONCE' | 'CATCH_UP'
        enabled?: boolean
        retentionDays?: number
        maxRuntimeMs?: number
      }
    ) => {
      return cronSchedulerService.upsertJob(payload)
    }
  )

  ipcMain.handle('cron:remove', async (_event, payload: { id: string }) => {
    return cronSchedulerService.removeJob(payload.id)
  })

  ipcMain.handle('cron:pause', async (_event, payload: { id: string }) => {
    return cronSchedulerService.pauseJob(payload.id)
  })

  ipcMain.handle('cron:resume', async (_event, payload: { id: string }) => {
    return cronSchedulerService.resumeJob(payload.id)
  })

  ipcMain.handle('cron:run-now', async (_event, payload: { id: string }) => {
    return cronSchedulerService.runNow(payload.id)
  })

  ipcMain.handle('cron:tick', async () => {
    await cronSchedulerService.tick()
    return { success: true }
  })

  ipcMain.handle('cron:telemetry', async () => {
    return cronSchedulerService.getTelemetry()
  })

  ipcMain.handle(
    'memory:query',
    async (
      _event,
      payload: {
        query: string
        limit?: number
        allowedClassifications?: MemoryClassification[]
        pathPrefixes?: string[]
      }
    ) => {
      enforceToolPolicy({
        actor: 'DIRECTOR',
        action: 'memory.query',
        target: payload.pathPrefixes?.join(',') ?? 'vault-memory'
      })

      return memoryQueryService.query(payload)
    }
  )

  ipcMain.handle(
    'memory:index-text',
    async (
      _event,
      payload: {
        relativePath: string
        content: string
        classification?: MemoryClassification
      }
    ) => {
      enforceToolPolicy({
        actor: 'DIRECTOR',
        action: 'memory.index',
        target: payload.relativePath
      })

      return memoryIndexService.indexText(payload)
    }
  )

  ipcMain.handle('memory:reindex-directory', async (_event, payload?: { rootPath?: string }) => {
    const rootPath = payload?.rootPath ?? vaultService.getWorkingRootPath()
    enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'memory.reindex',
      target: rootPath
    })

    return memoryIndexService.reindexDirectory(rootPath)
  })

  ipcMain.handle('memory:remove-path', async (_event, payload: { relativePath: string }) => {
    enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'memory.remove',
      target: payload.relativePath
    })

    return memoryIndexService.removePath(payload.relativePath)
  })

  ipcMain.handle('memory:health', async () => {
    return memoryQueryService.health()
  })

  ipcMain.handle('skills:list', async () => {
    return skillSystemService.listWorkspaceSkills()
  })

  ipcMain.handle('skills:execute', async (_event, payload: { skillId: string }) => {
    enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'skills.execute',
      target: payload.skillId
    })
    return skillSystemService.executeSkill(payload.skillId)
  })

  ipcMain.handle('skills:get-registry', async () => {
    return skillRegistryService.listAllSkills()
  })

  ipcMain.handle('skills:get-agent-skills', async (_event, payload: { agentId: string }) => {
    return skillRegistryService.getAgentSkills(payload.agentId)
  })

  ipcMain.handle('skills:get-type-skills', async (_event, payload: { type: SkillType }) => {
    return skillRegistryService.getSkillsByType(payload.type)
  })

  ipcMain.handle('skills:get-tag-skills', async (_event, payload: { tag: string }) => {
    return skillRegistryService.getByTag(payload.tag)
  })

  ipcMain.handle('registry:get-snapshot', async () => {
    return coreRegistryService.getSnapshot()
  })

  ipcMain.handle('registry:reload', async () => {
    return coreRegistryService.reload()
  })

  ipcMain.handle('registry:get-version', async () => {
    return coreRegistryService.getVersion()
  })

  ipcMain.handle('registry:get-onboarding-blueprint', async () => {
    return coreRegistryService.getSnapshot().onboarding
  })

  ipcMain.handle(
    'registry:search-files',
    async (_event, payload?: { keyword?: string; section?: string; extensions?: string[] }) => {
      return coreRegistryService.searchFiles(payload)
    }
  )

  ipcMain.handle('registry:read-file', async (_event, payload: { relativePath: string }) => {
    return coreRegistryService.readFile(payload.relativePath)
  })

  ipcMain.handle(
    'registry:save-markdown',
    async (_event, payload: { relativePath: string; content: string }) => {
      return coreRegistryService.saveMarkdown(payload.relativePath, payload.content)
    }
  )

  ipcMain.handle(
    'registry:upload-file',
    async (_event, payload: { relativeDir: string; fileName: string; content: string }) => {
      return coreRegistryService.uploadFile(payload)
    }
  )

  ipcMain.handle('providers:list', async () => {
    return localExecutionProviderService.listProvidersSafe()
  })

  ipcMain.handle('providers:set-master-password', async (_event, payload: { password: string }) => {
    localExecutionProviderService.setMasterPassword(payload.password)
    return { success: true }
  })

  ipcMain.handle(
    'providers:configure',
    async (_event, payload: { type: ModelProviderType; config: Record<string, unknown> }) => {
      localExecutionProviderService.configureProvider(payload.type, payload.config)
      return { success: true }
    }
  )

  ipcMain.handle('providers:enable', async (_event, payload: { type: ModelProviderType }) => {
    return localExecutionProviderService.setProviderEnabled(payload.type, true)
  })

  ipcMain.handle('providers:disable', async (_event, payload: { type: ModelProviderType }) => {
    return localExecutionProviderService.setProviderEnabled(payload.type, false)
  })

  ipcMain.handle('providers:validate', async (_event, payload: { type: ModelProviderType }) => {
    return localExecutionProviderService.validateProvider(payload.type)
  })

  ipcMain.handle('providers:get-metrics', async (_event, payload: { type: ModelProviderType }) => {
    return localExecutionProviderService.getMetrics(payload.type)
  })

  ipcMain.handle('operations:get-queue-monitor', async () => {
    return operationsService.getQueueMonitorPayload()
  })

  ipcMain.handle('operations:get-notifications', async () => {
    return operationsService.getNotificationPayload()
  })

  ipcMain.handle('operations:get-daily-brief', async () => {
    return operationsService.getDailyBriefPayload()
  })

  ipcMain.handle('operations:get-weekly-review', async () => {
    return operationsService.getWeeklyReviewPayload()
  })

  ipcMain.handle('operations:get-governance', async () => {
    return operationsService.getGovernancePayload()
  })

  ipcMain.handle(
    'operations:governance-action',
    async (
      _event,
      payload: { decisionId: string; action: 'APPROVE' | 'REJECT' | 'DEFER' | 'COMMIT' }
    ) => {
      return operationsService.applyGovernanceAction(payload.decisionId, payload.action)
    }
  )

  ipcMain.handle('operations:get-compliance', async () => {
    return operationsService.getCompliancePayload()
  })

  ipcMain.handle('operations:get-triage', async () => {
    return operationsService.getTriagePayload()
  })

  ipcMain.handle(
    'operations:triage-action',
    async (_event, payload: { itemId: string; action: 'ANALYZE' | 'CLEAR' }) => {
      return operationsService.applyTriageAction(payload.itemId, payload.action)
    }
  )

  ipcMain.handle('operations:get-suites', async () => {
    return operationsService.getSuitePayload()
  })

  ipcMain.handle('operations:get-funding-digest', async () => {
    return operationsService.getFundingDigestPayload()
  })

  ipcMain.handle('operations:get-hiring-sim', async () => {
    return operationsService.getHiringSimPayload()
  })

  ipcMain.handle('operations:get-design-audit', async () => {
    return operationsService.getDesignAuditPayload()
  })

  ipcMain.handle('operations:get-dashboard', async () => {
    return operationsService.getDashboardPayload()
  })

  ipcMain.handle('operations:get-infrastructure', async () => {
    return operationsService.getInfrastructurePayload()
  })

  ipcMain.handle('operations:get-onboarding-kpis', async () => {
    return operationsService.getOnboardingKpiPayload()
  })

  ipcMain.handle('operations:get-onboarding-commit-status', async () => {
    return operationsService.getOnboardingCommitStatus()
  })

  ipcMain.handle('operations:get-onboarding-stage-snapshot', async () => {
    return operationsService.getOnboardingStageSnapshot()
  })

  ipcMain.handle(
    'operations:save-onboarding-stage-snapshot',
    async (
      _event,
      payload: {
        phases: Record<
          string,
          {
            status: 'PENDING' | 'DRAFT' | 'APPROVED'
            contextByKey: Record<string, string>
            requiresReverification: boolean
          }
        >
        currentStep: number
        modelAccess?: Record<string, unknown>
      }
    ) => {
      return operationsService.saveOnboardingStageSnapshot(payload)
    }
  )

  ipcMain.handle('operations:generate-onboarding-kpis', async () => {
    return operationsService.generateOnboardingKpis()
  })

  ipcMain.handle(
    'operations:remove-onboarding-kpi',
    async (_event, payload: { agentId: string; kpiId: string }) => {
      return operationsService.removeOnboardingKpi(payload.agentId, payload.kpiId)
    }
  )

  ipcMain.handle(
    'operations:commit-onboarding',
    async (
      _event,
      payload: {
        kpiData: Record<string, string>
        contextByStep: Record<string, Record<string, string>>
        approvalByStep: Record<string, 'PENDING' | 'DRAFT' | 'APPROVED'>
        agentMappings: Record<
          string,
          {
            skills: string[]
            protocols: string[]
            kpis: string[]
            workflows: string[]
          }
        >
      }
    ) => {
      return operationsService.commitOnboarding(payload)
    }
  )

  ipcMain.handle(
    'operations:get-employee-profile',
    async (_event, payload: { employeeId: string }) => {
      return operationsService.getEmployeeProfilePayload(payload.employeeId)
    }
  )

  ipcMain.handle('operations:get-lifecycle-snapshot', async () => {
    return operationsService.getLifecycleSnapshot()
  })

  ipcMain.handle(
    'operations:list-lifecycle-drafts',
    async (_event, payload?: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN' }) => {
      return operationsService.listLifecycleDrafts(payload?.status)
    }
  )

  ipcMain.handle(
    'operations:review-lifecycle-draft',
    async (
      _event,
      payload: {
        draftId: string
        status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN'
        reviewer: string
        reviewNote?: string
      }
    ) => {
      return operationsService.reviewLifecycleDraft(payload)
    }
  )

  ipcMain.handle(
    'operations:update-lifecycle-profile',
    async (
      _event,
      payload: {
        agentId: string
        goal: string
        backstory: string
        skills: string[]
        kpis: string[]
      }
    ) => {
      return operationsService.updateLifecycleProfile(payload)
    }
  )

  ipcMain.handle(
    'operations:update-lifecycle-skill',
    async (_event, payload: { skillId: string; markdown: string }) => {
      return operationsService.updateLifecycleSkill(payload)
    }
  )

  ipcMain.handle(
    'operations:update-lifecycle-kpi',
    async (_event, payload: { kpiId: string; target: string; value?: string }) => {
      return operationsService.updateLifecycleKpi(payload)
    }
  )

  ipcMain.handle(
    'operations:update-lifecycle-data-input',
    async (_event, payload: { dataInputId: string; fileName: string; content: string }) => {
      return operationsService.updateLifecycleDataInput(payload)
    }
  )

  ipcMain.handle(
    'operations:create-lifecycle-data-input',
    async (
      _event,
      payload: {
        dataInputId: string
        name: string
        description: string
        schemaType: string
        requiredFields: string[]
        sampleSource: string
        fileName?: string
        content?: string
      }
    ) => {
      return operationsService.createLifecycleDataInput(payload)
    }
  )

  ipcMain.handle(
    'operations:create-cron-proposal',
    async (
      _event,
      payload: {
        id: string
        name: string
        expression: string
        retentionDays?: number
        maxRuntimeMs?: number
      }
    ) => {
      return operationsService.createCronProposal(payload)
    }
  )

  ipcMain.handle(
    'operations:list-cron-proposals',
    async (_event, payload?: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN' }) => {
      return operationsService.listCronProposals(payload?.status)
    }
  )

  ipcMain.handle(
    'operations:review-cron-proposal',
    async (
      _event,
      payload: {
        proposalId: string
        status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN'
        reviewer: string
        reviewNote?: string
      }
    ) => {
      return operationsService.reviewCronProposal(payload)
    }
  )

  ipcMain.handle('operations:get-task-audit-log', async (_event, payload?: { limit?: number }) => {
    return operationsService.getTaskAuditLog(payload?.limit)
  })

  ipcMain.handle(
    'channels:route-message',
    async (_event, payload: ChannelMessageEnvelope) => {
      return channelRouterService.routeChannelMessage(payload)
    }
  )

  ipcMain.handle('channels:get-capabilities', async () => {
    return channelRouterService.getChannelCapabilities()
  })

  ipcMain.handle(
    'channels:route-internal-message',
    async (
      _event,
      payload: {
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
      }
    ) => {
      return channelRouterService.routeInternalMessage(payload)
    }
  )

  ipcMain.handle(
    'channels:route-telegram-message',
    async (
      _event,
      payload: {
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
      }
    ) => {
      return channelRouterService.routeTelegramMessage(payload)
    }
  )

  ipcMain.handle(
    'channels:list-conversations',
    async (_event, payload?: { channel?: 'internal-chat' | 'telegram' | 'whatsapp' | 'webhook' | 'api' | string; limit?: number }) => {
      return channelRouterService.listConversations(payload?.channel, payload?.limit)
    }
  )

  ipcMain.handle(
    'channels:get-conversation-history',
    async (_event, payload: { conversationKey: string; limit?: number }) => {
      return channelRouterService.getConversationHistory(payload.conversationKey, payload.limit)
    }
  )

  ipcMain.handle(
    'work-orders:submit-director-request',
    async (
      _event,
      payload: {
        moduleRoute: string
        targetEmployeeId?: string
        message: string
        timestampIso?: string
      }
    ) => {
      return commandRouterService.submitDirectorRequest({
        moduleRoute: payload.moduleRoute,
        targetEmployeeId: payload.targetEmployeeId,
        message: payload.message,
        timestampIso: payload.timestampIso ?? new Date().toISOString()
      })
    }
  )

  ipcMain.handle('work-orders:start-next', async () => {
    return commandRouterService.startNext()
  })

  ipcMain.handle('work-orders:process-next', async () => {
    return commandRouterService.processNextToReview()
  })

  ipcMain.handle(
    'work-orders:complete',
    async (_event, payload: { workOrderId: string; summary?: string }) => {
      return commandRouterService.complete(payload.workOrderId, payload.summary)
    }
  )

  ipcMain.handle(
    'work-orders:fail',
    async (_event, payload: { workOrderId: string; error?: string }) => {
      return commandRouterService.fail(payload.workOrderId, payload.error)
    }
  )

  ipcMain.handle(
    'work-orders:approve',
    async (_event, payload: { workOrderId: string; summary?: string }) => {
      return commandRouterService.approve(payload.workOrderId, payload.summary)
    }
  )

  ipcMain.handle(
    'work-orders:reject',
    async (_event, payload: { workOrderId: string; error?: string }) => {
      return commandRouterService.reject(payload.workOrderId, payload.error)
    }
  )

  ipcMain.handle('work-orders:list', async () => {
    return workOrderService.list()
  })

  ipcMain.handle('work-orders:get', async (_event, payload: { id: string }) => {
    return workOrderService.get(payload.id)
  })

  ipcMain.handle('work-orders:queue-list', async () => {
    return queueService.list()
  })
}
