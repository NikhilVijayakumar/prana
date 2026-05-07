This is strong, system-level documentation—already very close to production-grade. I’ll **enhance the last module** (“Hybrid Explorer Governance Lifecycle”) in the same format and depth as your upgraded Viewer module: tightening **contracts, graph determinism, lifecycle guarantees, and cross-module enforcement**.

---

# 🧭 Feature: Onboarding — Hybrid Explorer Governance Lifecycle (Enhanced)

**Version:** 1.2.0
**Status:** Research / In-Development
**Pattern:** Deterministic Graph Validation · Static Governance Gate
**Service:** `businessAlignmentService.ts`
**Storage Domain:** `governance_graph` (SQLite)
**Capability:** Constructs and validates a deterministic governance graph to ensure that all declared business objectives are executable through available system capabilities.

---

## 1. Tactical Purpose

The **Hybrid Explorer Governance Lifecycle** is the **structural validation authority** of the Prana runtime.

It ensures that:

* Every **Business Intent (KPI)** is executable
* Every execution path is **fully connected**
* No **silent failure paths** exist due to missing skills, protocols, or inputs

It operates as:

* A **graph construction engine** (multi-domain dependency modeling)
* A **static validation gate** (pre-runtime enforcement)
* A **consistency verifier** (cross-module alignment)
* A **governance scoring system** (readiness quantification)

---

## 2. System Invariants (Critical)

1. **Execution Completeness**

   * Every KPI MUST resolve to at least one valid execution path

2. **Dependency Closure**

   * All nodes MUST have required upstream and downstream dependencies satisfied

3. **Deterministic Graph Construction**

   * Same input registry MUST produce identical graph structure

4. **No Silent Failures**

   * Missing dependencies MUST always be surfaced as blocking gaps

5. **Immutable Validation Phase**

   * Graph validation MUST NOT mutate registry data

---

## 3. Governance Graph Model

### 3.1 Node Types

```text
KPI
PROTOCOL
SKILL
DATA_INPUT
CHANNEL
```

---

### 3.2 Edge Types

```text
KPI → PROTOCOL
PROTOCOL → SKILL
SKILL → DATA_INPUT
DATA_INPUT → CHANNEL
```

---

### 3.3 Graph Properties

* Directed
* Acyclic (DAG enforced)
* Multi-root (multiple KPIs allowed)
* Deterministic ordering required

---

## 4. Graph Lifecycle

### 4.1 Construction Phase

```text
COLLECT → NORMALIZE → LINK → VALIDATE_STRUCTURE
```

Steps:

* Aggregate inputs from:

  * Model Configuration
  * Channel Configuration
  * Business Registry
* Normalize identifiers
* Build adjacency mappings

---

### 4.2 Validation Phase

```text
PATH_RESOLUTION → GAP_DETECTION → SCORE_CALCULATION → REPORT_GENERATION
```

---

### 4.3 Failure States

```text
MISSING_SKILL
MISSING_PROTOCOL
UNREACHABLE_DATA
CHANNEL_DISCONNECTED
CIRCULAR_DEPENDENCY
```

---

## 5. Pathfinding Protocol

### 5.1 Execution Path Definition

A valid path MUST follow:

```text
KPI → PROTOCOL → SKILL → DATA_INPUT → CHANNEL
```

---

### 5.2 Path Validation Rules

* Each node MUST exist
* Each edge MUST be resolvable
* Terminal node (CHANNEL) MUST be reachable
* No partial paths allowed

---

### 5.3 Gap Classification

| Gap Type          | Description                        |
| ----------------- | ---------------------------------- |
| Structural Gap    | Missing node in dependency chain   |
| Connectivity Gap  | Node exists but not reachable      |
| Configuration Gap | Node exists but not validated      |
| Semantic Gap      | Node mismatch (future enhancement) |

---

## 6. Data Contracts

### 6.1 Input Registry

```ts
{
  kpis: KPI[],
  protocols: Protocol[],
  skills: Skill[],
  dataInputs: DataInput[],
  channels: Channel[]
}
```

---

### 6.2 Graph Output

```ts
{
  nodes: GraphNode[],
  edges: GraphEdge[],
  paths: ExecutionPath[],
  gaps: GapReport[],
  score: number
}
```

---

### 6.3 Gap Report

```ts
{
  type: 'STRUCTURAL' | 'CONNECTIVITY' | 'CONFIG',
  nodeId: string,
  description: string,
  blocking: boolean
}
```

---

## 7. Integrity Scoring Model

### 7.1 Score Calculation

* Base: 100
* Deduct:

  * Missing path: -30
  * Partial path: -20
  * Invalid node: -10

---

### 7.2 Score Bands

| Score | State         |
| ----- | ------------- |
| 90+   | Fully Aligned |
| 70–89 | Minor Gaps    |
| <70   | Blocked       |

---

### 7.3 Enforcement

* Onboarding MUST NOT complete if:

  * any blocking gap exists
  * score < threshold (configurable)

---

## 8. Integration Points

### 8.1 With Onboarding Orchestrator

* Acts as:

  * Final validation gate before completion
* Emits:

  * `VALID` or `BLOCKED`

---

### 8.2 With Channel Configuration

* Verifies:

  * channel reachability
* Ensures:

  * data inputs are physically resolvable

---

### 8.3 With Model Configuration

* Validates:

  * required model capabilities for protocols

---

### 8.4 With Vaidyar

* Provides:

  * priority map of critical dependencies
* Enables:

  * targeted health checks

---

## 9. Failure Modes & Handling

| Scenario                     | Behavior                 |
| ---------------------------- | ------------------------ |
| Missing skill                | Block onboarding         |
| Protocol mismatch            | Block onboarding         |
| Data input unreachable       | Block onboarding         |
| Channel invalid              | Block onboarding         |
| Circular dependency detected | Abort graph construction |

---

## 10. Observability

System SHOULD track:

* number of KPIs validated
* path resolution success rate
* gap frequency by type
* alignment score trends
* validation execution time

---

## 11. Deterministic Guarantees

* Graph structure is reproducible
* Validation is side-effect free
* Same input → same score → same gaps
* No runtime dependency during validation
* No implicit assumptions in path resolution

---

## 12. Cross-Module Contracts (Explicit)

* **Registry Runtime Store**

  * MUST provide normalized identifiers

* **Channel Setup**

  * MUST provide validated connectivity state

* **Model Configuration**

  * MUST expose capability metadata

* **Onboarding Orchestrator**

  * MUST enforce blocking conditions

---

## 13. Governance Boundaries

### 13.1 Validation Boundary

```
INPUT_REGISTRY → GOVERNANCE_GRAPH → VALIDATION_RESULT
```

---

### 13.2 Execution Boundary

* This module DOES NOT:

  * execute workflows
  * trigger agents
  * mutate system state

---

### 13.3 Mutation Boundary

* All outputs are:

  * read-only
  * advisory (except blocking signal)

---

## 14. Known Architectural Gaps (Expanded Roadmap)

| Area                         | Gap                                               | Impact |
| ---------------------------- | ------------------------------------------------- | ------ |
| Graph Visualization          | No interactive DAG viewer                         | High   |
| Semantic Matching            | No NLP-based skill/protocol resolution            | High   |
| Circular Dependency Handling | Detection not fully enforced                      | Medium |
| Dynamic Registry Updates     | No incremental graph recomputation                | Medium |
| Weighted Dependencies        | All paths treated equally (no priority weighting) | Low    |
| Versioned Governance         | No snapshot/version control for registry states   | Medium |

---

## 15. Strategic Role in System Architecture

This module becomes the **structural truth layer** connecting:

* Onboarding → Validation gate
* Vaidyar → Targeted diagnostics
* Channel Integration → Reachability guarantee
* Model Layer → Capability alignment

---

### Strategic Observation

With this enhancement, your system now has:

* **Execution Validity (this module)**
* **Runtime Integrity (Vaidyar)**
* **Data Consistency (Sync Protocol)**

That combination forms a **closed governance loop**—which is rare and very powerful.

---


