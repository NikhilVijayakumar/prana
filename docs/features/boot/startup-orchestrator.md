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

### 3.1 Core States

```text
INIT → FOUNDATION → IDENTITY_VERIFIED → STORAGE_READY → INTEGRITY_VERIFIED → OPERATIONAL
```

---

### 3.2 Extended States (Explicit)

```text
AUTH_PENDING → AUTHENTICATED
RECOVERY_PENDING → RECOVERY_ACTIVE → RECOVERY_COMPLETE
```

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

## 4. Layered Bootstrap Protocol

---

### 4.1 Layer 0: Authentication Gate (Pre-Foundation)

**Dependency:** Authentication Stack

Responsibilities:

* Await valid session from authentication system
* Validate session token integrity
* Bind session to runtime context

**Constraints:**

* System MUST remain in `AUTH_PENDING` until success
* No bootstrap execution allowed before authentication

**Outcome Conditions:**

* SUCCESS → `AUTHENTICATED` → proceed to FOUNDATION
* FAILURE → remain in `AUTH_PENDING`

---

### 4.2 Layer 1: Foundation (Environment & Identity)

Responsibilities:

* Validate `PranaRuntimeConfig`
* Initialize SQLite access (read-only validation first)
* Load SSH metadata from cache
* Perform SSH handshake with remote Vault authority
* Validate host fingerprint

**Outcome Conditions:**

* SUCCESS → `IDENTITY_VERIFIED`
* FAILURE → `BLOCKED_SECURITY`

---

### 4.3 Layer 2: Persistence (Storage)

Responsibilities:

* Initialize System Drive
* Validate SQLite integrity (full access)
* Mount Vault (post identity verification only)
* Validate:

  * Vault structure
  * `.metadata.json`
  * registry alignment

**Constraints:**

* MUST NOT execute without `IDENTITY_VERIFIED`
* MUST enforce Cache ↔ Vault Mirror Constraint baseline

**Outcome Conditions:**

* SUCCESS → `STORAGE_READY`
* FAILURE → `BLOCKED_STORAGE`

---

### 4.4 Layer 3: Connectivity (Integrity)

Responsibilities:

* Execute Vaidyar system pulse
* Validate:

  * integration endpoints
  * channel readiness
  * service dependencies
* Classify failures (critical vs non-critical)

**Outcome Conditions:**

* FULL SUCCESS → `INTEGRITY_VERIFIED`
* PARTIAL FAILURE → `DEGRADED_MODE`
* CRITICAL FAILURE → `BLOCKED_INTEGRATION`

---

### 4.5 Layer 4: Operation (Background Systems)

Responsibilities:

* Start scheduler
* Resume queues
* Trigger recovery workflows
* Activate runtime services

**Constraints:**

* MUST execute only after integrity validation

**Outcome Conditions:**

* SUCCESS → `OPERATIONAL`

---

## 5. Identity Verification Contract

### 5.1 Verification Inputs

* SSH private key (SQLite-backed)
* Repository URL
* Known hosts / fingerprint
* Local session context (from auth layer)

---

### 5.2 Verification Guarantees

* Remote Vault authority MUST be:

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

## 8. Telemetry & UI Contract

### 8.1 Status Emission

Each layer MUST emit:

* `state`
* `status`: pending | success | failed
* `progress`: numeric (0–100)
* `message`: human-readable
* `error_code`: structured identifier
* `timestamp`

---

### 8.2 Splash Integration

Must:

* reflect real-time state transitions
* display blocking failures clearly
* prevent UI transition before `OPERATIONAL`

---

## 9. Integration Points

### 9.1 With Authentication Stack

* MUST wait for authenticated session
* MUST validate session before bootstrap
* MUST invalidate session on critical failure (future)

---

### 9.2 With Vaidyar

Receives:

* system pulse results

Emits:

* security violations
* degraded state signals
* bootstrap diagnostics

---

### 9.3 With Queue System

Triggers:

* queue recovery
* task resumption

Constraints:

* MUST ensure storage readiness before execution

---

### 9.4 With Storage Layer

Initializes:

* System Drive lifecycle
* Vault mount lifecycle

Enforces:

* mirror constraint baseline before operation

---

## 10. Failure Modes & Handling

| Scenario               | Behavior                        |
| :--------------------- | :------------------------------ |
| Authentication failure | Block at AUTH_PENDING           |
| SSH failure            | BLOCKED_SECURITY                |
| SQLite corruption      | BLOCKED_STORAGE                 |
| Vault mount failure    | BLOCKED_STORAGE / DEGRADED_MODE |
| Integration failure    | BLOCKED_INTEGRATION             |
| Partial system failure | DEGRADED_MODE                   |
| Recovery failure       | Log and continue (non-blocking) |

---

### 10.1 Degraded Mode

Allowed when:

* non-critical systems fail

System MUST:

* surface warnings
* restrict sensitive operations
* maintain audit visibility

---

## 11. Observability

System MUST track:

* bootstrap duration per layer
* state transition timeline
* failure frequency by type
* recovery success rate
* identity verification latency
* Vault mount latency

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

## 13. Known Architectural Gaps (Expanded Roadmap)

| Area                     | Gap                                                    | Impact |
| :----------------------- | :----------------------------------------------------- | :----- |
| Offline Identity Mode    | No cached verification fallback                        | High   |
| SSH Key Rotation         | No secure renewal flow                                 | Medium |
| Remote Repo Health       | No sync validation during bootstrap                    | Medium |
| Partial Bootstrap Resume | Cannot resume from mid-layer                           | Medium |
| Session Binding          | Auth session not strongly bound to bootstrap lifecycle | High   |
| Mirror Validation        | No explicit enforcement during storage initialization  | High   |
| Parallel Initialization  | No safe parallelization for non-critical layers        | Low    |

---


