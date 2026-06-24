# 🌐 Feature: Google Ecosystem Integration — Workspace Bridge

**Version:** 2.0.0
**Status:** Stable / Production
**Service:** `googleBridgeService.ts` (REST Flow) · `googleBridgeService.runOAuthHandshake`
**Storage Domain:** `google_workspace_meta` (SQLite) / `vault/google/` (Vault)
**Capability:** Provides a native, zero-dependency REST bridge (Port 3111 OAuth) to Google Workspace for document, sheet, and metadata synchronization.

---

## 1. Tactical Purpose

The Workspace Bridge enables Prana to synchronize content from Google Workspace into the local SQLite runtime store, enforcing a local-first mirror architecture.

It operates as:

* A **remote discovery layer** — Drive folder traversal, file enumeration by MIME type
* A **document synchronization layer** — Google Docs extracted to Markdown, projected into SQLite Document domain
* A **sheet synchronization layer** — Google Sheets extracted to structured rows, projected into SQLite Sheet domain
* A **metadata synchronization layer** — state tracking, version timestamps, change detection

---

## 2. System Invariants (Critical)

1. **Mirror Constraint Enforcement**

   * Any ingested Google document MUST exist as a projection in SQLite (Document domain)
   * Artifacts explicitly committed for long-term retention MUST additionally exist in Vault

2. **Read-First Safety**

   * System MUST default to read-only operations unless explicitly configured for write-back

3. **External Isolation**

   * Google Workspace MUST be treated as untrusted external system
   * No direct dependency for runtime-critical operations

4. **Deterministic Sync Boundary**

   * All ingestion MUST occur via:

     * Scheduler-triggered jobs OR
     * explicit user action

5. **Metadata Authority**

   * SQLite (`google_workspace_meta`) is the authoritative state tracker for:

     * document IDs
     * sync status
     * version timestamps

6. **Session Containment**

   * Browser/session reuse MUST be sandboxed and scoped per account

---

## 3. Architectural Dependencies

| Component           | Role                             | Relationship                             |
| :------------------ | :------------------------------- | :--------------------------------------- |
| **Main Process**    | `googleBridgeService`            | Core orchestration layer                 |
| **Storage**         | SQLite (`google_workspace_meta`) | Metadata + sync tracking                 |
| **Storage**         | Vault (`vault/google/`)          | Durable committed artifact storage       |
| **Storage Layer**   | `storageSchedulerService`        | Drives ingestion cycles                  |
| **Viewer Layer**    | Markdown / PDF Viewer Screens    | Human inspection of extracted artifacts  |

---

## 4. Workspace State Model

### 4.1 Document Sync States

```text
DISCOVERED → METADATA_SYNCED → EXTRACTED → STORED → PROJECTED
```

---

### 4.2 Extended States

```text
STALE
FAILED
RETRY_PENDING
SKIPPED
```

**SKIPPED entry condition:** a document transitions to SKIPPED during Discovery when it does not match the configured MIME type inclusion rules or folder scope. SKIPPED documents are excluded from the pipeline entirely. SKIPPED is not a failure state — it is a deliberate exclusion.

---

### 4.3 State Rules

* Each state MUST:

  * persist metadata before transition
  * be idempotent

* State transitions MUST:

  * be driven by timestamp comparison (`last_modified`)
  * avoid duplicate ingestion

* STALE transition rule:

  * A record in `STORED` or `PROJECTED` state MUST transition to `STALE` when `last_modified` on the source is newer than `last_synced_at` in the metadata record
  * Detection occurs during VERIFY jobs triggered by the Storage Scheduler
  * A `STALE` record MUST be re-queued for the full pipeline from `METADATA_SYNCED`
  * A STALE record successfully returns to `PROJECTED` when its re-processing completes the full pipeline from `METADATA_SYNCED` through `STORED`/`PROJECTED`
  * If the source document no longer exists at re-processing time (e.g., deleted from Drive), the record transitions to `FAILED` with reason = `source_deleted`

---

## 5. The Workspace Pipeline (Deterministic Flow)

---

### 5.1 Discovery

* Traverse configured Drive folders
* Filter by:

  * MIME type
  * inclusion rules

**Output:**

* Document references (IDs, types)

---

### 5.2 Metadata Sync

* Store in SQLite:

  * file_id
  * type (doc/sheet/slide)
  * last_modified
  * permissions
  * sync_status

**Constraint:**

* MUST update existing records instead of duplicating

**Document re-creation (file_id change):** if a document is deleted and re-uploaded on Google Drive, it receives a new `file_id`. The old record remains in its last known state (STORED or PROJECTED). The new `file_id` creates a DISCOVERED record and proceeds through the pipeline independently. Deduplication by logical document identity (title, folder path) is not performed — `file_id` is the authoritative identity key.

---

### 5.3 Extraction

Per type:

* **Docs**

  * Extract structured text → Markdown

* **Sheets**

  * Extract:

    * cell data
    * sheet structure → JSON

* **Slides**

  * Extract:

    * slide text
    * speaker notes

  * **Scope note:** Slides extraction is supported for discovery and metadata tracking only. No SQLite storage domain is defined for Slides content. Slides are NOT subject to Mirror Constraint enforcement. Full Slides synchronization requires a defined storage domain and is out of scope for this version.

**Constraint:**

* Extraction MUST be deterministic and repeatable

---

### 5.4 Local Projection (SQLite)

* SQLite Document domain:

  * store extracted Markdown content (Docs)

* SQLite Sheet domain:

  * store extracted row data as structured tables (Sheets)

* SQLite `google_workspace_meta`:

  * update sync_status to STORED

**Constraint:**

* MUST satisfy Mirror Constraint before marking as STORED
* SQLite projection MUST be written before any Vault write occurs

---

### 5.5 Vault Persistence (Explicit Commit Only)

Vault write is out-of-band — it is NOT part of the standard synchronization pipeline.

Vault write occurs only when an artifact is explicitly committed for long-term retention. A document does not need to be Vault-committed to reach `PROJECTED` state.

When Vault write occurs:

* store durable content under:

  ```
  /vault/google/<doc_id>.md
  ```

* SQLite MUST track the Vault document ID
* content_hash MUST be recorded

**Constraint:**

* Vault write MUST correspond to an existing SQLite projection record

---

### 5.6 Projection Registration

Content is registered as a complete projection in the SQLite Document or Sheet domain.

The projection is queryable through the SQLite runtime store by any runtime service with domain access.

**Outcome:**

* sync_status transitions to PROJECTED — projection complete and queryable

---

## 6. Data Contracts

### 6.1 Workspace Metadata (SQLite: `google_workspace_meta`)

```ts
{
  file_id: string,
  name: string,
  type: 'doc' | 'sheet' | 'slide',
  last_modified: timestamp,
  permissions: string[],
  sync_status: 'DISCOVERED' | 'METADATA_SYNCED' | 'EXTRACTED' | 'STORED' | 'PROJECTED' | 'FAILED' | 'STALE' | 'RETRY_PENDING' | 'SKIPPED',
  last_synced_at: timestamp
}
```

---

### 6.2 Extracted Document (Cache)

```ts
{
  file_id: string,
  content: string,        // markdown or structured JSON
  extracted_at: timestamp,
  content_hash: string
}
```

---

### 6.3 Vault Representation

```ts
{
  doc_id: string,
  vault_path: string,
  content_hash: string,
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## 7. Scheduler Integration Contract

### 7.1 Execution Constraints

* MUST:

  * avoid overlapping sync cycles
  * respect lock model

* SHOULD:

  * batch process documents
  * throttle API usage

---

## 8. Storage Governance Compliance

### 8.1 SQLite — Local Domain (Active State)

`google_workspace_meta` is operational state — classified as **Local domain**.

Stores:

* metadata registry (`google_workspace_meta`)
* sync status
* extracted content cache

---

### 8.2 SQLite — Document Domain (Content Projection)

Extracted document content projected into SQLite under the **Document domain**, consistent with `storage-architecture.md` §4.

---

### 8.3 Vault — Durable Committed Artifacts (Explicit Commit Only)

Stores only artifacts explicitly committed for long-term retention:

* curated document content
* versioned content requiring durable persistence

Vault write is NOT required for every ingested document — only for explicitly committed artifacts.

---

### 8.4 Mirror Constraint Enforcement

The Mirror Constraint requires that the SQLite projection and the external source remain logically equivalent at all times.

**Per domain:**

```text
Google Doc
       ↕
SQLite Document Projection (Markdown)

Google Sheet
       ↕
SQLite Sheet Projection (Structured Table)
```

**Enforcement rules:**

* Document MUST NOT be marked STORED until SQLite projection is written
* SQLite projection MUST be refreshed when `last_modified` changes on the source
* Divergence detected during VERIFY MUST trigger a RECONCILE job via Storage Scheduler
* Vault write MUST correspond to an existing SQLite projection record and include content_hash
* SQLite MUST track the Vault document ID when a Vault write occurs

---

## 9. Failure Modes & Handling

| Scenario            | Behavior                  |
| :------------------ | :------------------------ |
| API failure         | Retry with backoff        |
| Extraction failure  | Mark FAILED, retry        |
| Metadata mismatch   | Re-sync metadata          |
| Vault write failure | Block explicit commit. STORED state unaffected for non-committed documents. Partial writes to Vault MUST be rolled back before failure is reported. A `vault:write:failed` event is emitted via Event Registry. The `content_hash` is NOT recorded. The SQLite projection record retains its current state. |
| Rate limiting       | Throttle execution        |
| Session expiration  | Re-authenticate and retry |

---

## 10. Observability

System MUST track:

* documents discovered vs processed
* sync latency per document
* extraction success rate
* API error frequency
* Vault write success rate
* stale document count

---

## 11. Deterministic Guarantees

* Each document is processed based on `last_modified` timestamp
* No duplicate ingestion occurs
* Local projection always precedes Vault persistence
* External API failures do not corrupt local state
* System remains functional without Google connectivity

---

## 12. Security Boundaries (Critical)

* Google Workspace is treated as:

  * **external, non-trusted system**

* System MUST:

  * never expose Vault contents externally
  * never persist tokens in Vault
  * isolate credentials per integration

---

## 13. Current Limitations (Out of Scope for This Version)

The following capabilities are explicitly NOT provided in the current version. Behavior for these scenarios is undefined or not guaranteed. These are known functional boundaries, not implementation backlog items — downstream consumers MUST NOT rely on these capabilities.

| Area                   | Gap                                  | Impact |
| :--------------------- | :----------------------------------- | :----- |
| ~~Unified API Client~~ | ~~No centralized token + scope manager~~ | ✅ v1.3 |
| Real-time Sync         | No webhook / push-based updates      | Medium |
| Write-Back Pipeline    | No structured outbound sync          | Medium |
| Conflict Resolution    | No version conflict handling. Interim behavior: when a sync conflict is detected, the affected record is blocked (CONFLICT state in SQLite), no automatic resolution is applied, and a conflict event is emitted via Event Registry. The record remains blocked until operator action resolves it. | High   |
| Rate Limiting Strategy | No adaptive throttling               | Medium |
| Large File Strategy    | No handling for large/complex docs. Interim behavior: documents that exceed extraction limits (size or complexity threshold determined by the extraction adapter) transition to FAILED with reason = `extraction_size_exceeded`. The document is excluded from the sync pipeline and must be handled manually by the operator. | Medium |
| Permission Modeling    | Limited handling of shared access    | Medium |

---

## 14. Cross-Module Contracts (Explicit)

* **Scheduler**

  * MUST trigger sync deterministically
  * MUST prevent concurrent runs

* **Vault Service**

  * MUST enforce mirror constraint during writes

---

## 15. Deterministic Boundaries

* **Ingestion Boundary:**

  ```
  EXTRACTED → STORED
  ```

  Requires successful local persistence

* **External Boundary:**

  * No direct dependency for runtime operation

* **Write Boundary (Future):**

  * Write-back to Google Docs requires explicit operator approval

---

## 16. Viewer Integration Contract

### 16.1 Markdown Viewer Path

* Docs extraction output SHOULD be projected as Markdown when possible
* Viewer MUST preserve semantic headings, links, and list structure

---

### 16.2 PDF Viewer Path

* Non-convertible artifacts MAY remain in PDF form for inspection
* Viewer MUST enforce sandbox rendering and fail-closed behavior

---

### 16.3 Human Verification Rule

* Before high-impact downstream usage, operators SHOULD be able to preview artifacts via viewer screens

---

## 17. Completion Status

This Google Ecosystem Integration contract is complete for the current documentation phase with deterministic ingestion flow, storage governance alignment, and viewer integration.

This module is aligned with:

* Zero-trust external integration
* Mirror constraint enforcement
* Storage Scheduler-driven determinism

### Strategic Note

* **Sync Engine** is the mandatory next component
* **Conflict resolution rules** needed across:
  * Vault ↔ SQLite
  * SQLite ↔ Google

## 18. Security Enforcement

| Enforcement | Mechanism | Status |
|---|---|---|
| **Timeout-enforced HTTP client** | OAuth and API operations use a timeout-enforced HTTP client | Enforced |
| **Mirror Constraint** | Google data is read-only mirror; no write-back to external systems | Enforced |
| **IPC Validation** | Google integration IPC handlers accept typed payloads | Enforced |

