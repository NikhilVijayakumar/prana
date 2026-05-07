# Feature: Data Security & Sync Protocol

**Version:** 1.3.0  
**Status:** Stable / Core  
**Service:** `vaultService.ts` · `syncEngineService.ts` · `dataFilterService.ts`  
**Pattern:** Cold-Vault Security, Conflict-Free Reconciliation, & Storage Governance  
**Capability:** Provides a high-integrity framework for encryption, validation, and deterministic synchronization between **Hot-Cache (SQLite)** and **Cold-Vault (Encrypted Archive)** across multi-app environments.

---

## 1. Tactical Purpose

The **Data Security & Sync Protocol** establishes Prana as a **Zero-Trust, Integrity-First runtime**.

It guarantees that:
- No invalid or unscoped data enters the system
- No Vault state exists without a corresponding Cache projection
- All persisted data is cryptographically protected and structurally compliant
- Multi-app storage remains isolated, deterministic, and contract-bound

This protocol is the **enforcement layer between runtime state (SQLite) and durable state (Vault)**.

---

## 2. Storage Governance Rules

All storage operations MUST adhere to the following rules:

### Rule 1: Vault Is Git-Tree Structured

The Vault is the **durable, hierarchical archive**.

- Root structure:
```

/<app-name>/

```
- Domains must be decomposed into logical subtrees:
```

/<app-name>/registry/
/<app-name>/knowledge/
/<app-name>/audit/

````

- Files must be:
- deterministic in naming
- version-compatible
- domain-scoped

---

### Rule 2: Cache Is SQLite Table-Modeled

The Cache is the **authoritative runtime projection**.

- `app_registry` is mandatory
- All app-specific tables MUST include:
```sql
app_id INTEGER NOT NULL
````

* Foreign key constraints must be enforced at schema level

---

### Rule 3: Mirror Constraint

* Cache-only domains are allowed
* Vault-only domains are **strictly forbidden**

#### Enforcement:

* Every Vault domain MUST have:

  * a corresponding Cache table or projection
  * a defined domain key

---

### Rule 4: Domain-Key Stability

Domain keys are **immutable contract identifiers**.

* Renaming a domain requires:

  * simultaneous Vault + Cache update
  * documentation update
  * migration handling

* No silent renames are permitted

---

### Rule 5: Documentation-First Integration (PR Contract)

* No storage domain may be implemented without prior documentation
* Required:

  * `storage/cache/<app>.md`
  * `storage/vault/<app>.md` (if Vault-enabled)

---

## 3. Operational Pipeline

### 3.1 Data Flow Stages

```text
INCOMING DATA
   ↓
VALIDATION (dataFilterService)
   ↓
CACHE WRITE (SQLite)
   ↓
MIRROR VALIDATION (syncEngine)
   ↓
VAULT ENCRYPTION + WRITE (vaultService)
```

---

### 3.2 Stage Contracts

#### Stage 1: Validation

* Ensures:

  * valid `app_id`
  * valid domain key
  * schema conformity

* Rejects:

  * orphaned data
  * unknown domains
  * malformed payloads

---

#### Stage 2: Cache Write (Source of Truth)

* Data is written to SQLite first
* Must be:

  * transactional
  * idempotent
* Failure here aborts pipeline

---

#### Stage 3: Mirror Validation

* Ensures:

  * domain exists in cache schema
  * Vault mapping exists
* Blocks Vault write if constraint fails

---

#### Stage 4: Vault Sync

* Data is:

  * serialized
  * encrypted (AES-256-GCM)
  * written to Git-tree structure

* Must not proceed without:

  * successful mount (Virtual Drive)
  * validation pass

---

## 4. State & Consistency Model

### 4.1 Source of Truth

| Layer          | Role                           |
| -------------- | ------------------------------ |
| SQLite (Cache) | Operational source of truth    |
| Vault          | Durable backup + audit archive |

---

### 4.2 Consistency Guarantees

* **Write-through model**:

  * Cache write happens first
  * Vault sync follows

* **Eventual consistency** between Cache and Vault

* **Idempotent sync operations** required

---

### 4.3 Allowed States

| State        | Description                       |
| ------------ | --------------------------------- |
| CONSISTENT   | Cache and Vault aligned           |
| CACHE_ONLY   | Not yet synced to Vault           |
| SYNC_PENDING | Awaiting Vault write              |
| DEGRADED     | Vault unavailable (fallback mode) |
| INVALID      | Violates governance rules         |

---

## 5. Concurrency & Isolation

* Sync operations must be:

  * serialized per domain
  * idempotent

* Concurrent writes:

  * allowed at Cache level
  * coordinated at sync level

---

### 5.1 Conflict Handling

* Conflicts must:

  * be detected via lineage or timestamps
  * be resolved deterministically
  * produce audit records

* No silent overwrites allowed

---

## 6. Data Ownership Model

| Data          | Owner         | Write Authority  |
| ------------- | ------------- | ---------------- |
| Cache Tables  | SQLite Layer  | Runtime services |
| Vault Files   | Vault Service | Sync Engine      |
| Domain Schema | Documentation | Governance layer |

---

### Rules

* Vault must never be written directly by feature services
* All writes must pass through:

  * Cache → Sync → Vault pipeline

---

## 7. Security Model

### 7.1 Encryption

* Vault uses:

  * AES-256-GCM
  * PBKDF2-derived keys

* Encryption is:

  * mandatory for all Vault writes
  * never bypassed

---

### 7.2 Integrity Protection

* All payloads must:

  * pass validation before write
  * be verified before sync

* Invalid data must:

  * be rejected
  * optionally quarantined (future extension)

---

### 7.3 Zero-Trust Principles

* No implicit trust between:

  * Cache
  * Vault
  * External inputs

* Every stage must validate inputs independently

---

## 8. Failure Modes & Recovery

| Scenario            | Behavior             | Recovery                 |
| ------------------- | -------------------- | ------------------------ |
| Validation failure  | Reject data          | Return structured error  |
| Cache write failure | Abort pipeline       | Retry or surface error   |
| Mirror violation    | Block Vault sync     | Fix schema mismatch      |
| Vault unavailable   | Enter DEGRADED state | Retry on next sync cycle |
| Encryption failure  | Abort write          | Log + retry              |
| Partial sync        | Mark SYNC_PENDING    | Retry via sync engine    |

---

### 8.1 Recovery Strategy

* Sync engine must:

  * retry failed syncs
  * track pending records
* On restart:

  * re-attempt SYNC_PENDING entries

---

## 9. Observability & Audit

The protocol must emit:

* validation failures
* sync attempts
* sync success/failure
* conflict resolution logs
* mirror violations

---

### Integration

* Consumed by:

  * Runtime Doctor (Vaidyar)
  * Audit Layer
  * Infrastructure UI

---

## 10. Compliance Checklist

* [ ] Vault tree uses `<app-name>` root
* [ ] Cache includes `app_registry`
* [ ] All tables include `app_id`
* [ ] No Vault-only domains exist
* [ ] Domain keys are stable and documented
* [ ] All writes pass validation layer
* [ ] Vault writes occur only via sync pipeline

---

## 11. Known Architectural Gaps (Roadmap)

| Area                | Gap                                              | Impact |
| ------------------- | ------------------------------------------------ | ------ |
| Conflict Resolution | No unified deterministic resolver implemented    | High   |
| Sync Retry System   | No persistent retry queue for failed syncs       | High   |
| Quarantine Layer    | Invalid/corrupt data not isolated                | Medium |
| Schema Enforcement  | Runtime enforcement weaker than documented rules | Medium |
| Domain Versioning   | No versioning strategy for domain evolution      | Medium |
| Cross-App Isolation | No runtime enforcement beyond schema             | Low    |

---

```

