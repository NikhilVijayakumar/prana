# 🧠 Feature: Onboarding — Model & Context Configuration (Enhanced)

**Version:** 1.2.0
**Status:** Stable
**Pattern:** Capability-Aware Configuration · Token Governance Layer
**Services:** `runtimeModelAccessService.ts` · `tokenManagerService.ts`
**Storage Domain:** `model_configuration` (SQLite)
**Capability:** Establishes deterministic cognitive boundaries by configuring model capabilities, token limits, and context policies for all runtime intelligence operations.

---

## 1. Tactical Purpose

This feature is the **Cognitive Boundary Definition Layer** of the Prana runtime.

It ensures that:

* All AI interactions operate within **strict token limits**
* Context lifecycle is **predictable and controlled**
* Model capabilities are **validated before use**
* The system is **aware of cost, latency, and constraints**

It operates as:

* A **model capability registry**
* A **token budget controller**
* A **context lifecycle calibrator**
* A **pre-runtime validation layer**

---

## 2. System Invariants (Critical)

1. **Token Safety Enforcement**

   * Runtime MUST NOT exceed configured token limits
   * All requests MUST be validated against budget

2. **Deterministic Context Behavior**

   * Context rotation and compaction MUST follow fixed thresholds

3. **Capability Validation**

   * Model MUST support required features before activation

4. **Single Source of Truth**

   * `model_configuration` in SQLite is authoritative

5. **Immutable Snapshot**

   * Configuration MUST be versioned and treated as runtime snapshot

---

## 3. Configuration Schema (Formalized)

### 3.1 Model Configuration

```ts
{
  model_name: string,
  provider_id: string,
  api_version: string,
  max_context_tokens: number,
  max_output_tokens: number,
  capabilities: {
    tool_calling: boolean,
    streaming: boolean,
    embeddings: boolean
  },
  token_policy: {
    rotation_threshold: number,
    compaction_strategy: string
  }
}
```

---

### 3.2 Versioning (New)

```ts
{
  config_version: string,
  created_at: timestamp,
  checksum: string
}
```

---

## 4. Token Governance Model

### 4.1 Token Budget Breakdown

```text
TOTAL_CONTEXT = INPUT + MEMORY + SYSTEM + OUTPUT
```

---

### 4.2 Allocation Strategy

| Segment | Purpose            |
| :------ | :----------------- |
| Input   | User prompt        |
| Memory  | Historical context |
| System  | Instructions       |
| Output  | Model response     |

---

### 4.3 Threshold Rules

* Rotation trigger:

  ```
  USED_TOKENS ≥ ROTATION_THRESHOLD
  ```

* Hard limit:

  ```
  USED_TOKENS ≤ MAX_CONTEXT_TOKENS
  ```

---

## 5. Calibration Pipeline

```text
MODEL_SELECTION → METADATA_RESOLUTION → TOKEN_CALIBRATION → CAPABILITY_VALIDATION → VAIDYAR_CHECK → COMMIT
```

---

### 5.1 Stage Breakdown

#### 1. Selection

* User selects model from host-provided list

#### 2. Metadata Resolution

* Fetch:

  * token limits
  * capabilities

#### 3. Token Calibration

* Initialize:

  * tokenManager
  * thresholds

#### 4. Capability Validation

* Ensure required features exist

#### 5. Connectivity Check

* Vaidyar verifies endpoint reachability

#### 6. Commit

* Persist configuration

---

## 6. Capability Contract (New)

### 6.1 Required Capabilities

```ts
{
  tool_calling: boolean,
  json_mode: boolean,
  streaming: boolean
}
```

---

### 6.2 Validation Rules

* Missing required capability MUST:

  * block onboarding stage

---

### 6.3 Capability Registry

* Maintained by:

  * `runtimeModelAccessService`

---

## 7. Integration with Cognitive Memory

### 7.1 Context Lifecycle

* Based on:

  * token thresholds

---

### 7.2 Compaction Trigger

* When threshold exceeded:

  * summarize older context
  * persist digest

---

### 7.3 Memory Policy

| Strategy       | Behavior         |
| :------------- | :--------------- |
| Sliding Window | Drop oldest      |
| Summarization  | Compress history |
| Hybrid         | Combine both     |

---

## 8. Multi-Model Support (New — Critical)

### 8.1 Profile Definition

```ts
{
  profile_id: string,
  model_config: object,
  usage_type: 'FAST' | 'SMART' | 'EMBEDDING'
}
```

---

### 8.2 Routing Strategy

* Agents MAY:

  * select model based on task type

---

### 8.3 Constraint

* Each profile MUST:

  * follow full validation pipeline

---

## 9. Runtime Enforcement

### 9.1 TokenManager Responsibilities

* Track token usage
* Enforce limits
* Trigger compaction

---

### 9.2 Failure Conditions

| Scenario            | Behavior         |
| :------------------ | :--------------- |
| Token overflow      | Block request    |
| Invalid config      | Reject execution |
| Capability mismatch | Fail early       |

---

## 10. Observability

System MUST track:

* token usage per request
* compaction frequency
* overflow incidents
* model latency
* request success rate

---

## 11. Cost Awareness (New)

### 11.1 Cost Model

```ts
{
  input_cost_per_1k: number,
  output_cost_per_1k: number
}
```

---

### 11.2 Runtime Estimation

* Estimate:

  * cost per request
  * monthly usage projection

---

### 11.3 UI Feedback

* SHOULD display:

  * cost range
  * usage warnings

---

## 12. Failure Handling

| Scenario               | Behavior            |
| :--------------------- | :------------------ |
| Invalid model metadata | Block configuration |
| Token mismatch         | Fail calibration    |
| Endpoint unreachable   | Fail Vaidyar check  |
| Missing capability     | Reject model        |

---

## 13. Deterministic Guarantees

* Token usage is always bounded
* Context lifecycle is predictable
* Model capabilities are validated
* Configuration is immutable per session
* Runtime behavior is reproducible

---

## 14. Known Architectural Gaps (Expanded)

| Area                | Gap                       | Impact |
| :------------------ | :------------------------ | :----- |
| Dynamic Testing     | No real-time latency test | High   |
| Multi-Model Routing | Limited support           | High   |
| Cost Visualization  | Not implemented           | Medium |
| Capability Registry | Not centralized           | Medium |
| Adaptive Thresholds | No dynamic tuning         | Low    |

---

## 15. Cross-Module Contracts

* **TokenManager**

  * MUST enforce token safety

* **Cognitive Memory**

  * MUST respect compaction thresholds

* **Vaidyar**

  * MUST validate model connectivity

* **Onboarding Orchestrator**

  * MUST block if invalid

---

## 16. Deterministic Boundaries

### Token Boundary

```text
TOKEN_LIMIT → ENFORCEMENT → REQUEST
```

---

### Context Boundary

```text
CONTEXT_SIZE → THRESHOLD → COMPACTION
```

---

### Capability Boundary

```text
MODEL_CAPABILITIES → VALIDATION → ACTIVATION
```

---

## 17. System Role (Final Positioning)

This module is:

* The **cognitive safety layer**
* The **token governance authority**
* The **model capability validator**

---

## 18. Strategic Role in Architecture

It connects:

* **Onboarding** → configuration
* **Cognitive Memory** → context lifecycle
* **Agents** → execution constraints
* **Vaidyar** → runtime validation

---

### Critical Observation

This module ensures your system is not just:

> “AI-powered”

but:

> “**Cognitively bounded, predictable, and safe under all conditions**”

---


