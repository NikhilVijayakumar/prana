# Storage Architecture — Technical Realization

**Version:** 2.0.0
**Feature Spec:** docs/raw/features/storage-architecture.md
**Architecture Ref:** docs/raw/external-context/astra.md

---

## 1. Overview

Storage Architecture is a governance document that defines the persistence substrate, domain classification model, synchronization rules, and security boundaries for the entire Prana runtime. It does not define a user-facing feature; it defines the foundational infrastructure on which all other features depend.

This document describes how those governance rules are technically realized within Prana's Electron architecture using Astra's patterns where applicable. Because storage architecture is a main-process-only concern — SQLite, the Sync Engine, Vault, and domain adapters all live in the Node.js main process and have no direct renderer representation — there is no Astra MVVM structure specific to this feature. Consumer features that surface storage data to the renderer each define their own MVVM structure independently, consuming Astra boilerplate in the standard way.

---

## 2. Feature Summary

Storage Architecture defines a unified, four-domain persistence model:

| Domain | Backing Store | Sync Direction | Authoritative Source |
|--------|---------------|----------------|----------------------|
| Local | SQLite only | None | SQLite |
| Vault | SQLite + Vault file store | Bidirectional (via Sync Engine + Git) | Vault file store |
| Document | SQLite + external document provider | PULL (provider → SQLite) | External provider (e.g. Google Docs) |
| Sheet | SQLite + external sheet provider | PULL (provider → SQLite) | External provider (e.g. Google Sheets) |

The core principle is the Single Runtime Access Surface: all runtime services, applications, and feature modules interact exclusively with SQLite. No component accesses Git, Vault, Google Workspace, or any external provider directly. All cross-domain movement is mediated by the Sync Engine through domain adapters.

---

## 3. Architecture Mapping

Storage Architecture is a main-process infrastructure concern. The mapping to Astra's architecture patterns is indirect: Astra patterns govern how feature modules in the renderer interact with data that originates from the storage system, but the storage system itself — SQLite, the Sync Engine, Vault, domain adapters — is owned entirely by Prana's Node.js main process.

| Storage Architecture Concern | Astra Pattern Involvement | Owner |
|-------------------------------|--------------------------|-------|
| SQLite Runtime Store | None — Node.js runtime | Prana main process |
| Sync Engine and domain adapters | None — internal main-process services | Prana main process |
| IPC surface exposing storage data to renderer | IpcService (renderer), ServerResponse<T> (main process handler contract) | Prana (both processes) |
| Renderer features consuming storage-derived data | IpcService + useDataState + AppStateHandler | Prana renderer (per feature) |
| AppStateProvider wiring | Consumed once at renderer root | Prana renderer root |

Astra's architectural invariants that apply here:

- All IPC handlers in the main process that expose storage data must return `ServerResponse<T>` — this is a hard contract required by `IpcService.invoke()` and `useDataState` in consuming feature ViewModels.
- Astra is explicitly not a persistence library. SQLite management, WAL configuration, connection pooling, domain registration, and schema migration are Prana responsibilities, not Astra responsibilities.
- Astra does not own ipcMain, contextBridge, or BrowserWindow — those belong to Prana's Electron runtime.

---

## 4. Main Process Design

### 4.1 Service Architecture

The main process hosts the complete storage system. The primary services are:

**SQLite Runtime Service**
Owns the SQLite database lifecycle: initialization, WAL mode configuration, connection management, and teardown. It is the single access surface for all runtime state. It provides read and write access to all four domain projections. No other service holds a direct database connection outside of the context it provides.

**Sync Engine**
The sole authorized mutator across domain boundaries. It orchestrates synchronization between the SQLite runtime store and each domain's external backing store. It delegates to domain adapters per domain type. It enforces the Mirror Constraint: source artifact and SQLite projection must remain logically equivalent after each sync cycle.

**Vault Adapter**
Manages bidirectional synchronization between the Vault file store and the SQLite Vault projection. It is the only component that reads or writes Vault files directly. It coordinates with Git for version history, point-in-time recovery, and replication. All Git operations are confined to this adapter — no other runtime module touches Git.

**Document Adapter**
Manages PULL synchronization from external document providers (Google Docs) into the SQLite Document projection. It handles discovery, metadata sync, extraction, and projection. It marks projections stale when source documents are deleted or are unreachable.

**Sheet Adapter**
Manages PULL synchronization from external sheet providers (Google Sheets) into the SQLite Sheet projection. It handles structured row/column extraction and projection into relational SQLite tables. Schema is derived from provider structure at sync time.

**Workspace Bridge**
The integration surface between Prana and Google Workspace APIs. It provides discovery, metadata sync, extraction, projection, change detection, and synchronization primitives consumed by the Document and Sheet adapters. It treats Google Workspace as an external, untrusted, optional provider — the runtime must remain operational without Workspace connectivity.

> **Naming note:** The Workspace Bridge is the architectural boundary name for the Google Workspace integration surface. It is implemented by `googleBridgeService` (defined in the Google Ecosystem Integration technical document). These names refer to the same component — "Workspace Bridge" is used in architectural context; `googleBridgeService` is the implementation identifier.

**Storage Scheduler Integration**
The Document and Sheet adapters are triggered on a configured schedule by the Storage Scheduler feature. Divergence detected by the Sync Engine also triggers a RECONCILE job via Storage Scheduler.

### 4.2 IPC Channel Contract

Storage Architecture as a governance layer does not define a single feature-scoped IPC surface. Instead, each consumer feature that surfaces storage data to the renderer defines its own IPC channels following the `{feature}:{action}` convention.

The invariant that applies to all such channels is:

- Every IPC handler that exposes storage-derived data must return `ServerResponse<T>` so that consuming feature ViewModels using `useDataState` can process the response correctly.
- IPC channels for storage-adjacent concerns (e.g., sync status, domain health, projection metadata) follow the same pattern.

Representative channel patterns that storage-adjacent features will define:

| Channel Pattern | Direction | Return Type |
|-----------------|-----------|-------------|
| `{domain}:list` | invoke | `ServerResponse<T[]>` |
| `{domain}:get` | invoke | `ServerResponse<T>` |
| `storage:status` | invoke | `ServerResponse<StorageStatus>` |
| `sync:trigger` | invoke | `ServerResponse<boolean>` |
| `sync:status` | receive | Push event to renderer |

The `receive` pattern uses `IpcService.receive()` on the renderer side to subscribe to push events from the main process for real-time sync status updates.

### 4.3 SQLite Schema

Prana owns the complete SQLite schema. The runtime store contains the following categories of tables:

**Local Domain Tables**
Hold ephemeral, device-scoped state: user preferences, theme settings, window layout, navigation position, and temporary cache entries. These tables have no corresponding external record and are never synchronized.

**Vault Projection Tables**
Hold system-owned state projected from the Vault file store: system registry state, runtime configuration, application metadata, and committed knowledge artifacts. These tables are populated exclusively by the Vault Adapter via the Sync Engine.

**Document Projection Tables**
Hold read projections of externally authored documents: Markdown content, knowledge articles, research material. Schema is defined per document type. Tables are populated exclusively by the Document Adapter.

**Sheet Projection Tables**
Hold structured tabular projections from external sheet providers: master data, reference tables, business datasets. Schema is derived from provider structure at sync time. Tables are populated exclusively by the Sheet Adapter.

**Synchronization Metadata Tables**
Hold sync state, last-synced timestamps, stale markers, reconciliation job records, and domain registration metadata. Prana owns these tables; applications do not write to them directly.

Ownership split:
- Prana owns: database lifecycle, WAL configuration, connection management, synchronization metadata tables, domain registration tables.
- Applications (features) own: business schemas, their own migration scripts, domain entity definitions.

### 4.4 Startup and Teardown

**Startup Sequence**
1. SQLite Runtime Service initializes the database, applies any pending migrations, and enables WAL mode.
2. Domain registration is confirmed — each domain's projection tables are verified to exist.
3. The Sync Engine starts and checks sync metadata for any interrupted or overdue sync jobs from the previous session.
4. The Storage Scheduler is notified that storage services are ready; it may immediately trigger pending RECONCILE jobs.
5. The main process signals readiness to the renderer process.

**Teardown Sequence**
1. In-progress sync operations are allowed to reach a safe checkpoint; new sync jobs are rejected.
2. The Sync Engine flushes pending SQLite writes.
3. The SQLite Runtime Service closes the database connection cleanly, ensuring WAL is checkpointed.
4. All adapters release external provider connections (e.g., Google Workspace API sessions).

**Failure During Startup**
If SQLite fails to initialize or migrations fail, the main process must not signal renderer readiness. The renderer should be informed via an IPC error response so `useDataState` in any consuming feature reflects an error state.

---

## 5. Renderer Design (Astra MVVM)

Storage Architecture is a main-process-only governance layer. The SQLite Runtime Store, Sync Engine, Vault Adapter, Document Adapter, Sheet Adapter, and Workspace Bridge all reside in the Node.js main process and have no direct renderer representation.

There is no Astra MVVM structure, IpcService repository, ViewModel hook, or AppStateHandler defined at the storage architecture level. Each consumer feature (e.g., event registry, Google ecosystem integration) that surfaces storage-derived data to the renderer defines its own complete MVVM structure independently, consuming Astra boilerplate in the standard way.

The storage architecture governance rules that flow through to renderer-side features are:
- All IPC handlers returning storage data must produce `ServerResponse<T>`.
- Feature repositories in the renderer must use `IpcService` to access any storage-derived data — never `window.electronAPI` directly.
- Storage data is never accessed from the renderer except through IPC channels defined by the owning feature.

---

## 6. Responsibility Realization Matrix

| L2 Responsibility | Realized By | Process | Notes |
|-------------------|-------------|---------|-------|
| Provide unified storage architecture across four domains | Domain classification model enforced by Sync Engine and SQLite service | Main | Governance layer |
| Local domain: ephemeral, device-scoped, no sync | SQLite Runtime Service — Local domain tables, no adapter registered | Main | Write by any runtime service; read locally only |
| Vault domain: durable, system-owned, Git-backed | Vault Adapter + Sync Engine + Git operations | Main | Only Sync Engine may write |
| Document domain: PULL sync from external document provider | Document Adapter + Workspace Bridge + Storage Scheduler | Main | SQLite projection inbound-only |
| Sheet domain: PULL sync from external sheet provider | Sheet Adapter + Workspace Bridge + Storage Scheduler | Main | SQLite projection inbound-only |
| Single Runtime Access Surface — all components use SQLite | SQLite Runtime Service as sole access point; adapters are the only path to external stores | Main | Enforced by architecture; no direct external access |
| Sync Engine as sole authorized mutator across domains | Sync Engine service owns all cross-domain writes | Main | Domain adapters report to Sync Engine |
| Mirror Constraint — source and projection must be logically equivalent | Sync Engine enforces pre-terminal consistency check; divergence triggers RECONCILE via Storage Scheduler | Main | Governs all synchronized domains |
| Vault write atomicity — SQLite projection and Vault file update together | Vault Adapter performs atomic write; both sides must succeed or both roll back | Main | |
| No runtime component reads Vault directly | Architecture rule — only SQLite projection exposed to runtime services | Main | |
| Git operations confined to Vault Adapter | Vault Adapter is sole Git client | Main | Git is semi-trusted zone |
| Google Workspace treated as external, untrusted, optional | Workspace Bridge validates all inbound data; runtime operational without Workspace | Main | Untrusted zone handling |
| Runtime operational without Workspace connectivity | Workspace Bridge handles unavailability gracefully; adapters mark projections stale rather than failing | Main | |
| SQLite database lifecycle ownership | SQLite Runtime Service owns init, WAL, connections, teardown | Main | Prana-owned, not Astra |
| Domain registration and synchronization metadata | SQLite Runtime Service owns these tables | Main | Applications own business schemas |
| IPC response shape for storage-derived data | All main-process IPC handlers return `ServerResponse<T>` | Main | Required by Astra IpcService contract |
| Extensible domain model — new domains without modifying runtime services | Domain adapter interface allows new adapter registration | Main | Future domains: Repository, Communication |

---

## 7. Workflow Realization

### Workflow: Local Domain Write

A runtime service writes UI state or preferences to the Local domain. It calls the SQLite Runtime Service directly. No sync job is created. The write completes immediately with no external side effects.

### Workflow: Vault Write

The Sync Engine receives a write request for Vault data. The Vault Adapter executes an atomic operation: it writes the record to the Vault file store and updates the SQLite Vault projection in the same logical transaction. On success, the Vault Adapter initiates a Git commit to record the change. If the Vault file write fails before the Git commit begins, both the Vault file write and the SQLite projection update are rolled back (atomic failure). If the Vault file write succeeds and the SQLite projection update succeeds, but the subsequent Git commit fails: the data remains in Vault and SQLite (no rollback); the Git commit failure is recorded and retried per retry policy. Git commit is a durable persistence step, not an atomic gate — its failure does not undo the already-successful write.

### Workflow: Document PULL Sync

The Storage Scheduler triggers a Document sync job (or a RECONCILE job is triggered by divergence detection). The Sync Engine invokes the Document Adapter. The Document Adapter authenticates with the Workspace Bridge and pulls content from the configured Google Docs source. The content is validated, extracted, and projected into the SQLite Document projection tables. Sync metadata is updated to reflect the new last-synced timestamp. If the source document has been deleted, the projection is marked stale.

### Workflow: Sheet PULL Sync

Analogous to Document PULL Sync. The Sheet Adapter pulls structured tabular data from Google Sheets via the Workspace Bridge, derives schema from provider structure, and projects it into SQLite Sheet projection tables.

### Workflow: Mirror Constraint Enforcement

At the conclusion of each sync operation, the Sync Engine checks that the source artifact and its SQLite projection are logically equivalent. If divergence is detected, the sync state is not transitioned to a terminal success state. A RECONCILE job is submitted to the Storage Scheduler for a subsequent attempt.

### Workflow: Renderer Feature Accessing Storage Data

A renderer feature (e.g., event registry viewer) needs data that originates from the Vault or Document projection. The feature's repository layer calls `IpcService.invoke()` with the appropriate feature channel. The main-process IPC handler reads from SQLite and returns `ServerResponse<T>`. The feature's ViewModel receives the response via `useDataState`, transitions through `INIT → LOADING → COMPLETED`, and the View renders the result via `AppStateHandler`. The feature never accesses SQLite, the Sync Engine, or any external provider directly.

### Workflow: Startup

SQLite initializes, migrations run, WAL is enabled, domain tables are verified, and the Sync Engine checks for overdue or interrupted jobs. The Storage Scheduler is notified. The renderer is signaled ready. If SQLite initialization fails, the renderer is informed through an IPC error path.

### Workflow: Adding a New Domain

A new domain adapter is registered with the Sync Engine. It implements the domain adapter interface. New projection tables are added via migration. The SQLite Runtime Store remains the single access surface without modification to existing runtime services.

---

## 8. State Realization

### 8.1 Main Process States

| Component | State | Meaning |
|-----------|-------|---------|
| SQLite Runtime Service | INITIALIZING | Applying migrations, enabling WAL |
| SQLite Runtime Service | READY | Database open, all domain tables verified |
| SQLite Runtime Service | CLOSING | Flushing writes, checkpointing WAL |
| SQLite Runtime Service | ERROR | Initialization or migration failure |
| Sync Engine | IDLE | No active sync jobs |
| Sync Engine | SYNCING | Active sync job in progress for one or more adapters |
| Sync Engine | RECONCILING | Executing a RECONCILE job due to detected divergence |
| Sync Engine | ERROR | Sync job failed; recorded in sync metadata |
| Domain Projection | SYNCHRONIZED | Source and projection are logically equivalent |
| Domain Projection | STALE | Source deleted or unreachable; projection may be outdated |
| Domain Projection | DIVERGED | Inconsistency detected; RECONCILE pending |

### 8.2 Renderer AppState Mapping

Storage Architecture itself has no renderer AppState. Consumer features that expose storage data to the renderer use the standard Astra `AppState<T>` lifecycle:

| Renderer AppState | Meaning in Storage Context |
|-------------------|-----------------------------|
| INIT (StateType=0) | Feature has not yet requested data from SQLite via IPC |
| LOADING (StateType=1) | IPC invoke in flight; SQLite query executing in main process |
| COMPLETED + isSuccess | SQLite data returned successfully; projection was available and current |
| COMPLETED + isError | IPC handler returned an error (e.g., SQLite not ready, domain not registered, sync error propagated) |

The stale or diverged projection state is a main-process concern. Whether to surface it to the renderer is a decision for each consumer feature — it may choose to include staleness metadata in its `ServerResponse<T>` data payload.

---

## 9. Boilerplate Application Mapping

Prana consumes Astra boilerplate for all renderer-side features that surface storage data. Storage Architecture itself (main process) does not consume Astra boilerplate. The mapping applies to consumer features only.

| Astra Boilerplate | Application in Storage Context |
|-------------------|-------------------------------|
| `IpcService` | Used by every renderer-side feature repository that reads storage-derived data via IPC. Prana consumes — never re-implements. |
| `ServerResponse<T>` | All main-process IPC handlers that return storage data must produce this shape using `ServerResponse.success()` or `ServerResponse.error()` factories. Prana main process is the producer; Astra's `IpcService` is the consumer on the renderer side. |
| `useDataState<T>` | Used by each consumer feature's ViewModel hook to drive the INIT→LOADING→COMPLETED lifecycle when fetching storage data over IPC. |
| `AppStateHandler` | Used by each consumer feature's View layer to render loading, error, empty, and success states for storage-derived data. |
| `AppStateProvider` | Wired once at Prana's renderer root. All storage-data consumer features inherit the design system Loading/Error/Empty components automatically. |
| `AppState<T>`, `StateType`, `StateCode` | State container types used by consumer feature ViewModels. Not used by main-process storage services. |

Astra's boilerplate-ownership invariant applies: Prana must never re-implement `IpcService`, `useDataState`, `AppStateHandler`, or `ServerResponse`. These are consumed from `'astra'`.

---

## 10. Permission Realization

| Permission Concern | Realization |
|--------------------|-------------|
| Vault write access | Restricted to Sync Engine only. No runtime service, application code, or renderer feature may write to Vault directly. Enforced by architecture — Vault Adapter is the only component with Vault file system access. |
| Git access | Restricted to Vault Adapter. No other component may invoke Git operations. |
| Google Workspace API access | Restricted to Workspace Bridge. Domain adapters consume the Bridge API; they do not hold direct API credentials or sessions. |
| SQLite write access (synchronized domains) | Restricted to domain adapters operating under Sync Engine authority. No runtime service writes to Vault, Document, or Sheet projection tables directly. |
| SQLite write access (Local domain) | Any runtime service may write to Local domain tables. |
| SQLite read access | All runtime services and IPC handlers may read from SQLite. No direct database access from the renderer — reads are mediated by IPC. |
| Renderer access to storage | Only via IPC channels. Renderer code never holds a database connection or a direct reference to any storage service. |

---

## 11. Validation Realization

| Validation Concern | Where Enforced | Rule |
|--------------------|----------------|------|
| Inbound data from untrusted external providers | Workspace Bridge | All data entering from Google Workspace must pass Discovery → Validation → Projection → Synchronization pipeline before being written to SQLite. |
| Atomic write enforcement for Vault | Vault Adapter | Both Vault file write and SQLite projection update must succeed atomically. Partial success is a failure condition. |
| Mirror Constraint post-sync check | Sync Engine | Source artifact and SQLite projection must be logically equivalent before transitioning sync state to terminal success. |
| Stale projection detection | Domain Adapters | If source is deleted or unreachable, the projection is marked stale rather than silently retained as current. |
| Schema consistency at sync time | Sheet Adapter | Sheet projection schema is re-derived from provider structure at each sync to detect structural changes. |
| SQLite schema version | SQLite Runtime Service | Migration scripts are applied at startup; initialization fails if migrations cannot complete cleanly. |
| IPC response shape | Main-process IPC handlers | All handlers must return `ServerResponse<T>` — enforced by the Astra `IpcService` contract on the renderer side. |

---

## 12. Error Realization

| Failure Scenario | Detection Point | Response |
|------------------|-----------------|----------|
| SQLite initialization failure | SQLite Runtime Service at startup | Startup halts; renderer is not signaled ready; IPC error returned to renderer features on first invoke |
| Migration failure | SQLite Runtime Service at startup | Same as initialization failure |
| Vault write partial failure (file written, projection not updated) | Vault Adapter atomic write | Both sides rolled back; sync state recorded as failed in metadata; no stale projection persists |
| Vault write partial failure (projection updated, file not written) | Vault Adapter atomic write | Both sides rolled back; consistent state restored |
| Git commit failure after Vault write | Vault Adapter | Vault and projection remain updated (data is not lost); Git failure is recorded; retry policy applied |
| Google Workspace unreachable | Workspace Bridge | Document/Sheet adapters mark affected projections stale; sync state recorded as failed; runtime continues operating from existing SQLite projections |
| Workspace data validation failure | Workspace Bridge inbound pipeline | Data rejected; projection not updated; failure recorded in sync metadata |
| Sync divergence detected (Mirror Constraint violated) | Sync Engine post-sync check | RECONCILE job submitted to Storage Scheduler; sync state not transitioned to terminal success |
| RECONCILE job repeated failure | Sync Engine / Storage Scheduler | Domain projection remains in DIVERGED state; consumer features receive stale data; open question on escalation policy |
| IPC handler error returned to renderer | Main-process IPC handler | `ServerResponse.error()` returned with appropriate `HttpStatusCode`; renderer feature ViewModel receives COMPLETED + isError via `useDataState`; `AppStateHandler` renders error state |
| `window.electronAPI` unavailable (renderer side) | `IpcService` normalization | `IpcService.invoke()` returns `ServerResponse` with status 500; ViewModel receives COMPLETED + isError |
| Domain adapter not registered for domain type | Sync Engine | Sync request rejected; error recorded; no projection update attempted |

---

## 13. Integration Realization

### 13.1 Internal Prana Integrations

| Integrating Feature | Integration Point | Nature |
|--------------------|-------------------|--------|
| Storage Scheduler | Triggers Document and Sheet PULL sync jobs on schedule; receives RECONCILE job requests from Sync Engine | Scheduling dependency |
| Event Registry | Reads registry state from Vault projection via SQLite; exposes data to renderer via its own IPC channels | Consumer of Vault domain |
| Google Ecosystem Integration | Provides authentication and API session management consumed by Workspace Bridge. The authentication hand-off contract: Google Ecosystem Integration (`googleBridgeService`) holds the OAuth session. The Workspace Bridge (implemented by `googleBridgeService`) provides an authenticated HTTP client to the Document and Sheet Adapters when they need to make API calls. The adapters do not hold tokens directly — they call through the Workspace Bridge per-operation. The Workspace Bridge is responsible for session refresh and retry on 401. | Credential provider for Document/Sheet adapters |
| All renderer features | Read domain-specific data from SQLite via feature-owned IPC channels; use Astra MVVM to display results | Consumer pattern |
| Prana Bootstrap | Initializes SQLite Runtime Service as part of application startup sequence | Startup dependency |

### 13.2 IPC Surface

Storage Architecture does not define a single IPC surface. It defines the invariant that all IPC channels exposing storage data must return `ServerResponse<T>`. Each consumer feature defines its own `{feature}:{action}` channels.

Storage-system-level channels (if exposed) follow the same convention:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `storage:status` | invoke | Query overall storage system health |
| `sync:trigger` | invoke | Manually trigger a sync job for a domain |
| `sync:status` | receive (push) | Real-time sync status updates to renderer subscribers |

All invoke channels return `ServerResponse<T>`. The `sync:status` push channel uses `IpcService.receive()` on the renderer side.

### 13.3 External Systems

| External System | Domain | Relationship | Access Path |
|-----------------|--------|--------------|-------------|
| Google Docs | Document | Authoritative source for Document domain content | Workspace Bridge → Document Adapter → Sync Engine |
| Google Sheets | Sheet | Authoritative source for Sheet domain structured data | Workspace Bridge → Sheet Adapter → Sync Engine |
| Google Slides | Document (future) | Presentation content | Workspace Bridge |
| Google Drive | Document/Sheet | Discovery and file management surface | Workspace Bridge |
| Git | Vault | Version history, point-in-time recovery, replication | Vault Adapter only |
| Microsoft 365, Notion, Confluence | Document (future) | Extended document providers | Future domain adapters |
| GitHub, GitLab, Bitbucket | Repository (future) | Repository domain | Future domain adapters |
| Slack, Teams | Communication (future) | Communication domain | Future domain adapters |

All external systems are accessed exclusively through their designated adapter; no runtime service or renderer feature contacts them directly.

---

## 14. Ownership Mapping

### 14.1 Responsibility Ownership

| Responsibility | Owner |
|----------------|-------|
| SQLite database lifecycle (init, WAL, connections, teardown) | Prana main process |
| Synchronization metadata tables | Prana main process |
| Domain registration | Prana main process |
| Sync Engine and domain adapter orchestration | Prana main process |
| Vault file store access | Prana main process (Vault Adapter) |
| Git operations | Prana main process (Vault Adapter) |
| Workspace Bridge and Google API access | Prana main process |
| Business schemas and migrations | Application features (Prana) |
| IPC handler implementation returning ServerResponse<T> | Prana main process (per feature) |
| IpcService transport (renderer side) | Astra — consumed by Prana renderer feature repositories |
| useDataState ViewModel lifecycle | Astra — consumed by Prana renderer feature hooks |
| AppStateHandler rendering | Astra — consumed by Prana renderer feature views |
| AppStateProvider root wiring | Prana renderer root (consumes Astra component) |

### 14.2 Astra vs Prana Ownership

| Concern | Astra | Prana |
|---------|-------|-------|
| SQLite persistence | Not Astra | Prana main process |
| IPC transport abstraction (IpcService) | Owns | Consumes |
| IPC handler implementation | Not Astra | Prana main process |
| ServerResponse<T> shape and factories | Owns | Consumes in main-process handlers and renderer repos |
| MVVM lifecycle (useDataState) | Owns | Consumed by each storage-data consumer feature |
| AppStateHandler rendering logic | Owns | Consumed by each storage-data consumer feature |
| Sync Engine | Not Astra | Prana main process |
| Domain adapters | Not Astra | Prana main process |
| Git client | Not Astra | Prana (Vault Adapter) |
| Google Workspace API client | Not Astra | Prana (Workspace Bridge) |
| Electron runtime (ipcMain, contextBridge, BrowserWindow) | Not Astra | Prana main process |

---

## 15. Architecture Traceability Matrix

| Astra Architectural Invariant | Application to Storage Architecture |
|-------------------------------|-------------------------------------|
| Astra is not a state persistence library | SQLite, Vault, domain adapters, and Sync Engine are entirely Prana-owned. Astra has no role in persistence mechanics. |
| Prana owns ipcMain, contextBridge, BrowserWindow, SQLite Runtime | All main-process storage services are Prana-owned. Astra provides abstractions (IpcService, ServerResponse) over the IPC boundary only. |
| All IPC handlers must return ServerResponse<T> | Every main-process handler that exposes storage data to the renderer must use ServerResponse.success() or ServerResponse.error() factories. This is the binding contract between Prana's storage services and Astra's IpcService. |
| Repositories use IpcService, never window.electronAPI directly | All renderer-side feature repositories that read storage data must use IpcService from 'astra'. |
| MVVM Separation — View never accesses Repository directly | Renderer features consuming storage data must route through ViewModel (useDataState) → Repository (IpcService) → IPC handler → SQLite. Views never call IPC directly. |
| Repository Isolation — no direct platform APIs in repositories | No renderer feature repository may call window.electronAPI, access SQLite, or contact external providers directly. |
| Runtime Boundary — Astra core never imports Electron or Node.js APIs | Storage services (SQLite, adapters, Sync Engine) are Prana-owned Node.js code. They do not exist in Astra. |
| AppStateProvider wired once at renderer root | All storage-data consumer features inherit the design system components. Each feature uses AppStateHandler without re-wiring the provider. |
| Boilerplate ownership — Astra owns IpcService, useDataState, AppStateHandler | Prana renderer features consume these. No storage feature re-implements them. |
| Target Consistency — ViewModel code identical across WEB and ELECTRON | Storage data consumer feature ViewModels use useDataState identically to any other Prana feature. Only the repository import differs. |

---

## 16. Feature Traceability Matrix

| L2 Section | L2 Requirement | Realized In |
|------------|----------------|-------------|
| §1 Domain Classification — Local | Device-scoped, no sync, ephemeral, any service may write | §4.1 SQLite Runtime Service local tables; §6 Local Domain Write workflow; §10 Local write permission |
| §1 Domain Classification — Vault | Durable, Sync Engine only writes, atomic, Git-backed | §4.1 Vault Adapter; §7 Vault Write workflow; §10 Vault write permission; §12 Vault write failure errors |
| §1 Domain Classification — Document | External provider authoritative, PULL only, scheduler-driven | §4.1 Document Adapter + Workspace Bridge; §7 Document PULL Sync workflow |
| §1 Domain Classification — Sheet | External provider authoritative, PULL only, scheduler-driven | §4.1 Sheet Adapter + Workspace Bridge; §7 Sheet PULL Sync workflow |
| §2 Core Storage Principle | Single Runtime Access Surface — all components use SQLite | §3 Architecture Mapping; §4.1 SQLite Runtime Service as sole surface; §6 responsibility row |
| §3 SQLite Runtime Store | Prana owns lifecycle, WAL, connections, sync metadata, domain registration | §4.1 SQLite Runtime Service; §4.3 SQLite Schema; §4.4 Startup/Teardown; §14 Ownership |
| §3 SQLite Runtime Store | Applications own business schemas and migrations | §4.3 SQLite Schema; §14.1 Responsibility Ownership |
| §4 Vault Domain | Only Sync Engine writes; atomic writes; no direct runtime reads | §4.1 Vault Adapter; §7 Vault Write workflow; §10 permissions; §11 validation |
| §4 Vault Domain | Git provides version history, recovery, replication | §4.1 Vault Adapter as sole Git client; §13.3 External Systems |
| §5 External Workspace Integration | Google Workspace is external, untrusted, optional | §4.1 Workspace Bridge; §9 Security Boundaries; §12 Workspace unreachable error |
| §5 External Workspace Integration | Runtime must remain operational without Workspace | §12 Workspace unreachable → stale projection, runtime continues |
| §6 Synchronization Architecture | Sync Engine is sole authorized mutator; uses domain adapters | §4.1 Sync Engine + adapters; §6 Responsibility Realization Matrix |
| §7 Mirror Constraint | Source and projection logically equivalent; divergence triggers RECONCILE | §11 Validation; §7 Mirror Constraint Enforcement workflow; §12 divergence error |
| §8 Storage Governance | LOCAL data in SQLite only; VAULT in SQLite + Vault; DOCUMENT/SHEET in SQLite + provider | §4.3 SQLite Schema domain categories; §6 Responsibility Realization Matrix |
| §9 Security Boundaries | Trusted/semi-trusted/untrusted zone model | §10 Permission Realization; §11 Validation (inbound data pipeline) |
| §10 Future Domain Model | New domains without modifying runtime services | §7 Adding a New Domain workflow; §13.3 External Systems future entries |

---

## 17. Open Questions

| ID | Question | Source |
|----|----------|--------|
| OQ-1 | The L2 states that Document and Sheet PUSH sync is a "future capability." No PUSH design is defined. When PUSH is introduced, it will require defining write-back validation rules, conflict resolution strategy, and the IPC surface for triggering PUSH operations. This document does not address PUSH. | L2 §1 Document/Sheet domains |
| OQ-2 | The L2 does not specify the escalation policy when a RECONCILE job fails repeatedly. It is unclear whether Prana should surface a persistent alert to the renderer, enter a degraded mode, or require manual intervention. No IPC channel or error code for escalated divergence is defined. | L2 §7 Mirror Constraint |
| OQ-3 | The L2 does not specify how staleness metadata (stale projections, last-sync timestamps, divergence state) is exposed to the renderer. It is unclear whether storage-adjacent IPC channels (e.g., `storage:status`) are defined here or delegated entirely to consumer features. | L2 §1 Document/Sheet domains; §6 Sync Engine |
| OQ-4 | The L2 lists Google Slides as a supported Workspace provider but does not assign it to a domain or define a domain adapter for it. It is unclear whether Google Slides maps to the Document domain or requires a new domain type. | L2 §5 Supported Providers |
| OQ-5 | The L2 does not specify whether the Vault Adapter's Git operations use an embedded Git library, a subprocess invocation, or an external Git service. The implementation mechanism affects error handling, startup dependencies, and permission requirements. | L2 §4 Vault Domain External Synchronization |
| OQ-6 | RESOLVED. The domain adapter extensibility contract: additional storage domains are added by registering a new domain adapter that implements the five-operation behavioral contract (PULL, PUSH, VERIFY, RECONCILE, RECOVER) as defined in `sync-engine.md`. The Storage Scheduler's lane configuration must include a lane for the new domain. The new adapter is registered during Bootstrap SERVICES_READY alongside existing adapters. No core Scheduler or Sync Engine modification is required — the adapter is discovered via the service registry. | L2 §10 Future Domain Model |
| OQ-7 | The L2 does not specify how the SQLite Runtime Service handles concurrent access from multiple main-process services writing to Local domain tables simultaneously. WAL mode is mentioned but no concurrency policy (e.g., write serialization, connection pooling strategy) is defined. | L2 §3 SQLite Runtime Store |
