# Feature: Global Vault Registry & Metadata Protocol

**Version:** 1.5.0  
**Status:** Stable / Core  
**Service:** `vaultRegistryService.ts` · `vaultMetadataService.ts`  
**Pattern:** Centralized Discovery / Decentralized Storage  
**Capability:** Provides a deterministic, globally consistent registry for discovering, validating, and reconciling application presence and structure within the Cold-Vault.

---

## 1. Tactical Purpose

In a multi-app runtime, the Vault must support **selective access without full traversal**. The **Global Vault Registry** acts as the **authoritative discovery index**, enabling Prana to:

- Identify which applications exist in the Vault
- Validate structural integrity before mount or sync
- Enforce cross-app governance rules
- Avoid expensive filesystem scans

This module establishes a **two-tier metadata system** that balances:
- **Global awareness (Tier 1)**
- **App-level isolation (Tier 2)**

---

### 1.1 "It Does" (Scope)

* **Global App Discovery:** Maintains a canonical `vault/global.metadata.json` containing all registered applications.
* **Structural Fingerprinting:** Stores a hash of each app’s Vault structure for fast integrity verification.
* **Selective Access Gating:** Validates whether a host app is recognized before allowing Vault operations.
* **Cache ↔ Vault Alignment:** Cross-verifies SQLite `app_registry` with Vault registry.
* **Topology Awareness:** Provides a global map of all Vault-resident applications without accessing their contents.
* **Registry Synchronization:** Coordinates updates between Tier 2 (app metadata) and Tier 1 (global registry).

---

### 1.2 "It Does Not" (Boundaries)

* **Store Business Data:** Only stores metadata, never domain data.
* **Replace App-Level Metadata:** Tier 2 metadata remains the source for domain-level structure.
* **Perform Sync Writes:** Delegates actual data persistence to Vault and Sync Protocol layers.
* **Resolve Domain Conflicts:** Only detects structural divergence, not domain-level conflicts.

---

## 2. Metadata Hierarchy

The protocol enforces a **two-tier metadata model**:

---

### Tier 1: Global Registry (`vault/global.metadata.json`)

**Purpose:** Central discovery index

```json
{
  "version": "1.5.0",
  "last_updated": "ISO-8601",
  "applications": [
    {
      "app_key": "example-app",
      "root_path": "vault/example-app",
      "structure_hash": "sha256-...",
      "mode": "cache+vault",
      "status": "active"
    }
  ]
}
````

---

### Tier 2: App Metadata (`vault/<app-name>/.metadata.json`)

**Purpose:** App-specific structural definition

Contains:

* domain keys
* folder mappings
* versioning metadata
* sync-relevant structure

---

### 2.3 Metadata Consistency Rules

* Tier 1 must reflect:

  * existence of every Vault-enabled app
* Tier 2 must reflect:

  * actual folder structure
* `structure_hash` must:

  * be derived deterministically from Tier 2 structure
  * change only when structure changes

---

## 3. Operational Lifecycle

### 3.1 Registry States

| State       | Description                      |
| ----------- | -------------------------------- |
| INITIALIZED | Registry loaded into memory      |
| CONSISTENT  | Tier 1 and Tier 2 aligned        |
| DESYNC      | Structural mismatch detected     |
| LOCKED      | Registry being updated           |
| FAILED      | Registry unreadable or corrupted |

---

### 3.2 Lifecycle Flow

1. **Bootstrap**

   * `startupOrchestrator` loads `global.metadata.json`
   * Registry enters `INITIALIZED`

2. **Verification**

   * Host app `app_key` validated against registry
   * SQLite `app_registry` cross-checked

3. **Reconciliation**

   * Compare Tier 2 metadata with Tier 1 fingerprint
   * Detect mismatches

4. **Update Phase**

   * Tier 2 updated first
   * Tier 1 updated with new `structure_hash`

5. **Operational Use**

   * Registry serves as lookup index for Vault operations

---

## 4. Registry Update Contract

### 4.1 Update Order (Strict)

```text
Tier 2 (App Metadata)
   ↓
Structure Hash Recalculation
   ↓
Tier 1 (Global Registry Update)
```

---

### 4.2 Atomicity Guarantee

* Updates must be:

  * atomic at file level
  * failure-safe (no partial writes)

* If Tier 1 update fails:

  * system enters `DESYNC`
  * recovery required before next sync

---

### 4.3 Idempotency

* Re-applying the same structure must not:

  * duplicate entries
  * alter hash unnecessarily

---

## 5. Concurrency & Locking Model

### 5.1 Global Registry Lock

* `global.metadata.json` requires:

  * exclusive write lock
  * shared read access

---

### 5.2 Locking Rules

* Only one process may:

  * modify Tier 1 at a time
* Concurrent reads are allowed
* Writes must:

  * acquire lock
  * release after commit

---

### 5.3 Conflict Prevention

* If lock acquisition fails:

  * operation must retry or abort
* No concurrent writes allowed across host apps

---

## 6. Data Ownership Model

| Artifact                 | Owner                  | Responsibility        |
| ------------------------ | ---------------------- | --------------------- |
| Global Registry (Tier 1) | Registry Service       | Discovery + indexing  |
| App Metadata (Tier 2)    | Vault Metadata Service | Structural definition |
| SQLite `app_registry`    | Cache Layer            | Runtime app identity  |

---

### Rules

* Tier 1 must never be manually edited outside service layer
* Tier 2 is the only source for structure derivation
* SQLite must reflect Tier 1 presence for Vault-enabled apps

---

## 7. Consistency & Validation Model

### 7.1 Validation Checks

* App exists in Tier 1
* App exists in SQLite `app_registry`
* Tier 2 file exists
* `structure_hash` matches computed value

---

### 7.2 Allowed States

| State       | Action                     |
| ----------- | -------------------------- |
| CONSISTENT  | Proceed                    |
| DESYNC      | Trigger reconciliation     |
| UNKNOWN_APP | Block Vault access         |
| CORRUPTED   | Escalate to Runtime Doctor |

---

## 8. Failure Modes & Recovery

| Scenario        | Behavior                 | Recovery                |
| --------------- | ------------------------ | ----------------------- |
| Missing Tier 1  | Block startup or rebuild | Reconstruct from Tier 2 |
| Missing Tier 2  | Mark app invalid         | Restore from backup     |
| Hash mismatch   | Enter DESYNC             | Recompute + update      |
| Partial write   | Mark registry corrupted  | Rollback or rebuild     |
| Lock contention | Retry                    | Backoff strategy        |

---

### 8.1 Recovery Strategy

* On startup:

  * verify all Tier 1 entries against Tier 2
* On failure:

  * rebuild Tier 1 from Tier 2 if possible
* On corruption:

  * escalate to Runtime Doctor (Vaidyar)

---

## 9. Integration Constraints

* Vault mount must not proceed if:

  * app is not present in Tier 1
* Sync engine must:

  * validate registry before Vault writes
* SQLite must:

  * align with Tier 1 entries

---

## 10. Observability & Audit

The registry must emit:

* app registration events
* structure change events
* desync detection logs
* lock acquisition failures
* registry rebuild actions

---

### Consumers

* Runtime Doctor (Vaidyar)
* Audit Layer
* Infrastructure UI

---

## 11. Known Architectural Gaps (Roadmap)

| Area                     | Gap                                               | Impact |
| ------------------------ | ------------------------------------------------- | ------ |
| Registry Desync          | No automatic reconciliation loop                  | High   |
| Locking Mechanism        | Lock file or distributed lock not implemented     | High   |
| App Deletion             | No atomic "retire app" workflow                   | High   |
| Partial Write Protection | No journaling or temp-write strategy              | Medium |
| Registry Scaling         | No sharding strategy for large app counts         | Low    |
| Versioning               | No schema/version migration strategy for metadata | Medium |

---

```


