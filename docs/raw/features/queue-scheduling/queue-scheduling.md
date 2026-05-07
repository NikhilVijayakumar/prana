# Feature: Task Scheduler & Universal Queue System

**Version:** 1.3.0  
**Status:** Stable / Core  
**Service:** `cronSchedulerService.ts` · `queueOrchestratorService.ts` · `taskRegistryService.ts`  
**Pattern:** Priority-Based Producer-Consumer / Persistence-Linked Execution  
**Capability:** Provides a deterministic, persistent, multi-lane task orchestration system for AI inference, channel communication, and system maintenance, with strict execution guarantees and recovery semantics.

---

## 1. Tactical Purpose

The **Task Scheduler & Queue System** is the **execution backbone** of the runtime. It ensures that all asynchronous operations—LLM inference, channel messaging, and system maintenance—are executed in a **controlled, prioritized, and recoverable manner**.

It prevents:
- resource starvation
- uncontrolled concurrency
- task loss during crashes
- cross-service interference

---

### 1.1 "It Does" (Scope)

* **Multi-Lane Isolation:** Segregates execution into independent lanes:
  - Model (AI)
  - Channel (External Communication)
  - System (Cron / Maintenance)
* **Persistent Task Registry:** Stores all task states in SQLite for crash recovery
* **Priority Scheduling:** Supports priority-based execution within and across lanes
* **Deterministic Execution:** Ensures tasks are executed exactly-once or retried safely
* **Concurrency Control:** Enforces `max_parallel_tasks` per lane and globally
* **Retry Management:** Applies lane-specific retry strategies
* **Temporal Scheduling:** Supports both one-shot and recurring (cron) tasks
* **Backpressure Handling:** Prevents queue overload via throttling and lane isolation

---

### 1.2 "It Does Not" (Boundaries)

* **Execute Business Logic:** Delegates execution to domain services
* **Override System Health:** Respects Vaidyar-reported blocked states
* **Persist Business Data:** Only stores task metadata, not domain payloads

---

## 2. Queue Architecture

### 2.1 Lane Model

| Lane | Purpose | Priority | Execution Model |
|------|--------|---------|----------------|
| Model | LLM inference | High / Medium | Token-aware throttled |
| Channel | Messaging (Telegram, etc.) | High | Rate-limited |
| System | Cron / maintenance | Low | Deferred / batch |

---

### 2.2 Task Lifecycle

```text
CREATED
   ↓
QUEUED
   ↓
SCHEDULED
   ↓
RUNNING
   ↓
COMPLETED / FAILED
   ↓
RETRY_PENDING (if applicable)
```

---

### 2.3 Terminal States

```text id="a92kdp"
COMPLETED
FAILED
CANCELLED
EXPIRED
DLQ (Dead Letter Queue)
```

---

## 3. Task Registry (SQLite)

### 3.1 Core Task Model

Each task must include:

* `task_id`
* `lane_type`
* `priority`
* `status`
* `payload_ref` (reference, not raw data)
* `retry_count`
* `max_retries`
* `scheduled_at`
* `executed_at`
* `app_id`

---

### 3.2 Persistence Rules

* All tasks must be:

  * written before execution
  * updated atomically
* Task state transitions must:

  * be idempotent
  * survive process crashes

---

## 4. Scheduling Model

### 4.1 Task Types

| Type      | Description                      |
| --------- | -------------------------------- |
| One-Shot  | Immediate or delayed execution   |
| Recurring | Cron-based scheduled execution   |
| Recovery  | Replayed missed tasks on startup |

---

### 4.2 Cron Responsibilities

* Detect missed executions
* Re-enqueue eligible tasks
* Maintain scheduling consistency across restarts

---

### 4.3 Time Guarantees

* No strict real-time guarantees
* Best-effort scheduling with bounded delay
* Catch-up logic ensures eventual execution

---

## 5. Execution Contract

### 5.1 Execution Guarantees

* Tasks must be:

  * executed at least once
  * retried on failure (bounded)
* Idempotency required at service level

---

### 5.2 Retry Policy

| Lane    | Strategy                         |
| ------- | -------------------------------- |
| Model   | Exponential backoff              |
| Channel | Fixed retry + alert on threshold |
| System  | Skip or defer                    |

---

### 5.3 Backpressure Handling

* Queue must:

  * reject or delay tasks when overloaded
* High-priority tasks must:

  * preempt lower-priority execution

---

## 6. Concurrency & Isolation

### 6.1 Concurrency Limits

* Global `max_parallel_tasks`
* Per-lane limits
* **Adaptive Throttling (v1.3):** Lanes feature a **Circuit Breaker** mechanism. If a lane encounters >5 consecutive failures, its `max_parallel_tasks` is dynamically dropped to 0 to prevent cascading failure.
* **Task Dependencies (v1.3):** Tasks can specify `dependency_task_ids` in `payloadMeta`. The orchestrator prevents claiming a task until all listed dependencies are in the `COMPLETED` state.

---

### 6.2 Isolation Rules

* Lanes operate independently
* Failure in one lane must not:

  * block other lanes
  * corrupt shared state

---

### 6.3 Execution Locking

* Each task must:

  * acquire execution lock before running
* Prevents:

  * duplicate execution
  * race conditions

---

## 7. Data Ownership Model

| Data            | Owner          | Storage               |
| --------------- | -------------- | --------------------- |
| Task Metadata   | Queue System   | SQLite                |
| Task Payload    | Domain Service | External / referenced |
| Execution State | Queue System   | SQLite                |

---

### Rules

* Payloads must not be embedded in queue table
* Tasks must reference external data via IDs
* Queue system must remain lightweight

---

## 8. Integration Constraints

* Sync Engine tasks must:

  * respect Vault mount availability
* Model tasks must:

  * respect token and hardware limits
* Channel tasks must:

  * respect provider rate limits
* System tasks must:

  * not block critical lanes

---

## 9. Failure Modes & Recovery

| Scenario            | Behavior         | Recovery             |
| ------------------- | ---------------- | -------------------- |
| Task crash          | Mark FAILED      | Retry                |
| App shutdown        | Persist state    | Resume on boot       |
| Duplicate execution | Prevent via lock | Idempotent execution |
| Queue overload      | Throttle         | Delay tasks          |
| Missed cron         | Re-enqueue       | Catch-up execution   |

---

### 9.1 Recovery Strategy

* On startup:

  * reload all non-terminal tasks
  * resume execution
* Retry logic must:

  * persist retry count
  * stop at threshold

---

## 10. Observability & Monitoring

The system must expose:

* queue depth per lane
* task execution latency
* retry rates
* failure counts
* lane saturation levels

---

### Integration

* Vaidyar monitors queue health
* Notification Centre receives task events
* Infrastructure UI displays queue state

---

## 11. UI Integration: Queue Monitor

* Displays:

  * active tasks
  * pending queue
  * failed tasks
* Supports:

  * manual retry
  * pause/resume lanes
  * force execution
* Emits:

  * user-visible notifications

---

## 12. Known Architectural Gaps (Roadmap)

| Area                | Gap                                       | Impact |
| ------------------- | ----------------------------------------- | ------ |
| ~~Adaptive Throttling~~ | ~~No dynamic scaling via system metrics~~ | ✅ v1.3 |
| ~~Task Dependencies~~   | ~~No DAG / dependency chaining~~              | ✅ v1.3 |
| Distributed Queue   | No remote/offloaded execution             | Medium |
| Priority Inversion  | No prevention strategy                    | Medium |
| ~~Dead Letter Queue~~   | ~~No isolation for permanently failed tasks~~ | ✅ v1.3 |
| Task Timeout        | No enforced execution timeout             | Medium |

---


---

## Security Enforcement (v1.2)

| Enforcement | Mechanism | Status |
|---|---|---|
| **wrappedFetch** | HTTP-bound task execution uses `wrappedFetch` with timeout enforcement | Enforced |
| **IPC Validation** | Task management IPC handlers accept typed payloads | Enforced |
| **Lane Isolation** | Multi-lane execution (Model/Channel/System) prevents concurrency starvation | Enforced |
