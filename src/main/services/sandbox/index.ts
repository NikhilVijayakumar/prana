// Types
export type {
  RuntimeState,
  ContainerType,
  RuntimeHealth,
  RuntimeCapabilities,
  RuntimeSession,
  RuntimeImageManifest,
  RuntimeImage,
  SessionJournalEvent,
  SessionJournalEntry,
  IPCMessage,
  CapabilityValidationResult,
  ContainerDescriptor,
  SandboxFixture,
  BuiltInFixture,
} from './sandboxTypes'
export { BUILT_IN_FIXTURES } from './sandboxTypes'

// Session Manager
export { createRuntimeSessionManager, runtimeSessionManagerService } from './runtimeSessionManagerService'
export type { RuntimeSessionManager } from './runtimeSessionManagerService'

// Runtime Orchestrator
export { createRuntimeOrchestrator, runtimeOrchestratorService } from './runtimeOrchestratorService'
export type { RuntimeOrchestrator } from './runtimeOrchestratorService'

// IPC Gateway
export { createSandboxIpcGateway, sandboxIpcGateway } from './sandboxIpcGateway'
export type { SandboxIpcGateway } from './sandboxIpcGateway'

// Supervisor
export { createSandboxSupervisor } from './sandboxSupervisorService'
export type { SandboxSupervisor, SupervisorReport, SupervisorAction } from './sandboxSupervisorService'

// Image Manager
export { createRuntimeImageManager, runtimeImageManagerService } from './runtimeImageManagerService'
export type { RuntimeImageManager } from './runtimeImageManagerService'

// Sandbox Runtime Engine
export { createSandboxRuntimeEngine, sandboxRuntimeEngine } from './sandboxRuntimeEngine'
export type { SandboxRuntimeEngine, EngineState, SandboxRuntimeEngineConfig } from './sandboxRuntimeEngine'

// Plugin Sandbox Host (development tool)
export { createPluginSandboxHost, pluginSandboxHost } from './pluginSandboxHost'
export type { PluginSandboxHost, PluginSandboxStatus, PluginSandboxLaunchResult } from './pluginSandboxHost'

// Plugin Runtime Client — import this inside the plugin process
// Same API surface in sandbox and real host — zero integration changes when moving to production
export { createPluginRuntimeClient } from './pluginRuntimeClient'
export type { PluginRuntimeClient } from './pluginRuntimeClient'
