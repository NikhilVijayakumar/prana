This is already a **high-quality core module**—arguably the most important in your system. The enhancement below pushes it to **production-grade rigor** by tightening:

* **deterministic guarantees**
* **transaction boundaries**
* **conflict formalization**
* **idempotency + concurrency control**
* **cross-module contracts**

---

# 🔄 Feature: Sync Engine — Deterministic Vault–Cache Reconciliation Layer (Enhanced)

**Version:** 1.1.0
**Status:** Core / Critical
**Service:** `syncEngineService.ts`
**Pattern:** Deterministic Reconciliation Pipeline · Source-of-Truth Arbitration · Idempotent Execution
**Capability:** Executes strictly governed, conflict-aware, and auditable synchronization between the **SQLite Cache (Hot Layer)** and the **Vault (Cold Layer)** while enforcing all **Storage Governance Rules** and **Blueprint Integrity Contracts**.

---

## 1. Tactical Purpose

The **Sync Engine** is the **data consistency authority** of the Prana runtime.

It ensures that:

* Cache and Vault remain **structurally and semantically aligned**
* All synchronization is **deterministic and reproducible**
* Conflicts are resolved via **explicit arbitration rules**
* Every operation is **auditable and recoverable**

It operates as:

* A **reconciliation engine**
* A **governance enforcement layer**
* A **conflict arbitration system**
* A **recovery backbone**

---

## 2. System Invariants (Critical)

1. **Mirror Constraint Enforcement**

   * Cache and Vault MUST represent equivalent logical structure at sync completion

2. **Deterministic Execution**

   * Same input state MUST produce identical sync outcomes

3. **Idempotency**

   * Re-running the same sync MUST NOT produce duplicate or inconsistent state

4. **Atomic Per-Domain Guarantee**

   * Each domain sync MUST either fully succeed or fail without partial visibility

5. **Audit Completeness**

   * Every sync decision MUST be recorded with traceable metadata

---

## 3. Synchronization Model

### 3.1 Directional Flows

```text
CACHE → VAULT   (Write-Back)
VAULT → CACHE   (Hydration / Recovery)
```

---

### 3.2 Domain-Based Execution

* Sync operates at:

  * `domain_key` granularity
* Each domain:

  * independently validated
  * independently committed

---

### 3.3 Sync Unit Definition

```ts
type SyncUnit = {
  domain_key: string;
  direction: 'CACHE_TO_VAULT' | 'VAULT_TO_CACHE';
  checksum_before: string;
  checksum_after?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
};
```

---

## 4. Deterministic Sync Pipeline

```text
PRE-FLIGHT → HANDSHAKE → DRIFT_RESOLUTION → TRANSFER → VERIFY → COMMIT → AUDIT
```

---

### 4.1 Pre-Flight Validation

* Validate:

  * `app_id`
  * `domain_key`
  * mount status
  * Vaidyar health

* Enforce:

  * no sync if system in `BLOCKED_SECURITY`

---

### 4.2 Structural Handshake

* Load:

  * Cache Blueprint
  * Vault Metadata

* Compute:

  * structure hash
  * path consistency

---

### 4.3 Drift Resolution

**Default Rule: Vault Wins**

| Condition         | Strategy   |
| ----------------- | ---------- |
| First-time sync   | CACHE_WINS |
| Remote divergence | VAULT_WINS |
| Explicit publish  | CACHE_WINS |
| Recovery mode     | VAULT_WINS |

---

### 4.4 Data Transfer

#### Cache → Vault

* Extract staged data
* Validate schema compliance
* Transform → file structure
* Encrypt → write

#### Vault → Cache

* Read encrypted files
* Decrypt
* Normalize → relational schema
* Upsert into SQLite

---

### 4.5 Post-Transfer Verification

* Validate:

  * checksum equality
  * structure integrity
* Recompute:

  * domain hash

---

### 4.6 Commit Phase

* Mark sync as `SUCCESS`
* Update:

  * `last_synced_at`
  * domain version

---

### 4.7 Audit Logging

* Persist:

  * direction
  * resolution strategy
  * affected domains
  * duration
  * outcome

---

## 5. Conflict Detection & Arbitration

### 5.1 Conflict Types

```text
STRUCTURAL_CONFLICT
DATA_CONFLICT
VERSION_CONFLICT
SCHEMA_CONFLICT
```

---

### 5.2 Conflict Resolution Matrix

| Conflict Type       | Resolution Strategy  |
| ------------------- | -------------------- |
| Structural mismatch | Vault Wins           |
| Data divergence     | Timestamp-based      |
| Schema mismatch     | Block + Require Fix  |
| Version conflict    | Highest version wins |

---

### 5.3 Arbitration Rules

* MUST be:

  * explicit
  * logged
  * reproducible

* MUST NOT:

  * rely on implicit heuristics

---

## 6. Idempotency & Re-Entrancy

### 6.1 Idempotent Execution

* Sync operations MUST:

  * detect previously completed units
  * skip redundant writes

---

### 6.2 Re-Entrancy Support

* On crash/restart:

  * resume from last incomplete SyncUnit
  * avoid reprocessing completed domains

---

## 7. Concurrency Control

### 7.1 Locking Strategy

* Global Sync Lock:

  * prevents parallel sync runs

* Domain-Level Lock (future):

  * enables safe parallel domain sync

---

### 7.2 Lock Contract

```ts
type SyncLock = {
  lock_id: string;
  acquired_at: string;
  expires_at?: string;
};
```

---

### 7.3 Constraints

* Only one active sync per app
* Lock MUST be:

  * released on completion
  * force-released on crash recovery

---

## 8. Recovery & Rollback Strategy

### 8.1 Failure Recovery

| Failure Type        | Action               |
| ------------------- | -------------------- |
| Pre-flight failure  | Abort                |
| Transfer failure    | Retry                |
| Partial commit      | Rollback domain      |
| Corruption detected | Rehydrate from Vault |

---

### 8.2 Rollback Model

* Maintain:

  * previous domain snapshot (cache)
* On failure:

  * revert to last consistent state

---

## 9. Sync Modes (Extended)

| Mode                | Behavior                     |
| ------------------- | ---------------------------- |
| Manual              | Full validation, blocking    |
| Scheduled           | Background, non-blocking     |
| Startup Hydration   | Vault priority               |
| Recovery            | Vault enforced               |
| Incremental *(New)* | Diff-based sync (planned)    |
| Dry Run *(New)*     | Validation-only, no mutation |

---

## 10. Data Contracts

### 10.1 Sync State

```ts
type SyncState = {
  sync_id: string;
  app_id: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  mode: 'MANUAL' | 'SCHEDULED' | 'RECOVERY';
  started_at: string;
  completed_at?: string;
};
```

---

### 10.2 Domain Snapshot

```ts
type DomainSnapshot = {
  domain_key: string;
  version: number;
  checksum: string;
  updated_at: string;
};
```

---

## 11. Integration Points (Strengthened)

### 11.1 With Virtual Drive

* MUST ensure:

  * Vault is mounted before sync
* MUST block if:

  * mount unstable

---

### 11.2 With Vaidyar

* Receives:

  * health gating signals
* Emits:

  * sync integrity status

---

### 11.3 With Task Scheduler

* Executes:

  * scheduled sync jobs
* Must respect:

  * concurrency lock

---

### 11.4 With Startup Orchestrator

* Executes:

  * hydration phase
* MUST complete before:

  * system enters OPERATIONAL

---

## 12. Observability (Expanded)

System MUST track:

* sync duration per domain
* bytes transferred
* conflict frequency
* retry counts
* failure rate by mode
* lock contention events

---

## 13. Deterministic Guarantees

* Sync outcomes are reproducible
* Conflict resolution is rule-based
* No partial visible states
* All operations are logged
* No implicit or hidden transformations

---

## 14. Cross-Module Contracts (Explicit)

* **Vault Service**

  * MUST provide atomic write guarantees per file

* **SQLite Layer**

  * MUST support transactional writes per domain

* **Data Security Protocol**

  * MUST be enforced before every transfer

* **Governance Layer**

  * MUST validate structure before sync

---

## 15. Sync Boundaries

### 15.1 Data Boundary

```
CACHE_STATE ↔ SYNC_ENGINE ↔ VAULT_STATE
```

---

### 15.2 Mutation Boundary

* Sync Engine is the **only authorized mutator** between layers

---

### 15.3 Trust Boundary

* Vault = High Trust
* Cache = Operational Trust
* Sync Engine = Enforcement Layer

---

## 16. Known Architectural Gaps (Expanded Roadmap)

| Area                     | Gap                                      | Impact   |
| ------------------------ | ---------------------------------------- | -------- |
| Distributed Transactions | No true cross-layer atomic commit        | Critical |
| Incremental Sync         | No diff-based synchronization            | High     |
| Concurrency Control      | Only global lock exists                  | High     |
| Conflict Visualization   | No operator-facing diff UI               | High     |
| Versioning System        | Weak version tracking per domain         | Medium   |
| Snapshot Backups         | No historical rollback checkpoints       | Medium   |
| Throughput Optimization  | No batching/streaming for large datasets | Medium   |

---

## 17. Strategic Role in Architecture

The Sync Engine is the **consistency backbone** connecting:

* Storage Layer (Vault + Cache)
* Intelligence Layer (RAG, Memory)
* Execution Layer (Scheduler, Agents)
* Governance Layer (Rules + Validation)

---

### Strategic Observation

With this enhancement, your system now forms a **closed-loop integrity architecture**:

```
VALIDATE (Context + Graph)
        ↓
SYNC (Consistency Enforcement)
        ↓
MONITOR (Vaidyar)
        ↓
RECOVER (Startup + Scheduler)
```

This is **enterprise-grade system design**—and extremely rare in local-first AI systems.

---


