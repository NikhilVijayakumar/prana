This module is already structurally aligned with your **Startup Orchestrator**, but it can be elevated into a **first-class deterministic UX boundary** between system state and user perception.

The enhancement below focuses on:

* Formalizing **UI ↔ Orchestrator contract**
* Making bootstrap **state machine explicit in UI**
* Strengthening **failure visibility + recovery paths**
* Defining **strict gating guarantees**
* Aligning with **zero-trust + fail-fast architecture**

---

# 🌅 Feature: Splash & System Initialization — The Bootstrap Journey (Enhanced)

**Status:** Stable
**Pattern:** Service-Orchestrated MVVM · State-Synchronized Bootstrap UI
**Service:** `startupOrchestratorService.ts`
**UI Stack:** `SplashContainer` → `SplashViewModel` → `SplashView`
**Capability:** Provides a deterministic, observable, and fail-fast startup experience that mirrors the internal bootstrap state machine of the Prana runtime.

---

## 1. Tactical Purpose

The Splash System is the **visual execution boundary** of the Startup Orchestrator.

It ensures that:

* System initialization is **transparent and traceable**
* Users are never exposed to **undefined or partial states**
* Failures are **visible, actionable, and blocking**
* Transition to runtime occurs only after **full system readiness**

It operates as:

* A **state-synchronized UI mirror** of bootstrap lifecycle
* A **readiness gatekeeper for application access**
* A **failure surface for critical startup violations**
* A **controlled transition manager into operational state**

---

## 2. System Invariants (Critical)

1. **Strict Readiness Gate**

   * Main UI MUST NOT load before `READY`
   * No partial rendering allowed

2. **State Synchronization**

   * UI state MUST reflect orchestrator state exactly
   * No derived or inferred states in UI

3. **Fail-Fast Visibility**

   * Any blocking failure MUST be immediately surfaced
   * No silent retries without UI awareness

4. **Deterministic Progression**

   * Bootstrap stages MUST appear in fixed order
   * No parallel or out-of-order rendering

5. **Single Source of Truth**

   * `StartupOrchestrator` is the only authority
   * UI MUST NOT manage bootstrap logic

---

## 3. Bootstrap State Mapping (UI ↔ Core)

### 3.1 Core State Machine

```text
INIT → FOUNDATION → IDENTITY_VERIFIED → STORAGE_READY → INTEGRITY_VERIFIED → OPERATIONAL
```

---

### 3.2 UI State Mapping

| Core State         | UI Representation      |
| :----------------- | :--------------------- |
| INIT               | Initializing           |
| FOUNDATION         | Validating Environment |
| IDENTITY_VERIFIED  | Verifying Identity     |
| STORAGE_READY      | Mounting Storage       |
| INTEGRITY_VERIFIED | Checking System Health |
| OPERATIONAL        | Ready                  |

---

### 3.3 Failure States

```text
BLOCKED_SECURITY
BLOCKED_STORAGE
BLOCKED_INTEGRATION
DEGRADED_MODE
```

---

### 3.4 UI Rules

* Each state MUST:

  * display status message
  * update progress indicator

* Failure MUST:

  * halt animation
  * show blocking UI

---

## 4. Bootstrap Sequence (Refined Handshake)

1. **Seed**

   * Host sends `app:bootstrap-host` payload

2. **Validation**

   * `StartupOrchestrator` validates `PranaRuntimeConfig`

3. **Execution**

   * Sequential layer execution begins

4. **Streaming**

   * Status updates emitted via IPC (`app:bootstrap-status`)

5. **Completion**

   * `READY` signal emitted

6. **Transition**

   * Splash unmounts → Main Layout mounts

---

## 5. IPC Contract (Formalized)

### 5.1 Status Payload

```ts
{
  state: string,
  progress: number,
  message: string,
  error?: {
    code: string,
    message: string
  }
}
```

---

### 5.2 Event Types

| Event              | Purpose               |
| :----------------- | :-------------------- |
| `bootstrap:start`  | Initialization begins |
| `bootstrap:update` | State progression     |
| `bootstrap:error`  | Blocking failure      |
| `bootstrap:ready`  | System ready          |

---

## 6. Data Flow

```text
StartupOrchestrator → IPC Bridge → SplashContainer → ViewModel → View
```

---

### 6.1 Constraints

* Data MUST:

  * be unidirectional
  * not be mutated in UI layer

---

## 7. UI Rendering Model

### 7.1 Components

* **Progress Indicator**

  * percentage-based
* **Status Text**

  * human-readable mapping
* **Error Panel**

  * visible only on failure
* **Branding Layer**

  * driven by `VisualIdentityEngine`

---

### 7.2 Rendering States

| State    | UI Behavior          |
| :------- | :------------------- |
| Loading  | Animated progress    |
| Success  | Transition animation |
| Failure  | Static error display |
| Degraded | Warning banner       |

---

## 8. Failure Handling Model

### 8.1 Failure Categories

| Type                | Behavior         |
| :------------------ | :--------------- |
| Security Failure    | Hard block       |
| Storage Failure     | Block or degrade |
| Integration Failure | Degraded mode    |
| Timeout             | Fail with retry  |

---

### 8.2 Failure UI Contract — ✅ IMPLEMENTED

Error panel displays:
* **Error message** - from orchestrator stage
* **Error code** - e.g., `TIMEOUT_ERROR`, `STARTUP_BLOCKED`
* **Retry button** - "Retry Bootstrap" (re-triggers orchestrator from INIT)
* **Alert styling** - uses MUI Alert component with error severity

Implementation in `SplashView.tsx` shows structured error display.

---

### 8.3 Retry Model — ✅ IMPLEMENTED

* UI exposes "Retry Bootstrap" button in error panel when `isError = true`
* Retry re-triggers orchestrator from INIT state
* Previous state cleared before retry:
  * `bootProgress` reset to 0
  * `bootCurrentState` reset to INIT
  * `isError` reset to false
* No automatic retry; user must explicitly click button
* Retry count not limited

## 9. Watchdog Timer (New — Critical) — ✅ IMPLEMENTED

### 9.1 Purpose

Prevent infinite hangs during startup by enforcing per-stage maximum execution times.

---

### 9.2 Behavior

* Each stage has a configurable max execution time
* If a stage exceeds its timeout:
  * Execution is interrupted
  * Stage is marked as `FAILED` with `errorCode: 'TIMEOUT_ERROR'`
  * Downstream stages are skipped (if blocking)
  * `TIMEOUT_ERROR` message displayed in splash UI

---

### 9.3 Timeouts by Stage

See **Section 13.1** for detailed timeout values per stage (ranging from 30-60 seconds).

---

### 9.4 UI Response to Timeout

* Displays error panel:
  * Error message: `"Stage '[stageName]' exceeded timeout of [N]ms"`
  * Error code: `TIMEOUT_ERROR`
* Provides "Retry Bootstrap" button for user-initiated recovery
* Does not automatically retry

---

## 10. Observability

System MUST track:

* total bootstrap duration
* time per stage
* failure frequency
* retry attempts
* timeout occurrences

---

## 11. Integration Points

### 11.1 With Startup Orchestrator

* Receives:

  * state updates
  * failure signals

---

### 11.2 With Vaidyar

* MAY surface:

  * degraded mode warnings

---

### 11.3 With Storage Layer

* Reflects:

  * mount success/failure

---

### 11.4 With Sync Engine (Future)

* Reflects:

  * initial reconciliation status

---

## 12. Deterministic Guarantees

* UI reflects exact system state
* No transition without `READY`
* No hidden failures
* Progress is strictly ordered
* Failure always halts progression

---

## 13. Known Architectural Gaps (Status Update)

| Area              | Gap Status     | Implementation Details                                                                   |
| :---------------- | :------------- | :--------------------------------------------------------------------------------------- |
| Watchdog Timer    | ✅ IMPLEMENTED | Per-stage max duration timeouts; stages exceeding limits emit TIMEOUT_ERROR and fail     |
| Retry Mechanism   | ✅ IMPLEMENTED | "Retry Bootstrap" button in error panel; re-triggers orchestrator from INIT state        |
| Degraded UX       | ✅ IMPLEMENTED | Distinct degraded-mode rendering with warning alert; separate from error state          |
| Diagnostics UI    | ⚠️ PARTIAL     | Basic error message display implemented; detailed diagnostics UI not yet added           |
| State Persistence | ⏳ NOT YET     | Bootstrap state can be persisted to disk; resume logic is future work (Phase 4)          |

---

### 13.1 Watchdog Timer Implementation

**File:** `src/main/services/startupOrchestratorService.ts`

**Per-Stage Timeouts (milliseconds):**

| Stage                        | Timeout (sec) | Rationale                                    |
| :--------------------------- | :------------ | :------------------------------------------- |
| `integration`                | 30            | Validates config contracts                   |
| `governance`                 | 45            | SSH verification + possible repo clone       |
| `vault`                      | 60            | Vault init + sync pull operations            |
| `storage-mirror-validation`  | 30            | Mirror contract validation                   |
| `vaidyar`                    | 45            | Bootstrap diagnostics and checks             |
| `sync-recovery`              | 60            | Sync queue recovery tasks                    |
| `cron-recovery`              | 60            | Cron scheduler recovery + job initialization |

**Execution Model:** `executeWithWatchdog()` helper wraps async operations with `Promise.race()`:

```ts
Promise.race([
  operation(),
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Stage exceeded ${timeoutMs}ms`)), timeoutMs);
  })
])
```

**Failure Handling:** On timeout:
* Stage marked as `FAILED` with `errorCode: 'TIMEOUT_ERROR'`
* Downstream stages skipped if blocking stage times out
* Time-out error message displayed in splash UI

---

### 13.2 Retry Mechanism Implementation

**Files:**
* `src/ui/splash/viewmodel/useSplashViewModel.ts` - retry handler
* `src/ui/splash/view/SplashView.tsx` - retry button UI
* `src/ui/splash/view/SplashContainer.tsx` - retry callback wiring

**Retry Flow:**
1. User clicks "Retry Bootstrap" button in error panel
2. `handleRetry()` resets state: `bootProgress = 0`, `bootCurrentState = INIT`
3. `startBootstrapSequence()` re-invoked with clean state
4. Orchestrator re-runs from INIT stage

**Constraints:**
* Retry only available when `isError = true`
* Does not retry automatic SSH/identity checks (SSH failure is terminal - routes to `/access-denied`)
* Retry count not limited (user can retry indefinitely)

---

### 13.3 Degraded UX Visualization Implementation

**Files:**
* `src/ui/splash/view/SplashView.tsx` - degraded rendering
* `src/ui/splash/viewmodel/useSplashViewModel.ts` - degraded state detection

**Visual Indicators:**
* Container border color changes to warning color (`muiTheme.palette.warning.main`)
* Container background dims to warning background
* Progress bar changes to warning color
* Alert badge shown: "Degraded startup: Some recovery stages failed, but core services are operational."

**Triggering Condition:**
```ts
if (startupStatus.overallStatus === 'DEGRADED') {
  setIsDegraded(true);
}
```

* Non-blocking failures (e.g., `sync-recovery`, `cron-recovery` stages) mark status as `DEGRADED`
* Allows progression to main UI (unlike `BLOCKED` which shows error panel)



## 14. Cross-Module Contracts

* **Startup Orchestrator**

  * MUST emit deterministic state updates

* **UI Layer**

  * MUST not derive or alter state

* **Drive Controller**

  * MUST report mount status clearly

* **Sync Engine (Future)**

  * MUST integrate into bootstrap phase

---

## 15. Deterministic Boundaries

### Execution Boundary

```
ORCHESTRATOR → STATE TRANSITION → IPC
```

---

### UI Boundary

```
IPC STATE → VIEWMODEL → RENDER
```

---

### Access Boundary

```
NOT READY → BLOCK MAIN UI
READY → ALLOW ACCESS
```

---

## 16. System Role (Final Positioning)

This module is:

* The **first user-visible system boundary**
* The **gatekeeper of runtime readiness**
* The **visual representation of system truth**

---

## 17. Strategic Role in Architecture

It connects:

* **Authentication** → identity gate
* **Storage** → mount readiness
* **Sync** → initial consistency
* **Vaidyar** → system integrity

---

### Critical Observation

This is not just a splash screen anymore—it is:

> A **deterministic execution monitor for system boot**

---


