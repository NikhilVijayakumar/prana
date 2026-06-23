# ⏱️ Feature: Storage Scheduler

**Version:** 2.0.0
**Status:** Stable / Core
**Service:** `storageSchedulerService`
**Pattern:** Storage Synchronization & Reconciliation Orchestrator
**Capability:** Provides deterministic scheduling, queuing, execution, recovery, and reconciliation of storage operations across SQLite Runtime Store, Vault Domain, Document Domain, and Sheet Domain.

---

## 1. Tactical Purpose

The Storage Scheduler is the orchestration layer responsible for coordinating all asynchronous storage operations within Prana.

It ensures that:

* applications interact exclusively with SQLite
* synchronization occurs outside application execution paths
* storage operations are recoverable
* synchronization policies remain configurable
* storage domains remain consistent over time

The Storage Scheduler is not a general-purpose task system.

It exists exclusively to coordinate storage-related operations.

---

### 1.1 It Does

#### Storage Synchronization

Coordinates:

```text
SQLite ↔ Vault
SQLite ↔ Documents
SQLite ↔ Sheets
```

---

#### Storage Reconciliation

Detects and resolves:

```text
Mirror violations
Missing projections
Metadata drift
Version divergence
```

---

#### Storage Recovery

Supports:

```text
Startup recovery
Interrupted sync recovery
Retry execution
Failed operation replay
```

---

#### Execution Coordination

Provides:

```text
Job Queues
Lane Isolation
Priority Management
Concurrency Control
Execution Locking
```

---

#### Trigger Management

Supports:

```text
Event Triggered
Time Triggered
Startup Triggered
Shutdown Triggered
Recovery Triggered
Manual Triggered
```

---

### 1.2 It Does Not

#### Non-Storage Execution

The Storage Scheduler does not execute:

```text
Application logic
Domain service logic
Business rules
Data transformation
```

It dispatches to domain adapters. Adapters own domain-specific execution.

---

#### Domain Ownership

The Storage Scheduler does not own:

```text
Vault
Documents
Sheets
```

It coordinates operations performed by domain adapters. Adapters own their domain state.

---

#### Conflict Resolution Policy

The Storage Scheduler does not decide how conflicts are resolved.

It detects divergence and dispatches RECONCILE jobs.

Resolution strategy is defined by domain adapter or application configuration.

---

#### Synchronization Policy

The Storage Scheduler does not define:

```text
Execution frequency
Lane count
Concurrency limits
Priority rules
Retry strategies
```

These are provided by applications or runtime configuration.

---

## 2. Architectural Position

```text
Applications
      │
      ▼

SQLite Runtime Store

      │
      ▼

Storage Scheduler

 ┌────┼────┐
 ▼    ▼    ▼

Vault Documents Sheets

 ▼       ▼       ▼

Git  Google Docs Google Sheets
```

---

## 3. Core Principle

### SQLite First

Applications interact exclusively with SQLite.

Applications must never directly access:

```text
Vault
Git
Google Docs
Google Sheets
```

All synchronization occurs through the Storage Scheduler.

---

### Single Operational Surface

```text
Application
      ↓
SQLite
```

is the only supported runtime access path.

---

## 4. Storage Domains

The Storage Scheduler coordinates synchronization across multiple storage domains.

---

### Vault Domain

Purpose:

```text
Durable system-owned state
Runtime configuration
Registry metadata
Committed knowledge artifacts
```

Sync direction:

```text
PULL: Git → Vault → SQLite
PUSH: SQLite → Vault → Git
```

External Persistence:

```text
Vault ↔ Git
```

---

### Document Domain

Purpose:

```text
Human-authored content projected from external provider
Documentation, knowledge articles, research, policies
```

Sync direction:

```text
PULL: Google Docs → SQLite projection (primary)
PUSH: SQLite → Google Docs (future capability)
```

External Persistence:

```text
SQLite ↔ Google Docs
```

---

### Sheet Domain

Purpose:

```text
Structured tabular data projected from external provider
Reference data, master data, catalog data
```

Sync direction:

```text
PULL: Google Sheets → SQLite projection (primary)
PUSH: SQLite → Google Sheets (future capability)
```

External Persistence:

```text
SQLite ↔ Google Sheets
```

---

## 5. Storage Job Model

Every storage operation is represented as a Storage Job.

---

### Job Contract

```typescript
interface StorageJob {
    jobId: string;

    domain:
        | "vault"
        | "document"
        | "sheet";

    operation:
        | "PUSH"
        | "PULL"
        | "RECONCILE"
        | "VERIFY"
        | "RECOVER";

    status: JobStatus;

    priority: number;

    payloadRef: string;

    retryCount: number;

    maxRetries: number;

    createdAt: Date;

    scheduledAt?: Date;

    completedAt?: Date;
}
```

---

### Job Ownership

| Data           | Owner             |
| -------------- | ----------------- |
| Job Metadata   | Storage Scheduler |
| Domain Data    | Domain Adapter    |
| Business Data  | Application       |
| External State | External Provider |

---

## 6. Execution Lanes

Storage operations execute within isolated lanes.

---

### Lane Purpose

Lane isolation prevents:

```text
Starvation
Blocking
Cross-domain interference
```

---

### Lane Contract

The scheduler must support configurable lanes.

Examples:

```text
vault
document
sheet
```

Additional lanes may be introduced by future modules.

The scheduler must not hardcode lane definitions.

---

## 7. Trigger Model

The Storage Scheduler supports multiple trigger mechanisms.

---

### Event Trigger

Example:

```text
SQLite Updated
      ↓
Dirty Flag Created
      ↓
Storage Job Created
```

---

### Time Trigger

Example:

```text
Configured Schedule
      ↓
Storage Job Created
```

Schedule frequency is externally configured.

The scheduler must not prescribe execution intervals.

---

### Startup Trigger

Example:

```text
Application Start
      ↓
Recovery Job
      ↓
Synchronization Job
```

---

### Shutdown Trigger

On shutdown signal:

1. The scheduler stops accepting new jobs.
2. CLAIMED and RUNNING jobs are allowed to reach a terminal state or are interrupted after the flush timeout.
3. QUEUED jobs are preserved — their state is not modified and they will be picked up on next startup.

The flush timeout is configurable (default: 30 seconds). If the timeout elapses, remaining RUNNING jobs are abandoned and logged. The flush is blocking — the shutdown signal is not forwarded to dependent services until the flush completes or times out.

---

### Recovery Trigger

Example:

```text
Mirror Violation
      ↓
Recovery Job
```

---

### Manual Trigger

Example:

```text
User Initiates Sync
      ↓
Storage Job Created
```

---

## 8. Scheduling Policy

### Configuration Driven

Scheduling policy must be externally configurable.

The Storage Scheduler provides infrastructure.

Applications define:

```text
Schedules
Priorities
Concurrency Limits
Retry Policies
Lane Configuration
```

---

### Runtime Independence

The scheduler must not assume:

```text
Specific intervals
Specific priorities
Specific retry rules
Specific lane counts
```

---

## 9. Execution Lifecycle

```text
CREATED
   ↓
QUEUED
   ↓
CLAIMED
   ↓
RUNNING
   ↓
COMPLETED
```

**State descriptions:**

| State | Meaning |
|---|---|
| CREATED | Job registered in SQLite; not yet scheduled |
| QUEUED | Waiting for lane capacity |
| CLAIMED | Lock acquired; execution beginning |
| RUNNING | Domain adapter executing synchronization |
| COMPLETED | Sync confirmed; Mirror Constraint satisfied |

---

### Failure Path

```text
RUNNING
   ↓
FAILED
   ↓
RETRY_PENDING
   ↓
QUEUED
```

**State descriptions:**

| State | Meaning |
|---|---|
| FAILED | Adapter reported error; lock released |
| RETRY_PENDING | Waiting for retry interval (bounded by maxRetries) |

---

### Terminal States

| State | Meaning |
|---|---|
| COMPLETED | Sync succeeded; domains consistent |
| FAILED | Max retries exhausted; domain may be inconsistent |
| CANCELLED | Job removed before execution; no sync occurred |
| EXPIRED | Scheduled window elapsed without execution |

**EXPIRED entry condition:** a QUEUED job transitions to EXPIRED when it has not been claimed within its execution window. The execution window is configurable per domain; the default is 24 hours from job creation time. Jobs in CLAIMED or RUNNING state do not expire.

A FAILED terminal state MUST emit an event via Event Registry for observability consumers. If the Event Registry is unavailable when a FAILED terminal state event must be emitted, the scheduler MUST record the failure locally (storage log). Event emission is retried when the Event Registry becomes available. If the runtime is shutting down and the Event Registry has already torn down, the failure is recorded to storage only — no further retry is attempted.

---

## 10. Concurrency Control

The scheduler must support:

```text
Global Concurrency Limits
Lane Concurrency Limits
Execution Locks
```

---

### Locking Rules

Each job must acquire an execution lock before processing.

Locks prevent:

```text
Duplicate Execution
Race Conditions
Parallel Mutation
```

**Lock collision:** when two QUEUED jobs with identical domain, operation type, and payloadRef attempt to acquire a lock simultaneously, the second job MUST be transitioned to CANCELLED with reason = `duplicate_lock_contention`. The first job proceeds. This is a terminal cancellation — the job does not retry.

---

## 11. Retry & Recovery

### Retry Rules

Retries must:

```text
Be bounded
Be persistent
Be recoverable
```

Retry strategy is configuration driven.

---

### Startup Recovery

On startup:

```text
Load Non-Terminal Jobs
Rebuild Queues
Resume Eligible Work
```

---

### Crash Recovery

Interrupted jobs must be recoverable through persisted execution state.

---

## 12. Mirror Constraint Integration

The Mirror Constraint definition is authoritative in `storage-architecture.md`. This section describes Storage Scheduler enforcement responsibilities only.

The Storage Scheduler is the enforcement layer for Mirror Constraint consistency across all synchronized domains.

**Mirror pairs:**

```text
SQLite Vault Projection
        ↕
Vault Record (Git)

SQLite Document Projection
        ↕
Google Docs Source

SQLite Sheet Projection
        ↕
Google Sheets Source
```

**Validation jobs generated by divergence:**

| Job Type | Trigger | Action |
|---|---|---|
| VERIFY | Scheduled or event-driven | Check projection matches source |
| RECONCILE | VERIFY detects divergence | Re-sync to restore consistency |
| RECOVER | RECONCILE fails or data missing | Restore from authoritative source |

---

## 13. Conflict Handling

A conflict occurs when source and projection disagree on state and neither can be automatically reconciled.

### Conflict Detection

Conflicts are detected during VERIFY and RECONCILE jobs.

Conditions that indicate conflict:

```text
Source modified since last projection
Projection modified locally without corresponding source change
Version hash mismatch with no clear resolution path
```

---

### Conflict Scope

The Storage Scheduler:

```text
Detects conflicts
Classifies conflict type
Logs conflict record to SQLite
Emits conflict event via Event Registry
Blocks further sync on affected record
```

The Storage Scheduler does NOT:

```text
Decide which version wins
Merge content
Apply business rules to resolution
```

---

### Conflict Resolution Ownership

| Layer | Responsibility |
|---|---|
| Storage Scheduler | Detect, classify, block, emit |
| Domain Adapter | Apply configured resolution strategy |
| Application | Define resolution strategy (PREFER_SOURCE / PREFER_PROJECTION / BLOCK) |

---

### Default Conflict Behavior

If no resolution strategy is configured:

```text
Block sync on conflicted record
Mark record CONFLICT in SQLite
Continue syncing non-conflicted records in same domain
```

Conflicted records remain blocked until explicitly resolved or strategy is applied.

---

## 14. Observability

The scheduler must expose:

```text
Queue Depth
Lane Saturation
Execution Latency
Retry Count
Failure Rate
Recovery Activity
```

---

### Consumers

```text
Infrastructure UI
Event Registry
Audit Layer
```

---

## 15. Security Boundaries

The scheduler must:

```text
Validate Job Inputs
Enforce Lane Isolation
Prevent Duplicate Execution
Respect Storage Permissions
```

---

## 16. Integration Contracts

### SQLite Runtime Store

Provides:

```text
Job Registry
Execution State
Scheduling Metadata
```

---

### Vault Service

Provides:

```text
Vault Operations
Git Synchronization
Mirror Validation
```

---

### Document Service

Provides:

```text
Document Discovery
Document Synchronization
Document Projection
```

---

### Sheet Service

Provides:

```text
Sheet Discovery
Sheet Synchronization
Sheet Projection
```

---

## 17. Design Invariants

### SQLite First

Applications interact exclusively with SQLite.

---

### Storage Only

The scheduler coordinates storage operations only.

---

### Configuration Driven

Scheduling policy is externally defined.

---

### Domain Isolation

Failures in one storage domain must not block others.

---

### Deterministic Recovery

Interrupted operations must be recoverable.

---

### Single Coordination Layer

All asynchronous storage operations must pass through the Storage Scheduler.

---

## 18. Future Extensions

Potential future domains:

```text
Repository Domain
File Domain
Knowledge Domain
```

The Storage Scheduler must support additional domains without architectural modification.

---

## 19. Completion Status

The Storage Scheduler is the authoritative orchestration layer for all asynchronous storage operations within Prana.

It provides:

```text
Synchronization Scheduling
Job Queuing and Lane Isolation
Execution and Locking
Conflict Detection and Classification
Recovery and Reconciliation
Observability
```

Core architectural invariant:

```text
Application → SQLite → Storage Scheduler → Domain Adapters → External Storage
```
