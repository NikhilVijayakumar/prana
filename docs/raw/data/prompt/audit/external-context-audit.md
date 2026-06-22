# Repository Boundary & Dependency Audit System — Prana

## Purpose

You are acting as:

* Governance Auditor
* Repository Boundary Reviewer
* Dependency Validation Specialist
* Ownership Validation Specialist
* Documentation Dependency Reviewer

Your responsibility is to audit Prana's repository governance across:

```text
README.md

docs/raw/external-context/**
docs/raw/data/prompt/**
```

and referenced repositories.

The audit validates:

* Ownership correctness
* Dependency correctness
* External context correctness
* Contract consumption correctness
* Documentation dependency correctness
* Repository boundary compliance
* Governance consistency

The audit evaluates documentation only.

It does not validate implementation.

---

# Scope

Primary:

```text
README.md

docs/raw/external-context/**
docs/raw/data/prompt/**
```

Referenced Repositories:

```text
../astra
```

and any additional repositories declared in ownership or external context documentation.

---

# Documentation Authority Rule

Repository governance must be derived from:

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

# Core Principle

Every capability must satisfy:

```text
One Owner

Zero or More Consumers

Approved Consumption Type

Documented Boundary
```

---

# Repository Identity Validation

Determine:

| Field              | Value |
| ------------------ | ----- |
| Repository Name    |       |
| Repository Purpose |       |
| Repository Type    |       |

Supported Types:

* Runtime Platform
* Application Engineering Platform
* Design System Platform
* Product Application
* Shared Library
* Infrastructure Platform
* Unknown

If identity cannot be verified:

Generate Open Question.

Never infer repository purpose solely from its name.

---

# Governance Model

## Ownership Types

### Owned

Repository is authoritative.

Responsible for:

* Definition
* Governance
* Evolution

---

### Consumed By Contract

Repository consumes:

```text
Contracts
Standards
Interfaces
Schemas
```

but does not own them.

---

### Consumed By Documentation

Repository consumes:

```text
Documentation
Guidelines
Rules
Standards
```

but does not own them.

---

### Consumed By Boilerplate

Repository imports and uses boilerplate code at runtime.

Allowed only when consuming repository has explicit runtime dependency on provider.

Examples:

```text
Prana consumes at runtime — Astra IpcService, ApiService, AppStateHandler, useDataState, ServerResponse
```

---

### Referenced

Repository references concept.

Not owner.

Not consumer.

---

### Forbidden

Repository must neither own nor consume.

---

# Discovery Phase 1 — Repository Inventory

## Goal

Create authoritative repository inventory.

Required Matrix:

| Repository | Type | Purpose |
| ---------- | ---- | ------- |

---

# Discovery Phase 2 — Responsibility Inventory

## Goal

Extract responsibilities.

Required Matrix:

| Repository | Responsibility |
| ---------- | -------------- |

All responsibilities require evidence.

---

# Discovery Phase 3 — Non-Responsibility Inventory

## Goal

Extract boundaries.

Required Matrix:

| Repository | Non-Responsibility |
| ---------- | ------------------ |

Examples:

```text
Does Not Own Design System

Does Not Own Architecture

Does Not Own Runtime Platform

Does Not Own Prototype Runtime
```

All boundaries require evidence.

---

# Discovery Phase 4 — Capability Inventory

## Goal

Identify all capabilities.

Examples:

```text
Design Tokens

Theme System

Localization

Component Contracts

Prototype Runtime

Application Architecture

MVVM

Repository Pattern

SQLite Cache

Plugin Host
```

Required Matrix:

| Capability | Category |
| ---------- | -------- |

---

# Discovery Phase 5 — Ownership Inventory

## Goal

Determine ownership.

Required Matrix:

| Capability | Owner |
| ---------- | ----- |

Every capability must have one owner.

---

# Discovery Phase 6 — Consumer Inventory

## Goal

Determine consumers.

Required Matrix:

| Capability | Consumer | Consumption Type |
| ---------- | -------- | ---------------- |

Consumption Types:

```text
Contract

Documentation

Reference
```

---

# Discovery Phase 7 — External Context Validation

## Goal

Validate external context documents.

For every dependency:

Validate:

### Dependency Scope

### Responsibilities

### Non-Responsibilities

### Concepts

### Rules

### Contracts

### Documentation References

### AI Guidance

Required Matrix:

| Dependency | Scope | Status |
| ---------- | ----- | ------ |

---

# Discovery Phase 8 — Contract Inventory

## Goal

Identify consumable contracts.

Examples:

```text
Theme Contracts

Localization Contracts

Component Contracts

Design Contracts
```

Required Matrix:

| Contract | Owner | Consumers |
| -------- | ----- | --------- |

---

# Discovery Phase 9 — Documentation Dependency Inventory

## Goal

Identify documentation dependencies.

Required Matrix:

| Documentation Area | Owner | Consumers |
| ------------------ | ----- | --------- |

---

# Validation Phase 1 — Ownership Completeness

## Goal

Validate ownership coverage.

Rule:

Every capability must have:

```text
Exactly One Owner
```

Finding:

```text
OWNERSHIP-MISSING-{nnn}
```

---

# Validation Phase 2 — Ownership Uniqueness

## Goal

Detect duplicate ownership.

Rule:

No capability may have multiple owners.

Finding:

```text
OWNERSHIP-DUPLICATE-{nnn}
```

---

# Validation Phase 3 — Ownership Drift

## Goal

Detect ownership drift.

Examples:

```text
State Management

Previous Owner:
Prana

Current Owner:
Astra
```

Documentation must reflect ownership changes. Note: Prana originally owned its own state management but now consumes it from Astra via dependency.

Finding:

```text
OWNERSHIP-DRIFT-{nnn}
```

---

# Validation Phase 4 — Dependency Scope Compliance

## Goal

Validate external context scope.

Examples:

Allowed:

```text
Dependency Scope: Specific

Relevant Areas:

- Design System
- Localization
```

Not Allowed:

```text
Scope:
Design System

Generated:
Design System
Localization
Prototype Runtime
MockDB
```

Finding:

```text
DEPENDENCY-SCOPE-{nnn}
```

---

# Validation Phase 5 — Consumption Compliance

## Goal

Validate consumption correctness.

Examples:

Allowed:

```text
Prana

Consumes:

Astra Architecture Documentation
Astra Boilerplate Code (IpcService, ApiService, AppStateHandler, useDataState, ServerResponse)
Astra Type Contracts (AppState, ITransportService, Platform, AppStateComponents)
```

Not Allowed:

```text
Prana

Consumes:

Astra Runtime Internals
Astra Private Imports
Astra node_modules
```

Finding:

```text
CONSUMPTION-VIOLATION-{nnn}
```

---

# Validation Phase 6 — Contract Compliance

## Goal

Validate contract consumption.

Allowed:

```text
Theme Contracts

Localization Contracts

Component Contracts
```

Not Allowed:

```text
Theme Runtime

Prototype Runtime

Component Implementation
```

Finding:

```text
CONTRACT-VIOLATION-{nnn}
```

---

# Validation Phase 7 — Documentation Dependency Compliance

## Goal

Validate documentation-only dependencies.

Rule:

Repositories may consume:

```text
README.md

docs/raw/**
```

Repositories may not consume:

```text
Runtime Implementations

Source Code

package.json Dependencies
```

Finding:

```text
DOCUMENTATION-VIOLATION-{nnn}
```

---

# Validation Phase 8 — Repository Boundary Compliance

## Goal

Validate repository boundaries.

Examples:

### Astra

Must Not Own:

```text
Runtime Platform

Storage Services

Orchestration

Electron Host
```

---

### Prana

Must Not Own:

```text
Architecture Patterns (MVVM, Repository)

State Management Types

Design System

Architecture Governance
```

Finding:

```text
BOUNDARY-VIOLATION-{nnn}
```

---

# Validation Phase 9 — Context Purity Validation

## Goal

Validate external context purity.

Example:

### Prana → Astra

Allowed:

```text
Architecture Documentation (MVVM, State, Repository)

Invariants

Integration Contracts

Boilerplate Code Patterns
```

Rationale: Prana has a runtime dependency on Astra (`"astra": "github:NikhilVijayakumar/astra"`). Prana imports and uses Astra's boilerplate code at runtime — `IpcService` for Electron IPC transport, `ApiService` for HTTP, `AppStateHandler` for conditional rendering, `useDataState` for MVVM state management, and `ServerResponse` for response normalization. The external context scope covers both the architecture patterns these exports implement and the boilerplate code itself so Prana's AI can generate correct consumer code. The context document must be documentation-derived for architecture, but MUST include accurate boilerplate code patterns from the explicitly allowed src paths.

Forbidden:

```text
Runtime Platform

Storage Services

Orchestration

Electron Host

Business Logic
```

Finding:

```text
CONTEXT-PURITY-{nnn}
```

---

# Validation Phase 10 — Traceability Validation

## Goal

Validate governance traceability.

Every finding must be traceable.

Required Matrix:

| Claim | Evidence | Documentation Summary |
| ----- | -------- | --------------------- |

Nothing may be asserted without evidence.

---

# Validation Phase 11 — Documentation Reference Completeness

## Goal

Validate that every external context document includes proper documentation references with source paths and summaries.

Every major section in an external context document must end with a `### Source Documentation` subsection containing:

| Document | Summary |
|----------|---------|
| `../repo-name/path/to/doc.md` | 1-3 sentence summary of what the original document says |

### Checks

1. **Section Coverage** — Every major section (Architecture Patterns, Public API Surface, Architectural Invariants, Boilerplate Code, Integration Contracts, AI Guidance) has a `### Source Documentation` table.

2. **Path Validity** — Every document reference in the table and in the Traceability Matrix uses a full relative path from the consuming repo's root (e.g., `../astra/docs/raw/architecture/...`). Bare filenames like `mvvm-separation.md` are invalid.

3. **Summary Substance** — Every summary is 1-3 sentences describing what the original document actually says, not merely restating its title.

4. **Traceability Matrix Completeness** — The Traceability Matrix has 3 columns: `Claim | Evidence | Documentation Summary`.

### Validation Steps

1. For each external context document at `docs/raw/external-context/*.md`:
   - Verify every major section has a `### Source Documentation` table
   - Verify each table entry has a valid `../repo-name/` path
   - Verify each entry has a substantive summary
2. For the Traceability Matrix:
   - Verify 3-column format (Claim | Evidence | Documentation Summary)
   - Verify all evidence paths use `../repo-name/` prefix
   - Verify all summaries are substantive

### Findings

```text
DOCUMENTATION-REFERENCE-MISSING-{nnn}
```
Severity: Major — section missing `### Source Documentation` table.

```text
DOCUMENTATION-PATH-INVALID-{nnn}
```
Severity: Major — evidence path is bare filename or repo-relative without `../repo-name/` prefix.

```text
DOCUMENTATION-SUMMARY-MISSING-{nnn}
```
Severity: Minor — summary is missing, empty, or tautological (e.g., "Documents MVVM separation").

```text
TRACEABILITY-MATRIX-2COLUMN-{nnn}
```
Severity: Major — Traceability Matrix still uses 2-column format instead of required 3 columns.

---

# Prana / Astra Reference Model

Expected Ownership:

| Capability               | Owner | Category              |
| ------------------------ | ----- | --------------------- |
| MVVM Pattern             | Astra | Architecture          |
| State Management         | Astra | State Management      |
| Repository Pattern       | Astra | Data Access           |
| Platform Abstraction     | Astra | Architecture          |
| Feature Module Structure | Astra | Architecture          |
| Build System             | Astra | Infrastructure        |
| Public API Surface       | Astra | Governance            |
| Runtime Platform         | Prana | Runtime Platform      |
| Plugin Host              | Prana | Runtime Platform      |
| Storage Services         | Prana | Persistence           |
| Orchestration            | Prana | Runtime               |
| Security                 | Prana | Security              |
| Context Management       | Prana | Intelligence          |
| Agent System             | Prana | Intelligence          |
| Sync Engine              | Prana | Data Lifecycle        |
| Communication Channels   | Prana | Integration           |

Notes:

- Astra owns MVVM architecture contracts, patterns, and boilerplate code. Prana consumes all three through its runtime dependency on `astra`.
- Prana does not own architecture patterns — it consumes them from Astra.
- Prana does not own boilerplate code — it imports Astra's implementations (`IpcService`, `ApiService`, `AppStateHandler`, `useDataState`, `ServerResponse`) at runtime.
- Prana owns the Electron runtime platform, orchestration, storage, security, and all application-level capabilities.
- External context for Astra must cover both architecture documentation AND accurate boilerplate code patterns from allowed src paths. The boilerplate patterns are runtime imports, not just reference examples.

Deviation must be reported.

---

# Required Matrices

## Repository Matrix

## Responsibility Matrix

## Non-Responsibility Matrix

## Capability Matrix

## Ownership Matrix

## Consumer Matrix

## Contract Matrix

## Documentation Dependency Matrix

## External Context Matrix

## Boundary Matrix

## Traceability Matrix

## Violation Matrix

---

# Severity Model

### Critical

* Missing ownership
* Duplicate ownership
* Major boundary violation
* Invalid dependency model

---

### Major

* Ownership drift
* Contract violation
* Consumption violation
* Context purity violation

---

### Minor

* Documentation ambiguity
* Missing evidence
* Incomplete context

---

### Suggestion

* Governance improvement
* Documentation improvement

---

# Scoring Model

| Dimension                | Weight |
| ------------------------ | ------ |
| Ownership Completeness   | 20%    |
| Ownership Uniqueness     | 15%    |
| Dependency Correctness   | 20%    |
| Boundary Compliance      | 15%    |
| Contract Compliance      | 10%    |
| Documentation Compliance | 10%    |
| Context Purity           | 5%     |
| Traceability             | 5%     |

## Scoring Formula

Start each dimension at 10.0. Deduct per finding in that dimension:

| Severity   | Deduction per Finding |
| ---------- | --------------------- |
| Critical   | −3.0                  |
| Major      | −1.5                  |
| Minor      | −0.5                  |
| Suggestion | −0.0                  |

Floor per dimension: 0.0.

```text
Governance Score =
  (Ownership Completeness × 0.20)
  + (Ownership Uniqueness × 0.15)
  + (Dependency Correctness × 0.20)
  + (Boundary Compliance × 0.15)
  + (Contract Compliance × 0.10)
  + (Documentation Compliance × 0.10)
  + (Context Purity × 0.05)
  + (Traceability × 0.05)
```

---

# Final Assessment

| Score Range | Assessment              |
| ----------- | ----------------------- |
| 9.0–10.0    | Excellent               |
| 7.0–8.9     | Good                    |
| 5.0–6.9     | Needs Improvement       |
| 3.0–4.9     | Major Revision Required |
| 0.0–2.9     | Governance Unsound      |

---

# Required Report Structure

## 1. Executive Summary

```text
# Repository Boundary & Dependency Audit Report — Prana

Overall Assessment:  {assessment}
Final Score:         {score} / 10
Critical Findings:   {n}
Major Findings:      {n}
Minor Findings:      {n}
Suggestions:         {n}
```

Followed immediately by the Repositories Audited table:

| Repository | Type | Purpose |
| ---------- | ---- | ------- |
| `README.md` (current) | — | Repository identity and boundary declaration |
| `docs/raw/external-context/**` | — | External dependency context documents |
| `docs/raw/data/prompt/**` | — | AI prompt system documents |
| `../astra/README.md` | Shared Library | Referenced repository identity |

---

## 2. Repository Inventory

Table of all participating repositories with type and purpose. Evidence required.

---

## 3. Responsibility Report

Per-repository responsibility matrix with evidence.

---

## 4. Non-Responsibility Report

Per-repository boundary matrix with evidence.

---

## 5. Capability Inventory

All capabilities identified across the repository set with category classification.

---

## 6. Ownership Matrix

| Capability | Owner | Category | Evidence |
| ---------- | ----- | -------- | -------- |

Every capability must have exactly one owner.

---

## 7. Consumer Matrix

| Capability | Consumer | Consumption Type | Evidence |
| ---------- | -------- | ---------------- | -------- |

---

## 8. Contract Compliance Report

Findings per check. Compliance table at end.

---

## 9. Documentation Dependency Report

Findings per check. Compliance table at end.

---

## 10. External Context Validation Report

Per dependency: scope, responsibilities, concepts, rules, contracts, documentation references, AI guidance — validated or flagged.

---

## 11. Boundary Validation Report

Findings per repository. Compliance table at end.

---

## 12. Context Purity Report

Findings per external context document. Compliance table at end.

---

## 13. Ownership Drift Report

Capabilities where ownership has moved without documentation update.

---

## 14. Violations Report

All findings grouped by severity:

### Critical

| ID | Repository | Finding |
| -- | ---------- | ------- |

### Major

| ID | Repository | Finding |
| -- | ---------- | ------- |

### Minor

| ID | Repository | Finding |
| -- | ---------- | ------- |

---

## 15. Scoring Breakdown

| Dimension                | Raw Score | Deductions | Weight | Weighted Score |
| ------------------------ | --------- | ---------- | ------ | -------------- |
| Ownership Completeness   |           |            | 20%    |                |
| Ownership Uniqueness     |           |            | 15%    |                |
| Dependency Correctness   |           |            | 20%    |                |
| Boundary Compliance      |           |            | 15%    |                |
| Contract Compliance      |           |            | 10%    |                |
| Documentation Compliance |           |            | 10%    |                |
| Context Purity           |           |            | 5%     |                |
| Traceability             |           |            | 5%     |                |

```text
Total Score: X.X / 10
```

---

## 16. Score Improvement Summary

Compare against the previous report from `docs/raw/report/governance/archive/` (highest timestamp). If no previous report exists, state "Baseline — no prior report to compare."

```text
Previous Report: {filename}
Previous Score:  X.X / 10
Current Score:   Y.Y / 10
Change:          +N.N / −N.N / No change
```

| Dimension                | Previous | Current | Change |
| ------------------------ | -------- | ------- | ------ |
| Ownership Completeness   | X        | Y       | +N     |
| Ownership Uniqueness     | X        | Y       | +N     |
| Dependency Correctness   | X        | Y       | +N     |
| Boundary Compliance      | X        | Y       | +N     |
| Contract Compliance      | X        | Y       | +N     |
| Documentation Compliance | X        | Y       | +N     |
| Context Purity           | X        | Y       | +N     |
| Traceability             | X        | Y       | +N     |

List resolved findings from previous report. List new findings not in previous report.

---

## 17. Top 10 Governance Improvements

Ordered list of highest-impact improvements.

---

## 18. Final Verdict

```text
{Assessment} ({Score}/10)
```

Concise governance health summary.

---

## 19. Audit Traceability

| Reference            | Location                                                                      |
| -------------------- | ----------------------------------------------------------------------------- |
| External Context     | `docs/raw/external-context/**`                                                |
| Prompt Docs          | `docs/raw/data/prompt/**`                                                     |
| README               | `README.md`                                                                   |
| Referenced Repos     | `../astra/README.md`                                                          |
| Audit Report         | `docs/raw/report/governance/latest/repository-boundary-audit-{timestamp}.md`  |
| Previous Report      | `docs/raw/report/governance/archive/{previous-filename}`                      |

---

# Report Rotation

Before writing the new report, rotate the previous report:

```text
mv docs/raw/report/governance/latest/* docs/raw/report/governance/archive/
mkdir -p docs/raw/report/governance/latest
```

---

# Output Location

```text
docs/raw/report/governance/latest/repository-boundary-audit-{timestamp}.md
```

Timestamp format: `YYYY-MM-DD-HHMM`

---

# Final Rule

The governance model is considered successful only when:

> Every capability has exactly one authoritative owner, all consumers are explicitly identified, dependency scopes are respected, contracts are consumed correctly, documentation dependencies are valid, repository boundaries are enforced, ownership drift is absent, context purity is maintained, and all governance decisions are fully traceable to documentation evidence.
