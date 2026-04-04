# Feature: Vaidyar — Runtime Integrity Engine & Dashboard

**Version:** 1.3.0  
**Status:** Stable / Core  
**Pattern:** Diagnostic Registry · Continuous Health Monitoring · MVVM UI Surface  
**Services:** `vaidyarService.ts` · `systemHealthService.ts`  
**UI Stack:** `IntegrationVerificationPage.tsx` (Container → ViewModel → View)  
**Capability:** Provides a unified runtime integrity system that continuously evaluates, reports, and visualizes the health of storage, security, network, and cognitive layers.

---

## 1. Tactical Purpose

**Vaidyar** is the **authoritative health system** of the runtime. It acts as both:

- a **diagnostic engine** (main process)
- a **visual verification surface** (renderer dashboard)

It ensures that:
- system integrity is continuously verified
- failures are classified and surfaced deterministically
- critical issues block unsafe operations
- operators have full transparency into runtime health

---

### 1.1 "It Does" (Scope)

* **Diagnostic Execution:** Runs modular health checks across all runtime layers
* **Structured Reporting:** Produces a normalized `VaidyarReport`
* **Health Classification:** Assigns `Healthy`, `Degraded`, or `Blocked` states
* **Startup Gating:** Provides blocking signals to Startup Orchestrator
* **Continuous Monitoring:** Supports periodic pulse checks via scheduler
* **Event Emission:** Publishes health changes to Notification Centre
* **UI Visualization:** Renders real-time system health via Dashboard
* **Contract Validation:** Verifies runtime configuration against actual environment

---

### 1.2 "It Does Not" (Boundaries)

* Modify system state or auto-repair failures
* Execute business logic or domain workflows
* Replace audit/history logging systems
* Override security or storage policies

---

## 2. Diagnostic Architecture

### 2.1 Diagnostic Registry Model

- All checks are:
  - modular
  - independently executable
  - grouped by layer

Each check must define:
- `check_id`
- `layer`
- `severity`
- `execution_fn`
- `expected_state`
- `failure_hint`

---

### 2.2 Execution Flow

```text id="k2s9fd"
REGISTERED CHECKS → EXECUTION → RESULT NORMALIZATION → REPORT AGGREGATION → STATE CLASSIFICATION
````

---

### 2.3 Vaidyar Report Structure

```json
{
  "timestamp": "ISO8601",
  "overall_status": "Healthy | Degraded | Blocked",
  "layers": [
    {
      "name": "Storage",
      "status": "Healthy",
      "checks": [
        {
          "check_id": "vault_mount",
          "status": "Healthy",
          "message": "Vault mounted successfully",
          "severity": "high"
        }
      ]
    }
  ]
}
```

---

## 3. Health Layer Model

### 3.1 Standard Layers

| Layer     | Scope                        | Criticality |
| --------- | ---------------------------- | ----------- |
| Storage   | System Drive, SQLite, Vault  | High        |
| Security  | Encryption, Auth, SSH        | High        |
| Network   | External APIs, Channels      | Medium      |
| Cognitive | Context engine, token limits | Medium      |

---

### 3.2 State Classification

```text id="j3n8ks"
HEALTHY → All checks pass  
DEGRADED → Non-critical failures present  
BLOCKED → Critical failure prevents safe operation
```

---

### 3.3 Classification Rules

* Any **High severity failure** → `BLOCKED`
* Multiple **Medium failures** → `DEGRADED`
* All checks pass → `HEALTHY`

---

## 4. Execution Modes

### 4.1 Bootstrap Mode

* Invoked by Startup Orchestrator
* Used for:

  * pre-storage validation
  * post-bootstrap integrity check
* Can block system startup

---

### 4.2 Runtime Pulse Mode

* Triggered via:

  * cron scheduler
  * manual UI refresh
* Used for:

  * detecting mid-session failures
  * updating dashboard state

---

### 4.3 On-Demand Mode

* Triggered by:

  * UI interaction
  * developer/debug tools

---

## 5. Integration Contracts

### 5.1 With Startup Orchestrator

* Provides:

  * blocking signals (`BLOCKED_SECURITY`, etc.)
* Invoked at:

  * Layer 1 (identity validation)
  * Layer 3 (integration validation)

---

### 5.2 With Storage Layer

* Validates:

  * System Drive mount
  * Vault accessibility
  * SQLite integrity

---

### 5.3 With Queue System

* Monitors:

  * queue depth
  * execution backlog
* Emits:

  * warnings on saturation

---

### 5.4 With Context Engine

* Validates:

  * token limits
  * digest consistency
* Ensures:

  * no context overflow risk

---

### 5.5 With Notification Centre

* Emits events:

  * state transitions
  * failure alerts
* Triggers:

  * user-facing notifications

---

## 6. Dashboard (UI Surface)

### 6.1 MVVM Structure

* **Container:** Handles IPC and polling
* **ViewModel:** Aggregates and transforms health data
* **View:** Renders diagnostic state

---

### 6.2 UI Responsibilities

* Display:

  * overall system status
  * per-layer health
  * individual check results
* Provide:

  * failure explanations
  * suggested remediation steps

---

### 6.3 Interaction Model

* Real-time updates via IPC
* Manual refresh capability
* Drill-down per diagnostic check

---

## 7. Observability & Telemetry

System must expose:

* health state transitions
* check execution latency
* failure frequency per layer
* degraded duration tracking

---

### 7.1 Event Types

* `HEALTH_STATE_CHANGED`
* `CHECK_FAILED`
* `CHECK_RECOVERED`
* `SYSTEM_BLOCKED`

---

## 8. Failure Modes

| Scenario            | Behavior             |
| ------------------- | -------------------- |
| Vault unmounted     | Storage → BLOCKED    |
| SSH failure         | Security → BLOCKED   |
| API timeout         | Network → DEGRADED   |
| Token overflow risk | Cognitive → DEGRADED |
| SQLite lock         | Storage → BLOCKED    |

---

### 8.1 Recovery Behavior

* System does not auto-heal
* Requires:

  * operator action
  * or upstream service correction
* Recovery detected via next pulse

---

## 9. Performance Constraints

* Diagnostic execution must:

  * be lightweight
  * not block UI thread
* Heavy checks must:

  * be deferred or scheduled
* Parallel execution allowed for:

  * non-dependent checks

---

## 10. Known Architectural Gaps (Roadmap)

| Area                  | Gap                                               | Impact |
| --------------------- | ------------------------------------------------- | ------ |
| Background Monitoring | No continuous heartbeat worker                    | High   |
| Auto-Recovery Hooks   | No integration with orchestrator for self-healing | High   |
| Deep Diagnostics      | No raw log inspection UI                          | Medium |
| Check-Level Retry     | No per-check re-execution from UI                 | Medium |
| External Telemetry    | No remote reporting capability                    | Low    |

---

