# Feature Runtime Map

> Runtime governance contract for the corresponding feature.
> Part of:
> features → invariants → runtime-map → audit-governance

---

# Metadata

| Field                  | Value                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Feature               | `vault-service`                                                                                                                         |
| Feature Doc            | `docs/raw/features/storage/vault.md`                                                                                                    |
| Implementation         | `src/main/features/vaultService.ts`                                                                                                     |
| Runtime Map            | `docs/raw/architecture/runtime-map/vault.md`                                                                                    |
| Layer                  | `2`                                                                                                                                     |
| Runtime Classification | `Persistence Boundary / Infrastructure Adapter`                                                                                         |
| Status                 | `✅ Compliant`                                                                                                                           |
| Last Reviewed          | `2026-05-21`                                                                                                                            |
| Audit Suites Applied   | `runtime_purity / architectural_integrity / platform_neutrality / runtime_extensibility / runtime_security`                             |

---

# 1. Responsibility

Single runtime responsibility.

One reason to change: the vault archive format, encryption protocol, or git-based publishing workflow.

Describe ONLY:

* orchestration responsibility — none; does not orchestrate other services
* coordination responsibility — coordinates vault workspace lifecycle via `withVaultWorkspace` wrapper (drive session → vault store → operation → cleanup), and coordinates git-based publishing workflow (stash → commit → push → pop-stash)
* execution boundary responsibility — provides the persistence boundary for encrypted vault archive operations: file ingestion with schema validation, AES-256-GCM encrypted envelope archive creation/extraction, git-based publish/sync workflow to governance repository, and path-traversal-safe file access within the vault workspace

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
| State Ownership          | None                           | Module-level `const` definitions are immutable. All mutable state (arrays, counters) is function-scoped. Singleton object (`vaultService`) has no mutable fields. |
| Lifecycle Ownership      | Explicit                       | `initializeVault()` / `cleanupTemporaryWorkspace()`; `withVaultWorkspace` enforces try/finally cleanup. |
| Infrastructure Ownership | Direct                         | Direct filesystem I/O (`node:fs`), git operations via `executeCommand`, cryptography via `node:crypto`. |
| Policy Ownership         | Embedded                       | Schema validation rules, data classification logic (`classifyData`), file extension allowlist are encoded in the service. |
| Execution Ownership      | Scoped                         | Each public method wraps work in `withVaultWorkspace` which scopes execution to a drive session. |
| Persistence Ownership    | Direct                         | Owns the encrypted vault archive format, working directory layout, index file, and git publishing. |

---

# 4. State Ownership

## Allowed

* [x] Request-scoped ephemeral variables — function-scoped arrays (`allFiles`, `files`, `nodes`, `pending`)
* [ ] Immutable configuration
* [ ] Externalized persistence through contracts
* [ ] Deterministic execution context
* [ ] Explicit replay-safe execution metadata

## Forbidden

* [ ] Mutable class-level state — no class; singleton object has no mutable fields
* [ ] Static mutable fields
* [ ] Cross-request memory accumulation
* [ ] Hidden runtime caches
* [ ] Session retention
* [ ] Workflow ownership state
* [ ] Runtime-owned mutable registries
* [ ] In-memory orchestration history

Note: All mutable state is function-scoped. The module-level singleton (`vaultService`) is an object literal with method references only — no mutable fields. This satisfies statelessness requirements.

---

# 5. Persistence Rules

## Persistence Boundary

Describe:

* allowed persistence contracts — delegates to `vaultRegistryService`, `vaultMetadataService`, `syncStoreService` for registry/metadata persistence; uses `driveControllerService` for vault drive session management
* persistence ownership restrictions — owns the vault working directory, encrypted archive format, index file (`vault_index.json`), and schema validation config; does not own the governance repository (delegated to `governanceRepoService`)
* storage neutrality expectations — not storage-neutral; explicitly coupled to local filesystem, git repositories, and AES-256-GCM encrypted JSON envelope format

---

## Allowed Persistence

* [ ] Persistence through capability contracts
* [x] Externalized storage ownership — archive files written to `driveControllerService.getVaultArchiveRoot()`
* [ ] Replay-safe persistence
* [ ] Deterministic persistence sequencing

---

## Forbidden Persistence

* [x] Direct infrastructure ownership — direct filesystem writes via `writeFile`, `mkdir`, `rm`, `copyFile`, `rename`
* [x] Hardcoded filesystem paths — paths derived from `getAppDataRoot()` and `getRuntimeVaultConfig()` but still coupled to local filesystem
* [x] Vendor-specific persistence logic — git CLI executed directly via `executeCommand`; AES-256-GCM envelope format is custom
* [ ] Hidden storage mutation
* [ ] Runtime-owned storage topology

---

## Current Persistence Implementation

| Category         | Value                                       |
| ---------------- | ------------------------------------------- |
| Persistence Type | `External` (filesystem + encrypted JSON envelopes + git) |
| Adapter Layer    | `driveControllerService` for drive session management |
| Migration Status | N/A                                         |
| Replay Safe      | No                                          |

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
| Infrastructure Leakage | Present                  |
| Framework Leakage      | None                     |

Imports `node:crypto`, `node:fs`, `node:path`, and 7 internal services (`driveControllerService`, `processService`, `governanceRepoService`, `runtimeConfigService`, `hookSystemService`, `memoryIndexService`, `vaultMetadataService`, `vaultRegistryService`, `syncStoreService`). Direct git CLI execution via `processService.executeCommand`. Cyclic risk exists because `governanceRepoService` is both imported and provides path utilities.

---

# 7. Determinism Requirements

Describe:

* ordering guarantees — operations within `withVaultWorkspace` run sequentially; archive build collects files recursively then encrypts; git operations are sequential (stash → commit → push → pop-stash)
* concurrency restrictions — no concurrent access protection beyond `withVaultWorkspace` serialization
* deterministic orchestration requirements — none
* replay consistency expectations — not replayable; nondeterministic components include file timestamps, `Date.now()` labels, `randomBytes` IVs, `randomUUID` IDs, and filesystem state

---

## Forbidden Nondeterminism

* [x] Direct `Date.now()` — lines 401, 683, 913 (stash labels, snapshot names, file timestamps)
* [x] Direct randomness — `randomBytes` (IV), `randomUUID` (file IDs)
* [ ] Unstable async ordering
* [ ] Environment branching in orchestration
* [ ] Hidden mutable execution state
* [x] Timing-sensitive orchestration — `executeCommand` timeout values (20s-60s) introduce timing sensitivity

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

* event reconstruction expectations — none; this is a persistence infrastructure service
* replay-safe side effects — filesystem writes, git pushes, and encryption IVs are fundamentally non-replayable
* serialization boundaries — `VaultArchivePayload` and `VaultArchiveEnvelope` are serializable JSON structures
* deterministic replay guarantees — no guarantees; timestamps, UUIDs, IVs, and git remote state prevent deterministic replay

---

## Replay Risks

* [ ] Hidden execution state
* [x] Untracked side effects — filesystem mutations and git operations are not tracked by this service
* [ ] Non-serializable execution context
* [ ] Missing event recording
* [x] Environment-coupled execution — git binary, filesystem, governance repository remote

---

# 9. Lifecycle Ownership

## Allowed Lifecycle Ownership

* [x] Request-scoped execution — `withVaultWorkspace` wraps each public method
* [x] Explicit startup/shutdown contracts — `initializeVault()` / `cleanupTemporaryWorkspace()`
* [ ] Managed worker ownership
* [ ] Managed scheduler ownership
* [x] Explicit cleanup/disposal — `withVaultWorkspace` uses `try/finally` pattern to ensure cleanup

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
| Startup Ownership    | Explicit — `initializeVault()` called by startup orchestrator |
| Shutdown Governance  | Explicit — `cleanupTemporaryWorkspace(force)` for tear-down |
| Cleanup Guarantees   | Explicit — `withVaultWorkspace` guarantees cleanup in `finally` block |
| Cancellation Support | None — no abort signal support |
| Worker Governance    | None — no worker management |
| Timer Governance     | None — no timers |

---

# 10. Side Effects

## Allowed Side Effects

* [ ] IPC emission
* [x] Capability invocation — `hookSystemService.emit` for `schedule.tick`, `vault.ingested`, `vault.pending.approved`, `vault.pending.rejected`
* [x] Explicit persistence through contracts — filesystem writes, git operations
* [ ] Deterministic orchestration events
* [x] Explicitly governed execution dispatch — `withVaultWorkspace` scopes all operations

---

## Forbidden Side Effects

* [x] Direct filesystem mutation — `writeFile`, `mkdir`, `rm`, `rename`, `copyFile` called directly
* [ ] Unmanaged async execution
* [x] Arbitrary process spawning — `executeCommand('git', ...)` spawns git CLI processes
* [ ] Infrastructure mutation
* [ ] Hidden orchestration execution
* [ ] Unbounded network ownership — git push/pull are network operations

---

# 11. Host Assumptions

## Runtime Host Compatibility

* [ ] Pure Library
* [x] Node Compatible — requires `node:fs`, `node:crypto`, `node:path`, git CLI binary
* [ ] Electron Compatible
* [ ] Browser Compatible
* [ ] Host Agnostic

---

## Forbidden Host Coupling

* [ ] Electron-owned orchestration
* [ ] DOM usage inside runtime core
* [x] OS-specific orchestration branching — `executeCommand` for git assumes POSIX or Windows git CLI available
* [ ] Direct host lifecycle ownership

---

# 12. Capability Contracts

## Required Capabilities

List ONLY explicit contracts.

| Capability | Purpose | Required |
| ---------- | ------- | -------- |
| Drive Controller | Manage vault drive session lifecycle | Yes |
| Process Execution | Run git CLI commands (status, add, commit, push, pull, stash) | Yes |
| Governance Repo | Resolve repo path, URL, app data root | Yes |
| Runtime Config | Access vault config (password, salt, kdf iterations, spec version) | Yes |
| Hook System | Emit vault lifecycle events | Yes |
| Memory Index | Refresh memory index after file operations | Yes |
| Vault Metadata | Ensure and read app metadata | Yes |
| Vault Registry | Ensure app registration | Yes |
| Sync Store | Maintain app registry and vault blueprint | Yes |

---

## Forbidden Capability Behavior

* [x] Direct implementation imports — all 7 services imported as direct module references
* [ ] Hidden capability ownership
* [ ] Capability mutation leakage
* [ ] Internal adapter bypassing

---

# 13. Extension Surface

## Allowed Extension Points

Describe:

* injectable capabilities — none; all dependencies are hard-imported
* overridable orchestration points — `vaultConfig` from runtime config controls behavior (keepTempOnClose, outputPrefix, specVersion)
* adapter replacement boundaries — none; git CLI is embedded via `executeCommand`; no interface for alternative vault backends

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
* [x] Storage Boundary — encrypted vault archive management, path traversal protection
* [ ] Auth Boundary
* [ ] Extension Boundary
* [ ] Execution Boundary
* [x] Network Boundary — git push/pull to governance repository remote

---

## Security Restrictions

* [x] Input validation required — `assertVaultRelativePath` validates relative path within workspace; `isPathInsideRoot` prevents path traversal
* [x] Least privilege enforced — git operations scoped to governance repo; no global git access
* [ ] Capability isolation enforced
* [x] No plaintext secret ownership — vault key derived via PBKDF2 from config; never stored
* [x] No unrestricted execution — `executeCommand` has timeout bounds; git commands are fixed

---

# 15. Compliance Analysis

> Populated from runtime-map analysis.

---

## Runtime Purity

| Invariant     | Status | Score |
| ------------- | ------ | ----- |
| Statelessness | ✅      | 8/10   |
| Determinism   | ❌      | 2/10   |
| Replayability | ❌      | 2/10   |
| **Section Score** | **—** | **4.0/10** |

Rationale:
- **Statelessness (4/5):** No class-level state. All mutable state is function-scoped. Singleton object has no mutable fields. Module-level `const` definitions are immutable. Only deduction for module-level singleton pattern.
- **Determinism (1/5):** Heavy use of `Date.now()`, `randomBytes`, `randomUUID`, `new Date().toISOString()`, and filesystem I/O. No deterministic execution path.
- **Replayability (1/5):** Non-replayable. Encryption IVs, timestamps, file IDs, git state, and filesystem state prevent any form of replay.

---

## Architectural Integrity

| Invariant            | Status | Score |
| -------------------- | ------ | ----- |
| Boundary Integrity   | ✅      | 8/10   |
| Dependency Direction | ⚠️      | 4/10   |
| Lifecycle Safety     | ✅      | 8/10   |
| **Section Score** | **—** | **6.7/10** |

Rationale:
- **Boundary Integrity (4/5):** Clear persistence boundary with encrypted envelope format. Path traversal protection. Single responsibility for vault archive management. Some policy contamination (schema validation, data classification).
- **Dependency Direction (2/5):** 7 direct internal service imports, 3 standard library imports, 1 cross-module import. No dependency inversion. Cyclic risk with `governanceRepoService`.
- **Lifecycle Safety (4/5):** `withVaultWorkspace` enforces cleanup via `try/finally`. Explicit initialize/cleanup methods. No timers or orphaned resources.

---

## Platform Neutrality

| Invariant          | Status | Score |
| ------------------ | ------ | ----- |
| Host Agnosticism   | ❌      | 2/10   |
| Storage Neutrality | ❌      | 2/10   |
| Policy Neutrality  | ⚠️      | 4/10   |
| **Section Score** | **—** | **2.7/10** |

Rationale:
- **Host Agnosticism (1/5):** Tightly coupled to Node.js (`node:fs`, `node:crypto`, `node:path`) and git CLI binary.
- **Storage Neutrality (1/5):** Explicitly coupled to local filesystem, JSON envelope format, and git-based publishing.
- **Policy Neutrality (2/5):** Schema validation rules, classification logic, and file extension allowlist are embedded in the service.

---

## Runtime Extensibility

| Invariant                     | Status | Score |
| ----------------------------- | ------ | ----- |
| Composability                 | ❌      | 2/10   |
| Capability Contract Integrity | ⚠️      | 4/10   |
| Extension Safety              | N/A    | N/A   |
| **Section Score** | **—** | **3.0/10** |

Rationale:
- **Composability (1/5):** Singleton object pattern with hard-imported dependencies. Cannot be replaced or mocked without module-level patching.
- **Capability Contract Integrity (2/5):** Delegates to service contracts (registry, metadata, sync store), but imports are direct. No formal contract abstraction.
- **Extension Safety:** N/A — no extension surface.

---

## Runtime Security

| Security Area            | Status | Score |
| ------------------------ | ------ | ----- |
| Trust Boundary Integrity | ✅      | 8/10   |
| Capability Isolation     | ⚠️      | 4/10   |
| IPC Security             | N/A    | N/A   |
| Storage Security         | ✅      | 10/10   |
| Extension Security       | N/A    | N/A   |
| **Section Score** | **—** | **7.3/10** |

Rationale:
- **Trust Boundary Integrity (4/5):** Strong path traversal protection (`isPathInsideRoot`, `assertVaultRelativePath`). Git origin verification before publish. AES-256-GCM encrypted envelopes.
- **Capability Isolation (2/5):** No capability-based isolation. Direct access to filesystem and git.
- **Storage Security (5/5):** AES-256-GCM with AAD (Additional Authenticated Data). PBKDF2 key derivation. Magic bytes validation. Envelope format prevents trivial tampering.
- **Extension Security:** N/A.

---









## Score Summary

| Category                  | Score | Grade |
| ------------------------- | ----- | ----- |
| Runtime Purity            | 4.0/10 | C+ |
| Architectural Integrity   | 6.7/10 | B |
| Platform Neutrality       | 2.7/10 | C- |
| Runtime Extensibility     | 3.0/10 | C |
| Runtime Security          | 7.3/10 | B+ |
| **Grand Total**           | **4.7/10** | **C+** |
| **Relative Score**        | **-1.9** | **F** |

---

# 16. Detection Heuristics Applied


## Statelessness Checks

* [x] No mutable class-level collections — no class; singleton object has no mutable fields
* [x] No static mutable state — no static fields
* [x] No hidden caches — none found
* [x] No cross-request accumulation — all mutable state is function-scoped

Results: `grep -r "private.*="` — none found (no class). `grep -r "new Map\|new Set\|\[\]"` — `[]` found in type annotations and function-scoped array allocations only (acceptable).

---

## Determinism Checks

* [ ] No `Date.now()` — found at lines 401, 683, 913
* [ ] No randomness — `randomBytes` imported, `randomUUID` imported and used at line 938
* [ ] Stable ordering enforced — operations within `withVaultWorkspace` are sequential
* [ ] No timing-sensitive orchestration — `executeCommand` timeouts (20-60s) are timing-sensitive

Results: `Date.now()` at 3 locations. `randomUUID` at 1 location. `randomBytes` imported. `new Date().toISOString()` at 6 locations.

---

## Lifecycle Checks

* [x] No unmanaged timers — no `setInterval` or `setTimeout`
* [x] No orphaned listeners — no event listeners
* [x] Explicit cleanup paths exist — `withVaultWorkspace` try/finally, `cleanupTemporaryWorkspace`
* [ ] Cancellation supported — no abort mechanism

Results: No `setInterval`, `setTimeout`, or `void Promise/async` detected.

---

## Dependency Checks

* [x] No infrastructure imports in runtime core — no `better-sqlite3`, `electron`, or `react`
* [x] No UI framework leakage — none found
* [ ] No cyclic dependencies — possible cycle with `governanceRepoService`
* [ ] Dependency inversion enforced — all imports are direct

Results: No `better-sqlite3`, `electron`, `react`. `node:crypto`, `node:fs`, `node:path` are standard lib.

---

## Security Checks

* [ ] No directly executable code — `executeCommand` spawns git as child process
* [x] No unrestricted execution — git commands are fixed strings; no arbitrary command injection
* [x] No plaintext secrets — vault key derived via PBKDF2
* [x] Path traversal protection — `isPathInsideRoot` and `assertVaultRelativePath` enforce workspace boundary

Results: `executeCommand` detected (11 calls) — invokes `git` with fixed arguments. No `eval`, `exec`, `spawn`, `child_process` directly.

---

# 17. Architecture Drift

Areas trending toward:

* [ ] State accumulation
* [x] Infrastructure lock-in — git CLI dependency, custom encrypted envelope format, filesystem coupling
* [ ] Orchestration monolith behavior
* [ ] Replayability degradation
* [ ] Lifecycle leakage
* [x] Host coupling — Node.js modules, git binary
* [x] Policy contamination — schema validation, data classification, file extension rules embedded in service
* [ ] Capability collapse

---

# 18. Transitional Violations

Known technical debt.

| Violation | Impact | Migration Direction | Removal Target |
| --------- | ------ | ------------------- | -------------- |
| `randomUUID` for file IDs | Nondeterministic; prevents content-addressable file identification | Use content hash (SHA-256 of file contents) instead of random IDs | TBD |
| `Date.now()` for timestamps | Nondeterministic; prevents replay | Accept for audit timestamps (non-replayable context) or inject time provider | TBD |
| `executeCommand` for git | External process dependency; OS coupling | Replace with `isomorphic-git` or libgit2 bindings for pure-JS git operations | TBD |
| No cancellation support | Long-running publish/sync operations cannot be aborted | Add AbortSignal to public methods | TBD |
| Policy embedding | Schema validation, classification, extension allowlist hardcoded | Extract to injectable policy contracts | TBD |

---

# 19. Planned Deprecations

Future removals and migrations.

| Area | Deprecation | Planned Version |
| ---- | ----------- | --------------- |
| Legacy magic bytes (`DHI_VAULT_V1`) | Backward compatibility for old vault archives | TBD |

---

# 20. Verification Commands

## Statelessness Verification

```bash
grep -r "private.*=" src/main/features/vaultService.ts | grep -v "readonly"
```

```bash
grep -r "new Map\|new Set\|\[\]" src/main/features/vaultService.ts
```

---

## Determinism Verification

```bash
grep -r "Date.now\|Math.random\|randomUUID" src/main/features/vaultService.ts
```

---

## Lifecycle Verification

```bash
grep -r "setInterval\|setTimeout" src/main/features/vaultService.ts
```

```bash
grep -r "void .*Promise\|void .*async" src/main/features/vaultService.ts
```

---

## Dependency Verification

```bash
grep -r "better-sqlite3\|electron\|react" src/main/features/vaultService.ts
```

---

## Security Verification

```bash
grep -r "eval\|exec\|spawn\|child_process" src/main/features/vaultService.ts
```

---

# 21. Confidence

* [ ] High
* [x] Medium
* [ ] Low

Confidence reflects:

* implementation clarity — well-organized with clear separation of concerns; 962 lines but logically grouped
* architectural evidence quality — strong security patterns (encryption, path traversal protection); heavy nondeterminism and infrastructure coupling are clear from code
* runtime ownership visibility — singleton pattern makes state ownership visible; dependency ownership is visible but not abstracted

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
