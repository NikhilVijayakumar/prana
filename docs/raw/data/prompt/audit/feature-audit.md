# Feature Audit & Validation System — Prompt Engine

## Purpose

You are acting as:

* Product Auditor
* Functional Specification Reviewer
* Product Governance Auditor

Your responsibility is to audit feature documentation located under:

```text
docs/raw/feature/**
```

This audit evaluates feature specifications against themselves.

The audit validates:

* functional completeness
* workflow completeness
* business rule coverage
* state coverage
* edge case coverage
* failure scenario coverage
* cross-feature consistency
* feature ownership
* feature traceability

The audit does NOT validate implementation.

---

# Understanding Prana Features

Prana is an **Electron runtime library & host application shell**. Its features are organized by runtime responsibility, not architecture patterns. Features live under:

```text
docs/raw/features/**
```

Each feature document specifies responsibilities, workflows, states, permissions, validation rules, failure scenarios, and dependencies. Feature documents are authoritative for runtime behavior.

Architecture context for patterns consumed from the Astra library lives in:

```text
docs/raw/external-context/astra.md
```

**Important:** Prana feature documents should describe runtime behavior, not architecture patterns. Flag content that defines architecture invariants or patterns (those belong in Astra's domain). Flag content that references implementation details (file paths, TypeScript syntax) as contamination.

---

# Scope

Audit only:

```text
docs/raw/feature/**
```

---

# Explicit Non-Goals

The Feature Audit MUST NOT:

* inspect source code
* inspect implementation
* validate architecture
* validate technical design
* validate database design
* validate API design
* validate repository design
* validate MVVM design
* validate component structure
* validate framework usage
* validate runtime behavior
* validate test coverage

These responsibilities belong to:

```text
Architecture Audit
Feature Technical Audit
Implementation Audit
```

---

# Feature Ownership Rule

Feature documentation defines:

```text
WHAT the system does
```

Feature documentation does NOT define:

```text
HOW the system is implemented
```

Architecture belongs in:

```text
docs/raw/external-context/astra.md   (Astra architecture reference)
```

Technical realization belongs in:

```text
docs/raw/feature-technical/**
```

Implementation content discovered in feature documentation is considered:

```text
Specification Contamination
```

and must generate findings.

**Exception:** Astra feature docs may name the patterns they define (e.g., "useDataState", "AppState", "INIT → LOADING → COMPLETED") since these are behavioral contracts, not source code.

---

# Feature Discovery Rule

The audit must not assume:

* feature names
* workflows
* concepts
* permissions
* states
* business rules

All conclusions must be derived from:

```text
docs/raw/feature/**
```

Features must be discovered dynamically.

---

# Primary Audit Questions

The audit must answer:

1. Are feature specifications functionally complete?
2. Are workflows fully defined?
3. Are states and transitions defined?
4. Are edge cases documented?
5. Are failure scenarios documented?
6. Are cross-feature interactions defined?
7. Are feature responsibilities clearly separated?
8. Do feature specifications remain free from implementation concerns?

---

# Audit Phase 1 — Feature Discovery

## Goal

Create authoritative inventory of all features.

---

## Discover

From:

```text
docs/raw/feature/**
```

Extract:

* Feature Name
* Purpose
* Responsibilities
* Dependencies
* Related Features

---

## Output

### Feature Inventory

| Feature | Purpose | Dependencies | Confidence |
| ------- | ------- | ------------ | ---------- |

---

# Audit Phase 2 — Functional Completeness

## Goal

Determine whether features fully define behavior.

---

## Validate

For each feature:

### Purpose

Is the feature purpose clearly defined?

### Responsibilities

Are responsibilities clearly defined?

### Non-Responsibilities

Are boundaries clearly defined?

### Business Rules

Are business rules documented?

### Outcomes

Are expected outcomes defined?

### Constraints

Are functional constraints documented?

---

## Output

### Functional Completeness Findings

```text
Feature
Issue
Severity
Impact
```

---

# Audit Phase 3 — Workflow Coverage

## Goal

Validate workflow completeness.

---

## Validate

For each workflow:

### Trigger

What starts the workflow?

### Preconditions

What must be true?

### Steps

Are steps defined?

### Outcomes

Are outcomes defined?

### Exceptions

Are exceptions defined?

### Completion Criteria

How does workflow complete?

---

## Output

### Workflow Findings

```text
Feature
Issue
Severity
Impact
```

---

# Audit Phase 4 — State & Transition Coverage

## Goal

Validate state definitions.

---

## Validate

For every state:

| Validation          |
| ------------------- |
| State Exists        |
| Entry Condition     |
| Exit Condition      |
| Allowed Transitions |
| Invalid Transitions |
| Recovery Path       |

---

## Output

### State Findings

```text
Feature
Issue
Severity
Impact
```

---

# Audit Phase 5 — Edge Case Coverage

## Goal

Validate unusual scenarios.

---

## Validate

### Empty States

### Invalid Inputs

### Missing Dependencies

### Duplicate Actions

### Conflicting Actions

### Boundary Conditions

### Unexpected Sequences

---

## Output

### Edge Case Findings

```text
Feature
Issue
Severity
Impact
```

---

# Audit Phase 6 — Failure Scenario Coverage

## Goal

Validate failure handling.

---

## Validate

### Consumer Errors

### Missing Data

### Dependency Failures

### Recovery Paths

---

## Output

### Failure Findings

```text
Feature
Issue
Severity
Impact
```

---

# Audit Phase 7 — Cross-Feature Interaction Audit

## Goal

Validate feature interactions.

---

## Detect

### Dependency Conflicts

### Ownership Conflicts

### Workflow Conflicts

### Shared Concept Conflicts

### Lifecycle Conflicts

---

## Output

### Interaction Findings

```text
Affected Features
Issue
Severity
Recommendation
```

---

# Audit Phase 8 — Functional Ownership Audit

## Goal

Ensure responsibilities have clear ownership.

---

## Detect

### Duplicate Ownership

Multiple features owning same capability.

### Missing Ownership

Capability has no owner.

### Ambiguous Ownership

Ownership unclear.

---

## Output

### Ownership Findings

```text
Capability
Issue
Severity
Impact
```

---

# Audit Phase 9 — Feature Traceability Audit

## Goal

Ensure concepts are traceable.

---

## Validate

Every concept must have:

* defining feature
* clear ownership
* references from dependent features

---

## Output

### Traceability Findings

```text
Concept
Issue
Severity
Impact
```

---

# Audit Phase 10 — Functional Purity Audit

## Goal

Detect implementation leakage.

---

## Forbidden Content

### Framework Leakage

Examples:

```text
React hooks syntax
TypeScript generics
Angular
Vue
Electron API calls
```

---

### Source Structure Leakage

Examples:

```text
src/
components/
repositories/
services/
import statements
export statements
file paths
```

---

### Technical Interface Leakage

Examples:

```text
Class definitions
Interface declarations
Generic type parameters
SQL queries
HTTP methods
```

---

## Allowed Content (Astra-specific)

Astra feature docs legitimately name:

```text
useDataState         ← behavioral contract name
AppState             ← state contract name
INIT, LOADING, COMPLETED, ERROR  ← state lifecycle names
AppStateHandler      ← component name (it IS the feature)
ApiService           ← repository abstraction name
ServerResponse       ← response contract name
HttpStatusCode       ← enum name (behavioral, not implementation)
```

These describe WHAT the feature provides, not HOW it is implemented.

---

## Output

### Functional Purity Findings

Finding ID:

```text
FEATURE-PURITY-{nnn}
```

---

# Required Matrices

## Functional Purity Matrix

| Feature | Functional Content | Leakage | Status |
| ------- | ------------------ | ------- | ------ |

---

## Workflow Coverage Matrix

| Feature | Workflows | Coverage |
| ------- | --------- | -------- |

---

## State Coverage Matrix

| Feature | States | Coverage |
| ------- | ------ | -------- |

---

## Cross-Feature Interaction Matrix

| Feature A | Feature B | Interaction | Status |
| --------- | --------- | ----------- | ------ |

---

## Functional Ownership Matrix

| Capability | Owning Feature |
| ---------- | -------------- |

---

## Traceability Matrix

| Concept | Owning Feature |
| ------- | -------------- |

---

# Finding Categories

Use:

```text
FEATURE-COVERAGE-{nnn}
FEATURE-WORKFLOW-{nnn}
FEATURE-STATE-{nnn}
FEATURE-FAILURE-{nnn}
FEATURE-INTERACTION-{nnn}
FEATURE-OWNERSHIP-{nnn}
FEATURE-TRACE-{nnn}
FEATURE-PURITY-{nnn}
```

---

# Severity Model

| Severity   | Meaning                                   |
| ---------- | ----------------------------------------- |
| Critical   | Functional behavior undefined             |
| Major      | Significant ambiguity or missing behavior |
| Minor      | Documentation weakness                    |
| Suggestion | Improvement opportunity                   |

---

# Scoring Model

| Dimension                 | Weight |
| ------------------------- | ------ |
| Functional Completeness   | 25%    |
| Workflow Coverage         | 25%    |
| Edge & Failure Coverage   | 20%    |
| Cross-Feature Consistency | 15%    |
| Feature Traceability      | 10%    |
| Functional Purity         | 5%     |

---

# Functional Purity Scoring

| Condition                   | Score |
| --------------------------- | ----- |
| No leakage                  | 10    |
| Minor leakage               | 8     |
| Moderate leakage            | 6     |
| Significant leakage         | 4     |
| Predominantly technical     | 2     |
| Not a feature specification | 0     |

---

# Final Assessment

| Score Range | Assessment              |
| ----------- | ----------------------- |
| 9.0–10.0    | Excellent               |
| 7.0–8.9     | Good                    |
| 5.0–6.9     | Needs Improvement       |
| 3.0–4.9     | Major Revision Required |
| 0.0–2.9     | Not Feature Ready       |

---

# Required Report Structure

## 1. Executive Summary

```text
# Feature Audit Report — {timestamp}

Overall Assessment:
Final Score:
Critical Findings:
Major Findings:
Minor Findings:
Documents Audited:
```

## 2. Feature Inventory

## 3. Functional Completeness Report

## 4. Workflow Coverage Report

## 5. State Coverage Report

## 6. Edge Case Report

## 7. Failure Scenario Report

## 8. Cross-Feature Interaction Report

## 9. Functional Ownership Report

## 10. Feature Traceability Report

## 11. Functional Purity Report

## 12. Required Matrices

## 13. Scoring Breakdown

## 14. Score Improvement Summary

Compare against the previous report from `docs/raw/report/feature/archive/` (highest timestamp). If no previous report exists, state "Baseline — no prior report to compare."

```text
Previous Report: {filename}
Previous Score: X/10
Current Score: Y/10
Change: +N / -N / No change
```

## 15. Final Verdict

```text
{Assessment} ({Score}/10)
```

## 16. Audit Traceability

| Reference       | Location                                                    |
| --------------- | ----------------------------------------------------------- |
| Feature Docs    | docs/raw/feature/**                                         |
| Audit Report    | docs/raw/report/feature/latest/feature-audit-{timestamp}.md |
| Previous Report | docs/raw/report/feature/archive/{previous-filename}         |

---

# Report Rotation

Before writing the new report, rotate the previous report:

```text
mv docs/raw/report/feature/latest/* docs/raw/report/feature/archive/
mkdir -p docs/raw/report/feature/latest
```

---

# Output Location

```text
docs/raw/report/feature/latest/feature-audit-{timestamp}.md
```
