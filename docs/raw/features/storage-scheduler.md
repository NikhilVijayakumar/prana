# ⏱️ Feature: Storage Scheduler

**Version:** 2.0.0
**Status:** Stable / Core
**Service:** `storageSchedulerService.ts`
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

#### Business Logic

The Storage Scheduler does not:

```text
Execute application logic
Execute workflows
Execute agents
Execute domain services
```

---

#### Domain Ownership

The Storage Scheduler does not own:

```text
Vault
Documents
Sheets
```

It coordinates operations performed by domain adapters.

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
System State
Configuration
Metadata
Workflows
Agents
Plugins
```

External Persistence:

```text
Vault ↔ Git
```

---

### Document Domain

Purpose:

```text
Human Authored Content
Documentation
Knowledge Articles
Research
Policies
```

External Persistence:

```text
SQLite ↔ Google Docs
```

---

### Sheet Domain

Purpose:

```text
Structured Business Data
Reference Data
Master Data
Catalog Data
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

Example:

```text
Application Shutdown
      ↓
Pending Flush
      ↓
Storage Job
```

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

---

### Terminal States

```text
COMPLETED
FAILED
CANCELLED
EXPIRED
```

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

The Storage Scheduler is responsible for enforcing synchronization workflows that maintain mirror consistency.

Examples:

```text
SQLite Workflow
        ↕
Vault Workflow

SQLite Document
        ↕
Google Document

SQLite Sheet
        ↕
Google Sheet
```

Mirror validation may generate:

```text
VERIFY
RECONCILE
RECOVER
```

jobs.

---

## 13. Observability

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
Vaidyar
Infrastructure UI
Notification Centre
Audit Layer
```

---

## 14. Security Boundaries

The scheduler must:

```text
Validate Job Inputs
Enforce Lane Isolation
Prevent Duplicate Execution
Respect Storage Permissions
```

---

## 15. Integration Contracts

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

## 16. Design Invariants

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

## 17. Future Extensions

Potential future domains:

```text
Email Domain
Repository Domain
File Domain
Workspace Domain
Knowledge Domain
```

The Storage Scheduler must support additional domains without architectural modification.

---

## 18. Completion Status

The Storage Scheduler is the authoritative orchestration layer for all asynchronous storage operations within Prana.

It provides:

```text
Scheduling
Queuing
Execution
Recovery
Reconciliation
Observability
```

while preserving the core architectural invariant:

Application → SQLite → Storage Scheduler → External Storage Domains

```
```
