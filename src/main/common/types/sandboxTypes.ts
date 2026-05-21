export type RuntimeState =
  | 'IDLE'
  | 'CREATED'
  | 'PREPARING'
  | 'STARTING'
  | 'RUNNING'
  | 'SUSPENDING'
  | 'STOPPING'
  | 'DESTROYED'
  | 'FAILED'

export type ContainerType = 'host' | 'sqlite' | 'vault' | 'module'

export interface RuntimeHealth {
  heartbeat: boolean
  memoryUsage: number
  ipcLatency: number
  eventLoopLag: number
  lastActivity: number
}

export interface RuntimeCapabilities {
  sqlite?: { read: boolean; write: boolean }
  vault?: { read: boolean; write: boolean }
  notifications?: { emit: boolean }
  sync?: { read: boolean }
}

export interface RuntimeSession {
  sessionId: string
  runtimeId: string
  runtimeVersion: string
  state: RuntimeState
  startedAt: number
  capabilities: RuntimeCapabilities
  hydrationVersion: number
  runtimeHealth: RuntimeHealth
  processId?: number
  metadata: Record<string, unknown>
}

export interface RuntimeImageManifest {
  schemaVersion: number
  runtime: {
    id: string
    version: string
    entry: string
  }
  permissions?: RuntimeCapabilities
}

export interface RuntimeImage {
  id: string
  version: string
  entry: string
  manifest: RuntimeImageManifest
  checksum: string
  cachedAt: number
}

export type SessionJournalEvent =
  | 'transition'
  | 'crash'
  | 'startup_failure'
  | 'teardown_failure'
  | 'metric'
  | 'heartbeat'

export interface SessionJournalEntry {
  entryId: string
  sessionId: string
  event: SessionJournalEvent
  from?: RuntimeState
  to?: RuntimeState
  reason?: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface IPCMessage<T = unknown> {
  id: string
  type: string
  sessionId: string
  runtimeId: string
  payload: T
  timestamp: number
}

export interface CapabilityValidationResult {
  allowed: boolean
  reason?: string
}

export interface ContainerDescriptor {
  containerId: string
  type: ContainerType
  state: RuntimeState
  sessionId?: string
  startedAt?: number
}

export interface SandboxFixture {
  name: string
  description?: string
  tables: Record<string, unknown[]>
}

export const BUILT_IN_FIXTURES = {
  EMPTY_RUNTIME: 'empty-runtime',
  ONBOARDING_RUNTIME: 'onboarding-runtime',
  ANALYTICS_RUNTIME: 'analytics-runtime',
  AI_RUNTIME: 'ai-runtime',
  NOTIFICATIONS_RUNTIME: 'notifications-runtime',
  CORRUPTED_RUNTIME: 'corrupted-runtime',
} as const

export type BuiltInFixture = (typeof BUILT_IN_FIXTURES)[keyof typeof BUILT_IN_FIXTURES]
