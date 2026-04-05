# 🌐 Feature: Google Ecosystem Integration — Workspace Bridge (Enhanced)

**Status:** Proposed / Research
**Service:** `googleBridgeService.ts` (New) · `emailBrowserAgentService.ts`
**Storage Domain:** `google_workspace_meta` (SQLite) / `vault/google/` (Vault)
**Capability:** Provides an authenticated bridge to Google Drive, Docs, Sheets, and Slides for automated knowledge extraction and document staging.

---

## 1. Tactical Purpose

The Workspace Bridge enables Prana to treat Google Workspace as a **remote knowledge surface**, while enforcing a **local-first mirror architecture**.

It operates as:

* A **remote discovery engine** (Drive traversal)
* A **content projection system** (Docs/Sheets → structured local form)
* A **controlled staging layer** (agent → Google Docs handoff)
* A **metadata synchronization layer** (state tracking + change detection)

---

## 2. System Invariants (Critical)

1. **Mirror Constraint Enforcement**

   * Any Google document used by agents MUST exist:

     * as structured data in SQLite
     * as durable representation in Vault

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
| **Main Process**    | `emailBrowserAgentService`       | Session reuse / browser automation       |
| **Scheduler**       | `cronSchedulerService`           | Drives ingestion cycles                  |
| **Storage**         | SQLite (`google_workspace_meta`) | Metadata + sync tracking                 |
| **Storage**         | Vault (`vault/google/`)          | Persistent knowledge projection          |
| **Cognitive Layer** | Context Engine / RAG             | Consumes ingested content                |
| **Viewer Layer**    | Markdown / PDF Viewer Screens    | Human inspection of extracted artifacts  |
| **Startup Layer**   | `startupOrchestrator`            | Must not block on Workspace availability |

---

## 4. Workspace State Model

### 4.1 Document Sync States

```text id="7y0l3x"
DISCOVERED → METADATA_SYNCED → EXTRACTED → STORED → INDEXED
```

---

### 4.2 Extended States

```text id="h2x9qa"
STALE
FAILED
RETRY_PENDING
SKIPPED
```

---

### 4.3 State Rules

* Each state MUST:

  * persist metadata before transition
  * be idempotent

* State transitions MUST:

  * be driven by timestamp comparison (`last_modified`)
  * avoid duplicate ingestion

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

**Constraint:**

* Extraction MUST be deterministic and repeatable

---

### 5.4 Local Projection (Cache + Vault)

* SQLite:

  * store parsed representation (indexed)

* Vault:

  * store durable document under:

    ```
    /vault/google/<doc_id>.md
    ```

**Constraint:**

* MUST satisfy Mirror Constraint before marking as STORED

---

### 5.5 Indexing (Cognitive Integration)

* Send extracted content to:

  * Vector store
  * Context engine

**Outcome:**

* Document becomes queryable by agents

---

### 5.6 Agent Staging (Outbound Flow)

* Agents generate content
* System stages:

  * draft Google Doc / Slide (future write-back)

**Constraint:**

* Must require explicit operator action (policy-gated)

---

## 6. Data Contracts

### 6.1 Workspace Metadata (SQLite: `google_workspace_meta`)

```ts id="w0v92e"
{
  file_id: string,
  name: string,
  type: 'doc' | 'sheet' | 'slide',
  last_modified: timestamp,
  permissions: string[],
  sync_status: 'DISCOVERED' | 'SYNCED' | 'FAILED',
  last_synced_at: timestamp
}
```

---

### 6.2 Extracted Document (Cache)

```ts id="gn1x3p"
{
  file_id: string,
  content: string,        // markdown or structured JSON
  extracted_at: timestamp,
  version_hash: string
}
```

---

### 6.3 Vault Representation

```ts id="r6g3bf"
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

### 7.1 Template Job

```ts id="u2x9mz"
registerExecutor('GOOGLE_DRIVE_SYNC', googleBridgeService.runSync)
```

---

### 7.2 Execution Constraints

* MUST:

  * avoid overlapping sync cycles
  * respect lock model

* SHOULD:

  * batch process documents
  * throttle API usage

---

## 8. Browser Agent Integration

### 8.1 Responsibilities

* Handle:

  * session reuse
  * interactive authentication
  * complex UI-driven flows

---

### 8.2 Constraints

* MUST:

  * run in sandbox
  * isolate session per account

* MUST NOT:

  * leak session tokens to other modules
  * bypass explicit user consent

---

## 9. Storage Governance Compliance

### 9.1 SQLite (Active State)

Stores:

* metadata registry
* sync status
* extracted cache

---

### 9.2 Vault (Durable Knowledge)

Stores:

* document projections
* versioned content

---

### 9.3 Mirror Constraint Enforcement

* Vault write MUST:

  * correspond to SQLite record
  * include version hash

* SQLite MUST:

  * track Vault linkage

---

## 10. Failure Modes & Handling

| Scenario            | Behavior                  |
| :------------------ | :------------------------ |
| API failure         | Retry with backoff        |
| Extraction failure  | Mark FAILED, retry        |
| Metadata mismatch   | Re-sync metadata          |
| Vault write failure | Block STORED state        |
| Rate limiting       | Throttle execution        |
| Session expiration  | Re-auth via browser agent |

---

## 11. Observability

System MUST track:

* documents discovered vs processed
* sync latency per document
* extraction success rate
* API error frequency
* Vault write success rate
* stale document count

---

## 12. Deterministic Guarantees

* Each document is processed based on `last_modified` timestamp
* No duplicate ingestion occurs
* Local projection always precedes Vault persistence
* External API failures do not corrupt local state
* System remains functional without Google connectivity

---

## 13. Security Boundaries (Critical)

* Google Workspace is treated as:

  * **external, non-trusted system**

* System MUST:

  * never expose Vault contents externally
  * never persist tokens in Vault
  * isolate credentials per integration

---

## 14. Known Architectural Gaps (Expanded Roadmap)

| Area                   | Gap                                  | Impact |
| :--------------------- | :----------------------------------- | :----- |
| Unified API Client     | No centralized token + scope manager | High   |
| Real-time Sync         | No webhook / push-based updates      | Medium |
| Write-Back Pipeline    | No structured outbound sync          | Medium |
| Conflict Resolution    | No version conflict handling         | High   |
| Rate Limiting Strategy | No adaptive throttling               | Medium |
| Large File Strategy    | No handling for large/complex docs   | Medium |
| Permission Modeling    | Limited handling of shared access    | Medium |

---

## 15. Cross-Module Contracts (Explicit)

* **Scheduler**

  * MUST trigger sync deterministically
  * MUST prevent concurrent runs

* **Vault Service**

  * MUST enforce mirror constraint during writes

* **Cognitive Engine**

  * Consumes indexed content
  * MUST not mutate source documents

* **Vaidyar**

  * SHOULD receive:

    * sync failures
    * API errors
    * extraction anomalies

---

## 16. Deterministic Boundaries

* **Ingestion Boundary:**

  ```
  EXTRACTED → STORED
  ```

  Requires successful local persistence

* **External Boundary:**

  * No direct dependency for runtime operation

* **Write Boundary (Future):**

  * Agent → Google Docs must be explicitly approved

---

## 17. Viewer Integration Contract

### 17.1 Markdown Viewer Path

* Docs extraction output SHOULD be projected as Markdown when possible
* Viewer MUST preserve semantic headings, links, and list structure

---

### 17.2 PDF Viewer Path

* Non-convertible artifacts MAY remain in PDF form for inspection
* Viewer MUST enforce sandbox rendering and fail-closed behavior

---

### 17.3 Human Verification Rule

* Before high-impact downstream usage, operators SHOULD be able to preview artifacts via viewer screens

---

## 18. Completion Status

This Google Ecosystem Integration contract is complete for the current documentation phase with deterministic ingestion flow, storage governance alignment, and inspection-surface integration.

---

This module is now aligned with:

* Zero-trust external integration
* Mirror constraint enforcement
* Scheduler-driven determinism
* Cognitive pipeline integration

---

### Strategic Note (Important)

This is your **first true external system bridge**, which means:

* The **Sync Engine** becomes mandatory next
* You’ll need **conflict resolution rules** across:

  * Vault ↔ SQLite
  * SQLite ↔ Google
* And eventually:

  * Email ↔ Google Docs (cross-domain knowledge linking)

---


