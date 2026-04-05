This is already a strong core module. The enhancement below focuses on **tightening determinism, clarifying cross-module contracts, formalizing invariants, and exposing hidden failure boundaries**—while preserving your structure and intent.

---

# ⚙️ Feature: Startup Orchestrator (Enhanced)

**Version:** 1.3.0
**Status:** Stable / Core
**Pattern:** Deterministic Layered Bootstrap · Identity-Locked Execution Gate
**Service:** `startupOrchestratorService.ts`
**Capability:** Coordinates a strict, state-driven bootstrap lifecycle that validates environment integrity, enforces identity verification, initializes storage systems, and transitions the runtime into an operational state.

---

## 1. Tactical Purpose

The **Startup Orchestrator** is the **root execution authority** of the runtime. It governs all execution prior to system readiness and acts as the **primary enforcement layer for zero-trust initialization**.

It guarantees that:

* No subsystem is activated without **verified identity**
* Storage layers are not accessed without **security validation**
* System startup follows a **strict, deterministic order**
* Failures are handled via **explicit state transitions**
* Recovery is **consistent and idempotent across restarts**

---

## 2. System Invariants (Critical)

1. **Identity Precedence**

   * No Vault or secure storage operation may execute before `IDENTITY_VERIFIED`

2. **Deterministic Execution**

   * Bootstrap layers MUST execute sequentially
   * No parallel execution across critical layers

3. **Fail-Fast Guarantee**

   * Any critical failure MUST halt progression immediately

4. **Single Authority**

   * Only `StartupOrchestrator` may transition runtime to `OPERATIONAL`

5. **State Integrity**

   * System MUST always exist in a valid, known state
   * No implicit or skipped transitions allowed

6. **Recovery Safety**

   * Recovery processes MUST execute only after `STORAGE_READY` and `INTEGRITY_VERIFIED`

---

## 3. Bootstrap State Machine

### 3.1 Core States (Implemented v1.3.1)

```text
INIT → FOUNDATION → IDENTITY_VERIFIED → STORAGE_READY → STORAGE_MIRROR_VALIDATING → INTEGRITY_VERIFIED → OPERATIONAL
```

**Note:** `STORAGE_MIRROR_VALIDATING` is an explicit blocking state added in v1.3.1 to enforce Cache ↔ Vault mirror contract validation immediately after vault initialization.

---

### 3.2 Extended States (Planned)

```text
AUTH_PENDING → AUTHENTICATED
RECOVERY_PENDING → RECOVERY_ACTIVE → RECOVERY_COMPLETE
```

**Implementation Note:** Authentication (Layer 0) is currently implemented **outside** the orchestrator as a prerequisite. Session validation is assumed to have completed before `app:bootstrap-host` IPC is invoked. Session binding to bootstrap lifecycle is a future enhancement.

---

### 3.3 Failure States

```text
BLOCKED_SECURITY
BLOCKED_STORAGE
BLOCKED_INTEGRATION
DEGRADED_MODE
```

---

### 3.4 State Transition Rules

* Each state MUST:

  * complete fully before transition
  * emit structured success/failure signal

* Transitions MUST:

  * be atomic
  * be logged

* Failures MUST:

  * halt progression (except degraded paths)
  * emit structured error events

* No implicit retries inside state transitions

---

## 4. Layered Bootstrap Protocol (v1.3.1 Implementation)

---

### 4.0 Pre-Bootstrap: Authentication Gate (External)

**Status:** Implemented outside orchestrator

The startup orchestrator assumes authentication has already completed before `app:bootstrap-host` is invoked. The Splash component ensures:

* Valid session exists
* Session token is present
* User identity is established

**Future Enhancement:** Session binding to bootstrap lifecycle and invalidation on critical failure.

---

### 4.1 Layer 0: Integration Contract Validation (Replaces Layer 0 Auth)

**Stage ID:** `integration`
**Dependency:** `runtimeConfigService`

Responsibilities:

* Validate `PranaRuntimeConfig` key presence
* Check integration endpoint availability
* Verify `RuntimeIntegrationStatus`

**Constraints:**

* MUST execute first (no prerequisites)

**Outcome Conditions:**

* SUCCESS → `FOUNDATION`
* FAILURE → `BLOCKED` (halt startup, skip all downstream)

---

### 4.2 Layer 1: Foundation (Governance & Identity)

**Stage ID:** `governance`
**Dependency:** `governanceRepoService`

Responsibilities:

* Ensure governance repository is cloned/ready
* Verify SSH configuration
* Validate governance repo integrity

**Constraints:**

* MUST NOT execute without `FOUNDATION` (integration success)
* MUST establish identity baseline for vault access

**Outcome Conditions:**

* SUCCESS → `IDENTITY_VERIFIED`
* FAILURE → `BLOCKED_SECURITY` (halt, skip vault and downstream)

---

### 4.3 Layer 2: Persistence (Storage)

**Stage ID:** `vault`
**Dependency:** `vaultService`, `syncProviderService`

Responsibilities:

* Mount System Drive (virtual drive controller)
* Initialize Vault access
* Perform initial sync pull from remote
* Validate structural integrity

**Constraints:**

* MUST NOT execute without `IDENTITY_VERIFIED`
* MUST initialize SQLite access

**Outcome Conditions:**

* SUCCESS → `STORAGE_READY`
* FAILURE → `BLOCKED_STORAGE` (halt, skip downstream)

---

### 4.4 Layer 2b: Storage Mirror Validation (NEW - v1.3.1)

**Stage ID:** `storage-mirror-validation`
**Dependency:** `syncProviderService`, `vaultService`
**Blocking:** Yes

Responsibilities:

* Validate Cache ↔ Vault mirror contract
* Ensure all vault domain keys have corresponding cache entries
* Check for mapping consistency

**Constraints:**

* MUST execute only after `STORAGE_READY`
* MUST validate before proceeding to Integrity layer

**Outcome Conditions:**

* SUCCESS → `STORAGE_MIRROR_VALIDATING`
* FAILURE → `BLOCKED_STORAGE` (halt, skip downstream)

---

### 4.5 Layer 3: Connectivity (Integrity)

**Stage ID:** `vaidyar`
**Dependency:** `vaidyarService`
**Blocking:** Yes

Responsibilities:

* Execute Vaidyar system pulse diagnostics
* Validate:

  * system health
  * blocking signals
  * service dependencies
* Classify failures (critical vs non-critical)

**Constraints:**

* MUST execute only after `STORAGE_READY` and mirror validation
* MUST check for blocking signals and halt if present

**Outcome Conditions:**

* FULL SUCCESS → `INTEGRITY_VERIFIED`
* BLOCKING SIGNALS → `BLOCKED` (halt)

---

### 4.6 Layer 4: Recovery & Operations (Background Systems)

**Stage IDs:** `sync-recovery`, `cron-recovery`
**Dependency:** `recoveryOrchestratorService`, `cronSchedulerService`
**Blocking:** No (degradable)

Responsibilities:

* **sync-recovery:** Resume pending sync tasks
* **cron-recovery:** Initialize scheduler, recover missed runs

**Constraints:**

* MUST execute only after `INTEGRITY_VERIFIED`
* Failures DEGRADE system to degraded state, not BLOCKED
* MUST be idempotent and repeat-safe

**Outcome Conditions:**

* SUCCESS → contributes to `OPERATIONAL`
* FAILURE → System remains `OPERATIONAL` with `DEGRADED` status

---

## 5. Identity Verification Contract

### 5.1 Verification Inputs

* SSH configuration and keys
* Repository governance URL
* Known hosts / fingerprint
* Local runtime context

---

### 5.2 Verification Guarantees

* Governance repository MUST be:

  * authenticated
  * reachable
  * trusted (fingerprint match)

* Local Vault MUST NOT:

  * mount before verification
  * operate in isolation without explicit degraded mode

---

### 5.3 Security Enforcement

* Failure MUST:

  * halt system immediately
  * block all storage access
  * emit Vaidyar signal: `SECURITY_VIOLATION`

---

## 6. Storage Initialization Contract

### 6.1 System Drive

Must:

* resolve mount path deterministically
* ensure read/write capability
* initialize SQLite connection

Failure Behavior:

* May fallback (if configured)
* MUST emit degraded signal

---

### 6.2 Vault Drive

Must:

* mount only after identity verification
* validate:

  * metadata integrity
  * structural correctness
  * registry consistency

Constraints:

* MUST comply with Data Security & Sync Protocol
* MUST establish baseline for mirror validation

---

## 7. Recovery & Continuity

### 7.1 Recovery Triggers

* pending queue tasks
* missed cron executions
* incomplete sync states
* interrupted transactions

---

### 7.2 Recovery Execution

Must occur only after:

* `STORAGE_READY`
* `INTEGRITY_VERIFIED`

---

### 7.3 Idempotency Guarantees

Recovery operations MUST:

* be repeat-safe
* not duplicate execution
* maintain consistency across retries

---

### 7.4 Recovery State Flow

```text
RECOVERY_PENDING → RECOVERY_ACTIVE → RECOVERY_COMPLETE
```

---

## 8. Telemetry & UI Contract (v1.3.1)

### 8.1 Status Report Structure

Each startup report MUST include:

* `currentState`: Current boot state (INIT, FOUNDATION, IDENTITY_VERIFIED, STORAGE_READY, STORAGE_MIRROR_VALIDATING, INTEGRITY_VERIFIED, OPERATIONAL)
* `overallStatus`: overall status (READY, DEGRADED, BLOCKED)
* `overallProgress`: numeric (0–100, monotonically increasing)
* `stages[]`: array of stage reports, each containing:
  * `id`: stage identifier (integration, governance, vault, storage-mirror-validation, vaidyar, sync-recovery, cron-recovery)
  * `state`: the target state for this stage
  * `status`: PENDING, SUCCESS, FAILED, SKIPPED
  * `progress`: numeric (0–100, stage-scoped progress)
  * `message`: human-readable status message
  * `errorCode`: structured error identifier (optional)
  * `isBlocking`: boolean (whether failure blocks startup)
  * `startedAt`: ISO timestamp
  * `finishedAt`: ISO timestamp

---

### 8.2 Real-Time Progress Events (NEW - v1.3.1)

The orchestrator emits progress events via IPC to the Splash renderer during startup. Events include:

* `type`: 'stage-start' | 'stage-complete' | 'stage-skip' | 'stage-fail' | 'sequence-complete'
* `stage`: current stage report
* `currentState`: current boot state
* `overallProgress`: monotonic progress percentage
* `timestamp`: ISO timestamp

**IPC Channel:** `app:startup-progress` (host → renderer)

**Splash Integration (React):**

```typescript
// Subscribe to progress updates
window.api?.app?.onStartupProgress((event) => {
  setBootProgress(event.overallProgress);
  setBootCurrentState(event.currentState);
  setStatusMessage(event.stage?.message);
});
```

---

### 8.3 Splash Display Requirements

Splash MUST:

* render real-time progress bar (0–100%)
* display current state label
* show current stage activity message
* block UI transition before reaching `OPERATIONAL`
* display blocking failures clearly
* use fallback `app:get-startup-status` snapshot if events are missed (late subscriber recovery)

---

## 9. Integration Points

### 9.1 With Authentication Stack

* Authentication MUST complete before `app:bootstrap-host` IPC is invoked
* Session context is assumed to exist at bootstrap start
* **Future:** Session binding to bootstrap lifecycle and invalidation on critical failure

---

### 9.2 With Vaidyar

Receives:

* system pulse results
* blocking signal list

Emits:

* blocking signals → halt bootstrap
* degraded state signals → degrade system
* bootstrap diagnostics

---

### 9.3 With Queue System

Respects:

* queue recovery occurs only after `INTEGRITY_VERIFIED`
* failures in recovery degrade system status, do not block

---

### 9.4 With Storage Layer

Enforces:

* Cache ↔ Vault mirror contract validation before proceeding to integrity layer
* no vault access before `IDENTITY_VERIFIED`

---

## 10. Failure Modes & Handling

| Scenario                   | Behavior                                          |
| :------------------------- | :------------------------------------------------ |
| Integration contract fail  | BLOCKED (halt, skip all downstream)               |
| SSH failure                | BLOCKED (halt, skip vault and downstream)         |
| Vault mount failure        | BLOCKED (halt, skip downstream)                   |
| Mirror validation failure  | BLOCKED (halt, skip vaidyar and downstream)       |
| Vaidyar blocking signal    | BLOCKED (halt, skip recovery)                     |
| Sync recovery failure      | DEGRADED (continue to cron, reach OPERATIONAL)    |
| Cron recovery failure      | DEGRADED (proceed to finalization)                |
| Finalization failure (hook | WARNING (logged, non-blocking)                    |
| system, etc)              |                                                  |

---

### 10.1 Degraded Mode

System enters `DEGRADED` when:

* non-critical systems fail (recovery stages)
* blocking stages all succeed

System MUST:

* surface warnings in logs
* allow startup to complete to `OPERATIONAL`
* restrict sensitive operations (future)
* maintain audit visibility

---

## 11. Observability

System tracks:

* bootstrap duration per layer (startedAt, finishedAt timestamps)
* state transition timeline (via stage completions)
* failure frequency by type (errorCode, stage id)
* recovery success rate (via telemetry)
* progress granularity (0–100 per stage, monotonic overall)

---

## 12. Deterministic Guarantees

* Startup sequence is strictly ordered and non-parallel
* Every state transition is explicit and logged
* No subsystem activates before required prerequisites
* Failure always resolves to a known state
* System cannot reach `OPERATIONAL` without:

  * authenticated session
  * verified identity
  * validated storage
  * integrity checks

---

## 13. Known Architectural Gaps & Roadmap (v1.3.1 Status)

| Area                      | Gap                                                       | Status           | Impact |
| :------------------------ | :-------------------------------------------------------- | :--------------- | :----- |
| **Mirror Validation**      | Explicit enforcement during storage initialization (v1.3) | ✅ **IMPLEMENTED** | Closed |
| Offline Identity Mode     | No cached verification fallback                           | Open             | High   |
| Session Binding (Bootstrap Lifecycle) | Auth session not bound to bootstrap lifecycle lifecycle | Open             | High   |
| SSH Key Rotation          | No secure renewal flow during bootstrap                   | Open             | Medium |
| Remote Repo Health Check  | No remote sync validation during bootstrap                | Open             | Medium |
| Partial Bootstrap Resume  | Cannot resume from mid-layer on restart                  | Open             | Medium |
| Real-Time Progress (IPC)  | Push progress events to Splash (v1.3.1)                  | ✅ **IMPLEMENTED** | Closed |
| Progress Callbacks        | Support progress listeners in orchestrator (v1.3.1)      | ✅ **IMPLEMENTED** | Closed |
| Parallel Initialization   | No safe parallelization for non-critical layers          | Open             | Low    |

---

## Implementation Notes (v1.3.1)

* **Storage Mirror Validation:** Added as explicit `storage-mirror-validation` stage between vault and vaidyar. Validates Cache ↔ Vault mirror contract before integrity checks.
* **Real-Time Progress:** Bootstrap progress is streamed to Splash via IPC events (`app:startup-progress`). Splash displays monotonic progress and current boot state in real time.
* **Session Lifecycle:** Authentication is currently **external** to the orchestrator. Session validation must complete before `app:bootstrap-host` is invoked. Future enhancement: bind session to bootstrap lifecycle and invalidate on critical failure.
* **Error Codes:** All stage failures emit `errorCode` for structured error classification.
* **Idempotency:** Recovery stages (sync-recovery, cron-recovery) must be idempotent and safe for retry. Non-blocking failures are logged, and system reaches `OPERATIONAL` with `DEGRADED` status.

---


