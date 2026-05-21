# Feature Runtime Map

> Runtime governance contract for the corresponding feature.
> Part of:
> features → invariants → runtime-map → audit-governance

---

# Metadata

| Field                  | Value                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Feature               | `sync-provider-service`                                                                                                                 |
| Feature Doc            | `docs/raw/features/storage/sync-engine.md`                                                                                              |
| Implementation         | `src/main/features/syncProviderService.ts`                                                                                              |
| Runtime Map            | `docs/raw/architecture/runtime-map/sync-engine.md`                                                                            |
| Layer                  | `3`                                                                                                                                     |
| Runtime Classification | `Coordinator / Runtime Gateway`                                                                                                         |
| Status                 | `⚠️ Transitional`                                                                                                                        |
| Last Reviewed          | `2026-05-21`                                                                                                                            |
| Audit Suites Applied   | `runtime_purity / architectural_integrity / platform_neutrality / runtime_extensibility / runtime_security`                             |

---

# 1. Responsibility

Single runtime responsibility.

One reason to change: the sync reconciliation protocol, vault↔cache mirroring strategy, or machine lock model.

Describe ONLY:

* orchestration responsibility — orchestrates the push/pull sync lifecycle between SQLite cache and vault, including snapshot integrity validation, conflict detection via diff engine, and vault archive publishing
* coordination responsibility — coordinates between `syncStoreService` (queue, encrypted snapshots), `vaultService` (vault mount, archive, git publish), `registryRuntimeStoreService` (runtime state import), `dataFilterService` (snapshot building, integrity validation), `diffEngine` (mirror comparison), `auditLogService` (transaction logging), and `driveControllerService` (vault drive sessions)
* execution boundary responsibility — provides the sync governance boundary: exclusive sync locks via `syncStoreService.acquireSyncLock`, machine-level active client lock (SHA-256 of host:user), serialized sync operations via Promise queue, and push timer with configurable interval

Do NOT describe:

* feature walkthroughs
* UI behavior
* product functionality

---

# 2. Runtime Classification

Select all applicable classifications.

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

| Ownership Type           | Status                         | Notes |
| ------------------------ | ------------------------------ | ----- |
| State Ownership          | Transitional                   | Factory pattern with closure-scoped mutable state (17 `let` variables). Module-level singleton prevents accumulation across instances. Comment at line 84: "This is transitional - will be fully stateless in v3." |
| Lifecycle Ownership      | Explicit                       | `dispose()` stops timer and resets initialized flag. `__resetForTesting()` clears all state. |
| Infrastructure Ownership | Adapter                        | Filesystem access via `node:fs`, but paths derived from `vaultService.getWorkingRootPath()`. |
| Policy Ownership         | Embedded                       | Machine lock TTL, push interval constraints, integrity validation rules encoded in service. |
| Execution Ownership      | Scoped                         | Sync operations serialized via `queueSyncOperation` Promise chain. |
| Persistence Ownership    | None                           | Delegates all persistence to vaultService, syncStoreService, registryRuntimeStoreService. |

---

# 4. State Ownership

## Allowed

* [x] Request-scoped ephemeral variables — function-scoped arrays and accumulators
* [x] Immutable configuration — `REGISTRY_SYNC_RELATIVE_PATH`, `MACHINE_LOCK_TTL_MS`, `SYNC_LOCK_OWNER`
* [x] Externalized persistence through contracts — delegates to store services and vault
* [ ] Deterministic execution context
* [ ] Explicit replay-safe execution metadata

## Forbidden

* [x] Mutable class-level state — factory closure variables are mutable (17 `let` bindings)
* [ ] Static mutable fields
* [ ] Cross-request memory accumulation
* [ ] Hidden runtime caches
* [ ] Session retention
* [ ] Workflow ownership state
* [ ] Runtime-owned mutable registries
* [ ] In-memory orchestration history

Note: Mutable closure state is confined to a single factory instance. Known transitional state — acknowledged in code comment at line 84: "This is transitional - will be fully stateless in v3."

---

# 5. Persistence Rules

## Persistence Boundary

Describe:

* allowed persistence contracts — delegates to `vaultService` (vault mount, sync, publish, cleanup), `syncStoreService` (encrypted snapshots, queue tasks, sync locks), `registryRuntimeStoreService` (runtime state), `auditLogService` (transactions)
* persistence ownership restrictions — does not own any persistence infrastructure; all storage is externalized
* storage neutrality expectations — expects `vaultService` and `syncStoreService` to abstract storage details; writes snapshot files to vault workspace via `writeRemoteSnapshot`

---

## Allowed Persistence

* [x] Persistence through capability contracts — delegates to vaultService and syncStoreService
* [x] Externalized storage ownership — registry snapshots pushed to vault archive
* [ ] Replay-safe persistence
* [x] Deterministic persistence sequencing — snapshot writes ordered via sync queue and lock

---

## Forbidden Persistence

* [ ] Direct infrastructure ownership
* [ ] Hardcoded filesystem paths — paths derived from `vaultService.getWorkingRootPath()`
* [ ] Vendor-specific persistence logic
* [ ] Hidden storage mutation
* [ ] Runtime-owned storage topology

---

## Current Persistence Implementation

| Category         | Value                                       |
| ---------------- | ------------------------------------------- |
| Persistence Type | `External`                                  |
| Adapter Layer    | `vaultService`, `syncStoreService`, `registryRuntimeStoreService` |
| Migration Status | N/A                                         |
| Replay Safe      | Partial (snapshot content is deterministic; timestamps differ) |

---

# 6. Dependency Rules

## Allowed Dependencies

* [ ] Capability contracts
* [x] Deterministic utilities — `diffEngine.compareVaultToLocal`, `dataFilterService.validateSnapshotIntegrity`
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
| Infrastructure Leakage | Partial (`node:fs` for snapshot/lock file I/O) |
| Framework Leakage      | None                     |

Imports 11 internal services and 4 standard library modules. Cyclic risk exists with `vaultService` which imports services that may reference sync types. Infrastructure leakage is minimal (only `node:fs` for snapshot/lock file management within vault workspace).

---

# 7. Determinism Requirements

Describe:

* ordering guarantees — sync operations serialized via `queueSyncOperation` Promise chain; `withSyncLock` ensures exclusive global sync lock; push/pull operations are sequential within the queue
* concurrency restrictions — global sync lock (`syncStoreService.acquireSyncLock`) prevents parallel sync operations; machine lock (`ActiveClientLock`) prevents multi-machine concurrent vault access
* deterministic orchestration requirements — snapshot integrity validation is deterministic; `diffEngine.compareVaultToLocal` produces deterministic results for identical inputs
* replay consistency expectations — partial replay is possible for snapshot processing (deterministic content), but timestamps (`Date.now()`, `nowIso()`), machine identity (`hostname()`, `userInfo()`), and `process.pid` prevent exact replay

---

## Forbidden Nondeterminism

* [x] Direct `Date.now()` — line 212 for machine lock age check
* [ ] Direct randomness
* [ ] Unstable async ordering — operations serialized via queue
* [ ] Environment branching in orchestration
* [x] Hidden mutable execution state — 17 closure-scoped `let` variables
* [ ] Timing-sensitive orchestration

---

# 8. Replayability Requirements

## Replay Classification

* [ ] Fully Replayable
* [x] Replayable with External State — snapshot processing logic is deterministic; timestamps and machine identity differ
* [ ] Partial Replayability
* [ ] Non-Replayable

---

## Replay Requirements

Describe:

* event reconstruction expectations — sync push/pull outcomes can be reconstructed from the same snapshot state; machine lock detection will differ based on host
* replay-safe side effects — vault publish uses `vaultService.publishVaultChanges` which is governed by its own contract; queue operations in syncStoreService assumed idempotent
* serialization boundaries — `RegistrySyncSnapshot`, `SplashSyncResult`, `ActiveClientLock` are fully serializable
* deterministic replay guarantees — only snapshot integrity validation and mirror comparison are fully deterministic; timestamps and machine identity vary per run

---

## Replay Risks

* [x] Hidden execution state — 17 closure variables tracking sync status
* [ ] Untracked side effects
* [ ] Non-serializable execution context
* [ ] Missing event recording
* [x] Environment-coupled execution — `hostname()`, `userInfo()`, `process.pid`, git binary availability

---

# 9. Lifecycle Ownership

## Allowed Lifecycle Ownership

* [x] Request-scoped execution — individual push/pull operations are request-scoped
* [ ] Explicit startup/shutdown contracts — no explicit startup contract; `initializeOnSplash` is the entry point
* [x] Managed scheduler ownership — `startPushTimer` / `stopPushTimer` manage the push interval timer
* [ ] Managed scheduler ownership
* [x] Explicit cleanup/disposal — `dispose()` stops timer and resets state; `__resetForTesting()` clears all state

---

## Forbidden Lifecycle Ownership

* [ ] Hidden background execution
* [ ] Orphaned timers — `intervalHandle` is tracked and cleared via `stopPushTimer` / `dispose`
* [ ] Unmanaged workers
* [x] Fire-and-forget orchestration — `void pushLatestApprovedSnapshot()` at line 502 inside `setInterval`
* [ ] Unbounded retries
* [ ] Hidden listeners/subscriptions

---

## Lifecycle Classification

| Lifecycle Area       | Status |
| -------------------- | ------ |
| Startup Ownership    | Explicit — `initializeOnSplash` initializes state, loads config, acquires machine lock |
| Shutdown Governance  | Explicit — `dispose()` stops timer, resets initialized |
| Cleanup Guarantees   | Explicit — `dispose()`, `__resetForTesting()`, vault cleanup in try/finally |
| Cancellation Support | None — no abort mechanism for push/pull operations |
| Worker Governance    | None — no worker management |
| Timer Governance     | Explicit — `startPushTimer`/`stopPushTimer` manage single `setInterval` |

---

# 10. Side Effects

## Allowed Side Effects

* [ ] IPC emission
* [x] Capability invocation — vault mount/publish, syncStore operations, registryRuntime import
* [x] Explicit persistence through contracts — snapshot writes, queue management, audit logging
* [ ] Deterministic orchestration events
* [x] Explicitly governed execution dispatch — `withSyncLock` and `queueSyncOperation` govern all operations

---

## Forbidden Side Effects

* [x] Direct filesystem mutation — `writeFile` for snapshot and lock files within vault workspace
* [ ] Unmanaged async execution
* [ ] Arbitrary process spawning
* [ ] Infrastructure mutation
* [ ] Hidden orchestration execution
* [ ] Unbounded network ownership — vault publish may push to remote git

---

# 11. Host Assumptions

## Runtime Host Compatibility

* [ ] Pure Library
* [x] Node Compatible — requires `node:os` (hostname, userInfo), `node:crypto` (createHash), `node:fs`, `process.pid`
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
| Vault Service | Initialize vault, sync from remote, publish vault changes, cleanup workspace | Yes |
| Sync Store | Encrypted snapshot storage, queue management, sync lock, app registry | Yes |
| Registry Runtime Store | Import approved runtime state from sync | Yes |
| Data Filter Service | Build registry sync snapshot, validate integrity | Yes |
| Diff Engine | Compare vault to local, detect remote source deletion | Yes |
| Audit Log Service | Append sync transaction records | Yes |
| Drive Controller | Manage vault drive sessions | Yes |
| Recovery Orchestrator | Recover pending sync tasks on startup | Yes |

---

## Forbidden Capability Behavior

* [x] Direct implementation imports — all 8 capabilities imported as direct module references
* [ ] Hidden capability ownership
* [ ] Capability mutation leakage
* [ ] Internal adapter bypassing

---

# 13. Extension Surface

## Allowed Extension Points

Describe:

* injectable capabilities — `pushIntervalMs` is configurable at runtime via `updatePushInterval` and persisted settings
* overridable orchestration points — none; all services are hard-imported
* adapter replacement boundaries — none; vault and sync store are directly imported

---

## Extension Restrictions

* [x] No runtime mutation — services cannot be replaced at runtime
* [ ] No infrastructure ownership escalation
* [ ] No unrestricted execution
* [ ] No lifecycle bypassing

---

# 14. Security Boundaries

## Security Surface

* [ ] IPC Boundary
* [x] Storage Boundary — encrypted snapshot management, vault drive session
* [ ] Auth Boundary
* [ ] Extension Boundary
* [x] Execution Boundary — global sync lock enforcement, machine lock
* [ ] Network Boundary

---

## Security Restrictions

* [ ] Input validation required
* [x] Least privilege enforced — sync lock prevents concurrent access; machine lock prevents multi-machine conflicts
* [ ] Capability isolation enforced
* [ ] No plaintext secret ownership
* [x] No unrestricted execution — operations bounded by sync lock and queue

---

# 15. Compliance Analysis

> Populated from runtime-map analysis.

---

## Runtime Purity

| Invariant     | Status | Score |
| ------------- | ------ | ----- |
| Statelessness | ⚠️      | 4/10   |
| Determinism   | ❌      | 4/10   |
| Replayability | ⚠️      | 4/10   |
| **Section Score** | **—** | **4.0/10** |

Rationale:
- **Statelessness (2/5):** Factory pattern confines 17 mutable `let` variables to closure scope, preventing module-level accumulation. Acknowledged transitional debt (line 84). No module-level mutable collections.
- **Determinism (2/5):** `new Date().toISOString()` via `nowIso()`, `Date.now()` at line 212. `hostname()`, `userInfo()`, `process.pid` are environment-dependent. Snapshot processing logic is deterministic.
- **Replayability (2/5):** Snapshot integrity validation and mirror comparison are fully deterministic. Timestamps, machine identity, and git remote state prevent exact replay.

---

## Architectural Integrity

| Invariant            | Status | Score |
| -------------------- | ------ | ----- |
| Boundary Integrity   | ✅      | 8/10   |
| Dependency Direction | ⚠️      | 4/10   |
| Lifecycle Safety     | ⚠️      | 6/10   |
| **Section Score** | **—** | **6.0/10** |

Rationale:
- **Boundary Integrity (4/5):** Clear coordinator boundary for sync operations. Explicit lock and queue governance. `withSyncLock` + `queueSyncOperation` double-enforcement. Minor policy embedding (machine lock TTL, push interval constraints).
- **Dependency Direction (2/5):** 11 direct internal service imports. Cyclic risk with vaultService.
- **Lifecycle Safety (3/5):** `dispose()` stops timer. `__resetForTesting()` clears all state. `void pushLatestApprovedSnapshot()` fire-and-forget in push timer is a lifecycle concern.

---

## Platform Neutrality

| Invariant          | Status | Score |
| ------------------ | ------ | ----- |
| Host Agnosticism   | ❌      | 2/10   |
| Storage Neutrality | ✅      | 6/10   |
| Policy Neutrality  | ⚠️      | 4/10   |
| **Section Score** | **—** | **4.0/10** |

Rationale:
- **Host Agnosticism (1/5):** Relies on `node:os` (hostname, userInfo), `node:crypto`, `process.pid`. Not portable outside Node.js.
- **Storage Neutrality (3/5):** Delegates to vault and sync store services. Writes snapshot/lock files to vault workspace (filesystem coupling).
- **Policy Neutrality (2/5):** Machine lock TTL, push interval clamping, integrity validation rules embedded in the service.

---

## Runtime Extensibility

| Invariant                     | Status | Score |
| ----------------------------- | ------ | ----- |
| Composability                 | ❌      | 2/10   |
| Capability Contract Integrity | ⚠️      | 4/10   |
| Extension Safety              | ⚠️      | 4/10   |
| **Section Score** | **—** | **3.3/10** |

Rationale:
- **Composability (1/5):** Factory pattern allows multiple instances but services are hard-imported. No interface-based composition.
- **Capability Contract Integrity (2/5):** Delegates to multiple service contracts. Direct imports, no formal abstraction.
- **Extension Safety (2/5):** No runtime mutation. `updatePushInterval` is only runtime-configurable parameter. Limited surface area.

---

## Runtime Security

| Security Area            | Status | Score |
| ------------------------ | ------ | ----- |
| Trust Boundary Integrity | ✅      | 8/10   |
| Capability Isolation     | ⚠️      | 4/10   |
| IPC Security             | N/A    | N/A   |
| Storage Security         | ✅      | 6/10   |
| Extension Security       | N/A    | N/A   |
| **Section Score** | **—** | **6.0/10** |

Rationale:
- **Trust Boundary Integrity (4/5):** Global sync lock enforces exclusive access. Machine lock prevents multi-machine conflicts. Snapshot integrity validation before merge.
- **Capability Isolation (2/5):** No capability-based isolation. All services accessible via direct import.
- **Storage Security (3/5):** Delegates to vault's encrypted envelope. Snapshot files in vault workspace inherit vault protection. Machine lock file is plaintext JSON.
- **Extension Security:** N/A.

---









## Score Summary

| Category                  | Score | Grade |
| ------------------------- | ----- | ----- |
| Runtime Purity            | 4.0/10 | C+ |
| Architectural Integrity   | 6.0/10 | B |
| Platform Neutrality       | 4.0/10 | C+ |
| Runtime Extensibility     | 3.3/10 | C |
| Runtime Security          | 6.0/10 | B |
| **Grand Total**           | **4.7/10** | **C+** |
| **Relative Score**        | **-2.0** | **F** |

---

# 16. Detection Heuristics Applied


## Statelessness Checks

* [ ] No mutable class-level collections — 17 mutable `let` closure variables
* [ ] No static mutable state — N/A
* [ ] No hidden caches — `last*` tracking variables act as status cache
* [ ] No cross-request accumulation — closure state persists across operations within the instance

Results: `private.*=` — none (no class). 17 `let` variables in factory closure. `new Map\|new Set` — none. `[]` — `lastIntegrityIssues` is a mutable array at line 100.

---

## Determinism Checks

* [ ] No `Date.now()` — found at line 212
* [x] No randomness — no `Math.random` or `randomUUID`
* [x] Stable ordering enforced — queue serialization + sync lock
* [ ] No timing-sensitive orchestration — `setInterval` push timer is timing-sensitive

Results: `Date.now()` at line 212. `new Date().toISOString()` via `nowIso()` at line 80.

---

## Lifecycle Checks

* [ ] No unmanaged timers — `setInterval` at line 501 managed via `intervalHandle`
* [x] No orphaned listeners — no event listeners
* [x] Explicit cleanup paths exist — `dispose()`, `__resetForTesting()`
* [ ] Cancellation supported — no abort mechanism

Results: `setInterval` found at line 501 with matching `clearInterval` at line 511. No `void Promise/async` (but `void pushLatestApprovedSnapshot()` at line 502 — the call is voided within the setInterval callback context).

---

## Dependency Checks

* [x] No infrastructure imports in runtime core — no `better-sqlite3`, `electron`, or `react`
* [x] No UI framework leakage — none found
* [x] No cyclic dependencies — module is not imported by its dependencies (risk exists)
* [ ] Dependency inversion enforced — all imports are direct

Results: No `better-sqlite3`, `electron`, `react` detected. Standard lib imports (`node:fs`, `node:crypto`, `node:os`, `node:path`).

---

## Security Checks

* [x] No directly executable code — no `eval` or `exec`
* [x] No unrestricted execution — sync lock and queue govern execution
* [x] No plaintext secrets — vault secrets handled by vaultService
* [x] Sync lock enforcement — `withSyncLock` prevents concurrent sync operations

Results: No `eval`, `exec`, `spawn`, `child_process` detected.

---

# 17. Architecture Drift

Areas trending toward:

* [ ] State accumulation — acknowledged transitional state, scoped to factory instance
* [x] Infrastructure lock-in — `node:os` for machine identity, `process.pid` for lock owner
* [ ] Orchestration monolith behavior
* [x] Replayability degradation — timestamps and host identity prevent replay
* [x] Lifecycle leakage — `void` fire-and-forget in push timer
* [x] Host coupling — `hostname()`, `userInfo()`, `process.pid`, `node:crypto`
* [x] Policy contamination — machine lock TTL, push interval constraints, integrity rules embedded
* [ ] Capability collapse

---

# 18. Transitional Violations

Known technical debt.

| Violation | Impact | Migration Direction | Removal Target |
| --------- | ------ | ------------------- | -------------- |
| 17 mutable closure state variables | Acknowledged transitional debt (line 84); status tracking prevents replay | Externalize status tracking to syncStoreService; derive from persisted sync state | v3 |
| `hostname()` + `userInfo()` for machine ID | Host-coupling; OS-dependent | Use deterministic machine key from config or crypto fingerprint | TBD |
| `process.pid` in lock owner | Non-portable; PID reuse risk | Use random or config-based lock owner ID | TBD |
| `void pushLatestApprovedSnapshot()` in timer | Errors silently lost in timer tick | Wrap in async error handler with logging | TBD |
| `loadPushIntervalFromSettings` reads filesystem | Direct filesystem access in coordinator | Externalize settings to store service | TBD |

---

# 19. Planned Deprecations

Future removals and migrations.

| Area | Deprecation | Planned Version |
| ---- | ----------- | --------------- |
| Closure-scoped mutable state | Migrate to stateless operation; derive status from persisted sync state | v3 |

---

# 20. Verification Commands

## Statelessness Verification

```bash
grep -r "private.*=" src/main/features/syncProviderService.ts | grep -v "readonly"
```

```bash
grep -r "new Map\|new Set\|\[\]" src/main/features/syncProviderService.ts
```

---

## Determinism Verification

```bash
grep -r "Date.now\|Math.random\|randomUUID" src/main/features/syncProviderService.ts
```

---

## Lifecycle Verification

```bash
grep -r "setInterval\|setTimeout" src/main/features/syncProviderService.ts
```

```bash
grep -r "void .*Promise\|void .*async" src/main/features/syncProviderService.ts
```

---

## Dependency Verification

```bash
grep -r "better-sqlite3\|electron\|react" src/main/features/syncProviderService.ts
```

---

## Security Verification

```bash
grep -r "eval\|exec\|spawn\|child_process" src/main/features/syncProviderService.ts
```

---

# 21. Confidence

* [ ] High
* [x] Medium
* [ ] Low

Confidence reflects:

* implementation clarity — well-structured factory pattern with explicit governance (queue + lock); 17 mutable variables are grouped and visible
* architectural evidence quality — sync governance is strong (lock + queue + machine lock); host coupling and transitional state are acknowledged
* runtime ownership visibility — factory pattern makes state ownership visible; code comment acknowledges transitional nature

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
