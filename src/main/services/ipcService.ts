import { dialog, ipcMain } from 'electron';
import { authService } from './authService';
import { modelGatewayService } from './modelGatewayService';
import { getPublicRuntimeConfig, getRuntimeIntegrationStatus } from './runtimeConfigService';
import { skillSystemService } from './skillSystemService';
import { vaultService } from './vaultService';
import { operationsService } from './operationsService';
import { contextEngineService, ContextMessageRole } from './contextEngineService';
import { subagentService } from './subagentService';
import { toolPolicyService } from './toolPolicyService';
import { hookSystemService, HookEventType } from './hookSystemService';
import { cronSchedulerService } from './cronSchedulerService';
import { memoryIndexService, MemoryClassification } from './memoryIndexService';
import { memoryQueryService } from './memoryQueryService';
import { commandRouterService } from './commandRouterService';
import { queueService } from './queueService';
import { workOrderService } from './workOrderService';
import { localExecutionProviderService, ModelProviderType } from './localExecutionProviderService';
import { skillRegistryService, SkillType } from './skillRegistry';
import { coreRegistryService } from './coreRegistryService';
import { channelRouterService } from './channelRouterService';
import { syncProviderService } from './syncProviderService';
import { configureRegistryRuntime, RegistryRuntimeConfig } from './registryRuntimeService';
import { startupOrchestratorService } from './startupOrchestratorService';

const enforceToolPolicy = (payload: {
  actor: string;
  action: string;
  target?: string;
  approvedByUser?: boolean;
  metadata?: Record<string, unknown>;
}) => {
  const policy = toolPolicyService.evaluate(payload);

  if (policy.decision !== 'ALLOW') {
    throw new Error(`${policy.reasonCode}: ${policy.message}`);
  }

  return policy;
};

export const registerIpcHandlers = (options?: { registryRuntime?: Partial<RegistryRuntimeConfig> }): void => {
  if (options?.registryRuntime) {
    configureRegistryRuntime(options.registryRuntime);
  }

  void hookSystemService.initialize();
  void cronSchedulerService.initialize();
  void memoryIndexService.initialize();

  ipcMain.handle('app:get-runtime-config', async () => {
    try {
      return getPublicRuntimeConfig();
    } catch (error) {
      return {
        errors: [error instanceof Error ? error.message : 'Runtime config unavailable.'],
      };
    }
  });

  ipcMain.handle('app:get-integration-status', async () => {
    const status = getRuntimeIntegrationStatus();
    if (!status.ready) {
      return {
        ...status,
        ready: false,
      };
    }

    return status;
  });

  ipcMain.handle('app:get-startup-status', async () => {
    return startupOrchestratorService.getLatestStartupStatus();
  });

  ipcMain.handle('auth:get-status', async () => {
    return authService.getStatus();
  });

  ipcMain.handle('auth:login', async (_event, payload: { email: string; password: string }) => {
    return authService.login(payload.email, payload.password);
  });

  ipcMain.handle('auth:forgot-password', async (_event, payload: { email: string }) => {
    return authService.forgotPassword(payload.email);
  });

  ipcMain.handle('auth:reset-password', async (_event, payload: { newPassword: string }) => {
    return authService.resetPassword(payload.newPassword);
  });

  ipcMain.handle('settings:load', async () => {
    return operationsService.loadSettings();
  });

  ipcMain.handle('settings:save', async (_event, payload: {
    language: string;
    preferredModelProvider: 'lmstudio' | 'openrouter' | 'gemini';
    themeMode: 'system' | 'light' | 'dark';
    reducedMotion: boolean;
    syncPushIntervalMs?: number;
    syncCronEnabled?: boolean;
    syncPushCronEnabled?: boolean;
    syncPullCronEnabled?: boolean;
    syncPushCronExpression?: string;
    syncPullCronExpression?: string;
    syncHealthAutoRefreshEnabled?: boolean;
    syncHealthAutoRefreshIntervalMs?: number;
  }) => {
    return operationsService.saveSettings(payload);
  });

  ipcMain.handle('sync:get-status', async () => {
    return syncProviderService.getStatus();
  });

  ipcMain.handle('sync:push-now', async () => {
    await syncProviderService.triggerBackgroundPush();
    return syncProviderService.getStatus();
  });

  ipcMain.handle('sync:pull-now', async () => {
    const result = await syncProviderService.triggerBackgroundPull();
    const status = await syncProviderService.getStatus();
    return {
      result,
      status,
    };
  });

  ipcMain.handle('operations:get-runtime-channel-configuration', async () => {
    return operationsService.getRuntimeChannelConfiguration();
  });

  ipcMain.handle(
    'operations:update-runtime-channel-configuration',
    async (
      _event,
      payload: {
        provider: string;
        allowedChannels: string[];
        approvedAgentsForChannels: Record<string, string[]>;
        channelAccessRules: string;
        telegramChannelId: string;
        webhookSubscriptionUri: string;
        providerCredentials: string;
      },
    ) => {
      return operationsService.updateRuntimeChannelConfiguration(payload);
    },
  );

  ipcMain.handle('operations:get-administration-integration-snapshot', async () => {
    return operationsService.getAdministrationIntegrationSnapshot();
  });

  ipcMain.handle('operations:sync-administration-staff-registry', async () => {
    return operationsService.syncAdministrationStaffRegistry();
  });

  ipcMain.handle('operations:ingest-administration-feedback', async () => {
    return operationsService.ingestAdministrationFeedback();
  });

  ipcMain.handle(
    'operations:convert-document-content',
    async (
      _event,
      payload: {
        sourceFormat: 'markdown' | 'html' | 'docx';
        targetFormat: 'markdown' | 'html' | 'docx';
        content: string;
      },
    ) => {
      return operationsService.convertDocumentContent(payload);
    },
  );

  ipcMain.handle(
    'operations:convert-document-file',
    async (
      _event,
      payload: {
        inputPath: string;
        outputPath: string;
        sourceFormat?: 'markdown' | 'html' | 'docx';
        targetFormat?: 'markdown' | 'html' | 'docx';
      },
    ) => {
      return operationsService.convertDocumentFile(payload);
    },
  );

  ipcMain.handle('operations:run-administration-kpi-happiness-evaluator', async () => {
    return operationsService.runAdministrationKpiHappinessEvaluator();
  });

  ipcMain.handle('operations:run-administration-social-trend-intelligence', async () => {
    return operationsService.runAdministrationSocialTrendIntelligence();
  });

  ipcMain.handle('vault:list-files', async () => {
    return vaultService.listFiles();
  });

  ipcMain.handle('vault:select-and-ingest', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select files for vault ingestion',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Supported Files', extensions: ['csv', 'md', 'markdown', 'txt', 'json', 'pdf', 'xlsx'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    return vaultService.ingestPaths(result.filePaths);
  });

  ipcMain.handle('vault:publish', async (_event, payload?: { message?: string; approvedByUser?: boolean }) => {
    const policy = enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'vault.publish',
      target: 'governance-repository',
      approvedByUser: payload?.approvedByUser === true,
    });

    try {
      const result = await vaultService.publishVaultChanges({
        commitMessage: payload?.message,
        approvedByUser: payload?.approvedByUser === true,
      });

      toolPolicyService.reflect({
        actor: 'DIRECTOR',
        action: 'vault.publish',
        target: 'governance-repository',
        approvedByUser: payload?.approvedByUser === true,
        policyDecision: policy.decision,
        result: 'SUCCESS',
      });

      return result;
    } catch (error) {
      toolPolicyService.reflect({
        actor: 'DIRECTOR',
        action: 'vault.publish',
        target: 'governance-repository',
        approvedByUser: payload?.approvedByUser === true,
        policyDecision: policy.decision,
        result: 'FAILURE',
      });
      throw error;
    }
  });

  ipcMain.handle('vault:create-snapshot', async (_event, payload?: { label?: string }) => {
    return vaultService.createTempSnapshot(payload?.label);
  });

  ipcMain.handle('vault:resume-from-snapshot', async (_event, payload: { snapshotPath: string }) => {
    await vaultService.resumeFromSnapshot(payload.snapshotPath);
    return { success: true };
  });

  ipcMain.handle('vault-knowledge:get-snapshot', async () => {
    return vaultService.getKnowledgeSnapshot();
  });

  ipcMain.handle('vault-knowledge:read-file', async (_event, payload: { relativePath: string }) => {
    enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'vault.knowledge.read',
      target: payload.relativePath,
    });
    return vaultService.readKnowledgeFile(payload.relativePath);
  });

  ipcMain.handle('vault-knowledge:approve', async (_event, payload: { relativePath: string; approvedByUser?: boolean }) => {
    const policy = enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'vault.knowledge.approve',
      target: payload.relativePath,
      approvedByUser: payload.approvedByUser === true,
    });

    try {
      const result = await vaultService.approvePendingFile(payload.relativePath);
      toolPolicyService.reflect({
        actor: 'DIRECTOR',
        action: 'vault.knowledge.approve',
        target: payload.relativePath,
        approvedByUser: payload.approvedByUser === true,
        policyDecision: policy.decision,
        result: 'SUCCESS',
      });
      return result;
    } catch (error) {
      toolPolicyService.reflect({
        actor: 'DIRECTOR',
        action: 'vault.knowledge.approve',
        target: payload.relativePath,
        approvedByUser: payload.approvedByUser === true,
        policyDecision: policy.decision,
        result: 'FAILURE',
      });
      throw error;
    }
  });

  ipcMain.handle('vault-knowledge:reject', async (_event, payload: { relativePath: string; approvedByUser?: boolean }) => {
    const policy = enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'vault.knowledge.reject',
      target: payload.relativePath,
      approvedByUser: payload.approvedByUser === true,
    });

    try {
      const result = await vaultService.rejectPendingFile(payload.relativePath);
      toolPolicyService.reflect({
        actor: 'DIRECTOR',
        action: 'vault.knowledge.reject',
        target: payload.relativePath,
        approvedByUser: payload.approvedByUser === true,
        policyDecision: policy.decision,
        result: 'SUCCESS',
      });
      return result;
    } catch (error) {
      toolPolicyService.reflect({
        actor: 'DIRECTOR',
        action: 'vault.knowledge.reject',
        target: payload.relativePath,
        approvedByUser: payload.approvedByUser === true,
        policyDecision: policy.decision,
        result: 'FAILURE',
      });
      throw error;
    }
  });

  ipcMain.handle('model-gateway:probe', async () => {
    return modelGatewayService.probeGateway();
  });

  ipcMain.handle(
    'context-engine:bootstrap',
    async (_event, payload: {
      sessionId: string;
      budget?: { maxTokens?: number; reservedOutputTokens?: number; compactThresholdTokens?: number; highWaterMarkRatio?: number };
      modelConfig?: { provider: 'lmstudio' | 'openrouter' | 'gemini'; model?: string };
    }) => {
      const result = contextEngineService.bootstrapSession(payload.sessionId, payload.budget, payload.modelConfig);
      await hookSystemService.emit('session.bootstrap', { sessionId: payload.sessionId });
      return result;
    },
  );

  ipcMain.handle(
    'context-engine:ingest',
    async (_event, payload: { sessionId: string; role: ContextMessageRole; content: string }) => {
      const result = await contextEngineService.ingest(payload.sessionId, payload.role, payload.content);
      await hookSystemService.emit('session.message', {
        sessionId: payload.sessionId,
        role: payload.role,
      });
      return result;
    },
  );

  ipcMain.handle(
    'context-engine:ingest-batch',
    async (_event, payload: { sessionId: string; messages: Array<{ role: ContextMessageRole; content: string }> }) => {
      return contextEngineService.ingestBatch(payload.sessionId, payload.messages);
    },
  );

  ipcMain.handle(
    'context-engine:assemble',
    async (_event, payload: { sessionId: string; maxTokensOverride?: number }) => {
      return contextEngineService.assemble(payload.sessionId, payload.maxTokensOverride);
    },
  );

  ipcMain.handle(
    'context-engine:compact',
    async (_event, payload: { sessionId: string; reason?: string }) => {
      return contextEngineService.compact(payload.sessionId, payload.reason);
    },
  );

  ipcMain.handle('context-engine:after-turn', async (_event, payload: { sessionId: string }) => {
    const result = await contextEngineService.afterTurn(payload.sessionId);
    await hookSystemService.emit('session.afterTurn', { sessionId: payload.sessionId });
    return result;
  });

  ipcMain.handle('context-engine:prepare-new-context', async (_event, payload: { sessionId: string }) => {
    return contextEngineService.prepareNewContext(payload.sessionId);
  });

  ipcMain.handle(
    'context-engine:start-new-with-context',
    async (_event, payload: { sourceSessionId: string; targetSessionId: string; summaryOverride?: string }) => {
      return contextEngineService.startNewWithContext(
        payload.sourceSessionId,
        payload.targetSessionId,
        payload.summaryOverride,
      );
    },
  );

  ipcMain.handle('context-engine:get-latest-digest', async (_event, payload: { sessionId: string }) => {
    return contextEngineService.getLatestDigest(payload.sessionId);
  });

  ipcMain.handle(
    'context-engine:list-digests',
    async (_event, payload: { sessionId: string; limit?: number }) => {
      return contextEngineService.listDigests(payload.sessionId, payload.limit);
    },
  );

  ipcMain.handle(
    'context-engine:prepare-subagent-spawn',
    async (_event, payload: { parentSessionId: string; childSessionId: string }) => {
      return contextEngineService.prepareSubagentSpawn(payload.parentSessionId, payload.childSessionId);
    },
  );

  ipcMain.handle(
    'context-engine:on-subagent-ended',
    async (_event, payload: { parentSessionId: string; childSessionId: string; summary: string }) => {
      return contextEngineService.onSubagentEnded(payload.parentSessionId, payload.childSessionId, payload.summary);
    },
  );

  ipcMain.handle('context-engine:get-session', async (_event, payload: { sessionId: string }) => {
    return contextEngineService.getSessionSnapshot(payload.sessionId);
  });

  ipcMain.handle('context-engine:list-sessions', async () => {
    return contextEngineService.listSessions();
  });

  ipcMain.handle('context-engine:get-telemetry', async () => {
    return contextEngineService.getTelemetry();
  });

  ipcMain.handle('context-engine:dispose', async (_event, payload: { sessionId: string }) => {
    return contextEngineService.disposeSession(payload.sessionId);
  });

  ipcMain.handle(
    'subagents:spawn',
    async (
      _event,
      payload: {
        agentName: string;
        model?: string;
        parentId?: string;
        parentSessionId?: string;
        sessionId?: string;
        approvedByUser?: boolean;
      },
    ) => {
      const parentDepth = payload.parentId ? subagentService.get(payload.parentId)?.depth ?? 0 : 0;
      const nextDepth = payload.parentId ? parentDepth + 1 : 0;

      const policy = enforceToolPolicy({
        actor: payload.agentName,
        action: 'subagents.spawn',
        target: payload.parentId ?? 'root',
        approvedByUser: payload.approvedByUser === true,
        metadata: {
          depth: nextDepth,
          maxDepth: 12,
          activeSubagents: subagentService.getTelemetry().running,
          maxActiveSubagents: 128,
        },
      });

      try {
        const result = subagentService.spawn(payload);
        toolPolicyService.reflect({
          actor: payload.agentName,
          action: 'subagents.spawn',
          target: payload.parentId ?? 'root',
          approvedByUser: payload.approvedByUser === true,
          policyDecision: policy.decision,
          result: 'SUCCESS',
          metadata: {
            nextDepth,
          },
        });
        return result;
      } catch (error) {
        toolPolicyService.reflect({
          actor: payload.agentName,
          action: 'subagents.spawn',
          target: payload.parentId ?? 'root',
          approvedByUser: payload.approvedByUser === true,
          policyDecision: policy.decision,
          result: 'FAILURE',
          metadata: {
            nextDepth,
          },
        });
        throw error;
      }
    },
  );

  ipcMain.handle('subagents:heartbeat', async (_event, payload: { id: string }) => {
    return subagentService.heartbeat(payload.id);
  });

  ipcMain.handle('subagents:complete', async (_event, payload: { id: string; summary?: string }) => {
    return subagentService.complete(payload.id, payload.summary);
  });

  ipcMain.handle('subagents:fail', async (_event, payload: { id: string; error?: string }) => {
    return subagentService.fail(payload.id, payload.error);
  });

  ipcMain.handle('subagents:cancel', async (_event, payload: { id: string; summary?: string }) => {
    return subagentService.cancel(payload.id, payload.summary);
  });

  ipcMain.handle('subagents:timeout-sweep', async (_event, payload?: { timeoutMs?: number }) => {
    return subagentService.timeoutSweep(payload?.timeoutMs);
  });

  ipcMain.handle('subagents:list', async () => {
    return subagentService.list();
  });

  ipcMain.handle('subagents:get', async (_event, payload: { id: string }) => {
    return subagentService.get(payload.id);
  });

  ipcMain.handle('subagents:tree', async () => {
    return subagentService.getTree();
  });

  ipcMain.handle('subagents:telemetry', async () => {
    return subagentService.getTelemetry();
  });

  ipcMain.handle('subagents:dispose', async (_event, payload: { id: string }) => {
    return subagentService.dispose(payload.id);
  });

  ipcMain.handle('tool-policy:evaluate', async (_event, payload: {
    actor: string;
    action: string;
    target?: string;
    approvedByUser?: boolean;
    metadata?: Record<string, unknown>;
  }) => {
    return toolPolicyService.evaluate(payload);
  });

  ipcMain.handle('tool-policy:list-audits', async () => {
    return toolPolicyService.listAudits();
  });

  ipcMain.handle('tool-policy:list-reflections', async (_event, payload?: { limit?: number }) => {
    return toolPolicyService.listReflections(payload?.limit);
  });

  ipcMain.handle('tool-policy:get-telemetry', async () => {
    return toolPolicyService.getTelemetry();
  });

  ipcMain.handle('hooks:list', async () => {
    return hookSystemService.listHooks();
  });

  ipcMain.handle('hooks:set-enabled', async (_event, payload: { hookId: string; enabled: boolean }) => {
    return hookSystemService.setHookEnabled(payload.hookId, payload.enabled);
  });

  ipcMain.handle('hooks:get-telemetry', async () => {
    return hookSystemService.getTelemetry();
  });

  ipcMain.handle('hooks:get-executions', async (_event, payload?: { limit?: number }) => {
    return hookSystemService.listExecutions(payload?.limit);
  });

  ipcMain.handle('hooks:get-notifications', async (_event, payload?: { limit?: number }) => {
    return hookSystemService.listNotifications(payload?.limit);
  });

  ipcMain.handle(
    'hooks:emit',
    async (_event, payload: { event: HookEventType; data?: Record<string, unknown>; wait?: boolean }) => {
      if (payload.wait === true) {
        return hookSystemService.emitAndWait(payload.event, payload.data ?? {});
      }
      return hookSystemService.emit(payload.event, payload.data ?? {});
    },
  );

  ipcMain.handle('hooks:events', async () => {
    return hookSystemService.getEventCatalog();
  });

  ipcMain.handle('cron:list', async () => {
    return cronSchedulerService.listJobs();
  });

  ipcMain.handle(
    'cron:upsert',
    async (
      _event,
      payload: {
        id: string;
        name: string;
        expression: string;
        enabled?: boolean;
        retentionDays?: number;
        maxRuntimeMs?: number;
      },
    ) => {
      return cronSchedulerService.upsertJob(payload);
    },
  );

  ipcMain.handle('cron:remove', async (_event, payload: { id: string }) => {
    return cronSchedulerService.removeJob(payload.id);
  });

  ipcMain.handle('cron:pause', async (_event, payload: { id: string }) => {
    return cronSchedulerService.pauseJob(payload.id);
  });

  ipcMain.handle('cron:resume', async (_event, payload: { id: string }) => {
    return cronSchedulerService.resumeJob(payload.id);
  });

  ipcMain.handle('cron:run-now', async (_event, payload: { id: string }) => {
    return cronSchedulerService.runNow(payload.id);
  });

  ipcMain.handle('cron:tick', async () => {
    await cronSchedulerService.tick();
    return { success: true };
  });

  ipcMain.handle('cron:telemetry', async () => {
    return cronSchedulerService.getTelemetry();
  });

  ipcMain.handle(
    'memory:query',
    async (
      _event,
      payload: {
        query: string;
        limit?: number;
        allowedClassifications?: MemoryClassification[];
        pathPrefixes?: string[];
      },
    ) => {
      enforceToolPolicy({
        actor: 'DIRECTOR',
        action: 'memory.query',
        target: payload.pathPrefixes?.join(',') ?? 'vault-memory',
      });

      return memoryQueryService.query(payload);
    },
  );

  ipcMain.handle(
    'memory:index-text',
    async (
      _event,
      payload: {
        relativePath: string;
        content: string;
        classification?: MemoryClassification;
      },
    ) => {
      enforceToolPolicy({
        actor: 'DIRECTOR',
        action: 'memory.index',
        target: payload.relativePath,
      });

      return memoryIndexService.indexText(payload);
    },
  );

  ipcMain.handle(
    'memory:reindex-directory',
    async (_event, payload?: { rootPath?: string }) => {
      const rootPath = payload?.rootPath ?? vaultService.getWorkingRootPath();
      enforceToolPolicy({
        actor: 'DIRECTOR',
        action: 'memory.reindex',
        target: rootPath,
      });

      return memoryIndexService.reindexDirectory(rootPath);
    },
  );

  ipcMain.handle('memory:remove-path', async (_event, payload: { relativePath: string }) => {
    enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'memory.remove',
      target: payload.relativePath,
    });

    return memoryIndexService.removePath(payload.relativePath);
  });

  ipcMain.handle('memory:health', async () => {
    return memoryQueryService.health();
  });

  ipcMain.handle('skills:list', async () => {
    return skillSystemService.listWorkspaceSkills();
  });

  ipcMain.handle('skills:execute', async (_event, payload: { skillId: string }) => {
    enforceToolPolicy({
      actor: 'DIRECTOR',
      action: 'skills.execute',
      target: payload.skillId,
    });
    return skillSystemService.executeSkill(payload.skillId);
  });

  ipcMain.handle('skills:get-registry', async () => {
    return skillRegistryService.listAllSkills();
  });

  ipcMain.handle('skills:get-agent-skills', async (_event, payload: { agentId: string }) => {
    return skillRegistryService.getAgentSkills(payload.agentId);
  });

  ipcMain.handle('skills:get-type-skills', async (_event, payload: { type: SkillType }) => {
    return skillRegistryService.getSkillsByType(payload.type);
  });

  ipcMain.handle('skills:get-tag-skills', async (_event, payload: { tag: string }) => {
    return skillRegistryService.getByTag(payload.tag);
  });

  ipcMain.handle('registry:get-snapshot', async () => {
    return coreRegistryService.getSnapshot();
  });

  ipcMain.handle('registry:reload', async () => {
    return coreRegistryService.reload();
  });

  ipcMain.handle('registry:get-version', async () => {
    return coreRegistryService.getVersion();
  });

  ipcMain.handle('registry:get-onboarding-blueprint', async () => {
    return coreRegistryService.getSnapshot().onboarding;
  });

  ipcMain.handle(
    'registry:search-files',
    async (_event, payload?: { keyword?: string; section?: string; extensions?: string[] }) => {
      return coreRegistryService.searchFiles(payload);
    },
  );

  ipcMain.handle('registry:read-file', async (_event, payload: { relativePath: string }) => {
    return coreRegistryService.readFile(payload.relativePath);
  });

  ipcMain.handle('registry:save-markdown', async (_event, payload: { relativePath: string; content: string }) => {
    return coreRegistryService.saveMarkdown(payload.relativePath, payload.content);
  });

  ipcMain.handle(
    'registry:upload-file',
    async (_event, payload: { relativeDir: string; fileName: string; content: string }) => {
      return coreRegistryService.uploadFile(payload);
    },
  );

  ipcMain.handle('providers:list', async () => {
    return localExecutionProviderService.listProvidersSafe();
  });

  ipcMain.handle('providers:set-master-password', async (_event, payload: { password: string }) => {
    localExecutionProviderService.setMasterPassword(payload.password);
    return { success: true };
  });

  ipcMain.handle(
    'providers:configure',
    async (_event, payload: { type: ModelProviderType; config: Record<string, unknown> }) => {
      localExecutionProviderService.configureProvider(payload.type, payload.config);
      return { success: true };
    },
  );

  ipcMain.handle('providers:enable', async (_event, payload: { type: ModelProviderType }) => {
    return localExecutionProviderService.setProviderEnabled(payload.type, true);
  });

  ipcMain.handle('providers:disable', async (_event, payload: { type: ModelProviderType }) => {
    return localExecutionProviderService.setProviderEnabled(payload.type, false);
  });

  ipcMain.handle('providers:validate', async (_event, payload: { type: ModelProviderType }) => {
    return localExecutionProviderService.validateProvider(payload.type);
  });

  ipcMain.handle('providers:get-metrics', async (_event, payload: { type: ModelProviderType }) => {
    return localExecutionProviderService.getMetrics(payload.type);
  });

  ipcMain.handle('operations:get-queue-monitor', async () => {
    return operationsService.getQueueMonitorPayload();
  });

  ipcMain.handle('operations:get-notifications', async () => {
    return operationsService.getNotificationPayload();
  });

  ipcMain.handle('operations:get-daily-brief', async () => {
    return operationsService.getDailyBriefPayload();
  });

  ipcMain.handle('operations:get-weekly-review', async () => {
    return operationsService.getWeeklyReviewPayload();
  });

  ipcMain.handle('operations:get-governance', async () => {
    return operationsService.getGovernancePayload();
  });

  ipcMain.handle('operations:governance-action', async (_event, payload: { decisionId: string; action: 'APPROVE' | 'REJECT' | 'DEFER' | 'COMMIT' }) => {
    return operationsService.applyGovernanceAction(payload.decisionId, payload.action);
  });

  ipcMain.handle('operations:get-compliance', async () => {
    return operationsService.getCompliancePayload();
  });

  ipcMain.handle('operations:get-triage', async () => {
    return operationsService.getTriagePayload();
  });

  ipcMain.handle('operations:triage-action', async (_event, payload: { itemId: string; action: 'ANALYZE' | 'CLEAR' }) => {
    return operationsService.applyTriageAction(payload.itemId, payload.action);
  });

  ipcMain.handle('operations:get-suites', async () => {
    return operationsService.getSuitePayload();
  });

  ipcMain.handle('operations:get-funding-digest', async () => {
    return operationsService.getFundingDigestPayload();
  });

  ipcMain.handle('operations:get-hiring-sim', async () => {
    return operationsService.getHiringSimPayload();
  });

  ipcMain.handle('operations:get-design-audit', async () => {
    return operationsService.getDesignAuditPayload();
  });

  ipcMain.handle('operations:get-dashboard', async () => {
    return operationsService.getDashboardPayload();
  });

  ipcMain.handle('operations:get-infrastructure', async () => {
    return operationsService.getInfrastructurePayload();
  });

  ipcMain.handle('operations:get-onboarding-kpis', async () => {
    return operationsService.getOnboardingKpiPayload();
  });

  ipcMain.handle('operations:get-onboarding-commit-status', async () => {
    return operationsService.getOnboardingCommitStatus();
  });

  ipcMain.handle('operations:get-onboarding-stage-snapshot', async () => {
    return operationsService.getOnboardingStageSnapshot();
  });

  ipcMain.handle(
    'operations:save-onboarding-stage-snapshot',
    async (
      _event,
      payload: {
        phases: Record<string, {
          status: 'PENDING' | 'DRAFT' | 'APPROVED';
          contextByKey: Record<string, string>;
          requiresReverification: boolean;
        }>;
        currentStep: number;
        modelAccess?: Record<string, unknown>;
      },
    ) => {
      return operationsService.saveOnboardingStageSnapshot(payload);
    },
  );

  ipcMain.handle('operations:generate-onboarding-kpis', async () => {
    return operationsService.generateOnboardingKpis();
  });

  ipcMain.handle('operations:remove-onboarding-kpi', async (_event, payload: { agentId: string; kpiId: string }) => {
    return operationsService.removeOnboardingKpi(payload.agentId, payload.kpiId);
  });

  ipcMain.handle(
    'operations:commit-onboarding',
    async (
      _event,
      payload: {
        kpiData: Record<string, string>;
        contextByStep: Record<string, Record<string, string>>;
        approvalByStep: Record<string, 'PENDING' | 'DRAFT' | 'APPROVED'>;
        agentMappings: Record<string, {
          skills: string[];
          protocols: string[];
          kpis: string[];
          workflows: string[];
        }>;
      },
    ) => {
      return operationsService.commitOnboarding(payload);
    },
  );

  ipcMain.handle('operations:get-employee-profile', async (_event, payload: { employeeId: string }) => {
    return operationsService.getEmployeeProfilePayload(payload.employeeId);
  });

  ipcMain.handle('operations:get-lifecycle-snapshot', async () => {
    return operationsService.getLifecycleSnapshot();
  });

  ipcMain.handle('operations:list-lifecycle-drafts', async (_event, payload?: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN' }) => {
    return operationsService.listLifecycleDrafts(payload?.status);
  });

  ipcMain.handle(
    'operations:review-lifecycle-draft',
    async (
      _event,
      payload: {
        draftId: string;
        status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';
        reviewer: string;
        reviewNote?: string;
      },
    ) => {
      return operationsService.reviewLifecycleDraft(payload);
    },
  );

  ipcMain.handle(
    'operations:update-lifecycle-profile',
    async (
      _event,
      payload: {
        agentId: string;
        goal: string;
        backstory: string;
        skills: string[];
        kpis: string[];
      },
    ) => {
      return operationsService.updateLifecycleProfile(payload);
    },
  );

  ipcMain.handle(
    'operations:update-lifecycle-skill',
    async (_event, payload: { skillId: string; markdown: string }) => {
      return operationsService.updateLifecycleSkill(payload);
    },
  );

  ipcMain.handle(
    'operations:update-lifecycle-kpi',
    async (_event, payload: { kpiId: string; target: string; value?: string }) => {
      return operationsService.updateLifecycleKpi(payload);
    },
  );

  ipcMain.handle(
    'operations:update-lifecycle-data-input',
    async (_event, payload: { dataInputId: string; fileName: string; content: string }) => {
      return operationsService.updateLifecycleDataInput(payload);
    },
  );

  ipcMain.handle(
    'operations:create-lifecycle-data-input',
    async (
      _event,
      payload: {
        dataInputId: string;
        name: string;
        description: string;
        schemaType: string;
        requiredFields: string[];
        sampleSource: string;
        fileName?: string;
        content?: string;
      },
    ) => {
      return operationsService.createLifecycleDataInput(payload);
    },
  );

  ipcMain.handle(
    'operations:create-cron-proposal',
    async (
      _event,
      payload: {
        id: string;
        name: string;
        expression: string;
        retentionDays?: number;
        maxRuntimeMs?: number;
      },
    ) => {
      return operationsService.createCronProposal(payload);
    },
  );

  ipcMain.handle('operations:list-cron-proposals', async (_event, payload?: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN' }) => {
    return operationsService.listCronProposals(payload?.status);
  });

  ipcMain.handle(
    'operations:review-cron-proposal',
    async (
      _event,
      payload: {
        proposalId: string;
        status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';
        reviewer: string;
        reviewNote?: string;
      },
    ) => {
      return operationsService.reviewCronProposal(payload);
    },
  );

  ipcMain.handle('operations:get-task-audit-log', async (_event, payload?: { limit?: number }) => {
    return operationsService.getTaskAuditLog(payload?.limit);
  });

  ipcMain.handle(
    'channels:route-telegram-message',
    async (
      _event,
      payload: {
        message: string;
        senderId: string;
        senderName?: string;
        chatId?: string;
        timestampIso?: string;
        sessionId?: string;
        explicitTargetPersonaId?: string;
        isDirector?: boolean;
        dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
        metadata?: Record<string, unknown>;
      },
    ) => {
      return channelRouterService.routeTelegramMessage(payload);
    },
  );

  ipcMain.handle(
    'work-orders:submit-director-request',
    async (
      _event,
      payload: {
        moduleRoute: string;
        targetEmployeeId?: string;
        message: string;
        timestampIso?: string;
      },
    ) => {
      return commandRouterService.submitDirectorRequest({
        moduleRoute: payload.moduleRoute,
        targetEmployeeId: payload.targetEmployeeId,
        message: payload.message,
        timestampIso: payload.timestampIso ?? new Date().toISOString(),
      });
    },
  );

  ipcMain.handle('work-orders:start-next', async () => {
    return commandRouterService.startNext();
  });

  ipcMain.handle('work-orders:process-next', async () => {
    return commandRouterService.processNextToReview();
  });

  ipcMain.handle('work-orders:complete', async (_event, payload: { workOrderId: string; summary?: string }) => {
    return commandRouterService.complete(payload.workOrderId, payload.summary);
  });

  ipcMain.handle('work-orders:fail', async (_event, payload: { workOrderId: string; error?: string }) => {
    return commandRouterService.fail(payload.workOrderId, payload.error);
  });

  ipcMain.handle('work-orders:approve', async (_event, payload: { workOrderId: string; summary?: string }) => {
    return commandRouterService.approve(payload.workOrderId, payload.summary);
  });

  ipcMain.handle('work-orders:reject', async (_event, payload: { workOrderId: string; error?: string }) => {
    return commandRouterService.reject(payload.workOrderId, payload.error);
  });

  ipcMain.handle('work-orders:list', async () => {
    return workOrderService.list();
  });

  ipcMain.handle('work-orders:get', async (_event, payload: { id: string }) => {
    return workOrderService.get(payload.id);
  });

  ipcMain.handle('work-orders:queue-list', async () => {
    return queueService.list();
  });
};
