# Storage Scheduler — Technical Realization

**Version:** 2.0.0
**Feature Spec:** docs/raw/features/storage-scheduler.md
**Architecture Ref:** docs/raw/external-context/astra.md

---

## 1. Overview

The Storage Scheduler is a Main Process service responsible for orchestrating all asynchronous storage operations within Prana. It coordinates synchronization, reconciliation, execution, queuing, locking, recovery, and conflict handling across the Vault, Document, and Sheet storage domains. It is the sole coordination layer between the SQLite Runtime Store and external storage backends.

This document defines how the Storage Scheduler is technically realized within Prana's Electron architecture, consuming Astra's boilerplate contracts where applicable and implementing storage-domain-specific runtime behavior directly in the Main Process.

---

## 2. Feature Summary

The Storage Scheduler provides:

- Deterministic scheduling and queuing of storage jobs across domain lanes
- Isolated execution lanes per storage domain (vault, document, sheet) with concurrency limits
- Execution lifecycle management: CREATED → QUEUED → CLAIMED → RUNNING → COMPLETED, with a FAILED → RETRY_PENDING → QUEUED failure path and CANCELLED / EXPIRED terminal states
- Trigger management: event, time, startup, shutdown, recovery, and manual triggers
- Mirror Constraint enforcement through VERIFY, RECONCILE, and RECOVER job generation
- Conflict detection, classification, blocking, and emission via the Event Registry
- Startup and crash recovery by loading non-terminal jobs from SQLite and rebuilding queues
- Observability exposure: queue depth, lane saturation, execution latency, retry count, failure rate, and recovery activity
- Externally configurable scheduling policy (schedules, priorities, concurrency limits, retry policies, lane configuration)

The Storage Scheduler does not execute domain-specific business logic, resolve conflicts, define synchronization policies, or own the Vault, Document, or Sheet domain state.

---

## 3. Architecture Mapping

The Storage Scheduler is a pure Main Process service. It has no Renderer-facing ViewModel, view layer, or Astra MVVM module of its own. Renderer consumers that need scheduler observability data (queue depth, lane saturation, job status) interact with it through IPC channels returning `ServerResponse<T>`, following Astra's ELECTRON repository pattern.

| Architectural Layer | Owner | Astra Pattern Applied |
|---|---|---|
| Scheduler service runtime | Prana Main Process | None — pure Node.js service |
| SQLite job persistence | Prana Main Process | None — Prana-owned SQLite |
| IPC channel handlers | Prana Main Process | `ServerResponse<T>` contract |
| Renderer repository (if consumed) | Prana Renderer | `IpcService` from Astra |
| Renderer ViewModel (if consumed) | Prana Renderer | `useDataState` from Astra |
| Renderer view routing (if consumed) | Prana Renderer | `AppStateHandler` from Astra |

The scheduler itself runs entirely in the Main Process. Astra's boilerplate enters the picture only at the IPC boundary — IPC handlers return `ServerResponse<T>`, and any Renderer feature that displays scheduler state consumes Astra's `IpcService`, `useDataState`, and `AppStateHandler`.

---

## 4. Main Process Design

### 4.1 Service Architecture

The Storage Scheduler is implemented as a singleton Main Process service (`storageSchedulerService`). Its internal structure follows these responsibilities:

**Scheduler Core**
Manages the job lifecycle state machine (CREATED → QUEUED → CLAIMED → RUNNING → COMPLETED / failure path / terminal states). Enforces global and per-lane concurrency limits. Acquires execution locks before dispatching to domain adapters.

**Lane Manager**
Maintains configurable execution lanes. Each lane is identified by domain (vault, document, sheet). Lanes are not hardcoded — the scheduler accepts lane definitions from external configuration at startup. Additional lanes may be registered by future modules without architectural change.

**Trigger Manager**
Handles all six trigger types: event-triggered (dirty flag on SQLite write), time-triggered (interval from external configuration), startup-triggered (recovery and initial sync jobs on application start), shutdown-triggered (pending flush before application exit), recovery-triggered (Mirror Constraint violation detected), and manual-triggered (user-initiated sync via IPC).

**Job Dispatcher**
Routes executing jobs to the Sync Engine, which delegates to the appropriate domain adapter. The dispatcher resolves the Sync Engine from the Service Registry at Scheduler initialization time (`resolve('syncEngine')`); the resolved reference is held for the Scheduler's lifetime. If `syncEngine` is not registered at Scheduler startup, the Scheduler fails with a `MissingServiceError`. The dispatcher does not implement domain logic — the Sync Engine and its domain adapters own all synchronization execution. Cross-reference: the Sync Engine's service resolution contract is defined in `sync-engine.md §11.1`.

**Mirror Constraint Enforcer**
Evaluates projection-source consistency across all three mirror pairs. Dispatches VERIFY jobs on schedule or event trigger. When a VERIFY job completes with divergence (`requiresReconcile: true`), the **Job Dispatcher** — not the Mirror Constraint Enforcer directly — creates the RECONCILE job based on the result returned by the Sync Engine. The Mirror Constraint Enforcer monitors RECONCILE job outcomes and generates RECOVER jobs when RECONCILE fails or source data is missing. Cross-reference: the VERIFY → RECONCILE handoff mechanism is defined in `sync-engine.md §6.3`.

**Conflict Handler**
Detects conflicts during VERIFY and RECONCILE jobs. Classifies conflict type. Writes a conflict record to SQLite. Emits a conflict event via the Event Registry. Blocks further sync on the affected record. Does not apply resolution strategy — that is owned by the domain adapter or application configuration.

**Observability Emitter**
Maintains runtime metrics: queue depth per lane, lane saturation, execution latency, retry counts, failure rate, and recovery activity. Exposes these through IPC and Event Registry.

**Recovery Manager**
On startup, loads all non-terminal jobs from SQLite, rebuilds lane queues, and resumes eligible work. Handles crash-interrupted jobs through persisted execution state.

### 4.2 IPC Channel Contract

All IPC channels follow the format `storage-scheduler:{action}`. All `invoke` channels return `ServerResponse<T>` constructed using `ServerResponse.success()` or `ServerResponse.error()` factory methods — never raw objects.

| Channel | Direction | Payload | Response `T` | Description |
|---|---|---|---|---|
| `storage-scheduler:status` | invoke | none | `SchedulerStatusData` | Returns current scheduler state: running, paused, or stopped |
| `storage-scheduler:queue-depth` | invoke | `{ lane?: string }` | `QueueDepthData` | Returns job counts per lane or all lanes |
| `storage-scheduler:job-list` | invoke | `{ domain?, status?, limit? }` | `StorageJob[]` | Returns jobs matching filters |
| `storage-scheduler:job-get` | invoke | `{ jobId: string }` | `StorageJob` | Returns a single job by ID |
| `storage-scheduler:trigger-sync` | invoke | `{ domain: string }` | `StorageJob` | Manually triggers a PULL/PUSH sync job for a domain |
| `storage-scheduler:trigger-reconcile` | invoke | `{ domain: string }` | `StorageJob` | Manually triggers a RECONCILE job for a domain |
| `storage-scheduler:cancel-job` | invoke | `{ jobId: string }` | `boolean` | Cancels a CREATED or QUEUED job |
| `storage-scheduler:metrics` | invoke | none | `SchedulerMetricsData` | Returns full observability metrics snapshot |
| `storage-scheduler:job-updated` | receive (push) | `StorageJob` | — | Push event emitted when job state changes |
| `storage-scheduler:conflict-detected` | receive (push) | `ConflictRecord` | — | Push event emitted when conflict is classified |
| `storage-scheduler:terminal-failure` | receive (push) | `StorageJob` | — | Push event emitted when a job reaches FAILED terminal state |

Push channels (`receive`) are registered by Renderer consumers using `IpcService.receive()`. The returned unsubscribe function must be called on component unmount.

### 4.3 SQLite Schema

The scheduler persists all operational state in the SQLite Runtime Store. All tables are Prana-owned.

**storage_jobs**

Stores the full lifecycle state of every storage job.

| Column | Type | Description |
|---|---|---|
| job_id | TEXT PK | Unique job identifier |
| domain | TEXT | vault / document / sheet |
| operation | TEXT | PUSH / PULL / RECONCILE / VERIFY / RECOVER |
| status | TEXT | CREATED / QUEUED / CLAIMED / RUNNING / COMPLETED / FAILED / RETRY_PENDING / CANCELLED / EXPIRED |
| priority | INTEGER | Lower number = higher priority |
| payload_ref | TEXT | Reference to domain-specific payload record |
| retry_count | INTEGER | Number of retries attempted |
| max_retries | INTEGER | Maximum retries allowed (from configuration) |
| created_at | TEXT | ISO 8601 timestamp |
| scheduled_at | TEXT | ISO 8601 timestamp, nullable |
| completed_at | TEXT | ISO 8601 timestamp, nullable |
| error_detail | TEXT | Last error message, nullable |
| lock_acquired_at | TEXT | ISO 8601 timestamp of lock acquisition, nullable |

**storage_conflict_records**

Stores conflict records written when a VERIFY or RECONCILE job detects an unresolvable divergence.

| Column | Type | Description |
|---|---|---|
| conflict_id | TEXT PK | Unique conflict identifier |
| domain | TEXT | Affected domain |
| payload_ref | TEXT | Reference to the conflicted record |
| conflict_type | TEXT | Conflict classification (e.g., SOURCE_MODIFIED, PROJECTION_MODIFIED, HASH_MISMATCH) |
| detected_at | TEXT | ISO 8601 timestamp |
| resolved_at | TEXT | ISO 8601 timestamp, nullable |
| resolution | TEXT | Resolution applied, nullable |
| blocked | INTEGER | 1 if sync is currently blocked on this record |

**scheduler_config**

Stores externally provided scheduling configuration at runtime.

| Column | Type | Description |
|---|---|---|
| config_key | TEXT PK | Configuration key |
| config_value | TEXT | JSON-serialized configuration value |
| updated_at | TEXT | ISO 8601 timestamp |

### 4.4 Startup and Teardown

**Startup Sequence**

1. Scheduler service is initialized during Prana Main Process bootstrap.
2. Externally provided configuration (lane definitions, concurrency limits, retry policies, schedule intervals) is loaded and applied.
3. Recovery Manager queries SQLite for all jobs in non-terminal states (CREATED, QUEUED, CLAIMED, RUNNING, RETRY_PENDING).
4. CLAIMED and RUNNING jobs are re-evaluated: if the process restarted, they are treated as interrupted and transitioned to RETRY_PENDING or FAILED depending on retry budget.
5. QUEUED and CREATED jobs are reloaded into lane queues in priority order.
6. Startup-triggered sync jobs are created for each configured domain.
7. Time-triggered scheduling intervals are started using externally provided frequencies.
8. Event listeners for dirty-flag-based triggers are registered with the SQLite change notification mechanism.

**Teardown Sequence**

1. On application shutdown signal, new job acceptance is suspended.
2. Shutdown-triggered flush jobs are created for domains with pending dirty records.
3. Active lane queues are allowed to drain up to a configurable timeout.
4. Any remaining RUNNING jobs are persisted with their current state for crash recovery on next startup.
5. Scheduler service is deregistered from the bootstrap lifecycle.

---

## 5. Renderer Design (Astra MVVM)

The Storage Scheduler is a Main Process-only service. It has no dedicated Renderer feature module. There is no scheduler-owned View, ViewModel, or Repository in the Renderer process.

Renderer features that need to display scheduler state (such as an Infrastructure UI or monitoring panel) implement their own Astra MVVM modules. Those modules follow the canonical structure — consuming `IpcService` in their repository layer, `useDataState` in their ViewModel, and `AppStateHandler` in their View — invoking the IPC channels defined in Section 4.2.

The scheduler is not responsible for defining or owning those Renderer modules. Any such modules are the responsibility of the feature that surfaces scheduler observability to users.

Push events from the scheduler (`storage-scheduler:job-updated`, `storage-scheduler:conflict-detected`, `storage-scheduler:terminal-failure`) are consumed via `IpcService.receive()` in the relevant Renderer ViewModel. The unsubscribe function returned by `receive()` must be called on component unmount.

---

## 6. Responsibility Realization Matrix

| L2 Responsibility | Realized By | Main Process Component |
|---|---|---|
| Coordinate SQLite ↔ Vault synchronization | Job Dispatcher + Vault Adapter | `storage-scheduler:trigger-sync` (domain=vault) |
| Coordinate SQLite ↔ Document synchronization | Job Dispatcher + Document Adapter | `storage-scheduler:trigger-sync` (domain=document) |
| Coordinate SQLite ↔ Sheet synchronization | Job Dispatcher + Sheet Adapter | `storage-scheduler:trigger-sync` (domain=sheet) |
| Detect and resolve mirror violations | Mirror Constraint Enforcer | VERIFY job generation |
| Detect missing projections | Mirror Constraint Enforcer | VERIFY job |
| Detect metadata drift | Mirror Constraint Enforcer | VERIFY job |
| Detect version divergence | Mirror Constraint Enforcer | VERIFY job |
| Startup recovery | Recovery Manager | Startup sequence step 3–5 |
| Interrupted sync recovery | Recovery Manager | Startup sequence step 4 |
| Retry execution | Job lifecycle state machine | FAILED → RETRY_PENDING → QUEUED path |
| Failed operation replay | Recovery Manager | Non-terminal job reload |
| Job Queues | Lane Manager | `storage_jobs` table + in-memory priority queues |
| Lane Isolation | Lane Manager | Per-domain lane with independent concurrency |
| Priority Management | Scheduler Core | `priority` column; lower number = higher priority |
| Concurrency Control | Scheduler Core | Global and per-lane concurrency limits from config |
| Execution Locking | Scheduler Core | `lock_acquired_at` column; lock before dispatch |
| Event Triggered jobs | Trigger Manager | Dirty flag listener on SQLite write |
| Time Triggered jobs | Trigger Manager | Interval timer from external config |
| Startup Triggered jobs | Trigger Manager | Startup sequence step 6 |
| Shutdown Triggered jobs | Trigger Manager | Teardown sequence step 2 |
| Recovery Triggered jobs | Trigger Manager | Mirror Constraint Enforcer emitting RECONCILE |
| Manual Triggered jobs | Trigger Manager | `storage-scheduler:trigger-sync` IPC invoke |
| Externally configurable scheduling policy | Scheduler Core | `scheduler_config` table; no hardcoded values |
| Job lifecycle state machine | Scheduler Core | CREATED→QUEUED→CLAIMED→RUNNING→COMPLETED |
| Failure path with retry | Scheduler Core | RUNNING→FAILED→RETRY_PENDING→QUEUED |
| Terminal states with event emission | Scheduler Core | FAILED terminal emits `storage-scheduler:terminal-failure` |
| Conflict detection | Conflict Handler | VERIFY / RECONCILE job execution |
| Conflict classification | Conflict Handler | `conflict_type` column in `storage_conflict_records` |
| Conflict record to SQLite | Conflict Handler | Insert to `storage_conflict_records` |
| Conflict event emission | Conflict Handler | `storage-scheduler:conflict-detected` push channel |
| Block sync on conflicted record | Conflict Handler | `blocked = 1` in `storage_conflict_records` |
| Observability exposure | Observability Emitter | `storage-scheduler:metrics` and `storage-scheduler:queue-depth` IPC; push events |
| Validate job inputs | Security boundary | Input validation in IPC handler before job creation |
| Enforce lane isolation | Lane Manager | Cross-lane failure isolation |
| Prevent duplicate execution | Scheduler Core | Execution lock (`lock_acquired_at`); duplicate check before claim |
| Respect storage permissions | Scheduler Core | Permission validation before dispatching to domain adapters |

---

## 7. Workflow Realization

**Event-Triggered Sync Workflow**

SQLite write occurs in an application feature. The dirty flag mechanism notifies the Trigger Manager. The Trigger Manager creates a PUSH Storage Job in CREATED state, persisted to `storage_jobs`. The Lane Manager moves the job to QUEUED when lane capacity is available. The Scheduler Core acquires an execution lock (setting `lock_acquired_at`), transitions the job to CLAIMED, then RUNNING, and dispatches to the appropriate domain adapter. On adapter success, the job is transitioned to COMPLETED. On adapter failure, the job transitions to FAILED, the lock is released, and if `retry_count < max_retries`, the job transitions to RETRY_PENDING and back to QUEUED after the retry interval.

**Time-Triggered Sync Workflow**

The Trigger Manager fires on the configured interval. It creates PULL Storage Jobs for each configured domain. Jobs enter the standard CREATED → QUEUED → CLAIMED → RUNNING → COMPLETED lifecycle.

**Startup Recovery Workflow**

On application start, the Recovery Manager loads all non-terminal jobs from SQLite. Jobs in CLAIMED or RUNNING state at the time of the previous crash are assessed against their retry budget: if budget remains, they transition to RETRY_PENDING and re-enter the queue; if budget is exhausted, they transition to FAILED terminal state and emit `storage-scheduler:terminal-failure`. QUEUED and CREATED jobs are re-inserted into lane queues in priority order. Startup-triggered sync jobs are created once queue rebuild is complete.

**Shutdown Flush Workflow**

On shutdown signal, the Trigger Manager creates flush Storage Jobs for domains with pending dirty records. New job intake is suspended. The Lane Manager drains active queues up to a configurable timeout. The default flush timeout is 30 seconds. The shutdown is blocking — the shutdown signal is not forwarded to dependent services until the flush completes or the timeout elapses. QUEUED jobs are preserved as-is during shutdown — their state is NOT modified; they will be picked up on the next startup. RUNNING jobs that have not completed when the timeout elapses are abandoned; each abandoned job ID MUST be logged.

**Mirror Constraint Verification Workflow**

The Mirror Constraint Enforcer creates VERIFY jobs on schedule or event trigger. The VERIFY job is dispatched to the Sync Engine, which delegates to the domain adapter to compare projection state against source state. If consistent, the job completes. If divergence is detected, the Sync Engine returns `requiresReconcile: true` to the Job Dispatcher, which creates a RECONCILE job. If RECONCILE succeeds, consistency is restored. If RECONCILE fails or source data is missing, the Mirror Constraint Enforcer generates a RECOVER job to restore from the authoritative source.

**Conflict Detection and Blocking Workflow**

During a VERIFY or RECONCILE job, the domain adapter reports an unresolvable divergence. The Conflict Handler classifies the conflict type (SOURCE_MODIFIED, PROJECTION_MODIFIED, HASH_MISMATCH). A conflict record is written to `storage_conflict_records` with `blocked = 1`. The conflict event is emitted via `storage-scheduler:conflict-detected` push channel. Further sync on the affected record is blocked. Non-conflicted records in the same domain continue to sync. The RECONCILE or VERIFY job transitions to FAILED. Resolution is applied externally by the domain adapter or application.

**Manual Sync Workflow**

A Renderer consumer invokes `storage-scheduler:trigger-sync` with the target domain. The IPC handler validates the input, creates a PUSH or PULL Storage Job, persists it to SQLite, and returns `ServerResponse.success()` with the created job. The job enters the standard lifecycle.

---

## 8. State Realization

### 8.1 Main Process States

**Job Lifecycle States**

| State | Realization |
|---|---|
| CREATED | Row inserted into `storage_jobs`; not yet in lane queue |
| QUEUED | Row in `storage_jobs` with status QUEUED; entry in lane in-memory queue |
| CLAIMED | Lock acquired; `lock_acquired_at` set; status CLAIMED |
| RUNNING | Domain adapter dispatched; status RUNNING |
| COMPLETED | Adapter confirmed success; `completed_at` set; status COMPLETED |
| FAILED | Adapter reported error or timeout; lock released; status FAILED |
| RETRY_PENDING | Waiting for retry interval; `retry_count` incremented; status RETRY_PENDING |
| CANCELLED | Removed before execution; status CANCELLED |
| EXPIRED | Scheduled window elapsed; status EXPIRED. Entry condition: a QUEUED job transitions to EXPIRED when it has not been claimed within its configured execution window. The default execution window is 24 hours from job creation time, configurable per domain via scheduling policy. Jobs in CLAIMED or RUNNING state do not expire. Detection mechanism: the Scheduler Service runs a periodic TTL check (interval configurable via scheduling policy) that queries for QUEUED jobs where the time elapsed since `createdAt` exceeds the execution window; those jobs transition to EXPIRED. |

**Scheduler Service States**

| State | Meaning | Entry Condition | Exit Condition |
|---|---|---|---|
| INITIALIZING | Bootstrap in progress; queues not yet active | Bootstrap dispatches service initialization | All lane workers initialized, job queue loaded from SQLite; the scheduler does not accept new jobs in this state |
| RUNNING | Active; accepting and processing jobs | Initialization complete | Shutdown signal received or fatal error; new jobs accepted, lanes execute jobs |
| DRAINING | Shutdown initiated; no new jobs accepted; queues flushing | Shutdown signal received | All RUNNING jobs reach terminal state OR flush timeout elapses; no new jobs accepted; QUEUED jobs preserved |
| STOPPED | All lanes idle; service deregistered | Drain complete (all RUNNING jobs terminal or timeout elapsed) | N/A (terminal service state until process restart); no jobs execute |

### 8.2 Renderer AppState Mapping

Renderer features that display scheduler observability data follow Astra's standard `INIT → LOADING → COMPLETED` lifecycle via `useDataState`. There is no scheduler-specific Renderer state — the mapping is identical to any other Electron feature using `IpcService` and `useDataState`.

| Renderer AppState | Trigger |
|---|---|
| INIT | Component mounted; no fetch yet |
| LOADING | `execute()` called; IPC invoke in flight |
| COMPLETED (isError=false) | IPC handler returned `ServerResponse.success()` |
| COMPLETED (isError=true) | IPC handler returned `ServerResponse.error()` or IpcService normalized a 500 |

Push events from `storage-scheduler:job-updated` and `storage-scheduler:conflict-detected` are applied to local Renderer state via `setAppState()` outside the normal `execute()` lifecycle, consistent with the optimistic update pattern defined by Astra.

---

## 9. Boilerplate Application Mapping

Prana consumes Astra's boilerplate. The Storage Scheduler does not re-implement any Astra-owned pattern.

| Astra Export | Application in this Feature |
|---|---|
| `ServerResponse<T>` | All scheduler IPC handlers return `ServerResponse.success()` or `ServerResponse.error()`. Never constructed as raw objects. |
| `IpcService` | Any Renderer repository that reads scheduler state instantiates `new IpcService()` and calls `ipc.invoke('storage-scheduler:{action}')`. Never calls `window.electronAPI` directly. |
| `useDataState<T>` | Renderer ViewModel hooks for scheduler observability data wrap `useDataState` and expose `appState` and `execute`. |
| `AppStateHandler` | Renderer views that display scheduler state use `AppStateHandler` to route LOADING / error / empty / success slots. |
| `AppStateProvider` | Wired once at the Prana renderer root. Scheduler Renderer modules inherit Loading/Error/Empty components automatically. |
| `StateType` / `StateCode` | Renderer ViewModel uses `StateCode.IDLE` as the initial status value. Checks `appState.isError` on COMPLETED — does not check for a separate ERROR state. |
| `IpcService.receive()` | Renderer ViewModels that subscribe to push channels (`storage-scheduler:job-updated`, `storage-scheduler:conflict-detected`, `storage-scheduler:terminal-failure`) use `ipc.receive()`. Unsubscribe function is called on unmount. |

The Main Process scheduler service is a pure Node.js service. Astra boilerplate applies only at the IPC boundary and in the Renderer layer.

---

## 10. Permission Realization

| Permission Concern | Realization |
|---|---|
| Validate job inputs | IPC handler validates domain, operation, and payload_ref before creating a job. Invalid inputs return `ServerResponse.error()` with status 400. |
| Enforce lane isolation | Lane Manager processes each domain lane independently. A failure or saturation in one lane does not block others. |
| Prevent duplicate execution | Before a job transitions to CLAIMED, the Scheduler Core checks for an existing active lock on the same payload_ref and operation in the same domain. Duplicate detected → the second job transitions to CANCELLED with reason = `duplicate_lock_contention`; no new lock is acquired; the first job proceeds normally. This is a terminal cancellation — the second job does not retry. |
| Respect storage permissions | Before dispatching to a domain adapter, the Scheduler Core verifies that the operation is permitted for the domain based on current runtime configuration and storage permission state. |

---

## 11. Validation Realization

| Validation Point | Location | Behavior on Failure |
|---|---|---|
| Job input: domain value | IPC handler (`storage-scheduler:trigger-sync`, `storage-scheduler:trigger-reconcile`) | Return `ServerResponse.error()` with status 400; job not created |
| Job input: operation type | IPC handler | Return `ServerResponse.error()` with status 400; job not created |
| Job input: payload_ref | IPC handler | Return `ServerResponse.error()` with status 400 if payload_ref does not resolve |
| Job payload schema (per domain) | IPC handler pre-enqueue | Each domain defines required payload fields; missing required fields return `ServerResponse.error()` with status 400 and the missing field name; job not created. Vault domain payloads must include `vaultPath`. Document domain payloads must include `fileId`. Sheet domain payloads must include `fileId` and `sheetId`. Fields beyond the required set are passed through as-is to the adapter. |
| Duplicate execution lock | Scheduler Core pre-claim check | The second job transitions to CANCELLED with reason = `duplicate_lock_contention`; no new lock is acquired; the first job proceeds normally. This is a terminal cancellation — the second job does not retry. |
| Mirror constraint divergence | Mirror Constraint Enforcer during VERIFY job | RECONCILE job generated; conflict record written if unresolvable |
| Conflict classification | Conflict Handler during RECONCILE job | Conflict record written; `blocked = 1`; sync blocked on affected record |
| Retry budget exhaustion | Scheduler Core on FAILED transition | Job transitions to FAILED terminal; `storage-scheduler:terminal-failure` emitted |
| Lane configuration | Scheduler Core startup validation | Startup fails with a logged error if lane configuration is structurally invalid |

---

## 12. Error Realization

| L2 Failure Scenario | Error Path | Recovery |
|---|---|---|
| Domain adapter sync failure | Job transitions RUNNING → FAILED → RETRY_PENDING → QUEUED (if retry budget remains); FAILED terminal if budget exhausted | RETRY_PENDING re-queues automatically; terminal FAILED emits `storage-scheduler:terminal-failure` |
| Crash during RUNNING job | Recovery Manager on startup detects CLAIMED/RUNNING jobs without completion; assesses retry budget | Retry budget available → RETRY_PENDING; exhausted → FAILED terminal |
| VERIFY detects divergence | Mirror Constraint Enforcer generates RECONCILE job | RECONCILE job enters standard lifecycle |
| RECONCILE fails | Conflict Handler generates RECOVER job; conflict record written if unresolvable | RECOVER job dispatched; sync blocked on affected record |
| RECOVER fails | Job transitions to FAILED terminal; conflict record marked; Event Registry notified | Manual intervention required; domain may be inconsistent |
| Max retries exhausted | Job reaches FAILED terminal state | `storage-scheduler:terminal-failure` push event emitted to all registered Renderer consumers |
| Conflict detected (no resolution strategy) | Conflict Handler blocks sync on record; emits `storage-scheduler:conflict-detected` | Sync continues for non-conflicted records; blocked record awaits external resolution |
| Lane saturation | New jobs queued but not dispatched; Observability Emitter tracks saturation | No error — backpressure is nominal behavior; observable via `storage-scheduler:metrics` |
| IPC handler error (Renderer side) | `IpcService` normalizes to `ServerResponse.error()` with status 500 | Renderer ViewModel sets `appState.isError = true`; `AppStateHandler` renders error slot |
| `window.electronAPI` unavailable | `IpcService` returns `ServerResponse.error()` with status 500 | Renderer ViewModel sets `appState.isError = true` |
| Invalid job input via IPC | Handler returns `ServerResponse.error()` with status 400 | Renderer receives error response; no job created |
| Scheduler configuration invalid at startup | Scheduler Core logs error; startup fails | Prana Main Process bootstrap reports initialization failure |
| Event Registry unavailable during FAILED terminal event emission | Scheduler records the failure to a local storage log (persisted in SQLite's operational metadata); event emission is retried when the Event Registry becomes available | If the runtime is shutting down and the Event Registry has already torn down before the FAILED event can be emitted, the failure is recorded to storage only — no further retry is attempted |

---

## 13. Integration Realization

### 13.1 Internal Prana Integrations

| Integration | Direction | Contract |
|---|---|---|
| SQLite Runtime Store | Bidirectional | Job registry, execution state, conflict records, and scheduler configuration are all persisted in SQLite. The scheduler reads and writes SQLite directly — this is a Main Process in-process integration. |
| Event Registry | Outbound | FAILED terminal jobs, conflict detections, and scheduler lifecycle events are emitted via the Event Registry. The Event Registry is a Prana-owned event bus; the scheduler is a producer. |
| Vault Service (Domain Adapter) | Outbound | The Job Dispatcher invokes the Vault Adapter for PUSH, PULL, RECONCILE, VERIFY, and RECOVER operations on the vault domain. The Vault Adapter owns vault-domain execution. |
| Document Service (Domain Adapter) | Outbound | The Job Dispatcher invokes the Document Adapter for sync and reconciliation on the document domain. |
| Sheet Service (Domain Adapter) | Outbound | The Job Dispatcher invokes the Sheet Adapter for sync and reconciliation on the sheet domain. |
| Prana Bootstrap | Inbound | The scheduler service is initialized, started, and torn down as part of the Prana Main Process lifecycle. Bootstrap owns startup sequencing. |

### 13.2 IPC Surface

The complete IPC surface for the Storage Scheduler is defined in Section 4.2. All `invoke` channels return `ServerResponse<T>`. Push channels (`receive`) are subscribed via `IpcService.receive()` in Renderer ViewModels.

The IPC surface is the sole programmatic boundary between the Main Process scheduler and any Renderer consumer. No Renderer code accesses scheduler state through any other path.

### 13.3 External Systems

The Storage Scheduler does not communicate directly with external systems. External persistence is the responsibility of domain adapters:

| External System | Mediated By |
|---|---|
| Git (Vault external persistence) | Vault Adapter |
| Google Docs | Document Adapter |
| Google Sheets | Sheet Adapter |

The Storage Scheduler dispatches jobs to adapters. Adapters own all external communication. The scheduler never holds credentials or connection state for external providers.

---

## 14. Ownership Mapping

### 14.1 Responsibility Ownership

| Responsibility | Owner |
|---|---|
| Job lifecycle state machine | Storage Scheduler (Prana Main Process) |
| Job persistence (SQLite) | Storage Scheduler (Prana Main Process) |
| Lane management and isolation | Storage Scheduler (Prana Main Process) |
| Execution locking | Storage Scheduler (Prana Main Process) |
| Conflict detection and classification | Storage Scheduler (Prana Main Process) |
| Mirror Constraint enforcement | Storage Scheduler (Prana Main Process) |
| Observability metrics | Storage Scheduler (Prana Main Process) |
| Recovery on startup/crash | Storage Scheduler (Prana Main Process) |
| Trigger management (all six types) | Storage Scheduler (Prana Main Process) |
| Domain-specific sync execution | Domain Adapters (Vault / Document / Sheet) |
| Conflict resolution strategy | Domain Adapter or Application configuration |
| Scheduling policy (intervals, priorities, retries) | External configuration provided at runtime |
| External provider communication | Domain Adapters |
| IPC channel exposure | Prana Main Process (preload + contextBridge) |
| Renderer ViewModel for observability | Renderer feature module (separate from scheduler) |
| Event Registry bus | Prana Main Process (Event Registry feature) |

### 14.2 Astra vs Prana Ownership

| Component | Owner | Rationale |
|---|---|---|
| `ServerResponse<T>` | Astra | All IPC handler responses use Astra's factory. Prana consumes — does not re-implement. |
| `IpcService` | Astra | Renderer repositories for scheduler observability use `new IpcService()`. Prana consumes — does not re-implement. |
| `useDataState` | Astra | Renderer ViewModels for scheduler observability use `useDataState`. Prana consumes — does not re-implement. |
| `AppStateHandler` | Astra | Renderer views for scheduler observability use `AppStateHandler`. Prana consumes — does not re-implement. |
| `AppStateProvider` | Astra | Wired once at Prana renderer root. Not re-implemented per feature. |
| `StateType`, `StateCode`, `AppState<T>` | Astra | State type contracts used by Renderer ViewModels. Prana consumes — does not re-implement. |
| Scheduler service (`storageSchedulerService`) | Prana | Pure Main Process orchestration service. No Astra equivalent. |
| SQLite schema (`storage_jobs`, `storage_conflict_records`, `scheduler_config`) | Prana | Prana-owned persistence. Astra is not a persistence library. |
| IPC handler registration (`ipcMain.handle`) | Prana | Main Process IPC wiring. Astra does not own `ipcMain`. |
| Preload context bridge | Prana | `window.electronAPI` exposure. Astra does not own the context bridge. |
| Event Registry | Prana | Prana-owned event bus. Astra has no event bus. |
| Domain Adapters (Vault, Document, Sheet) | Prana | Domain-specific execution. Astra has no domain knowledge. |

---

## 15. Architecture Traceability Matrix

| Architectural Claim | L1 Source | Applied in this Feature |
|---|---|---|
| All IPC handlers must return `ServerResponse<T>` | Astra — Integration Contracts: Electron | All scheduler `invoke` handlers return `ServerResponse.success()` or `ServerResponse.error()` |
| Renderer repositories must use `IpcService`, never `window.electronAPI` directly | Astra — Repository Isolation invariant | Renderer observability repositories use `new IpcService()` and `ipc.invoke()` |
| ViewModel state managed by `useDataState` | Astra — MVVM Pattern | Renderer ViewModels for scheduler data wrap `useDataState` |
| View routing handled by `AppStateHandler` | Astra — State Management | Renderer views use `AppStateHandler` with LOADING/error/empty/success slots |
| `AppStateProvider` wired once at renderer root | Astra — Integration Contracts: Electron | AppStateProvider is not re-wired per scheduler feature; inherited from root |
| Error is COMPLETED + isError, not a separate enum | Astra — State Management | Renderer ViewModels check `appState.isError` on COMPLETED |
| Push events via `IpcService.receive()`, unsubscribe on unmount | Astra — IpcService Full Signature | Renderer ViewModels subscribe to push channels and unsubscribe on unmount |
| `ServerResponse` constructed via factory methods only | Astra — Repository Pattern | Main Process handlers use `ServerResponse.success()` / `ServerResponse.error()` exclusively |
| Astra does not own ipcMain, contextBridge, SQLite | Astra — AI Guidance: Important Boundaries | Scheduler service, IPC wiring, and SQLite schema are all Prana-owned |
| Astra is not a persistence library | Astra — Repository Summary Boundaries | All SQLite schema and persistence for scheduler state is Prana-owned |
| Boilerplate ownership — Prana must not re-implement Astra exports | Astra — boilerplate-ownership.md | No Astra boilerplate is re-implemented in the scheduler feature |
| Feature structure: model / repo / hooks / view / pages | Astra — Feature Structure | Applies to any Renderer observability module consuming scheduler IPC; not to the Main Process scheduler itself |

---

## 16. Feature Traceability Matrix

| L2 Section | L2 Requirement | L3 Realization |
|---|---|---|
| §1.1 Storage Synchronization | Coordinate SQLite ↔ Vault / Documents / Sheets | Section 4.1 Job Dispatcher; Section 6 matrix rows |
| §1.1 Storage Reconciliation | Detect mirror violations, missing projections, metadata drift, version divergence | Section 4.1 Mirror Constraint Enforcer; Section 7 Mirror Constraint Verification Workflow |
| §1.1 Storage Recovery | Startup recovery, interrupted sync recovery, retry, replay | Section 4.1 Recovery Manager; Section 4.4 Startup Sequence; Section 7 Startup Recovery Workflow |
| §1.1 Execution Coordination | Job Queues, Lane Isolation, Priority, Concurrency, Locking | Section 4.1 Lane Manager and Scheduler Core; Section 4.3 `storage_jobs` schema |
| §1.1 Trigger Management | Event, Time, Startup, Shutdown, Recovery, Manual triggers | Section 4.1 Trigger Manager; Section 7 workflows for each trigger type |
| §1.2 Non-Storage Execution boundary | Scheduler dispatches to adapters; does not execute domain logic | Section 4.1 Job Dispatcher boundary; Section 14.1 domain adapter ownership |
| §3 SQLite First | Applications interact exclusively with SQLite | Section 3 Architecture Mapping; Section 13.1 SQLite Runtime Store integration |
| §5 Storage Job Model | StorageJob contract fields | Section 4.3 `storage_jobs` schema columns |
| §5 Job Ownership | Metadata vs domain vs business vs external | Section 14.1 Responsibility Ownership |
| §6 Execution Lanes | Configurable lane isolation | Section 4.1 Lane Manager; Section 4.3 `scheduler_config` |
| §7 Trigger Model — Event Trigger | L2 §7.1: dirty flag on SQLite write | Section 4.1 Trigger Manager; §7 Event-Triggered Sync Workflow |
| §7 Trigger Model — Time Trigger | L2 §7.2: interval-based scheduling | Section 4.1 Trigger Manager; §7 Time-Triggered Sync Workflow |
| §7 Trigger Model — Startup Trigger | L2 §7.3: recovery and initial sync on application start | Section 4.1 Trigger Manager; §7 Startup Recovery Workflow |
| §7 Trigger Model — Shutdown Trigger | L2 §7.4: pending flush before exit | Section 4.1 Trigger Manager; §7 Shutdown Flush Workflow |
| §7 Trigger Model — Recovery Trigger | L2 §7.5: Mirror Constraint violation detected | Section 4.1 Mirror Constraint Enforcer; §7 Mirror Constraint Verification Workflow |
| §7 Trigger Model — Manual Trigger | L2 §7.6: user-initiated sync via IPC | Section 4.2 `storage-scheduler:trigger-sync`; §7 Manual Sync Workflow |
| §8 Scheduling Policy | Configuration driven; no hardcoded values | Section 4.1 Scheduler Core; Section 4.3 `scheduler_config`; Section 11 validation |
| §9 Execution Lifecycle | CREATED→QUEUED→CLAIMED→RUNNING→COMPLETED | Section 8.1 Job Lifecycle States |
| §9 Failure Path | RUNNING→FAILED→RETRY_PENDING→QUEUED | Section 8.1; Section 12 error realization |
| §9 Terminal States | COMPLETED / FAILED / CANCELLED / EXPIRED; FAILED emits event | Section 8.1; Section 4.2 `storage-scheduler:terminal-failure` channel |
| §9 EXPIRED entry condition | 24-hour default execution window, configurable per domain; periodic TTL check for QUEUED jobs | Section 8.1 EXPIRED state entry (24-hour default, configurable window, TTL detection mechanism) |
| §10 Concurrency Control | Global limits, lane limits, execution locks | Section 4.1 Scheduler Core; Section 10 Permission Realization |
| §11 Retry Rules | Bounded, persistent, recoverable, config-driven | Section 4.3 `retry_count`/`max_retries` columns; Section 12 |
| §11 Startup Recovery | Load non-terminal, rebuild queues, resume | Section 4.4 Startup Sequence; Section 7 Startup Recovery Workflow |
| §11 Crash Recovery | Persisted execution state | Section 4.3 `lock_acquired_at`; Section 7 Startup Recovery Workflow step 4 |
| §12 Mirror Constraint Integration | VERIFY / RECONCILE / RECOVER job types | Section 4.1 Mirror Constraint Enforcer; Section 7 Mirror Constraint Verification Workflow |
| §13 Conflict Detection | Detect during VERIFY / RECONCILE | Section 4.1 Conflict Handler; Section 7 Conflict Detection Workflow |
| §13 Conflict Classification | Classify type, log record, emit event, block | Section 4.3 `storage_conflict_records`; Section 4.2 `storage-scheduler:conflict-detected` |
| §13 Conflict Default Behavior | Block sync on record; continue non-conflicted | Section 7 Conflict Detection and Blocking Workflow |
| §13 Conflict Handling — SQLite record marking | Mark record CONFLICT in SQLite | Section 4.3 `storage_conflict_records` (`blocked = 1` column + `sync_status = 'CONFLICT'` in job metadata). Note: The L2 specifies 'mark record CONFLICT in SQLite.' The L3 realizes this as `blocked = 1` in the `storage_conflict_records` table, combined with the `sync_status = 'CONFLICT'` field in the job metadata. These are equivalent — `blocked=1` is the physical enforcement mechanism for the CONFLICT semantic. |
| §13 Conflict Resolution Ownership | Scheduler detects; adapter/app resolves | Section 14.1 Responsibility Ownership |
| §14 Observability | Queue depth, saturation, latency, retry, failure, recovery | Section 4.2 `storage-scheduler:metrics`; Section 4.1 Observability Emitter |
| §14 Observability Consumers | Infrastructure UI, Event Registry, Audit Layer | Section 13.1 Event Registry; Section 5 Renderer Design note |
| §15 Security Boundaries | Validate inputs, lane isolation, no duplicates, permissions | Section 10 Permission Realization; Section 11 Validation Realization |
| §16 SQLite Runtime Store integration | Job registry, execution state, scheduling metadata | Section 4.3 SQLite Schema; Section 13.1 |
| §16 Vault Service integration | Vault operations, Git sync, mirror validation | Section 13.1 Internal Integrations |
| §16 Document Service integration | Discovery, sync, projection | Section 13.1 Internal Integrations |
| §16 Sheet Service integration | Discovery, sync, projection | Section 13.1 Internal Integrations |
| §17 Design Invariants | SQLite First, Storage Only, Config Driven, Domain Isolation, Deterministic Recovery, Single Coordination Layer | Sections 3, 4.1, 4.4, 7, 8.1, 13 collectively |
| §18 Future Extensions | Additional domains without architectural modification | Section 4.1 Lane Manager (no hardcoded lanes); Section 4.1 Job Dispatcher (domain-routed) |

---

## 17. Open Questions

| ID | Area | Question | Source |
|---|---|---|---|
| OQ-1 | Dirty Flag Mechanism | The L2 defines event-triggered jobs via a dirty flag on SQLite write, but does not specify the mechanism by which the Storage Scheduler observes SQLite mutations (e.g., trigger-based, change log table, in-process notification). The dirty flag contract needs to be defined by Prana's SQLite Runtime Store feature before event-trigger implementation can be completed. | L2 §7 Event Trigger; L2 §16 SQLite Runtime Store integration |
| OQ-2 | Scheduler Configuration Source | The L2 states that scheduling policy is externally configured (schedules, priorities, concurrency limits, retry policies, lane definitions). It does not specify who provides this configuration at runtime — whether it is a static file, a Prana bootstrap argument, a user-accessible settings surface, or another service. The configuration source and format need to be defined. | L2 §8 Scheduling Policy; L2 §17 Configuration Driven |
| OQ-3 | Conflict Resolution Strategy Application | The L2 states that domain adapters apply configured resolution strategies (PREFER_SOURCE / PREFER_PROJECTION / BLOCK). It is not defined how the resolution strategy is registered with or communicated to the adapter — whether it is static per-domain configuration, per-record metadata, or a runtime API call. This interface between the scheduler/adapter and the application configuration layer needs to be specified. | L2 §13 Conflict Resolution Ownership |
| OQ-4 | Domain Adapter Interface Contract | The L2 refers to domain adapters (Vault Adapter, Document Adapter, Sheet Adapter) as the executors of sync operations, but does not define the interface contract between the Storage Scheduler's Job Dispatcher and adapters (method signatures, return types, error reporting shape). This contract needs to be defined in the respective domain feature technical documents or a shared adapter interface specification. | L2 §1.2; L2 §5 Job Ownership |
| OQ-5 | Shutdown Drain Timeout | The L2 describes a shutdown flush workflow but does not specify the maximum time the scheduler should wait for active queues to drain before forcibly persisting in-flight jobs. The drain timeout value and policy need to be specified — whether it is a hardcoded constant, a configurable value, or driven by the bootstrap shutdown deadline. | L2 §1.1 Storage Recovery; L2 §7 Shutdown Trigger |
| OQ-6 | Observability Consumer Integration Pattern | The L2 lists Infrastructure UI, Event Registry, and Audit Layer as observability consumers, but does not specify how the Audit Layer consumes scheduler data — whether via IPC invoke, Event Registry subscription, or direct SQLite read. The audit integration pattern needs to be confirmed. | L2 §14 Consumers |
| OQ-7 | EXPIRED State Trigger | The L2 defines EXPIRED as a terminal state for jobs whose scheduled window elapsed without execution, but does not define how the scheduled window is determined or what process detects expiry. The expiry detection mechanism (polling, TTL column, timer per job) needs to be specified. | L2 §9 Terminal States |
