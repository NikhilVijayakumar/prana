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

### 8.2 Failure UI Contract

* MUST show:

  * error message
  * failure type
  * retry/exit options

---

### 8.3 Retry Model (New)

* UI MAY expose:

  * `Retry Bootstrap`
* Retry MUST:

  * re-trigger orchestrator from INIT
  * clear previous state

---

## 9. Watchdog Timer (New — Critical)

### 9.1 Purpose

Prevent infinite hangs during startup

---

### 9.2 Behavior

* Each stage has max execution time
* If exceeded:

  * emit `TIMEOUT_ERROR`
  * transition to failure state

---

### 9.3 UI Response

* Display:

  * "Startup Timeout"
  * retry option

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

## 13. Known Architectural Gaps (Expanded)

| Area              | Gap                                  | Impact   |
| :---------------- | :----------------------------------- | :------- |
| Watchdog Timer    | No timeout enforcement               | Critical |
| Retry Mechanism   | No in-app retry flow                 | High     |
| Diagnostics UI    | No detailed failure inspection       | High     |
| State Persistence | Cannot resume after restart          | Medium   |
| Degraded UX       | No clear degraded-mode visualization | Medium   |

---

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


