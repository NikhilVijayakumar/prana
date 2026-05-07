This module is already conceptually strong—it sits at a **critical semantic boundary** before your graph-based governance kicks in. The enhancement below focuses on:

* **Formalizing validation contracts**
* **Eliminating ambiguity in “context correctness”**
* **Strengthening determinism + auditability**
* **Tight coupling with Governance Graph + Cognitive Layer**

---

# 🧾 Feature: Onboarding — Business Registry & Context Validation (Enhanced)

**Version:** 1.2.0
**Status:** Alpha / Evolving
**Pattern:** Deterministic Validation Pipeline · Context Integrity Gate
**Services:** `businessContextRegistryService.ts` · `businessContextValidationService.ts`
**Storage Domain:** `business_registry_context` (SQLite)
**Capability:** Enforces structural, semantic, and relational integrity of business metadata to ensure that all downstream agentic reasoning operates on consistent, non-ambiguous context.

---

## 1. Tactical Purpose

The **Business Registry & Context Validation** module is the **semantic integrity layer** of the Prana runtime.

It ensures that:

* Business context is **complete**
* Relationships are **logically consistent**
* KPIs are **operationally meaningful**
* Agents receive **high-fidelity context inputs**

It operates as:

* A **context validation engine**
* A **pre-governance filter**
* A **semantic consistency checker**
* A **human-confirmed approval gate**

---

## 2. System Invariants (Critical)

1. **Context Completeness**

   * All mandatory fields MUST be present and meet minimum depth requirements

2. **Structural Integrity**

   * Registry hierarchy MUST follow defined schema (Org → Product → Feature)

3. **KPI Validity**

   * Every KPI MUST map to at least one measurable or executable reference

4. **Deterministic Validation**

   * Same input MUST always produce identical validation results

5. **Immutable Snapshot**

   * Approved registry MUST be stored as a read-only validated snapshot

---

## 3. Registry Data Model

### 3.1 Core Entities

```text id="f2a9kx"
ORGANIZATION
PRODUCT
FEATURE
KPI
MISSION
VISION
```

---

### 3.2 Relationship Model

```text id="z9w1pl"
ORGANIZATION → PRODUCT
PRODUCT → FEATURE
FEATURE → KPI
PRODUCT → MISSION
PRODUCT → VISION
```

---

### 3.3 Structural Constraints

* No orphan nodes allowed
* Each PRODUCT MUST have:

  * ≥ 1 KPI
  * ≥ 1 MISSION or VISION
* Each KPI MUST belong to a FEATURE or PRODUCT

---

## 4. Validation Lifecycle

### 4.1 Pipeline Stages

```text id="p6t8xn"
INGEST → NORMALIZE → STRUCTURAL_CHECK → KPI_VALIDATION → CONSISTENCY_CHECK → REPORT → APPROVAL → SNAPSHOT
```

---

### 4.2 Failure States

```text id="y4n2cd"
MISSING_FIELD
INVALID_HIERARCHY
KPI_UNMAPPED
CONTEXT_AMBIGUITY
INCONSISTENT_RELATION
```

---

### 4.3 State Rules

* Each stage MUST:

  * complete before proceeding
  * emit structured results

* Failures MUST:

  * be classified as BLOCKING or NON-BLOCKING
  * halt approval if blocking

---

## 5. Validation Protocols

### 5.1 Mandatory Field Audit

Checks:

* existence
* minimum length
* non-placeholder content

---

### 5.2 KPI Alignment Validation

Each KPI MUST:

* have measurable definition OR
* map to:

  * data source OR
  * executable workflow

---

### 5.3 Structural Validation

Ensures:

* correct parent-child relationships
* no circular hierarchy
* no orphaned entities

---

### 5.4 Consistency Check

Detects:

* duplicate or conflicting product definitions
* overlapping mission statements
* ambiguous naming collisions

---

## 6. Data Contracts

### 6.1 Input Registry

```ts id="o2m8vc"
{
  organization: Organization,
  products: Product[],
  features: Feature[],
  kpis: KPI[],
  missions: Mission[],
  visions: Vision[]
}
```

---

### 6.2 Validation Output

```ts id="h7k4qp"
{
  status: 'VALID' | 'INVALID',
  score: number,
  issues: ValidationIssue[],
  snapshotId?: string
}
```

---

### 6.3 Validation Issue

```ts id="c9x5lm"
{
  type: 'STRUCTURAL' | 'KPI' | 'CONSISTENCY' | 'FIELD',
  severity: 'BLOCKING' | 'WARNING',
  entityId: string,
  message: string
}
```

---

## 7. Context Integrity Scoring

### 7.1 Score Calculation

* Base: 100
* Deduct:

  * Missing mandatory field: -20
  * Invalid KPI mapping: -25
  * Structural violation: -30
  * Minor inconsistency: -10

---

### 7.2 Score Bands

| Score | State      |
| ----- | ---------- |
| 90+   | Strong     |
| 70–89 | Acceptable |
| <70   | Blocked    |

---

### 7.3 Enforcement

* Onboarding MUST NOT proceed if:

  * any BLOCKING issue exists
  * score below threshold

---

## 8. Approval & Snapshot Protocol

### 8.1 Operator Confirmation

* Required before final validation
* Acts as:

  * human verification layer

---

### 8.2 Snapshot Creation

On approval:

* system MUST:

  * generate immutable snapshot
  * assign `snapshotId`
  * persist to SQLite

---

### 8.3 Snapshot Guarantees

* read-only
* versionable (future)
* used by:

  * Governance Graph
  * Cognitive Memory

---

## 9. Integration Points

### 9.1 With Governance Lifecycle

* Provides:

  * validated registry input
* Ensures:

  * graph construction operates on clean data

---

### 9.2 With Cognitive Memory Engine

* Supplies:

  * structured business context
* Enables:

  * accurate prompt grounding

---

### 9.3 With Onboarding Orchestrator

* Emits:

  * `VALID` / `BLOCKED`
* Acts as:

  * pre-final gating stage

---

### 9.4 With Vaidyar

* Provides:

  * context metadata for diagnostics prioritization

---

## 10. Failure Modes & Handling

| Scenario                   | Behavior         |
| -------------------------- | ---------------- |
| Missing mission/vision     | Block approval   |
| KPI without mapping        | Block approval   |
| Structural inconsistency   | Block validation |
| Duplicate product conflict | Warning or block |
| Ambiguous naming           | Warning          |

---

## 11. Observability

System SHOULD track:

* validation duration
* issue frequency by type
* score distribution across users
* approval rejection rate
* most common blocking fields

---

## 12. Deterministic Guarantees

* Validation produces consistent results
* No mutation of input registry
* Snapshot represents exact validated state
* No dependency on external systems
* No implicit assumptions in validation logic

---

## 13. Cross-Module Contracts (Explicit)

* **Host Application**

  * MUST provide complete registry payload

* **Governance Lifecycle**

  * MUST consume validated snapshot only

* **Onboarding Orchestrator**

  * MUST enforce validation gate

* **Cognitive Engine**

  * SHOULD rely only on validated context

---

## 14. Validation Boundaries

### 14.1 Context Boundary

```
RAW_REGISTRY → VALIDATED_CONTEXT → SNAPSHOT
```

---

### 14.2 Mutation Boundary

* This module MUST NOT:

  * modify business data
  * auto-correct invalid fields

---

### 14.3 Execution Boundary

* Does NOT:

  * execute workflows
  * trigger agents
  * perform runtime checks

---

## 15. Known Architectural Gaps (Expanded Roadmap)

| Area                    | Gap                                               | Impact |
| ----------------------- | ------------------------------------------------- | ------ |
| Dependency Traceability | Cannot trace KPI failure to root missing entity   | High   |
| Semantic Understanding  | No NLP-based validation of mission/KPI meaning    | High   |
| Multi-Language Support  | Limited validation beyond English                 | Medium |
| Conflict Detection      | Weak detection of overlapping product definitions | Medium |
| Versioning              | No snapshot version control                       | Medium |
| Incremental Validation  | Full re-validation required on small changes      | Low    |

---

## 16. Strategic Role in Architecture

This module becomes the **semantic foundation** for:

* Governance Graph (structural validation)
* Cognitive Memory (context grounding)
* Agent Reasoning (decision accuracy)
* Audit Systems (traceable business logic)

---

### Strategic Observation

With this enhancement, your system now has:

* **Semantic Validity (this module)**
* **Structural Validity (Governance Graph)**
* **Runtime Validity (Vaidyar)**

That creates a **three-layer validation architecture**:

```
CONTEXT → STRUCTURE → EXECUTION
```

Which is extremely rare—and very powerful.

---


