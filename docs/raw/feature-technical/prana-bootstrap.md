# Prana Bootstrap — Technical Realization

**Version:** 2.0.0
**Feature Spec:** docs/raw/features/prana-bootstrap.md
**Architecture Ref:** docs/raw/external-context/astra.md

---

## 1. Overview

Prana Bootstrap is the foundational initialization phase of the Prana Runtime. It executes entirely within the Electron main process — there is no renderer counterpart for this feature. Bootstrap is responsible for transitioning the runtime from an uninitiated state through a strictly ordered lifecycle until the `IPranaRuntime` context is available for application consumption.

This document maps every L2 responsibility to its technical realization using the Prana main-process execution environment and, where applicable, Astra's architectural contracts. Because Bootstrap operates before any renderer surface exists, no Astra renderer patterns (IpcService, useDataState, AppStateHandler) apply to this feature directly. Astra patterns are relevant here only in their boundary definitions: they clarify what Prana must own (ipcMain, SQLite, lifecycle orchestration) versus what Astra provides (renderer-side transport, state management, response normalization).

---

## 2. Feature Summary

| Field | Value |
|-------|-------|
| Feature Name | Prana Bootstrap |
| Version | 2.0.0 |
| Pattern | Runtime Initialization and Service Registration |
| Execution Environment | Electron Main Process (Node.js) exclusively |
| Entry Point | `prana.initialize()` — async, throws `BootstrapError` on failure |
| Renderer Involvement | None — Bootstrap is main-process-only |
| Astra Consumption | Boundary definition only; Astra renderer boilerplate is not consumed during Bootstrap |

---

## 3. Architecture Mapping

Prana Bootstrap operates in the zone that Astra explicitly does not own. Astra's architectural invariants (L1) clarify this boundary precisely:

- Astra does not own the Electron runtime — `ipcMain`, `contextBridge`, `BrowserWindow`, and SQLite belong to Prana.
- Astra does not own initialization sequencing, service registration, or runtime lifecycle.
- Astra owns the renderer-side transport abstraction (`IpcService`) and state management (`useDataState`, `AppStateHandler`). These are not involved during Bootstrap.

The Bootstrap feature therefore operates as a pure Prana main-process concern. Its outputs — specifically the registered services and the `IPranaRuntime` context — become the preconditions that later features require before their own Astra-based IPC channels and renderer interactions can function.

| Architecture Concern | Owner | Notes |
|---|---|---|
| Runtime lifecycle (INIT → OPERATIONAL) | Prana | Defined entirely in main process |
| Configuration loading and validation | Prana | Before any service registration |
| Service registry and registration ordering | Prana | Sequential, ordered, timeout-enforced |
| SQLite initialization | Prana | Part of Storage Service registration |
| Event Registry setup | Prana | Required before all other services |
| `IPranaRuntime` context exposure | Prana | Created only at OPERATIONAL |
| IPC channel registration | Prana | Occurs after OPERATIONAL; not during Bootstrap itself |
| Renderer transport (IpcService) | Astra | Not involved during Bootstrap |
| Renderer state management (useDataState) | Astra | Not involved during Bootstrap |
| Response normalization (ServerResponse) | Astra | Used by IPC handlers post-Bootstrap, not during Bootstrap |

---

## 4. Main Process Design

### 4.1 Service Architecture

Bootstrap orchestrates a single, sequential initialization pipeline that produces the `IPranaRuntime` context as its sole output. Each service is initialized once, in a prescribed order, and registered into `IServiceRegistry` before the next service begins.

The `pranaBootstrapService` is the implementation unit of this pipeline. It owns:

- The lifecycle state machine (INIT → CONFIGURATION_READY → SERVICES_READY → OPERATIONAL, with FAILED and STOPPING/STOPPED branches)
- Configuration loading and validation
- Service instantiation and registration
- Timeout enforcement during service registration
- Shutdown sequencing (reverse registration order)

Services registered during Bootstrap and their registry keys:

| Registration Order | Service | Registry Key | Required |
|---|---|---|---|
| 1 | Configuration Service | `configuration` | Yes |
| 2 | Event Registry | `events` | Yes |
| 3 | Storage Service (SQLite) | `storage` | Yes |
| 4 | Storage Scheduler | `storageScheduler` | Yes |
| 5 | Identity Service | `identity` | Yes |
| 6 | Application Registry | `appRegistry` | Yes |
| 7 | Document Service | `documents` | Optional |
| 8 | Sheet Service | `sheets` | Optional |

Each service may depend only on services registered before it in this sequence. No cross-skip or out-of-order dependency is permitted.

The `IPranaRuntime` context — implementing `{ configuration, events, services, state: 'OPERATIONAL' }` — is created as an immutable object only after all required services complete registration without error. It is the return value of `prana.initialize()`.

### 4.2 IPC Channel Contract

Bootstrap does not define or register IPC channels. IPC channel registration is a post-Bootstrap concern — channels are registered after `OPERATIONAL` is reached, when services are available for handlers to consume.

Bootstrap's contribution to IPC is indirect: by completing successfully, it ensures that every service an IPC handler may need (storage, events, identity, etc.) is available and resolvable from `IPranaRuntime` at the time the handler executes.

No `bootstrap:{action}` IPC channels are defined in L2. If runtime observability channels are introduced (e.g., to expose bootstrap state or diagnostics to the renderer), they must follow the Prana IPC contract: channel format `{feature}:{action}`, handlers must return `ServerResponse<T>`, and errors must never throw to the renderer.

### 4.3 SQLite Schema

Bootstrap does not own a SQLite schema. Its role with respect to storage is limited to initializing the Storage Service and ensuring it is reachable before transitioning to SERVICES_READY. Schema ownership belongs to the domain services (Storage Service, Document Service, Sheet Service) that Bootstrap registers.

Bootstrap does persist one class of runtime state: the failure reason when bootstrap reaches FAILED. The mechanism for this persistence (e.g., a log file, a dedicated Bootstrap state table) is not specified in L2 and is recorded as an Open Question.

### 4.4 Startup and Teardown

**Startup sequence:**

1. `INIT` — Platform paths are resolved. Logging is initialized. No configuration or services are available.
2. `CONFIGURATION_READY` — Configuration is loaded from the runtime configuration source and validated. Required keys, storage paths, runtime version field, and internal consistency between configuration categories are all verified. Bootstrap halts to FAILED if any validation fails.
3. `SERVICES_READY` — Services are initialized and registered in the prescribed order. A timeout is enforced on each required service's initialization. If any required service fails or times out, the service name is recorded and Bootstrap transitions to FAILED. Optional services that fail are skipped with a warning logged; Bootstrap continues.
4. `OPERATIONAL` — `IPranaRuntime` context is created. `runtime:startup` is emitted via Event Registry. `prana.initialize()` resolves with the context. Runtime configuration becomes read-only.

**Failure path:**

If FAILED is reached at any stage:
- The failure reason is recorded.
- No `IPranaRuntime` context is exposed.
- `prana.initialize()` throws `BootstrapError`.
- No applications launch.
- Recovery requires a process restart.

**Shutdown sequence:**

1. Shutdown signal is received.
2. Runtime transitions to `STOPPING`.
3. `runtime:shutdown` is emitted via Event Registry before teardown begins.
4. Storage Scheduler flushes all pending jobs.
5. Services are torn down in reverse registration order (Sheet Service → Document Service → Application Registry → Identity Service → Storage Scheduler → Storage Service → Event Registry → Configuration Service).
6. Runtime transitions to `STOPPED`. The process may exit cleanly.

---

## 5. Renderer Design (Astra MVVM)

Prana Bootstrap is main-process-only. There is no renderer surface for this feature.

Bootstrap executes in the Electron main process before any renderer window is active. Its output — the `IPranaRuntime` context — is consumed by main-process application bootstrap code. The `IPranaRuntime` interface and all services it exposes operate within Node.js. No React component, ViewModel hook, or repository layer is involved.

Astra's renderer boilerplate (`IpcService`, `useDataState`, `AppStateHandler`, `AppStateProvider`) is not consumed during Bootstrap. These patterns become relevant in later features whose IPC handlers depend on the services that Bootstrap registers.

Sections 5.1 through 5.5 are omitted because this feature has no renderer presence.

---

## 6. Responsibility Realization Matrix

Every L2 responsibility is mapped to its technical realization.

| L2 Responsibility | Technical Realization | Process | Notes |
|---|---|---|---|
| Load runtime configuration | `pranaBootstrapService` reads configuration during INIT → CONFIGURATION_READY transition; validates all required keys, storage paths, runtime version, and cross-category consistency | Main | Configuration loads before any service registration |
| Initialize runtime infrastructure | Platform path resolution and logging at INIT; Storage Service and Event Registry registration at SERVICES_READY | Main | Infrastructure precedes services |
| Register core services | Sequential registration of all required services into `IServiceRegistry` in prescribed order with timeout enforcement | Main | Registration order is a contract invariant |
| Expose runtime context | `IPranaRuntime` created as an immutable object at OPERATIONAL; returned from `prana.initialize()` | Main | Context is null before OPERATIONAL |
| Transition runtime to operational state | Lifecycle state machine advances through CONFIGURATION_READY → SERVICES_READY → OPERATIONAL; emits `runtime:startup` on OPERATIONAL entry | Main | OPERATIONAL is the only state from which context is accessible |
| Halt on required service failure | Any required service initialization failure transitions bootstrap to FAILED; `prana.initialize()` throws `BootstrapError`; no context is exposed | Main | Recovery requires restart |
| Skip optional service on failure | Optional service failure is caught, a warning is logged, and bootstrap continues | Main | Document Service and Sheet Service are optional |
| Enforce service registration timeout | A configurable timeout is applied to each required service's initialization; timeout expiry triggers FAILED with the offending service name recorded | Main | Timeout value is not specified in L2 — Open Question |
| Enforce configuration read-only at OPERATIONAL | Configuration becomes read-only upon OPERATIONAL entry; post-OPERATIONAL writes must use explicit runtime APIs and emit `runtime:configuration:changed` | Main | Direct mutation is a contract violation |
| Emit lifecycle events | `runtime:startup` emitted at OPERATIONAL; `runtime:shutdown` emitted at start of STOPPING | Main | Event Registry must be available for both |
| Ordered shutdown teardown | Services torn down in reverse registration order during STOPPING; Storage Scheduler flushes before teardown; transitions to STOPPED | Main | Reverse order is a design invariant |
| Abstract platform paths | Platform-specific paths are resolved by runtime services; applications never reference OS-specific paths directly | Main | Enforced by configuration service abstraction |
| Record failure reason | Failure reason is recorded when FAILED is reached; mechanism not specified in L2 | Main | See Open Questions |
| Enforce no application bootstrap before OPERATIONAL | `IPranaRuntime` is only accessible after `prana.initialize()` resolves; context is null before OPERATIONAL | Main | Structural enforcement |
| Expose observability diagnostics | Current lifecycle state, initialization duration, service registration status, and configuration load status are made available for diagnostics | Main | Mechanism not specified in L2 — Open Question |

---

## 7. Workflow Realization

### Workflow 1: Successful Bootstrap

| Step | L2 Source | Realization |
|---|---|---|
| 1. Platform paths resolved; logging initialized | Section 4, INIT | `pranaBootstrapService` performs platform initialization at process start |
| 2. Configuration loaded and validated | Section 4, CONFIGURATION_READY | Configuration Service reads and validates runtime config; all required keys and paths verified |
| 3. Services registered in order | Section 6, Registration Ordering | Sequential initialization with timeout enforcement; each service depends only on prior registrations |
| 4. Runtime transitions to OPERATIONAL | Section 4, OPERATIONAL | `IPranaRuntime` context created; `runtime:startup` emitted |
| 5. `prana.initialize()` resolves | Section 7, Access Pattern | Returns immutable `IPranaRuntime` with `state: 'OPERATIONAL'` |
| 6. Application bootstrap begins | Section 9 | Application calls `prana.initialize()`, receives context, resolves required services |

### Workflow 2: Configuration Validation Failure

| Step | L2 Source | Realization |
|---|---|---|
| 1. Configuration loaded | Section 4, CONFIGURATION_READY | Configuration read from source |
| 2. Validation fails | Section 4, CONFIGURATION_READY validation rules | Missing required key, inaccessible storage path, missing version field, or contradictory values detected |
| 3. Bootstrap transitions to FAILED | Section 4, Failure Path | Failure reason recorded; no services initialized |
| 4. `prana.initialize()` throws | Section 14, Throw On Failure | `BootstrapError` thrown with failure reason |

### Workflow 3: Required Service Initialization Failure

| Step | L2 Source | Realization |
|---|---|---|
| 1. Service initialization begins | Section 4, SERVICES_READY | Service is instantiated and initialized within timeout window |
| 2. Initialization fails or times out | Section 4, SERVICES_READY timeout contract | Exception caught or timeout fires |
| 3. Failing service name recorded | Section 4, SERVICES_READY | Service name and failure reason logged |
| 4. Bootstrap transitions to FAILED | Section 8, Service Failure During Registration | Context not created; `prana.initialize()` throws |

### Workflow 4: Optional Service Failure

| Step | L2 Source | Realization |
|---|---|---|
| 1. Optional service initialization attempted | Section 8, Optional Services | Document Service or Sheet Service initialization begins |
| 2. Initialization fails | Section 8, Service Failure During Registration (optional path) | Exception caught |
| 3. Warning logged; service skipped | Section 8 | Service not registered; bootstrap continues |
| 4. Bootstrap continues to OPERATIONAL | Section 4 | Remaining required services proceed; OPERATIONAL is reachable |

### Workflow 5: Graceful Shutdown

| Step | L2 Source | Realization |
|---|---|---|
| 1. Shutdown signal received | Section 4, Shutdown Path | Runtime transitions to STOPPING |
| 2. `runtime:shutdown` emitted | Section 4, STOPPING description | Event Registry emits `runtime:shutdown` before teardown |
| 3. Storage Scheduler flushes | Section 4, STOPPING description | Pending jobs flushed before storage teardown |
| 4. Services torn down in reverse order | Section 14, Ordered Teardown | Reverse of registration order |
| 5. Runtime transitions to STOPPED | Section 4, STOPPED | Process may exit cleanly |

### Workflow 6: Application Service Resolution

| Step | L2 Source | Realization |
|---|---|---|
| 1. Application receives `IPranaRuntime` | Section 7, Access Pattern | From resolved `prana.initialize()` |
| 2. Application resolves required service | Section 7, Service Resolution | `runtime.services.resolve('storage')` — throws if absent |
| 3. Application resolves optional service | Section 7, Service Resolution | `runtime.services.resolveOptional('documents')` — returns null if absent |
| 4. Application checks optional service presence | Section 6, Resolution Rules | `runtime.services.isRegistered('documents')` before conditional logic |

---

## 8. State Realization

### 8.1 Main Process States

| State | Entry Condition | Available Resources | Exit Condition |
|---|---|---|---|
| INIT | Process start | Platform paths, logging only | Configuration loaded |
| CONFIGURATION_READY | Configuration loaded and validated | Configuration Service | All validations pass |
| SERVICES_READY | All required services registered | Service Registry, all required services | No required service failed; timeout not exceeded |
| OPERATIONAL | All required services ready | Full `IPranaRuntime` context; all registered services | Shutdown signal received |
| FAILED | Any required initialization step fails | Failure reason record only | No exit — restart required |
| STOPPING | Shutdown signal from OPERATIONAL | Services available until teardown begins | All services torn down |
| STOPPED | All services torn down | None | Process exits |

State transition invariants:
- FAILED is a terminal state during a process lifetime — no re-entry to INIT.
- OPERATIONAL is the only state in which `IPranaRuntime` is non-null.
- No application may call `prana.initialize()` and receive a context in any state other than OPERATIONAL.
- `runtime:startup` is emitted exactly once, on OPERATIONAL entry.
- `runtime:shutdown` is emitted exactly once, on STOPPING entry.

### 8.2 Renderer AppState Mapping

Not applicable. Bootstrap has no renderer surface. Astra's `AppState` lifecycle (INIT → LOADING → COMPLETED) does not map to Bootstrap's main-process state machine.

---

## 9. Boilerplate Application Mapping

Bootstrap is a main-process-only feature. Astra's renderer boilerplate is not consumed during Bootstrap. This section documents the boundary explicitly.

| Astra Boilerplate | Used During Bootstrap | Rationale |
|---|---|---|
| `IpcService` | No | Bootstrap has no renderer; IPC channels are not registered during Bootstrap |
| `ServerResponse<T>` | No (indirectly relevant) | IPC handlers registered post-Bootstrap must return `ServerResponse<T>`; Bootstrap itself does not produce IPC responses |
| `useDataState` | No | Renderer-only; no React hooks during main-process initialization |
| `AppStateHandler` | No | Renderer-only; no UI rendering during Bootstrap |
| `AppStateProvider` | No | Renderer-only; wired at renderer root, which does not exist during Bootstrap |
| `AppState<T>`, `StateType`, `StateCode` | No | Renderer state management types; not applicable to main-process lifecycle |

Astra's boundary invariant (from L1) is explicitly satisfied: Astra does not own `ipcMain`, `BrowserWindow`, SQLite, or service registration — all of which Bootstrap requires. Prana owns these runtime components.

---

## 10. Permission Realization

Bootstrap's security model is defined at the runtime level. No Astra-level permission pattern applies, as Astra does not own authentication or authorization.

| Security Concern | Realization |
|---|---|
| Configuration storage access | Owned by runtime; applications access only through Configuration Service API |
| Credential storage | Runtime-owned; applications do not access raw credential locations |
| Provider configuration | Runtime-owned; applications resolve provider identity through services |
| Service registration authority | Bootstrap-only; no service may be registered after OPERATIONAL |
| Application authorization logic | Application-owned; runtime does not participate |
| Business security rules | Application-owned; runtime does not enforce |
| Read-only configuration enforcement | Runtime enforces read-only after OPERATIONAL; post-OPERATIONAL writes emit `runtime:configuration:changed` |

Applications must never hard-code platform paths, provider internals, or credential locations. Configuration access is exclusively through `runtime.configuration.get(key)`.

---

## 11. Validation Realization

Validation during Bootstrap occurs in two phases.

**Phase 1 — Configuration Validation (INIT → CONFIGURATION_READY):**

| Validation Rule | Failure Consequence |
|---|---|
| All required configuration keys present | Bootstrap → FAILED |
| Storage paths exist and are accessible | Bootstrap → FAILED |
| Runtime version field present and parseable | Bootstrap → FAILED |
| No contradictory values between configuration categories | Bootstrap → FAILED |

**Phase 2 — Service Registration Validation (CONFIGURATION_READY → SERVICES_READY):**

| Validation Rule | Failure Consequence |
|---|---|
| Required service completes initialization within configured timeout | Bootstrap → FAILED; service name recorded |
| Required service does not throw during initialization | Bootstrap → FAILED; failure reason recorded |
| Event Registry registers successfully | Bootstrap → FAILED (Event Registry is non-optional) |
| Optional service failure | Skip service; log warning; continue |

**Post-OPERATIONAL:**

| Validation Rule | Owner |
|---|---|
| `resolve<T>` throws if service unregistered | `IServiceRegistry` contract |
| `resolveOptional<T>` returns null if unregistered, never throws | `IServiceRegistry` contract |
| Applications use `resolveOptional` for optional services | Application responsibility; violation is a contract error |

---

## 12. Error Realization

Every L2 failure scenario is mapped below.

| Failure Scenario | L2 Source | Realization | Result |
|---|---|---|---|
| Required configuration key absent | Section 4, CONFIGURATION_READY validation | Validation check fails; failure reason recorded | Bootstrap → FAILED; `prana.initialize()` throws `BootstrapError` |
| Storage path inaccessible | Section 4, CONFIGURATION_READY validation | Path accessibility check fails | Bootstrap → FAILED |
| Runtime version field missing or unparseable | Section 4, CONFIGURATION_READY validation | Version field validation fails | Bootstrap → FAILED |
| Contradictory configuration values | Section 4, CONFIGURATION_READY validation | Cross-category consistency check fails | Bootstrap → FAILED |
| Required service throws during initialization | Section 8, Service Failure During Registration | Exception caught; service name and reason recorded | Bootstrap → FAILED; no context exposed |
| Required service exceeds initialization timeout | Section 4, SERVICES_READY timeout contract | Timeout fires; service name recorded | Bootstrap → FAILED |
| Event Registry fails to initialize | Section 6, Registration Rules; Section 14, Event Registry Is Non-Optional | Treated as required service failure; Bootstrap halts immediately — no subsequent observability is possible without Event Registry | Bootstrap → FAILED |
| Optional service throws during initialization | Section 8, Service Failure During Registration (optional path) | Exception caught; warning logged; service not registered | Bootstrap continues; service resolves as null via `resolveOptional` |
| Application calls `resolve` on unregistered required service | Section 6, Resolution Rules | `IServiceRegistry.resolve<T>` throws | Application-level error; Bootstrap is not involved |
| Application calls `resolve` on optional service directly | Section 6, Resolution Rules | Contract violation; `resolveOptional` must be used for optional services | Application responsibility |
| Partial FAILED-state context returned to caller | Section 14, Throw On Failure | Structurally prevented — context is only created at OPERATIONAL; `prana.initialize()` throws before returning | No partial context is ever accessible |
| Post-OPERATIONAL direct configuration mutation | Section 5, Write Rules | Direct mutation without `runtime:configuration:changed` event is a contract violation | Runtime enforcement mechanism not specified in L2 — see Open Questions |
| Services accessed after STOPPED | Section 4, STOPPED | No services available after STOPPED | Process should exit; behavior on access after STOPPED is not specified in L2 — see Open Questions |

Error handling rule applicable to all future IPC handlers registered after Bootstrap: handlers must return `ServerResponse.error(...)` on failure — never throw to the renderer. This rule originates from Astra's IPC contract (L1) and governs all post-Bootstrap features that expose Bootstrap-initialized services over IPC.

---

## 13. Integration Realization

### 13.1 Internal Prana Integrations

| Integration | Direction | Mechanism | Notes |
|---|---|---|---|
| Configuration Service → all services | Bootstrap provides config to services during registration | `IConfigurationService.get(key)` | Services may read config during initialization; writes before OPERATIONAL transition only |
| Event Registry → all services | Bootstrap provides Event Registry to all post-registration services | `IEventRegistry` via `IPranaRuntime.events` | Event Registry registered at position 2; all subsequent services may use it |
| Storage Service → Storage Scheduler | Storage Scheduler depends on Storage Service | Resolved via `IServiceRegistry` at registration time | Storage Service must be registered before Storage Scheduler |
| Storage Scheduler → shutdown sequence | Storage Scheduler flushes pending jobs during STOPPING | Shutdown orchestration in `pranaBootstrapService` | Flush occurs before Storage Service teardown |
| `IPranaRuntime` → Application Bootstrap | Application receives context from `prana.initialize()` | `IPranaRuntime` interface | Context is immutable; application resolves services from registry |

### 13.2 IPC Surface

Bootstrap does not define any IPC channels. No `bootstrap:{action}` channels exist in L2.

Post-Bootstrap features that expose Bootstrap-initialized services over IPC must:
- Use channel format `{feature}:{action}`
- Return `ServerResponse<T>` from all invoke handlers
- Never throw to the renderer — return `ServerResponse.error(...)` on failure
- Use `IpcService` in the renderer repository layer (Astra contract)

### 13.3 External Systems

Bootstrap's external system interactions are mediated through the services it registers:

| External System | Accessed Via | Bootstrap Role |
|---|---|---|
| SQLite database | Storage Service (`storage`) | Bootstrap initializes and registers Storage Service; does not interact with SQLite directly |
| Identity/authentication provider | Identity Service (`identity`) | Bootstrap initializes and registers Identity Service; authentication flow is application-owned |
| Workspace provider accounts | Configuration Service (`configuration`) | Bootstrap loads workspace settings from configuration; account management is application-owned |
| File system (config, storage paths) | Configuration Service, Storage Service | Bootstrap resolves platform paths during INIT; applications never access paths directly |
| Update/distribution provider | Configuration Service (`distribution` category) | Bootstrap loads distribution settings; update flow is not Bootstrap's responsibility |

---

## 14. Ownership Mapping

### 14.1 Responsibility Ownership

| Responsibility | Owner | Rationale |
|---|---|---|
| Runtime lifecycle state machine | Prana (`pranaBootstrapService`) | Main-process concern; Astra has no lifecycle concept |
| Configuration loading and validation | Prana | Runtime infrastructure; Astra is not a configuration library |
| Service registration and ordering | Prana | Runtime infrastructure; Astra does not own service discovery |
| SQLite initialization | Prana | Astra explicitly does not own storage or persistence |
| Event Registry initialization | Prana | Runtime infrastructure; Astra does not own event buses |
| Identity Service initialization | Prana | Runtime infrastructure; Astra does not own authentication |
| `IPranaRuntime` context creation | Prana | Runtime contract; no Astra analog |
| IPC channel registration (post-Bootstrap) | Prana | Main-process IPC handlers are Prana-owned |
| Platform path abstraction | Prana | Runtime platform concern |
| Shutdown and ordered teardown | Prana | Runtime lifecycle |
| Renderer transport layer (`IpcService`) | Astra | Astra-owned; consumed by post-Bootstrap feature repositories |
| Renderer state management (`useDataState`) | Astra | Astra-owned; consumed by post-Bootstrap feature ViewModels |
| IPC response normalization (`ServerResponse<T>`) | Astra | Astra-owned; Prana IPC handlers must use factory methods |
| Renderer UI state routing (`AppStateHandler`) | Astra | Astra-owned; consumed by post-Bootstrap feature views |

### 14.2 Astra vs Prana Ownership

| Component | Astra Owns | Prana Owns |
|---|---|---|
| IpcService | Implementation, public API | Consumption in feature repositories (post-Bootstrap) |
| ServerResponse | Implementation, factory methods | Returning correct shape from IPC handlers |
| window.electronAPI exposure | Not owned (no Electron imports in Astra core) | contextBridge preload setup |
| ipcMain registration | Not owned | IPC handler registration post-Bootstrap |
| SQLite | Not owned | Storage Service and all schema management |
| Service Registry | Not owned | Implementation and all registrations |
| Runtime lifecycle | Not owned | Entire INIT → STOPPED state machine |
| AppStateProvider wiring | Not owned | Wiring at renderer root with design system components |
| Authentication | Not owned | Identity Service and all auth flows |

---

## 15. Architecture Traceability Matrix

| Architecture Claim (L1) | Application to Bootstrap | Satisfied |
|---|---|---|
| Astra does not own ipcMain, contextBridge, BrowserWindow, SQLite | Bootstrap owns all of these | Yes |
| Repository isolation — ELECTRON flow must go through IpcService, not window.electronAPI directly | Not applicable during Bootstrap; applies to post-Bootstrap renderer features | N/A (pre-IPC) |
| IPC handlers must return ServerResponse<T> | Bootstrap defines no IPC handlers; this applies to all post-Bootstrap handlers | Deferred to post-Bootstrap features |
| ServerResponse.success/error factories must be used; no raw construction | Bootstrap does not construct ServerResponse; applies post-Bootstrap | Deferred |
| AppStateProvider wired once at renderer root | Not Bootstrap's responsibility; wired at renderer initialization | Not Bootstrap's concern |
| Astra is stateless — persistence is Prana's responsibility | Bootstrap initializes Prana's SQLite persistence | Confirmed |
| Prana owns ipcMain and Electron runtime | Bootstrap orchestrates all Electron main-process concerns | Confirmed |
| MVVM separation rules | No MVVM layers exist during Bootstrap | N/A |
| ViewModel must not contain JSX; View must not fetch data | No renderer code during Bootstrap | N/A |
| useDataState for async state management in renderer | No renderer during Bootstrap | N/A |

---

## 16. Feature Traceability Matrix

Every L2 section is traced to its realization in this document.

| L2 Section | L2 Content | L3 Realization Section |
|---|---|---|
| Section 1 — Tactical Purpose | Bootstrap responsibilities (load config, init infrastructure, register services, expose context, transition to operational) | Section 6, Responsibility Realization Matrix |
| Section 1 — Not responsible for | Application startup, readiness, identity, storage validation, business logic | Section 3, Architecture Mapping; Section 14.1 |
| Section 2 — Design Philosophy | Runtime owns infrastructure; Applications own policy | Section 3, Section 14 |
| Section 3 — Core Principle | Infrastructure only; service discovery through runtime | Section 6, Section 10, Section 11 |
| Section 4 — Runtime Lifecycle (Bootstrap Flow) | INIT → CONFIGURATION_READY → SERVICES_READY → OPERATIONAL | Section 8.1, Section 4.4 |
| Section 4 — Failure Path | FAILED state; halt; no context; record reason | Section 8.1, Section 12 |
| Section 4 — Shutdown Path | STOPPING → STOPPED; reverse order; flush; emit event | Section 4.4, Section 7 Workflow 5 |
| Section 4 — State Definitions | INIT, CONFIGURATION_READY, SERVICES_READY, OPERATIONAL, FAILED | Section 8.1 |
| Section 5 — Runtime Configuration | Config loads first; read-only at OPERATIONAL; `runtime:configuration:changed` event | Section 4.1, Section 11, Section 12 |
| Section 5 — Configuration Categories | Runtime, Storage, Workspace, Identity, Distribution settings | Section 13.3 |
| Section 5 — IConfigurationService contract | `get`, `set`, `isReady` | Section 6 |
| Section 6 — Service Registry | Purpose, IServiceRegistry contract, registration and resolution rules, ordering | Section 4.1, Section 7 Workflow 6, Section 11 |
| Section 7 — Runtime Context | IPranaRuntime contract, availability rules, access pattern, service resolution | Section 4.1, Section 7 Workflow 1, Section 8.1 |
| Section 8 — Core Runtime Services | Required and optional services, failure behavior | Section 4.1, Section 12 |
| Section 9 — Application Bootstrap | Applications own startup; example pattern | Section 7 Workflow 1 and 6 |
| Section 10 — Configuration Ownership | Runtime owns config; applications consume only | Section 10 |
| Section 11 — Platform Independence | Applications must not assume OS paths | Section 10, Section 13.3 |
| Section 12 — Security Model | Runtime owns credential/config storage; applications own auth logic | Section 10 |
| Section 13 — Observability | Current state, duration, service status, config status | Section 6 (observability row) |
| Section 14 — Design Invariants | All nine invariants | Section 4.4, Section 8.1, Section 11, Section 12 |

---

## 17. Open Questions

| ID | Area | Question | L2 Reference | Impact |
|---|---|---|---|---|
| OQ-01 | Service Registration Timeout | L2 requires a configurable timeout on service registration but does not specify the default value, the configuration key name, or the timeout scope (per-service vs. total bootstrap). | Section 4, SERVICES_READY | Timeout enforcement implementation cannot be fully specified without this value |
| OQ-02 | Failure Reason Persistence | L2 requires the failure reason to be recorded when FAILED is reached, but does not specify the persistence mechanism (log file, SQLite bootstrap state table, in-memory only, OS event log). | Section 4, FAILED; Section 4, Startup and Teardown | Error recovery and diagnostics tooling cannot be designed without knowing where the failure record lives |
| OQ-03 | Observability Mechanism | L2 states Bootstrap "should expose" current state, initialization duration, service registration status, and configuration load status for diagnostics, but does not specify the mechanism (IPC channel, structured log, runtime property on IPranaRuntime). | Section 13 | If delivered as an IPC channel, it must follow the `bootstrap:{action}` channel format and return `ServerResponse<T>` |
| OQ-04 | Post-OPERATIONAL Configuration Write Enforcement | L2 requires that direct configuration mutation after OPERATIONAL is a contract violation, but does not specify how this is enforced (runtime throws, silent no-op, assertion, read-only proxy). | Section 5, Write Rules | Without a specified enforcement mechanism, the contract is advisory only |
| OQ-05 | Behavior After STOPPED | L2 describes STOPPED as a state where no services are available and the process may exit cleanly, but does not specify what happens if code attempts to access services after STOPPED (e.g., before the process actually exits). | Section 4, STOPPED | Edge case handling in long-shutdown scenarios is unspecified |
| OQ-06 | Bootstrap IPC Channels | L2 defines no `bootstrap:{action}` IPC channels. If the renderer requires access to bootstrap state (e.g., to display a loading or error screen during startup), channels would need to be defined. The L2 does not address this scenario. | Section 13.2 | If such channels are needed, they must be added to L2 before this document can specify their contracts |
| OQ-07 | `BootstrapError` Shape | L2 references that `prana.initialize()` throws a `BootstrapError` but does not define the error type's fields (e.g., whether it carries the lifecycle state at failure, the failing service name, or a structured code). | Section 7, Availability; Section 14, Throw On Failure | Application error handling and recovery UX cannot be designed without the error shape |
| OQ-08 | Configuration Source Location | L2 defines configuration categories but does not specify where the runtime configuration file lives (relative to app data directory, hardcoded path, environment variable). This is a platform-specific detail that Bootstrap must resolve at INIT. | Section 5 | Platform path resolution at INIT depends on knowing the config source convention |
| OQ-09 | Concurrency of `prana.initialize()` | L2 does not specify behavior if `prana.initialize()` is called concurrently or called a second time after a successful first call. The `IPranaRuntime` context is described as immutable once created, but second-call semantics are undefined. | Section 7, Access Pattern | Multi-call safety is relevant if multiple application entry points call `prana.initialize()` independently |
