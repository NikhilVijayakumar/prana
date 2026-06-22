# Feature: Secure Persistence & Data Lifecycle

**Version:** 2.0.0
**Status:** Stable / Core
**Capability:** Three-layer persistence architecture providing hot operational caching (SQLite), durable encrypted archiving (Vault Registry), and deterministic reconciliation between layers (Sync Engine).

---

## 1. Tactical Purpose

Prana's persistence system is a three-layer architecture:

```text
SQLite Cache (Hot Layer)
        ↕ Sync Engine (Reconciliation)
Vault Registry & Archive (Cold Layer)
```

Each layer has a distinct role:

* **SQLite Cache** — hot operational state; the single runtime access surface for all services and modules
* **Vault Registry & Archive** — durable encrypted archive; structural integrity source of truth; never accessed directly during runtime
* **Sync Engine** — the only authorized mutator between layers; enforces all governance rules and conflict resolution

---

## 2. System Invariants (Critical)

1. **Single Runtime Access Surface**
   SQLite is the only persistence surface accessible during runtime operation. Vault data is projected into SQLite on startup and flushed back on shutdown.

2. **Vault Access Only Through Sync**
   No service accesses Vault directly during operation.

3. **Mirror Constraint**
   At sync completion, Cache and Vault MUST represent equivalent logical structure.

4. **Deterministic Sync Execution**
   Same input state MUST produce identical sync outcomes.

5. **Idempotent Sync**
   Re-running the same sync MUST NOT produce duplicate or inconsistent state.

6. **Atomic Per-Domain Sync**
   Each domain sync MUST either fully succeed or fail without partial visibility.

7. **Audit Completeness**
   Every sync decision MUST be recorded with traceable metadata.

8. **Registry Structural Authority**
   Tier 2 (App Metadata) is the sole source for structure derivation. Tier 1 (Global Registry) is derived from Tier 2.

---

## 3. SQLite Cache — Hot Operational Layer

### 3.1 Purpose

The SQLite Cache is the **centralized operational runtime state store**. It is NOT merely a cache — it is the operational execution substrate. All runtime modules, host services, and features read and write exclusively through SQLite during operation.

It provides:
* app-scoped operational caching with schema delegation to consuming applications
* high-concurrency concurrent access (Write-Ahead Logging)
* runtime hydration substrate for stateless modules
* single consistent access surface for Vault-projected data

### 3.2 Responsibilities

| Responsibility | Owner |
| -------------- | ----- |
| Connection lifecycle (open, close, WAL configuration) | Prana |
| Storage path resolution (filesystem routing) | Prana |
| Concurrent access management (WAL mode) | Prana |
| Schema definition | Consuming application |
| Table migrations | Consuming application |
| Domain data lifecycle | Consuming application |

### 3.3 Non-Responsibilities

* Prana does NOT define built-in tables for consuming apps
* Prana does NOT manage migrations
* Prana does NOT encrypt cache data (Vault handles encryption at the cold layer)
* Prana does NOT own domain data — it is entirely delegated to consuming apps

### 3.4 Cache Model

Applications share or isolate data based on the `cacheName` they provide during initialization.

**Concurrency model:** SQLite WAL mode allows multiple applications to read and write to a shared cache concurrently without locking.

**Unencrypted by design:** Caches are stored unencrypted for runtime speed. All durable and sensitive data lives in the Vault cold layer.

### 3.5 Cache States

| State | Description |
| ----- | ----------- |
| UNINITIALIZED | Cache file does not exist or has not been opened |
| READY | Connection established, WAL active, schema injected |
| DEGRADED | Connection active but schema injection incomplete or migration pending |
| ERROR | Connection failure, WAL corruption, disk access failure |

### 3.6 Cache Workflows

**Initialization workflow:**
1. Application provides cache name
2. Prana resolves storage path deterministically
3. Prana opens SQLite connection with WAL mode enabled
4. Application injects its schema (table definitions)
5. Cache enters READY state

**Concurrent access workflow:**
1. Multiple apps open connections to same cache file
2. WAL mode serializes writes, parallelizes reads
3. Each app operates on its own tables
4. No cross-app schema conflicts (app-scoped table naming enforced by convention)

**Teardown workflow:**
1. Runtime module shutdown initiated
2. Pending writes flushed
3. Connection closed
4. Cache file remains on disk for next session

### 3.7 Failure Modes

| Scenario | Behavior | Recovery |
| -------- | -------- | -------- |
| Cache file locked by another process | Block until lock released or timeout | Retry with backoff |
| WAL mode initialization failure | Enter ERROR state | Restart connection |
| Schema injection conflict | Reject schema, surface error to app | App resolves schema conflict |
| Disk space exhaustion | Block writes, emit Vaidyar signal | Free disk space |
| Corrupt DB file | Enter ERROR state | Restore from Vault projection |
| Concurrent write conflict | WAL serializes automatically | No action required |

### 3.8 Edge Cases

* **Shared cache file across apps** — apps must use non-conflicting table names; no enforcement at Prana level
* **Empty schema injection** — READY state achieved but no queryable tables; consuming app responsibility
* **Large dataset** — no pagination at cache layer; consuming app must limit query scope
* **Missing schema before query** — undefined behavior; consuming app MUST inject schema before querying

---

## 4. Vault Registry & Archive — Cold Durable Layer

### 4.1 Purpose

The **Global Vault Registry & Metadata Protocol** provides a deterministic, globally consistent registry for discovering, validating, and reconciling application presence and structure within the Cold-Vault.

It maintains a **two-tier metadata system**:
* **Tier 1 (Global Registry)** — central discovery index for all registered applications
* **Tier 2 (App Metadata)** — app-specific structural definition

### 4.2 Non-Responsibilities

* Does not store business data — only metadata
* Does not replace app-level metadata (Tier 2 is the source for domain-level structure)
* Does not perform sync writes — delegates to Sync Engine
* Does not resolve domain conflicts — detects structural divergence only

### 4.3 Metadata Hierarchy

**Tier 1: Global Registry (`vault/global.metadata.json`)**

Central discovery index containing:
* registered applications list
* each app's root path, structure hash, mode, status

**Tier 2: App Metadata (`vault/<app-name>/.metadata.json`)**

App-specific structural definition containing:
* domain keys
* folder mappings
* versioning metadata
* sync-relevant structure

**Consistency Rules:**
* Tier 1 must reflect existence of every Vault-enabled app
* Tier 2 must reflect actual folder structure
* `structure_hash` must be derived deterministically from Tier 2 structure and change only when structure changes

### 4.4 Registry States

| State | Description |
| ----- | ----------- |
| INITIALIZED | Registry loaded into memory |
| CONSISTENT | Tier 1 and Tier 2 aligned |
| DESYNC | Structural mismatch detected |
| LOCKED | Registry being updated |
| FAILED | Registry unreadable or corrupted |

**Recovery paths:**
* DESYNC → trigger reconciliation
* LOCKED → wait for update completion; if interrupted, enter DESYNC on next verification
* FAILED → escalate to Vaidyar; attempt rebuild from Tier 2

### 4.5 Lifecycle Flow

1. **Bootstrap** — Startup Orchestrator loads `global.metadata.json`; registry enters INITIALIZED
2. **Verification** — host app `app_key` validated against registry; SQLite `app_registry` cross-checked
3. **Reconciliation** — compare Tier 2 metadata with Tier 1 fingerprint; detect mismatches
4. **Update Phase** — Tier 2 updated first, then Tier 1 updated with new `structure_hash`
5. **Operational Use** — registry serves as lookup index for all Vault operations

### 4.6 Registry Update Contract

**Update order (strict):**

```text
Tier 2 (App Metadata)
   ↓
Structure Hash Recalculation
   ↓
Tier 1 (Global Registry Update)
```

**Atomicity guarantee:**
* Updates must be atomic at file level and failure-safe (no partial writes)
* If Tier 1 update fails → system enters DESYNC; recovery required before next sync

**Idempotency:**
* Re-applying the same structure must not duplicate entries or alter hash unnecessarily

### 4.7 Concurrency & Locking Model

* `global.metadata.json` requires exclusive write lock and shared read access
* Only one process may modify Tier 1 at a time
* Concurrent reads allowed
* Writes must acquire lock and release after commit
* If lock acquisition fails → retry with backoff strategy or abort

### 4.8 Consistency & Validation Checks

Before any Vault operation:

| Check | Action |
| ----- | ------ |
| App exists in Tier 1 | Required |
| App exists in SQLite `app_registry` | Required |
| Tier 2 file exists | Required |
| `structure_hash` matches computed value | Required |

**Allowed state actions:**

| State | Action |
| ----- | ------ |
| CONSISTENT | Proceed |
| DESYNC | Trigger reconciliation |
| UNKNOWN_APP | Block Vault access |
| CORRUPTED | Escalate to Vaidyar |

### 4.9 Data Ownership Model

| Artifact | Owner | Responsibility |
| -------- | ----- | -------------- |
| Global Registry (Tier 1) | Registry Service | Discovery + indexing |
| App Metadata (Tier 2) | Vault Metadata Service | Structural definition |
| SQLite `app_registry` | Cache Layer | Runtime app identity |

### 4.10 Integration Constraints

* Vault mount must not proceed if app is not present in Tier 1
* Sync engine must validate registry before Vault writes
* SQLite must align with Tier 1 entries

### 4.11 Failure Modes

| Scenario | Behavior | Recovery |
| -------- | -------- | -------- |
| Missing Tier 1 | Block startup or rebuild | Reconstruct from Tier 2 |
| Missing Tier 2 | Mark app invalid | Restore from backup |
| Hash mismatch | Enter DESYNC | Recompute + update |
| Partial write | Mark registry corrupted | Rollback or rebuild |
| Lock contention | Retry | Backoff strategy |

### 4.12 Known Architectural Gaps

| Area | Gap | Impact |
| ---- | --- | ------ |
| Registry Desync | No automatic reconciliation loop | High |
| Locking Mechanism | Lock file strategy not formalized | High |
| App Deletion | No atomic "retire app" workflow | High |
| Partial Write Protection | No journaling or temp-write strategy | Medium |
| Registry Scaling | No sharding strategy for large app counts | Low |
| Versioning | No schema/version migration strategy for metadata | Medium |

---

## 5. Sync Engine — Reconciliation Layer

### 5.1 Purpose

The **Sync Engine** is the **data consistency authority** and the **only authorized mutator** between the SQLite Cache and Vault Archive.

It ensures:
* Cache and Vault remain structurally and semantically aligned
* All synchronization is deterministic and reproducible
* Conflicts are resolved via explicit arbitration rules
* Every operation is auditable and recoverable

### 5.2 Non-Responsibilities

* Sync Engine does not own business logic — it operates on domain keys and data shapes
* Sync Engine does not access Vault registry directly — validates via registry contract
* Sync Engine does not define conflict rules for domain-level semantics — only structural and data-level arbitration

### 5.3 Directional Flows

```text
CACHE → VAULT   (Write-Back)
VAULT → CACHE   (Hydration / Recovery)
```

### 5.4 Domain-Based Execution

Sync operates at `domain_key` granularity. Each domain is independently validated and independently committed.

### 5.5 Sync Pipeline

```text
PRE-FLIGHT → HANDSHAKE → DRIFT_RESOLUTION → TRANSFER → VERIFY → COMMIT → AUDIT
```

**Pre-Flight Validation:** Validate app_id, domain_key, mount status, Vaidyar health. No sync if system in BLOCKED_SECURITY.

**Structural Handshake:** Load Cache Blueprint and Vault Metadata. Compute structure hash and path consistency.

**Drift Resolution:**

| Condition | Strategy |
| --------- | -------- |
| First-time sync | CACHE_WINS |
| Remote divergence | VAULT_WINS |
| Explicit publish | CACHE_WINS |
| Recovery mode | VAULT_WINS |

**Data Transfer (Cache → Vault):** Extract staged data → validate schema compliance → transform to file structure → encrypt → write.

**Data Transfer (Vault → Cache):** Read encrypted files → decrypt → normalize to relational schema → upsert into SQLite.

**Post-Transfer Verification:** Validate checksum equality and structure integrity. Recompute domain hash.

**Commit Phase:** Mark sync SUCCESS. Update `last_synced_at` and domain version.

**Audit Logging:** Persist direction, resolution strategy, affected domains, duration, outcome.

### 5.6 Sync States

| State | Description |
| ----- | ----------- |
| PENDING | Sync queued, not started |
| RUNNING | Active sync pipeline executing |
| SUCCESS | All domains synced and committed |
| FAILED | One or more domains failed; see audit log |

### 5.7 Sync Modes

| Mode | Behavior |
| ---- | -------- |
| Manual | Full validation, blocking |
| Scheduled | Background, non-blocking |
| Startup Hydration | Vault priority |
| Recovery | Vault enforced |
| Incremental *(planned)* | Diff-based sync |
| Dry Run *(planned)* | Validation-only, no mutation |

### 5.8 Conflict Detection & Arbitration

**Conflict Types:**

```text
STRUCTURAL_CONFLICT
DATA_CONFLICT
VERSION_CONFLICT
SCHEMA_CONFLICT
```

**Conflict Resolution Matrix:**

| Conflict Type | Resolution Strategy |
| ------------- | ------------------- |
| Structural mismatch | Vault Wins |
| Data divergence | Timestamp-based |
| Schema mismatch | Block + Require Fix |
| Version conflict | Highest version wins |

Arbitration rules MUST be explicit, logged, and reproducible. No implicit heuristics.

### 5.9 Idempotency & Re-Entrancy

* Sync operations detect previously completed units and skip redundant writes
* On crash/restart — resume from last incomplete SyncUnit; avoid reprocessing completed domains

### 5.10 Concurrency Control

* Global Sync Lock prevents parallel sync runs
* Only one active sync per app
* Lock must be released on completion and force-released on crash recovery

### 5.11 Recovery & Rollback

| Failure Type | Action |
| ------------ | ------ |
| Pre-flight failure | Abort |
| Transfer failure | Retry |
| Partial commit | Rollback domain |
| Corruption detected | Rehydrate from Vault |

Rollback model: maintain previous domain snapshot; on failure, revert to last consistent state.

### 5.12 Integration Points

**With Vault Service:** Vault must be mounted and Tier 1 registry must be CONSISTENT before sync proceeds.

**With SQLite Cache:** SQLite must support transactional writes per domain.

**With Vaidyar:** Receives health gating signals; emits sync integrity status.

**With Task Scheduler:** Executes scheduled sync jobs; must respect concurrency lock.

**With Startup Orchestrator:** Executes hydration phase; must complete before system enters OPERATIONAL.

### 5.13 Sync Mutation Boundary

```
CACHE_STATE ↔ SYNC_ENGINE ↔ VAULT_STATE
```

* Sync Engine is the only authorized mutator between layers
* Vault = High Trust
* Cache = Operational Trust
* Sync Engine = Enforcement Layer

### 5.14 Failure Modes

| Scenario | Behavior | Recovery |
| -------- | -------- | -------- |
| Vaidyar health blocked | Abort sync | Wait for health restoration |
| Vault not mounted | Abort sync | Retry after mount |
| Pre-flight validation failure | Abort | Investigate and fix |
| Transfer failure | Retry (bounded) | Rollback domain if exhausted |
| Checksum mismatch after transfer | Block commit | Rerun transfer |
| Partial commit | Rollback domain to pre-sync state | Re-queue domain |
| Corruption detected in Vault | Escalate to Vaidyar | Reconstruct from last known good |
| Sync lock held by crashed process | Force-release lock | Resume after release |

### 5.15 Known Architectural Gaps

| Area | Gap | Impact |
| ---- | --- | ------ |
| Distributed Transactions | No true cross-layer atomic commit | Critical |
| Incremental Sync | No diff-based synchronization | High |
| Domain-Level Concurrency | Only global lock exists | High |
| Conflict Visualization | No operator-facing diff UI | High |
| Versioning System | Weak version tracking per domain | Medium |
| Snapshot Backups | No historical rollback checkpoints | Medium |
| Throughput Optimization | No batching/streaming for large datasets | Medium |

---

## 6. Cross-Layer Contracts

### 6.1 Runtime Access Contract

```text
No service accesses Vault directly during runtime.
All Vault data is available at runtime only through SQLite vault_cache tables.
```

### 6.2 Mirror Constraint

At sync completion:
* Every Vault domain key has a corresponding SQLite cache entry
* Every SQLite vault_cache row has a corresponding Vault artifact
* `structure_hash` in Tier 1 matches computed value from Tier 2

### 6.3 Registry Before Vault Operations

Before any Vault write:
1. Vault registry must be CONSISTENT
2. Domain key must be registered in Tier 1
3. App key must exist in SQLite `app_registry`

### 6.4 Sync Before Operational Use

Startup Orchestrator enforces:
1. Vault mounted (`STORAGE_READY`)
2. Mirror contract validated (`STORAGE_MIRROR_VALIDATING`)
3. Integrity verified (`INTEGRITY_VERIFIED`)
4. Only then: system enters `OPERATIONAL`

---

## 7. Observability

All three layers must emit:

**SQLite Cache:**
* connection open/close events
* concurrent access metrics (readers, writers)
* query latency
* error events (connection failure, WAL errors)

**Vault Registry:**
* app registration events
* structure change events
* desync detection logs
* lock acquisition failures
* registry rebuild actions

**Sync Engine:**
* sync duration per domain
* bytes transferred
* conflict frequency
* retry counts
* failure rate by mode
* lock contention events

**Consumers:**
* Vaidyar (runtime integrity)
* Notification Centre (sync status, conflict alerts, mount failures)
* Audit Layer
* Infrastructure UI

---

## 8. Security Model

* Vault data is encrypted at rest (AES-256-GCM via Encryption Service)
* SQLite cache operates on plaintext within the trusted host process
* Encryption boundary is exclusively at the Vault container interface
* Sync Engine enforces Data Security Protocol before every transfer
* No cache data leaves the trusted host process without encryption
