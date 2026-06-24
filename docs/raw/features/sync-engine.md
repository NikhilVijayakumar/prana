# 🔄 Feature: Sync Engine

**Version:** 2.0.0
**Status:** Core / Foundational
**Capability:** Sole authorized mutator across Prana storage domains. Executes storage operations via domain adapters and enforces the Mirror Constraint on every write.

---

## 1. Tactical Purpose

The Sync Engine is the single write authority for all synchronized storage domains within Prana.

It is dispatched by the Storage Scheduler and executes storage operations through domain adapters.

It operates as:

* The **only authorized mutator** for Vault, Document, and Sheet domains
* The **write coordination layer** between SQLite and external storage
* The **Mirror Constraint enforcement point** on every write operation

---

## 2. System Invariants (Critical)

1. **Single Write Authority**

   * Only the Sync Engine may write to Vault, Document, or Sheet domains
   * No runtime component may bypass the Sync Engine for domain writes

2. **Mirror Constraint Enforcement**

   * After every write, the Sync Engine MUST validate that the SQLite projection and the domain record are logically equivalent
   * A write that cannot satisfy the Mirror Constraint MUST be rolled back

3. **Adapter Delegation**

   * The Sync Engine does not implement domain-specific logic
   * All domain-specific behavior is delegated to the domain adapter

4. **Idempotent Execution**

   * Every operation MUST be safe to re-execute after interruption
   * Re-execution of a completed operation MUST produce the same result without side effects

5. **Write Consistency**

   * Each document write must achieve Mirror Constraint consistency — the SQLite projection and domain record must both reach a consistent state, or the write must be rolled back
   * Atomicity of external writes is the adapter's responsibility; the Sync Engine enforces consistency via post-write VERIFY
   * If VERIFY confirms divergence after a write, the write is rolled back and the job retried — the system fails toward a consistent known state

---

## 3. What the Sync Engine Does Not Own

```text
Job scheduling          — owned by Storage Scheduler
Domain schemas          — owned by Storage Architecture and domain adapters
External API access     — owned by domain adapters
Conflict resolution     — owned by domain adapters and application configuration
Synchronization policy  — owned by application configuration
```

---

## 4. Domain Adapter Contract

Each domain adapter must implement the following operations.

All operations must be:

* **Idempotent** — safe to retry without side effects
* **Atomic** — partial writes must not leave a domain in an inconsistent state
* **Deterministic** — same inputs produce same outputs

---

### Operations

#### PULL

Fetch content from the external provider and write the SQLite projection.

* Input: document reference (ID or path)
* Output: success confirmation or structured failure reason
* Mirror Constraint: projection MUST match provider content after completion

---

#### PUSH

Write SQLite content to the external provider.

* Input: document reference and current projection content
* Output: success confirmation or structured failure reason
* Mirror Constraint: provider record MUST match projection after completion

---

#### VERIFY

Check whether the SQLite projection matches the domain record.

* Input: document reference
* Output: consistent | diverged | source_missing
* No writes occur during VERIFY

---

#### RECONCILE

Restore consistency between SQLite projection and domain record when divergence is detected.

* Input: document reference and divergence report from VERIFY
* Output: success confirmation or structured failure reason
* If resolution strategy is BLOCK: emit conflict event, halt reconciliation for affected record

---

#### RECOVER

Restore a domain record from the authoritative source when RECONCILE fails or when domain data is missing or unrecoverable.

* Input: document reference and recovery source designation (which side is authoritative)
* Output: success confirmation or structured failure reason
* The designated authoritative source is treated as ground truth — no merge occurs; the non-authoritative side is overwritten
* RECOVER is destructive: local changes on the non-authoritative side are discarded without merge
* RECOVER MUST NOT be used as a substitute for RECONCILE when divergence is resolvable — it is only dispatched when RECONCILE has failed or data is absent

---

## 5. Execution Model

### Dispatch

The Sync Engine receives jobs from the Storage Scheduler. It does not create or queue jobs.

Each job carries:

* domain (`vault` | `document` | `sheet`)
* operation (`PUSH` | `PULL` | `RECONCILE` | `VERIFY` | `RECOVER`)
* payloadRef (reference to the target document or record)

The Sync Engine selects the appropriate domain adapter and delegates execution.

---

### Write Ordering

* SQLite projection MUST be written before the external domain record for PUSH operations
* External domain record MUST be read before the SQLite projection is updated for PULL operations
* This ordering ensures the system fails in a state where the external record is always authoritative

---

### Post-Write Validation

After every write operation (PUSH or PULL), the Sync Engine MUST run an implicit VERIFY.

* If VERIFY passes: operation is marked COMPLETED
* If VERIFY fails: write is rolled back; job transitions to RETRY_PENDING or FAILED depending on retry policy

---

### RECOVER Execution

RECOVER is dispatched by the Storage Scheduler when RECONCILE fails or when a domain record is detected as missing or unrecoverable.

Execution sequence:

1. Adapter fetches content from the designated authoritative source
2. Non-authoritative side is overwritten with authoritative content
3. SQLite projection is updated to reflect the authoritative state
4. Post-write VERIFY confirms Mirror Constraint is satisfied
5. If VERIFY passes: job transitions to COMPLETED
6. If VERIFY fails: job transitions to FAILED — no further automatic retry; the domain record state is indeterminate and requires operator remediation

RECOVER does not retry on VERIFY failure because retrying the same overwrite with the same authoritative content would produce the same result. Persistent VERIFY failure after RECOVER indicates a structural inconsistency that cannot be resolved automatically.

---

## 6. Failure Modes

| Scenario | Behavior |
| :--- | :--- |
| Adapter throws during PULL | Job transitions to RETRY_PENDING; no projection written |
| Adapter throws during PUSH | Job transitions to RETRY_PENDING; external record may be partially written — adapter is responsible for rollback |
| Mirror Constraint fails post-write | Write rolled back; job transitions to RETRY_PENDING |
| Mirror Constraint fails after max retries | Job transitions to FAILED; conflict event emitted via Event Registry |
| RECONCILE blocked by BLOCK strategy | Job transitions to FAILED with reason = conflict_blocked; conflict record written to SQLite |
| VERIFY detects source_missing | Source document no longer exists; job transitions to FAILED with reason = source_missing |
| Adapter throws during RECOVER | Job transitions to FAILED with reason = recover_failed; domain record state is indeterminate — operator remediation required |
| VERIFY fails after RECOVER | Job transitions to FAILED with reason = recover_verify_failed; Mirror Constraint not satisfied; no automatic retry |

All FAILED terminal states MUST emit an event via Event Registry for observability consumers.

---

## 7. Integration Points

### Storage Scheduler

The Sync Engine is dispatched by the Storage Scheduler. It does not operate independently.

All job creation, queuing, and retry scheduling are owned by the Storage Scheduler.

---

### Storage Architecture

Storage domains and Mirror Constraint rules are defined in `storage-architecture.md`.

The Sync Engine enforces those rules — it does not define them.

---

### Event Registry

The Sync Engine emits failure and conflict events via Event Registry.

It does not subscribe to events.

---

## 8. Observability

The Sync Engine MUST expose:

```text
Operations executed per domain (PUSH / PULL / RECONCILE / VERIFY / RECOVER)
Mirror Constraint violations detected
Mirror Constraint violations resolved
Adapter failure rate per domain
Rollback count per domain
```

---

## 9. Completion Status

The Sync Engine is the sole authorized write path for all synchronized storage domains in Prana.

It provides:

```text
Domain write authorization
Domain adapter dispatch
Mirror Constraint enforcement
Write atomicity
Post-write validation
```

while explicitly excluding:

```text
Job scheduling
Domain schema ownership
Conflict resolution policy
External API access
Synchronization policy
```
