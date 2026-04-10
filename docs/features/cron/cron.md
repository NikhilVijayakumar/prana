# ⏱️ Feature: Job Orchestration & Cron Scheduler (Enhanced)

**Status:** Beta
**Service:** `cronSchedulerService.ts`
**Storage Domain:** `cron_scheduler_state` (SQLite)
**UI Stack:** `infrastructure/cron-management/` (New)
**Capability:** Provides deterministic task scheduling, user-defined job management, and fail-safe recovery for missed execution windows.

---

## 1. Tactical Purpose

The Scheduler acts as the **temporal execution engine** of the Prana runtime. It ensures that all time-based operations execute with **deterministic guarantees**, even across restarts, failures, and degraded conditions.

It operates as:

* A **persistent scheduling authority** (SQLite-backed)
* A **recovery-aware executor** (missed window reconciliation)
* A **controlled dispatcher** (delegates execution to feature-specific handlers)

---

## 2. System Invariants (Critical)

1. **Single Execution Guarantee**

   * A job MUST NOT execute more than once per defined time window

2. **Deterministic Recovery**

   * Missed executions MUST be resolved based on explicit recovery policy

3. **Persistence Authority**

   * SQLite state (`cron_scheduler_state`) is the source of truth for:

     * job definitions
     * execution history
     * lock state

4. **Execution Isolation**

   * Scheduler MUST NOT contain business logic
   * Execution MUST be delegated to registered executors

5. **Startup Dependency**

   * Recovery MUST only execute after:

     * `STORAGE_READY`
     * `INTEGRITY_VERIFIED`

6. **Idempotent Execution**

   * Executors MUST tolerate repeated invocation safely (enforced contract)

---

## 3. Architectural Dependencies

| Component           | Role                            | Relationship                                      |
| :------------------ | :------------------------------ | :------------------------------------------------ |
| **Main Process**    | `cronSchedulerService`          | Core engine for scheduling, locking, and recovery |
| **Startup Layer**   | `startupOrchestrator`           | Triggers recovery phase post-bootstrap            |
| **Renderer**        | `CronManagementViewModel`       | UI state and interaction layer                    |
| **Storage**         | SQLite (`cron_scheduler_state`) | Persistent registry and execution log             |
| **Execution Layer** | Executor Registry               | Maps job → executable handler                     |

---

## 4. Runtime Lifecycle

### 4.1 State Model

```text id="f2m1k9"
UNINITIALIZED → LOADED → SCHEDULE_ACTIVE
                    ↓
             RECOVERY_PENDING → RECOVERY_RUNNING → RECOVERY_COMPLETE
```

Extended states:

```text id="c0w8ab"
PAUSED
LOCKED
ERROR
```

---

### 4.2 Execution Loop

1. Load job registry from SQLite
2. Initialize in-memory schedule map
3. Register timers (or tick-based evaluation loop)
4. On trigger:

   * Acquire execution lock
   * Dispatch to executor
   * Persist execution result
   * Release lock

---

## 5. Data Contracts

### 5.1 Job Definition (SQLite: `cron_jobs`)

```ts
{
  id: string,
  name: string,
  expression: string,          // cron syntax
  target: string,              // executor key
  status: 'active' | 'paused',
  recovery_policy: 'SKIP' | 'RUN_ONCE' | 'CATCH_UP',
  last_run_at: timestamp | null,
  next_run_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp
}
```

---

### 5.2 Execution Log (SQLite: `cron_execution_log`)

```ts
{
  id: string,
  job_id: string,
  started_at: timestamp,
  completed_at: timestamp,
  status: 'success' | 'failed',
  error_message?: string
}
```

---

### 5.3 Lock Record (SQLite: `cron_locks`)

```ts
{
  job_id: string,
  lock_acquired_at: timestamp,
  lock_expires_at: timestamp
}
```

---

## 6. The Recovery Protocol

### 6.1 Trigger

* Invoked by `StartupOrchestrator` during **Layer 4: Operation**

---

### 6.2 Recovery Flow

1. Load all active jobs

2. For each job:

   * Compute expected executions since `last_run_at`
   * Compare with current time

3. Apply recovery policy:

| Policy     | Behavior                                |
| :--------- | :-------------------------------------- |
| `SKIP`     | Ignore missed runs                      |
| `RUN_ONCE` | Execute one immediate catch-up          |
| `CATCH_UP` | Execute all missed windows sequentially |

---

### 6.3 Execution Constraints

* Recovery jobs MUST:

  * run sequentially (default)
  * respect locking
  * avoid CPU spikes

---

### 6.4 Recovery Queue State

```text id="r7xk3p"
RECOVERY_PENDING → QUEUED → EXECUTING → COMPLETE
```

---

## 7. Execution Model

### 7.1 Executor Registry (Critical Contract)

* Executors MUST be registered at startup:

```ts
registerExecutor('VAULT_SYNC', vaultSyncExecutor)
registerExecutor('EMAIL_POLL', emailPollExecutor)
```

---

### 7.2 Execution Flow

1. Scheduler resolves `target`
2. Validates executor exists
3. Acquires lock
4. Executes handler
5. Persists result
6. Releases lock

---

### 7.3 Failure Handling

* Executor failure MUST:

  * be logged
  * not crash scheduler
  * not block future executions

---

## 8. Concurrency & Locking Model

### 8.1 Locking Guarantees

* Lock MUST:

  * be atomic (SQLite transaction)
  * prevent duplicate execution across restarts

---

### 8.2 Lock Expiry

* Locks MUST include timeout to prevent deadlocks
* Expired locks may be reclaimed safely

---

### 8.3 Parallel Execution (Controlled)

* Default: sequential execution
* Optional (future):

  * parallel execution for non-conflicting jobs

---

## 9. Management UI (Contract)

### 9.1 Cron Manager Screen

Must display:

* Job Name
* Status (Active/Paused)
* Frequency
* Last Run
* Next Run
* Execution Status

---

### 9.2 Editor Modal

Must support:

* Cron expression input (validated)
* Simplified interval builder
* Target executor selection
* Recovery policy selection

---

### 9.3 Validation Rules

* Invalid cron expressions MUST be rejected
* Target must exist in executor registry
* Duplicate job names SHOULD be prevented

---

## 10. Integration Points

### 10.1 With Startup Orchestrator

* Receives:

  * recovery trigger
* Must:

  * delay recovery until system is stable

---

### 10.2 With Queue System

* May enqueue long-running tasks instead of direct execution

---

### 10.3 With Vaidyar

* Should emit:

  * execution failures
  * recovery anomalies
  * lock contention issues

---

## 11. Failure Modes & Handling

| Scenario                 | Behavior                   |
| :----------------------- | :------------------------- |
| Invalid cron expression  | Reject at creation         |
| Missing executor         | Fail execution, log error  |
| SQLite failure           | Enter ERROR state          |
| Lock acquisition failure | Retry or skip safely       |
| Long-running job         | Continue, monitor via logs |
| Recovery overload        | Throttle execution         |

---

## 12. Observability

System MUST track:

* job execution frequency
* success vs failure rate
* average execution duration
* recovery backlog size
* lock contention frequency
* missed execution count

---

## 13. Deterministic Guarantees

* Jobs execute at most once per window
* Recovery behavior is explicitly defined and repeatable
* Execution order is predictable (sequential by default)
* All state changes are persisted before execution
* Scheduler survives restarts without losing state

---

## 14. Known Architectural Gaps (Expanded)

| Area                   | Gap                                            | Impact |
| :--------------------- | :--------------------------------------------- | :----- |
| UI Implementation      | Cron management UI not implemented             | High   |
| Executor Registry      | No strict registration validation at startup   | Medium |
| Dependency Constraints | No job dependency graph or conflict resolution | Medium |
| Backpressure Handling  | No throttling under heavy recovery load        | High   |
| Long-Running Jobs      | No timeout or cancellation mechanism           | Medium |
| Distributed Locking    | No cross-process coordination (future scaling) | Low    |
| Mirror Awareness       | Scheduler not aware of Vault sync state        | Medium |

---

## 15. Cross-Module Contracts (Explicit)

* **Startup Orchestrator**

  * MUST trigger recovery only after full readiness

* **Executor Layer**

  * MUST provide idempotent, failure-safe handlers

* **Storage Layer**

  * MUST guarantee persistence integrity for scheduler state

* **Sync Engine (Future)**

  * SHOULD coordinate with scheduler for Vault operations

---



---

## Security Enforcement (v1.2)

| Enforcement | Mechanism | Status |
|---|---|---|
| **Execution Boundaries** | Job execution boundaries prevent unbounded cron runs | Enforced |
| **Failure Throttling** | Max retry limits enforced to prevent infinite failure loops | Enforced |
| **IPC Validation** | Scheduler IPC handlers accept typed payloads | Enforced |

