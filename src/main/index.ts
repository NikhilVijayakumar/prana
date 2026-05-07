/**
 * Prana Runtime - Stateless Service Framework
 *
 * Import services directly as npm/ESM dependency:
 * import { createAuthService, createVaultService } from 'prana';
 *
 * @version 2.0.0
 */

// ============================================================================
// Core Runtime Services
// ============================================================================

export { createPranaPlatformRuntime, setPranaPlatformRuntime, getPranaPlatformRuntime, pranaPlatformRuntime } from './services/pranaPlatformRuntime';
export { createStartupOrchestrator, getLatestStartupStatus } from './services/startupOrchestratorService';
export { createTokenManager, tokenManagerService } from './services/tokenManagerService';
export { createSystemHealthService } from './services/systemHealthService';

// ============================================================================
// Authentication & Security
// ============================================================================

export { authService } from './services/authService';
export { authStoreService } from './services/authStoreService';

// ============================================================================
// Storage & Database
// ============================================================================

export { SqliteService, createSqliteService } from './services/sqliteService';
export { sqliteCacheService } from './services/sqliteCacheService';
export { sqliteConfigStoreService } from './services/sqliteConfigStoreService';

// ============================================================================
// Vault Services
// ============================================================================

export { vaultService } from './services/vaultService';
export { vaultMetadataService } from './services/vaultMetadataService';
export { assertSafeVaultPath, getVirtualDriveProvider, rcloneVirtualDriveProvider, PATH_TRAVERSAL_VIOLATION } from './services/virtualDriveProvider';
export { driveControllerService } from './services/driveControllerService';

// ============================================================================
// Sync & Data Transfer
// ============================================================================

export { createSyncEngine, syncEngineService } from './services/syncEngineService';
export { createSyncProvider, syncProviderService } from './services/syncProviderService';
export { syncStoreService } from './services/syncStoreService';

// ============================================================================
// Scheduling & Cron
// ============================================================================

export { createCronScheduler, cronSchedulerService } from './services/cronSchedulerService';

// ============================================================================
// Communication & Channels
// ============================================================================

export { createChannelRouter, channelRouterService } from './services/channelRouterService';
export { createChannelRegistry, channelRegistryService } from './services/channelRegistryService';
export { createEmailService, configureEmailService, emailService } from './services/emailService';
export { emailOrchestratorService } from './services/emailOrchestratorService';
export { emailKnowledgeContextStoreService } from './services/emailKnowledgeContextStoreService';
export { googleBridgeService, GoogleBridgeService } from './services/googleBridgeService';
export { googleSheetsCacheService } from './services/googleSheetsCacheService';

// ============================================================================
// Context & Intelligence
// ============================================================================

export { contextEngineService } from './services/contextEngineService';
export { contextDigestStoreService } from './services/contextDigestStoreService';
export { memoryIndexService } from './services/memoryIndexService';
export { contextOptimizerService } from './services/contextOptimizerService';
export { businessContextStoreService } from './services/businessContextStoreService';
export { businessContextRegistryService } from './services/businessContextRegistryService';
export { businessContextValidationService } from './services/businessContextValidationService';
export { businessAlignmentService } from './services/businessAlignmentService';

// ============================================================================
// Registry Services
// ============================================================================

export { createCoreRegistry, coreRegistryService } from './services/coreRegistryService';
export { createSkillRegistry, getStaticSkills, skillRegistryService } from './services/skillRegistry';
export { createAgentRegistry, agentRegistryService } from './services/agentRegistryService';
export { taskRegistryService } from './services/taskRegistryService';
export { createQueueOrchestrator, queueOrchestratorService } from './services/queueOrchestratorService';
export { mountRegistryService } from './services/mountRegistryService';

// ============================================================================
// Operations & Workflows
// ============================================================================

export { operationsService } from './services/operationsService';
export { workOrderService } from './services/workOrderService';
export { createHookSystem, hookSystemService } from './services/hookSystemService';

// ============================================================================
// Notifications
// ============================================================================

export { createNotificationCentre, subscribe, notificationCentreService } from './services/notificationCentreService';
export { notificationStoreService } from './services/notificationStoreService';

// ============================================================================
// Visual & Templates
// ============================================================================

export { templateService } from './services/templateService';
export { visualIdentityService } from './services/visualIdentityService';

// ============================================================================
// System & Governance
// ============================================================================

export { createVaidyar, vaidyarService } from './services/vaidyarService';
export { ensureGovernanceRepoReady, getAppDataRoot, getGovernanceRepoPath, getMountsBaseDir, setAppDataRootOverride, setSqliteRootOverride } from './services/governanceRepoService';
export { registryRuntimeStoreService } from './services/registryRuntimeStoreService';
export { onboardingStageStoreService } from './services/onboardingStageStoreService';
export { governanceLifecycleQueueStoreService } from './services/governanceLifecycleQueueStoreService';

// ============================================================================
// Sandbox Runtime
// ============================================================================

export {
  createSandboxRuntimeEngine,
  sandboxRuntimeEngine,
  createRuntimeOrchestrator,
  runtimeOrchestratorService,
  createRuntimeSessionManager,
  runtimeSessionManagerService,
  createSandboxIpcGateway,
  sandboxIpcGateway,
  createSandboxSupervisor,
  createRuntimeImageManager,
  runtimeImageManagerService,
  createPluginSandboxHost,
  pluginSandboxHost,
  BUILT_IN_FIXTURES,
} from './services/sandbox/index';

export type {
  RuntimeState,
  ContainerType,
  RuntimeHealth,
  RuntimeCapabilities,
  RuntimeSession,
  RuntimeImageManifest,
  RuntimeImage,
  SessionJournalEntry,
  IPCMessage,
  CapabilityValidationResult,
  ContainerDescriptor,
  SandboxFixture,
  BuiltInFixture,
  EngineState,
  SandboxRuntimeEngineConfig,
  PluginSandboxStatus,
  PluginSandboxLaunchResult,
  SupervisorReport,
  SupervisorAction,
} from './services/sandbox/index';

// ============================================================================
// Administration Integration
// ============================================================================

export { administrationIntegrationService, AdministrationIntegrationService } from './services/administrationIntegrationService';

// ============================================================================
// Execution & Agents
// ============================================================================

export { subagentService } from './services/subagentService';
export { agentExecutionService } from './services/agentExecutionService';
export { commandRouterService } from './services/commandRouterService';
export { orchestrationManager } from './services/orchestrationManager';
export { runtimeModelAccessService } from './services/runtimeModelAccessService';

// ============================================================================
// Policies & Compliance
// ============================================================================

export { policyOrchestratorService } from './services/policyOrchestratorService';
export { toolPolicyService } from './services/toolPolicyService';
export { complianceScanService } from './services/complianceScanService';

// ============================================================================
// Utilities
// ============================================================================

export { auditLogService, AUDIT_ACTIONS, parseAuditJsonLine } from './services/auditLogService';
export { registerIpcHandlers } from './services/ipcService';
export { runtimeDocumentStoreService } from './services/runtimeDocumentStoreService';
export { recoveryService } from './services/recoveryService';
export { recoveryOrchestratorService } from './services/recoveryOrchestratorService';
export { transactionCoordinator } from './services/transactionCoordinator';
export { conflictResolver } from './services/conflictResolver';
export { protocolInterceptor } from './services/protocolInterceptor';

// ============================================================================
// Vector Search & RAG
// ============================================================================

export { vectorSearchService } from './services/vectorSearchService';
export { ragOrchestratorService } from './services/ragOrchestratorService';

// ============================================================================
// Compilation & Review Services
// ============================================================================

export { weeklyReviewCompilerService } from './services/weeklyReviewCompilerService';
export { summarizationAgentService } from './services/summarizationAgentService';
export { visualAuditService } from './services/visualAuditService';

// ============================================================================
// Configuration
// ============================================================================

export { getPranaRuntimeConfig, setPranaRuntimeConfig, validatePranaRuntimeConfig, MIN_VAULT_KDF_ITERATIONS, MIN_SYNC_PUSH_INTERVAL_MS } from './services/pranaRuntimeConfig';

// ============================================================================
// Types (re-export for consumer convenience)
// ============================================================================

export type { PranaRuntimeConfig } from './services/pranaRuntimeConfig';
export type { PranaPlatformRuntime } from './services/pranaPlatformRuntime';
export type { StartupStatusReport } from './services/startupOrchestratorService';
export type { SqliteServiceOptions } from './services/sqliteService';
export type { VirtualDriveProvider } from './services/virtualDriveProvider';
export type { AgentSkill } from './services/skillRegistry';
export type { CronJob } from './services/cronSchedulerService';