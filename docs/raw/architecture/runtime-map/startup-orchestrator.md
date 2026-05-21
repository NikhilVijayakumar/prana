# Feature Runtime Map

> Runtime governance contract for the Startup Orchestrator feature.
> Part of:
> features → invariants → runtime-map → audit-governance

---

# Metadata

| Field                  | Value                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Feature               | `startup-orchestrator`                                                                                                                  |
| Feature Doc            | `docs/raw/features/boot/startup-orchestrator.md`                                                                                        |
| Implementation         | `src/main/features/operations/startupOrchestratorService.ts`                                                                                       |
| Runtime Map            | `docs/raw/architecture/runtime-map/startup-orchestrator.md`                                                                             |
| Layer                  | `1`                                                                                                                                     |
| Runtime Classification | `Orchestrator`                                                                                                                          |
| Status                 | `⚠️ Transitional`                                                                                                                        |
| Last Reviewed          | `2026-05-21`                                                                                                                            |
| Audit Suites Applied   | `runtime_purity / architectural_integrity / platform_neutrality / runtime_extensibility / runtime_security`                             |

---

# 1. Responsibility

Single runtime responsibility.

One reason to change: the bootstrap sequence ordering or stage execution protocol.

Describe ONLY:

* orchestration responsibility — root execution authority that governs all pre-operational initialization via a strict state-driven bootstrap lifecycle
* coordination responsibility — coordinates 8 sequential stages (integration contract, host dependencies, governance, vault, storage mirror validation, vaidyar health check, sync recovery, cron recovery), each gated by prerequisite state transitions
* execution boundary responsibility — enforces zero-trust initialization: no subsystem activates before identity verification, no storage access before security validation, and no operational transition without integrity checks

Do NOT describe:

* feature walkthroughs
* UI behavior
* product functionality

---

# 2. Runtime Classification

Select all applicable classifications.

* [x] Orchestrator
* [ ] Coordinator
* [ ] Capability Adapter
* [ ] Persistence Boundary
* [ ] Execution Boundary
* [ ] Lifecycle Manager
* [ ] Runtime Gateway
* [ ] Infrastructure Adapter

---

# 3. Ownership Classification

| Ownership Type           | Status                         | Notes |
| ------------------------ | ------------------------------ | ----- |
| State Ownership          | Transitional                   | Factory pattern with closure-scoped mutable state (`latestStartupReport`, `runningSequence`, `progressCallback`). No module-level mutable collections. |
| Lifecycle Ownership      | Explicit                       | `runningSequence` Promise is managed; watchdog timers created and cleared; `__resetForTesting` for explicit teardown. |
| Infrastructure Ownership | None                           | No direct infrastructure; delegates to adapter services (vaultService, syncProviderService). |
| Policy Ownership         | Embedded                       | Integration contract validation, host dependency policy, and drive policy branching encoded directly in stage logic. |
| Execution Ownership      | Scoped                         | Runs startup sequence once; deduplication via `runningSequence` guard; no long-lived execution. |
| Persistence Ownership    | None                           | Orchestrates persistence via contracts; does not own any persistence infrastructure. |

---

# 4. State Ownership

## Allowed

* [x] Request-scoped ephemeral variables
* [ ] Immutable configuration
* [x] Externalized persistence through contracts
* [x] Deterministic execution context
* [ ] Explicit replay-safe execution metadata

## Forbidden

* [x] Mutable class-level state — factory closure variables are mutable (`latestStartupReport`, `runningSequence`, `progressCallback`)
* [ ] Static mutable fields
* [ ] Cross-request memory accumulation
* [ ] Hidden runtime caches
* [ ] Session retention
* [ ] Workflow ownership state
* [ ] Runtime-owned mutable registries
* [ ] In-memory orchestration history

Note: Mutable class-level state (factory closure) is present but confined to a single instance. The factory pattern prevents module-level accumulation. This is an accepted transitional condition for the startup sequence.

---

# 5. Persistence Rules

## Persistence Boundary

Describe:

* allowed persistence contracts — delegates vault and sync persistence to `vaultService` and `syncProviderService` via direct calls; no persistence contracts are abstracted through interfaces
* persistence ownership restrictions — the orchestrator does not own any persistence infrastructure; all persistence is delegated
* storage neutrality expectations — the orchestrator expects `syncProviderService` and `vaultService` to abstract storage details; no storage assumptions leak into orchestration logic

---

## Allowed Persistence

* [x] Persistence through capability contracts
* [ ] Externalized storage ownership
* [ ] Replay-safe persistence
* [ ] Deterministic persistence sequencing

---

## Forbidden Persistence

* [ ] Direct infrastructure ownership
* [ ] Hardcoded filesystem paths
* [ ] Vendor-specific persistence logic
* [ ] Hidden storage mutation
* [ ] Runtime-owned storage topology

---

## Current Persistence Implementation

| Category         | Value                                       |
| ---------------- | ------------------------------------------- |
| Persistence Type | `None`                                      |
| Adapter Layer    | `syncProviderService`, `vaultService`       |
| Migration Status | N/A                                         |
| Replay Safe      | N/A                                         |

---

# 6. Dependency Rules

## Allowed Dependencies

* [ ] Capability contracts — no contract interfaces exist; imports are direct service references
* [ ] Deterministic utilities
* [ ] Explicit orchestration abstractions
* [ ] Same-layer services ONLY through contracts
* [ ] Infrastructure adapters through interfaces

## Forbidden Dependencies

* [ ] UI framework imports
* [ ] Renderer ownership
* [ ] Direct infrastructure vendors
* [ ] Service locator patterns
* [ ] Stateful singletons
* [ ] Mutable global registries
* [ ] Cross-layer internal implementation imports
* [ ] Electron ownership inside runtime core

## Dependency Direction

| Rule                   | Status                   |
| ---------------------- | ------------------------ |
| Dependency Inversion   | ❌                        |
| Cyclic Dependency Risk | Present                  |
| Infrastructure Leakage | None                     |
| Framework Leakage      | None                     |

The orchestrator imports 14 services directly by module path. No dependency inversion is enforced. Cyclic dependency risk exists because downstream services (e.g., `vaidyarService`) could reference orchestrator types. No UI or infrastructure framework leakage detected.

---

# 7. Determinism Requirements

Describe:

* ordering guarantees — strict sequential execution of 8 stages; no parallel stage execution; deterministic state machine progression (`INIT → FOUNDATION → IDENTITY_VERIFIED → STORAGE_READY → STORAGE_MIRROR_VALIDATING → INTEGRITY_VERIFIED → OPERATIONAL`)
* concurrency restrictions — `runningSequence` guard ensures at most one startup sequence runs; watchdog timers are Promise-raced, not concurrent
* deterministic orchestration requirements — stage ordering is fixed at design time; stage skipping follows deterministic rules based on policy and failure conditions
* replay consistency expectations — logical replay is deterministic (same order, same gating), but timestamps (`new Date().toISOString()`) make exact replay impossible

---

## Forbidden Nondeterminism

* [x] Direct `Date.now()` — `nowIso()` calls `new Date().toISOString()` (functionally equivalent for timestamp generation)
* [ ] Direct randomness
* [ ] Unstable async ordering
* [ ] Environment branching in orchestration
* [x] Hidden mutable execution state — `latestStartupReport`, `runningSequence`, `progressCallback` are mutable closure state
* [x] Timing-sensitive orchestration — watchdog timeouts (`setTimeout` race) introduce timing sensitivity

---

# 8. Replayability Requirements

## Replay Classification

* [ ] Fully Replayable
* [x] Replayable with External State — stage ordering is deterministic, but downstream service state (governance repo, vault, sync) is external
* [ ] Partial Replayability
* [ ] Non-Replayable

---

## Replay Requirements

Describe:

* event reconstruction expectations — startup stages can be reconstructed from the same ordered sequence; failure/skip paths follow deterministic rules
* replay-safe side effects — downstream service invocations (sync, recovery, cron) must be idempotent per their own contracts
* serialization boundaries — `StartupStatusReport` and `StartupStageReport` are serializable data structures
* deterministic replay guarantees — only logical ordering is guaranteed; timestamps and timing-dependent behavior (watchdog races) are non-replayable

---

## Replay Risks

* [x] Hidden execution state — `latestStartupReport` is mutated during sequence execution
* [ ] Untracked side effects
* [ ] Non-serializable execution context
* [ ] Missing event recording
* [x] Environment-coupled execution — host dependency checks (binary availability) are environment-dependent

---

# 9. Lifecycle Ownership

## Allowed Lifecycle Ownership

* [x] Request-scoped execution — startup sequence runs once per `runStartupSequence` call
* [x] Explicit startup/shutdown contracts — `__resetForTesting` provides explicit reset; `runningSequence` guard prevents concurrent sequences
* [ ] Managed worker ownership
* [ ] Managed scheduler ownership
* [x] Explicit cleanup/disposal — `Promise.finally` in `runningSequence` clears guard and callback

---

## Forbidden Lifecycle Ownership

* [ ] Hidden background execution
* [x] Orphaned timers — watchdog timers are created and cleared (`clearTimeout` in `finally` block)
* [ ] Unmanaged workers
* [ ] Fire-and-forget orchestration
* [ ] Unbounded retries
* [ ] Hidden listeners/subscriptions

---

## Lifecycle Classification

| Lifecycle Area       | Status |
| -------------------- | ------ |
| Startup Ownership    | Explicit — `createStartupOrchestrator()` factory; `runStartupSequence` entry point |
| Shutdown Governance  | Implicit — `__resetForTesting` method; no formal shutdown contract |
| Cleanup Guarantees   | Explicit — `Promise.finally` clears `runningSequence` and `progressCallback` |
| Cancellation Support | None — no abort signal or cancellation mechanism |
| Worker Governance    | None — no worker management |
| Timer Governance     | Explicit — watchdog timers created and cleared per-stage |

---

# 10. Side Effects

## Allowed Side Effects

* [x] IPC emission — progress events via `StartupProgressCallback`
* [ ] Capability invocation
* [x] Explicit persistence through contracts — vault mount, sync pull, recovery via downstream services
* [x] Deterministic orchestration events — stage status updates, progress computation
* [x] Explicitly governed execution dispatch — `runStartupSequence` deduplicates via `runningSequence` guard

---

## Forbidden Side Effects

* [ ] Direct filesystem mutation
* [x] Unmanaged async execution — `console.error` warnings for non-critical service failures (hookSystem, notificationCentre, memoryIndex)
* [ ] Arbitrary process spawning
* [ ] Infrastructure mutation
* [ ] Hidden orchestration execution
* [ ] Unbounded network ownership

Note: Non-critical service initializations (hookSystem, notificationCentre, memoryIndex) at lines 522-540 use fire-and-forget error handling (`console.error` but no cleanup on failure). These are accepted as warnings.

---

# 11. Host Assumptions

## Runtime Host Compatibility

* [ ] Pure Library
* [x] Node Compatible — uses `setTimeout`, `Promise.race`, module imports
* [ ] Electron Compatible
* [ ] Browser Compatible
* [ ] Host Agnostic

---

## Forbidden Host Coupling

* [ ] Electron-owned orchestration
* [ ] DOM usage inside runtime core
* [ ] OS-specific orchestration branching
* [ ] Direct host lifecycle ownership

---

# 12. Capability Contracts

## Required Capabilities

List ONLY explicit contracts.

| Capability | Purpose | Required |
| ---------- | ------- | -------- |
| Host Dependency Capability | Validate host binary availability (SSH, git, virtual-drive) | Yes |
| Governance Repository | Ensure governance repo is cloned/ready | Yes |
| Vault Mount | Initialize vault storage | Conditional (client-managed policy) |
| Sync Provider | Initial sync pull from remote | Conditional (client-managed policy) |
| Vaidyar Diagnostics | Run bootstrap health checks | Yes |
| Recovery Orchestrator | Recover pending sync tasks | Yes |
| Cron Scheduler | Initialize scheduler, recover missed runs | Yes |

---

## Forbidden Capability Behavior

* [x] Direct implementation imports — all 14 services imported as direct module references, not through capability contracts
* [ ] Hidden capability ownership
* [ ] Capability mutation leakage
* [ ] Internal adapter bypassing

---

# 13. Extension Surface

## Allowed Extension Points

Describe:

* injectable capabilities — `StartupProgressCallback` is the only injectable extension point; downstream services are statically imported
* overridable orchestration points — `drivePolicy.clientManaged` branches affect vault/storage-mirror stage execution
* adapter replacement boundaries — none; all services are hard-imported; no interface-based adapter injection

---

## Extension Restrictions

* [x] No runtime mutation — services cannot be replaced at runtime
* [ ] No infrastructure ownership escalation
* [ ] No unrestricted execution
* [x] No lifecycle bypassing — `runStartupSequence` deduplication guard prevents bypass

---

# 14. Security Boundaries

## Security Surface

* [x] IPC Boundary — progress events emitted via callback can be forwarded to IPC
* [ ] Storage Boundary
* [ ] Auth Boundary
* [x] Extension Boundary — callback injection point
* [x] Execution Boundary — state machine gates prevent unauthorized stage progression
* [ ] Network Boundary

---

## Security Restrictions

* [ ] Input validation required — no external input validation in stage execution
* [x] Least privilege enforced — stages execute only required operations; no superfluous permissions
* [ ] Capability isolation enforced
* [ ] No plaintext secret ownership
* [x] No unrestricted execution — stage execution bounded by watchdog timeouts

---

# 15. Compliance Analysis

> Populated from runtime-map analysis.

---

## Runtime Purity

| Invariant     | Status | Score |
| ------------- | ------ | ----- |
| Statelessness | ❌      | 4/10   |
| Determinism   | ❌      | 4/10   |
| Replayability | ⚠️      | 6/10   |
| **Section Score** | **—** | **4.7/10** |

Rationale:
- **Statelessness (2/5):** Factory pattern confines state to closure scope, preventing module-level accumulation. However, `latestStartupReport`, `runningSequence`, and `progressCallback` are mutable instance state. No mutable class-level collections, static fields, or hidden caches detected.
- **Determinism (2/5):** Stage ordering is strictly sequential and deterministic. However, `nowIso()` uses `new Date().toISOString()`, watchdog timers introduce timing-dependent behavior, and downstream service state is external.
- **Replayability (3/5):** Logical replay (same ordering, same gating rules) is deterministic. Timestamps prevent exact replay. Downstream service idempotency is assumed but not enforced by the orchestrator.

---

## Architectural Integrity

| Invariant            | Status | Score |
| -------------------- | ------ | ----- |
| Boundary Integrity   | ✅      | 8/10   |
| Dependency Direction | ⚠️      | 4/10   |
| Lifecycle Safety     | ✅      | 8/10   |
| **Section Score** | **—** | **6.7/10** |

Rationale:
- **Boundary Integrity (4/5):** Explicit state machine with 7 well-defined states and 8 stages. Clear sequential boundaries between layers. Fail-fast guarantee for critical stages. Slight degradation at lines 522-540 where non-critical service failures are fire-and-forget.
- **Dependency Direction (2/5):** 14 direct module imports with no dependency inversion. No interface/contract abstractions. Cyclic dependency risk present. No UI or infrastructure leakage detected.
- **Lifecycle Safety (4/5):** `runningSequence` guard prevents concurrent sequences. Watchdog timers are created/cleared properly. `__resetForTesting` provides explicit teardown. Missing cancellation support.

---

## Platform Neutrality

| Invariant          | Status | Score |
| ------------------ | ------ | ----- |
| Host Agnosticism   | ⚠️      | 4/10   |
| Storage Neutrality | ✅      | 6/10   |
| Policy Neutrality  | ⚠️      | 4/10   |
| **Section Score** | **—** | **4.7/10** |

Rationale:
- **Host Agnosticism (2/5):** Uses `setTimeout`, `Promise.race`, and Node module resolution. Not browser-compatible. Not a pure library.
- **Storage Neutrality (3/5):** Orchestrates storage through delegated services. No hardcoded storage paths or vendor-specific logic. Drive policy branching (`clientManaged`) adds policy coupling.
- **Policy Neutrality (2/5):** Integration contract validation, host dependency policy, and drive policy are hardcoded into the stage logic rather than injected.

---

## Runtime Extensibility

| Invariant                     | Status | Score |
| ----------------------------- | ------ | ----- |
| Composability                 | ❌      | 2/10   |
| Capability Contract Integrity | ❌      | 2/10   |
| Extension Safety              | ⚠️      | 4/10   |
| **Section Score** | **—** | **2.7/10** |

Rationale:
- **Composability (1/5):** No interface-based composition. All services are statically imported. No DI or service locator. `StartupProgressCallback` is the sole injection point.
- **Capability Contract Integrity (1/5):** No capability contracts exist. Services are called directly without contract abstraction.
- **Extension Safety (2/5):** Runtime mutation is prevented (static imports). Lifecycle bypass is prevented (`runningSequence` guard). No infrastructure escalation risk.

---

## Runtime Security

| Security Area            | Status | Score |
| ------------------------ | ------ | ----- |
| Trust Boundary Integrity | ✅      | 8/10   |
| Capability Isolation     | ⚠️      | 4/10   |
| IPC Security             | ⚠️      | 6/10   |
| Storage Security         | ✅      | 8/10   |
| Extension Security       | ⚠️      | 6/10   |
| **Section Score** | **—** | **6.4/10** |

Rationale:
- **Trust Boundary Integrity (4/5):** Identity-verified gate before storage access. Fail-fast on integration contract failure. Vaidyar blocking signals halt progression.
- **Capability Isolation (2/5):** No capability-based isolation. All services accessible via direct import. No least-privilege enforcement at the orchestrator level.
- **IPC Security (3/5):** Progress events are emitted via callback. No direct IPC usage. No validation on callback data.
- **Storage Security (4/5):** Enforces identity-first access pattern. No direct storage manipulation.
- **Extension Security (3/5):** Callback injection point has no input validation. No unrestricted execution within stages (watchdog bounded).

---









## Score Summary

| Category                  | Score | Grade |
| ------------------------- | ----- | ----- |
| Runtime Purity            | 4.7/10 | C+ |
| Architectural Integrity   | 6.7/10 | B |
| Platform Neutrality       | 4.7/10 | C+ |
| Runtime Extensibility     | 2.7/10 | C- |
| Runtime Security          | 6.4/10 | B |
| **Grand Total**           | **5.0/10** | **B-** |
| **Relative Score**        | **-1.6** | **D** |

---

# 16. Detection Heuristics Applied


## Statelessness Checks

* [x] No mutable class-level collections — no class used; factory pattern
* [ ] No static mutable state — N/A (no static fields)
* [x] No hidden caches — none detected
* [x] No cross-request accumulation — `runningSequence` guard prevents concurrent sequences; state resets per request

Results: `grep -r "private.*="` — none found (no class). `grep -r "new Map\|new Set\|\[\]"` — `new Set` found in function-scoped `determineOverallStatus` (acceptable, created and discarded per invocation).

---

## Determinism Checks

* [x] No `Date.now()` — no direct `Date.now()` call; `nowIso()` uses `new Date().toISOString()` which is functionally equivalent
* [x] No randomness — none found
* [x] Stable ordering enforced — strict sequential stage execution
* [ ] No timing-sensitive orchestration — watchdog timers (`setTimeout` race) introduce timing dependency

Results: `grep -r "Date.now\|Math.random\|randomUUID"` — none found. However, `nowIso()` at line 72 uses `new Date().toISOString()`.

---

## Lifecycle Checks

* [x] No unmanaged timers — watchdog timers cleared in `finally` block
* [x] No orphaned listeners — `progressCallback` is nullable and cleared in `Promise.finally`
* [x] Explicit cleanup paths exist — `Promise.finally` in `runningSequence`, `__resetForTesting`
* [ ] Cancellation supported — no abort controller or cancellation mechanism

Results: `setTimeout` at line 108 with matching `clearTimeout` at line 115. No `setInterval`. No `void Promise` or `void async` patterns.

---

## Dependency Checks

* [x] No infrastructure imports in runtime core — no `better-sqlite3`, `electron`, or `react`
* [x] No UI framework leakage — none found
* [x] No cyclic dependencies — module has no imports from orchestrator (incoming risk exists)
* [ ] Dependency inversion enforced — all imports are direct module references

Results: No `better-sqlite3`, `electron`, `react` imports detected.

---

## Security Checks

* [ ] IPC validation enforced — callback events are not validated
* [x] No unrestricted execution — watchdog timeouts bound execution
* [x] No plaintext secrets — none stored
* [ ] Capability isolation enforced — no capability abstraction layer

Results: No `eval`, `exec`, `spawn`, `child_process` detected. `executeWithWatchdog` matches but is a local function, not `child_process.exec`.

---

# 17. Architecture Drift

Areas trending toward:

* [ ] State accumulation — factory pattern prevents module-level accumulation
* [ ] Infrastructure lock-in
* [x] Orchestration monolith behavior — 8 stages with 14 direct service imports create high coupling risk
* [x] Replayability degradation — timestamp generation and watchdog timing prevent exact replay
* [ ] Lifecycle leakage
* [ ] Host coupling
* [x] Policy contamination — integration contract, host dependency, and drive policies are embedded in stage logic
* [x] Capability collapse — no capability contract abstraction; all services are directly imported

---

# 18. Transitional Violations

Known technical debt.

| Violation | Impact | Migration Direction | Removal Target |
| --------- | ------ | ------------------- | -------------- |
| Direct service imports (14 services) | High coupling; cyclic risk; no testability isolation | Introduce capability contract interfaces; inject via factory parameters | TBD |
| `nowIso()` uses `new Date().toISOString()` | Prevents exact replay | Inject timestamp provider or use deterministic sequence counter | TBD |
| Watchdog `setTimeout` race | Introduces timing-dependent nondeterminism | Use cooperative cancellation (AbortSignal) instead of Promise.race timeout | TBD |
| No cancellation support | Cannot abort in-progress startup sequence | Add AbortController support to `runStartupSequence` | TBD |
| Non-critical service fire-and-forget (lines 522-540) | Failures are silently swallowed as warnings | Add stage tracking for post-startup initialization | TBD |

---

# 19. Planned Deprecations

Future removals and migrations.

| Area | Deprecation | Planned Version |
| ---- | ----------- | --------------- |
| `defaultStartupOrchestrator` singleton | Backward compatibility export; prefer explicit `createStartupOrchestrator()` | TBD |
| Direct service imports | Migrate to capability contract injection | TBD |

---

# 20. Verification Commands

## Statelessness Verification

```bash
grep -r "private.*=" src/main/features/operations/startupOrchestratorService.ts | grep -v "readonly"
```

```bash
grep -r "new Map\|new Set\|\[\]" src/main/features/operations/startupOrchestratorService.ts
```

---

## Determinism Verification

```bash
grep -r "Date.now\|Math.random\|randomUUID" src/main/features/operations/startupOrchestratorService.ts
```

---

## Lifecycle Verification

```bash
grep -r "setInterval\|setTimeout" src/main/features/operations/startupOrchestratorService.ts
```

```bash
grep -r "void .*Promise\|void .*async" src/main/features/operations/startupOrchestratorService.ts
```

---

## Dependency Verification

```bash
grep -r "better-sqlite3\|electron\|react" src/main/features/operations/startupOrchestratorService.ts
```

---

## Security Verification

```bash
grep -r "eval\|exec\|spawn\|child_process" src/main/features/operations/startupOrchestratorService.ts
```

---

# 21. Confidence

* [ ] High
* [x] Medium
* [ ] Low

Confidence reflects:

* implementation clarity — clearly structured with explicit state machine, stage definitions, and watchdog pattern
* architectural evidence quality — code is well-organized but lacks contract abstractions and has multiple transitional violations
* runtime ownership visibility — factory pattern makes state ownership explicit; dependency ownership is obscured by direct imports

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
