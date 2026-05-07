# 🚀 Feature: Onboarding Pipeline Orchestrator (Enhanced)

**Version:** 1.2.0
**Status:** Stable
**Pattern:** Deterministic State Machine · Master-Detail MVVM
**Service:** `onboardingOrchestratorService.ts`
**Storage Domain:** `onboarding_registry` (SQLite)
**Capability:** Enforces a deterministic, persistent, and auditable onboarding pipeline that guarantees Minimum Viable Governance (MVG) before runtime activation.

---

## 0. Runtime Implementation Update (2026-04-06)

The onboarding runtime now includes an explicit staged UX around the deterministic pipeline.

### 0.1 Implemented UX Gap Closures

| Gap (Prior) | Runtime Status | Notes |
| :---------- | :------------- | :---- |
| Missing Welcome/Orientation entry screen | Implemented | Added explicit welcome stage before step execution. |
| Missing phase-level policy/consent checkpoint | Implemented | Added consent stage that blocks progression until required confirmations are accepted. |
| Missing final Review/Confirm before commit | Implemented | Added review stage that aggregates onboarding context, model access summary, and commit preview. |
| Missing completion handoff screen | Implemented | Commit success now lands on completion stage before explicit transition to triage. |
| Weak pause/resume messaging | Implemented | Resume hint now shows checkpoint stage/step and timestamp when available. |
| Resume did not capture non-step stages | Implemented | Stage snapshot metadata now persists flow stage + consent state + checkpoint timestamp. |

### 0.2 Deterministic Contract Preservation

The UX stage additions do not change the deterministic commit contract:

* Core approval sequence remains step-gated and dependency-driven.
* Commit still requires all required onboarding steps to be approved.
* Snapshot persistence remains authoritative and resumable.

---

## 1. Tactical Purpose

The Onboarding Orchestrator is the **governance gatekeeper** of the Prana runtime.

It ensures that:

* All required system capabilities are **validated before activation**
* Host applications cannot bypass **security or configuration requirements**
* Onboarding progress is **persistent, resumable, and deterministic**
* The system reaches a **provably valid operational baseline (MVG)**

It operates as:

* A **state machine controller**
* A **compliance enforcement layer**
* A **metadata aggregation pipeline**
* A **pre-bootstrap validation authority**

---

## 2. System Invariants (Critical)

1. **No-Skip Enforcement**

   * Stages MUST execute sequentially
   * No manual override allowed

2. **Validation-Driven Progression**

   * Each stage MUST emit `VALID` before progression
   * Invalid state MUST block advancement

3. **Persistent Truth**

   * State MUST be stored in SQLite
   * Recovery MUST restore exact state

4. **Single Authority**

   * Only `onboardingOrchestratorService` controls transitions

5. **Pre-Boot Requirement**

   * `ONBOARDING_COMPLETE` MUST be true before full runtime access

---

## 3. State Machine Definition

### 3.1 Core States

```text id="onb1"
INIT → IN_PROGRESS → STAGE_VALIDATED → ONBOARDING_COMPLETE
```

---

### 3.2 Stage-Level States

```text id="onb2"
LOCKED → ACTIVE → VALIDATING → VALID → FAILED
```

---

### 3.3 Transition Rules

* A stage transitions:

  ```
  LOCKED → ACTIVE → VALIDATING → VALID
  ```

* Failure:

  ```
  VALIDATING → FAILED → ACTIVE
  ```

* Global progression:

  ```
  STAGE_N (VALID) → STAGE_N+1 (ACTIVE)
  ```

---

## 4. Standard Onboarding Pipeline (Formalized)

### 4.1 Stage Definitions

| Stage | Key                | Responsibility                  |
| :---- | :----------------- | :------------------------------ |
| 1     | INTELLIGENCE_SETUP | Model selection, context limits |
| 2     | CONNECTION_SETUP   | Channel configuration           |
| 3     | GOVERNANCE_SETUP   | Registry + mission validation   |
| 4     | INTEGRITY_CHECK    | Full Vaidyar diagnostic         |

---

### 4.2 Stage Contract

Each stage MUST define:

```ts
{
  stage_id: string,
  required: boolean,
  validator: string,
  output_schema: object
}
```

---

## 5. Data Flow Pipeline

```text
UI → IPC (submit) → Orchestrator → Feature Validator → Result → State Update → IPC (broadcast)
```

---

### 5.1 Constraints

* Orchestrator MUST:

  * not validate internally
  * delegate validation to feature modules

---

## 6. Persistence Model

### 6.1 SQLite Schema (Conceptual)

```ts
{
  current_stage: string,
  stage_status: string,
  completion_percentage: number,
  onboarding_complete: boolean,
  metadata: json
}
```

---

### 6.2 Recovery Guarantees

* On restart:

  * restore exact stage
  * restore validation state
  * resume from last ACTIVE stage

---

## 7. Metadata Aggregation Contract

### 7.1 Collected Data

* Model configuration
* Channel credentials
* Governance registry
* System validation results

---

### 7.2 Output (Final Handover)

```ts
{
  onboarding_complete: true,
  validated_config: object,
  timestamp: number
}
```

---

### 7.3 Integration Target

* Passed to:

  * `StartupOrchestrator`
  * `PranaRuntimeConfig`

---

## 8. IPC Contract (Formalized)

### 8.1 Events

| Event                     | Direction | Purpose                 |
| :------------------------ | :-------- | :---------------------- |
| `app:onboarding-state`    | Main → UI | Broadcast current state |
| `app:onboarding-submit`   | UI → Main | Submit stage data       |
| `app:onboarding-error`    | Main → UI | Validation failure      |
| `app:onboarding-complete` | Main → UI | Completion signal       |

---

### 8.2 State Payload

```ts
{
  stage: string,
  status: string,
  progress: number,
  metadata?: object,
  error?: string
}
```

---

## 9. Integration Points

### 9.1 With Startup Orchestrator

* MUST enforce:

  ```
  ONBOARDING_COMPLETE === true
  ```

* Otherwise:

  * block bootstrap progression

---

### 9.2 With Vaidyar

* Final stage triggers:

  * full system pulse
* MUST:

  * validate real-world connectivity

---

### 9.3 With Config System

* Outputs:

  * validated runtime configuration

---

### 9.4 With Notification Centre

* Emits:

  * onboarding errors
  * completion signals

---

## 10. Dynamic Stage System (New — Critical)

### 10.1 Purpose

Support host-specific onboarding flows

---

### 10.2 Stage Registration

```ts
registerStage({
  id: string,
  order: number,
  required: boolean,
  validator: function
})
```

---

### 10.3 Conditional Execution

* Stages MAY:

  * be skipped if `required = false`
  * be dynamically injected

---

### 10.4 Constraint

* Even dynamic stages MUST:

  * follow validation contract
  * be persisted

---

## 11. Failure Handling

| Scenario                     | Behavior          |
| :--------------------------- | :---------------- |
| Validation failure           | Remain in ACTIVE  |
| Missing data                 | Reject submission |
| External service unreachable | Retry or fail     |
| Vaidyar failure              | Block completion  |

---

## 12. Observability

System SHOULD track:

* time per stage
* validation failure rates
* retries per stage
* drop-off points
* total onboarding duration

---

## 13. Reset & Re-Onboard (New)

### 13.1 Trigger

* Manual reset OR system invalidation

---

### 13.2 Behavior

* Clear:

  * onboarding_registry
* Reset state to:

  * INIT

---

### 13.3 Constraint

* MUST require confirmation
* MUST log reset event

---

## 14. Deterministic Guarantees

* Onboarding path is strictly ordered
* State is fully recoverable
* Validation controls progression
* No hidden transitions
* Output is reproducible

---

## 15. Known Architectural Gaps (Expanded)

| Area                  | Gap                                | Impact |
| :-------------------- | :--------------------------------- | :----- |
| Conditional Branching | Limited dynamic flow support       | High   |
| Reset Mechanism       | Not standardized                   | High   |
| Validation Registry   | No centralized validator mapping   | Medium |
| Telemetry             | No tracking of onboarding friction | Medium |
| Partial Revalidation  | Cannot revalidate single stage     | Medium |

### 15.1 Gap Closure Notes (2026-04-06)

The following previously observed UX-level gaps are now closed in runtime implementation:

* Welcome/orientation flow
* Policy/consent gate before commit review
* Final review checkpoint before commit
* Completion handoff screen
* Resume checkpoint messaging and non-step stage restore

---

## 16. Cross-Module Contracts

* **Feature Validators**

  * MUST return deterministic validation results

* **Vaidyar**

  * MUST provide final system integrity status

* **Startup Orchestrator**

  * MUST block if onboarding incomplete

* **Config System**

  * MUST consume validated metadata

---

## 17. Deterministic Boundaries

### Validation Boundary

```text
STAGE INPUT → VALIDATOR → RESULT
```

---

### State Boundary

```text
CURRENT STATE → TRANSITION → NEXT STATE
```

---

### Bootstrap Boundary

```text
ONBOARDING_COMPLETE → ENABLE STARTUP
```

---

## 18. System Role (Final Positioning)

This module is:

* The **entry gate of governance**
* The **enforcer of system readiness**
* The **builder of runtime configuration truth**

---

## 19. Strategic Role in Architecture

It connects:

* **Auth Layer** → identity
* **Config Layer** → runtime definition
* **Vaidyar** → system validation
* **Startup Orchestrator** → execution readiness

---

### Critical Observation

This module ensures your system is not just:

> “Configurable”

but:

> “**Provably valid before execution**”

---

## Security Enforcement (v1.2)

| Enforcement | Mechanism | Status |
|---|---|---|
| **IPC Validation** | `app:onboarding-state` and `app:onboarding-submit` accept typed payloads | ✅ Enforced |
| **Single Authority** | Only `onboardingOrchestratorService` controls stage transitions — no manual override paths | ✅ Enforced |
| **UX Stages** | Welcome, Consent, Review, Completion stages all implemented (per §0 update 2026-04-06) | ✅ Resolved in v1.2 |

**Implementation Services:** `onboardingStageStoreService.ts` · `startupOrchestratorService.ts`


