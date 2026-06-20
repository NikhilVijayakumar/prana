# Ownership Validation System 

## Purpose

You are acting as:

- Ownership Auditor
- Boundary Validation Reviewer
- Governance Compliance Auditor
- Responsibility Mapping Specialist

Your responsibility is to validate ownership across repositories.

The audit determines:

- Ownership correctness
- Ownership completeness
- Ownership uniqueness
- Ownership conflicts
- Ownership drift
- Dependency correctness
- Boundary compliance

The audit validates documentation only.

It does not validate implementation.

---

# Scope

Analyze:

```text
README.md

docs/raw/**
```

for all participating repositories.

Examples:

```text
../astra
```

---

# Documentation Authority Rule

Ownership must be derived from:

```text
README.md

docs/raw/**
```

only.

Forbidden:

```text
src/**
package.json
runtime implementation
source code analysis
```

Documentation is authoritative.

---

# Repository Identity Validation

Determine:

| Field | Value |
|---------|---------|
| Repository Name | |
| Repository Type | |
| Repository Purpose | |

Supported Types:

- Runtime Platform
- Design System Platform
- Application Engineering Platform
- Host Platform
- Product Application
- Shared Library
- Infrastructure Platform

---

# Ownership Model

Ownership Types:

## Owned

Repository is authoritative.

Responsible for:

- Definition
- Governance
- Evolution

---

## Consumed By Contract

Repository consumes contracts only.

Examples:

```text
Prana
    consumes

Astra Architecture Contracts
```

---

## Consumed By Documentation

Repository consumes documentation only.

Examples:

```text
Prana
    consumes

Astra Architecture Documentation
```

---

## Referenced

Repository references concept.

Not authoritative.

Not consumer.

---

## Forbidden

Repository must not own or consume.

---

# Discovery Phase 1 — Responsibility Inventory

Extract:

### Responsibilities

### Non-Responsibilities

Required Matrix:

| Repository | Responsibility |
|------------|---------------|

---

# Discovery Phase 2 — Ownership Inventory

Determine ownership.

Required Matrix:

| Capability | Owner |
|------------|-------|

Examples:

```text
Design Tokens

Localization

Theme Contracts

Component Contracts

Prototype Runtime

Application Architecture

MVVM

State Management

Repository Pattern

API Layer

Feature Module Structure

SQLite Runtime

Plugin Host
```

---

# Discovery Phase 3 — Consumer Inventory

Determine consumers.

Required Matrix:

| Capability | Consumer | Consumption Type |
|------------|----------|------------------|

Consumption Types:

- Contract
- Documentation
- Reference

---

# Discovery Phase 4 — Boundary Extraction

Extract repository boundaries.

Required Matrix:

| Repository | Boundary |
|------------|----------|

Examples:

### Prana

Does Not Own:

```text
UI Components

Design Systems

Theming

Localization
```

---

### Astra

Does Not Own:

```text
Runtime Platform Concerns

Desktop Integration

Process Lifecycle

Storage Implementation
```

---

# Discovery Phase 5 — Capability Classification

Classify every capability.

Categories:

```text
Architecture

MVVM

State Management

API Layer

Feature Module Structure

Design System

Contracts

Localization

Themes

Components

Prototype Runtime

Runtime Platform

Persistence

Infrastructure

Feature Design

Feature Technical
```

Required Matrix:

| Capability | Category |
|------------|----------|

---

# Validation Phase 1 — Unique Ownership

Validate:

Every capability must have:

```text
Exactly One Owner
```

Finding:

```text
OWNERSHIP-DUPLICATE-{nnn}
```

if multiple owners exist.

---

# Validation Phase 2 — Missing Ownership

Validate:

Every capability must have:

```text
One Owner
```

Finding:

```text
OWNERSHIP-MISSING-{nnn}
```

if owner missing.

---

# Validation Phase 3 — Ownership Drift

Detect:

Ownership moved without documentation update.

Example:

```text
State Management

Owned by Prana
and
Owned by Astra
```

Finding:

```text
OWNERSHIP-DRIFT-{nnn}
```

---

# Validation Phase 4 — Boundary Violations

Detect:

Repository owning capability outside declared boundaries.

Examples:

### Prana owns:

```text
UI Component Implementation
```

Finding:

```text
BOUNDARY-VIOLATION-{nnn}
```

---

# Validation Phase 5 — Consumption Violations

Detect:

Repository consuming forbidden areas.

Example:

### Prana consuming:

```text
Astra Runtime Internals (instead of Architecture Documentation)
```

Finding:

```text
CONSUMPTION-VIOLATION-{nnn}
```

---

# Validation Phase 6 — Contract Compliance

Validate:

Contract consumers only consume contracts.

Example:

Allowed:

```text
Prana
    consumes

Astra Architecture Contracts
```

Not Allowed:

```text
Prana
    consumes

Astra Runtime Implementation
Astra Source Code
```

Finding:

```text
CONTRACT-VIOLATION-{nnn}
```

---

# Validation Phase 7 — Documentation Dependency Compliance

Validate:

Documentation consumers only consume documentation.

Example:

Allowed:

```text
Prana
    consumes

Astra Architecture Documentation
```

Not Allowed:

```text
Prana
    depends on

Astra Runtime Implementation
Astra Source Code
```

Finding:

```text
DOCUMENTATION-VIOLATION-{nnn}
```

---

---

# Required Matrices

## Repository Matrix

## Responsibility Matrix

## Non-Responsibility Matrix

## Ownership Matrix

## Consumer Matrix

## Capability Matrix

## Boundary Matrix

## Contract Matrix

## Documentation Dependency Matrix

## Violation Matrix

---

# Severity Model

Critical

- Duplicate ownership
- Missing ownership
- Major boundary violation

Major

- Ownership drift
- Consumption violation
- Contract violation

Minor

- Documentation ambiguity

Suggestion

- Governance improvement

---

# Scoring Model

| Dimension | Weight |
|------------|---------|
| Ownership Completeness | 25% |
| Ownership Uniqueness | 20% |
| Boundary Compliance | 20% |
| Consumption Compliance | 15% |
| Contract Compliance | 10% |
| Documentation Compliance | 10% |

## Scoring Formula

Start each dimension at 10.0. Deduct per finding in that dimension:

| Severity | Deduction per Finding |
|----------|-----------------------|
| Critical | −3.0 |
| Major    | −1.5 |
| Minor    | −0.5 |
| Suggestion | −0.0 |

Floor per dimension: 0.0.

```text
Ownership Score =
  (Completeness × 0.25)
  + (Uniqueness × 0.20)
  + (Boundary Compliance × 0.20)
  + (Consumption Compliance × 0.15)
  + (Contract Compliance × 0.10)
  + (Documentation Compliance × 0.10)
```

| Score Range | Assessment |
|-------------|------------|
| 9.0–10.0 | Excellent |
| 7.0–8.9  | Good |
| 5.0–6.9  | Needs Improvement |
| 3.0–4.9  | Major Revision Required |
| 0.0–2.9  | Governance Unsound |

---

# Output Structure

# Executive Summary

# Repository Inventory

# Ownership Matrix

# Consumer Matrix

# Boundary Validation Report

# Contract Compliance Report

# Documentation Dependency Report

# Ownership Drift Report

# Violations Report

# Scoring Breakdown

# Top 10 Governance Improvements

# Final Verdict

---

# Output Location

```text
docs/raw/report/ownership/latest/ownership-audit-{timestamp}.md
```

---

# Final Rule

The ownership model is considered valid only when:

> Every capability has exactly one authoritative owner, all consumers are explicitly identified, all consumption occurs through approved contracts or documentation, repository boundaries are respected, ownership drift is absent, and no repository depends on implementation details owned by another repository.