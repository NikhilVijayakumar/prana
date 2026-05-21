import { randomUUID } from 'node:crypto'

// Runs inside the plugin child process.
// Provides the same API surface the real host exposes via the IPC gateway.
// Plugin code written against this client has zero integration changes when it moves into the real host.

type PendingRequest = {
  resolve: (result: unknown) => void
  reject: (err: Error) => void
}

export const createPluginRuntimeClient = () => {
  const pending = new Map<string, PendingRequest>()

  process.on('message', (msg: unknown) => {
    const m = msg as Record<string, unknown>
    if (m.type !== 'ipc:response') return
    const req = pending.get(m.requestId as string)
    if (!req) return
    pending.delete(m.requestId as string)
    if (m.ok) {
      req.resolve(m.result)
    } else {
      req.reject(new Error((m.error as string) ?? 'ipc request failed'))
    }
  })

  const request = <T>(messageType: string, payload: unknown, timeoutMs = 10_000): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const requestId = randomUUID()

      const timer = setTimeout(() => {
        pending.delete(requestId)
        reject(new Error(`ipc request timed out: ${messageType}`))
      }, timeoutMs)

      pending.set(requestId, {
        resolve: (result) => { clearTimeout(timer); resolve(result as T) },
        reject: (err) => { clearTimeout(timer); reject(err) },
      })

      process.send!({ type: 'ipc:request', requestId, messageType, payload })
    })
  }

  return {
    sqlite: {
      read<T = Record<string, unknown>>(table: string, query?: Record<string, unknown>): Promise<T[]> {
        return request<T[]>('sqlite:read', { table, query })
      },
      write(table: string, rows: Record<string, unknown>[]): Promise<{ written: number }> {
        return request<{ written: number }>('sqlite:write', { table, rows })
      },
      exec(sql: string): Promise<void> {
        return request<void>('sqlite:exec', { sql })
      },
    },
    notifications: {
      emit(eventType: string, payload: Record<string, unknown>): Promise<void> {
        return request<void>('notifications:emit', { eventType, payload })
      },
    },
    sync: {
      getMetadata(domainKey: string): Promise<{ domainKey: string; lastSyncedAt: string | null; status: string }> {
        return request('sync:read', { domainKey })
      },
    },
  }
}

export type PluginRuntimeClient = ReturnType<typeof createPluginRuntimeClient>
