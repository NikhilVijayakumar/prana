# Event Registry — Technical Realization

**Version:** 2.0.0
**Feature Spec:** docs/raw/features/event-registry.md
**Architecture Ref:** docs/raw/external-context/astra.md

---

## 1. Overview

The Event Registry is a foundational infrastructure service of the Prana Runtime, realized entirely in the Main Process (Node.js). It provides in-memory publish–subscribe event coordination between runtime services. It has no renderer-facing surface, no IPC channel contract, and no SQLite schema. It is not consumed by the Astra MVVM stack in the renderer.

This document describes how the Event Registry feature specification (L2) is technically realized within the architectural constraints of Astra (L1) and Prana's Electron runtime.

---

## 2. Feature Summary

| Attribute | Value |
|-----------|-------|
| Feature Name | Event Registry |
| Version | 2.0.0 |
| Status | Core / Foundational |
| Process Boundary | Main Process only |
| Pattern | In-Memory Publish–Subscribe Event Bus |
| Persistence | None — transient, runtime-scoped |
| Astra Boilerplate Consumed | None directly — Main Process service; `ServerResponse<T>` not applicable |
| Bootstrap Registration Order | Second (after Configuration Service, before all other runtime services) |
| Teardown Order | Last — deregistered during `STOPPING` after all other services |

The Event Registry enables runtime services to communicate without direct dependencies. It assigns `eventId` (UUID v4) and `timestamp` (Unix milliseconds) to every emitted event. It validates events before routing, routes by wildcard pattern matching, dispatches to matched subscribers in registration order, and isolates subscriber failures from delivery continuity.

---

## 3. Architecture Mapping

The Event Registry is a pure Main Process service. It maps to Prana's runtime layer, not to Astra's MVVM renderer layer.

| Concern | Owner | Astra Pattern Applied |
|---------|-------|-----------------------|
| Event coordination between runtime services | Prana Main Process | None — Astra does not define runtime service bus patterns |
| In-memory event store | Prana Main Process | None — Astra is stateless; persistence is Prana-owned |
| Bootstrap lifecycle | Prana Main Process | None — Astra does not own Electron runtime lifecycle |
| Subscriber registration and dispatch | Prana Main Process | None |
| IPC surface (if exposed to renderer) | Prana Main Process | `ServerResponse<T>` would apply to any IPC handler wrapping registry access |
| Renderer state management | Not applicable | Feature is Main Process-only |

Astra's boundaries as defined in L1 are respected: Astra is not a backend, not a state persistence library, and does not own `ipcMain`, `BrowserWindow`, or Prana's runtime services. The Event Registry is exclusively within Prana's ownership boundary.

---

## 4. Main Process Design

### 4.1 Service Architecture

The Event Registry is realized as a singleton service instantiated during Prana bootstrap at `SERVICES_READY`. It exposes the `IEventRegistry` interface defined in L2:

- `emit(event)` — accepts an event without `eventId` or `timestamp`, assigns both, validates, then routes.
- `subscribe(pattern, handler)` — registers an `EventHandler` against a wildcard pattern; returns a `SubscriptionId`.
- `unsubscribe(subscriptionId)` — removes a registered handler; silently succeeds if the ID is no longer active.

The service maintains two internal runtime structures:

| Structure | Purpose |
|-----------|---------|
| Subscriber registry | Maps `SubscriptionId` to `{ pattern, handler }` pairs. Ordered by registration sequence. |
| Observability counters | Tracks per-channel and aggregate counts for all five required metrics. |

No database, file, or external store is involved. All state is held in process memory and cleared on runtime shutdown.

**Event identity assignment:** At `EMITTED`, the registry assigns `eventId` as UUID v4 and `timestamp` as `Date.now()` (Unix milliseconds). Emitters provide `eventType`, `source`, and optional `payload`. Emitters MUST NOT set `eventId` or `timestamp`.

**Immutability enforcement:** After `EMITTED`, the event object MUST NOT be mutated by the registry or by any subscriber. The registry defensively copies or freezes the event object before dispatch.

### 4.2 IPC Channel Contract

The Event Registry is a Main Process-to-Main Process service bus. It does not expose IPC channels to the renderer as part of its core contract.

There is no IPC surface defined in L2 for this feature. If future requirements expose event subscription or observability metrics to the renderer, those IPC handlers would follow the standard Prana/Astra contract:

- Channel naming: `event-registry:{action}` (e.g., `event-registry:metrics`)
- All handlers return `ServerResponse<T>` as required by Astra's IPC contract
- Renderer repositories would use `IpcService` from Astra

No IPC channels are realized in this version.

### 4.3 SQLite Schema

The Event Registry has no SQLite schema. It is an in-memory-only service. Event persistence is explicitly excluded from its responsibilities (L2, Section 1.2 and Section 4).

No tables, indexes, or migration scripts apply to this feature.

### 4.4 Startup and Teardown

**Startup sequence:**

| Step | Action | Precondition |
|------|--------|--------------|
| 1 | Configuration Service registered | Bootstrap enters `SERVICES_READY` |
| 2 | Event Registry instantiated and registered | Configuration Service available |
| 3 | Subscriber registry initialized (empty) | Registry instance created |
| 4 | Observability counters initialized to zero | Registry instance created |
| 5 | All other runtime services registered and may begin emitting | Registry available |

Callers MUST NOT emit events before `SERVICES_READY`. Events emitted before registry initialization have undefined behavior (L2, Section 3).

**Teardown sequence:**

| Step | Action |
|------|--------|
| 1 | All other runtime services deregistered and stop emitting |
| 2 | Event Registry deregistered last during `STOPPING` |
| 3 | Subscriber registry cleared |
| 4 | Observability counters finalized (available for last-read before clearing) |
| 5 | Service instance released |

The registry MUST remain available for the full duration of `OPERATIONAL` state (L2, Section 3).

---

## 5. Renderer Design (Astra MVVM)

The Event Registry is a Main Process-only service. It has no renderer presence, no IPC channels, no repository, no ViewModel hook, and no view components.

Rationale: The Event Registry is a runtime service bus for Main Process services (Storage Scheduler, Vault Service, Workspace Bridge, Application Launcher, Identity Service). It explicitly has no knowledge of React, the Electron Renderer, screens, or components (L2, Section 1.2 — UI System). Astra's MVVM structure applies only to features with renderer-facing data surfaces.

If observability metrics are surfaced to the renderer in a future version, a separate renderer feature consuming those metrics via IPC would be warranted at that time.

---

## 6. Responsibility Realization Matrix

Every L2 responsibility is accounted for below.

| L2 Responsibility | Technical Realization | Owner |
|-------------------|-----------------------|-------|
| Event emission | `emit()` method on `IEventRegistry`; assigns `eventId` and `timestamp`; validates; routes | Prana Main Process |
| Event subscription | `subscribe(pattern, handler)` method; returns `SubscriptionId`; pattern supports single-segment wildcards | Prana Main Process |
| Event routing | Pattern matching at dispatch time against all active subscriber patterns | Prana Main Process |
| Event delivery | Dispatches to all matched subscribers in registration order; dispatch continues regardless of individual failures | Prana Main Process |
| Deterministic ordering | Events delivered in emission order within a channel | Prana Main Process |
| Subscriber isolation | Each subscriber failure is caught and counted; remaining subscribers continue | Prana Main Process |
| Event immutability | Event object frozen or defensively copied before dispatch; emitters cannot set `eventId` or `timestamp` | Prana Main Process |
| Event validation at emission | Validates `eventType` format, `source` presence, payload serializability before routing | Prana Main Process |
| `eventId` assignment | UUID v4 assigned by registry at `EMITTED` | Prana Main Process |
| `timestamp` assignment | Unix milliseconds assigned by registry at `EMITTED` | Prana Main Process |
| Payload safety | Registry treats payload as opaque; MUST NOT mutate payload contents | Prana Main Process |
| Observability metrics (5 required) | Per-channel and aggregate counters maintained in-memory; exposed for runtime diagnostics | Prana Main Process |
| Bootstrap registration order | Second after Configuration Service | Prana Bootstrap |
| Teardown order | Last service deregistered during `STOPPING` | Prana Bootstrap |
| In-memory only (no persistence) | No SQLite, no file writes; all state cleared on process exit | Prana Main Process |
| Runtime scoped | State exists only during process lifetime; restart clears all state | Prana Main Process |
| Channel-scoped logical separation | Event naming convention enforces domain channel prefix | Convention / Validation |
| Silent drop on no-match | If no subscribers match, event is silently dropped — not a failure | Prana Main Process |
| Rejection counted as metric | Invalid events rejected at `EMITTED`; rejection increments observability counter | Prana Main Process |
| Unsubscription idempotency | `unsubscribe` silently succeeds for inactive `SubscriptionId` | Prana Main Process |
| No notification, UI, audit, or logging responsibility | Out of scope; not realized | N/A — excluded |

---

## 7. Workflow Realization

All L2 workflows are realized as follows.

### Workflow: Event Emission

1. An emitting service calls `emit({ eventType, source, payload? })`.
2. Registry assigns `eventId` (UUID v4) and `timestamp` (Unix milliseconds).
3. Registry validates the event against L2 Section 12 rules (eventType format, source presence, payload serializability).
4. If invalid: rejection is counted in observability metrics; event is not routed; `emit()` throws a synchronous `EventValidationError` when called with an invalid event type, malformed schema, or event emitted before SERVICES_READY. The error is also counted in observability rejection metrics. Call sites MUST wrap `emit()` in a try/catch or validate before calling. The registry MUST NOT swallow the error — the emitter must receive it.
5. If valid: event transitions to `EMITTED`, then immediately to `ROUTED`.
6. Registry resolves all active subscribers whose patterns match `eventType`.
7. If no match: event is silently dropped (not a failure).
8. If matched: event transitions to `DISPATCHED`; each handler is invoked in registration order.
9. Per-handler: if handler throws, failure is isolated, counted as a delivery failure metric, and remaining handlers continue.
10. Dispatch completes. Event is not persisted.

**Intra-tick ordering guarantee:** if multiple `emit()` calls are made synchronously within the same process tick, events are delivered to subscribers in the order they were emitted. This guarantee is per-emission sequence, not per-subscriber.

### Workflow: Event Subscription

1. A service calls `subscribe(pattern, handler)`.
2. Registry validates the pattern syntax (single-segment wildcards only; `**` not supported).
3. Registry stores the `{ pattern, handler }` pair keyed by a generated `SubscriptionId`.
4. Registry returns the `SubscriptionId` to the caller.
5. Caller retains `SubscriptionId` for future unsubscription.

### Workflow: Event Unsubscription

1. A service calls `unsubscribe(subscriptionId)`.
2. If the `SubscriptionId` is active: registry removes the `{ pattern, handler }` pair.
3. If the `SubscriptionId` is inactive or unknown: registry silently succeeds (no error).
4. Subsequent events matching the former subscription pattern are no longer delivered to that handler.

### Workflow: Bootstrap Initialization

1. Prana bootstrap enters `SERVICES_READY`.
2. Configuration Service is registered first.
3. Event Registry is instantiated and registered second.
4. Subscriber registry and observability counters are initialized.
5. All other runtime services are registered and may call `subscribe` and `emit`.

### Workflow: Runtime Shutdown / Teardown

1. Prana bootstrap enters `STOPPING`.
2. All other runtime services are deregistered; they SHOULD unsubscribe active subscriptions.
3. Event Registry is deregistered last.
4. In-memory state (subscriber registry, counters) is cleared.

---

## 8. State Realization

### 8.1 Main Process States

The Event Registry manages its own internal lifecycle state independent of Astra's `AppState` lifecycle.

| State | Condition | Behavior |
|-------|-----------|----------|
| UNINITIALIZED | Before `SERVICES_READY` bootstrap state | Registry not available; callers MUST NOT emit |
| OPERATIONAL | From `SERVICES_READY` through `STOPPING` | Registry accepts `emit`, `subscribe`, `unsubscribe` |
| STOPPING | During `STOPPING` after all other services deregistered | Registry stops accepting new events; teardown proceeds. The Event Registry remains in OPERATIONAL (accepting) state until all other services have completed their teardown. The transition from OPERATIONAL to STOPPING occurs only after all other registered services have deregistered or completed their shutdown sequence. Events emitted by services during their own teardown (before they deregister) are still accepted and routed normally — the registry does not begin STOPPING until it is the last service running. |
| TERMINATED | After teardown completes | Registry instance released; state cleared |

Per-event lifecycle states (L2 Section 7):

| State | Transition Condition |
|-------|---------------------|
| EMITTED | `emit()` called; `eventId` and `timestamp` assigned; validation passed |
| ROUTED | Subscriber matching complete |
| DISPATCHED | Handler invoked per matched subscriber |
| FAILED | A handler threw during DISPATCHED (isolated per subscriber) |

### 8.2 Renderer AppState Mapping

Not applicable. The Event Registry has no renderer surface. Astra's `AppState<T>` lifecycle (INIT → LOADING → COMPLETED) does not apply to this feature.

---

## 9. Boilerplate Application Mapping

The Event Registry is a Main Process service. It does not directly consume Astra renderer boilerplate.

| Astra Boilerplate | Applied to Event Registry? | Rationale |
|-------------------|---------------------------|-----------|
| `IpcService` | No (direct use) | Registry is a Main Process service bus; IpcService is a renderer-side IPC transport |
| `ServerResponse<T>` | Conditionally | Would apply if IPC handlers expose registry access to renderer in a future version |
| `useDataState<T>` | No | No renderer ViewModel for this feature |
| `AppStateHandler` | No | No renderer view for this feature |
| `AppStateProvider` | No | No renderer context for this feature |
| `AppState<T>`, `StateType`, `StateCode` | No | No renderer state lifecycle for this feature |

Astra's boilerplate ownership invariant (L1) is observed: Prana does not re-implement `IpcService`, `ServerResponse`, or `useDataState`. If a future renderer surface is added for this feature, those boilerplate types would be consumed as-is from `'astra'`.

---

## 10. Permission Realization

The Event Registry operates entirely within the Prana Main Process. It does not involve Electron `contextBridge` permissions, renderer IPC permissions, or file system permissions.

| Permission Concern | Realization |
|--------------------|-------------|
| Who may call `emit` | Any registered Prana runtime service (Main Process); no per-caller access control is defined in L2 |
| Who may call `subscribe` | Any registered Prana runtime service (Main Process) |
| Who may call `unsubscribe` | The subscriber that holds the `SubscriptionId`; no ownership validation beyond token possession is defined in L2 |
| Renderer access | No renderer IPC surface in this version; no permissions required |

Open Question OQ-2 captures whether caller identity validation beyond `source` field format is required.

---

## 11. Validation Realization

Validation is enforced at `EMITTED` before routing. Events that fail validation are rejected and never routed.

| Field | Validation Rule | Rejection Behavior |
|-------|-----------------|--------------------|
| `eventType` | MUST be present and non-empty; MUST match `<domain>:<action>[:<state>]` format | Rejected; counted as rejected event metric |
| `source` | MUST be present and non-empty; MUST match a recognized service-registry key format | Rejected; counted as rejected event metric |
| `payload` | If present, MUST be a serializable plain object; functions, class instances, and circular references are forbidden | Rejected; counted as rejected event metric |
| `eventId` | MUST NOT be set by emitter (registry-assigned) | Per L2 §5 Field Contracts: if emitter supplies `eventId`, the field is silently stripped; the registry assigns its own value. This is NOT treated as a validation error; rejection is NOT counted. The event is processed normally. |
| `timestamp` | MUST NOT be set by emitter (registry-assigned) | Per L2 §5 Field Contracts: if emitter supplies `timestamp`, the field is silently stripped; the registry assigns its own value. This is NOT treated as a validation error; rejection is NOT counted. The event is processed normally. |

Pattern validation at subscription:

| Validation | Rule |
|------------|------|
| Wildcard syntax | Each `*` matches exactly one colon-delimited segment; `**` is not supported |
| Pattern format | MUST conform to `<domain>:<action>[:<state>]` naming convention |

---

## 12. Error Realization

All L2 failure scenarios are realized as follows.

| L2 Failure Scenario | Technical Realization | Metric Impact |
|---------------------|-----------------------|---------------|
| Invalid event emitted (bad `eventType` format) | Rejected at validation before `ROUTED`; rejection counted in observability | Rejected Events counter incremented |
| Invalid event emitted (missing `source`) | Rejected at validation before `ROUTED` | Rejected Events counter incremented |
| Invalid event emitted (non-serializable payload) | Rejected at validation before `ROUTED` | Rejected Events counter incremented |
| No subscribers match event | Event silently dropped; not a failure; no metric impact beyond Events Emitted | No failure metric |
| Subscriber handler throws during dispatch | Failure isolated to that subscriber; error caught; remaining subscribers continue | Delivery Failures counter incremented (per channel) |
| Registry called before `SERVICES_READY` | Synchronous `EventValidationError` thrown; call site receives the error; registry does not swallow. Callers MUST NOT emit before `SERVICES_READY`. |
| Registry called after teardown | Behavior after `TERMINATED` state is an Open Question (OQ-4) |
| `unsubscribe` called with inactive `SubscriptionId` | Silently succeeds; no error thrown | No metric impact |

---

## 13. Integration Realization

### 13.1 Internal Prana Integrations

All integration contracts are Main Process service-to-service via the `IEventRegistry` interface. The following services are emitters as defined in L2 Section 11.

| Emitting Service | Events Emitted |
|-----------------|----------------|
| Storage Scheduler | `storage:sync:started`, `storage:sync:completed`, `storage:sync:failed`, `storage:reconcile:completed` |
| Vault Service | `vault:mounted`, `vault:sync:completed`, `vault:sync:failed` |
| Workspace Bridge | `document:pull:completed`, `document:push:completed`, `sheet:sync:completed` |
| Application Launcher | `application:started`, `application:stopped`, `application:crashed` |
| Identity Service | `identity:login`, `identity:logout`, `identity:account:linked` |

Services that subscribe to events are not enumerated in L2. Subscription intent is defined by each consuming service's own feature spec.

**Known Subscription Mappings**

The following subscription relationships are documented for traceability. This list is advisory — additional subscriptions may exist in other features that are not enumerated here. The table uses L3 implementation-level names (service keys and event channel strings) consistent with this document's technical scope; these names may differ from the L2 feature-spec terminology used in other documents.

There is no enforcement mechanism that prevents a subscriber from registering for an event key not listed in this table. The advisory status is intentional: the Event Registry is a general-purpose pub/sub bus; the mapping table is a documentation aid, not a runtime constraint. New event keys introduced in other features should update this table for cross-document consistency.

| Subscriber | Event Pattern | Purpose |
|---|---|---|
| Storage Scheduler | `storage:sync:*` | Detect sync completion/failure for job lifecycle updates |
| Storage Architecture | `storage:conflict:*` | Detect conflict records for Mirror Constraint monitoring |
| Prana Bootstrap | `service:*` | Detect service registration/deregistration during lifecycle |
| Prana Runtime | `application:*` | Detect application lifecycle events (install, launch, crash) |
| Storage Scheduler | `storage:scheduler:terminal-failure` | Self-monitoring for terminal job failures |

### 13.2 IPC Surface

No IPC surface is defined for this version of the Event Registry. The feature has no renderer-facing channels.

If a future version exposes observability metrics or event subscription proxying to the renderer, channels would follow the convention `event-registry:{action}` and all handlers would return `ServerResponse<T>`.

### 13.3 External Systems

The Event Registry has no external system integrations. It is a purely internal, in-process service bus.

---

## 14. Ownership Mapping

### 14.1 Responsibility Ownership

| Responsibility | Owned By |
|---------------|----------|
| Event emission, routing, delivery | Prana Main Process (eventRegistryService) |
| Bootstrap registration and teardown order | Prana Bootstrap / Runtime |
| Event contract schema (`RuntimeEvent`, `IEventRegistry`, `EventHandler`, `SubscriptionId`) | Prana Main Process |
| Event channel naming convention enforcement | Prana validation at `EMITTED` |
| Observability counters | Prana Main Process |
| Payload content definition | Emitting service (opaque to registry) |
| Subscriber handler logic | Subscribing service |
| Notification, UI rendering, audit logging, persistence | Explicitly excluded; no owner within this feature |

### 14.2 Astra vs Prana Ownership

| Concern | Astra Owns | Prana Owns |
|---------|-----------|-----------|
| IpcService transport | Yes (imported from `'astra'`) | No |
| ServerResponse shape | Yes (imported from `'astra'`) | No (but must conform when writing IPC handlers) |
| useDataState, AppStateHandler | Yes | No |
| Event Registry service logic | No | Yes |
| Event contract types | No | Yes |
| Bootstrap / runtime lifecycle | No | Yes |
| SQLite / in-process state | No | Yes |
| IPC handler implementation | No | Yes (must return `ServerResponse<T>`) |
| Subscriber pattern matching | No | Yes |
| Observability metrics | No | Yes |

---

## 15. Architecture Traceability Matrix

| L1 Architectural Invariant | Applied to Event Registry? | Realization |
|----------------------------|-----------------------------|-------------|
| MVVM Separation | Not applicable | Feature is Main Process only; no renderer surface |
| Repository Isolation | Not applicable | No renderer repository; no IpcService usage in this feature |
| Dependency Direction (no circular deps) | Yes | Event Registry must not depend on emitting services; services depend on registry, not vice versa |
| Public API Stability (`src/lib.ts` only for Astra exports) | Yes — consumed if IPC added | Any future renderer consumption imports from `'astra'` only |
| Runtime Boundary (no Electron APIs in Astra core) | Yes | Prana owns `ipcMain`; Astra owns `IpcService`; Event Registry uses neither for its own operation |
| Deterministic Build | Yes | No timestamps or random IDs in build artifacts; observability counters are runtime-only |
| Dependency Safety | Yes | No new external dependencies introduced by this feature; pure in-process logic |
| Target Consistency | Not applicable | No renderer ViewModel to keep consistent |
| Astra is stateless — persistence is Prana-owned | Yes | Event Registry holds no persistent state; all state is in-memory and cleared on teardown |
| Astra does not own Electron runtime | Yes | Event Registry lifecycle is Prana-owned; Astra has no role in `ipcMain` or bootstrap |

---

## 16. Feature Traceability Matrix

| L2 Section | Requirement | Realized In |
|------------|-------------|-------------|
| Section 1.1 — Event Emission | Services may emit runtime events | Section 4.1 Service Architecture, Section 7 Workflow: Event Emission |
| Section 1.1 — Event Subscription | Services may subscribe to events | Section 4.1 Service Architecture, Section 7 Workflow: Event Subscription |
| Section 1.1 — Event Routing | Registry routes events to matched subscribers | Section 4.1 Service Architecture, Section 7 Workflow: Event Emission |
| Section 1.1 — Event Delivery | Deterministic delivery to all active subscribers | Section 6 Responsibility Realization Matrix, Section 7 |
| Section 1.2 — Exclusions | No notification, audit, logging, UI | Section 6 (excluded row), Section 5 Renderer Design |
| Section 3 — Runtime Availability | Available from `SERVICES_READY`; last to teardown | Section 4.4 Startup and Teardown, Section 8.1 |
| Section 4 — In-Memory Only | No persistence | Section 4.3 SQLite Schema, Section 9 Boilerplate |
| Section 5 — Event Contract fields | `eventId`, `timestamp`, `source`, `payload` contracts | Section 4.1 (assignment), Section 11 Validation |
| Section 6 — Event Channels | Logical channel separation via naming convention | Section 7, Section 11, Section 13.1 |
| Section 7 — Event Lifecycle | EMITTED → ROUTED → DISPATCHED → FAILED states | Section 8.1 Main Process States, Section 7 |
| Section 8 — Subscription Model | `EventHandler` type, pattern syntax, registration, unregistration | Section 4.1, Section 7 |
| Section 9 — Delivery Guarantees | Deterministic ordering, at-most-once, subscriber isolation, intra-tick emission ordering | Section 6, Section 7 (Workflow: Event Emission — intra-tick ordering note), Section 12 |
| Section 10 — Service API | `IEventRegistry` interface contract | Section 4.1 |
| Section 11 — Integration Contracts | Emitting services and their event types | Section 13.1 |
| Section 12 — Security Model | Validation rules, payload safety, immutability | Section 11 Validation Realization, Section 12 Error Realization |
| Section 13 — Observability | Five required metrics, per-channel and aggregate | Section 4.1 Service Architecture (observability counters) |
| Section 14 — Design Invariants | Immutability, in-memory, decoupling, UI independence, subscriber isolation | Sections 4, 5, 6, 8, 9 |

---

## 17. Open Questions

| ID | Question | L2 Reference | Impact |
|----|----------|--------------|--------|
| OQ-1 | **RESOLVED.** `emit()` throws a synchronous `EventValidationError` when called with an invalid event type, malformed schema, or event emitted before SERVICES_READY. The error is also counted in observability rejection metrics. Call sites MUST wrap `emit()` in a try/catch or validate before calling. The registry MUST NOT swallow the error — the emitter must receive it. | L2 Section 12 — Event Validation | Error Realization, Workflow: Event Emission |
| OQ-2 | Does the registry validate that the `source` field matches an active entry in the service registry at emission time, or only that it is non-empty and matches a recognized format? If runtime-validated against active services, the registry would need a reference to the service registry — introducing a dependency. | L2 Section 5 — `source` field contract, Section 12 | Validation Realization, Architecture (dependency direction) |
| OQ-3 | **RESOLVED.** Per L2 §5 Field Contracts, emitters MUST NOT supply `eventId` or `timestamp`. If an emitter supplies either field, the field is silently stripped by the registry — the user-supplied value is discarded and the registry assigns its own. This is NOT treated as a validation error; rejection is NOT counted. The event is processed normally. | L2 Section 5 — Field Contracts | Validation Realization, Section 11 |
| OQ-4 | What is the observable behavior if `emit`, `subscribe`, or `unsubscribe` is called after the registry has been torn down (`TERMINATED` state)? L2 does not define post-teardown behavior. | L2 Section 3 — Runtime Availability | Error Realization, Section 8.1 |
| OQ-5 | Are subscriptions retained across service restarts within the same process lifetime, or does each service re-subscribe on restart? L2 states restart clears all events but does not specify whether subscriber registrations survive a service-level restart (as opposed to full process restart). | L2 Section 9 — Delivery Guarantees | Section 8.1, Section 7 Teardown |
| OQ-6 | Does the registry enforce a maximum subscriber count per pattern or a maximum total subscription count to prevent unbounded memory growth? L2 defines no such limit. | L2 Section 8 — Subscription Model | Section 4.1 Service Architecture |
| OQ-7 | Is there a defined contract for whether `emit()` is synchronous (dispatch completes before returning) or asynchronous (dispatch queued)? L2 states handlers must be synchronous or fire-and-forget, but does not state whether the registry's own dispatch loop is synchronous. | L2 Section 8 — Handler Type | Section 7 Workflow: Event Emission, Section 9 Delivery Guarantees |
| OQ-8 | How are observability metrics exposed for runtime diagnostics — via an in-process metrics object, a dedicated IPC channel to the renderer, or integration with an external diagnostic tool? L2 requires the metrics exist but does not define the consumption mechanism. | L2 Section 13 — Observability | Section 13.2 IPC Surface |
