# Sync Engine — Technical Realization

**Version:** 2.0.0
**Feature Spec:** docs/raw/features/sync-engine.md
**Architecture Ref:** docs/raw/external-context/astra.md

---

## 1. Technical Overview

The Sync Engine is a singleton Main Process service and the sole authorized write authority across the Vault, Document, and Sheet storage domains within Prana. It operates entirely within the Node.js main process and has no renderer-facing IPC surface, no ViewModel, and no view layer of its own.

The Sync Engine sits between the Storage Scheduler and the domain adapters in the main process service hierarchy:

- The **Storage Scheduler** is the upstream coordinator. It creates, queues, and dispatches jobs. The Sync Engine receives dispatched jobs from the Scheduler's Job Dispatcher and executes them — it does not create or queue jobs independently.
- The **domain adapters** (Vault Adapter, Document Adapter, Sheet Adapter) are the downstream executors. The Sync Engine selects the appropriate adapter by job domain and delegates all domain-specific behavior to it.
- The **Mirror Constraint** enforcement role belongs to the Sync Engine. After every PUSH or PULL write, it runs an implicit post-write VERIFY. If the VERIFY passes, the job transitions to COMPLETED. If it fails, the write is rolled back and the job enters RETRY_PENDING or FAILED depending on the retry policy.

The Sync Engine enforces the Mirror Constraint rules defined in `storage-architecture.md`. It does not define those rules.

---

## 2. Service Architecture

### 2.1 Main Process Placement

The Sync Engine is a pure Main Process service. It has no renderer-facing surface, no IPC channels of its own, and no Astra MVVM module. The renderer has no direct knowledge of or access to the Sync Engine.

The Sync Engine is initialized during the Prana Main Process bootstrap SERVICES_READY phase. It registers as a service with the key `syncEngine`.

**Service Dependencies**

| Dependency | Key | Role |
|---|---|---|
| Event Registry | `events` | Sync Engine emits failure and conflict events to this bus |
| Storage Scheduler | `storageScheduler` | Dispatches jobs to the Sync Engine; Sync Engine does not create jobs |
| Vault Adapter | `vaultAdapter` | Executes Vault domain operations |
| Document Adapter | `documentAdapter` | Executes Document domain operations |
| Sheet Adapter | `sheetAdapter` | Executes Sheet domain operations |

The Sync Engine does not hold circular dependencies with any adapter. Adapters are consumed outbound only — adapters do not reference the Sync Engine.

### 2.2 No Renderer-Facing Surface

The Sync Engine has no IPC channels. No renderer consumer may invoke, observe, or interact with the Sync Engine directly. The only programmatic access to Sync Engine execution state is through the Storage Scheduler's job records, which are observable via the Scheduler's own IPC surface.

---

## 3. Architecture Mapping

The Sync Engine is a Prana-owned Main Process service. Astra architectural patterns apply only at the IPC boundary between the main process and the renderer — a boundary the Sync Engine does not participate in.

| Architectural Layer | Applies to Sync Engine | Astra Pattern | Notes |
|---|---|---|---|
| Main Process service runtime | Yes | None — pure Node.js service | Sync Engine is Prana-owned main-process code |
| IPC channel handlers | No | Not applicable | Sync Engine has no IPC surface |
| IpcService boundary isolation | Yes (structurally) | IpcService defines the process boundary the Sync Engine never crosses | No renderer calls originate from or target the Sync Engine |
| MVVM (useDataState, AppStateHandler) | No | Not applicable | Main Process service; no renderer component |
| Repository pattern | No | Not applicable | Sync Engine delegates to adapters, not repositories |
| Renderer ViewModel | No | Not applicable | No renderer component |
| Dependency Safety | Yes | Astra invariant | No circular dependencies between Sync Engine and adapters |
| ServerResponse<T> | No | Not applicable | Sync Engine communicates with adapters via internal contracts, not IPC response shapes |

The Astra IpcService boundary is relevant as a conceptual isolation rule: the Sync Engine operates strictly on the main-process side of that boundary and makes no renderer calls. This is enforced by architecture, not by runtime configuration.

---

## 4. Component Technical Design

### 4.1 Sync Engine Service (`syncEngineService`)

The Sync Engine Service is the primary entry point for the Sync Engine. It is invoked by the Storage Scheduler's Job Dispatcher when a job is ready for execution.

**Responsibilities**

- Receives dispatched job objects from the Storage Scheduler's Job Dispatcher
- Validates the job payload: confirms the domain is known and the operation is recognized; rejects with `reason=unknown_operation` before adapter selection if either is invalid
- Selects the domain adapter by `job.domain` (`vault`, `document`, `sheet`)
- Delegates execution to the selected adapter for the specified operation
- Runs the post-write implicit VERIFY after every PUSH or PULL (see Mirror Constraint Enforcer, §4.3)
- Emits failure events via the Event Registry on all FAILED terminal states
- Returns a structured execution result to the Job Dispatcher

**Job Dispatch Contract**

Each dispatched job carries:

| Field | Values |
|---|---|
| `domain` | `vault` \| `document` \| `sheet` |
| `operation` | `PUSH` \| `PULL` \| `VERIFY` \| `RECONCILE` \| `RECOVER` |
| `payloadRef` | Reference to the target domain record |

If `domain` is unknown or `operation` is unrecognized, the Sync Engine rejects the job with `reason=unknown_operation` before dispatching to any adapter. No adapter is invoked for invalid jobs.

### 4.2 Domain Adapter Interface

Each domain adapter (Vault, Document, Sheet) must implement the Domain Adapter Interface. This is a behavioral contract — the Sync Engine interacts with all adapters through this interface regardless of domain.

All operations defined by the interface must be:

- **Idempotent** — safe to re-execute after interruption without side effects
- **Deterministic** — same inputs produce the same output
- **Structured on failure** — return a structured failure reason, not an exception, unless an exceptional condition has no recoverable form

**Operations**

| Operation | Input | Output | Behavior |
|---|---|---|---|
| PULL | `payloadRef` | success or structured failure reason | Fetch content from the external provider; write the SQLite projection. Mirror Constraint: projection must match provider content after completion. |
| PUSH | `payloadRef` and current projection content | success or structured failure reason | Write SQLite content to the external provider. Mirror Constraint: provider record must match projection after completion. Atomicity of the external write is the adapter's responsibility. |
| VERIFY | `payloadRef` | `consistent` \| `diverged` \| `source_missing` | Compare the SQLite projection against the domain record. No writes occur. |
| RECONCILE | `payloadRef` and divergence report from VERIFY | success or structured failure reason | Restore consistency between the projection and the domain record. If the configured strategy is BLOCK: emit a conflict event and halt reconciliation for the affected record. |
| RECOVER | `payloadRef` and recovery source designation (which side is authoritative) | success or structured failure reason | Restore from the authoritative source. The non-authoritative side is overwritten. No merge occurs. Destructive — local changes on the non-authoritative side are discarded. |

All adapter operations return success or a structured failure reason. The Sync Engine does not apply try/catch logic over adapter calls as a substitute for structured failure reporting. Exceptions from adapters are treated as unstructured failures and classified as `recover_failed` or equivalent terminal failure reasons as appropriate.

### 4.3 Mirror Constraint Enforcer

The Mirror Constraint Enforcer is the post-write verification step run by the Sync Engine Service after every PUSH or PULL execution.

**Implicit Post-Write VERIFY**

After every PUSH or PULL completes without adapter error, the Sync Engine runs an implicit VERIFY:

1. Calls `adapter.verify(payloadRef)` for the affected domain
2. If result is `consistent` → job transitions to COMPLETED
3. If result is `diverged` → write is rolled back; job transitions to RETRY_PENDING (if retry budget remains) or FAILED (if budget exhausted)
4. If result is `source_missing` → job transitions to FAILED with `reason=source_missing`

**Scheduled VERIFY, RECONCILE, and RECOVER**

The Storage Scheduler generates VERIFY, RECONCILE, and RECOVER jobs on a schedule and in response to observed divergence. These are dispatched to the Sync Engine as first-class jobs. The Sync Engine executes them via the adapter interface — it does not distinguish between scheduled enforcement jobs and implicit post-write VERIFYs in terms of adapter delegation.

The distinction is:
- **Implicit VERIFY** — run by the Sync Engine Service after every PUSH or PULL; not a separately dispatched job
- **Scheduled VERIFY / RECONCILE / RECOVER** — dispatched as explicit jobs by the Storage Scheduler

### 4.4 Write Ordering Rules

Write ordering is enforced for all PUSH and PULL operations:

| Operation | Ordering Rule |
|---|---|
| PUSH | SQLite projection MUST be written before the external domain record |
| PULL | External domain record MUST be read before the SQLite projection is updated |

This ordering ensures the system fails in a state where the external record remains the authority, preserving recoverability. The adapter is responsible for enforcing these ordering rules within its own execution.

### 4.5 RECOVER Execution

RECOVER is a destructive, non-retrying operation. It is dispatched by the Storage Scheduler when RECONCILE has failed or when domain data is missing or unrecoverable.

**Execution Sequence**

1. Adapter fetches content from the designated authoritative source
2. Non-authoritative side is overwritten with the authoritative content
3. SQLite projection is updated to reflect the authoritative state
4. Post-write VERIFY confirms Mirror Constraint is satisfied
5. If VERIFY passes → job transitions to COMPLETED
6. If VERIFY fails → job transitions to FAILED with `reason=recover_verify_failed`; no automatic retry; domain record state is indeterminate; operator remediation is required

RECOVER does not retry on VERIFY failure. Retrying the same overwrite with the same authoritative content would produce the same result. Persistent VERIFY failure after RECOVER indicates a structural inconsistency that cannot be resolved automatically.

---

## 5. IPC Surface

The Sync Engine has no IPC surface.

It does not define any `invoke` channels, `send` channels, or `receive` push channels. No renderer consumer may communicate with the Sync Engine through any IPC path.

The Sync Engine is an internal Main Process service only. It is accessed exclusively by the Storage Scheduler's Job Dispatcher via in-process function calls.

---

## 6. Workflow Realizations

### 6.1 PULL Workflow

**Trigger:** Storage Scheduler dispatches a PULL job.

1. Sync Engine Service receives the dispatched job
2. Job payload is validated (domain and operation recognized)
3. Domain adapter is selected by `job.domain`
4. `adapter.pull(payloadRef)` is called
5. If adapter throws or returns structured failure → job transitions to RETRY_PENDING; no projection written
6. If adapter succeeds → implicit post-write VERIFY is run (§4.3)
7. If VERIFY returns `consistent` → job transitions to COMPLETED
8. If VERIFY returns `diverged` → write rolled back; job transitions to RETRY_PENDING or FAILED per retry policy
9. If VERIFY returns `source_missing` → job transitions to FAILED with `reason=source_missing`

### 6.2 PUSH Workflow

**Trigger:** Storage Scheduler dispatches a PUSH job.

1. Sync Engine Service receives the dispatched job
2. Job payload is validated (domain and operation recognized)
3. Domain adapter is selected by `job.domain`
4. SQLite projection is written first (write ordering rule; §4.4)
5. `adapter.push(payloadRef, projectionContent)` is called
6. If adapter throws or returns structured failure → job transitions to RETRY_PENDING; external record may be partially written; adapter owns rollback
7. If adapter succeeds → implicit post-write VERIFY is run (§4.3)
8. If VERIFY returns `consistent` → job transitions to COMPLETED
9. If VERIFY returns `diverged` → write rolled back; job transitions to RETRY_PENDING or FAILED per retry policy
10. If VERIFY returns `source_missing` → job transitions to FAILED with `reason=source_missing`

### 6.3 VERIFY Workflow

**Trigger:** Storage Scheduler dispatches a VERIFY job.

1. Sync Engine Service receives the dispatched job
2. Job payload is validated (domain and operation recognized)
3. Domain adapter is selected by `job.domain`
4. `adapter.verify(payloadRef)` is called
5. No writes occur during VERIFY
6. VERIFY does not transition records in FAILED or RETRY_PENDING state — those records are excluded from divergence checking. VERIFY evaluates only records in STORED or PROJECTED state.
7. If result is `consistent` → job transitions to COMPLETED
8. If result is `diverged` → job transitions to COMPLETED (VERIFY itself succeeded); the Sync Engine returns a structured result to the Storage Scheduler's Job Dispatcher with `requiresReconcile: true` and the affected `payloadRef`. The Scheduler's Job Dispatcher creates a RECONCILE job for the affected record and enqueues it. The Sync Engine does not create jobs directly.
9. If result is `source_missing` → job transitions to FAILED with `reason=source_missing`

VERIFY does not produce FAILED on divergence detection. Divergence is a valid VERIFY result, not a VERIFY failure. FAILED is reserved for the case where VERIFY cannot determine consistency (e.g., source_missing).

**RECONCILE job creation attribution:** RECONCILE jobs are created exclusively by the Storage Scheduler's Job Dispatcher (step 8 above) in response to `requiresReconcile: true` results from the Sync Engine. The Mirror Constraint Enforcer (see `storage-scheduler.md §4.1`) schedules VERIFY jobs and monitors RECONCILE outcomes — it does not create RECONCILE jobs directly. This is the single path by which RECONCILE jobs are created from divergence detection.

### 6.4 RECONCILE Workflow

**Trigger:** Storage Scheduler dispatches a RECONCILE job carrying a divergence report.

1. Sync Engine Service receives the dispatched job
2. Job payload is validated (domain and operation recognized)
3. Domain adapter is selected by `job.domain`
4. `adapter.reconcile(payloadRef, divergenceReport)` is called with the configured strategy
5. Adapter reads the configured strategy from its reconcile contract (PREFER_SOURCE / PREFER_PROJECTION / BLOCK)
6. If strategy is BLOCK → adapter emits conflict event; conflict record is written to SQLite; job transitions to FAILED with `reason=conflict_blocked`
7. If adapter reconciliation fails (non-BLOCK) → job transitions to RETRY_PENDING; if max retries exhausted → FAILED
8. If adapter reconciliation succeeds → job transitions to COMPLETED

### 6.5 RECOVER Workflow

**Trigger:** Storage Scheduler dispatches a RECOVER job (after RECONCILE failure or when domain data is missing or unrecoverable).

Steps follow the six-step RECOVER execution sequence defined in §4.5.

---

## 7. State Realization

The Sync Engine is stateless. It does not maintain a state machine of its own.

Job states are entirely owned and managed by the Storage Scheduler. The Sync Engine receives dispatched jobs, executes them, and returns structured results. The Scheduler transitions job records in SQLite based on those results.

The Sync Engine's own runtime states are effectively:

| Sync Engine State | Meaning |
|---|---|
| Idle | No job currently executing for a given domain |
| Executing | Adapter call in progress for a dispatched job |

These are transient execution states, not persisted states. The Sync Engine does not expose a state machine surface.

All job lifecycle states (CREATED, QUEUED, CLAIMED, RUNNING, COMPLETED, FAILED, RETRY_PENDING, CANCELLED, EXPIRED) are defined and owned by the Storage Scheduler as documented in `storage-scheduler.md`.

**In-flight behavior during Scheduler DRAINING:** When the Storage Scheduler transitions to DRAINING state, the Sync Engine is allowed to complete any adapter calls that are already in progress. Operations are not interrupted on DRAINING entry. The Scheduler's 30-second flush timeout covers the completion of currently-executing Sync Engine adapter calls. If the timeout elapses before an in-flight adapter call completes, the corresponding job is abandoned and logged per the Scheduler's shutdown flush policy.

---

## 8. Permission Realization

### Single Write Authority

Only the Sync Engine may write to the Vault, Document, and Sheet storage domains. This is an architectural invariant enforced by:

- Vault Adapter, Document Adapter, and Sheet Adapter are internal Main Process services with no IPC exposure
- No IPC channel in the Sync Engine or any domain adapter exposes write operations to the renderer
- The renderer has no path to invoke a domain write outside of the Storage Scheduler's managed job lifecycle

### No Renderer Write Path

The Sync Engine has no IPC surface (§5). There is no channel a renderer consumer could invoke to trigger a domain write directly. All write-capable operations (PUSH, RECONCILE, RECOVER) are exclusively accessible through the Storage Scheduler's job dispatch flow.

### Adapter Containment

Domain adapters are internal Main Process services. They do not register IPC handlers. They are invoked only by the Sync Engine Service. No other main-process service may call adapter operations directly.

This containment is an architectural convention, not a runtime-enforced guard. There is no code-level mechanism that prevents another Main Process service from obtaining a direct in-process reference to a domain adapter and calling its operations outside the Sync Engine. The contract is upheld by the service dependency graph: adapters are resolved and held exclusively by the Sync Engine; no other service resolves them from the Service Registry. Violations of this convention are a contract breach, detectable via code review, and not detectable at runtime.

---

## 9. Validation Realization

### Post-Write VERIFY as Mirror Constraint Enforcement

The Mirror Constraint is enforced through the implicit post-write VERIFY run after every PUSH or PULL. This is the primary validation mechanism. A write is not considered complete until VERIFY confirms `consistent`. A write that produces `diverged` is rolled back.

### Idempotency Validation

All adapter operations are required to be idempotent by the Domain Adapter Interface contract (§4.2). Idempotency is the structural precondition that makes retry safety possible. The Sync Engine relies on this contract when transitioning failed jobs to RETRY_PENDING — it assumes re-executing the same operation against the same `payloadRef` is safe.

### Job Payload Validation

Invalid job payloads are rejected before adapter dispatch:

| Invalid Condition | Behavior |
|---|---|
| `job.domain` is not `vault`, `document`, or `sheet` | FAILED with `reason=unknown_operation`; no adapter invoked |
| `job.operation` is not one of the five defined operations | FAILED with `reason=unknown_operation`; no adapter invoked |

Rejection occurs synchronously before adapter selection. The Sync Engine returns the failure result to the Scheduler for job state transition.

### Adapter Input Validation Rules

The Sync Engine validates adapter operation inputs before delegating to the adapter. Required fields per operation:

| Operation | Required Input Fields | Validation Rule |
|---|---|---|
| PULL | `payloadRef` | Must be a non-empty string; must resolve to a known domain record reference |
| PUSH | `payloadRef`, `projectionContent` | `payloadRef` must be non-empty; `projectionContent` must be non-null and non-empty |
| VERIFY | `payloadRef` | Must be a non-empty string |
| RECONCILE | `payloadRef`, `divergenceReport` | `payloadRef` must be non-empty; `divergenceReport` must be a structured object (not null); `divergenceReport` must contain the divergence type field |
| RECOVER | `payloadRef`, `authoritySource` | `payloadRef` must be non-empty; `authoritySource` must be `source` or `projection` |

If any required input field is absent or empty, the job transitions to FAILED with `reason=invalid_payload` before the adapter is invoked. Adapters are not responsible for re-validating these fields — the Sync Engine validates before dispatch.

---

## 10. Error Realization

| Failure Mode | Job Outcome | Notes |
|---|---|---|
| Adapter throws during PULL | RETRY_PENDING | No projection written |
| Adapter throws during PUSH | RETRY_PENDING | External record may be partially written; adapter owns rollback |
| Mirror Constraint fails post-write (diverged) | Rollback; RETRY_PENDING | Applies after PUSH or PULL |
| Mirror Constraint fails after max retries | FAILED | Conflict event emitted via Event Registry |
| RECONCILE blocked by BLOCK strategy | FAILED, `reason=conflict_blocked` | Conflict record written to SQLite |
| VERIFY detects source_missing | FAILED, `reason=source_missing` | Source document no longer exists |
| Adapter throws during RECOVER | FAILED, `reason=recover_failed` | Domain record state is indeterminate; operator remediation required |
| VERIFY fails after RECOVER | FAILED, `reason=recover_verify_failed` | No retry; Mirror Constraint not satisfied; operator remediation required |
| Unknown domain in job | FAILED, `reason=unknown_operation` | Rejected before adapter dispatch |
| Unknown operation in job | FAILED, `reason=unknown_operation` | Rejected before adapter dispatch |
| Event Registry unavailable on FAILED emission | Failure recorded to local in-memory queue; emission retried when Event Registry becomes available. If the runtime is shutting down before the Event Registry is available, the failure event is dropped — no further retry is attempted. | Does not prevent job state transition to FAILED |

All FAILED terminal states emit an event via the Event Registry for observability consumers.

The Sync Engine does not suppress failures or transition jobs to COMPLETED when a failure condition is present. It fails toward a consistent known state — the system fails visibly rather than silently.

---

## 11. Integration Realization

### 11.1 Internal Prana Integrations

| Integration | Direction | Contract |
|---|---|---|
| Storage Scheduler | Inbound | Sync Engine receives dispatched jobs from the Scheduler's Job Dispatcher. The Job Dispatcher resolves the Sync Engine from the Service Registry at Scheduler initialization time (`resolve('syncEngine')`); the resolved reference is held for the Scheduler's lifetime. The Sync Engine does not create or queue jobs. It communicates back to the Scheduler only by returning structured execution results to the Job Dispatcher. |
| Vault Adapter | Outbound | Sync Engine invokes Vault Adapter for all Vault domain operations (PULL/PUSH/VERIFY/RECONCILE/RECOVER against Git/Vault file store). |
| Document Adapter | Outbound | Sync Engine invokes Document Adapter for all Document domain operations (PULL/PUSH/VERIFY/RECONCILE/RECOVER against Google Docs/SQLite). |
| Sheet Adapter | Outbound | Sync Engine invokes Sheet Adapter for all Sheet domain operations (PULL/PUSH/VERIFY/RECONCILE/RECOVER against Google Sheets/SQLite). |
| Event Registry | Outbound | Sync Engine emits events on FAILED terminal states and conflict detection. Does not subscribe to events from the Event Registry. |
| Storage Architecture | Reference | Storage domain schemas and Mirror Constraint rules are defined in `storage-architecture.md`. The Sync Engine enforces those rules; it does not define them. |

### 11.2 No External System Access

The Sync Engine does not communicate directly with any external system (Git, Google Docs, Google Sheets, etc.). All external communication is the responsibility of domain adapters. The Sync Engine dispatches to adapters and receives structured results — it has no credentials, connection state, or protocol knowledge for any external provider.

---

## 12. Ownership Realization

### What the Sync Engine Owns

| Responsibility | Owner |
|---|---|
| Write authorization enforcement | Sync Engine |
| Domain adapter selection and dispatch | Sync Engine |
| Post-write VERIFY (implicit Mirror Constraint enforcement) | Sync Engine |
| Failure result classification and Event Registry emission | Sync Engine |
| RECOVER coordination (6-step sequence) | Sync Engine |
| Rejection of unknown domains and operations | Sync Engine |

### What the Sync Engine Does Not Own

| Responsibility | Owner |
|---|---|
| Job scheduling, queuing, and retry scheduling | Storage Scheduler |
| Job lifecycle state machine (CREATED → QUEUED → ... → COMPLETED / FAILED) | Storage Scheduler |
| Domain schemas and Mirror Constraint rule definitions | Storage Architecture |
| Conflict resolution strategy (PREFER_SOURCE / PREFER_PROJECTION / BLOCK) | Application configuration (read by domain adapters from their reconcile contract) |
| External API access and credentials | Domain adapters |
| Synchronization policy (intervals, triggers, priorities) | Application configuration |
| Execution lock acquisition | Storage Scheduler |
| SQLite job persistence | Storage Scheduler |

---

## 13. Observability Realization

The Sync Engine exposes in-memory runtime counters through an internal telemetry contract. These counters are not exposed via IPC directly — the Storage Scheduler's Observability Emitter aggregates Sync Engine metrics into the scheduler's IPC observability surface.

| Metric | Granularity | Description |
|---|---|---|
| Operations executed | Per domain, per operation type (PUSH/PULL/VERIFY/RECONCILE/RECOVER) | Count of completed executions |
| Mirror Constraint violations detected | Per domain | Count of post-write VERIFYs returning `diverged` |
| Mirror Constraint violations resolved | Per domain | Count of violations that resolved via RECONCILE or successful retry |
| Adapter failure rate | Per domain | Count of adapter calls returning structured failure or throwing |
| Rollback count | Per domain | Count of post-write rollbacks triggered by failed VERIFY |

All metrics are in-memory counters. They are reset on process restart. Persistent observability data (job history, failure records) is owned by the Storage Scheduler's SQLite persistence.

---

## 14. Open Questions

No open questions block the core realization of the Sync Engine.

The conflict resolution strategy extensibility (PREFER_SOURCE / PREFER_PROJECTION / BLOCK) is defined in application configuration. The Sync Engine reads the configured strategy from the domain adapter's reconcile contract — the adapter is responsible for interpreting the strategy at reconciliation time. The Sync Engine does not need to know which strategy is configured.

---

## 15. Feature Traceability Matrix

| L2 Section | L2 Requirement | L3 Realization |
|---|---|---|
| §1 Tactical Purpose | Sole write authority, write coordination layer, Mirror Constraint enforcement point | §1 Technical Overview |
| §2 Invariant 1 — Single Write Authority | Only Sync Engine may write to Vault, Document, Sheet domains | §8 Permission Realization |
| §2 Invariant 2 — Mirror Constraint Enforcement | Post-write VERIFY on every write; rollback on failure | §4.3 Mirror Constraint Enforcer; §6 Workflow Realizations |
| §2 Invariant 3 — Adapter Delegation | Sync Engine delegates all domain-specific behavior to adapters | §4.2 Domain Adapter Interface |
| §2 Invariant 4 — Idempotent Execution | Every operation safe to re-execute after interruption | §9 Validation Realization |
| §2 Invariant 5 — Write Consistency | Each write reaches consistent state or is rolled back; fails toward known state | §4.3 Mirror Constraint Enforcer; §10 Error Realization |
| §3 Non-Responsibilities | Scheduling, domain schemas, external API, conflict resolution, synchronization policy | §12 Ownership Realization |
| §4 PULL operation | Fetch from external, write SQLite projection; idempotent, atomic, deterministic | §4.2 Domain Adapter Interface; §6.1 PULL Workflow |
| §4 PUSH operation | Write SQLite content to external; idempotent, atomic, deterministic | §4.2 Domain Adapter Interface; §6.2 PUSH Workflow |
| §4 VERIFY operation | Check projection vs domain record; returns consistent / diverged / source_missing; no writes | §4.2 Domain Adapter Interface; §6.3 VERIFY Workflow |
| §4 RECONCILE operation | Restore consistency; BLOCK strategy emits conflict and halts | §4.2 Domain Adapter Interface; §6.4 RECONCILE Workflow |
| §4 RECOVER operation | Restore from authoritative source; destructive; no merge | §4.2 Domain Adapter Interface; §6.5 RECOVER Workflow |
| §5 Execution Model — Dispatch | Sync Engine receives jobs from Scheduler; does not create jobs | §4.1 Sync Engine Service; §6 Workflow Realizations |
| §5 Write Ordering | SQLite before external for PUSH; external read before SQLite update for PULL | §4.4 Write Ordering Rules |
| §5 Post-Write Validation | Implicit VERIFY after every PUSH or PULL; COMPLETED or rollback | §4.3 Mirror Constraint Enforcer |
| §5 RECOVER Execution | 6-step sequence; VERIFY failure → FAILED, no retry | §4.5 RECOVER Execution; §6.5 RECOVER Workflow |
| §6 Failure Modes | All failure scenarios and their outcomes | §10 Error Realization |
| §7 Integration Points | Storage Scheduler, Storage Architecture, Event Registry | §11 Integration Realization |
| §8 Observability | Operations per domain per type, constraint violations, adapter failures, rollback counts | §13 Observability Realization |
| §9 Completion Status | Full enumeration of Sync Engine responsibilities and exclusions | §12 Ownership Realization; §15 Feature Traceability Matrix |
