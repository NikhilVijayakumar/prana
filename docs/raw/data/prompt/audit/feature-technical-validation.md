# Feature Technical Audit & Validation System v2.1

## Purpose

You are acting as:

- Technical Realization Auditor
- Architecture Compliance Reviewer
- Feature Realization Auditor
- Technical Governance Reviewer

---

## Understanding Prana

Prana is an **Electron runtime library & host application shell**.

Architecture reference (`docs/raw/external-context/astra.md`) provides the patterns consumed from Astra:

* Patterns: MVVM, state management (`AppState`, `useDataState`), repository (`ApiService`, `ServerResponse`), platform abstraction
* Invariants: MVVM separation, repository isolation, dependency direction, platform neutrality
* Boilerplate: barrel exports, feature module structure, ViewModel pattern, IPC repository pattern

Prana does NOT own architecture patterns — it consumes them from Astra. Prana owns runtime orchestration, storage, security, context management, and integration capabilities.

Feature-technical documents must be **single flat files**, one per feature:

```text
docs/raw/feature-technical/{feature}.md
```

Flag folder-based structures as structural violations of the one-to-one rule.

---

Your responsibility is to audit:

docs/raw/feature-technical/**

against:

docs/raw/external-context/astra.md   (Astra architecture reference)
docs/raw/features/**                  (Prana features only)

The audit validates that Feature Technical documentation correctly realizes:

- Prana's Feature Requirements
- Architecture patterns from Astra (via external context)

into a complete Technical Realization artifact.

The audit evaluates documentation only.

It does not validate:

- Feature Design
- Mockups
- Source Code
- Implementation

---

# Scope

Primary:

docs/raw/feature-technical/**

Reference:

docs/raw/external-context/astra.md   (Astra architecture reference)
docs/raw/features/**                  (Prana features)

---

# Explicit Non-Goals

The audit MUST NOT:

- inspect source code
- inspect feature design
- inspect mockups
- inspect implementation
- inspect databases
- inspect APIs
- inspect framework-specific code

These belong to downstream audits.

---

# Authority Hierarchy

| Level | Authority |
|---------|----------|
| 1 | Architecture (`docs/raw/external-context/astra.md`) |
| 2 | Feature |
| 3 | Feature Technical |

Rules:

- Feature Technical cannot redefine Architecture.
- Feature Technical cannot redefine Feature behavior.
- Feature Technical must realize Architecture.
- Feature Technical must realize Feature requirements.

If conflicts exist:

Generate findings.

Never silently resolve.

---

# Core Principle

Architecture defines:

How the system is structured.

Feature defines:

What the system must do.

Feature Technical defines:

How the feature is technically realized using the approved architecture.

---

# Audit Phase 1 — Inventory

## Goal

Create authoritative inventory.

---

## Discover

Architecture documents

Feature documents

Feature Technical documents

---

## Output

### Technical Document Inventory

| Feature | Technical Document Exists | Status |
|----------|----------|----------|

Status:

- Complete
- Partial
- Missing

---

# Audit Phase 2 — Feature Coverage Validation

## Goal

Validate realization of Feature requirements.

---

## Required Areas

### Responsibilities

### Non-Responsibilities

### Workflows

### States

### Permissions

### Validation Rules

### Failure Scenarios

### Dependencies

---

## Output

### Feature Coverage Matrix

| Feature Requirement | Realized |
|--------------------|----------|

---

## Findings

TECH-COVERAGE-{nnn}

---

# Audit Phase 3 — Architecture Compliance Validation

## Goal

Validate realization of Architecture.

---

## Validate

### Architectural Patterns

### Ownership Rules

### Dependency Rules

### State Management Rules

### Repository Rules

### Validation Rules

### Error Handling Rules

### Integration Rules

### Architectural Invariants

---

## Output

### Architecture Compliance Matrix

| Architecture Rule | Realized |
|------------------|----------|

---

## Findings

TECH-ARCH-{nnn}

---

# Audit Phase 4 — Responsibility Realization Validation

## Goal

Validate realization of responsibilities.

---

## Validate

### Ownership Exists

### Ownership Is Unique

### Ownership Is Consistent

### Responsibility Boundaries Are Clear

---

## Output

### Responsibility Matrix

| Responsibility | Owner |
|---------------|-------|

---

## Findings

TECH-RESPONSIBILITY-{nnn}

---

# Audit Phase 5 — Workflow Realization Validation

## Goal

Validate workflow realization.

---

## Validate

### Trigger

### Processing

### Validation

### State Changes

### Outputs

### Failure Handling

### Recovery Paths

---

## Output

### Workflow Realization Matrix

| Workflow | Realized |
|----------|----------|

---

## Findings

TECH-WORKFLOW-{nnn}

---

# Audit Phase 6 — State Realization Validation

## Goal

Validate state realization.

---

## Validate

### Entry Conditions

### Exit Conditions

### Valid Transitions

### Invalid Transitions

### Recovery Paths

### Terminal States

---

## Output

### State Realization Matrix

| State | Realized |
|--------|----------|

---

## Findings

TECH-STATE-{nnn}

---

# Audit Phase 7 — Permission Realization Validation

## Goal

Validate permission realization.

---

## Validate

### Access Control

### Enforcement

### Failure Handling

### Exception Handling

---

## Output

### Permission Matrix

| Permission | Realized |
|------------|----------|

---

## Findings

TECH-PERMISSION-{nnn}

---

# Audit Phase 8 — Validation Realization Validation

## Goal

Validate validation rules.

---

## Validate

### Validation Triggers

### Validation Ownership

### Validation Outcomes

### Recovery Behavior

---

## Output

### Validation Matrix

| Rule | Realized |
|-------|----------|

---

## Findings

TECH-VALIDATION-{nnn}

---

# Audit Phase 9 — Error Realization Validation

## Goal

Validate failure handling.

---

## Validate

### Detection

### Handling

### Recovery

### Escalation

### Auditability

---

## Output

### Error Matrix

| Error Scenario | Realized |
|---------------|----------|

---

## Findings

TECH-ERROR-{nnn}

---

# Audit Phase 10 — Integration Realization Validation

## Goal

Validate integration realization.

---

## Validate

### Internal Integrations

### External Integrations

### Dependency Flows

### Data Flows

### Ownership

---

## Output

### Integration Matrix

| Integration | Realized |
|------------|----------|

---

## Findings

TECH-INTEGRATION-{nnn}

---

# Audit Phase 11 — Ownership Validation

## Goal

Validate ownership mappings.

---

## Validate

### Missing Ownership

### Duplicate Ownership

### Ambiguous Ownership

### Conflicting Ownership

---

## Output

### Ownership Matrix

| Responsibility | Owner |
|---------------|-------|

---

## Findings

TECH-OWNERSHIP-{nnn}

---

# Audit Phase 12 — Traceability Validation

## Goal

Ensure nothing is lost.

---

## Architecture Traceability

Validate:

Every architecture rule is realized.

Required Matrix:

| Architecture Rule | Realized |
|------------------|----------|

---

## Feature Traceability

Validate:

Every feature requirement is realized.

Required Matrix:

| Feature Requirement | Realized |
|--------------------|----------|

---

## Findings

TECH-TRACEABILITY-{nnn}

---

# Audit Phase 13 — Internal Consistency Validation

## Goal

Detect contradictions.

---

## Validate

### Responsibility Consistency

### Workflow Consistency

### State Consistency

### Permission Consistency

### Validation Consistency

### Integration Consistency

### Ownership Consistency

---

## Findings

TECH-CONSISTENCY-{nnn}

---

# Audit Phase 14 — Technical Purity Validation

## Goal

Detect contamination.

---

## Architecture Redefinition

Examples:

- New architectural patterns
- New dependency rules
- New ownership models

Not defined by Architecture.

Finding:

TECH-ARCH-{nnn}

---

## UX Leakage

Examples:

- Screens
- Dialogs
- Drawers
- Navigation
- User Journeys
- Responsive Layouts

Belongs to:

docs/raw/feature-design/**

Finding:

TECH-PURITY-{nnn}

---

## Mockup Leakage

Examples:

- Layouts
- Wireframes
- Visual Composition
- Visual Styling

Belongs to:

docs/raw/mockup/**

Finding:

TECH-PURITY-{nnn}

---

## Implementation Leakage

Examples:

- React
- Angular
- Flutter
- Vue
- TypeScript
- SQL
- File Paths
- Import Statements
- Export Statements

Belongs to:

src/**

Finding:

TECH-PURITY-{nnn}

---

# Required Matrices

## Feature Coverage Matrix

## Architecture Compliance Matrix

## Responsibility Matrix

## Workflow Realization Matrix

## State Realization Matrix

## Permission Matrix

## Validation Matrix

## Error Matrix

## Integration Matrix

## Ownership Matrix

## Architecture Traceability Matrix

## Feature Traceability Matrix

## Consistency Matrix

## Purity Matrix

---

# Severity Model

Critical

- Technical realization impossible
- Core architecture violation
- Core feature behavior missing

Major

- Significant workflow/state/validation/integration gap

Minor

- Documentation weakness
- Missing clarification

Suggestion

- Improvement opportunity

---

# Scoring Model

| Dimension | Weight |
|------------|---------|
| Feature Coverage | 20% |
| Architecture Compliance | 20% |
| Workflow Realization | 10% |
| State Realization | 10% |
| Permission Realization | 5% |
| Validation Realization | 10% |
| Error Realization | 5% |
| Integration Realization | 5% |
| Ownership Quality | 5% |
| Traceability | 5% |
| Technical Purity | 5% |

---

# Final Assessment

| Score | Assessment |
|---------|------------|
| 9.0 – 10.0 | Excellent |
| 7.0 – 8.9 | Good |
| 5.0 – 6.9 | Needs Improvement |
| 3.0 – 4.9 | Major Revision Required |
| 0.0 – 2.9 | Technical Realization Unsound |

---

# Output Structure

## Executive Summary

## Documents Audited

## Feature Coverage Report

## Architecture Compliance Report

## Responsibility Report

## Workflow Report

## State Report

## Permission Report

## Validation Report

## Error Report

## Integration Report

## Ownership Report

## Traceability Report

## Consistency Report

## Purity Report

## Scoring Breakdown

## Score Improvement Summary

## Top 10 Improvements

## Final Verdict

## Audit Traceability

---

# Score Improvement Summary

Compare against the previous report from `docs/raw/report/feature-technical/archive/` (highest timestamp). If no previous report exists, state "Baseline — no prior report to compare."

```text
Previous Report: {filename}
Previous Score: X/10
Current Score: Y/10
Change: +N / -N / No change
```

| Dimension                | Previous | Current | Change |
|--------------------------|----------|---------|--------|
| Feature Coverage         | X        | Y       | +N     |
| Architecture Compliance  | X        | Y       | +N     |
| Workflow Realization     | X        | Y       | +N     |
| State Realization        | X        | Y       | +N     |
| Permission Realization   | X        | Y       | +N     |
| Validation Realization   | X        | Y       | +N     |
| Error Realization        | X        | Y       | +N     |
| Integration Realization  | X        | Y       | +N     |
| Ownership Quality        | X        | Y       | +N     |
| Traceability             | X        | Y       | +N     |
| Technical Purity         | X        | Y       | +N     |

If score improved, highlight the categories that drove the improvement and what fixes were applied since the prior audit. If score declined, flag regressions with specific category breakdowns.

---

# Report Rotation

Before writing the new report, rotate the previous report:

```text
mv docs/raw/report/feature-technical/latest/* docs/raw/report/feature-technical/archive/
mkdir -p docs/raw/report/feature-technical/latest
```

---

# Output Location

```text
docs/raw/report/feature-technical/latest/feature-technical-audit-{timestamp}.md
```

---

# Audit Traceability

| Reference                | Location                                                                                |
|--------------------------|-----------------------------------------------------------------------------------------|
| Feature Technical Docs   | docs/raw/feature-technical/**                                                           |
| Architecture Context     | docs/raw/external-context/astra.md                                                      |
| Feature Docs             | docs/raw/features/**                                                                    |
| Audit Report             | docs/raw/report/feature-technical/latest/feature-technical-audit-{timestamp}.md         |
| Previous Report          | docs/raw/report/feature-technical/archive/{previous-filename}                           |

---

# Final Rule

A Feature Technical document is considered successful only when:

> Every Prana feature requirement is realized, all responsibilities, workflows, states, permissions, validations, integrations, ownership mappings, and failure scenarios are defined, nothing is lost through traceability, and the document contains no UX design, visual design, mockup, implementation, or source-code concerns.