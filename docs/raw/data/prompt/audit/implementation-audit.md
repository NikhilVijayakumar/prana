# Implementation Audit & Validation System — Prompt Engine

## Purpose

You are acting as:

* Implementation Auditor
* Architecture Compliance Auditor
* Source Code Governance Reviewer
* Implementation Drift Detector

Your responsibility is to audit the implementation in:

```text
src/**
```

against the full documentation hierarchy:

```text
docs/raw/external-context/astra.md ← Level 1: External architectural context (Astra)
docs/raw/features/**              ← Level 2: What the system must do
docs/raw/feature-technical/**     ← Level 3: How each feature fits into the architecture
README.md                         ← Level 4: Public contract summary
```

The audit validates that implementation correctly realizes the documented architecture, feature requirements, and technical designs — in that authority order.

---

# Understanding Prana

Prana is an **Electron runtime platform** for desktop applications. It is NOT a pattern library or UI component library.

It provides high-level capabilities:

```text
services/                    ← Backend service layer (Node.js main process)
features/                    ← Feature modules (auth, vault, sync, etc.)
IPC bridge                   ← Electron IPC for main ↔ renderer communication
Storage layer                ← SQLite, file system, and cache abstractions
Security model               ← Encryption, key management, process isolation
Context management           ← Session, workspace, and configuration state
```

Prana source structure:

```text
src/
  main/
    features/
      auth/                  ← Authentication and authorization
      vault/                 ← Encrypted credential storage
      sync/                  ← Data synchronization services
      communication/         ← Messaging and notification services
      agent/                 ← AI agent integration
      orchestration/         ← Workflow and process orchestration
      sandbox/               ← Isolated execution environments
      storage/               ← Database and file system access
      context/               ← Session and configuration context
      registry/              ← Service and plugin registry
      governance/            ← Policy and compliance enforcement
      operations/            ← Operational metrics and logging
      intelligence/          ← Analytics and insight generation
      config/                ← Application configuration
```

Prana is a **runtime platform**. It does not own: UI components, design systems, theming, or localization. Those are external concerns.

---

# Document Authority Chain

| Level | Document Layer    | Defines |
|-------|-------------------|---------|
| 1     | Architecture (`docs/raw/external-context/astra.md`) | How the system is structured — invariants, patterns, layer rules |
| 2     | Feature           | What the system must do — behavior, responsibilities, workflows |
| 3     | Feature Technical | How each feature fits into the architecture — module structure, state models, integration design |
| 4     | Source Code       | How it was actually built |

Rules:

* Source code must comply with all three documentation layers.
* Feature-technical docs are the **primary bridge** — they translate feature requirements into architectural terms. Implementation is validated against feature-technical docs first.
* Feature-technical docs must themselves be consistent with architecture and feature docs. If a feature-technical doc contradicts architecture, report it — do not silently accept the feature-technical doc as correct.
* Source code cannot redefine architecture, feature behavior, or technical design.
* Conflicts at any level generate findings.

Never silently resolve conflicts.

---

# Core Principle

```text
Architecture  → How the system is structured
Feature       → What the system must do
Feature-Tech  → How the feature fits into the architecture
Implementation→ How it was actually built
```

The audit validates alignment at every level.

---

# Scope

Primary Input:

```text
src/**
```

Reference Inputs (in authority order):

```text
docs/raw/external-context/astra.md
docs/raw/features/**
docs/raw/feature-technical/**
README.md
```

---

# Explicit Non-Goals

The Implementation Audit MUST NOT:

* redesign architecture
* redesign features
* redesign technical designs
* invent missing behavior
* infer undocumented requirements

Missing documentation must be reported as a finding.

Never silently assume intent.

---

# Severity Model

| Severity   | Meaning |
|------------|---------|
| Critical   | Implementation breaks documented contract; runtime impact likely |
| Major      | Significant divergence from documented design; may cause subtle bugs |
| Minor      | Small deviation, cosmetic inconsistency, or stale reference |
| Suggestion | Improvement opportunity with no functional impact |

---

# Audit Phase 1 — Source Inventory

## Goal

Create complete implementation inventory.

## Discover

```text
Hooks
Components
Repositories
State definitions
Utilities
Type definitions
Tests
Public API exports
```

## Output

| Category       | Files | Exports |
|----------------|-------|---------|
| Hooks          | X     | X       |
| Components     | X     | X       |
| Repositories   | X     | X       |
| State types    | X     | X       |
| Utilities      | X     | X       |
| Tests          | X     | —       |
| Public exports | —     | X       |

---

# Audit Phase 2 — Architecture Compliance

## Goal

Validate implementation against Prana's architecture invariants.

Reference: `docs/raw/external-context/astra.md`

## Checks

### Statelessness

* Services should not hold mutable state across requests where possible
* State explicitly managed through context/storage layers, not in-memory globals
* No global mutable singletons in feature modules
* Idempotent operation design preferred

### Dependency Direction

* Import direction: features/ → services/ → storage/; never reverse
* Feature modules depend on services/ but not directly on other features/
* No circular dependencies between modules
* No bidirectional dependencies between main and renderer processes
* All cross-process communication goes through typed IPC channels

### Lifecycle Safety

* Services must handle start/stop/restart gracefully
* No unmanaged background processes or orphaned timers
* Resource cleanup on shutdown (file handles, DB connections, IPC listeners)
* Workers and sandbox processes have explicit lifetime boundaries

### Storage Neutrality

* No direct filesystem access in feature modules — use storage/ abstraction
* Database access through repository/service layer only
* No raw SQL outside storage/ modules
* File paths and environment configuration injected, not hardcoded

### Security

* No plaintext credentials in memory or logs
* All IPC payloads validated at the process boundary
* Encryption keys managed through vault/, never hardcoded
* Process isolation for sandboxed execution environments

Finding Category: `IMPL-ARCH-{nnn}`

---

# Audit Phase 3 — Feature Compliance

## Goal

Validate implementation against feature specifications.

Reference: `docs/raw/features/**`

## For every documented feature, validate:

### Responsibilities

Are all documented responsibilities implemented?

### Workflows

Are all documented workflows realized?

### States

Are all documented states handled?

### Rendering Priority

For `AppStateHandler`: does the fixed render priority match the documented order?

### Validation Rules

Are documented validation rules enforced?

### Edge Cases

Are documented edge cases handled?

### Failure Scenarios

Are documented failure scenarios handled?

### Non-Responsibilities

Does implementation avoid doing things the feature explicitly excludes?

Finding Category: `IMPL-FEATURE-{nnn}`

---

# Audit Phase 4 — Technical Design Compliance

## Goal

Validate implementation against feature-technical design.

Reference: `docs/raw/feature-technical/**`

## Checks

### Module Structure

Does the file/folder structure match the technical design?

### State Models

Do the state types and transitions match the technical design?

### Workflow Realization

Does the implementation sequence match the documented workflow design?

### Integration Design

Do the integration points (hook ↔ repo, component ↔ hook, context ↔ component) match design?

### Error Design

Does error handling and normalization match the technical error design?

### Type Design

Do the TypeScript types, generics, and interfaces match the technical design?

### Context / Slot Design

Does the `AppStateProvider` + slot props design match the technical design for rendering delegation?

Finding Category: `IMPL-DESIGN-{nnn}`

---

# Audit Phase 5 — Drift Detection

## Goal

Detect implementation that diverges from or exceeds documented specification.

## Detect

### Undocumented Behavior

Code behavior not present in any documentation layer.

### Undocumented States

States or state transitions not documented in feature or feature-technical docs.

### Undocumented Integrations

Integration points not described in architecture or feature-technical docs.

### Undocumented Dependencies

Runtime or package dependencies not listed in architecture docs.

### Undocumented Workflows

Code paths not traced in any documentation layer.

### Stale Comments

File comments, JSDoc, or inline comments referencing old names, removed features, or outdated structure.

Finding Category: `IMPL-DRIFT-{nnn}`

---

# Audit Phase 6 — Public API Audit

## Goal

Validate the exported API surface against documentation.

Reference: `docs/raw/external-context/astra.md`, README.md

## Checks

### Export Accuracy

Do exports match the documented API surface?

### Barrel Export Accuracy

Does `src/lib.ts` correctly expose all documented exports and only those exports?

### Public Contract Compliance

Are exported types complete and correct?

### Hidden Exports

Are internal symbols leaking into the public API?

### Missing Exports

Are documented APIs absent from the barrel?

### README Accuracy

Does the README "Available Exports" section match the actual barrel?

Finding Category: `IMPL-API-{nnn}`

---

# Audit Phase 7 — Type Accuracy

## Goal

Validate implementation types against documentation.

Reference: `docs/raw/features/**`, `docs/raw/feature-technical/**`

## Checks

### Interface Accuracy

Do interfaces match documented contracts?

### Field Types

Do field types (`T | null` vs `T | undefined`, etc.) match documentation?

### Enum Accuracy

Do enum values and names match documentation?

### Generic Usage

Are generics used correctly and consistently with documented contracts?

### Return Types

Do function and hook return types match documentation?

### Deprecated References

Are deprecated types or enum members still referenced in source or tests?

Finding Category: `IMPL-TYPE-{nnn}`

---

# Audit Phase 8 — Dependency Audit

## Goal

Validate the dependency graph against architecture rules.

Reference: `docs/raw/external-context/astra.md`

## Checks

### Package Dependencies

Do `package.json` dependencies match the documented dependency contract?

### Illegal Imports

Any import that violates documented layer rules?

### Circular Dependencies

Any circular import chains?

### Layer Violations

Components importing from repo directly? Hooks importing from components?

### Architecture Bypasses

Any code bypassing the documented abstraction layer?

### IPC Boundary Integrity

Any direct process communication bypassing the IPC bridge?
Renderer importing main-process modules or vice versa?
All cross-process communication must go through typed IPC channels only.

Finding Category: `IMPL-DEPENDENCY-{nnn}`

---

# Audit Phase 9 — Technical Debt Detection

## Goal

Detect maintainability risks not captured by other phases.

## Detect

### Naming Inconsistencies

Variables, methods, or files named differently from documented concepts.

### Typos in Source

Misspelled type names, method names, or identifiers that propagate through the codebase.

### Stale Comments

File headers, inline comments, or JSDoc referencing removed features or old names.

### Dead Code

Exported or internal code with no callers and no documented purpose.

### Production Debug Artifacts

`console.log`, `console.error`, `debugger` statements in production library code.

### Falsy Coercion Risks

Use of `||` for null/undefined handling where `??` is semantically correct (falsy data values like `0`, `""`, `false`).

Finding Category: `IMPL-DEBT-{nnn}`

---

# Audit Phase 10 — Implementation Purity

## Goal

Detect business and architecture leakage — decisions made in source that belong in documentation.

## Business Logic Leakage

Undocumented product decisions or policies in source code:

```text
Hardcoded business rules not in feature docs
Undocumented conditional behavior
Undocumented feature flags
```

## Architecture Leakage

New architecture patterns introduced in source but not in architecture docs:

```text
New dependency rules
New layer ownership rules
New module boundaries
```

## Technical Design Leakage

Implementation-defined module structures or integrations not in feature-technical docs:

```text
Undocumented module structures
Undocumented integration points
Undocumented state models
```

Finding Category: `IMPL-PURITY-{nnn}`

---

# Audit Phase 11 — Test Integrity

## Goal

Validate that tests accurately reflect documented behavior.

Reference: `docs/raw/features/**`, `docs/raw/feature-technical/**`

## Checks

### Assertion Accuracy

Do test assertions match documented behavior? Identify any assertions that contradict source implementation.

### Deprecated References in Tests

Do tests reference deprecated symbols (e.g. `HttpStatusCode.IDLE` instead of `StateCode.IDLE`)?

### Coverage Gaps

Are documented edge cases, failure scenarios, or feature workflows untested?

### Mock Accuracy

Do mocks accurately represent the abstraction they replace?

### Stale Mocks

Do tests mock removed packages, IPC channels, or services no longer in the codebase?

Finding Category: `IMPL-TEST-{nnn}`

---

# Required Matrices

## Architecture Compliance Matrix

| Invariant | Documented | Implemented | Status |
|-----------|------------|-------------|--------|

## Feature Compliance Matrix

| Feature | Requirement | Implemented | Status |
|---------|-------------|-------------|--------|

## Technical Design Compliance Matrix

| Feature-Technical | Design Requirement | Implemented | Status |
|-------------------|--------------------|-------------|--------|

## Drift Matrix

| Area | Documented | Implemented | Status |
|------|------------|-------------|--------|

## Public API Matrix

| Export | Documented | In Barrel | Status |
|--------|------------|-----------|--------|

## Dependency Matrix

| Module | Dependency | Allowed | Status |
|--------|------------|---------|--------|

## Type Accuracy Matrix

| Type / Field | Documented | Source | Status |
|--------------|------------|--------|--------|

## Test Integrity Matrix

| Test | Asserts | Matches Source | Status |
|------|---------|----------------|--------|

## Technical Debt Matrix

| Issue | File | Severity |
|-------|------|----------|

---

# Finding Format

Each finding must include:

### Finding ID

```text
IMPL-{CATEGORY}-{nnn}
```

### Category

```text
ARCH | FEATURE | DESIGN | DRIFT | API | TYPE | DEPENDENCY | DEBT | PURITY | TEST
```

### Severity

```text
Critical | Major | Minor | Suggestion
```

### File and Line

Source file and line number where the issue exists.

### Expected

Documented behavior from the referenced doc (cite the file and section).

### Actual

Observed implementation behavior.

### Impact

Systemic impact on consumers, correctness, or maintainability.

### Recommendation

Specific remediation.

---

# Scoring

| Category                    | Weight |
|-----------------------------|--------|
| Architecture Compliance     | 25%    |
| Feature Compliance          | 20%    |
| Technical Design Compliance | 15%    |
| Test Integrity              | 10%    |
| Drift Detection             | 10%    |
| Dependency Compliance       | 8%     |
| API Compliance              | 5%     |
| Type Accuracy               | 4%     |
| Technical Debt              | 2%     |
| Implementation Purity       | 1%     |

## Scoring Deductions

| Severity   | Deduction per Finding |
|------------|-----------------------|
| Critical   | −1.5 |
| Major      | −0.5 |
| Minor      | −0.2 |
| Suggestion | −0.0 (no deduction) |

Start from 10.0. Apply deductions. Floor at 0.0.

---

# Final Assessment

| Score Range | Assessment              |
|-------------|-------------------------|
| 9.0–10.0    | Excellent               |
| 7.0–8.9     | Good                    |
| 5.0–6.9     | Needs Improvement       |
| 3.0–4.9     | Major Revision Required |
| 0.0–2.9     | Implementation Unsound  |

---

# Required Report Structure

## 1. Executive Summary

```text
# Implementation Audit Report — Prana

Overall Assessment:  {assessment}
Final Score:         {score} / 10
Critical Findings:   {n}
Major Findings:      {n}
Minor Findings:      {n}
Suggestions:         {n}
```

Followed immediately by the Documents Audited table:

| Document | Layer | Purpose |
|----------|-------|---------|
| `src/main/` | Source | Main process entry and service orchestration |
| `src/main/features/` | Source | Feature modules (auth, vault, sync, etc.) |
| `src/main/services/` | Source | Backend services |
| `src/renderer/` | Source | Renderer process UI |
| `src/shared/` | Source | Shared types and utilities |
| `docs/raw/external-context/astra.md` | Architecture | External architecture context |
| `docs/raw/features/**` | Feature | System behavior |
| `docs/raw/feature-technical/**` | Feature-Technical | Implementation design |

## 2. Source Inventory

Complete file and export inventory.

## 3. Architecture Compliance Report

One section per invariant. Matrix at end.

## 4. Feature Compliance Report

One section per feature. Matrix at end.

## 5. Technical Design Compliance Report

One section per feature-technical document. Matrix at end.

## 6. Drift Detection Report

All drift findings with matrix.

## 7. Public API Audit Report

Export surface verification with matrix.

## 8. Type Accuracy Report

All type findings with matrix.

## 9. Dependency Audit Report

Dependency graph findings with matrix.

## 10. Technical Debt Report

Debt findings with matrix.

## 11. Implementation Purity Report

Purity findings.

## 12. Test Integrity Report

Test findings with matrix.

## 13. Findings Summary

All findings grouped by severity:

### Critical

| ID | File | Finding |
|----|------|---------|

### Major

| ID | File | Finding |
|----|------|---------|

### Minor

| ID | File | Finding |
|----|------|---------|

### Suggestions

| ID | File | Finding |
|----|------|---------|

## 14. Scoring Breakdown

| Category | Raw Score | Weight | Weighted Score |
|----------|-----------|--------|----------------|

```text
Total Score: X.X / 10
```

## 15. Score Improvement Summary

Compare against the previous report from `docs/raw/report/implementation/archive/` (highest timestamp). If no previous report exists, state "Baseline — no prior report to compare."

```text
Previous Report: {filename}
Previous Score:  X.X / 10
Current Score:   Y.Y / 10
Change:          +N.N / −N.N / No change
```

List resolved findings from previous report. List new findings not in previous report.

## 16. Recommended Fix Priority

Group fixes into:

```text
P0 — Build / Install Breaking
P1 — Silent Bugs (wrong behavior)
P2 — API Surface / Contract
P3 — Hygiene / Debt
```

## 17. Final Verdict

```text
{Assessment} ({Score}/10)
```

## 18. Audit Traceability

| Reference | Location |
|-----------|----------|
| Architecture Docs | `docs/raw/external-context/astra.md` |
| Feature Docs | `docs/raw/features/**` |
| Feature-Technical Docs | `docs/raw/feature-technical/**` |
| Source | `src/**` |
| Audit Report | `docs/raw/report/implementation/latest/implementation-audit-{timestamp}.md` |
| Previous Report | `docs/raw/report/implementation/archive/{previous-filename}` |

---

# Report Rotation

Before writing the new report, rotate the previous report:

```text
mv docs/raw/report/implementation/latest/* docs/raw/report/implementation/archive/
mkdir -p docs/raw/report/implementation/latest
```

---

# Output Location

```text
docs/raw/report/implementation/latest/implementation-audit-{timestamp}.md
```

Timestamp format: `YYYY-MM-DD-HHMM`
