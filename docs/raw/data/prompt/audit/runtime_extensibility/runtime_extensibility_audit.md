# Runtime Extensibility Audit Prompt

You are acting as:

- Principal Runtime Architect
- Extensibility Systems Auditor
- Capability Composition Reviewer

Your task is to audit the Prana runtime implementation for violations of:

1. Composability
2. Capability Contract Integrity
3. Extension Safety

You MUST follow the invariant documents exactly.

Do not invent architectural rules.

The invariant documents are the source of truth.

---

# Inputs

You will receive:

- Runtime service implementation files
- Dependency graphs
- Import graphs
- Capability contracts
- Feature documentation
- Runtime invariant documents

The invariant documents override all assumptions.

---

# Audit Goal

Determine whether the runtime behaves as:

- a composable orchestration kernel
- a capability-driven execution substrate
- a safely extensible runtime system

OR whether it has drifted into:

- monolithic orchestration ownership
- hidden capability coupling
- unsafe extension behavior
- shared runtime mutation
- rigid implementation dependency
- plugin instability

---

# Audit Scope

Focus ONLY on runtime extensibility.

Ignore:
- UI quality
- styling
- formatting
- naming preferences
- performance optimization

unless they violate runtime extensibility invariants.

---

# Required Audit Dimensions

Analyze ALL of the following:

---

## 1. Composability

Detect:
- hidden cross-service coupling
- shared mutable state
- monolithic orchestration ownership
- implicit execution ordering
- internal implementation leakage
- hard dependency assumptions
- runtime-wide mutable coordination

Use:
`/docs/raw/architecture/invariants/composability.md`

as authoritative law.

---

## 2. Capability Contract Integrity

Detect:
- missing capability abstraction
- direct concrete service usage
- unstable capability boundaries
- contract leakage
- capability ownership ambiguity
- adapter bypassing
- internal implementation exposure

Use:
`/docs/raw/architecture/invariants/capability-contract-integrity.md`

as authoritative law.

---

## 3. Extension Safety

Detect:
- unsafe plugin execution
- unrestricted extension access
- lifecycle leakage through extensions
- extension-owned runtime mutation
- unbounded extension privileges
- execution contamination
- unsafe runtime interception

Use:
`/docs/raw/architecture/invariants/extension-safety.md`

as authoritative law.

---

# Audit Methodology

For each service:

1. Determine runtime responsibility
2. Analyze composability boundaries
3. Analyze capability ownership
4. Analyze extension surfaces
5. Detect hidden coupling
6. Detect monolithic orchestration behavior
7. Detect unsafe extensibility patterns
8. Classify severity
9. Recommend migration strategy

Do not assume intent.

Audit actual implementation behavior only.

---

# False Positive Prevention

Do not flag a violation unless:
- concrete implementation evidence exists
- coupling is provable
- extension risk is operationally meaningful
- capability ownership is clearly violated

Avoid speculative findings.

Prefer under-reporting over hallucinated violations.

---

# Severity Levels

## P0 — Critical

Release blocker.

Runtime extensibility integrity is compromised.

Examples:
- shared runtime mutation
- monolithic orchestration ownership
- direct internal service coupling
- unsafe extension execution

---

## P1 — High

Major extensibility drift.

Must be corrected soon.

Examples:
- hidden capability assumptions
- extension lifecycle leakage
- internal contract exposure

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

# Runtime Extensibility Audit Report

## Audit Metadata

| Field | Value |
|---|---|
| Audit Timestamp | |
| Audit Suite | runtime_extensibility |
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

## Overall Extensibility Score

| Invariant | Score |
|---|---|
| Composability | |
| Capability Contract Integrity | |
| Extension Safety | |

---

## Findings

For EACH finding use:

---

### Finding ID

```text
RE-001
```

---

### Service

```text
orchestrationManager
```

---

### File

```text
src/main/services/orchestrationManager.ts
```

---

### Invariant Violated

- Composability
- Capability Contract Integrity
- Extension Safety

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
- Capability Ownership
- Extension Ownership
- Composition Ownership
- Execution Ownership
- Runtime Coordination Ownership

---

### Violation Description

Describe:
- actual implementation behavior
- hidden orchestration coupling
- capability leakage
- unsafe extensibility behavior
- runtime mutation ownership

Be concrete.

Do not speak generally.

---

### Evidence

Include:
- imports
- methods
- fields
- orchestration flow
- capability boundaries
- extension paths

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
- modularity impact
- upgrade instability
- plugin risk
- orchestration rigidity
- extension contamination
- capability fragility

---

### Required Refactor

Describe:
- exact architectural correction
- capability extraction
- boundary stabilization
- extension isolation
- composition redesign

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
- capability collapse
- unsafe extension ownership
- runtime-wide mutable coordination
- non-composable execution behavior

even if not currently violating invariants.

---

# Final Sections

## Release Blockers

List ALL:
- unsafe extension ownership
- hidden runtime coupling
- shared mutable orchestration state
- direct internal capability access

---

## Composability Risks

List:
- orchestration rigidity
- implicit execution ordering
- hidden service dependencies
- runtime-wide ownership

---

## Capability Risks

List:
- unstable contracts
- adapter bypassing
- implementation leakage
- hidden concrete dependencies

---

## Extension Risks

List:
- unsafe plugin execution
- unrestricted extension access
- extension-owned runtime mutation
- lifecycle contamination

---

## Transitional Extensibility Registry

List:
- temporary capability coupling
- extension debt
- orchestration monolith areas
- required deprecation markers
- target removal versions

---

## Recommended Priority Order

Generate:
1. Immediate extensibility corrections
2. Next-release capability stabilization
3. Long-term runtime decomposition work

based on runtime risk.

---

# Report Persistence

Persist the FULL unabridged audit report to:

```text
/docs/raw/report/runtime_extensibility/latest
```

Directory:
- latest : `/docs/raw/report/runtime_extensibility/latest`
- archived : `/docs/raw/report/runtime_extensibility/archived`

Requirements:

- Before creating new report move current latest to archived
- Create one report file per audit execution
- Use deterministic filenames
- Include timestamp
- Include audited suite name
- Include audited service/module name when applicable

Filename format:

```text
runtime-extensibility-[service-name]-[timestamp].md
```

Example:

```text
runtime-extensibility-orchestration-manager-2026-05-07T14-30-00.md
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

ONLY audit runtime extensibility invariants.

---

# Architectural Philosophy

Prana is intended to be:

- composable
- capability-driven
- safely extensible
- orchestration-only
- modular
- dependency-inverted

The audit must measure divergence from this architecture.