# 📧 Feature: Email Intelligence & Orchestration Pipeline (Enhanced)

**Status:** Stable / Policy-Gated
**Services:** `emailOrchestratorService.ts` · `emailBrowserAgentService.ts` · `emailKnowledgeContextStoreService.ts`
**Storage Domain:** `email_artifacts` (SQLite) / `knowledge_documents` (Vault)
**Capability:** Automates the intake, triage, and draft-assembly of email communications while enforcing a strict "Human-in-the-Loop" send policy.

---

## 1. Tactical Purpose

The Email Pipeline transforms unstructured email streams into a **structured, queryable knowledge system** while preserving **operator control over outbound communication**.

It operates as:

* A **continuous ingestion pipeline** (Scheduler-driven)
* A **semantic processing layer** (context extraction + agent reasoning)
* A **draft orchestration system** (multi-agent synthesis)
* A **controlled handoff boundary** (human-validated send)

---

## 2. System Invariants (Critical)

1. **Human-in-the-Loop Enforcement**

   * No automated send capability MUST exist
   * All outbound communication MUST require explicit operator action

2. **UID Idempotency**

   * Each email (UID) MUST be processed exactly once per account
   * Duplicate ingestion MUST be prevented at storage level

3. **Cache ↔ Vault Mirror Constraint**

   * Every Vault document MUST have a corresponding SQLite edit state
   * No Vault write without prior cache persistence

4. **Pipeline Determinism**

   * Each email MUST follow a defined lifecycle stage
   * No stage skipping or implicit transitions allowed

5. **Executor Isolation**

   * Email pipeline MUST not execute outside Scheduler-triggered or explicit user-triggered flows

6. **Credential Isolation**

   * Email credentials MUST remain within auth/local secure handling boundaries
   * No credential persistence in Vault

---

## 3. Architectural Dependencies

| Component           | Role                          | Relationship                               |
| :------------------ | :---------------------------- | :----------------------------------------- |
| **Main Process**    | `emailOrchestratorService`    | Core pipeline controller                   |
| **Main Process**    | `cronSchedulerService`        | Drives ingestion heartbeat                 |
| **Main Process**    | `emailImapService`            | Executes IMAP unread polling adapter       |
| **Main Process**    | `emailBrowserAgentService`    | Handles interactive/browser-based flows    |
| **Storage**         | SQLite (`email_artifacts`)    | Active pipeline state and triage data      |
| **Storage**         | Vault (`knowledge_documents`) | Long-term structured knowledge             |
| **Cognitive Layer** | Context Engine                | Consumes extracted knowledge for reasoning |
| **Runtime Store**   | `runtimeDocumentStore`        | Draft staging before Vault persistence     |

---

## 4. Pipeline State Model

### 4.1 Email Lifecycle States

```text id="n0p4vx"
FETCHED → TRIAGED → CONTEXT_EXTRACTED → DRAFT_GENERATED → REVIEW_PENDING → COMMITTED
```

---

### 4.2 Extended States

```text id="r6tq8e"
SKIPPED
FAILED
RETRY_PENDING
ARCHIVED
```

---

### 4.3 State Transition Rules

* Each state MUST:

  * persist output before transitioning
  * emit structured event

* Transitions MUST be:

  * deterministic
  * idempotent

* Failures MUST:

  * transition to `FAILED` or `RETRY_PENDING`
  * never silently skip

---

## 5. The Email Lifecycle (Deterministic Pipeline)

### 5.1 Intake (Scheduler Trigger)

* Triggered via `CronScheduler`
* Poll unread IMAP UIDs per account (App Password auth)
* Default pulse profile: `twice_daily` (light, deterministic cadence)
* Validate against processed UID registry

**Output:**

* New email entries in SQLite (`email_artifacts`)

---

### 5.2 Triage

Responsibilities:

* Parse:

  * headers
  * sender
  * subject
  * body
* Normalize content
* Deduplicate via UID

**Output:**

* Structured email record in SQLite

---

### 5.3 Context Extraction

Handled by: `emailKnowledgeContextStoreService`

Responsibilities:

* Extract:

  * entities (people, orgs)
  * dates / deadlines
  * intent classification
* Build thread-aware context digest

**Output:**

* Context object stored in SQLite
* Indexed for retrieval (RAG compatibility)

---

### 5.4 Draft Generation

Responsibilities:

* Invoke agent(s)
* Generate candidate responses
* Merge outputs into structured draft

**Constraints:**

* Must include attribution metadata
* Must preserve original thread context

**Output:**

* Draft stored in `runtimeDocumentStore`

---

### 5.5 Review (Human Gate)

* Draft presented in UI (**Dhi**)
* Operator can:

  * edit
  * approve
  * discard

---

### 5.6 Commit (Vault Persistence)

* On approval:

  * Draft + triage summary written to Vault
  * SQLite updated with commit reference

**Constraint:**

* Must satisfy Mirror Constraint before commit

---

### 5.7 Handoff

* Operator performs send via:

  * native client
  * browser (`emailBrowserAgentService`)

---

## 6. Data Contracts

### 6.1 Email Artifact (SQLite: `email_artifacts`)

```ts
{
  uid: string,
  account_id: string,
  subject: string,
  sender: string,
  body: string,
  received_at: timestamp,
  status: 'FETCHED' | 'TRIAGED' | 'PROCESSED',
  thread_id?: string
}
```

---

### 6.2 Context Digest

```ts
{
  email_uid: string,
  entities: string[],
  dates: timestamp[],
  intent: string,
  summary: string
}
```

---

### 6.3 Draft Document (Runtime)

```ts
{
  draft_id: string,
  email_uid: string,
  content: string,
  contributors: string[],
  created_at: timestamp,
  status: 'PENDING' | 'APPROVED' | 'DISCARDED'
}
```

---

## 7. Scheduler Integration Contract

### 7.1 Template Job

* `EMAIL_POLL` MUST be registered as a **Template Job**
* Execution mode is IMAP pulse polling (manual or scheduler-triggered only)

Example:

```ts
registerExecutor('EMAIL_POLL', emailOrchestrator.runHeartbeat)
```

---

### 7.2 Execution Constraints

* Scheduler MUST:

  * prevent overlapping runs per account
  * respect locking

* Email pipeline MUST:

  * be idempotent across retries
  * tolerate partial execution

---

## 8. Storage Governance Compliance

### 8.1 SQLite (Active State)

Stores:

* email artifacts
* triage state
* context digests
* draft working state

---

### 8.2 Vault (Committed Knowledge)

Stores:

* finalized drafts
* structured summaries
* long-term knowledge artifacts

---

### 8.3 Mirror Constraint Enforcement

* Vault write MUST:

  * reference SQLite record
  * include metadata linkage

* SQLite MUST:

  * track Vault document ID

---

## 9. Browser Agent Integration

### 9.1 Responsibilities

* Handle:

  * Gmail sessions
  * human-guided browser fallback flows
  * interactive UI operations

---

### 9.2 Constraints

* Must not:

  * bypass human interaction
  * auto-send emails

* Must:

  * operate within sandboxed execution

---

## 10. Failure Modes & Handling

| Scenario                 | Behavior              |
| :----------------------- | :-------------------- |
| Duplicate UID            | Skip ingestion        |
| Parsing failure          | Mark as FAILED        |
| Context extraction error | Retry or fallback     |
| Agent failure            | Partial draft allowed |
| Vault write failure      | Retry, block commit   |
| Scheduler overlap        | Prevent via locking   |

---

## 11. Observability

System MUST track:

* emails processed per cycle
* triage success rate
* draft generation latency
* approval vs discard ratio
* Vault commit success rate
* retry frequency

---

## 12. Deterministic Guarantees

* Each email is processed exactly once per UID
* Pipeline stages are strictly ordered
* Drafts are never auto-sent
* Vault writes occur only after explicit approval
* All intermediate states are persisted

---

## 13. Known Architectural Gaps (Expanded Roadmap)

| Area                  | Gap                                        | Impact |
| :-------------------- | :----------------------------------------- | :----- |
| Management UI         | No account + polling configuration surface | High   |
| IMAP Transport Ops    | No packaged Python runtime contract yet    | Medium |
| Attachment Handling   | No structured binary processing pipeline   | Medium |
| Thread Modeling       | Weak conversation threading across emails  | Medium |
| Backpressure Control  | No throttling under large inbox load       | High   |
| Retry Strategy        | No formal retry/backoff policy             | Medium |
| Privacy Filters       | No PII classification/redaction layer      | Medium |

---

## 14. Cross-Module Contracts (Explicit)

* **Scheduler**

  * MUST trigger ingestion deterministically
  * MUST prevent concurrent execution per account

* **Cognitive Engine**

  * Consumes context digests for reasoning
  * Must not mutate source artifacts

* **Vault Service**

  * Must enforce Mirror Constraint on commit

* **Vaidyar**

  * Should receive:

    * pipeline failures
    * ingestion anomalies
    * Vault commit errors

---

## 15. Deterministic Boundaries (Critical Insight)

* **Hard Stop Boundary:**

  ```
  DRAFT_GENERATED → REVIEW_PENDING
  ```

  No automation beyond this point

* **Execution Boundary:**

  * Scheduler-driven OR user-triggered only

* **Security Boundary:**

  * No outbound communication capability within system

---

This module is now strongly aligned with:

* Scheduler determinism
* Vault governance
* Cognitive pipeline consistency

---



---

## Security Enforcement (v1.2)

| Enforcement | Mechanism | Status |
|---|---|---|
| **wrappedFetch** | All HTTP-bound email operations use `wrappedFetch` with timeout enforcement | Enforced |
| **UID Idempotency** | Per-account UID deduplication prevents duplicate processing | Enforced |
| **Human-in-the-Loop** | All outbound operations require human-confirmed handoff â€” no autonomous sending | Enforced |
| **IPC Validation** | Email IPC handlers accept typed payloads | Enforced |

