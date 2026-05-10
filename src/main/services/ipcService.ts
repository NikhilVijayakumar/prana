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
import { contextEngineService } from './contextEngineService'
import type { ContextMessageRole } from './contextEngineService'
import { subagentService } from './subagentService'
import { toolPolicyService } from './toolPolicyService'
import { hookSystemService, HookEventType } from './hookSystemService'
import { cronSchedulerService } from './cronSchedulerService'
import { memoryIndexService } from './memoryIndexService'
import type { MemoryClassification } from './memoryIndexService'
import { memoryQueryService } from './memoryQueryService'
import { commandRouterService } from './commandRouterService'
import { queueService } from './queueService'
import { workOrderService } from './workOrderService'
import { localExecutionProviderService, ModelProviderType } from './localExecutionProviderService'
import { skillRegistryService } from './skillRegistry'
import type { SkillType } from './skillRegistry'
import { coreRegistryService } from './coreRegistryService'
import { channelRouterService } from './channelRouterService'
import { ChannelMessageEnvelope } from './types/channelAdapterTypes'
import { syncProviderService } from './syncProviderService'
import { runtimeModelAccessService } from './runtimeModelAccessService'
import { configureRegistryRuntime, RegistryRuntimeConfig } from './registryRuntimeService'
import { emailOrchestratorService } from './emailOrchestratorService'
import { templateService } from './templateService'
import type { VisualTemplateFormat, VisualTemplateType } from './templateService'
import { visualIdentityService } from './visualIdentityService'
import { notificationCentreService } from './notificationCentreService'
import { NotificationListFilters } from './notificationStoreService'
import { vaidyarService } from './vaidyarService'
import { sandboxRuntimeEngine } from './sandbox/sandboxRuntimeEngine'
import { createPluginSandboxHost } from './sandbox/pluginSandboxHost'
import { setPermittedImageBasePath } from './sandbox/runtimeImageManagerService'
import type { RuntimeCapabilities, SandboxFixture } from './sandbox/sandboxTypes'

const MAX_SANDBOX_HOSTS = 10
import { z } from "zod";

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

const safe = <T>(
  fn: (event: Electron.IpcMainInvokeEvent, payload: T) => Promise<unknown>
): Parameters<typeof ipcMain.handle>[1] => {
  return async (event, payload) => {
    try {
      const data = await fn(event, payload as T)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
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

  ipcMain.handle('app:get-bootstrap-config', safe(async () => {
    return getPranaRuntimeConfig() ?? sqliteConfigStoreService.readSnapshotSync()?.config ?? null
  }))

  ipcMain.handle('app:get-runtime-config', safe(async () => {
    try {
      return getPublicRuntimeConfig()
    } catch (error) {
      return {
        errors: [error instanceof Error ? error.message : 'Runtime config unavailable.']
      }
    }
  }))

  ipcMain.handle('app:get-integration-status', safe(async () => {
    const status = getRuntimeIntegrationStatus()
    if (!status.ready) {
      return {
        ...status,
        ready: false
      }
    }

    return status
  }))

  ipcMain.handle('app:get-branding-config', safe(async () => {
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
  }))

  ipcMain.handle('app:bootstrap-host', safe(async (event, payload: { config: PranaRuntimeConfig }) => {

                     const schema = z.object({ config: z.any() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
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

      // Create a progress callback that emits events to the renderer
      const progressCallback = (progressEvent: any) => {
        try {
          event.sender.send('app:startup-progress', progressEvent)
        } catch (error) {
          console.warn('[PRANA] Failed to send startup progress event:', error)
        }
      }

      const startupStatus = await startupOrchestratorService.runStartupSequence(progressCallback)
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
  }))

  ipcMain.handle('app:get-startup-status', safe(async () => {
    return startupOrchestratorService.getLatestStartupStatus()
  }))

  ipcMain.handle('app:get-vaidyar-report', safe(async () => {
    return vaidyarService.getReport()
  }))

  ipcMain.handle('app:run-vaidyar-pulse', safe(async () => {
    return vaidyarService.runRuntimePulse()
  }))

  ipcMain.handle('app:run-vaidyar-on-demand', safe(async () => {
    return vaidyarService.runOnDemandDiagnostics()
  }))

  ipcMain.handle('app:get-vaidyar-telemetry', safe(async () => {
    return vaidyarService.getTelemetry()
  }))

  ipcMain.handle('auth:get-status', safe(async () => {
    return authService.getStatus()
  }))

  ipcMain.handle('auth:login', safe(async (_event, payload: { email: string; password: string }) => {

                     const schema = z.object({ email: z.string(), password: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return authService.login(payload.email, payload.password)
  }))

  ipcMain.handle('auth:forgot-password', safe(async (_event, payload: { email: string }) => {

                     const schema = z.object({ email: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return authService.forgotPassword(payload.email)
  }))

  ipcMain.handle('auth:verify-otp', safe(async (_event, payload: { otp: string }) => {

                     const schema = z.object({ otp: z.string().length(6, 'OTP must be 6 digits') });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return authService.verifyOtp(payload.otp)
  }))

   ipcMain.handle('auth:reset-password', safe(async (_event, payload: { newPassword: string }) => {

                      const schema = z.object({ newPassword: z.string() });
                      const parsed = schema.safeParse(payload);
                      if (!parsed.success) {
                         throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                      }
                    
    return authService.resetPassword(payload.newPassword)
  }))

  ipcMain.handle('auth:verify-code', safe(async (_event, payload: { code: string; hash: string; expiryTimestamp?: number }) => {

                     const schema = z.object({ code: z.string(), hash: z.string(), expiryTimestamp: z.number().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                    
    return authService.verifyCode(payload.code, payload.hash, payload.expiryTimestamp)
  }))

  ipcMain.handle('auth:logout', safe(async () => {
    // Session invalidation is handled client-side by clearing volatileSessionStore
    // This handler is a no-op but signals to the client that logout is complete
    return { success: true }
  }))

  ipcMain.handle('settings:load', safe(async () => {
    return operationsService.loadSettings()
  }))

  ipcMain.handle(
    'settings:save',
    safe(async (
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

                       const schema = z.object({ language: z.string(), preferredModelProvider: z.enum(['lmstudio', 'openrouter', 'gemini']), themeMode: z.enum(['system', 'light', 'dark']), reducedMotion: z.boolean(), syncPushIntervalMs: z.number().optional(), syncCronEnabled: z.boolean().optional(), syncPushCronEnabled: z.boolean().optional(), syncPullCronEnabled: z.boolean().optional(), syncPushCronExpression: z.string().optional(), syncPullCronExpression: z.string().optional(), syncHealthAutoRefreshEnabled: z.boolean().optional(), syncHealthAutoRefreshIntervalMs: z.number().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.saveSettings(payload)
    }
  ))

  ipcMain.handle('sync:get-status', safe(async () => {
    return syncProviderService.getStatus()
  }))

  ipcMain.handle('sync:push-now', safe(async () => {
    await syncProviderService.triggerBackgroundPush()
    return syncProviderService.getStatus()
  }))

  ipcMain.handle('sync:pull-now', safe(async () => {
    const result = await syncProviderService.triggerBackgroundPull()
    const status = await syncProviderService.getStatus()
    return {
      result,
      status
    }
  }))

  ipcMain.handle('operations:get-runtime-channel-configuration', safe(async () => {
    return operationsService.getRuntimeChannelConfiguration()
  }))

  ipcMain.handle(
    'operations:update-runtime-channel-configuration',
    safe(async (
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

                       const schema = z.object({ provider: z.string(), allowedChannels: z.array(z.string()), approvedAgentsForChannels: z.array(z.any()), channelAccessRules: z.string(), telegramChannelId: z.string(), webhookSubscriptionUri: z.string(), providerCredentials: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.updateRuntimeChannelConfiguration(payload)
    }
  ))

  ipcMain.handle('operations:get-administration-integration-snapshot', safe(async () => {
    return operationsService.getAdministrationIntegrationSnapshot()
  }))

  ipcMain.handle('operations:sync-administration-staff-registry', safe(async () => {
    return operationsService.syncAdministrationStaffRegistry()
  }))

  ipcMain.handle('operations:ingest-administration-feedback', safe(async () => {
    return operationsService.ingestAdministrationFeedback()
  }))

  ipcMain.handle(
    'operations:convert-document-content',
    safe(async (
      _event,
      payload: {
        sourceFormat: 'markdown' | 'html' | 'docx'
        targetFormat: 'markdown' | 'html' | 'docx'
        content: string
      }
    ) => {

                       const schema = z.object({ sourceFormat: z.enum(['markdown', 'html', 'docx']), targetFormat: z.enum(['markdown', 'html', 'docx']), content: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.convertDocumentContent(payload)
    }
  ))

  ipcMain.handle(
    'operations:convert-document-file',
    safe(async (
      _event,
      payload: {
        inputPath: string
        outputPath: string
        sourceFormat?: 'markdown' | 'html' | 'docx'
        targetFormat?: 'markdown' | 'html' | 'docx'
      }
    ) => {

                       const schema = z.object({ inputPath: z.string(), outputPath: z.string(), sourceFormat: z.enum(['markdown', 'html', 'docx']).optional(), targetFormat: z.enum(['markdown', 'html', 'docx']).optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.convertDocumentFile(payload)
    }
  ))

  ipcMain.handle('operations:run-administration-kpi-happiness-evaluator', safe(async () => {
    return operationsService.runAdministrationKpiHappinessEvaluator()
  }))

  ipcMain.handle('operations:run-administration-social-trend-intelligence', safe(async () => {
    return operationsService.runAdministrationSocialTrendIntelligence()
  }))

  ipcMain.handle('operations:get-google-bridge-snapshot', safe(async () => {
    return operationsService.getGoogleBridgeSnapshot()
  }))

  ipcMain.handle(
    'operations:run-google-drive-sync',
    safe(async (_event, payload?: { source?: 'MANUAL' | 'CRON' }) => {

                       const schema = z.object({ source: z.enum(['MANUAL', 'CRON']).optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.runGoogleDriveSync(payload)
    }))

  ipcMain.handle('operations:ensure-google-drive-sync-schedule', safe(async () => {
    return operationsService.ensureGoogleDriveSyncSchedule()
  }))

  ipcMain.handle(
    'operations:publish-google-policy-document',
    safe(async (
      _event,
      payload: {
        policyId: string
        htmlContent: string
      }
    ) => {

                       const schema = z.object({ policyId: z.string(), htmlContent: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.publishGooglePolicyDocument(payload)
    }
  ))

  ipcMain.handle(
    'operations:pull-google-document-to-vault',
    safe(async (
      _event,
      payload: {
        documentId: string
        vaultTargetPath: string
      }
    ) => {

                       const schema = z.object({ documentId: z.string(), vaultTargetPath: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.pullGoogleDocumentToVault(payload)
    }
  ))

  ipcMain.handle('visual:seed-default-templates', safe(async () => {
    return templateService.ensureDefaultTemplates()
  }))

  ipcMain.handle(
    'visual:register-template',
    safe(async (
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

                       const schema = z.object({ templateId: z.string(), version: z.string(), templateType: z.any(), name: z.string(), supportedFormats: z.array(z.any()), htmlContent: z.string(), requiredVariables: z.array(z.string()).optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return templateService.registerTemplate(payload)
    }
  ))

  ipcMain.handle(
    'visual:validate-template',
    safe(async (
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

                       const schema = z.object({ templateId: z.string(), version: z.string(), templateType: z.any(), name: z.string(), supportedFormats: z.array(z.any()), htmlContent: z.string(), requiredVariables: z.array(z.string()).optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return templateService.validateTemplate(payload)
    }
  ))

  ipcMain.handle(
    'visual:list-templates',
    safe(async (_event, payload?: { templateType?: VisualTemplateType; includeContent?: boolean }) => {

                       const schema = z.object({ templateType: z.any().optional(), includeContent: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return templateService.listTemplates(payload)
    }))

  ipcMain.handle(
    'visual:list-template-versions',
    safe(async (_event, payload: { templateId: string; includeContent?: boolean }) => {

                       const schema = z.object({ templateId: z.string(), includeContent: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return templateService.listTemplateVersions(payload)
    }))

  ipcMain.handle(
    'visual:get-template',
    safe(async (
      _event,
      payload: { templateId: string; version?: string; includeContent?: boolean }
    ) => {

                       const schema = z.object({ templateId: z.string(), version: z.string().optional(), includeContent: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return templateService.getTemplate(payload)
    }
  ))

  ipcMain.handle(
    'visual:preview-template',
    safe(async (
      _event,
      payload: {
        templateId: string
        version?: string
        data: Record<string, unknown>
        injectTokenStyles?: boolean
      }
    ) => {

                       const schema = z.object({ templateId: z.string(), version: z.string().optional(), data: z.any(), injectTokenStyles: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
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
  ))

  ipcMain.handle('visual:get-token-snapshot', safe(async () => {
    return visualIdentityService.getTokenSnapshot()
  }))

  ipcMain.handle('visual:retry-template-sync', safe(async () => {
    return templateService.retryTemplateSync()
  }))

  ipcMain.handle(
    'email:configure-account',
    safe(async (
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

                       const schema = z.object({ accountId: z.string().optional(), label: z.string(), address: z.string(), provider: z.enum(['gmail', 'outlook', 'imap-generic']), imapHost: z.string(), imapPort: z.number(), useTls: z.boolean(), cronSchedule: z.enum(['once_daily', 'twice_daily']), cronTimes: z.array(z.string()), isActive: z.boolean() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.configureAccount(payload)
    }
  ))

  ipcMain.handle('email:list-accounts', safe(async () => {
    return emailOrchestratorService.listAccounts()
  }))

  ipcMain.handle(
    'email:fetch-unread',
    safe(async (_event, payload: { accountId: string; source?: 'MANUAL' | 'CRON' | 'WEBHOOK' }) => {

                       const schema = z.object({ accountId: z.string(), source: z.enum(['MANUAL', 'CRON', 'WEBHOOK']).optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.fetchUnread(payload.accountId, payload.source ?? 'MANUAL')
    }))

  ipcMain.handle(
    'email:fetch-all-accounts',
    safe(async (_event, payload?: { source?: 'MANUAL' | 'CRON' | 'WEBHOOK' }) => {

                       const schema = z.object({ source: z.enum(['MANUAL', 'CRON', 'WEBHOOK']).optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.fetchAllAccounts(payload?.source ?? 'MANUAL')
    }))

  ipcMain.handle('email:get-triage-summary', safe(async () => {
    return emailOrchestratorService.getTriageSummary()
  }))

  ipcMain.handle(
    'email:select-for-draft',
    safe(async (
      _event,
      payload: {
        actionItemIds: string[]
        action: 'DRAFT_REPLY' | 'COMPOSE_NEW'
      }
    ) => {

                       const schema = z.object({ actionItemIds: z.array(z.string()), action: z.enum(['DRAFT_REPLY', 'COMPOSE_NEW']) });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.selectForDraft(payload)
    }
  ))

  ipcMain.handle(
    'email:compose-new-draft',
    safe(async (
      _event,
      payload: {
        subject: string
        recipientAddress: string | null
      }
    ) => {

                       const schema = z.object({ subject: z.string(), recipientAddress: z.any() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.composeNewDraft(payload)
    }
  ))

  ipcMain.handle(
    'email:contribute-to-draft',
    safe(async (
      _event,
      payload: {
        draftId: string
        agentId: string
        sectionIndex: number
        content: string
      }
    ) => {

                       const schema = z.object({ draftId: z.string(), agentId: z.string(), sectionIndex: z.number(), content: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.contributeToDraft(payload)
    }
  ))

  ipcMain.handle('email:get-draft', safe(async (_event, payload: { draftId: string }) => {

                     const schema = z.object({ draftId: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return emailOrchestratorService.getDraft(payload.draftId)
  }))

  ipcMain.handle('email:approve-draft', safe(async (_event, payload: { draftId: string }) => {

                     const schema = z.object({ draftId: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return emailOrchestratorService.approveDraft(payload.draftId)
  }))

  ipcMain.handle('email:send-draft', safe(async (_event, payload: { draftId: string }) => {

                     const schema = z.object({ draftId: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return emailOrchestratorService.sendDraft(payload)
  }))

  ipcMain.handle(
    'email:mark-batch-read',
    safe(async (
      _event,
      payload: {
        accountId: string
        batchId: string
        directorConfirmed?: boolean
        humanConfirmed?: boolean
      }
    ) => {

                       const schema = z.object({ accountId: z.string(), batchId: z.string(), directorConfirmed: z.boolean().optional(), humanConfirmed: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.markBatchRead(payload)
    }
  ))

  ipcMain.handle('email:get-batch-history', safe(async (_event, payload?: { accountId?: string }) => {

                     const schema = z.object({ accountId: z.string().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return emailOrchestratorService.getBatchHistory(payload?.accountId)
  }))

  ipcMain.handle(
    'email:browser-session-start',
    safe(async (
      _event,
      payload: {
        draftId: string
        url: string
        headless?: boolean
      }
    ) => {

                       const schema = z.object({ draftId: z.string(), url: z.string(), headless: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.startBrowserFallbackSession(payload)
    }
  ))

  ipcMain.handle(
    'email:gmail-human-loop-start',
    safe(async (
      _event,
      payload: {
        accountId: string
        draftId?: string
        inboxUrl?: string
      }
    ) => {

                       const schema = z.object({ accountId: z.string(), draftId: z.string().optional(), inboxUrl: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.startGmailHumanLoopSession(payload)
    }
  ))

  ipcMain.handle(
    'email:gmail-human-loop-resume',
    safe(async (
      _event,
      payload: {
        accountId: string
        draftId?: string
        inboxUrl?: string
        headless?: boolean
      }
    ) => {

                       const schema = z.object({ accountId: z.string(), draftId: z.string().optional(), inboxUrl: z.string().optional(), headless: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.resumeGmailSession(payload)
    }
  ))

  ipcMain.handle(
    'email:gmail-pubsub-notify',
    safe(async (
      _event,
      payload: {
        accountId?: string
        emailAddress?: string
        historyId?: string
        triggerBrowserFallbackOnFailure?: boolean
        inboxUrl?: string
      }
    ) => {

                       const schema = z.object({ accountId: z.string().optional(), emailAddress: z.string().optional(), historyId: z.string().optional(), triggerBrowserFallbackOnFailure: z.boolean().optional(), inboxUrl: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.handleGmailPubSubNotification(payload)
    }
  ))

  ipcMain.handle(
    'email:list-knowledge-context',
    safe(async (
      _event,
      payload?: {
        agentId?: string
        accountId?: string
        query?: string
        limit?: number
      }
    ) => {

                       const schema = z.object({ agentId: z.string().optional(), accountId: z.string().optional(), query: z.string().optional(), limit: z.number().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.listEmailKnowledgeContext(payload ?? {})
    }
  ))

  ipcMain.handle(
    'email:save-knowledge-context',
    safe(async (
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

                       const schema = z.object({ entryId: z.string().optional(), sourceKey: z.any().optional(), agentId: z.string(), accountId: z.any().optional(), emailUid: z.any().optional(), threadKey: z.any().optional(), contextKind: z.enum(['INTAKE', 'FOLLOW_UP', 'REMINDER', 'SUMMARY', 'NOTE']), subject: z.any().optional(), sender: z.any().optional(), summary: z.string(), followUpAt: z.any().optional(), priority: z.number().optional(), metadata: z.any().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.saveEmailKnowledgeContext(payload)
    }
  ))

  ipcMain.handle(
    'email:cleanup-knowledge-context',
    safe(async (
      _event,
      payload?: {
        maxRows?: number
        maxRowsPerAgent?: number
        maxAgeDays?: number
      }
    ) => {

                       const schema = z.object({ maxRows: z.number().optional(), maxRowsPerAgent: z.number().optional(), maxAgeDays: z.number().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.cleanupEmailKnowledgeContext(payload)
    }
  ))

  ipcMain.handle('email:browser-session-list', safe(async () => {
    return emailOrchestratorService.listBrowserFallbackSessions()
  }))

  ipcMain.handle(
    'email:browser-session-navigate',
    safe(async (
      _event,
      payload: {
        sessionId: string
        url: string
      }
    ) => {

                       const schema = z.object({ sessionId: z.string(), url: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.navigateBrowserFallbackSession(payload)
    }
  ))

  ipcMain.handle(
    'email:browser-session-snapshot',
    safe(async (_event, payload: { sessionId: string }) => {

                       const schema = z.object({ sessionId: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return emailOrchestratorService.snapshotBrowserFallbackSession(payload)
    }))

   ipcMain.handle('email:browser-session-stop', safe(async (_event, payload: { sessionId: string }) => {

                      const schema = z.object({ sessionId: z.string() });
                      const parsed = schema.safeParse(payload);
                      if (!parsed.success) {
                         throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                      }
                    
    return emailOrchestratorService.stopBrowserFallbackSession(payload)
  }))

  // General Email API (stateless, app-configured)
  ipcMain.handle('email-general:configure', safe(async (_event, payload: { apiKey: string; inboxId: string }) => {

                     const schema = z.object({ apiKey: z.string(), inboxId: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }

    // Note: templateRenderer must be configured directly in main process, as functions can't be sent via IPC
    const { configureEmailService } = await import('./emailService');
    configureEmailService({
      apiKey: payload.apiKey,
      inboxId: payload.inboxId,
      templateRenderer: async () => { throw new Error('templateRenderer must be configured directly'); }
    });
    return { success: true };
  }))

  ipcMain.handle('email-general:send', safe(async (_event, payload: { options: { to: string[]; subject: string; templateName: string; data: any } }) => {

                     const schema = z.object({ options: z.object({ to: z.array(z.string()), subject: z.string(), templateName: z.string(), data: z.any() }) });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                    
    const { sendEmail } = await import('./emailService');
    return sendEmail(payload.options);
  }))

  ipcMain.handle('vault:list-files', safe(async () => {
    return vaultService.listFiles()
  }))

  ipcMain.handle('vault:select-and-ingest', safe(async () => {
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
  }))

  ipcMain.handle(
    'vault:publish',
    safe(async (_event, payload?: { message?: string; approvedByUser?: boolean }) => {

                       const schema = z.object({ message: z.string().optional(), approvedByUser: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
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
    }))

  ipcMain.handle('vault:create-snapshot', safe(async (_event, payload?: { label?: string }) => {

                     const schema = z.object({ label: z.string().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return vaultService.createTempSnapshot(payload?.label)
  }))

  ipcMain.handle(
    'vault:resume-from-snapshot',
    safe(async (_event, payload: { snapshotPath: string }) => {

                       const schema = z.object({ snapshotPath: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      await vaultService.resumeFromSnapshot(payload.snapshotPath)
      return { success: true }
    }))

  ipcMain.handle('vault-knowledge:get-snapshot', safe(async () => {
    return vaultService.getKnowledgeSnapshot()
  }))

  ipcMain.handle('vault-knowledge:read-file', safe(async (_event, payload: { relativePath: string }) => {

                     const schema = z.object({ relativePath: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'vault.knowledge.read',
      target: payload.relativePath
    })
    return vaultService.readKnowledgeFile(payload.relativePath)
  }))

  ipcMain.handle(
    'vault-knowledge:approve',
    safe(async (_event, payload: { relativePath: string; approvedByUser?: boolean }) => {

                       const schema = z.object({ relativePath: z.string(), approvedByUser: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
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
    }))

  ipcMain.handle(
    'vault-knowledge:reject',
    safe(async (_event, payload: { relativePath: string; approvedByUser?: boolean }) => {

                       const schema = z.object({ relativePath: z.string(), approvedByUser: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
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
    }))

  ipcMain.handle('model-gateway:probe', safe(async () => {
    return modelGatewayService.probeGateway()
  }))

  ipcMain.handle(
    'context-engine:bootstrap',
    safe(async (
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

                       const schema = z.object({ sessionId: z.string(), budget: z.any().optional(), modelConfig: z.any().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
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
  ))

  ipcMain.handle(
    'context-engine:ingest',
    safe(async (_event, payload: { sessionId: string; role: ContextMessageRole; content: string }) => {

                       const schema = z.object({ sessionId: z.string(), role: z.any(), content: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
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
    }))

  ipcMain.handle(
    'context-engine:ingest-batch',
    safe(async (
      _event,
      payload: { sessionId: string; messages: Array<{ role: ContextMessageRole; content: string }> }
    ) => {

                       const schema = z.object({ sessionId: z.string(), messages: z.any() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return contextEngineService.ingestBatch(payload.sessionId, payload.messages)
    }
  ))

  ipcMain.handle(
    'context-engine:assemble',
    safe(async (_event, payload: { sessionId: string; maxTokensOverride?: number }) => {

                       const schema = z.object({ sessionId: z.string(), maxTokensOverride: z.number().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return contextEngineService.assemble(payload.sessionId, payload.maxTokensOverride)
    }))

  ipcMain.handle(
    'context-engine:compact',
    safe(async (_event, payload: { sessionId: string; reason?: string }) => {

                       const schema = z.object({ sessionId: z.string(), reason: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return contextEngineService.compact(payload.sessionId, payload.reason)
    }))

  ipcMain.handle('context-engine:after-turn', safe(async (_event, payload: { sessionId: string }) => {

                     const schema = z.object({ sessionId: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    const result = await contextEngineService.afterTurn(payload.sessionId)
    await hookSystemService.emit('session.afterTurn', { sessionId: payload.sessionId })
    return result
  }))

  ipcMain.handle(
    'context-engine:prepare-new-context',
    safe(async (_event, payload: { sessionId: string }) => {

                       const schema = z.object({ sessionId: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return contextEngineService.prepareNewContext(payload.sessionId)
    }))

  ipcMain.handle(
    'context-engine:start-new-with-context',
    safe(async (
      _event,
      payload: { sourceSessionId: string; targetSessionId: string; summaryOverride?: string }
    ) => {

                       const schema = z.object({ sourceSessionId: z.string(), targetSessionId: z.string(), summaryOverride: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return contextEngineService.startNewWithContext(
        payload.sourceSessionId,
        payload.targetSessionId,
        payload.summaryOverride
      )
    }
  ))

  ipcMain.handle(
    'context-engine:get-latest-digest',
    safe(async (_event, payload: { sessionId: string }) => {

                       const schema = z.object({ sessionId: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return contextEngineService.getLatestDigest(payload.sessionId)
    }))

  ipcMain.handle(
    'context-engine:list-digests',
    safe(async (_event, payload: { sessionId: string; limit?: number }) => {

                       const schema = z.object({ sessionId: z.string(), limit: z.number().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return contextEngineService.listDigests(payload.sessionId, payload.limit)
    }))

  ipcMain.handle(
    'context-engine:prepare-subagent-spawn',
    safe(async (_event, payload: { parentSessionId: string; childSessionId: string }) => {

                       const schema = z.object({ parentSessionId: z.string(), childSessionId: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return contextEngineService.prepareSubagentSpawn(
        payload.parentSessionId,
        payload.childSessionId
      )
    }))

  ipcMain.handle(
    'context-engine:on-subagent-ended',
    safe(async (
      _event,
      payload: { parentSessionId: string; childSessionId: string; summary: string }
    ) => {

                       const schema = z.object({ parentSessionId: z.string(), childSessionId: z.string(), summary: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return contextEngineService.onSubagentEnded(
        payload.parentSessionId,
        payload.childSessionId,
        payload.summary
      )
    }
  ))

  ipcMain.handle('context-engine:get-session', safe(async (_event, payload: { sessionId: string }) => {

                     const schema = z.object({ sessionId: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return contextEngineService.getSessionSnapshot(payload.sessionId)
  }))

  ipcMain.handle('context-engine:list-sessions', safe(async () => {
    return contextEngineService.listSessions()
  }))

  ipcMain.handle('context-engine:get-telemetry', safe(async () => {
    return contextEngineService.getTelemetry()
  }))

  ipcMain.handle('context-engine:dispose', safe(async (_event, payload: { sessionId: string }) => {

                     const schema = z.object({ sessionId: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return contextEngineService.disposeSession(payload.sessionId)
  }))

  ipcMain.handle(
    'subagents:spawn',
    safe(async (
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

                       const schema = z.object({ agentName: z.string(), model: z.string().optional(), parentId: z.string().optional(), parentSessionId: z.string().optional(), sessionId: z.string().optional(), approvedByUser: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
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
  ))

  ipcMain.handle('subagents:heartbeat', safe(async (_event, payload: { id: string }) => {

                     const schema = z.object({ id: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return subagentService.heartbeat(payload.id)
  }))

  ipcMain.handle(
    'subagents:complete',
    safe(async (_event, payload: { id: string; summary?: string }) => {

                       const schema = z.object({ id: z.string(), summary: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return subagentService.complete(payload.id, payload.summary)
    }))

  ipcMain.handle('subagents:fail', safe(async (_event, payload: { id: string; error?: string }) => {

                     const schema = z.object({ id: z.string(), error: z.string().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return subagentService.fail(payload.id, payload.error)
  }))

  ipcMain.handle('subagents:cancel', safe(async (_event, payload: { id: string; summary?: string }) => {

                     const schema = z.object({ id: z.string(), summary: z.string().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return subagentService.cancel(payload.id, payload.summary)
  }))

  ipcMain.handle('subagents:timeout-sweep', safe(async (_event, payload?: { timeoutMs?: number }) => {

                     const schema = z.object({ timeoutMs: z.number().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return subagentService.timeoutSweep(payload?.timeoutMs)
  }))

  ipcMain.handle('subagents:list', safe(async () => {
    return subagentService.list()
  }))

  ipcMain.handle('subagents:get', safe(async (_event, payload: { id: string }) => {

                     const schema = z.object({ id: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return subagentService.get(payload.id)
  }))

  ipcMain.handle('subagents:tree', safe(async () => {
    return subagentService.getTree()
  }))

  ipcMain.handle('subagents:telemetry', safe(async () => {
    return subagentService.getTelemetry()
  }))

  ipcMain.handle('subagents:dispose', safe(async (_event, payload: { id: string }) => {

                     const schema = z.object({ id: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return subagentService.dispose(payload.id)
  }))

  ipcMain.handle(
    'tool-policy:evaluate',
    safe(async (
      _event,
      payload: {
        actor: string
        action: string
        target?: string
        approvedByUser?: boolean
        metadata?: Record<string, unknown>
      }
    ) => {

                       const schema = z.object({ actor: z.string(), action: z.string(), target: z.string().optional(), approvedByUser: z.boolean().optional(), metadata: z.any().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return toolPolicyService.evaluate(payload)
    }
  ))

  ipcMain.handle('tool-policy:list-audits', safe(async () => {
    return toolPolicyService.listAudits()
  }))

  ipcMain.handle('tool-policy:list-reflections', safe(async (_event, payload?: { limit?: number }) => {

                     const schema = z.object({ limit: z.number().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return toolPolicyService.listReflections(payload?.limit)
  }))

  ipcMain.handle('tool-policy:get-telemetry', safe(async () => {
    return toolPolicyService.getTelemetry()
  }))

  ipcMain.handle('hooks:list', safe(async () => {
    return hookSystemService.listHooks()
  }))

  ipcMain.handle(
    'hooks:set-enabled',
    safe(async (_event, payload: { hookId: string; enabled: boolean }) => {

                       const schema = z.object({ hookId: z.string(), enabled: z.boolean() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return hookSystemService.setHookEnabled(payload.hookId, payload.enabled)
    }))

  ipcMain.handle('hooks:get-telemetry', safe(async () => {
    return hookSystemService.getTelemetry()
  }))

  ipcMain.handle('hooks:get-executions', safe(async (_event, payload?: { limit?: number }) => {

                     const schema = z.object({ limit: z.number().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return hookSystemService.listExecutions(payload?.limit)
  }))

  ipcMain.handle('hooks:get-notifications', safe(async (_event, payload?: { limit?: number }) => {

                     const schema = z.object({ limit: z.number().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return hookSystemService.listNotifications(payload?.limit)
  }))

  ipcMain.handle(
    'hooks:emit',
    safe(async (
      _event,
      payload: { event: HookEventType; data?: Record<string, unknown>; wait?: boolean }
    ) => {

                       const schema = z.object({ event: z.any(), data: z.any().optional(), wait: z.boolean().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      if (payload.wait === true) {
        return hookSystemService.emitAndWait(payload.event, payload.data ?? {})
      }
      return hookSystemService.emit(payload.event, payload.data ?? {})
    }
  ))

  ipcMain.handle('hooks:events', safe(async () => {
    return hookSystemService.getEventCatalog()
  }))

  // Notification centre handlers
  ipcMain.handle(
    'notifications:list',
    safe(async (
      _event,
      payload?: { filters?: NotificationListFilters; limit?: number; offset?: number }
    ) => {

                       const schema = z.object({ filters: z.any().optional(), limit: z.number().optional(), offset: z.number().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
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
  ))

  ipcMain.handle('notifications:get-unread-count', safe(async () => {
    try {
      return await notificationCentreService.getUnreadCount()
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Failed to get unread count'
      )
    }
  }))

  ipcMain.handle(
    'notifications:mark-read',
    safe(async (_event, payload: { notificationIds: string[] }) => {

                       const schema = z.object({ notificationIds: z.array(z.string()) });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      try {
        return await notificationCentreService.markRead(payload.notificationIds)
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Failed to mark notifications as read'
        )
      }
    }))

  ipcMain.handle(
    'notifications:mark-dismissed',
    safe(async (_event, payload: { notificationIds: string[] }) => {

                       const schema = z.object({ notificationIds: z.array(z.string()) });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      try {
        return await notificationCentreService.markDismissed(payload.notificationIds)
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Failed to mark notifications as dismissed'
        )
      }
    }))

  ipcMain.handle(
    'notifications:record-action',
    safe(async (
      _event,
      payload: { notificationId: string; action: 'VIEWED' | 'DISMISSED' | 'ACTIONED' }
    ) => {

                       const schema = z.object({ notificationId: z.string(), action: z.enum(['VIEWED', 'DISMISSED', 'ACTIONED']) });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
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
  ))

  ipcMain.handle('notifications:get-telemetry', safe(async () => {
    try {
      return await notificationCentreService.getTelemetry()
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Failed to get telemetry'
      )
    }
  }))

  ipcMain.handle('notifications:cleanup', safe(async (_event, payload?: { days?: number }) => {

                     const schema = z.object({ days: z.number().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    try {
      return await notificationCentreService.cleanup(payload?.days ?? 7)
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Failed to cleanup notifications'
      )
    }
  }))

  ipcMain.handle('cron:list', safe(async () => {
    return cronSchedulerService.listJobs()
  }))

  ipcMain.handle(
    'cron:upsert',
    safe(async (
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

                       const schema = z.object({ id: z.string(), name: z.string(), expression: z.string(), target: z.string().optional(), recoveryPolicy: z.enum(['SKIP', 'RUN_ONCE', 'CATCH_UP']).optional(), enabled: z.boolean().optional(), retentionDays: z.number().optional(), maxRuntimeMs: z.number().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return cronSchedulerService.upsertJob(payload)
    }
  ))

  ipcMain.handle('cron:remove', safe(async (_event, payload: { id: string }) => {

                     const schema = z.object({ id: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return cronSchedulerService.removeJob(payload.id)
  }))

  ipcMain.handle('cron:pause', safe(async (_event, payload: { id: string }) => {

                     const schema = z.object({ id: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return cronSchedulerService.pauseJob(payload.id)
  }))

  ipcMain.handle('cron:resume', safe(async (_event, payload: { id: string }) => {

                     const schema = z.object({ id: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return cronSchedulerService.resumeJob(payload.id)
  }))

  ipcMain.handle('cron:run-now', safe(async (_event, payload: { id: string }) => {

                     const schema = z.object({ id: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return cronSchedulerService.runNow(payload.id)
  }))

  ipcMain.handle('cron:tick', safe(async () => {
    await cronSchedulerService.tick()
    return { success: true }
  }))

  ipcMain.handle('cron:telemetry', safe(async () => {
    return cronSchedulerService.getTelemetry()
  }))

  ipcMain.handle(
    'memory:query',
    safe(async (
      _event,
      payload: {
        query: string
        limit?: number
        allowedClassifications?: MemoryClassification[]
        pathPrefixes?: string[]
      }
    ) => {

                       const schema = z.object({ query: z.string(), limit: z.number().optional(), allowedClassifications: z.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'])).optional(), pathPrefixes: z.array(z.string()).optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      enforceToolPolicy({
        actor: 'DIRECTOR',
        action: 'memory.query',
        target: payload.pathPrefixes?.join(',') ?? 'vault-memory'
      })

      return memoryQueryService.query(payload)
    }
  ))

  ipcMain.handle(
    'memory:index-text',
    safe(async (
      _event,
      payload: {
        relativePath: string
        content: string
        classification?: MemoryClassification
      }
    ) => {

                       const schema = z.object({ relativePath: z.string(), content: z.string(), classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      enforceToolPolicy({
        actor: 'DIRECTOR',
        action: 'memory.index',
        target: payload.relativePath
      })

      return memoryIndexService.indexText(payload)
    }
  ))

  ipcMain.handle('memory:reindex-directory', safe(async (_event, payload?: { rootPath?: string }) => {

                     const schema = z.object({ rootPath: z.string().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    const rootPath = payload?.rootPath ?? vaultService.getWorkingRootPath()
    enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'memory.reindex',
      target: rootPath
    })

    return memoryIndexService.reindexDirectory(rootPath)
  }))

  ipcMain.handle('memory:remove-path', safe(async (_event, payload: { relativePath: string }) => {

                     const schema = z.object({ relativePath: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'memory.remove',
      target: payload.relativePath
    })

    return memoryIndexService.removePath(payload.relativePath)
  }))

  ipcMain.handle('memory:health', safe(async () => {
    return memoryQueryService.health()
  }))

  ipcMain.handle('skills:list', safe(async () => {
    return skillSystemService.listWorkspaceSkills()
  }))

  ipcMain.handle('skills:execute', safe(async (_event, payload: { skillId: string }) => {

                     const schema = z.object({ skillId: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'skills.execute',
      target: payload.skillId
    })
    return skillSystemService.executeSkill(payload.skillId)
  }))

  ipcMain.handle('skills:get-registry', safe(async () => {
    return skillRegistryService.listAllSkills()
  }))

  ipcMain.handle('skills:get-agent-skills', safe(async (_event, payload: { agentId: string }) => {

                     const schema = z.object({ agentId: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return skillRegistryService.getAgentSkills(payload.agentId)
  }))

  ipcMain.handle('skills:get-type-skills', safe(async (_event, payload: { type: SkillType }) => {

                     const schema = z.object({ type: z.enum(['Skill', 'Rule', 'Script', 'Tool']) });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }

    return skillRegistryService.getSkillsByType(payload.type)
  }))

  ipcMain.handle('skills:get-tag-skills', safe(async (_event, payload: { tag: string }) => {

                     const schema = z.object({ tag: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return skillRegistryService.getByTag(payload.tag)
  }))

  ipcMain.handle('registry:get-snapshot', safe(async () => {
    return coreRegistryService.getSnapshot()
  }))

  ipcMain.handle('registry:reload', safe(async () => {
    return coreRegistryService.reload()
  }))

  ipcMain.handle('registry:get-version', safe(async () => {
    return coreRegistryService.getVersion()
  }))

  ipcMain.handle('registry:get-onboarding-blueprint', safe(async () => {
    return coreRegistryService.getSnapshot().onboarding
  }))

  ipcMain.handle(
    'registry:search-files',
    safe(async (_event, payload?: { keyword?: string; section?: string; extensions?: string[] }) => {

                       const schema = z.object({ keyword: z.string().optional(), section: z.string().optional(), extensions: z.array(z.string()).optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return coreRegistryService.searchFiles(payload)
    }))

  ipcMain.handle('registry:read-file', safe(async (_event, payload: { relativePath: string }) => {

                     const schema = z.object({ relativePath: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return coreRegistryService.readFile(payload.relativePath)
  }))

  ipcMain.handle(
    'registry:save-markdown',
    safe(async (_event, payload: { relativePath: string; content: string }) => {

                       const schema = z.object({ relativePath: z.string(), content: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return coreRegistryService.saveMarkdown(payload.relativePath, payload.content)
    }))

  ipcMain.handle(
    'registry:upload-file',
    safe(async (_event, payload: { relativeDir: string; fileName: string; content: string }) => {

                       const schema = z.object({ relativeDir: z.string(), fileName: z.string(), content: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return coreRegistryService.uploadFile(payload)
    }))

  ipcMain.handle('providers:list', safe(async () => {
    return localExecutionProviderService.listProvidersSafe()
  }))

  ipcMain.handle('providers:set-master-password', safe(async (_event, payload: { password: string }) => {

                     const schema = z.object({ password: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    localExecutionProviderService.setMasterPassword(payload.password)
    return { success: true }
  }))

  ipcMain.handle(
    'providers:configure',
    safe(async (_event, payload: { type: ModelProviderType; config: Record<string, unknown> }) => {

                       const schema = z.object({ type: z.any(), config: z.any() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      localExecutionProviderService.configureProvider(payload.type, payload.config)
      return { success: true }
    }))

  ipcMain.handle('providers:enable', safe(async (_event, payload: { type: ModelProviderType }) => {

                     const schema = z.object({ type: z.any() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return localExecutionProviderService.setProviderEnabled(payload.type, true)
  }))

  ipcMain.handle('providers:disable', safe(async (_event, payload: { type: ModelProviderType }) => {

                     const schema = z.object({ type: z.any() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return localExecutionProviderService.setProviderEnabled(payload.type, false)
  }))

  ipcMain.handle('providers:validate', safe(async (_event, payload: { type: ModelProviderType }) => {

                     const schema = z.object({ type: z.any() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return localExecutionProviderService.validateProvider(payload.type)
  }))

  ipcMain.handle('providers:get-metrics', safe(async (_event, payload: { type: ModelProviderType }) => {

                     const schema = z.object({ type: z.any() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return localExecutionProviderService.getMetrics(payload.type)
  }))

  ipcMain.handle('operations:get-queue-monitor', safe(async () => {
    return operationsService.getQueueMonitorPayload()
  }))

  ipcMain.handle('operations:get-notifications', safe(async () => {
    return operationsService.getNotificationPayload()
  }))

  ipcMain.handle('operations:get-daily-brief', safe(async () => {
    return operationsService.getDailyBriefPayload()
  }))

  ipcMain.handle('operations:get-weekly-review', safe(async () => {
    return operationsService.getWeeklyReviewPayload()
  }))

  ipcMain.handle('operations:get-governance', safe(async () => {
    return operationsService.getGovernancePayload()
  }))

  ipcMain.handle(
    'operations:governance-action',
    safe(async (
      _event,
      payload: { decisionId: string; action: 'APPROVE' | 'REJECT' | 'DEFER' | 'COMMIT' }
    ) => {

                       const schema = z.object({ decisionId: z.string(), action: z.enum(['APPROVE', 'REJECT', 'DEFER', 'COMMIT']) });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.applyGovernanceAction(payload.decisionId, payload.action)
    }
  ))

  ipcMain.handle('operations:get-compliance', safe(async () => {
    return operationsService.getCompliancePayload()
  }))

  ipcMain.handle('operations:get-triage', safe(async () => {
    return operationsService.getTriagePayload()
  }))

  ipcMain.handle(
    'operations:triage-action',
    safe(async (_event, payload: { itemId: string; action: 'ANALYZE' | 'CLEAR' }) => {

                       const schema = z.object({ itemId: z.string(), action: z.enum(['ANALYZE', 'CLEAR']) });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.applyTriageAction(payload.itemId, payload.action)
    }))

  ipcMain.handle('operations:get-suites', safe(async () => {
    return operationsService.getSuitePayload()
  }))

  ipcMain.handle('operations:get-funding-digest', safe(async () => {
    return operationsService.getFundingDigestPayload()
  }))

  ipcMain.handle('operations:get-hiring-sim', safe(async () => {
    return operationsService.getHiringSimPayload()
  }))

  ipcMain.handle('operations:get-design-audit', safe(async () => {
    return operationsService.getDesignAuditPayload()
  }))

  ipcMain.handle('operations:get-dashboard', safe(async () => {
    return operationsService.getDashboardPayload()
  }))

  ipcMain.handle('operations:get-infrastructure', safe(async () => {
    return operationsService.getInfrastructurePayload()
  }))

  ipcMain.handle('operations:get-onboarding-kpis', safe(async () => {
    return operationsService.getOnboardingKpiPayload()
  }))

  ipcMain.handle('operations:get-onboarding-commit-status', safe(async () => {
    return operationsService.getOnboardingCommitStatus()
  }))

  ipcMain.handle('operations:get-onboarding-stage-snapshot', safe(async () => {
    return operationsService.getOnboardingStageSnapshot()
  }))

  ipcMain.handle(
    'operations:save-onboarding-stage-snapshot',
    safe(async (
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

                       const schema = z.object({ phases: z.any(), currentStep: z.number(), modelAccess: z.any().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.saveOnboardingStageSnapshot(payload)
    }
  ))

  ipcMain.handle('operations:generate-onboarding-kpis', safe(async () => {
    return operationsService.generateOnboardingKpis()
  }))

  ipcMain.handle(
    'operations:remove-onboarding-kpi',
    safe(async (_event, payload: { agentId: string; kpiId: string }) => {

                       const schema = z.object({ agentId: z.string(), kpiId: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.removeOnboardingKpi(payload.agentId, payload.kpiId)
    }))

  ipcMain.handle(
    'operations:commit-onboarding',
    safe(async (
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

                       const schema = z.object({ kpiData: z.any(), contextByStep: z.any(), approvalByStep: z.any(), agentMappings: z.array(z.any()) });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.commitOnboarding(payload)
    }
  ))

  ipcMain.handle(
    'operations:get-employee-profile',
    safe(async (_event, payload: { employeeId: string }) => {

                       const schema = z.object({ employeeId: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.getEmployeeProfilePayload(payload.employeeId)
    }))

  ipcMain.handle('operations:get-lifecycle-snapshot', safe(async () => {
    return operationsService.getLifecycleSnapshot()
  }))

  ipcMain.handle(
    'operations:list-lifecycle-drafts',
    safe(async (_event, payload?: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN' }) => {

                       const schema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'OVERRIDDEN']).optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.listLifecycleDrafts(payload?.status)
    }))

  ipcMain.handle(
    'operations:review-lifecycle-draft',
    safe(async (
      _event,
      payload: {
        draftId: string
        status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN'
        reviewer: string
        reviewNote?: string
      }
    ) => {

                       const schema = z.object({ draftId: z.string(), status: z.enum(['APPROVED', 'REJECTED', 'OVERRIDDEN']), reviewer: z.string(), reviewNote: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.reviewLifecycleDraft(payload)
    }
  ))

  ipcMain.handle(
    'operations:update-lifecycle-profile',
    safe(async (
      _event,
      payload: {
        agentId: string
        goal: string
        backstory: string
        skills: string[]
        kpis: string[]
      }
    ) => {

                       const schema = z.object({ agentId: z.string(), goal: z.string(), backstory: z.string(), skills: z.array(z.string()), kpis: z.array(z.string()) });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.updateLifecycleProfile(payload)
    }
  ))

  ipcMain.handle(
    'operations:update-lifecycle-skill',
    safe(async (_event, payload: { skillId: string; markdown: string }) => {

                       const schema = z.object({ skillId: z.string(), markdown: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.updateLifecycleSkill(payload)
    }))

  ipcMain.handle(
    'operations:update-lifecycle-kpi',
    safe(async (_event, payload: { kpiId: string; target: string; value?: string }) => {

                       const schema = z.object({ kpiId: z.string(), target: z.string(), value: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.updateLifecycleKpi(payload)
    }))

  ipcMain.handle(
    'operations:update-lifecycle-data-input',
    safe(async (_event, payload: { dataInputId: string; fileName: string; content: string }) => {

                       const schema = z.object({ dataInputId: z.string(), fileName: z.string(), content: z.string() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.updateLifecycleDataInput(payload)
    }))

  ipcMain.handle(
    'operations:create-lifecycle-data-input',
    safe(async (
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

                       const schema = z.object({ dataInputId: z.string(), name: z.string(), description: z.string(), schemaType: z.string(), requiredFields: z.array(z.string()), sampleSource: z.string(), fileName: z.string().optional(), content: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.createLifecycleDataInput(payload)
    }
  ))

  ipcMain.handle(
    'operations:create-cron-proposal',
    safe(async (
      _event,
      payload: {
        id: string
        name: string
        expression: string
        retentionDays?: number
        maxRuntimeMs?: number
      }
    ) => {

                       const schema = z.object({ id: z.string(), name: z.string(), expression: z.string(), retentionDays: z.number().optional(), maxRuntimeMs: z.number().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.createCronProposal(payload)
    }
  ))

  ipcMain.handle(
    'operations:list-cron-proposals',
    safe(async (_event, payload?: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN' }) => {

                       const schema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'OVERRIDDEN']).optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.listCronProposals(payload?.status)
    }))

  ipcMain.handle(
    'operations:review-cron-proposal',
    safe(async (
      _event,
      payload: {
        proposalId: string
        status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN'
        reviewer: string
        reviewNote?: string
      }
    ) => {

                       const schema = z.object({ proposalId: z.string(), status: z.enum(['APPROVED', 'REJECTED', 'OVERRIDDEN']), reviewer: z.string(), reviewNote: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return operationsService.reviewCronProposal(payload)
    }
  ))

  ipcMain.handle('operations:get-task-audit-log', safe(async (_event, payload?: { limit?: number }) => {

                     const schema = z.object({ limit: z.number().optional() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return operationsService.getTaskAuditLog(payload?.limit)
  }))

  ipcMain.handle(
    'channels:route-message',
    safe(async (_event, payload: ChannelMessageEnvelope) => {

                       const schema = z.object({}).catchall(z.any());
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return channelRouterService.routeChannelMessage(payload)
    })
  )

  ipcMain.handle('channels:get-capabilities', safe(async () => {
    return channelRouterService.getChannelCapabilities()
  }))

  ipcMain.handle(
    'channels:route-internal-message',
    safe(async (
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

                       const schema = z.object({ message: z.string(), senderId: z.string(), senderName: z.string().optional(), moduleRoute: z.string(), targetPersonaId: z.string().optional(), roomId: z.string().optional(), sessionId: z.string().optional(), timestampIso: z.string().optional(), isDirector: z.boolean().optional(), metadata: z.any().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return channelRouterService.routeInternalMessage(payload)
    }
  ))

  ipcMain.handle(
    'channels:route-telegram-message',
    safe(async (
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

                       const schema = z.object({ message: z.string(), senderId: z.string(), senderName: z.string().optional(), chatId: z.string().optional(), timestampIso: z.string().optional(), sessionId: z.string().optional(), explicitTargetPersonaId: z.string().optional(), isDirector: z.boolean().optional(), dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).optional(), metadata: z.any().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return channelRouterService.routeTelegramMessage(payload)
    }
  ))

  ipcMain.handle(
    'channels:list-conversations',
    safe(async (_event, payload?: { channel?: 'internal-chat' | 'telegram' | 'whatsapp' | 'webhook' | 'api' | string; limit?: number }) => {

                       const schema = z.object({ channel: z.string().optional(), limit: z.number().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return channelRouterService.listConversations(payload?.channel, payload?.limit)
    }))

  ipcMain.handle(
    'channels:get-conversation-history',
    safe(async (_event, payload: { conversationKey: string; limit?: number }) => {

                       const schema = z.object({ conversationKey: z.string(), limit: z.number().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return channelRouterService.getConversationHistory(payload.conversationKey, payload.limit)
    }))

  ipcMain.handle(
    'work-orders:submit-director-request',
    safe(async (
      _event,
      payload: {
        moduleRoute: string
        targetEmployeeId?: string
        message: string
        timestampIso?: string
      }
    ) => {

                       const schema = z.object({ moduleRoute: z.string(), targetEmployeeId: z.string().optional(), message: z.string(), timestampIso: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return commandRouterService.submitDirectorRequest({
        moduleRoute: payload.moduleRoute,
        targetEmployeeId: payload.targetEmployeeId,
        message: payload.message,
        timestampIso: payload.timestampIso ?? new Date().toISOString()
      })
    }
  ))

  ipcMain.handle('work-orders:start-next', safe(async () => {
    return commandRouterService.startNext()
  }))

  ipcMain.handle('work-orders:process-next', safe(async () => {
    return commandRouterService.processNextToReview()
  }))

  ipcMain.handle(
    'work-orders:complete',
    safe(async (_event, payload: { workOrderId: string; summary?: string }) => {

                       const schema = z.object({ workOrderId: z.string(), summary: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return commandRouterService.complete(payload.workOrderId, payload.summary)
    }))

  ipcMain.handle(
    'work-orders:fail',
    safe(async (_event, payload: { workOrderId: string; error?: string }) => {

                       const schema = z.object({ workOrderId: z.string(), error: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return commandRouterService.fail(payload.workOrderId, payload.error)
    }))

  ipcMain.handle(
    'work-orders:approve',
    safe(async (_event, payload: { workOrderId: string; summary?: string }) => {

                       const schema = z.object({ workOrderId: z.string(), summary: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return commandRouterService.approve(payload.workOrderId, payload.summary)
    }))

  ipcMain.handle(
    'work-orders:reject',
    safe(async (_event, payload: { workOrderId: string; error?: string }) => {

                       const schema = z.object({ workOrderId: z.string(), error: z.string().optional() });
                       const parsed = schema.safeParse(payload);
                       if (!parsed.success) {
                          throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                       }
                     
      return commandRouterService.reject(payload.workOrderId, payload.error)
    }))

  ipcMain.handle('work-orders:list', safe(async () => {
    return workOrderService.list()
  }))

  ipcMain.handle('work-orders:get', safe(async (_event, payload: { id: string }) => {

                     const schema = z.object({ id: z.string() });
                     const parsed = schema.safeParse(payload);
                     if (!parsed.success) {
                        throw new Error(`IPC_VALIDATION_ERROR: ${parsed.error.message}`);
                     }
                   
    return workOrderService.get(payload.id)
  }))

  ipcMain.handle('work-orders:queue-list', safe(async () => {
    return queueService.list()
  }))

  // ── Sandbox Runtime ────────────────────────────────────────────────────────

  ipcMain.handle('sandbox:initialize', safe(async () => {
    enforceToolPolicy({ actor: 'DIRECTOR', action: 'sandbox.initialize' })
    if (sandboxRuntimeEngine.getEngineState() === 'uninitialized') {
      await sandboxRuntimeEngine.initialize()
    }
    return { state: sandboxRuntimeEngine.getEngineState() }
  }))

  ipcMain.handle('sandbox:status', safe(async () => {
    return {
      state: sandboxRuntimeEngine.getEngineState(),
      containers: sandboxRuntimeEngine.listContainers(),
      hostSessionId: sandboxRuntimeEngine.getHostSessionId(),
    }
  }))

  ipcMain.handle(
    'sandbox:start-module',
    async (
      _event,
      payload: { imagePath: string; capabilities?: RuntimeCapabilities },
    ) => {
      enforceToolPolicy({ actor: 'DIRECTOR', action: 'sandbox.start-module', target: payload.imagePath })
      const schema = z.object({ imagePath: z.string().min(1), capabilities: z.any().optional() })
      const parsed = schema.safeParse(payload)
      if (!parsed.success) return { ok: false, error: `IPC_VALIDATION_ERROR: ${parsed.error.message}` }
      const image = await sandboxRuntimeEngine.resolveImage(payload.imagePath)
      const session = await sandboxRuntimeEngine.startModuleContainer(
        image,
        payload.capabilities ?? { sqlite: { read: true, write: true } },
      )
      return { sessionId: session.sessionId, runtimeId: session.runtimeId }
    },
  )

  ipcMain.handle(
    'sandbox:stop-module',
    safe(async (_event, payload: { sessionId: string }) => {
      const schema = z.object({ sessionId: z.string().uuid() })
      const parsed = schema.safeParse(payload)
      if (!parsed.success) return { ok: false, error: `IPC_VALIDATION_ERROR: ${parsed.error.message}` }
      await sandboxRuntimeEngine.stopModuleContainer(payload.sessionId)
      return { stopped: true }
    },
  ))

  ipcMain.handle('sandbox:shutdown', safe(async () => {
    enforceToolPolicy({ actor: 'DIRECTOR', action: 'sandbox.shutdown' })
    await sandboxRuntimeEngine.shutdown()
    return { state: sandboxRuntimeEngine.getEngineState() }
  }))

  // Plugin Sandbox Host — isolated host per launch, bounded by MAX_SANDBOX_HOSTS
  const activeSandboxHosts = new Map<string, ReturnType<typeof createPluginSandboxHost>>()

  const hostIdSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/)

  ipcMain.handle(
    'sandbox:plugin-launch',
    async (
      _event,
      payload: {
        hostId: string
        imagePath?: string
        fixture?: SandboxFixture
        capabilities?: RuntimeCapabilities
      },
    ) => {
      enforceToolPolicy({ actor: 'DIRECTOR', action: 'sandbox.plugin-launch', target: payload.hostId })
      const schema = z.object({
        hostId: hostIdSchema,
        imagePath: z.string().min(1).optional(),
        capabilities: z.any().optional(),
        fixture: z.any().optional(),
      })
      const parsed = schema.safeParse(payload)
      if (!parsed.success) return { ok: false, error: `IPC_VALIDATION_ERROR: ${parsed.error.message}` }
      if (activeSandboxHosts.size >= MAX_SANDBOX_HOSTS) {
        return { ok: false, error: 'sandbox host limit reached' }
      }
      if (activeSandboxHosts.has(payload.hostId)) {
        return { ok: false, error: `sandbox host '${payload.hostId}' already exists` }
      }
      const host = createPluginSandboxHost()
      activeSandboxHosts.set(payload.hostId, host)
      const result = await host.launch(payload.imagePath, payload.fixture, payload.capabilities)
      return result
    },
  )

  ipcMain.handle(
    'sandbox:plugin-shutdown',
    safe(async (_event, payload: { hostId: string }) => {
      const parsed = z.object({ hostId: hostIdSchema }).safeParse(payload)
      if (!parsed.success) return { ok: false, error: `IPC_VALIDATION_ERROR: ${parsed.error.message}` }
      const host = activeSandboxHosts.get(payload.hostId)
      if (!host) return { ok: false, error: 'host not found' }
      await host.shutdown()
      activeSandboxHosts.delete(payload.hostId)
      return { stopped: true }
    },
  ))

  ipcMain.handle(
    'sandbox:plugin-status',
    safe(async (_event, payload: { hostId: string }) => {
      const parsed = z.object({ hostId: hostIdSchema }).safeParse(payload)
      if (!parsed.success) return { ok: false, error: `IPC_VALIDATION_ERROR: ${parsed.error.message}` }
      const host = activeSandboxHosts.get(payload.hostId)
      if (!host) return { ok: false, error: 'host not found' }
      return {
        status: host.getStatus(),
        session: host.getSession(),
        container: host.getContainer(),
      }
    },
  ))

  ipcMain.handle(
    'sandbox:plugin-journal',
    safe(async (_event, payload: { hostId: string; limit?: number }) => {
      const schema = z.object({ hostId: hostIdSchema, limit: z.number().int().min(1).max(500).optional() })
      const parsed = schema.safeParse(payload)
      if (!parsed.success) return { ok: false, error: `IPC_VALIDATION_ERROR: ${parsed.error.message}` }
      const host = activeSandboxHosts.get(payload.hostId)
      if (!host) return { ok: false, error: 'host not found' }
      const raw = host.getJournal(payload.limit ?? 50)
      const entries = raw.map(({ reason: _reason, ...entry }) => ({
        ...entry,
        hasCrashReason: _reason !== undefined,
      }))
      return { entries }
    },
  ))

  ipcMain.handle(
    'sandbox:plugin-health',
    safe(async (_event, payload: { hostId: string }) => {
      const parsed = z.object({ hostId: hostIdSchema }).safeParse(payload)
      if (!parsed.success) return { ok: false, error: `IPC_VALIDATION_ERROR: ${parsed.error.message}` }
      const host = activeSandboxHosts.get(payload.hostId)
      if (!host) return { ok: false, error: 'host not found' }
      return host.evaluateHealth()
    },
  ))
}
