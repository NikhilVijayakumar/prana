/**
 * Prana Runtime — Main Process Entry Point
 *
 * Exports the bootstrap entry point and service registry for application consumption.
 * All runtime services are initialized via prana.initialize().
 *
 * @version 2.0.0
 */

// Bootstrap & Service Registry
export { prana } from './features/bootstrap/pranaBootstrap';
export { serviceRegistry } from './features/bootstrap/serviceRegistry';
export type { IPranaRuntime, PranaConfig, BootstrapState, BootstrapError } from './features/bootstrap/pranaBootstrap';
export type { IServiceRegistry } from './features/bootstrap/serviceRegistry';

// Event Registry
export { eventRegistryService } from './features/event-registry/eventRegistryService';
export type { IEventRegistry, RuntimeEvent, EventHandler, SubscriptionId } from './features/event-registry/eventRegistryService';

// Storage
export { sqliteRuntimeService } from './features/storage/sqliteRuntimeService';
export type { ISqliteRuntimeService } from './features/storage/sqliteRuntimeService';

// Sync Engine
export { syncEngineService } from './features/sync-engine/syncEngineService';
export type { ISyncEngineService, IDomainAdapter, SyncJob, SyncResult, SyncDomain, SyncOperation } from './features/sync-engine/syncEngineService';

// Storage Scheduler
export { storageSchedulerService } from './features/storage-scheduler/storageSchedulerService';
export { registerStorageSchedulerIpcHandlers } from './features/storage-scheduler/storageSchedulerIpc';
export type { StorageJob, ConflictRecord, SchedulerStatusData, QueueDepthData, SchedulerMetricsData } from './features/storage-scheduler/storageSchedulerService';

// Runtime
export { runtimeService } from './features/runtime/runtimeService';
export { registerRuntimeIpcHandlers } from './features/runtime/runtimeIpc';
export type { AppRegistryRecord, IdentityAccount, RuntimeConfigEntry, AppLifecycleStatus } from './features/runtime/runtimeService';

// Google Bridge
export { googleBridgeService, registerGoogleBridgeIpcHandlers } from './features/google-bridge/googleBridgeService';
export type { WorkspaceMetaRecord, SyncStatusSnapshot } from './features/google-bridge/googleBridgeService';

// Viewers
export { registerMarkdownViewerIpcHandlers } from './features/viewers/markdown/markdownViewerIpc';
export { registerPdfViewerIpcHandlers } from './features/viewers/pdf/pdfViewerIpc';
