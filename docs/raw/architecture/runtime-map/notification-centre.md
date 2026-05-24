# Feature Runtime Map

> Runtime governance contract for the corresponding feature.
> Part of:
> features → invariants → runtime-map → audit-governance

---

# Metadata

| Field                  | Value                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Feature               | `notificationStoreService`                                                                 |
| Feature Doc            | `docs/raw/features/notification/notification-centre.md`                                    |
| Implementation         | `src/main/features/notificationStoreService.ts`                                            |
| Runtime Map            | `docs/raw/architecture/runtime-map/notification-centre.md`                            |
| Layer                  | `2`                                                                                        |
| Runtime Classification | `Persistence Boundary`                                                                     |
| Status                 | `❌ Violation`                                                                              |
| Last Reviewed          | `2026-05-21`                                                                               |
| Audit Suites Applied   | `runtime_purity / architectural_integrity / platform_neutrality / runtime_extensibility / runtime_security` |

---

# 1. Responsibility

Single runtime responsibility: persist, query, and manage notification records with concurrent write serialization.

One reason to change: the notification storage schema or persistence technology.

- **Orchestration responsibility**: none — CRUD data operations only.
- **Coordination responsibility**: serializes writes through a promise-chain queue to prevent concurrent SQLite access.
- **Execution boundary responsibility**: persistence boundary between the notification centre and the SQLite store.

---

# 2. Runtime Classification

* [ ] Orchestrator
* [ ] Coordinator
* [ ] Capability Adapter
* [x] Persistence Boundary
* [ ] Execution Boundary
* [ ] Lifecycle Manager
* [ ] Runtime Gateway
* [ ] Infrastructure Adapter

---

# 3. Ownership Classification

| Ownership Type           | Status    | Notes                                                                     |
| ------------------------ | --------- | ------------------------------------------------------------------------- |
| State Ownership          | Present   | 2 module-level `let` variables (db handle + write queue promise chain)    |
| Lifecycle Ownership      | Hidden    | DB initialized lazily on first access; never explicitly closed             |
| Infrastructure Ownership | Direct    | Owns `better-sqlite3` Database instance directly                           |
| Policy Ownership         | None      | No policy logic                                                           |
| Execution Ownership      | None      | Single-operation CRUD, no long-lived execution                             |
| Persistence Ownership    | Contract  | Direct `better-sqlite3` ownership with file-based persistence             |

---

# 4. State Ownership

## Allowed

* [ ] Request-scoped ephemeral variables
* [ ] Immutable configuration
* [x] Externalized persistence through contracts
* [ ] Deterministic execution context
* [ ] Explicit replay-safe execution metadata

## Forbidden

* [x] Mutable class-level state — `let db` and `let writeQueue` at module scope
* [ ] Static mutable fields
* [x] Cross-request memory accumulation — `writeQueue` promise chain grows with each write
* [ ] Hidden runtime caches
* [ ] Session retention
* [ ] Workflow ownership state
* [ ] Runtime-owned mutable registries
* [ ] In-memory orchestration history

---

# 5. Persistence Rules

## Persistence Boundary

This IS a persistence-boundary service. It owns:
- SQLite database lifecycle (lazy init, serialized writes, file persistence)
- Two tables: `notifications` and `notification_history`
- File-based persistence via `writeFile` at `getAppDataRoot()/notifications.sqlite`

The service serializes all write operations through a promise-chain queue (`writeQueue`) to prevent concurrent `better-sqlite3` access.

## Allowed Persistence

* [ ] Persistence through capability contracts
* [ ] Externalized storage ownership
* [ ] Replay-safe persistence
* [ ] Deterministic persistence sequencing

## Forbidden Persistence

* [x] Direct infrastructure ownership — owns `better-sqlite3` Database instance directly
* [x] Hardcoded filesystem paths — `DB_FILE_NAME = 'notifications.sqlite'` hardcoded
* [x] Vendor-specific persistence logic — `better-sqlite3` specific API calls
* [ ] Hidden storage mutation
* [ ] Runtime-owned storage topology

## Current Persistence Implementation

| Category         | Value                     |
| ---------------- | ------------------------- |
| Persistence Type | `better-sqlite3`          |
| Adapter Layer    | Direct                    |
| Migration Status | Schema in code (line 65)  |
| Replay Safe      | No                        |

---

# 6. Dependency Rules

## Allowed Dependencies

* [ ] Capability contracts
* [ ] Deterministic utilities
* [ ] Explicit orchestration abstractions
* [ ] Same-layer services ONLY through contracts
* [ ] Infrastructure adapters through interfaces

## Forbidden Dependencies

* [ ] UI framework imports
* [ ] Renderer ownership
* [x] Direct infrastructure vendors — `better-sqlite3` imported directly
* [ ] Service locator patterns
* [ ] Stateful singletons
* [ ] Mutable global registries
* [ ] Cross-layer internal implementation imports
* [ ] Electron ownership inside runtime core

## Dependency Direction

| Rule                   | Status |
| ---------------------- | ------ |
| Dependency Inversion   | ❌     |
| Cyclic Dependency Risk | None   |
| Infrastructure Leakage | ❌     |
| Framework Leakage      | None   |

---

# 7. Determinism Requirements

Ordering guarantees: writes are serialized through `writeQueue` promise chain — operations execute in submission order.

Concurrency restrictions: serialized writes; reads can happen concurrently with writes (no read lock).

Deterministic orchestration requirements: none — CRUD operations only.

Replay consistency expectations: not replayable — `Date.now()` in history IDs, `Math.random()` for uniqueness.

## Forbidden Nondeterminism

* [x] Direct `Date.now()` — line 340 for history ID generation
* [x] Direct randomness — `Math.random()` on line 340 for history ID generation
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

Non-replayable. History IDs are generated with `Date.now()` + `Math.random()`, making each operation unique and non-repeatable. The persisted data can be read back, but the exact sequence of operations cannot be reconstructed from logs.

## Replay Risks

* [ ] Hidden execution state
* [ ] Untracked side effects
* [ ] Non-serializable execution context
* [x] Missing event recording — history IDs are non-deterministic
* [x] Environment-coupled execution — `Date.now()` coupling

---

# 9. Lifecycle Ownership

## Allowed Lifecycle Ownership

* [x] Request-scoped execution — each CRUD operation is independent
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
* [ ] Capability invocation
* [x] Explicit persistence through contracts — writes to SQLite + file
* [ ] Deterministic orchestration events
* [ ] Explicitly governed execution dispatch

## Forbidden Side Effects

* [x] Direct filesystem mutation — writes `notifications.sqlite` file directly
* [ ] Unmanaged async execution
* [ ] Arbitrary process spawning
* [ ] Infrastructure mutation
* [ ] Hidden orchestration execution
* [ ] Unbounded network ownership

---

# 11. Host Assumptions

## Runtime Host Compatibility

* [ ] Pure Library
* [x] Node Compatible — uses `node:fs`, `node:path`, `node:fs/promises`
* [ ] Electron Compatible
* [ ] Browser Compatible
* [ ] Host Agnostic

## Forbidden Host Coupling

* [ ] Electron-owned orchestration
* [ ] DOM usage inside runtime core
* [ ] OS-specific orchestration branching
* [ ] Direct host lifecycle ownership

---

# 12. Capability Contracts

## Required Capabilities

| Capability    | Purpose                                        | Required |
| ------------- | ---------------------------------------------- | -------- |
| Storage       | Persist and query notification records via SQLite | Yes    |

## Forbidden Capability Behavior

* [x] Direct implementation imports — `better-sqlite3` imported directly (line 4)
* [ ] Hidden capability ownership
* [ ] Capability mutation leakage
* [ ] Internal adapter bypassing

---

# 13. Extension Surface

## Allowed Extension Points

- **Query filters**: `NotificationListFilters` interface supports priority, source, time-range, and unread-only filtering
- **Schema**: tables are created on init; schema changes require code modification

## Extension Restrictions

* [x] No runtime mutation — schema is fixed after initialization
* [ ] No infrastructure ownership escalation
* [ ] No unrestricted execution
* [ ] No lifecycle bypassing

---

# 14. Security Boundaries

## Security Surface

* [ ] IPC Boundary
* [x] Storage Boundary — SQLite file at `getAppDataRoot()/notifications.sqlite`
* [ ] Auth Boundary
* [ ] Extension Boundary
* [ ] Execution Boundary
* [ ] Network Boundary

## Security Restrictions

* [ ] Input validation required
* [ ] Least privilege enforced
* [ ] Capability isolation enforced
* [ ] No plaintext secret ownership
* [ ] No unrestricted execution

---

# 15. Compliance Analysis

> Populated from runtime-map analysis.

---

## Runtime Purity

| Invariant     | Status     | Score |
| ------------- | ---------- | ----- |
| Statelessness | ❌ Violation | 2/10   |
| Determinism   | ❌ Violation | 4/10   |
| Replayability | ❌ Violation | 4/10   |
| **Section Score** | **—** | **3.3/10** |

---

## Architectural Integrity

| Invariant            | Status     | Score |
| -------------------- | ---------- | ----- |
| Boundary Integrity   | ✅ Compliant | 10/10   |
| Dependency Direction | ❌ Violation | 4/10   |
| Lifecycle Safety     | ❌ Violation | 2/10   |
| **Section Score** | **—** | **5.3/10** |

---

## Platform Neutrality

| Invariant          | Status     | Score |
| ------------------ | ---------- | ----- |
| Host Agnosticism   | ❌ Violation | 4/10   |
| Storage Neutrality | ❌ Violation | 4/10   |
| Policy Neutrality  | ✅ Compliant | 10/10   |
| **Section Score** | **—** | **6.0/10** |

---

## Runtime Extensibility

| Invariant                     | Status       | Score |
| ----------------------------- | ------------ | ----- |
| Composability                 | ❌ Violation   | 4/10 |
| Capability Contract Integrity | ❌ Violation   | 4/10 |
| Extension Safety              | ✅ Compliant | 10/10   |
| **Section Score** | **—** | **6.0/10** |

---

## Runtime Security

| Security Area            | Status       | Score |
| ------------------------ | ------------ | ----- |
| Trust Boundary Integrity | ✅ Compliant | 10/10   |
| Capability Isolation     | ✅ Compliant | 10/10   |
| IPC Security             | ✅ Compliant | 10/10   |
| Storage Security         | ⚠️ Transitional | 6/10 |
| Extension Security       | ✅ Compliant | 10/10   |
| **Section Score** | **—** | **9.2/10** |

---
















## Score Summary

| Category                  | Score | Grade |
| ------------------------- | ----- | ----- |
| Runtime Purity            | 3.3/10 | C |
| Architectural Integrity   | 5.3/10 | B- |
| Platform Neutrality       | 6.0/10 | B |
| Runtime Extensibility     | 6.0/10 | B |
| Runtime Security          | 9.2/10 | A |
| **Grand Total**           | **6.0/10** | **B-** |
| **Relative Score**        | **+4.6** | **A** |

---

# 16. Detection Heuristics Applied


## Statelessness Checks

* [x] No mutable class-level collections
* [x] No static mutable state
* [ ] No hidden caches
* [x] No cross-request accumulation

## Determinism Checks

* [x] No `Date.now()`
* [x] No randomness
* [ ] Stable ordering enforced
* [ ] No timing-sensitive orchestration

## Lifecycle Checks

* [ ] No unmanaged timers
* [ ] No orphaned listeners
* [ ] Explicit cleanup paths exist
* [ ] Cancellation supported

## Dependency Checks

* [x] No infrastructure imports in runtime core
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

* [x] State accumulation — writeQueue promise chain; db handle held for lifetime
* [x] Infrastructure lock-in — better-sqlite3 direct dependency
* [ ] Orchestration monolith behavior
* [x] Replayability degradation
* [x] Lifecycle leakage — no db.close() ever called
* [x] Host coupling — node:fs
* [ ] Policy contamination
* [ ] Capability collapse

---

# 18. Transitional Violations

Known technical debt.

| Violation | Impact | Migration Direction | Removal Target |
| --------- | ------ | ------------------- | -------------- |
| Module-level `let db` (line 42) | Shared mutable state; no instance isolation | Convert to factory function with per-instance db handle | v3 |
| Module-level `let writeQueue` (line 43) | Cross-request promise chain accumulation | Move into factory closure | v3 |
| `better-sqlite3` direct import (line 4) | Infrastructure lock-in; vendor-specific persistence | Abstract behind PersistenceContract interface | v3 |
| `node:fs` imports (lines 1–3) | Host coupling; non-portable | Abstract file operations behind storage contract | v3 |
| `Date.now()` + `Math.random()` for history ID (line 340) | Non-deterministic; poor ID generation | Use deterministic UUID or timestamp + counter | v3 |
| No `dispose()` or `close()` | DB handle never closed; resource leak | Add explicit shutdown method | v3 |
| Schema-in-code (lines 65–111) | Schema versioning coupled to service code | Extract migrations to separate files | v3 |
| Module-level singleton pattern (POJO exports, line 128) | Instantiation on import; no lifecycle control | Factory function with explicit init | v3 |

---

# 19. Planned Deprecations

Future removals and migrations.

| Area | Deprecation | Planned Version |
| ---- | ----------- | --------------- |
| Module-level singleton | Convert to factory function | v3 |
| Direct better-sqlite3 | Abstract behind persistence contract | v3 |
| Schema in code | Extract to migration files | v3 |

---

# 20. Verification Commands

## Statelessness Verification

```bash
grep -rn "^let " src/main/features/notificationStoreService.ts
```

```bash
grep -rn "new Map\|new Set" src/main/features/notificationStoreService.ts
```

---

## Determinism Verification

```bash
grep -rn "Date.now\|Math.random\|randomUUID\|new Date()" src/main/features/notificationStoreService.ts
```

---

## Lifecycle Verification

```bash
grep -rn "setInterval\|setTimeout\|dispose\|destroy\|close\|shutdown" src/main/features/notificationStoreService.ts
```

---

## Dependency Verification

```bash
grep -rn "better-sqlite3\|electron\|react" src/main/features/notificationStoreService.ts
```

---

## Security Verification

```bash
grep -rn "eval\|exec\|spawn\|child_process" src/main/features/notificationStoreService.ts
```

---

# 21. Confidence

* [x] High
* [ ] Medium
* [ ] Low

Confidence reflects:

* implementation clarity — 437 lines, straightforward CRUD operations, well-commented
* architectural evidence quality — feature doc covers notification centre architecture
* runtime ownership visibility — violations are clearly visible at module scope

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
