import { randomUUID } from 'node:crypto'
import type { RuntimeCapabilities, CapabilityValidationResult, IPCMessage } from './sandboxTypes'
import { notificationCentreService } from '../notificationCentreService'

type GatewayRouteHandler = (payload: unknown) => Promise<unknown>

const validateCapability = (
  capabilities: RuntimeCapabilities,
  resource: keyof RuntimeCapabilities,
  operation: 'read' | 'write' | 'emit',
): CapabilityValidationResult => {
  const cap = capabilities[resource] as Record<string, boolean> | undefined
  if (!cap) return { allowed: false, reason: `capability '${resource}' not granted` }
  if (!cap[operation]) {
    return { allowed: false, reason: `operation '${operation}' not allowed on '${resource}'` }
  }
  return { allowed: true }
}

export const createSandboxIpcGateway = () => {
  const routes = new Map<string, GatewayRouteHandler>()

  const buildMessage = <T>(
    type: string,
    sessionId: string,
    runtimeId: string,
    payload: T,
  ): IPCMessage<T> => ({
    id: randomUUID(),
    type,
    sessionId,
    runtimeId,
    payload,
    timestamp: Date.now(),
  })

  return {
    registerRoute(type: string, handler: GatewayRouteHandler): void {
      routes.set(type, handler)
    },

    async route(
      message: IPCMessage,
      capabilities: RuntimeCapabilities,
    ): Promise<{ ok: boolean; result?: unknown; error?: string }> {
      const colonIndex = message.type.indexOf(':')
      if (colonIndex !== -1) {
        const resource = message.type.slice(0, colonIndex) as keyof RuntimeCapabilities
        const operation = message.type.slice(colonIndex + 1) as 'read' | 'write' | 'emit'
        const validation = validateCapability(capabilities, resource, operation)
        if (!validation.allowed) {
          return { ok: false, error: validation.reason }
        }
      }

      const handler = routes.get(message.type)
      if (!handler) {
        return { ok: false, error: `no handler registered for message type '${message.type}'` }
      }

      const result = await handler(message.payload)
      return { ok: true, result }
    },

    async emitToNotificationCentre(
      sessionId: string,
      runtimeId: string,
      eventType: string,
      payload: Record<string, unknown>,
      capabilities: RuntimeCapabilities,
    ): Promise<CapabilityValidationResult> {
      const validation = validateCapability(capabilities, 'notifications', 'emit')
      if (!validation.allowed) return validation

      await notificationCentreService.emit({
        eventType,
        priority: 'INFO',
        source: `sandbox:${runtimeId}`,
        message: eventType,
        payload: { sessionId, ...payload },
      })

      return { allowed: true }
    },

    validateCapability,

    buildMessage,
  }
}

export type SandboxIpcGateway = ReturnType<typeof createSandboxIpcGateway>

export const sandboxIpcGateway = createSandboxIpcGateway()
