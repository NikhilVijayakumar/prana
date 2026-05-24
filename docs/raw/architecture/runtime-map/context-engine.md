# Feature Runtime Map

> Runtime governance contract for the corresponding feature.
> Part of:
> features → invariants → runtime-map → audit-governance

---

# Metadata

| Field                  | Value                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Feature               | `context-engine-service`                                                                                                                |
| Feature Doc            | `docs/raw/features/context/context-engine.md`                                                                                           |
| Implementation         | `src/main/features/contextEngineService.ts`                                                                                             |
| Runtime Map            | `docs/raw/architecture/runtime-map/context-engine.md`                                                                           |
| Layer                  | `4`                                                                                                                                     |
| Runtime Classification | `Capability Adapter / Runtime Gateway`                                                                                                  |
| Status                 | `⚠️ Transitional`                                                                                                                        |
| Last Reviewed          | `2026-05-21`                                                                                                                            |
| Audit Suites Applied   | `runtime_purity / architectural_integrity / platform_neutrality / runtime_extensibility / runtime_security`                             |

---

# 1. Responsibility

Single runtime responsibility.

One reason to change: the context compaction strategy, token budgeting algorithm, or session lifecycle protocol.

Describe ONLY:

* orchestration responsibility — orchestrates the context compaction lifecycle: token threshold detection → segmentation → summarization via agent → digest persistence → in-memory replacement
* coordination responsibility — coordinates between `tokenManagerService` (token counting/budgeting), `contextOptimizerService` (compaction planning, stage resolution), `summarizationAgentService` (digest generation), `contextDigestStoreService` (persistence), and `syncStoreService` (embedding archival)
* execution boundary responsibility — enforces token-bounded context assembly (head/digest/tail segmentation), compaction lifecycle with multi-level recursive summarization, session carryover protocol for cross-session continuity, and subagent context inheritance

Do NOT describe:

* feature walkthroughs
* UI behavior
* product functionality

---

# 2. Runtime Classification

Select all applicable classifications.

* [ ] Orchestrator
* [ ] Coordinator
* [x] Capability Adapter
* [ ] Persistence Boundary
* [ ] Execution Boundary
* [ ] Lifecycle Manager
* [x] Runtime Gateway
* [ ] Infrastructure Adapter

---

# 3. Ownership Classification

| Ownership Type           | Status                         | Notes |
| ------------------------ | ------------------------------ | ----- |
| State Ownership          | Present                        | Module-level mutable collections: `sessions` (Map), `events` (array), `pendingNewContextPreviews` (Map). Cross-request memory accumulation. |
| Lifecycle Ownership      | Explicit                       | `disposeSession()`, `__resetForTesting()`, `bootstrapSession()`. Fire-and-forget `void` Promise patterns in 8 locations. |
| Infrastructure Ownership | None                           | No direct infrastructure; delegates persistence to store services. |
| Policy Ownership         | Embedded                       | Token budget normalization, compaction thresholds, classification rules, extension allowlists embedded in service. |
| Execution Ownership      | Scoped                         | Per-session context lifecycle; sessions persist in memory until `disposeSession`. |
| Persistence Ownership    | None                           | Delegates raw messages, digests, active context, embeddings to store services. |

---

# 4. State Ownership

## Allowed

* [x] Request-scoped ephemeral variables — function-scoped arrays and accumulators
* [ ] Immutable configuration
* [x] Externalized persistence through contracts — delegates to store services
* [ ] Deterministic execution context
* [ ] Explicit replay-safe execution metadata

## Forbidden

* [x] Mutable class-level state — no class, but module-level mutable arrays and Maps
* [ ] Static mutable fields
* [x] Cross-request memory accumulation — `sessions` Map (line 233) accumulates all active sessions until disposal
* [ ] Hidden runtime caches
* [x] Session retention — sessions held in memory Map; no automatic expiry or eviction
* [ ] Workflow ownership state
* [ ] Runtime-owned mutable registries
* [x] In-memory orchestration history — `events` array (line 135) stores up to 30 recent events in memory

Note: Module-level mutable state is a transitional violation. The `sessions` Map is the primary accumulator — it holds all active context sessions in memory until explicitly disposed. `events` is a bounded rolling buffer (max 30). `pendingNewContextPreviews` holds transient session previews.

---

# 5. Persistence Rules

## Persistence Boundary

Describe:

* allowed persistence contracts — delegates all persistence to `contextDigestStoreService` (raw messages, active context records, digests) and `syncStoreService` (embedding archival via RAG)
* persistence ownership restrictions — does not own any persistence infrastructure; all storage is externalized via service calls
* storage neutrality expectations — expects store services to abstract SQLite details; no direct SQL or filesystem access

---

## Allowed Persistence

* [x] Persistence through capability contracts — delegates to `contextDigestStoreService` and `syncStoreService`
* [x] Externalized storage ownership — all persistence is externalized
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
| Persistence Type | `External`                                  |
| Adapter Layer    | `contextDigestStoreService`, `syncStoreService` |
| Migration Status | N/A                                         |
| Replay Safe      | Yes (delegated; store layer is responsible) |

---

# 6. Dependency Rules

## Allowed Dependencies

* [ ] Capability contracts
* [x] Deterministic utilities — `estimateTokens` delegates to `tokenManagerService.countTextTokens`
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

Imports 5 internal services (`contextOptimizerService`, `contextDigestStoreService`, `summarizationAgentService`, `tokenManagerService`, `syncStoreService`) and 1 cross-module (`registryRuntimeService`). No UI or infrastructure leakage. Cyclic risk exists with `contextDigestStoreService` which may reference context engine types.

---

# 7. Determinism Requirements

Describe:

* ordering guarantees — messages within a session are sequentially ordered; compaction follows deterministic head/digest/tail segmentation via `contextOptimizerService.createCompactionPlan`; messages are processed in insertion order
* concurrency restrictions — no explicit concurrency control; `getOrCreateSession` reads/writes the shared `sessions` Map without locking
* deterministic orchestration requirements — compaction triggers at predictable token thresholds; budget normalization is deterministic given identical inputs
* replay consistency expectations — logical replay is possible (same sequence of messages → same compaction outcome), but UUID-based IDs and timestamps prevent exact replay

---

## Forbidden Nondeterminism

* [ ] Direct `Date.now()`
* [x] Direct randomness — `randomUUID` at lines 144, 226, 414, 510, 538, 774
* [ ] Unstable async ordering
* [ ] Environment branching in orchestration
* [x] Hidden mutable execution state — `sessions`, `events`, `pendingNewContextPreviews` are module-level mutable state
* [ ] Timing-sensitive orchestration

---

# 8. Replayability Requirements

## Replay Classification

* [ ] Fully Replayable
* [x] Replayable with External State — same message sequence produces same compaction outcomes logically; UUIDs differ per run
* [ ] Partial Replayability
* [ ] Non-Replayable

---

## Replay Requirements

Describe:

* event reconstruction expectations — context events (compaction, threshold, hard reset) can be reconstructed from the same message sequence; event IDs (UUID) differ
* replay-safe side effects — persistence to `contextDigestStoreService` and `syncStoreService` is delegated; assumed idempotent
* serialization boundaries — `ContextSessionState`, `ContextMessageEnvelope`, `ContextCompactionResult` are fully serializable
* deterministic replay guarantees — only logical ordering and token-budget calculation are deterministic; UUID generation and timestamps are not

---

## Replay Risks

* [x] Hidden execution state — `sessions` Map holds all active session data in memory
* [ ] Untracked side effects
* [ ] Non-serializable execution context
* [x] Missing event recording — `void` Pattern Promise on persistence calls means errors are silently lost
* [ ] Environment-coupled execution

---

# 9. Lifecycle Ownership

## Allowed Lifecycle Ownership

* [x] Request-scoped execution — per-turn ingestion, compaction, assembly
* [ ] Explicit startup/shutdown contracts — no initialize/close; `bootstrapSession` is the entry point
* [ ] Managed worker ownership
* [ ] Managed scheduler ownership
* [x] Explicit cleanup/disposal — `disposeSession()` and `__resetForTesting()`

---

## Forbidden Lifecycle Ownership

* [ ] Hidden background execution
* [ ] Orphaned timers
* [ ] Unmanaged workers
* [x] Fire-and-forget orchestration — `void persistRawMessage(...)`, `void persistActiveContext(...)` at 8 locations (lines 349, 350, 732, 741, 743, 809, 811, 813)
* [ ] Unbounded retries
* [ ] Hidden listeners/subscriptions

---

## Lifecycle Classification

| Lifecycle Area       | Status |
| -------------------- | ------ |
| Startup Ownership    | Implicit — `bootstrapSession()` creates session on first access |
| Shutdown Governance  | Explicit — `disposeSession()` removes session from memory |
| Cleanup Guarantees   | Explicit — `__resetForTesting()` clears all state |
| Cancellation Support | None — compaction and ingestion cannot be aborted |
| Worker Governance    | None — no worker management |
| Timer Governance     | None — no timers |

---

# 10. Side Effects

## Allowed Side Effects

* [ ] IPC emission
* [x] Capability invocation — `summarizationAgentService.summarize()`, `tokenManagerService.*`
* [x] Explicit persistence through contracts — `contextDigestStoreService.*`, `syncStoreService.upsertEmbedding`
* [x] Deterministic orchestration events — `events` array, `emitEvent`
* [ ] Explicitly governed execution dispatch

---

## Forbidden Side Effects

* [ ] Direct filesystem mutation
* [x] Unmanaged async execution — `void` Promise patterns for persistence (8 locations); errors in these fire-and-forget calls are silently swallowed
* [ ] Arbitrary process spawning
* [ ] Infrastructure mutation
* [ ] Hidden orchestration execution
* [ ] Unbounded network ownership

---

# 11. Host Assumptions

## Runtime Host Compatibility

* [ ] Pure Library
* [x] Node Compatible — uses `node:crypto` (randomUUID), `readFileSync`, `join`
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
| Token Manager | Count text tokens, resolve context window limits | Yes |
| Context Optimizer | Create compaction plan, resolve optimization stage | Yes |
| Summarization Agent | Generate digest summaries from middle messages | Yes |
| Context Digest Store | Persist raw messages, active context, digests, archive sessions | Yes |
| Sync Store | Upsert embeddings for archived messages (RAG) | Yes |

---

## Forbidden Capability Behavior

* [x] Direct implementation imports — all 5 capabilities imported as direct module references
* [ ] Hidden capability ownership
* [ ] Capability mutation leakage
* [ ] Internal adapter bypassing

---

# 13. Extension Surface

## Allowed Extension Points

Describe:

* injectable capabilities — `ContextModelConfig` allows injecting provider/model/contextWindow per session; `ContextTokenBudget` allows injecting token budget overrides
* overridable orchestration points — compaction plan delegated to `contextOptimizerService` (pluggable); summarization delegated to `summarizationAgentService` (pluggable)
* adapter replacement boundaries — `tokenManagerService.resolveContextWindow` abstracts provider-specific limits

---

## Extension Restrictions

* [x] No runtime mutation — services cannot be replaced at runtime
* [ ] No infrastructure ownership escalation
* [ ] No unrestricted execution
* [x] No lifecycle bypassing — session lifecycle managed through `getOrCreateSession`

---

# 14. Security Boundaries

## Security Surface

* [ ] IPC Boundary
* [ ] Storage Boundary
* [ ] Auth Boundary
* [ ] Extension Boundary
* [x] Execution Boundary — token budget enforcement prevents context overflow
* [ ] Network Boundary

---

## Security Restrictions

* [ ] Input validation required — no content validation beyond trimming
* [x] Least privilege enforced — each capability performs only its required operation
* [ ] Capability isolation enforced
* [ ] No plaintext secret ownership
* [x] No unrestricted execution — token budget bounds context usage; max messages enforced after compaction

---

# 15. Compliance Analysis

> Populated from runtime-map analysis.

---

## Runtime Purity

| Invariant     | Status | Score |
| ------------- | ------ | ----- |
| Statelessness | ❌      | 2/10   |
| Determinism   | ❌      | 2/10   |
| Replayability | ⚠️      | 4/10   |
| **Section Score** | **—** | **2.7/10** |

Rationale:
- **Statelessness (1/5):** Module-level mutable collections: `sessions` Map (line 233), `events` array (line 135), `pendingNewContextPreviews` Map (line 136). Cross-request memory accumulation through session lifetime. Major deviation from statelessness invariant.
- **Determinism (1/5):** `randomUUID` used for message IDs, digest IDs, event IDs, and session IDs. `new Date().toISOString()` pervasive via `nowIso()`. Compaction logic itself is deterministic given identical inputs.
- **Replayability (2/5):** Logical replay possible (same messages → same compaction outcome), but UUIDs and timestamps prevent exact replay.

---

## Architectural Integrity

| Invariant            | Status | Score |
| -------------------- | ------ | ----- |
| Boundary Integrity   | ⚠️      | 6/10   |
| Dependency Direction | ⚠️      | 4/10   |
| Lifecycle Safety     | ⚠️      | 4/10   |
| **Section Score** | **—** | **4.7/10** |

Rationale:
- **Boundary Integrity (3/5):** Clear capability boundary (context lifecycle management). Policy contamination (budget normalization, classification rules). Fire-and-forget `void` Promise patterns degrade integrity.
- **Dependency Direction (2/5):** 5 direct internal service imports with no abstraction layer. Cyclic risk with store services.
- **Lifecycle Safety (2/5):** `disposeSession()` exists but fire-and-forget persistence calls lose errors. No initialize/contract. No cancellation support.

---

## Platform Neutrality

| Invariant          | Status | Score |
| ------------------ | ------ | ----- |
| Host Agnosticism   | ⚠️      | 4/10   |
| Storage Neutrality | ✅      | 8/10   |
| Policy Neutrality  | ⚠️      | 4/10   |
| **Section Score** | **—** | **5.3/10** |

Rationale:
- **Host Agnosticism (2/5):** Uses `node:crypto` (randomUUID) and `readFileSync` for metadata loading. Not browser-compatible.
- **Storage Neutrality (4/5):** Fully externalized persistence. No direct SQL or filesystem access for domain data. Only metadata loaded via `readFileSync` from registry.
- **Policy Neutrality (2/5):** Budget normalization logic, compaction thresholds, message limits, and classification rules embedded in the service.

---

## Runtime Extensibility

| Invariant                     | Status | Score |
| ----------------------------- | ------ | ----- |
| Composability                 | ⚠️      | 4/10   |
| Capability Contract Integrity | ⚠️      | 4/10   |
| Extension Safety              | ⚠️      | 4/10   |
| **Section Score** | **—** | **4.0/10** |

Rationale:
- **Composability (2/5):** Some injectable configuration (`ContextModelConfig`, `ContextTokenBudget`). Main services are hard-imported.
- **Capability Contract Integrity (2/5):** Delegates to `contextOptimizerService` and `summarizationAgentService` which are pluggable components. No formal contract abstraction for the engine itself.
- **Extension Safety (2/5):** No runtime mutation. Budget overrides are bounded by `normalizeBudget`. Limited surface area.

---

## Runtime Security

| Security Area            | Status | Score |
| ------------------------ | ------ | ----- |
| Trust Boundary Integrity | ✅      | 6/10   |
| Capability Isolation     | ⚠️      | 4/10   |
| IPC Security             | N/A    | N/A   |
| Storage Security         | N/A    | N/A   |
| Extension Security       | ⚠️      | 4/10   |
| **Section Score** | **—** | **4.7/10** |

Rationale:
- **Trust Boundary Integrity (3/5):** Token budget enforcement provides a trust boundary against context overflow. No input validation on content.
- **Capability Isolation (2/5):** No capability-based isolation. Services are directly imported.
- **Extension Security (2/5):** Budget overrides are clamped by `normalizeBudget`, but no other security controls on extension points.

---
















## Score Summary

| Category                  | Score | Grade |
| ------------------------- | ----- | ----- |
| Runtime Purity            | 2.7/10 | C- |
| Architectural Integrity   | 4.7/10 | C+ |
| Platform Neutrality       | 5.3/10 | B- |
| Runtime Extensibility     | 4.0/10 | C+ |
| Runtime Security          | 4.7/10 | C+ |
| **Grand Total**           | **4.3/10** | **C+** |
| **Relative Score**        | **+2.9** | **A** |

---

# 16. Detection Heuristics Applied


## Statelessness Checks

* [ ] No mutable class-level collections — module-level `events[]`, `sessions` Map, `pendingNewContextPreviews` Map are mutable
* [ ] No static mutable state — N/A
* [ ] No hidden caches — `sessions` Map acts as an in-memory cache
* [ ] No cross-request accumulation — `sessions` Map accumulates across requests

Results: `new Map` at lines 136, 233 (module-level). `[]` at line 135 (module-level). `new Set` at lines 427, 560 (function-scoped, acceptable).

---

## Determinism Checks

* [x] No `Date.now()` — no direct `Date.now()` but `new Date().toISOString()` via `nowIso()`
* [ ] No randomness — `randomUUID` imported from `node:crypto` and used at 6 locations
* [x] Stable ordering enforced — messages processed in insertion order
* [x] No timing-sensitive orchestration — no timers or timeouts

Results: `randomUUID` at lines 1 (import), 144, 226, 414, 510, 538, 774.

---

## Lifecycle Checks

* [x] No unmanaged timers — no `setInterval` or `setTimeout`
* [x] No orphaned listeners — no event listeners
* [x] Explicit cleanup paths exist — `disposeSession()`, `__resetForTesting()`
* [ ] Cancellation supported — no abort mechanism

Results: No `setInterval`, `setTimeout`. `void` Promise/async at 8 locations (fire-and-forget).

---

## Dependency Checks

* [x] No infrastructure imports in runtime core — no `better-sqlite3`, `electron`, or `react`
* [x] No UI framework leakage — none found
* [x] No cyclic dependencies — module imports services but is not imported by them (risk exists)
* [ ] Dependency inversion enforced — all imports are direct

Results: No `better-sqlite3`, `electron`, `react` detected.

---

## Security Checks

* [x] No directly executable code — no `eval` or `exec`
* [x] No unrestricted execution — token budget bounds context assembly
* [x] No plaintext secrets — no secrets handled
* [ ] Capability isolation enforced — no capability isolation layer

Results: No `eval`, `exec`, `spawn`, `child_process` detected.

---

# 17. Architecture Drift

Areas trending toward:

* [x] State accumulation — `sessions` Map accumulates in-memory context indefinitely
* [ ] Infrastructure lock-in
* [ ] Orchestration monolith behavior
* [x] Replayability degradation — UUID-based IDs prevent content-addressable replay
* [x] Lifecycle leakage — `void` Promise fire-and-forget patterns lose error visibility
* [ ] Host coupling
* [x] Policy contamination — budget normalization, compaction thresholds, classification rules embedded
* [ ] Capability collapse

---

# 18. Transitional Violations

Known technical debt.

| Violation | Impact | Migration Direction | Removal Target |
| --------- | ------ | ------------------- | -------------- |
| Module-level `sessions` Map | Cross-request memory accumulation; no eviction or expiry | Move session state to external store with TTL; keep only hot cache in memory | TBD |
| `void` Promise fire-and-forget (8 locations) | Persistence errors silently lost; no retry; no audit trail | Await all persistence calls or add error logging + retry queue | TBD |
| `randomUUID` for IDs | Nondeterministic; prevents content-addressable references | Hash-based IDs for messages/digests; UUID only for session IDs | TBD |
| No cancellation support | Long-running compaction cannot be aborted | Add AbortSignal to `ingest`, `compact`, `enforceOptimizationLifecycle` | TBD |
| `events` in-memory buffer | Events lost on restart; memory pressure with high event volume | Persistent event log via store service; bounded in-memory cache | TBD |

---

# 19. Planned Deprecations

Future removals and migrations.

| Area | Deprecation | Planned Version |
| ---- | ----------- | --------------- |
| In-memory session storage | Migrate to persistent session store with hot cache | TBD |

---

# 20. Verification Commands

## Statelessness Verification

```bash
grep -r "private.*=" src/main/features/contextEngineService.ts | grep -v "readonly"
```

```bash
grep -r "new Map\|new Set\|\[\]" src/main/features/contextEngineService.ts
```

---

## Determinism Verification

```bash
grep -r "Date.now\|Math.random\|randomUUID" src/main/features/contextEngineService.ts
```

---

## Lifecycle Verification

```bash
grep -r "setInterval\|setTimeout" src/main/features/contextEngineService.ts
```

```bash
grep -r "void .*Promise\|void .*async" src/main/features/contextEngineService.ts
```

---

## Dependency Verification

```bash
grep -r "better-sqlite3\|electron\|react" src/main/features/contextEngineService.ts
```

---

## Security Verification

```bash
grep -r "eval\|exec\|spawn\|child_process" src/main/features/contextEngineService.ts
```

---

# 21. Confidence

* [ ] High
* [x] Medium
* [ ] Low

Confidence reflects:

* implementation clarity — well-organized with clear lifecycle (bootstrap → ingest → compact → assemble → dispose), but module-level state obscures ownership
* architectural evidence quality — capability boundary is clear; state ownership violations are visible and documented; fire-and-forget patterns are explicit
* runtime ownership visibility — module-level mutable state is visible at the top of the file; session lifecycle is managed but unload/eviction is missing

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
