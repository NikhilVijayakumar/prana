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

export { createPranaPlatformRuntime, setPranaPlatformRuntime, getPranaPlatformRuntime, pranaPlatformRuntime } from './common/config/pranaPlatformRuntime';
export { createStartupOrchestrator, getLatestStartupStatus } from './features/operations/startupOrchestratorService';
export { createTokenManager, tokenManagerService } from './common/config/tokenManagerService';
export { createSystemHealthService } from './features/governance/systemHealthService';

// ============================================================================
// Authentication & Security
// ============================================================================

export { authService } from './features/auth/authService';
export { authStoreService } from './features/auth/authStoreService';

// ============================================================================
// Storage & Database
// ============================================================================

export { SqliteService, createSqliteService } from './common/storage/sqliteService';
export { sqliteCacheService } from './common/storage/sqliteCacheService';
export { sqliteConfigStoreService } from './common/storage/sqliteConfigStoreService';

// ============================================================================
// Vault Services
// ============================================================================

export { vaultService } from './features/vault/vaultService';
export { vaultMetadataService } from './features/vault/vaultMetadataService';
export { assertSafeVaultPath, getVirtualDriveProvider, rcloneVirtualDriveProvider, PATH_TRAVERSAL_VIOLATION } from './features/vault/virtualDriveProvider';
export { driveControllerService } from './features/vault/driveControllerService';

// ============================================================================
// Sync & Data Transfer
// ============================================================================

export { createSyncEngine, syncEngineService } from './features/sync/syncEngineService';
export { createSyncProvider, syncProviderService } from './features/sync/syncProviderService';
export { syncStoreService } from './features/sync/syncStoreService';

// ============================================================================
// Scheduling & Cron
// ============================================================================

export { createCronScheduler, cronSchedulerService } from './features/orchestration/cronSchedulerService';

// ============================================================================
// Communication & Channels
// ============================================================================

export { createChannelRouter, channelRouterService } from './features/communication/channelRouterService';
export { createChannelRegistry, channelRegistryService } from './features/communication/channelRegistryService';
export { createEmailService, configureEmailService, emailService } from './features/communication/emailService';
export { emailOrchestratorService } from './features/communication/emailOrchestratorService';
export { emailKnowledgeContextStoreService } from './features/communication/emailKnowledgeContextStoreService';
export { googleBridgeService, GoogleBridgeService } from './features/communication/googleBridgeService';
export { googleSheetsCacheService } from './features/communication/googleSheetsCacheService';

// ============================================================================
// Context & Intelligence
// ============================================================================

export { contextEngineService } from './features/context/contextEngineService';
export { contextDigestStoreService } from './features/context/contextDigestStoreService';
export { memoryIndexService } from './features/context/memoryIndexService';
export { contextOptimizerService } from './features/context/contextOptimizerService';
export { businessContextStoreService } from './features/context/businessContextStoreService';
export { businessContextRegistryService } from './features/context/businessContextRegistryService';
export { businessContextValidationService } from './features/context/businessContextValidationService';
export { businessAlignmentService } from './features/context/businessAlignmentService';

// ============================================================================
// Registry Services
// ============================================================================

export { createCoreRegistry, coreRegistryService } from './features/registry/coreRegistryService';
export { createSkillRegistry, getStaticSkills, skillRegistryService } from './features/agent/skillRegistry';
export { createAgentRegistry, agentRegistryService } from './features/agent/agentRegistryService';
export { taskRegistryService } from './features/registry/taskRegistryService';
export { createQueueOrchestrator, queueOrchestratorService } from './features/orchestration/queueOrchestratorService';
export { mountRegistryService } from './features/registry/mountRegistryService';

// ============================================================================
// Operations & Workflows
// ============================================================================

export { operationsService } from './features/operations/operationsService';
export { workOrderService } from './features/operations/workOrderService';
export { createHookSystem, hookSystemService } from './features/governance/hookSystemService';

// ============================================================================
// Notifications
// ============================================================================

export { createNotificationCentre, subscribe, notificationCentreService } from './features/communication/notificationCentreService';
export { notificationStoreService } from './features/communication/notificationStoreService';

// ============================================================================
// Visual & Templates
// ============================================================================

export { templateService } from './features/operations/templateService';
export { visualIdentityService } from './features/operations/visualIdentityService';

// ============================================================================
// System & Governance
// ============================================================================

export { createVaidyar, vaidyarService } from './features/governance/vaidyarService';
export { ensureGovernanceRepoReady, getAppDataRoot, getGovernanceRepoPath, getMountsBaseDir, setAppDataRootOverride, setSqliteRootOverride } from './features/governance/governanceRepoService';
export { registryRuntimeStoreService } from './features/registry/registryRuntimeStoreService';
export { onboardingStageStoreService } from './features/governance/onboardingStageStoreService';
export { governanceLifecycleQueueStoreService } from './features/governance/governanceLifecycleQueueStoreService';

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
} from './features/sandbox/index';

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
} from './features/sandbox/index';

// ============================================================================
// Administration Integration
// ============================================================================

export { administrationIntegrationService, AdministrationIntegrationService } from './features/operations/administrationIntegrationService';

// ============================================================================
// Execution & Agents
// ============================================================================

export { subagentService } from './features/agent/subagentService';
export { agentExecutionService } from './features/agent/agentExecutionService';
export { commandRouterService } from './features/orchestration/commandRouterService';
export { orchestrationManager } from './features/orchestration/orchestrationManager';
export { runtimeModelAccessService } from './features/intelligence/runtimeModelAccessService';

// ============================================================================
// Policies & Compliance
// ============================================================================

export { policyOrchestratorService } from './features/governance/policyOrchestratorService';
export { toolPolicyService } from './features/governance/toolPolicyService';
export { complianceScanService } from './features/governance/complianceScanService';

// ============================================================================
// Utilities
// ============================================================================

export { auditLogService, AUDIT_ACTIONS, parseAuditJsonLine } from './features/governance/auditLogService';
export { registerIpcHandlers } from './features/governance/ipcService';
export { runtimeDocumentStoreService } from './features/operations/runtimeDocumentStoreService';
export { recoveryService } from './features/operations/recoveryService';
export { recoveryOrchestratorService } from './features/operations/recoveryOrchestratorService';
export { transactionCoordinator } from './features/sync/transactionCoordinator';
export { conflictResolver } from './features/sync/conflictResolver';
export { protocolInterceptor } from './features/orchestration/protocolInterceptor';

// ============================================================================
// Vector Search & RAG
// ============================================================================

export { vectorSearchService } from './features/intelligence/vectorSearchService';
export { ragOrchestratorService } from './features/intelligence/ragOrchestratorService';

// ============================================================================
// Compilation & Review Services
// ============================================================================

export { weeklyReviewCompilerService } from './features/operations/weeklyReviewCompilerService';
export { summarizationAgentService } from './features/intelligence/summarizationAgentService';
export { visualAuditService } from './features/governance/visualAuditService';

// ============================================================================
// Configuration
// ============================================================================

export { getPranaRuntimeConfig, setPranaRuntimeConfig, validatePranaRuntimeConfig, MIN_VAULT_KDF_ITERATIONS, MIN_SYNC_PUSH_INTERVAL_MS } from './common/config/pranaRuntimeConfig';

// ============================================================================
// Types (re-export for consumer convenience)
// ============================================================================

export type { PranaRuntimeConfig } from './common/config/pranaRuntimeConfig';
export type { PranaPlatformRuntime } from './common/config/pranaPlatformRuntime';
export type { StartupStatusReport } from './features/operations/startupOrchestratorService';
export type { SqliteServiceOptions } from './common/storage/sqliteService';
export type { VirtualDriveProvider } from './features/vault/virtualDriveProvider';
export type { AgentSkill } from './features/agent/skillRegistry';
export type { CronJob } from './features/orchestration/cronSchedulerService';