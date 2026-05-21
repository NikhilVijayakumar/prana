# Feature Runtime Map

> Runtime governance contract for the Agent Communication > Runtime governance contract for a single runtime service. Channel Orchestration feature.
> Part of:
> features → invariants → runtime-map → audit-governance

---

# Metadata

| Field                  | Value                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Feature               | `agent-communication`                                                               |
| Feature Doc            | `docs/raw/features/chat/communication.md`                                            |
| Implementation         | `src/main/features/communication/channelRouterService.ts, src/main/features/orchestration/commandRouterService.ts, src/main/features/orchestration/orchestrationManager.ts`                                          |
| Runtime Map            | `docs/raw/architecture/runtime-map/communication.md`                          |
| Layer                  | `4`                                                                                  |
| Runtime Classification | `Gateway / Coordinator`                                                              |
| Status                 | `⚠️ Transitional`                                                                     |
| Last Reviewed          | `2026-05-21`                                                                         |
| Audit Suites Applied   | `runtime_purity / architectural_integrity / platform_neutrality / runtime_extensibility / runtime_security` |

---

# 1. Responsibility

Single runtime responsibility: receive messages from external channels (Telegram, WhatsApp, Internal Chat) and route them through the orchestration pipeline (interceptor → orchestrator → conversation persistence).

One reason to change: the channel routing protocol or the set of supported external adapters.

- **Orchestration responsibility**: manage the ingress pipeline for each channel — interceptor validation → intent orchestration → conversation persistence → response.
- **Coordination responsibility**: coordinate between `protocolInterceptor` (security gate), `orchestrationManager` (intent routing), `conversationStoreService` (persistence), and `contextEngineService` (session ingestion).
- **Execution boundary responsibility**: gateway boundary between external adapters and the internal orchestration system.

---

# 2. Runtime Classification

* [ ] Orchestrator
* [x] Coordinator
* [ ] Capability Adapter
* [ ] Persistence Boundary
* [ ] Execution Boundary
* [ ] Lifecycle Manager
* [x] Runtime Gateway
* [ ] Infrastructure Adapter

---

# 3. Ownership Classification

| Ownership Type           | Status        | Notes                                                                      |
| ------------------------ | ------------- | -------------------------------------------------------------------------- |
| State Ownership          | Transitional  | 1 `let` variable in factory closure (dependencies); delegating to external services |
| Lifecycle Ownership      | None          | No explicit lifecycle — instantiated at module scope                       |
| Infrastructure Ownership | None          | No infrastructure dependencies                                             |
| Policy Ownership         | Transitional  | Routing policy embedded in module-level pure functions (extractExplicitTarget, isAuthorizedDirector) |
| Execution Ownership      | None          | Delegates to orchestrationManager                                          |
| Persistence Ownership    | None          | Delegates to conversationStoreService                                      |

---

# 4. State Ownership

## Allowed

* [x] Request-scoped ephemeral variables — single `let dependencies` in factory closure
* [x] Immutable configuration — route helper functions
* [x] Externalized persistence through contracts — delegates to conversationStoreService
* [ ] Deterministic execution context
* [ ] Explicit replay-safe execution metadata

## Forbidden

* [ ] Mutable class-level state
* [ ] Static mutable fields
* [ ] Cross-request memory accumulation
* [ ] Hidden runtime caches
* [ ] Session retention
* [ ] Workflow ownership state
* [ ] Runtime-owned mutable registries
* [ ] In-memory orchestration history

---

# 5. Persistence Rules

## Persistence Boundary

Not a persistence-boundary service. All persistence is delegated:
- `conversationStoreService` for conversation records and message append
- `contextEngineService` for session ingestion (indirect persistence)

## Allowed Persistence

* [x] Persistence through capability contracts — delegates to conversationStoreService
* [ ] Externalized storage ownership
* [ ] Replay-safe persistence
* [ ] Deterministic persistence sequencing

## Forbidden Persistence

* [ ] Direct infrastructure ownership
* [ ] Hardcoded filesystem paths
* [ ] Vendor-specific persistence logic
* [ ] Hidden storage mutation
* [ ] Runtime-owned storage topology

## Current Persistence Implementation

| Category         | Value |
| ---------------- | ----- |
| Persistence Type | None (delegated) |
| Adapter Layer    | N/A   |
| Migration Status | N/A   |
| Replay Safe      | N/A   |

---

# 6. Dependency Rules

## Allowed Dependencies

* [x] Capability contracts — `ChannelRouterDependencies` interface abstracts 6 services
* [ ] Deterministic utilities
* [ ] Explicit orchestration abstractions
* [x] Same-layer services ONLY through contracts — partial: DI interface for 6 services, direct import for 2
* [ ] Infrastructure adapters through interfaces

## Forbidden Dependencies

* [ ] UI framework imports
* [ ] Renderer ownership
* [ ] Direct infrastructure vendors
* [ ] Service locator patterns
* [ ] Stateful singletons
* [ ] Mutable global registries
* [x] Cross-layer internal implementation imports — `conversationStoreService` and `contextEngineService` used directly at module scope (lines 228–229)
* [ ] Electron ownership inside runtime core

## Dependency Direction

| Rule                   | Status |
| ---------------------- | ------ |
| Dependency Inversion   | ⚠️     |
| Cyclic Dependency Risk | None   |
| Infrastructure Leakage | None   |
| Framework Leakage      | None   |

---

# 7. Determinism Requirements

Ordering guarantees: message routing is sequential per channel call; no concurrent routing guard.

Concurrency restrictions: none — multiple concurrent `route*Message` calls interleave.

Deterministic orchestration requirements: routing logic is deterministic (regex-based extraction, string normalization), but delegated orchestration is not.

Replay consistency expectations: not replayable — UUID generation and Date timestamps per message.

## Forbidden Nondeterminism

* [ ] Direct `Date.now()`
* [x] Direct randomness — `generateUUID()` from `uuid` package for session IDs
* [ ] Unstable async ordering
* [ ] Environment branching in orchestration
* [ ] Hidden mutable execution state
* [ ] Timing-sensitive orchestration

---

# 8. Replayability Requirements

## Replay Classification

* [ ] Fully Replayable
* [ ] Replayable with External State
* [ ] Partial Replayability
* [x] Non-Replayable

## Replay Requirements

Non-replayable. Session IDs are UUIDs, timestamps are `new Date()` in `createDefaultDependencies`, and delegated services (orchestrationManager, contextEngineService) have their own non-replayable state.

## Replay Risks

* [ ] Hidden execution state
* [ ] Untracked side effects
* [ ] Non-serializable execution context
* [ ] Missing event recording
* [ ] Environment-coupled execution

---

# 9. Lifecycle Ownership

## Allowed Lifecycle Ownership

* [x] Request-scoped execution — each `route*Message` call is independent
* [ ] Explicit startup/shutdown contracts
* [ ] Managed worker ownership
* [ ] Managed scheduler ownership
* [ ] Explicit cleanup/disposal

## Forbidden Lifecycle Ownership

* [ ] Hidden background execution
* [ ] Orphaned timers
* [ ] Unmanaged workers
* [ ] Fire-and-forget orchestration
* [ ] Unbounded retries
* [ ] Hidden listeners/subscriptions

## Lifecycle Classification

| Lifecycle Area       | Status |
| -------------------- | ------ |
| Startup Ownership    | Hidden |
| Shutdown Governance  | None   |
| Cleanup Guarantees   | None   |
| Cancellation Support | None   |
| Worker Governance    | N/A    |
| Timer Governance     | N/A    |

---

# 10. Side Effects

## Allowed Side Effects

* [ ] IPC emission
* [x] Capability invocation — calls orchestrationManager, protocolInterceptor, auditLogService, conversationStoreService, contextEngineService
* [x] Explicit persistence through contracts — conversation and context persistence
* [ ] Deterministic orchestration events
* [ ] Explicitly governed execution dispatch

## Forbidden Side Effects

* [ ] Direct filesystem mutation
* [ ] Unmanaged async execution
* [ ] Arbitrary process spawning
* [ ] Infrastructure mutation
* [ ] Hidden orchestration execution
* [ ] Unbounded network ownership

---

# 11. Host Assumptions

## Runtime Host Compatibility

* [ ] Pure Library
* [x] Node Compatible
* [ ] Electron Compatible
* [ ] Browser Compatible
* [x] Host Agnostic — no platform-specific imports

## Forbidden Host Coupling

* [ ] Electron-owned orchestration
* [ ] DOM usage inside runtime core
* [ ] OS-specific orchestration branching
* [ ] Direct host lifecycle ownership

---

# 12. Capability Contracts

## Required Capabilities

| Capability        | Purpose                                                | Required |
| ----------------- | ------------------------------------------------------ | -------- |
| Orchestration     | Route intent to the correct persona and workflow       | Yes      |
| Interception      | Validate message against security/compliance policies  | Yes      |
| Audit             | Record routing decisions, blocks, escalations, failures | Yes     |
| Conversation Store| Persist conversation records and message history        | Yes      |
| Context Engine    | Bootstrap sessions and ingest messages                  | Yes      |

## Forbidden Capability Behavior

* [x] Direct implementation imports — `conversationStoreService` and `contextEngineService` are imported directly, not through DI interface
* [ ] Hidden capability ownership
* [ ] Capability mutation leakage
* [ ] Internal adapter bypassing

---

# 13. Extension Surface

## Allowed Extension Points

- **Dependency injection**: `ChannelRouterDependencies` interface abstracts all external services; `setDependencies()` allows partial or full replacement — enables testing and adapter swapping
- **Channel routing**: new channel types can be added by implementing a new `route*Message` method following the existing pattern
- **Conversation helpers**: `toConversationKey`, `persistConversationTurn` are reusable across channel types

## Extension Restrictions

* [ ] No runtime mutation
* [ ] No infrastructure ownership escalation
* [ ] No unrestricted execution
* [ ] No lifecycle bypassing

---

# 14. Security Boundaries

## Security Surface

* [x] IPC Boundary — gateway between external adapters and internal orchestration
* [ ] Storage Boundary
* [ ] Auth Boundary
* [ ] Extension Boundary
* [ ] Execution Boundary
* [ ] Network Boundary

## Security Restrictions

* [x] Input validation required — `extractExplicitTarget` validates command patterns
* [x] Least privilege enforced — `isAuthorizedDirector` gates director-level access
* [x] Capability isolation enforced — `protocolInterceptor` validates before routing
* [ ] No plaintext secret ownership
* [ ] No unrestricted execution

---

# 15. Compliance Analysis

> Populated from runtime-map analysis.

---

## Runtime Purity

| Invariant     | Status       | Score |
| ------------- | ------------ | ----- |
| Statelessness | ✅ Compliant | 10/10   |
| Determinism   | ⚠️ Transitional | 6/10 |
| Replayability | ❌ Violation   | 4/10 |
| **Section Score** | **—** | **6.7/10** |

---

## Architectural Integrity

| Invariant            | Status       | Score |
| -------------------- | ------------ | ----- |
| Boundary Integrity   | ✅ Compliant | 10/10   |
| Dependency Direction | ⚠️ Transitional | 8/10 |
| Lifecycle Safety     | ⚠️ Transitional | 6/10 |
| **Section Score** | **—** | **8.0/10** |

---

## Platform Neutrality

| Invariant          | Status       | Score |
| ------------------ | ------------ | ----- |
| Host Agnosticism   | ✅ Compliant | 10/10   |
| Storage Neutrality | ✅ Compliant | 10/10   |
| Policy Neutrality  | ⚠️ Transitional | 8/10 |
| **Section Score** | **—** | **9.3/10** |

---

## Runtime Extensibility

| Invariant                     | Status       | Score |
| ----------------------------- | ------------ | ----- |
| Composability                 | ✅ Compliant | 10/10   |
| Capability Contract Integrity | ⚠️ Transitional | 8/10 |
| Extension Safety              | ✅ Compliant | 10/10   |
| **Section Score** | **—** | **9.3/10** |

---

## Runtime Security

| Security Area            | Status       | Score |
| ------------------------ | ------------ | ----- |
| Trust Boundary Integrity | ✅ Compliant | 10/10   |
| Capability Isolation     | ✅ Compliant | 10/10   |
| IPC Security             | ✅ Compliant | 10/10   |
| Storage Security         | ✅ Compliant | 10/10   |
| Extension Security       | ✅ Compliant | 10/10   |
| **Section Score** | **—** | **10.0/10** |

---









## Score Summary

| Category                  | Score | Grade |
| ------------------------- | ----- | ----- |
| Runtime Purity            | 6.7/10 | B |
| Architectural Integrity   | 8.0/10 | A- |
| Platform Neutrality       | 9.3/10 | A |
| Runtime Extensibility     | 9.3/10 | A |
| Runtime Security          | 10.0/10 | A |
| **Grand Total**           | **8.7/10** | **A-** |
| **Relative Score**        | **+2.0** | **A** |

---

# 16. Detection Heuristics Applied


## Statelessness Checks

* [ ] No mutable class-level collections
* [ ] No static mutable state
* [ ] No hidden caches
* [ ] No cross-request accumulation

## Determinism Checks

* [ ] No `Date.now()`
* [x] No randomness
* [ ] Stable ordering enforced
* [ ] No timing-sensitive orchestration

## Lifecycle Checks

* [ ] No unmanaged timers
* [ ] No orphaned listeners
* [ ] Explicit cleanup paths exist
* [ ] Cancellation supported

## Dependency Checks

* [ ] No infrastructure imports in runtime core
* [ ] No UI framework leakage
* [ ] No cyclic dependencies
* [ ] Dependency inversion enforced

## Security Checks

* [ ] IPC validation enforced
* [ ] No unrestricted execution
* [ ] No plaintext secrets
* [ ] Capability isolation enforced

---

# 17. Architecture Drift

Areas trending toward:

* [ ] State accumulation
* [ ] Infrastructure lock-in
* [ ] Orchestration monolith behavior
* [ ] Replayability degradation
* [ ] Lifecycle leakage
* [ ] Host coupling
* [ ] Policy contamination
* [ ] Capability collapse

---

# 18. Transitional Violations

Known technical debt.

| Violation | Impact | Migration Direction | Removal Target |
| --------- | ------ | ------------------- | -------------- |
| `conversationStoreService` and `contextEngineService` used directly at module scope (lines 15–16, used in `persistConversationTurn`) | DI interface incomplete; 2 of 8 services bypass abstraction | Add to `ChannelRouterDependencies` interface | v3 |
| `generateUUID()` from `uuid` package (line 1) | Non-deterministic session IDs | Use deterministic session ID derived from channel + sender + timestamp | v3 |
| `new Date().toISOString()` in `nowIso` (line 98) | Non-deterministic timestamps | Accept — timestamps are inherent to message routing | — |
| Module-level default instance instantiation (line 613) | Instantiation on import; no lifecycle control | Accept with DI override available via `setDependencies()` | — |

---

# 19. Planned Deprecations

Future removals and migrations.

| Area | Deprecation | Planned Version |
| ---- | ----------- | --------------- |
| —    | —           | —               |

---

# 20. Verification Commands

## Statelessness Verification

```bash
grep -rn "  let " src/main/features/communication/channelRouterService.ts, src/main/features/orchestration/commandRouterService.ts, src/main/features/orchestration/orchestrationManager.ts
```

```bash
grep -rn "new Map\|new Set" src/main/features/communication/channelRouterService.ts, src/main/features/orchestration/commandRouterService.ts, src/main/features/orchestration/orchestrationManager.ts
```

---

## Determinism Verification

```bash
grep -rn "Date.now\|Math.random\|randomUUID\|new Date()\|generateUUID" src/main/features/communication/channelRouterService.ts, src/main/features/orchestration/commandRouterService.ts, src/main/features/orchestration/orchestrationManager.ts
```

---

## Lifecycle Verification

```bash
grep -rn "setInterval\|setTimeout\|dispose\|destroy\|shutdown" src/main/features/communication/channelRouterService.ts, src/main/features/orchestration/commandRouterService.ts, src/main/features/orchestration/orchestrationManager.ts
```

---

## Dependency Verification

```bash
grep -rn "electron\|BrowserWindow" src/main/features/communication/channelRouterService.ts, src/main/features/orchestration/commandRouterService.ts, src/main/features/orchestration/orchestrationManager.ts
```

---

## Security Verification

```bash
grep -rn "eval\|exec\|spawn\|child_process" src/main/features/communication/channelRouterService.ts, src/main/features/orchestration/commandRouterService.ts, src/main/features/orchestration/orchestrationManager.ts
```

---

# 21. Confidence

* [x] High
* [ ] Medium
* [ ] Low

Confidence reflects:

* implementation clarity — factory pattern, 628 lines, well-structured DI interface
* architectural evidence quality — feature doc covers channel routing role
* runtime ownership visibility — single `let` state variable, clear dependency management

---

# 22. Audit Traceability

| Audit Suite             | Latest Report |
| ----------------------- | ------------- |
| runtime_purity          |               |
| architectural_integrity |               |
| platform_neutrality     |               |
| runtime_extensibility   |               |
| runtime_security        |               |

---

# Template Metadata

| Field              | Value                                        |
| ------------------ | -------------------------------------------- |
| Template Version   | `2.0`                                        |
| Generated From     | `runtime-map governance system`              |
| Last Updated       | `2026-05-21`                                 |
| Architecture Model | `Stateless Deterministic Capability Runtime` |

```
```
template is available in docs/raw/data/template/runtime_map_template.md
