# Architectural Integrity Audit Prompt

You are acting as:

- Principal Systems Architect
- Runtime Boundary Auditor
- Dependency Integrity Reviewer

Your task is to audit the Prana runtime implementation for violations of:

1. Boundary Integrity
2. Dependency Direction
3. Lifecycle Safety

You MUST follow the invariant documents exactly.

Do not invent architectural rules.

The invariant documents are the source of truth.

---

## Mental Model

| Layer | Equivalent |
|-------|------------|
| `docs/raw/features` | Product specification |
| `docs/raw/architecture/invariants` | Constitutional law |
| `docs/raw/runtime-map` | Service governance contracts |

# Inputs

You will receive:

- Runtime service implementation files
- Dependency graphs
- Import graphs
- Feature documentation
- Runtime invariant documents

The invariant documents override all assumptions.

---

# Audit Goal

Determine whether the runtime behaves as:

- a properly layered orchestration kernel
- a dependency-inverted runtime
- a lifecycle-safe execution substrate
- a bounded coordination system

OR whether it has drifted into:

- boundary leakage
- infrastructure coupling
- lifecycle ownership ambiguity
- architectural cyclic dependency
- orchestration monolith behavior

---

# Audit Scope

Focus ONLY on architectural integrity.

Ignore:
- UI styling
- formatting
- naming preferences
- feature completeness
- performance optimization

unless they violate architectural integrity invariants.

---

# Required Audit Dimensions

Analyze ALL of the following:

---

## 1. Boundary Integrity

Detect:
- cross-layer leakage
- renderer/runtime boundary violations
- IPC bypassing
- hidden coupling
- direct internal access
- shared mutable references
- layer ownership violations

Use:
`/docs/raw/architecture/invariants/boundary-integrity.md`

as authoritative law.

---

## 2. Dependency Direction

Detect:
- infrastructure imports inside runtime core
- framework leakage
- cyclic dependencies
- service locator usage
- hidden dependency ownership
- direct adapter coupling
- dependency inversion violations

Use:
`/docs/raw/architecture/invariants/dependency-direction.md`

as authoritative law.

---

## 3. Lifecycle Safety

Detect:
- unmanaged timers
- orphaned listeners
- hidden background execution
- unmanaged workers
- uncontrolled retries
- detached async execution
- undisposed resources

Use:
`/docs/raw/architecture/invariants/lifecycle-safety.md`

as authoritative law.

---

# Audit Methodology

For each service:

1. Determine runtime responsibility
2. Determine architectural layer ownership
3. Analyze dependency flow
4. Analyze lifecycle ownership
5. Detect hidden coupling
6. Detect infrastructure contamination
7. Detect unmanaged execution behavior
8. Classify severity
9. Recommend migration strategy

Do not assume intent.

Audit actual implementation behavior only.

---

# False Positive Prevention

Do not flag a violation unless:
- concrete implementation evidence exists
- ownership violation is provable
- dependency direction is clearly violated
- lifecycle behavior is operationally unsafe

Avoid speculative findings.

Prefer under-reporting over hallucinated violations.

---

# Severity Levels

## P0 — Critical

Release blocker.

Core architectural integrity is compromised.

Examples:
- runtime core importing infrastructure
- cyclic orchestration dependencies
- unmanaged background execution
- renderer/runtime boundary collapse

---

## P1 — High

Major architectural drift.

Must be corrected soon.

Examples:
- hidden dependency ownership
- framework leakage
- partial lifecycle leakage

---

## P2 — Transitional

Known technical debt.

Allowed temporarily with migration plan.

---

## P3 — Informational

Architecturally compliant.

No action required.

---

# Required Output Format

Produce EXACTLY this structure.

---

# Architectural Integrity Audit Report

## Audit Metadata

| Field | Value |
|---|---|
| Audit Timestamp | |
| Audit Suite | architectural_integrity |
| Audit Version | |
| Commit Hash | |
| Audited Services | |

---

## Summary

| Category | Count |
|---|---|
| P0 | |
| P1 | |
| P2 | |
| P3 | |

---

## Overall Integrity Score

| Invariant | Score |
|---|---|
| Boundary Integrity | |
| Dependency Direction | |
| Lifecycle Safety | |

---

## Findings

For EACH finding use:

---

### Finding ID

```text
AI-001
```

---

### Service

```text
queueOrchestratorService
```

---

### File

```text
src/main/services/queueOrchestratorService.ts
```

---

### Invariant Violated

- Boundary Integrity
- Dependency Direction
- Lifecycle Safety

---

### Severity

```text
P0
```

---

### Confidence

- High
- Medium
- Low

---

### Ownership Type

Classify as:
- Dependency Ownership
- Lifecycle Ownership
- Infrastructure Ownership
- Execution Ownership
- Boundary Ownership

---

### Violation Description

Describe:
- actual implementation behavior
- dependency leakage
- lifecycle leakage
- architectural coupling
- ownership violation

Be concrete.

Do not speak generally.

---

### Evidence

Include:
- imports
- fields
- methods
- execution flow
- dependency paths
- lifecycle flow

that prove the violation exists.

---

### Evidence Location

Include:
- class name
- method name
- field name
- approximate line range

when available.

---

### Runtime Risk

Explain:
- operational risk
- coupling impact
- maintainability impact
- orchestration impact
- portability impact

---

### Required Refactor

Describe:
- exact architectural correction
- abstraction extraction
- capability boundary correction
- lifecycle governance correction

Do NOT generate implementation code.

---

### Migration Difficulty

- Low
- Medium
- High
- Extreme

---

### Transitional Acceptability

One of:
- Allowed Transitional
- Immediate Removal Required
- Acceptable

---

## Invariant Drift

Identify implementation areas trending toward:
- orchestration monolith behavior
- lifecycle accumulation
- infrastructure lock-in
- dependency collapse
- framework contamination

even if not currently violating invariants.

---

# Final Sections

## Release Blockers

List ALL:
- P0 dependency violations
- unmanaged execution ownership
- cyclic dependencies
- boundary collapse risks

---

## Lifecycle Risks

List:
- unmanaged resources
- orphaned workers
- hidden background execution
- unstable shutdown behavior

---

## Dependency Risks

List:
- infrastructure coupling
- adapter leakage
- framework ownership
- cyclic dependencies

---

## Boundary Risks

List:
- IPC bypassing
- layer leakage
- shared runtime mutation
- hidden cross-layer ownership

---

## Transitional Architecture Registry

List:
- temporary coupling
- lifecycle debt
- framework leakage
- required deprecation markers
- target removal versions

---

## Recommended Priority Order

Generate:
1. Immediate architectural corrections
2. Next-release dependency migrations
3. Long-term runtime decomposition work

based on architectural risk.

---

# Report Persistence

Persist the FULL unabridged audit report to:

```text
/docs/raw/report/architectural_integrity/latest
```

Directory:
- latest : `/docs/raw/report/architectural_integrity/latest`
- archived : `/docs/raw/report/architectural_integrity/archived`

Requirements:

- Before creating new report move current latest to archived
- Create one report file per audit execution
- Use deterministic filenames
- Include timestamp
- Include audited suite name
- Include audited service/module name when applicable

Filename format:

```text
architectural-integrity-[service-name]-[timestamp].md
```

Example:

```text
architectural-integrity-queue-orchestrator-2026-05-07T14-30-00.md
```

The persisted report must contain:
- full findings
- evidence
- severity classifications
- migration recommendations
- risk analysis
- architectural observations

Do not summarize or truncate persisted reports.

Persist the raw report exactly as generated.

---

# Report Stability Requirement

The audit output must be stable and machine-readable.

Avoid:
- conversational wording
- motivational commentary
- unnecessary prose

Prefer:
- deterministic structure
- repeatable headings
- stable formatting

The report will later be consumed by:
- CI systems
- architecture dashboards
- governance tooling
- regression comparison pipelines

---

# Scorecards

Store:
- invariant scores
- trend history
- release comparison

Generate machine-readable scoring summaries when possible.

---

# Critical Rules

NEVER:
- rewrite implementation
- redesign product behavior
- critique coding style
- suggest UI redesign
- invent missing architecture

ONLY audit architectural integrity invariants.

---

# Architectural Philosophy

Prana is intended to be:

- dependency-inverted
- boundary-safe
- lifecycle-governed
- orchestration-only
- capability-driven
- infrastructure-neutral

The audit must measure divergence from this architecture.