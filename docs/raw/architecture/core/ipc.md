# IPC Contract Architecture

## Purpose

Prana is an Electron application. The main process and the renderer process run in separate V8 contexts with no shared memory. All cross-context communication must flow through a single, governed IPC boundary.

This document defines the architectural contract for all IPC in the application.

There are two distinct IPC layers:

1. **Electron IPC** — between the renderer process and the main process
2. **Sandbox IPC** — between a plugin child process and the host main process

Both layers share the same governing principles: capability-gated, validated, async, one-directional invocation.

---

## Layer 1: Electron IPC (Renderer ↔ Main)

### Architectural Rule

The renderer process must never access main-process services directly.

All renderer access to host capabilities must flow through named IPC channels registered via `ipcMain.handle()` in `ipcService.ts`.

```text
Renderer (ViewModel / Repo)
  → window.api.<channel>()   [preload.ts exposure]
    → ipcRenderer.invoke()
      → ipcMain.handle()     [ipcService.ts]
        → main service
```

The renderer cannot reach main services by any other path.

---

### Channel Ownership

All channels are owned exclusively by the main process.

The main process:
- registers handlers via `ipcMain.handle()`
- never initiates calls to the renderer

The renderer process:
- invokes channels via `ipcRenderer.invoke()` through the preload bridge
- never receives unsolicited push from main (events use `webContents.send()` only for event subscriptions, not for request-response)

---

### Channel Naming Convention

All channels must follow the `domain:action` pattern.

```text
app:get-bootstrap-config
auth:login
vault:read
sandbox:initialize
```

Rules:
- Lowercase only
- Domain prefix identifies the owning service
- Action is a verb or verb-noun
- No nesting (no `domain:subdomain:action`)
- Stable across releases — renaming a channel is a breaking change

---

### Handler Registration

All handlers must be registered in `src/main/services/ipcService.ts` inside `registerIpcHandlers()`.

Rules:
- Every channel must have exactly one registered handler
- No duplicate `ipcMain.handle()` calls for the same channel
- Handlers must be `async` functions — they must return a `Promise`
- Handlers must never throw to the renderer — wrap in try/catch and return structured errors
- Handlers must not perform side effects that require rollback (use services that own rollback)

---

### Payload Contract

All IPC payloads cross a process boundary and must be treated as untrusted input.

Rules:
- Validate all incoming payload fields before passing to services
- Do not pass raw payload objects directly to service calls
- Use schema validation (e.g., `zod`) for complex payloads at the boundary
- Never pass function references, class instances, or non-serializable values
- Payloads are serialized via Electron's structured clone algorithm — only plain objects, arrays, primitives, and `ArrayBuffer` are safe

---

### Return Value Contract

All handlers return serializable values only.

Rules:
- Return plain objects, arrays, primitives, or `null`
- Never return class instances, `Error` objects directly, or functions
- On failure: return `{ ok: false, error: string }` — never reject the promise
- On success: return `{ ok: true, data: T }` or domain-specific value
- Handlers that return nothing should return `null` or `void` consistently

---

### Security Constraints

Electron security invariants this architecture enforces:

- `contextIsolation: true` — renderer and main have separate JavaScript worlds
- `nodeIntegration: false` — renderer has no direct Node.js access
- `preload.ts` is the only authorized bridge — it selectively exposes `ipcRenderer.invoke()` calls via `window.api`
- No `ipcRenderer.sendSync()` — synchronous IPC blocks the renderer event loop
- No `require('electron')` in renderer code — all electron access goes through preload
- `webSecurity: true` — not disabled

The preload script must only expose explicitly whitelisted channels. It must not expose a general-purpose `invoke(channel, payload)` passthrough that allows arbitrary channel invocation from the renderer.

---

### Error Propagation

Errors must not propagate as thrown exceptions across the IPC boundary.

Required pattern:

```typescript
ipcMain.handle('domain:action', async (_event, payload) => {
  try {
    const result = await service.doSomething(payload)
    return { ok: true, data: result }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
})
```

The renderer must check `result.ok` before using `result.data`.

---

## Layer 2: Sandbox IPC (Plugin Process ↔ Host)

### Architectural Rule

Plugin child processes must never access host services directly. All plugin access to host capabilities must flow through the Sandbox IPC Gateway, which enforces capability validation before routing to registered handlers.

```text
Plugin process
  → process.send({ type: 'ipc:request', messageType, payload })
    → pluginSandboxHost onProcessMessage
      → sandboxIpcGateway.route(message, capabilities)
        → validateCapability()
          → registered handler
            → process.send({ type: 'ipc:response', requestId, ok, result })
              → pluginRuntimeClient resolves promise
```

---

### Capability Gating

Every sandbox IPC request is capability-validated before execution.

Capabilities are declared in `RuntimeCapabilities` and injected at plugin boot via `capability:inject`.

A plugin without `sqlite.read` capability cannot read from SQLite — the gateway rejects the request before the handler executes.

Capability decisions are made per-session and cannot be escalated by the plugin at runtime.

---

### Message Protocol

All messages are plain objects serializable through `process.send()`.

Request shape:
```typescript
{ type: 'ipc:request', requestId: string, messageType: string, payload: unknown }
```

Response shape:
```typescript
{ type: 'ipc:response', requestId: string, ok: boolean, result?: unknown, error?: string }
```

The `requestId` correlation is mandatory — the plugin runtime client uses it to resolve the correct pending promise.

---

### Sandbox Channel Naming

Sandbox channels follow the same `domain:operation` convention:

```text
sqlite:read
sqlite:write
sqlite:exec
notifications:emit
sync:read
```

Sandbox channel names must match their production equivalents exactly — this is the mechanism that provides zero integration change when moving from sandbox to production host.

---

### Plugin Runtime Client Contract

Plugins must use `createPluginRuntimeClient()` exclusively to communicate with the host.

Rules:
- Plugins must not call `process.send()` directly for capability requests
- The runtime client provides typed, promise-based wrappers
- All requests have a 10-second timeout — plugins must handle `REQUEST_TIMEOUT` errors
- The same client API works in sandbox and production — no environment branching in plugin code

---

## Cross-Layer Rules

These rules apply to both IPC layers:

1. **No shared memory** — both boundaries are process boundaries; no references cross
2. **Validated input at boundary** — all incoming messages are treated as untrusted
3. **Capability before execution** — capabilities are checked before any handler runs
4. **Async throughout** — no synchronous blocking calls across any IPC boundary
5. **No framework imports in plugin code** — plugin cannot import Electron or Node built-ins not available in its sandbox
6. **Structured errors only** — errors returned as values, never as thrown exceptions across boundaries

---

## Invariant Summary

| Invariant | Rule |
|-----------|------|
| Channel ownership | Main process owns all Electron IPC channels |
| Handler registration | All handlers registered in `ipcService.ts` |
| Payload validation | All incoming payloads validated at boundary |
| Return serialization | All return values must be structured-clone safe |
| Error propagation | Errors returned as `{ ok: false, error }`, never thrown |
| Security posture | contextIsolation=true, nodeIntegration=false, preload-only bridge |
| Capability gating | Sandbox IPC requests validated against session capabilities before execution |
| Protocol stability | Channel names are stable across releases; renaming is a breaking change |
| Zero-integration guarantee | Sandbox channel names match production host names exactly |
| No renderer push | Main process does not initiate request-response cycles to renderer |

---

## Relationship to Other Architecture Documents

- `mvvm-clean-architecture.md` — defines how ViewModels call the preload bridge (Repository layer calls `window.api`)
- `docs/raw/features/sandbox/sandbox-runtime-architecture.md` — defines the sandbox IPC gateway, capability system, and plugin runtime client
- `docs/raw/architecture/invariants/dependency-direction.md` — `ipcMain.handle()` is forbidden inside runtime orchestration services; it belongs exclusively in `ipcService.ts`
- `docs/raw/architecture/invariants/lifecycle-safety.md` — IPC handlers are registered once at boot and never re-registered; no handler leak
