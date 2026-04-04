# Feature: Sync Engine — Deterministic Vault–Cache Reconciliation Layer

**Version:** 1.0.0
**Status:** Core / Critical
**Service:** `syncEngineService.ts`
**Pattern:** Bidirectional Reconciliation with Source-of-Truth Arbitration
**Capability:** Executes governed, conflict-aware synchronization between the **SQLite Cache (Hot Layer)** and the **Vault (Cold Layer)** while enforcing all **Storage Governance Rules** and **Structural Blueprint Contracts**.

---

## 1. Tactical Purpose

The **Sync Engine** is the **execution authority** behind the **Data Security & Sync Protocol**. It ensures that data flows between the **Hot Cache** and **Cold Vault** in a way that is:

* **Deterministic** (no ambiguous outcomes)
* **Auditable** (every sync decision is traceable)
* **Conflict-resilient** (clear resolution strategy)
* **Governance-compliant** (strict adherence to Rules 1–5)

Without the Sync Engine, the system has **structure but no movement**.

---

## 2. Core Responsibilities

### 2.1 Bidirectional Synchronization

The engine manages two primary flows:

* **Cache → Vault (Write-Back)**

  * Triggered by:

    * User actions (save/publish)
    * Scheduled jobs (Cron)
    * Queue System (System Lane)
  * Ensures:

    * Data is validated
    * Structure exists in Vault
    * Encryption pipeline is respected

* **Vault → Cache (Hydration / Recovery)**

  * Triggered by:

    * Startup bootstrap
    * Conflict resolution
    * New environment setup
  * Ensures:

    * Local cache reflects Vault structure and data
    * Blueprint is reconstructed if needed

---

### 2.2 Governance Enforcement Engine

The Sync Engine is the **runtime enforcer** of:

* **Rule 1:** Vault structure integrity
* **Rule 2:** Cache relational ownership
* **Rule 3:** Mirror Constraint (**critical gate**)
* **Rule 4:** Domain key stability

Any violation results in:

* Sync rejection
* Vaidyar **Degraded/Blocked** signal
* Logged audit event

---

### 2.3 Structural Reconciliation

Before any data transfer:

1. Compare:

   * `app_vault_blueprint` (Cache)
   * `.metadata.json` (Vault)

2. Determine:

   * Match → Proceed
   * Drift → Resolve using **Source-of-Truth Arbitration**

---

### 2.4 Conflict Detection & Arbitration

The engine operates with **strict hierarchy of truth**:

| Scenario            | Source of Truth    | Action                     |
| ------------------- | ------------------ | -------------------------- |
| Fresh Sync          | Cache              | Initialize Vault structure |
| Remote Change       | Vault              | Override Cache blueprint   |
| Local Schema Change | Cache (on Publish) | Update Vault metadata      |
| Corruption / Loss   | Vault              | Rebuild Cache              |

---

## 3. Synchronization Lifecycle

Every sync operation follows a deterministic pipeline:

---

### Step 1: Pre-Flight Validation

* Validate `app_id` (Rule 2)
* Validate `domain_key` (Rule 4)
* Confirm mount status via Virtual Drive
* Check Vaidyar health state

---

### Step 2: Structural Handshake

* Load:

  * Cache Blueprint (`app_vault_blueprint`)
  * Vault Metadata (`.metadata.json`)
* Perform:

  * Hash comparison
  * Path verification

---

### Step 3: Drift Resolution

If mismatch detected:

* **Vault wins** (default)
* Cache blueprint updated
* Optional:

  * Emit warning
  * Require operator approval (for destructive changes)

---

### Step 4: Data Transfer Phase

#### Cache → Vault

* Extract staged records
* Transform into Vault file structure
* Pass through `vaultService`:

  * Encrypt (AES-256-GCM)
  * Write to correct subtree

#### Vault → Cache

* Read encrypted payloads
* Decrypt via `vaultService`
* Normalize into relational format
* Insert/update SQLite tables

---

### Step 5: Post-Sync Verification

* Recalculate structure hash
* Update:

  * `last_synced_at`
  * Sync logs
* Trigger Vaidyar pulse

---

### Step 6: Audit Logging

All operations recorded:

* Sync direction
* Affected domains
* Conflict decisions
* Timestamps
* Failure reasons

---

## 4. Sync Modes

The engine supports multiple execution modes:

| Mode                   | Trigger          | Behavior                   |
| ---------------------- | ---------------- | -------------------------- |
| **Manual Sync**        | User action      | Immediate, full validation |
| **Scheduled Sync**     | Cron             | Background, non-blocking   |
| **Startup Hydration**  | Orchestrator     | Vault → Cache priority     |
| **Recovery Mode**      | Failure detected | Vault as Source of Truth   |
| **Dry Run** *(Future)* | Debugging        | No writes, only validation |

---

## 5. Data Contracts & Internal State

### 5.1 Sync State Model

```ts
type SyncState = {
  app_id: number;
  sync_direction: 'CACHE_TO_VAULT' | 'VAULT_TO_CACHE';
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  conflict_detected: boolean;
  resolution_strategy: 'CACHE_WINS' | 'VAULT_WINS';
  started_at: string;
  completed_at?: string;
};
```

---

### 5.2 Sync Log Table (SQLite)

```sql
CREATE TABLE sync_audit_log (
    sync_id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER,
    direction TEXT,
    status TEXT,
    conflict_detected BOOLEAN,
    resolution_strategy TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Integration with Other Systems

| Component                | Role                  | Relationship                       |
| :----------------------- | :-------------------- | :--------------------------------- |
| **vaultService**         | Encryption & file I/O | Executes secure writes/reads       |
| **sqliteDataProvider**   | Cache persistence     | Executes relational operations     |
| **dataFilterService**    | Validation layer      | Enforces governance rules pre-sync |
| **Virtual Drive**        | Mount control         | Ensures Vault availability         |
| **Task Scheduler**       | Execution trigger     | Runs sync jobs in System Lane      |
| **Vaidyar**              | Integrity audit       | Validates post-sync health         |
| **Startup Orchestrator** | Boot trigger          | Initiates hydration phase          |

---

## 7. Failure Handling Strategy

The engine classifies failures into deterministic categories:

| Failure Type            | Behavior                     |
| ----------------------- | ---------------------------- |
| **Validation Failure**  | Abort before execution       |
| **Mount Failure**       | Retry or escalate to Vaidyar |
| **Conflict Unresolved** | Block sync                   |
| **Partial Write**       | Rollback (where possible)    |
| **Vault Write Failure** | Retry with backoff           |

---

## 8. Known Architectural Gaps (Roadmap)

* **[Critical] Transactional Integrity Across Layers**
  No true distributed transaction between SQLite and Vault writes. Partial sync states may occur during mid-operation failures.

* **[High] Incremental Sync Optimization**
  Current model assumes domain-level sync. Needs fine-grained diff-based syncing to avoid full rewrites.

* **[High] Concurrent Sync Protection**
  No locking mechanism to prevent two sync processes (e.g., Cron + Manual) from running simultaneously.

* **[Med] Conflict Visualization UI**
  Operators cannot yet see a structured diff between Cache and Vault before resolution.

* **[Low] Sync Performance Telemetry**
  Lacks metrics like sync duration per domain, throughput, and failure frequency.

---

## 9. Strategic Position

The **Sync Engine** is the **bridge between structure and intelligence**:

* Virtual Drive → gives access
* Vault → stores truth
* Cache → enables speed
* **Sync Engine → keeps them aligned**

It is one of the most **critical trust boundaries** in the entire Prana architecture.


