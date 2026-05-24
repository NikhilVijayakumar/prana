# Feature Runtime Map

> Runtime governance contract for the corresponding feature.
> Part of:
> features → invariants → runtime-map → audit-governance

---

# Metadata

| Field                  | Value                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Feature               | `sqlite-service`                                                                                                                        |
| Feature Doc            | `docs/raw/features/storage/sqlite-cache.md`                                                                                             |
| Implementation         | `src/main/common/storage/sqliteService.ts`                                                                                                    |
| Runtime Map            | `docs/raw/architecture/runtime-map/sqlite-cache.md`                                                                                   |
| Layer                  | `2`                                                                                                                                     |
| Runtime Classification | `Infrastructure Adapter / Persistence Boundary`                                                                                         |
| Status                 | `✅ Compliant`                                                                                                                           |
| Last Reviewed          | `2026-05-21`                                                                                                                            |
| Audit Suites Applied   | `runtime_purity / architectural_integrity / platform_neutrality / runtime_extensibility / runtime_security`                             |

---

# 1. Responsibility

Single runtime responsibility.

One reason to change: the SQLite engine, file I/O strategy, or encryption protocol.

Describe ONLY:

* orchestration responsibility — none; this service does not orchestrate
* coordination responsibility — none; this service does not coordinate other services
* execution boundary responsibility — provides a managed execution boundary around `better-sqlite3` database instances, including lifecycle management (initialize/persist/close), optional transparent AES-256-GCM encryption of the SQLite file at rest, and sequential write serialization via a Promise queue

Do NOT describe:

* feature walkthroughs
* UI behavior
* product functionality

---

# 2. Runtime Classification

Select all applicable classifications.

* [ ] Orchestrator
* [ ] Coordinator
* [ ] Capability Adapter
* [x] Persistence Boundary
* [ ] Execution Boundary
* [ ] Lifecycle Manager
* [ ] Runtime Gateway
* [x] Infrastructure Adapter

---

# 3. Ownership Classification

| Ownership Type           | Status                         | Notes |
| ------------------------ | ------------------------------ | ----- |
| State Ownership          | Present                        | Mutable class-level fields: `db` (Database instance), `writeQueue` (Promise chain). Immutable config: `dbPath`, `encrypted`. |
| Lifecycle Ownership      | Explicit                       | `initialize()` / `close()` methods; `writeQueue` is drained on `close()`. |
| Infrastructure Ownership | Direct                         | Direct dependency on `better-sqlite3` and `node:fs` / `node:path`. |
| Policy Ownership         | None                           | No policy logic; operates on supplied configuration. |
| Execution Ownership      | Scoped                         | Request-scoped via `getDatabase()`; write operations serialized via `writeQueue`. |
| Persistence Ownership    | Direct                         | Manages SQLite file at a configured path, including encryption envelope. |

---

# 4. State Ownership

## Allowed

* [ ] Request-scoped ephemeral variables
* [x] Immutable configuration — `dbPath`, `encrypted` set at construction
* [ ] Externalized persistence through contracts
* [ ] Deterministic execution context
* [ ] Explicit replay-safe execution metadata

## Forbidden

* [x] Mutable class-level state — `private db: Database | null = null;` at line 17
* [ ] Static mutable fields
* [ ] Cross-request memory accumulation
* [ ] Hidden runtime caches
* [ ] Session retention
* [ ] Workflow ownership state
* [ ] Runtime-owned mutable registries
* [ ] In-memory orchestration history

Note: Mutable class-level state (`db`, `writeQueue`) is inherent to a service managing a database connection. This is accepted for an Infrastructure Adapter that wraps a native database driver. The `writeQueue` is a Promise chain that serializes write operations but accumulates in length with each call.

---

# 5. Persistence Rules

## Persistence Boundary

Describe:

* allowed persistence contracts — none; this is the infrastructure adapter itself, wrapping `better-sqlite3` directly
* persistence ownership restrictions — owns the database file path, lifecycle, and encryption envelope; ownership is absolute within its scope
* storage neutrality expectations — not storage-neutral; explicitly coupled to SQLite via `better-sqlite3` and the local filesystem via `node:fs`

---

## Allowed Persistence

* [ ] Persistence through capability contracts
* [ ] Externalized storage ownership
* [ ] Replay-safe persistence
* [ ] Deterministic persistence sequencing

---

## Forbidden Persistence

* [x] Direct infrastructure ownership — owns `better-sqlite3` driver and filesystem paths
* [x] Hardcoded filesystem paths — paths are configured via `SqliteServiceOptions.dbPath`
* [x] Vendor-specific persistence logic — `better-sqlite3` API used directly
* [ ] Hidden storage mutation
* [ ] Runtime-owned storage topology

---

## Current Persistence Implementation

| Category         | Value                                       |
| ---------------- | ------------------------------------------- |
| Persistence Type | `better-sqlite3`                            |
| Adapter Layer    | `sqliteService.ts` wraps `better-sqlite3`   |
| Migration Status | N/A (schema ownership delegated to consumers) |
| Replay Safe      | No (file I/O, encryption IV randomness)     |

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
* [x] Direct infrastructure vendors — `better-sqlite3` imported directly at line 1
* [ ] Service locator patterns
* [ ] Stateful singletons
* [ ] Mutable global registries
* [ ] Cross-layer internal implementation imports
* [ ] Electron ownership inside runtime core

## Dependency Direction

| Rule                   | Status                   |
| ---------------------- | ------------------------ |
| Dependency Inversion   | ❌ (no interface for SQLite access) |
| Cyclic Dependency Risk | None                     |
| Infrastructure Leakage | Present (`better-sqlite3` type exposed via `Database` return type) |
| Framework Leakage      | None                     |

The service directly depends on `better-sqlite3` (line 1), `node:fs` (line 2), `node:fs/promises` (line 3), `node:path` (line 4), and `sqliteCryptoUtil` (line 5). No UI or Electron dependencies. Infrastructure leakage is present because the `Database` type from `better-sqlite3` is exposed through the public API.

---

# 7. Determinism Requirements

Describe:

* ordering guarantees — write operations are serialized via `writeQueue` Promise chain; `persist()` closes and reopens the database, ensuring sequential access
* concurrency restrictions — database handle is a single instance (not pooled); `getDatabase()` is async but returns the same singleton reference
* deterministic orchestration requirements — none; infrastructure adapter has no orchestration logic
* replay consistency expectations — not replayable; file I/O, encryption IV randomness (`randomBytes` in `sqliteCryptoUtil`), and filesystem state prevent deterministic replay

---

## Forbidden Nondeterminism

* [ ] Direct `Date.now()`
* [ ] Direct randomness
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

---

## Replay Requirements

Describe:

* event reconstruction expectations — none; this is an infrastructure adapter, not an event-sourced service
* replay-safe side effects — file I/O is inherently non-replayable
* serialization boundaries — database state is external to the service
* deterministic replay guarantees — no guarantees; filesystem state and encryption IVs are non-deterministic

---

## Replay Risks

* [ ] Hidden execution state
* [x] Untracked side effects — filesystem writes are not tracked by this service
* [ ] Non-serializable execution context
* [ ] Missing event recording
* [x] Environment-coupled execution — filesystem paths, `better-sqlite3` binary, OS file locking

---

# 9. Lifecycle Ownership

## Allowed Lifecycle Ownership

* [x] Request-scoped execution — database handle is request-scoped via `getDatabase()`
* [x] Explicit startup/shutdown contracts — `initialize()` and `close()` provide explicit lifecycle
* [ ] Managed worker ownership
* [ ] Managed scheduler ownership
* [x] Explicit cleanup/disposal — `close()` drains `writeQueue` and closes the database handle

---

## Forbidden Lifecycle Ownership

* [ ] Hidden background execution
* [ ] Orphaned timers
* [ ] Unmanaged workers
* [ ] Fire-and-forget orchestration
* [ ] Unbounded retries
* [ ] Hidden listeners/subscriptions

---

## Lifecycle Classification

| Lifecycle Area       | Status |
| -------------------- | ------ |
| Startup Ownership    | Explicit — `initialize()` creates DB instance |
| Shutdown Governance  | Explicit — `close()` drains queue and disconnects |
| Cleanup Guarantees   | Explicit — `writeQueue` drained before `db.close()` |
| Cancellation Support | None — no abort mechanism for in-flight writes |
| Worker Governance    | None — no worker management |
| Timer Governance     | None — no timers |

---

# 10. Side Effects

## Allowed Side Effects

* [ ] IPC emission
* [ ] Capability invocation
* [x] Explicit persistence through contracts — filesystem writes via `better-sqlite3` and `writeFile`
* [ ] Deterministic orchestration events
* [ ] Explicitly governed execution dispatch

---

## Forbidden Side Effects

* [x] Direct filesystem mutation — `mkdir`, `readFile`, `writeFile` called directly
* [ ] Unmanaged async execution
* [ ] Arbitrary process spawning
* [ ] Infrastructure mutation
* [ ] Hidden orchestration execution
* [ ] Unbounded network ownership

---

# 11. Host Assumptions

## Runtime Host Compatibility

* [ ] Pure Library
* [x] Node Compatible — requires `better-sqlite3` native addon, `node:fs`, `node:path`, `node:crypto`
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
| Crypto Key Derivation | Derive AES-256-GCM key from vault config via `pbkdf2Sync` | Yes (when `encrypted: true`) |
| Runtime Config | Access vault archive password/salt via `getPranaRuntimeConfig` | Yes (when `encrypted: true`) |

---

## Forbidden Capability Behavior

* [ ] Direct implementation imports
* [x] Hidden capability ownership — `sqliteCryptoUtil` encryption logic is coupled to vault config
* [ ] Capability mutation leakage
* [ ] Internal adapter bypassing

---

# 13. Extension Surface

## Allowed Extension Points

Describe:

* injectable capabilities — `SqliteServiceOptions` (dbPath, encrypted flag) is the only configuration point
* overridable orchestration points — none; the class is concrete
* adapter replacement boundaries — none; `better-sqlite3` is directly embedded; no interface for database abstraction

---

## Extension Restrictions

* [ ] No runtime mutation
* [ ] No infrastructure ownership escalation
* [ ] No unrestricted execution
* [ ] No lifecycle bypassing

---

# 14. Security Boundaries

## Security Surface

* [ ] IPC Boundary
* [x] Storage Boundary — manages SQLite database files with optional encryption
* [ ] Auth Boundary
* [ ] Extension Boundary
* [ ] Execution Boundary
* [ ] Network Boundary

---

## Security Restrictions

* [ ] Input validation required
* [ ] Least privilege enforced
* [ ] Capability isolation enforced
* [ ] No plaintext secret ownership — secrets used in crypto are derived from vault config, not stored directly
* [ ] No unrestricted execution

---

# 15. Compliance Analysis

> Populated from runtime-map analysis.

---

## Runtime Purity

| Invariant     | Status | Score |
| ------------- | ------ | ----- |
| Statelessness | ❌      | 2/10   |
| Determinism   | ❌      | 2/10   |
| Replayability | ❌      | 2/10   |
| **Section Score** | **—** | **2.0/10** |

Rationale:
- **Statelessness (1/5):** Mutable class-level `db` and `writeQueue` fields. Accepted for an Infrastructure Adapter that manages a database connection.
- **Determinism (1/5):** File I/O, filesystem state, and encryption IV randomness (`randomBytes` in `sqliteCryptoUtil`) are fundamentally nondeterministic.
- **Replayability (1/5):** Not replayable. Infrastructure coupling to filesystem and native addon makes replay impossible.

---

## Architectural Integrity

| Invariant            | Status | Score |
| -------------------- | ------ | ----- |
| Boundary Integrity   | ✅      | 8/10   |
| Dependency Direction | ✅      | 6/10   |
| Lifecycle Safety     | ✅      | 8/10   |
| **Section Score** | **—** | **7.3/10** |

Rationale:
- **Boundary Integrity (4/5):** Clear Infrastructure Adapter boundary. Single responsibility (wrap `better-sqlite3`). No orchestration or business logic leakage.
- **Dependency Direction (3/5):** Dependencies are appropriate for an Infrastructure Adapter (`better-sqlite3`, `node:fs`, `node:crypto`). No dependency inversion, but acceptable for this layer. No cyclic risk.
- **Lifecycle Safety (4/5):** Explicit initialize/close. `writeQueue` drained on close. No timers or orphaned resources. Missing cancellation support.

---

## Platform Neutrality

| Invariant          | Status | Score |
| ------------------ | ------ | ----- |
| Host Agnosticism   | ❌      | 2/10   |
| Storage Neutrality | ❌      | 2/10   |
| Policy Neutrality  | ✅      | 8/10   |
| **Section Score** | **—** | **4.0/10** |

Rationale:
- **Host Agnosticism (1/5):** Tightly coupled to Node.js (`better-sqlite3` native addon, `node:fs`, `node:path`, `node:crypto`). Not portable.
- **Storage Neutrality (1/5):** Explicitly coupled to SQLite via `better-sqlite3` and local filesystem paths.
- **Policy Neutrality (4/5):** No policy logic embedded. Operates purely on supplied configuration.

---

## Runtime Extensibility

| Invariant                     | Status | Score |
| ----------------------------- | ------ | ----- |
| Composability                 | ❌      | 2/10   |
| Capability Contract Integrity | ⚠️      | 4/10   |
| Extension Safety              | ⚠️      | 4/10   |
| **Section Score** | **—** | **3.3/10** |

Rationale:
- **Composability (1/5):** Concrete class with no interface. Cannot be replaced or mocked without direct instantiation.
- **Capability Contract Integrity (2/5):** Encryption is delegated to `sqliteCryptoUtil` (a capability contract of sorts). No formal contract abstraction for the SQLite adapter itself.
- **Extension Safety (2/5):** No runtime mutation possible. No extension points to abuse. Limited surface area.

---

## Runtime Security

| Security Area            | Status | Score |
| ------------------------ | ------ | ----- |
| Trust Boundary Integrity | ✅      | 8/10   |
| Capability Isolation     | ⚠️      | 4/10   |
| IPC Security             | N/A    | N/A   |
| Storage Security         | ✅      | 8/10   |
| Extension Security       | N/A    | N/A   |
| **Section Score** | **—** | **6.7/10** |

Rationale:
- **Trust Boundary Integrity (4/5):** Clear storage boundary. Encryption at rest via AES-256-GCM. No data exposure.
- **Capability Isolation (2/5):** No capability isolation layer. Crypto keys derived from global config.
- **Storage Security (4/5):** Transparent encryption envelope. Decrypted to temp file (potential risk at `tempPath` line 38 — decrypted file on disk). Writes re-encrypt on `persist()`.
- **Extension Security:** N/A — no extension surface.

---
















## Score Summary

| Category                  | Score | Grade |
| ------------------------- | ----- | ----- |
| Runtime Purity            | 2.0/10 | C- |
| Architectural Integrity   | 7.3/10 | B+ |
| Platform Neutrality       | 4.0/10 | C+ |
| Runtime Extensibility     | 3.3/10 | C |
| Runtime Security          | 6.7/10 | B |
| **Grand Total**           | **4.7/10** | **C+** |
| **Relative Score**        | **+3.3** | **A** |

---

# 16. Detection Heuristics Applied


## Statelessness Checks

* [ ] No mutable class-level collections — `private db` and `private writeQueue` are mutable class-level state
* [ ] No static mutable state — no static fields
* [ ] No hidden caches — none found
* [ ] No cross-request accumulation — `writeQueue` Promise chain accumulates with each write

Results: `grep -r "private.*="` found `private db`, `private writeQueue` (mutable), and `private dbPath`, `private encrypted` (readonly after construction). No `new Map`, `new Set`, or `[]` detected.

---

## Determinism Checks

* [x] No `Date.now()` — none found
* [x] No randomness — none found in this file; `randomBytes` used in `sqliteCryptoUtil.ts` (line 21)
* [x] Stable ordering enforced — write operations serialized via `writeQueue`
* [ ] No timing-sensitive orchestration — file I/O is inherently timing-sensitive

Results: `grep -r "Date.now\|Math.random\|randomUUID"` — none found in this file. `randomBytes` present in `sqliteCryptoUtil.ts` (encryption IV generation).

---

## Lifecycle Checks

* [x] No unmanaged timers — no `setInterval` or `setTimeout`
* [x] No orphaned listeners — no event listeners
* [x] Explicit cleanup paths exist — `close()` drains queue and disconnects
* [ ] Cancellation supported — no abort mechanism

Results: No `setInterval`, `setTimeout`, or `void Promise/async` detected.

---

## Dependency Checks

* [ ] No infrastructure imports in runtime core — `better-sqlite3` is a direct infrastructure import (acceptable for Infrastructure Adapter)
* [x] No UI framework leakage — none found
* [x] No cyclic dependencies — module only depends on crypto util and standard lib
* [ ] Dependency inversion enforced — `better-sqlite3` imported directly without interface

Results: `better-sqlite3` detected at line 1 (expected for this service). No `electron` or `react`.

---

## Security Checks

* [x] No directly executable code — no `eval` or `exec`
* [x] No unrestricted execution — database operations bounded by API surface
* [x] No plaintext secrets — encryption keys derived via PBKDF2 from vault config
* [ ] Capability isolation enforced — no capability isolation layer

Results: No `eval`, `exec`, `spawn`, or `child_process` detected.

---

# 17. Architecture Drift

Areas trending toward:

* [ ] State accumulation — `writeQueue` grows with each write, but is drained
* [x] Infrastructure lock-in — `better-sqlite3` is deeply embedded; no abstraction layer for alternative engines
* [ ] Orchestration monolith behavior
* [ ] Replayability degradation
* [ ] Lifecycle leakage
* [x] Host coupling — Node.js and `better-sqlite3` native addon make this non-portable
* [ ] Policy contamination
* [ ] Capability collapse

---

# 18. Transitional Violations

Known technical debt.

| Violation | Impact | Migration Direction | Removal Target |
| --------- | ------ | ------------------- | -------------- |
| Decrypted temp file on `initialize()` | Plaintext SQLite file at `tempPath` on disk during encrypted mode; cleared on `persist()` but leaves window of exposure | Use in-memory decryption or SQLite encryption extension (SEE) | TBD |
| No database abstraction interface | Cannot swap SQLite for another engine without changing all consumers | Extract `DatabaseProvider` interface | TBD |
| `writeQueue` unbounded growth | Promise chain grows linearly with write calls under backpressure | Cap queue size or switch to BoundedQueue pattern | TBD |

---

# 19. Planned Deprecations

Future removals and migrations.

| Area | Deprecation | Planned Version |
| ---- | ----------- | --------------- |
| `tempPath` decryption pattern | Replace with in-memory decryption or WAL-based encrypted SQLite | TBD |

---

# 20. Verification Commands

## Statelessness Verification

```bash
grep -r "private.*=" src/main/common/storage/sqliteService.ts | grep -v "readonly"
```

```bash
grep -r "new Map\|new Set\|\[\]" src/main/common/storage/sqliteService.ts
```

---

## Determinism Verification

```bash
grep -r "Date.now\|Math.random\|randomUUID" src/main/common/storage/sqliteService.ts
```

---

## Lifecycle Verification

```bash
grep -r "setInterval\|setTimeout" src/main/common/storage/sqliteService.ts
```

```bash
grep -r "void .*Promise\|void .*async" src/main/common/storage/sqliteService.ts
```

---

## Dependency Verification

```bash
grep -r "better-sqlite3\|electron\|react" src/main/common/storage/sqliteService.ts
```

---

## Security Verification

```bash
grep -r "eval\|exec\|spawn\|child_process" src/main/common/storage/sqliteService.ts
```

---

# 21. Confidence

* [ ] High
* [x] Medium
* [ ] Low

Confidence reflects:

* implementation clarity — small (93 lines), single-responsibility, easy to audit
* architectural evidence quality — code is clean and well-structured; violations are inherent to the adapter role
* runtime ownership visibility — state ownership is fully visible (class fields); infrastructure coupling is explicit

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
