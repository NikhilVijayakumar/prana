# 🧱 SQLite Cache — Enhanced

````md id="7h2xq9"
# Feature: SQLite Cache — Encrypted Operational Layer

**Version:** 1.3.0  
**Status:** Stable / Core  
**Engine:** AES-256-GCM (Custom Buffer-Level Encryption)  
**Capability:** Provides a high-performance, encrypted relational store that acts as the **operational source of truth**, with **Structural Blueprint Tracking** to enforce Vault alignment. Database files are protected at rest independently of the host filesystem.

---

## 1. Tactical Purpose

The **SQLite Cache** is the **authoritative runtime state layer**. All data must enter, mutate, and be validated here before any Vault interaction.

It ensures:
- deterministic state management
- enforcement of Storage Governance Rules (Rule 2, Rule 3)
- structural mirroring with Vault via Blueprint Tracking
- encrypted at-rest protection via AES-256-GCM + PBKDF2

---

## 2. Core Responsibilities

* **Operational Source of Truth:** All writes occur in SQLite before Vault sync
* **Blueprint Tracking:** Maintains expected Vault structure via `app_vault_blueprint`
* **App Isolation:** Enforces `app_id`-scoped data ownership
* **Transactional Integrity:** All writes must be atomic and rollback-safe
* **Sync Staging Layer:** Acts as the staging ground for Vault writes
* **Encryption Enforcement:** Ensures all persisted data is encrypted at rest

---

## 3. Storage Model

### 3.1 Core Tables

```sql
CREATE TABLE app_registry (
    app_id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_key TEXT UNIQUE NOT NULL,
    app_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_vault_blueprint (
    blueprint_id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    domain_key TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    is_required BOOLEAN DEFAULT 1,
    last_synced_at DATETIME,
    FOREIGN KEY (app_id) REFERENCES app_registry(app_id),
    UNIQUE(app_id, domain_key)
);
````

---

### 3.2 Blueprint Semantics

* Each `domain_key` represents a **Vault domain contract**
* `relative_path` defines deterministic folder mapping
* Blueprint must:

  * fully represent Vault structure
  * remain consistent with `.metadata.json`

---

## 4. Operational Blueprint Contract

### 4.1 Source of Truth Hierarchy

| Layer                  | Authority                  |
| ---------------------- | -------------------------- |
| Vault `.metadata.json` | Structural Source of Truth |
| SQLite Blueprint       | Operational Projection     |

---

### 4.2 Blueprint States

| State          | Description                      |
| -------------- | -------------------------------- |
| SYNCED         | Matches Vault metadata           |
| STALE          | Outdated vs Vault                |
| LOCAL_MODIFIED | Changed locally, pending publish |
| INVALID        | Violates governance rules        |

---

### 4.3 Blueprint Rules

* Must exist for every Vault-enabled app
* Must include all required domain keys
* Must not contain undefined domains
* Must be updated before Vault structure changes

---

## 5. Synchronization & Conflict Protocol

### 5.1 Handshake Flow

```text
Load Blueprint (SQLite)
   ↓
Fetch Vault Metadata
   ↓
Compare Structures
   ↓
Resolve Authority
   ↓
Proceed with Sync
```

---

### 5.2 Conflict Scenarios

#### Scenario A: Local Change

* Blueprint updated locally
* Marked `LOCAL_MODIFIED`
* Requires explicit publish to Vault

---

#### Scenario B: Remote Divergence

* Vault metadata differs
* Vault is authoritative
* SQLite blueprint must:

  * be overwritten
  * re-synced before data operations

---

#### Scenario C: Irreconcilable Conflict

* Domain mismatch or missing required structure
* Sync blocked
* Escalated to Vaidyar

---

## 6. Concurrency & Transaction Model

* SQLite operations must be:

  * transactional
  * ACID-compliant
* Concurrent writes:

  * allowed per table
  * must not violate domain constraints

---

### 6.1 Sync Isolation

* Blueprint comparison must occur:

  * before any Vault write
* Sync must operate on:

  * a consistent snapshot of SQLite state

---

## 7. Data Ownership Model

| Data            | Owner          | Write Path             |
| --------------- | -------------- | ---------------------- |
| Runtime Data    | SQLite         | Direct                 |
| Vault Structure | Vault Metadata | Synced to SQLite       |
| Blueprint       | SQLite         | Sync Engine controlled |

---

### Rules

* No direct Vault writes without SQLite staging
* Blueprint updates must go through Sync Engine
* Services must not bypass SQLite layer

---

## 8. Security Model

* **AES-256-GCM** enforces:
  - authenticated encryption (at rest)
  - integrity verification (AuthTag)
* **PBKDF2** key derivation:
  - utilizes `vault.archivePassword` and `vault.archiveSalt`
  - strict minimum of 100,000 iterations
* Keys must:
  - never be stored in plaintext
  - be provided via runtime config

---

### 8.1 Access Constraints

* Only main process services may access SQLite
* Renderer must use IPC
* No direct filesystem access allowed

---

## 9. Failure Modes & Recovery

| Scenario           | Behavior                        | Recovery             |
| ------------------ | ------------------------------- | -------------------- |
| DB corruption      | Mark INVALID                    | Restore from Vault   |
| Missing blueprint  | Reconstruct from Vault metadata | Auto-rebuild         |
| Sync mismatch      | Block sync                      | Reconcile structures |
| Encryption failure | Abort DB access                 | Reinitialize         |

---

### 9.1 Recovery Strategy

* On startup:

  * validate schema + blueprint
* On failure:

  * rebuild from Vault metadata
* On persistent error:

  * escalate to Vaidyar

---

## 10. Observability

SQLite must emit:

* schema validation results
* blueprint sync status
* transaction failures
* sync staging metrics

---

## 11. Known Architectural Gaps (Roadmap)

| Area                 | Gap                              | Impact |
| -------------------- | -------------------------------- | ------ |
| Recursive Blueprint  | No deep folder mapping           | High   |
| Blueprint Versioning | No version tracking              | High   |
| Migration Engine     | No automated schema evolution    | High   |
| Corruption Recovery  | No partial recovery tooling      | Medium |
| Query Isolation      | No per-domain performance tuning | Low    |

---

