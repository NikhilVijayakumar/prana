# Google Ecosystem Integration — Technical Realization

**Version:** 2.0.0
**Feature Spec:** docs/raw/features/google-ecosystem-integration.md
**Architecture Ref:** docs/raw/external-context/astra.md

---

## 1. Overview

The Google Ecosystem Integration (Workspace Bridge) is a main-process-dominant feature that synchronizes Google Workspace content (Docs, Sheets, Slides) into Prana's local SQLite runtime store. It enforces a local-first mirror architecture: Google Workspace is an external, non-trusted read source; the canonical state of all ingested content lives in SQLite.

The feature is primarily a background orchestration service running in Prana's main process. A renderer-facing IPC surface is required for sync status visibility, as the L2 spec mandates observability of sync metrics (documents discovered vs processed, sync latency, extraction success rate, API error frequency, Vault write success rate, stale document count).

Prana consumes Astra's boilerplate throughout the renderer surface — `IpcService` for all IPC transport, `useDataState` for ViewModel state management, and `AppStateHandler` for conditional rendering. The main process owns all Google API interactions, OAuth lifecycle, pipeline orchestration, and SQLite state persistence.

---

## 2. Feature Summary

| Field | Value |
|---|---|
| Feature Name | Google Ecosystem Integration — Workspace Bridge |
| Version | 2.0.0 |
| Status | Stable / Production |
| Primary Process | Main process (Node.js) |
| Renderer Surface | Sync status and document metadata display |
| Storage Domain | `google_workspace_meta` (SQLite Local), Document domain (SQLite), Sheet domain (SQLite), `vault/google/` (Vault) |
| External System | Google Workspace (Drive, Docs, Sheets, Slides) via REST |
| OAuth Port | 3111 |
| Scheduler Dependency | `storageSchedulerService` triggers ingestion cycles |

---

## 3. Architecture Mapping

The Workspace Bridge spans both Prana processes, with the main process holding full orchestration authority.

| Concern | Process | Astra Role |
|---|---|---|
| Google API communication | Main process | None — Prana-owned REST client |
| OAuth handshake | Main process | None — Prana-owned |
| Pipeline orchestration (Discovery → Projection) | Main process | None — Prana-owned |
| SQLite state persistence | Main process | None — Prana-owned |
| Vault persistence | Main process | None — Prana-owned |
| IPC handler surface | Main process | Returns `ServerResponse<T>` per Astra contract |
| Sync status queries | Renderer (via IPC) | `IpcService` (Astra-owned) |
| Sync status ViewModel | Renderer | `useDataState` (Astra-owned) |
| Sync status View | Renderer | `AppStateHandler` (Astra-owned) |

The Google Workspace Bridge does not require AppStateProvider re-wiring — that is performed once at the Prana renderer root.

---

## 4. Main Process Design

### 4.1 Service Architecture

The main process hosts a single core service: `googleBridgeService`. This service owns:

- **OAuth Lifecycle** — the `runOAuthHandshake` operation initializes the OAuth flow on port 3111 and stores resulting credentials per session. Credentials are scoped per account and MUST NOT be persisted in Vault. Session containment is sandboxed per account.

- **Remote Discovery** — Drive folder traversal, file enumeration by MIME type and inclusion rules. Outputs document references (IDs, types) for pipeline entry.

- **Pipeline Orchestration** — the deterministic five-stage pipeline: Discovery → Metadata Sync → Extraction → Local Projection → Vault Persistence (out-of-band). Each stage persists metadata before transitioning state.

- **Scheduler Contract** — the service is invoked by `storageSchedulerService`. It MUST enforce the lock model to prevent overlapping sync cycles. Ingestion MUST only occur via scheduler-triggered jobs or explicit user action.

- **Stale Detection** — during VERIFY jobs triggered by the Storage Scheduler, the service compares `last_modified` on the source against `last_synced_at` in `google_workspace_meta`. Records in STORED or PROJECTED state that have a newer `last_modified` MUST transition to STALE and be re-queued from METADATA_SYNCED.

- **Observability Counters** — the service MUST maintain counters for documents discovered vs processed, sync latency per document, extraction success rate, API error frequency, Vault write success rate, and stale document count. These are exposed via IPC for renderer consumption.

- **Error and Retry Handling** — API failures trigger retry with backoff. Extraction failures mark the record FAILED. Session expiration triggers re-authentication and retry. Rate limiting triggers execution throttling. Vault write failure blocks explicit commit but does not affect STORED state for non-committed documents.

Prana's `wrappedFetch` wrapper is used for all OAuth and API operations, enforcing timeout and isolation. Google Workspace is always treated as a non-trusted external system; no runtime-critical operation depends on its availability.

### 4.2 IPC Channel Contract

All IPC invoke channels return `ServerResponse<T>`. The channel naming convention is `google-bridge:{action}`.

| Channel | Direction | Payload | Response Data Shape | Purpose |
|---|---|---|---|---|
| `google-bridge:status` | invoke | none | `SyncStatusSnapshot` | Returns current observability counters and pipeline state |
| `google-bridge:list-documents` | invoke | `{ filter?: string }` | `WorkspaceMetaRecord[]` | Returns metadata records from `google_workspace_meta` |
| `google-bridge:get-document` | invoke | `{ file_id: string }` | `WorkspaceMetaRecord` | Returns a single metadata record |
| `google-bridge:trigger-sync` | invoke | `{ folder_id?: string }` | `boolean` | Triggers a manual sync cycle (subject to lock model) |
| `google-bridge:authenticate` | invoke | none | `boolean` | Initiates OAuth handshake on port 3111 |

All handlers return `ServerResponse.success(...)` or `ServerResponse.error(...)` using Astra's static factories — never raw response objects.

Push channels (one-way, main → renderer):

| Channel | Data Shape | Purpose |
|---|---|---|
| `google-bridge:sync-progress` | `{ file_id: string, status: SyncStatus, stage: string }` | Real-time pipeline progress for a document |

The `google-bridge:sync-progress` push channel is consumed via `IpcService.receive()` in the renderer. The renderer MUST call the returned unsubscribe function on component unmount.

### 4.3 SQLite Schema

Three SQLite domains are involved.

**`google_workspace_meta` (Local Domain — authoritative state tracker)**

| Column | Type | Notes |
|---|---|---|
| `file_id` | TEXT PRIMARY KEY | Google Drive file identifier |
| `name` | TEXT | Display name |
| `type` | TEXT | `doc`, `sheet`, or `slide` |
| `last_modified` | INTEGER | Source timestamp (epoch ms) |
| `permissions` | TEXT | JSON-serialized permission list |
| `sync_status` | TEXT | Enum: DISCOVERED, METADATA_SYNCED, EXTRACTED, STORED, PROJECTED, FAILED, STALE, RETRY_PENDING, SKIPPED |
| `last_synced_at` | INTEGER | Timestamp of last successful sync (epoch ms) |
| `vault_doc_id` | TEXT | Vault document ID if explicitly committed (nullable) |
| `content_hash` | TEXT | Hash of extracted content; populated on Vault write |

UPSERT semantics MUST be used — duplicate records are prohibited (L2 §5.2 constraint).

**SQLite Document Domain**

Extracted Markdown content from Google Docs is projected into the existing SQLite Document domain (consistent with `storage-architecture.md` §4). Column mapping follows the Document domain schema; the `google_workspace_meta.file_id` serves as the external source reference.

**SQLite Sheet Domain**

Extracted structured row data from Google Sheets is projected into the existing SQLite Sheet domain. Structured table rows are stored per sheet; the `file_id` serves as the external source reference.

### 4.4 Startup and Teardown

**Startup:**
- `googleBridgeService` is initialized at Prana main process startup.
- The service registers all IPC handlers (`google-bridge:*`) with `ipcMain`.
- The Storage Scheduler registers the sync job; `googleBridgeService` acquires the lock at job start.

**Teardown:**
- The service MUST release all scheduler locks on shutdown.
- Any in-flight sync cycle at shutdown is abandoned at the current stage; state in `google_workspace_meta` is left at the last persisted state (idempotent re-entry on next run).
- Push channels are closed when the renderer window is destroyed.

---

## 5. Renderer Design (Astra MVVM)

A renderer-facing surface is required for sync status display and document metadata browsing. L2 §10 mandates observability counters. The renderer consumes these via IPC.

### 5.1 Feature Module Layout

The renderer feature module follows Astra's canonical four-layer structure:

```
model/        — WorkspaceMetaRecord, SyncStatusSnapshot, SyncStatus types
repo/         — googleBridgeIpc (IpcService-based repository)
hooks/        — useGoogleBridgeStatus, useGoogleBridgeDocuments (ViewModel hooks)
view/
  components/ — Sync status display, document list, progress indicator
  pages/      — Google Bridge status page container
```

### 5.2 Repository Layer (IpcService)

The repository layer uses `IpcService` from Astra as the sole transport. It exposes operations corresponding to the IPC channels defined in §4.2.

Operations include:

- `getStatus()` — invokes `google-bridge:status`, returns `ServerResponse<SyncStatusSnapshot>`
- `listDocuments(filter?)` — invokes `google-bridge:list-documents`, returns `ServerResponse<WorkspaceMetaRecord[]>`
- `getDocument(file_id)` — invokes `google-bridge:get-document`, returns `ServerResponse<WorkspaceMetaRecord>`
- `triggerSync(folder_id?)` — invokes `google-bridge:trigger-sync`, returns `ServerResponse<boolean>`
- `authenticate()` — invokes `google-bridge:authenticate`, returns `ServerResponse<boolean>`
- `onSyncProgress(callback)` — subscribes via `IpcService.receive()` on `google-bridge:sync-progress`, returns unsubscribe function

`IpcService` is imported from `'astra'`. The repository MUST NOT call `window.electronAPI` directly. All responses are normalized to `ServerResponse<T>` by `IpcService`.

### 5.3 ViewModel Layer (useDataState)

ViewModel hooks wrap `useDataState` from Astra. Each hook is self-contained; state is local to the feature unless explicitly lifted.

**`useGoogleBridgeStatus`**

- Uses `useDataState<SyncStatusSnapshot>()` to drive the INIT → LOADING → COMPLETED lifecycle for sync status.
- Exposes `appState` and a `loadStatus()` trigger function.
- Subscribes to `google-bridge:sync-progress` push events via the repository's `onSyncProgress` call; uses `setAppState` for optimistic local updates when push events arrive. Unsubscribes on unmount.

**`useGoogleBridgeDocuments`**

- Uses `useDataState<WorkspaceMetaRecord[]>()` for the document list.
- Exposes `appState` and `loadDocuments(filter?)` trigger.

**`useGoogleBridgeSync`**

- Uses `useDataState<boolean>()` for the trigger-sync operation.
- Exposes `appState` and `triggerSync(folder_id?)` action.

Error is represented as `COMPLETED + isError === true`. There is no separate ERROR state. ViewModel hooks MUST NOT contain JSX or import UI components.

### 5.4 View Layer (AppStateHandler)

View components consume ViewModel hook results and render via `AppStateHandler` from Astra. `AppStateHandler` handles the LOADING / error / empty / success slot routing without custom branching logic in the view.

The sync status view uses `AppStateHandler` with `appState` from `useGoogleBridgeStatus`. The `emptyCondition` callback returns true when the status snapshot has no documents discovered. An `errorMessage` prop is supplied for IPC failure display.

The document list view uses `AppStateHandler` with `appState` from `useGoogleBridgeDocuments`. The `emptyCondition` callback returns true when the document array is empty.

View components MUST NOT import the repository layer or call `IpcService` directly. All data access flows through ViewModel hooks.

### 5.5 AppState Lifecycle Mapping

| Trigger | StateType | isError | Rendered Slot |
|---|---|---|---|
| Component mounted, no fetch yet | INIT | false | Empty (fallback) |
| IPC invoke in flight | LOADING | false | Loading component |
| IPC returns success with data | COMPLETED | false | SuccessComponent / children |
| IPC returns empty list | COMPLETED | false | Empty component (emptyCondition) |
| IPC returns error / handler fails | COMPLETED | true | Error component |
| Push event updates status | COMPLETED | false | SuccessComponent (setAppState update) |

---

## 6. Responsibility Realization Matrix

Every L2 responsibility is mapped to its technical realization.

| L2 Responsibility | Realized By | Process |
|---|---|---|
| Drive folder traversal and file enumeration | `googleBridgeService` discovery stage | Main |
| Filter by MIME type and inclusion rules | `googleBridgeService` discovery filter logic | Main |
| Store file_id, type, last_modified, permissions, sync_status in SQLite | `google_workspace_meta` UPSERT on Metadata Sync stage | Main |
| Update existing records without duplicating | UPSERT semantics on `google_workspace_meta` | Main |
| Extract Google Docs to Markdown | `googleBridgeService` extraction stage (Docs branch) | Main |
| Extract Google Sheets to structured JSON rows | `googleBridgeService` extraction stage (Sheets branch) | Main |
| Extract Slides text and speaker notes (discovery/metadata only) | `googleBridgeService` extraction stage (Slides branch — no SQLite domain) | Main |
| Project Docs Markdown into SQLite Document domain | `googleBridgeService` projection stage (Docs) | Main |
| Project Sheets data into SQLite Sheet domain | `googleBridgeService` projection stage (Sheets) | Main |
| Mark sync_status = STORED after SQLite write | `google_workspace_meta` UPDATE on successful projection | Main |
| Mark sync_status = PROJECTED after projection registration | `google_workspace_meta` UPDATE on projection complete | Main |
| Vault write for explicitly committed artifacts | `googleBridgeService` out-of-band Vault write path | Main |
| Record vault_doc_id and content_hash in SQLite on Vault write | `google_workspace_meta` UPDATE after Vault write | Main |
| Enforce Mirror Constraint (SQLite before Vault) | Pipeline ordering: projection stage precedes Vault stage | Main |
| Detect STALE records during VERIFY jobs | Scheduler-triggered VERIFY job comparing `last_modified` vs `last_synced_at` | Main |
| Re-queue STALE records from METADATA_SYNCED | `google_workspace_meta` status update → re-entry at Metadata Sync | Main |
| Prevent overlapping sync cycles | Lock model enforced by `storageSchedulerService` contract | Main |
| Batch document processing | `googleBridgeService` scheduler job batch logic | Main |
| Throttle API usage | `googleBridgeService` rate limiter (via `wrappedFetch`) | Main |
| OAuth handshake on port 3111 | `googleBridgeService.runOAuthHandshake` | Main |
| Credentials isolated per account | Session containment per account; never persisted in Vault | Main |
| Retry API failures with backoff | `googleBridgeService` error handler | Main |
| Mark FAILED on extraction failure | `google_workspace_meta` UPDATE on extraction error | Main |
| Re-sync metadata on metadata mismatch | Re-entry at Metadata Sync stage | Main |
| Block Vault write on failure (non-committed STORED unaffected) | `googleBridgeService` Vault write error path | Main |
| Re-authenticate on session expiration | `googleBridgeService` session refresh path | Main |
| Track observability counters (discovered, latency, success rate, etc.) | `googleBridgeService` internal counters exposed via `google-bridge:status` | Main + Renderer IPC |
| Display sync status in renderer | `useGoogleBridgeStatus` + `AppStateHandler` (renderer surface) | Renderer |
| Display document list in renderer | `useGoogleBridgeDocuments` + `AppStateHandler` (renderer surface) | Renderer |
| Real-time pipeline progress in renderer | `google-bridge:sync-progress` push channel → `IpcService.receive()` | Renderer |
| Never expose Vault contents externally | No outbound Vault data path; read-only mirror enforcement | Main |
| Never persist tokens in Vault | Credential isolation rule — enforced in session management | Main |
| Treat Google Workspace as non-trusted external system | `wrappedFetch` with timeout; no runtime-critical external dependency | Main |

---

## 7. Workflow Realization

Every L2 workflow is mapped to its technical realization.

### Workflow 1: Scheduled Sync Cycle

**Trigger:** `storageSchedulerService` fires a sync job.

**Steps:**
1. Scheduler acquires lock — prevents concurrent runs.
2. `googleBridgeService` enters Discovery stage: traverses configured Drive folders, filters by MIME type and inclusion rules, produces document reference list.
3. Metadata Sync stage: for each discovered file, UPSERTs record into `google_workspace_meta` with current `last_modified`, `permissions`, and `sync_status = METADATA_SYNCED`.
4. Extraction stage: per document type — Docs extract to Markdown, Sheets extract to structured JSON, Slides extract text and speaker notes (no storage domain).
5. Local Projection stage: Docs Markdown written to SQLite Document domain; Sheets rows written to SQLite Sheet domain; `sync_status` updated to STORED. Mirror Constraint verified before STORED transition.
6. Projection Registration: `sync_status` updated to PROJECTED. Content is now queryable by runtime services with domain access.
7. Scheduler releases lock.

### Workflow 2: Manual Sync Trigger (User Action)

**Trigger:** Renderer invokes `google-bridge:trigger-sync` via `IpcService`.

**Steps:**
1. IPC handler receives request; checks scheduler lock — if a sync cycle is already running, returns `ServerResponse.error` with appropriate status.
2. If lock is free, initiates the same pipeline as Workflow 1 (Discovery through Projection).
3. `google-bridge:sync-progress` push events are emitted per document as the pipeline advances.
4. On completion, final status is updated in `google_workspace_meta`.

### Workflow 3: STALE Detection and Re-Sync

**Trigger:** `storageSchedulerService` fires a VERIFY job.

**Steps:**
1. Service queries `google_workspace_meta` for records in STORED or PROJECTED state.
2. For each record, compares `last_modified` on source against `last_synced_at` in the metadata record.
3. Records where source is newer are transitioned to STALE.
4. STALE records are re-queued for the pipeline starting at Metadata Sync stage.
5. A RECONCILE job is triggered via Storage Scheduler for detected divergences.

### Workflow 4: OAuth Authentication

**Trigger:** Renderer invokes `google-bridge:authenticate`, or system detects session expiration.

**Steps:**
1. `googleBridgeService.runOAuthHandshake` opens OAuth flow on port 3111.
2. Credentials are stored scoped per account; MUST NOT be persisted in Vault.
3. Session is sandboxed per account.
4. IPC handler returns `ServerResponse<boolean>` indicating success or failure.

### Workflow 5: Explicit Vault Commit

**Trigger:** Explicit user or operator action to commit an artifact for long-term retention.

**Steps:**
1. Service verifies that an existing SQLite projection record exists for the document (Mirror Constraint prerequisite).
2. Vault write occurs: content stored under `/vault/google/<doc_id>.md`.
3. `google_workspace_meta` updated: `vault_doc_id` and `content_hash` recorded.
4. On Vault write failure: explicit commit is blocked; STORED state of the document is unaffected.

---

## 8. State Realization

### 8.1 Main Process States

The pipeline state machine for each document is tracked in `google_workspace_meta.sync_status`.

| State | Meaning | Entry Condition |
|---|---|---|
| DISCOVERED | File identified in Drive traversal | Discovery stage completes |
| METADATA_SYNCED | File metadata written to SQLite | Metadata Sync stage completes (UPSERT succeeded) |
| EXTRACTED | Content extracted (Markdown / JSON / Slides text) | Extraction stage completes |
| STORED | SQLite projection written; Mirror Constraint satisfied | Local Projection stage completes |
| PROJECTED | Projection registered; content queryable | Projection Registration stage completes |
| STALE | Source `last_modified` newer than `last_synced_at` | VERIFY job detects divergence |
| FAILED | Extraction or processing error | Error in extraction or projection stage |
| RETRY_PENDING | Queued for retry after FAILED | Retry queue entry created |
| SKIPPED | Excluded by inclusion rules or operator action | Deliberate exclusion during Discovery |

**Transition rules:**
- Each transition MUST persist metadata before completing.
- Transitions MUST be idempotent.
- STALE MUST be re-queued from METADATA_SYNCED (not DISCOVERED).
- STORED MUST NOT be set until SQLite projection write succeeds.
- Vault write does not change `sync_status`; it only populates `vault_doc_id` and `content_hash`.

### 8.2 Renderer AppState Mapping

The renderer observes sync status via `useDataState`-managed `AppState<T>`. The pipeline states above are surfaced as data payloads within `SyncStatusSnapshot` and `WorkspaceMetaRecord` — they are not directly mapped to `StateType` values.

| Renderer State | StateType | isError | Meaning |
|---|---|---|---|
| No IPC call yet | INIT | false | Component mounted, no data |
| IPC invoke in flight | LOADING | false | Awaiting `google-bridge:status` response |
| Status data received | COMPLETED | false | `SyncStatusSnapshot` available |
| Documents list loaded | COMPLETED | false | `WorkspaceMetaRecord[]` available |
| IPC call failed | COMPLETED | true | Handler error or IPC transport failure |
| Real-time push update | COMPLETED | false | `setAppState` applied from push event |

---

## 9. Boilerplate Application Mapping

Prana CONSUMES Astra's boilerplate — it does not re-implement any of it.

| Astra Boilerplate | Applied Where | How Applied |
|---|---|---|
| `IpcService` | `googleBridgeIpc` repository | All IPC invoke and receive calls — never `window.electronAPI` directly |
| `ServerResponse<T>` | All `google-bridge:*` IPC handlers (main process) | All handlers return `ServerResponse.success(...)` or `ServerResponse.error(...)` via static factories |
| `useDataState<T>` | `useGoogleBridgeStatus`, `useGoogleBridgeDocuments`, `useGoogleBridgeSync` | Drives INIT → LOADING → COMPLETED lifecycle for each ViewModel hook |
| `AppStateHandler` | Sync status view, document list view | Routes LOADING / error / empty / success slots without custom branching |
| `AppStateProvider` | Prana renderer root (not this feature) | Wired once at renderer root; this feature's `AppStateHandler` instances inherit it automatically |
| `AppState<T>` | ViewModel hook return type | State container for all renderer data |
| `StateType` | ViewModel lifecycle checks | INIT=0, LOADING=1, COMPLETED=2 — error is COMPLETED+isError |
| `StateCode` | Initial status in `AppState` | `StateCode.IDLE` is the initial status before any IPC activity |
| `HttpStatusCode` | IPC handler response construction | Status codes on `ServerResponse` instances |

**Astra boilerplate boundaries:**
- Astra does NOT own the `ipcMain` handler registration — that is Prana-owned.
- Astra does NOT own the `contextBridge` / preload setup — that is Prana-owned.
- Astra does NOT own SQLite — that is Prana-owned.
- Astra does NOT own the OAuth lifecycle — that is Prana-owned.
- Astra does NOT own the Google API REST client — that is Prana-owned.
- `IpcService.receive()` returns an unsubscribe function — Prana's renderer feature MUST call it on unmount.

---

## 10. Permission Realization

| Permission Concern | Realization |
|---|---|
| Google OAuth scopes | Managed by `googleBridgeService.runOAuthHandshake`; scoped per account; not persisted in Vault |
| Read-only default | System defaults to read-only Google API access unless explicitly configured for write-back |
| Write-back restriction | Write-back to Google Docs requires explicit operator approval; not implemented in this version |
| Credential isolation | Credentials isolated per integration / per account via session containment |
| Vault access | Only the explicitly committed artifact path may write to `vault/google/`; Vault contents are never exposed externally |
| IPC handler validation | `google-bridge:*` IPC handlers accept typed payloads; IPC Validation is enforced per L2 §18 |
| Token storage prohibition | OAuth tokens MUST NOT be persisted in Vault |

---

## 11. Validation Realization

| Validation Concern | Realization |
|---|---|
| Duplicate ingestion prevention | UPSERT semantics on `google_workspace_meta`; state transition driven by `last_modified` timestamp comparison |
| Mirror Constraint before STORED | Pipeline ordering enforced: SQLite projection write MUST succeed before `sync_status` is set to STORED |
| Vault write prerequisite | Vault write MUST be gated on existing `google_workspace_meta` projection record for the `file_id` |
| Content hash on Vault write | `content_hash` MUST be recorded in `google_workspace_meta` when Vault write occurs |
| State idempotency | Each state MUST be idempotent — re-running a stage on a record already at that state produces no side effects |
| Metadata persistence before transition | Each stage MUST persist metadata to `google_workspace_meta` before advancing the state |
| Extraction repeatability | Extraction MUST be deterministic and repeatable — identical source content produces identical output |
| Lock enforcement | Scheduler lock MUST be checked before initiating any sync cycle; concurrent runs MUST be rejected |
| IPC payload typing | All `google-bridge:*` handlers validate typed input payloads before processing |
| Session scope | OAuth sessions MUST be scoped and sandboxed per account |

---

## 12. Error Realization

Every L2 failure mode is mapped to its technical realization.

| L2 Failure | Behavior | Technical Realization |
|---|---|---|
| API failure | Retry with backoff | `googleBridgeService` retry handler on `wrappedFetch` error; `sync_status` remains at current stage until retry succeeds or max retries exceeded |
| Extraction failure | Mark FAILED, retry | `sync_status` set to FAILED in `google_workspace_meta`; record entered into retry queue (RETRY_PENDING) |
| Metadata mismatch | Re-sync metadata | Record re-enters pipeline at Metadata Sync stage; UPSERT re-applies correct metadata |
| Vault write failure | Block explicit commit; STORED state unaffected for non-committed documents | Vault write path returns error to caller; `sync_status` not modified; `vault_doc_id` not written |
| Rate limiting | Throttle execution | `wrappedFetch` rate limiter defers subsequent requests; scheduler job pacing adjusted |
| Session expiration | Re-authenticate and retry | `googleBridgeService` detects 401 response; triggers `runOAuthHandshake`; retries after successful re-auth |
| Concurrent sync attempt | Rejected | Scheduler lock model returns `ServerResponse.error` for the second invocation |
| `window.electronAPI` unavailable in renderer | IPC returns status 500 | `IpcService` normalizes to `ServerResponse.error` with status 500; `AppStateHandler` renders error slot |
| IPC handler throws unexpected exception | IPC returns status 500 | `IpcService` normalizes to `ServerResponse.error` with status 500; ViewModel sets `isError = true` on COMPLETED |
| No Google connectivity at runtime | System remains functional | External Boundary: no runtime-critical operation depends on Google Workspace; local SQLite data continues to serve |

---

## 13. Integration Realization

### 13.1 Internal Prana Integrations

| Integrated Component | Integration Point | Contract |
|---|---|---|
| `storageSchedulerService` | Triggers sync cycles; fires VERIFY jobs | MUST prevent concurrent runs via lock model; `googleBridgeService` acquires/releases lock per job |
| SQLite Runtime (Local Domain) | `google_workspace_meta` reads and UPSERTs | All pipeline state transitions write to this table; authoritative for document IDs, sync status, version timestamps |
| SQLite Runtime (Document Domain) | Projection of extracted Docs Markdown | Consistent with `storage-architecture.md` §4; `file_id` as external source reference |
| SQLite Runtime (Sheet Domain) | Projection of extracted Sheets data | Structured table rows; `file_id` as external source reference |
| Vault Service | Explicit artifact commit writes to `vault/google/` | Mirror Constraint: SQLite projection MUST pre-exist; Vault write records `vault_doc_id` and `content_hash` in `google_workspace_meta`; Vault Service enforces mirror constraint during writes |
| Markdown Viewer Screen | Inspection of extracted Docs artifacts | Docs extraction output SHOULD be projected as Markdown; viewer preserves semantic headings, links, and list structure |
| PDF Viewer Screen | Inspection of non-convertible artifacts | Non-convertible artifacts MAY remain in PDF form; viewer enforces sandbox rendering and fail-closed behavior |

### 13.2 IPC Surface

| Channel | Type | Renderer Consumer |
|---|---|---|
| `google-bridge:status` | invoke (request/response) | `useGoogleBridgeStatus` via `googleBridgeIpc.getStatus()` |
| `google-bridge:list-documents` | invoke (request/response) | `useGoogleBridgeDocuments` via `googleBridgeIpc.listDocuments()` |
| `google-bridge:get-document` | invoke (request/response) | Ad-hoc document detail view |
| `google-bridge:trigger-sync` | invoke (request/response) | `useGoogleBridgeSync` via `googleBridgeIpc.triggerSync()` |
| `google-bridge:authenticate` | invoke (request/response) | Authentication action in renderer |
| `google-bridge:sync-progress` | receive (push event) | `useGoogleBridgeStatus` via `IpcService.receive()` with unsubscribe on unmount |

### 13.3 External Systems

| System | Integration Type | Trust Level | Notes |
|---|---|---|---|
| Google Drive REST API | REST via `wrappedFetch` (port 3111 OAuth) | Non-trusted external | Discovery and metadata retrieval |
| Google Docs API | REST via `wrappedFetch` | Non-trusted external | Document content extraction |
| Google Sheets API | REST via `wrappedFetch` | Non-trusted external | Sheet content extraction |
| Google Slides API | REST via `wrappedFetch` | Non-trusted external | Slides text extraction (metadata/discovery only; no storage domain) |

No runtime-critical Prana operation depends on Google Workspace availability. The system remains functional without Google connectivity.

---

## 14. Ownership Mapping

### 14.1 Responsibility Ownership

| Responsibility | Owner |
|---|---|
| Google API REST client (`wrappedFetch`) | Prana |
| OAuth handshake and credential lifecycle | Prana |
| `googleBridgeService` orchestration | Prana |
| SQLite schema (`google_workspace_meta`) | Prana |
| SQLite Document domain projection | Prana |
| SQLite Sheet domain projection | Prana |
| Vault write path | Prana |
| `ipcMain` handler registration (`google-bridge:*`) | Prana |
| `contextBridge` / preload setup | Prana |
| Scheduler lock model | Prana (`storageSchedulerService`) |
| Stale detection and re-queue logic | Prana |
| Retry and backoff logic | Prana |
| Session containment per account | Prana |
| Observability counters | Prana |
| `googleBridgeIpc` repository | Prana (consumes Astra's `IpcService`) |
| `useGoogleBridgeStatus` ViewModel hook | Prana (consumes Astra's `useDataState`) |
| `useGoogleBridgeDocuments` ViewModel hook | Prana (consumes Astra's `useDataState`) |
| `useGoogleBridgeSync` ViewModel hook | Prana (consumes Astra's `useDataState`) |
| View components and page containers | Prana (consumes Astra's `AppStateHandler`) |

### 14.2 Astra vs Prana Ownership

| Concern | Astra Owns | Prana Owns |
|---|---|---|
| IPC transport abstraction | `IpcService` (invoke, send, receive) | `ipcMain` handler registration; `window.electronAPI` exposure via preload |
| Response normalization | `ServerResponse<T>` factories; `IpcService` error normalization | Returning correct `ServerResponse<T>` shape from all `google-bridge:*` handlers |
| ViewModel state lifecycle | `useDataState<T>` (INIT→LOADING→COMPLETED) | Custom hooks wrapping `useDataState` for each Google Bridge surface |
| Conditional rendering | `AppStateHandler` (slot routing) | Feature-specific success/empty/error components |
| Provider wiring | `AppStateProvider` pattern | Wiring `AppStateProvider` once at Prana renderer root |
| SQLite persistence | Nothing | All SQLite schema and write logic |
| OAuth lifecycle | Nothing | Full OAuth handshake implementation |
| Google API communication | Nothing | Full REST client implementation |
| Retry and error recovery | Nothing | All retry, backoff, and recovery logic |

---

## 15. Architecture Traceability Matrix

| Architectural Invariant (L1) | Application in This Feature |
|---|---|
| MVVM Separation — ViewModel is sole bridge between View and Repository | `useGoogleBridgeStatus`, `useGoogleBridgeDocuments`, `useGoogleBridgeSync` are the sole bridges; view components never import `googleBridgeIpc`; repository has no UI logic |
| Repository Isolation — all IPC through IpcService, never window.electronAPI directly | `googleBridgeIpc` uses `IpcService.invoke()` and `IpcService.receive()` exclusively |
| IPC Response Shape — all handlers return ServerResponse\<T\> | All `google-bridge:*` main-process handlers return `ServerResponse.success(...)` or `ServerResponse.error(...)` |
| State Lifecycle — INIT → LOADING → COMPLETED; error is COMPLETED + isError | All three ViewModel hooks follow this lifecycle via `useDataState` |
| AppStateProvider wired once at renderer root | This feature does not re-wire the provider; its `AppStateHandler` instances inherit root context |
| Boilerplate Ownership — Prana consumes, never re-implements | `IpcService`, `useDataState`, `AppStateHandler`, `ServerResponse` are imported from `'astra'`, not re-implemented |
| Runtime Boundary — no Electron APIs in Astra core | `IpcService` delegates to `window.electronAPI` without importing Electron; Prana owns `ipcMain` and preload |
| Push Events via receive() — unsubscribe on unmount | `useGoogleBridgeStatus` calls the unsubscribe function returned by `IpcService.receive()` on component unmount |
| Target Consistency — ViewModel identical across WEB/ELECTRON | ViewModel hooks are identical in structure to WEB; only `googleBridgeIpc` (using `IpcService`) differs from a hypothetical API-based implementation |

---

## 16. Feature Traceability Matrix

| L2 Section | L2 Requirement | Realized In |
|---|---|---|
| §1 Tactical Purpose | Remote discovery layer | §4.1 Service Architecture (Discovery stage) |
| §1 Tactical Purpose | Document synchronization layer (Docs → Markdown) | §4.1 (Extraction stage, Docs branch); §4.3 SQLite Document domain |
| §1 Tactical Purpose | Sheet synchronization layer (Sheets → structured rows) | §4.1 (Extraction stage, Sheets branch); §4.3 SQLite Sheet domain |
| §1 Tactical Purpose | Metadata synchronization layer (state tracking, version timestamps) | §4.3 `google_workspace_meta` schema |
| §2 System Invariant 1 | Mirror Constraint — ingested Google doc MUST exist as SQLite projection | §4.1 pipeline ordering; §11 Validation (Mirror Constraint before STORED) |
| §2 System Invariant 1 | Artifacts committed for retention MUST exist in Vault | §7 Workflow 5; §11 Validation (Vault write prerequisite) |
| §2 System Invariant 2 | Read-First Safety — default read-only | §10 Permission Realization |
| §2 System Invariant 3 | External Isolation — Google as non-trusted system | §4.1 (wrappedFetch); §13.3 External Systems |
| §2 System Invariant 4 | Deterministic Sync Boundary — scheduler or explicit user action | §7 Workflows 1 and 2 |
| §2 System Invariant 5 | SQLite as authoritative state tracker | §4.3 `google_workspace_meta` schema |
| §2 System Invariant 6 | Session Containment — sandboxed per account | §4.1 Service Architecture; §10 Permission Realization |
| §4 Workspace State Model | DISCOVERED → METADATA_SYNCED → EXTRACTED → STORED → PROJECTED | §8.1 Main Process States |
| §4 State Rules | Each state persists metadata before transition; idempotent | §8.1 transition rules; §11 Validation |
| §4 STALE transition rule | STORED/PROJECTED → STALE when source newer; re-queue from METADATA_SYNCED | §7 Workflow 3; §8.1 |
| §5.1 Discovery | Traverse folders, filter MIME type | §4.1 Service Architecture (Discovery stage) |
| §5.2 Metadata Sync | UPSERT with no duplicate records | §4.3 UPSERT semantics; §11 Validation |
| §5.3 Extraction | Docs→Markdown, Sheets→JSON, Slides→text (no storage domain) | §4.1 Extraction stage; §4.3 schema notes |
| §5.4 Local Projection | SQLite Document and Sheet domains; STORED before Vault | §4.3; §7 Workflow 1; §11 |
| §5.5 Vault Persistence | Out-of-band explicit commit; SQLite projection prerequisite | §7 Workflow 5; §13.1 Vault Service |
| §5.6 Projection Registration | PROJECTED state; queryable by runtime services | §8.1; §7 Workflow 1 step 6 |
| §6.1 Data Contract | `google_workspace_meta` schema | §4.3 SQLite Schema |
| §7 Scheduler Integration | No overlapping cycles; lock model | §4.1 Service Architecture; §4.4 Startup; §11 |
| §8 Storage Governance | Local domain, Document domain, Sheet domain, Vault governance | §4.3; §13.1 |
| §9 Failure Modes | All six failure scenarios | §12 Error Realization (all six mapped) |
| §10 Observability | Six observability counters tracked | §4.1 Observability Counters; §4.2 `google-bridge:status` channel |
| §11 Deterministic Guarantees | `last_modified` driven; no duplicates; SQLite before Vault; no corruption; offline capable | §8.1; §11 Validation; §12; §13.3 |
| §12 Security Boundaries | Non-trusted external; no Vault exposure; no token in Vault; isolated credentials | §10 Permission Realization; §4.1 |
| §14 Cross-Module Contracts | Scheduler prevents concurrent runs; Vault enforces mirror constraint | §13.1 Internal Prana Integrations |
| §16 Viewer Integration | Markdown viewer and PDF viewer path; human verification | §13.1 Markdown Viewer, PDF Viewer |
| §18 Security Enforcement | wrappedFetch; Mirror Constraint; IPC Validation | §4.1; §10; §11 |

---

## 17. Open Questions

| ID | Area | Question | Source |
|---|---|---|---|
| OQ-1 | Renderer Surface Scope | L2 mandates observability (§10) but does not specify whether all six counter types are exposed in a single `SyncStatusSnapshot` payload or as separate IPC queries. The `google-bridge:status` channel is assumed to return a composite snapshot. Confirmation needed. | L2 §10 vs §4.2 channel design |
| OQ-2 | Slides Storage Domain | L2 §5.3 explicitly states Slides have no SQLite storage domain and are out of scope for Mirror Constraint enforcement. If a Slides storage domain is defined in a future version, the pipeline's Extraction and Projection stages will need corresponding main-process branches and SQLite schema. No action required for v2.0.0. | L2 §5.3 scope note |
| OQ-3 | RETRY_PENDING Re-queue Mechanism | L2 §4.2 (extended states) lists RETRY_PENDING but does not specify the retry scheduling mechanism (immediate retry, scheduler next cycle, or a dedicated retry queue). The current realization assumes scheduler-driven retry on the next cycle. Confirmation needed. | L2 §4.2, §9 |
| OQ-4 | Renderer Trigger Sync Permission | L2 does not specify whether the `google-bridge:trigger-sync` IPC surface is accessible to all renderer contexts or restricted. If role-based access or operator-only gating is required, the IPC handler validation contract in §4.2 must be extended. | L2 §4 Deterministic Sync Boundary |
| OQ-5 | Conflict Resolution (Vault ↔ SQLite ↔ Google) | L2 §17 (Strategic Note) identifies conflict resolution rules as a mandatory next concern for the Sync Engine across Vault ↔ SQLite and SQLite ↔ Google. No resolution strategy is defined in L2 for v2.0.0. The STALE re-queue mechanism is the closest realized approximation. | L2 §17 |
| OQ-6 | Adaptive Rate Limiting | L2 §13 (Known Gaps) identifies the absence of an adaptive throttling strategy as a medium-impact gap. The current realization uses `wrappedFetch`-level throttling. Whether a more sophisticated adaptive rate limiter is required within v2.0.0 is not specified. | L2 §13 |
| OQ-7 | Large File Handling | L2 §13 (Known Gaps) identifies no handling for large or complex documents as a medium-impact gap. No extraction size limit or chunking strategy is defined in L2. Out of scope for v2.0.0 unless confirmed otherwise. | L2 §13 |
| OQ-8 | Push Channel Scope | The `google-bridge:sync-progress` push channel emits per-document progress. L2 does not specify the granularity (per stage transition vs per document completion). The current design assumes per-document status update at each stage transition. Confirmation needed. | L2 §10, §5 pipeline stages |
