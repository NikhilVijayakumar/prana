# Platform Neutrality Audit Prompt

You are acting as:

- Principal Runtime Architect
- Platform Neutrality Auditor
- Capability Isolation Reviewer

Your task is to audit the Prana runtime implementation for violations of:

1. Host Agnosticism
2. Storage Neutrality
3. Policy Neutrality

You MUST follow the invariant documents exactly.

Do not invent architectural rules.

The invariant documents are the source of truth.

---

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

- a host-independent orchestration kernel
- a storage-agnostic runtime
- a policy-neutral coordination substrate

OR whether it has drifted into:

- Electron/platform coupling
- storage/vendor assumptions
- business policy ownership
- infrastructure lock-in
- organizational semantics leakage

---

# Audit Scope

Focus ONLY on platform neutrality.

Ignore:
- UI quality
- styling
- formatting
- coding preferences
- performance concerns

unless they violate platform neutrality invariants.

---

# Required Audit Dimensions

Analyze ALL of the following:

---

## 1. Host Agnosticism

Detect:
- Electron ownership inside runtime core
- Node-specific orchestration assumptions
- browser/runtime coupling
- DOM/API usage in runtime core
- platform branching
- host lifecycle ownership
- framework-specific orchestration behavior

Use:
`/docs/raw/architecture/invariants/host-agnosticism.md`

as authoritative law.

---

## 2. Storage Neutrality

Detect:
- direct database usage
- filesystem ownership
- hardcoded paths
- vendor-specific storage logic
- schema ownership
- infrastructure-bound persistence
- storage topology assumptions

Use:
`/docs/raw/architecture/invariants/storage-neutrality.md`

as authoritative law.

---

## 3. Policy Neutrality

Detect:
- embedded business logic
- role semantics
- approval workflows
- organization assumptions
- tenant/business branching
- entitlement logic
- compliance ownership
- domain-coupled orchestration

Use:
`/docs/raw/architecture/invariants/policy-neutrality.md`

as authoritative law.

---

# Audit Methodology

For each service:

1. Determine runtime responsibility
2. Analyze platform assumptions
3. Analyze storage ownership
4. Analyze policy ownership
5. Detect infrastructure coupling
6. Detect organizational semantics
7. Detect host dependencies
8. Classify severity
9. Recommend migration strategy

Do not assume intent.

Audit actual implementation behavior only.

---

# False Positive Prevention

Do not flag a violation unless:
- concrete implementation evidence exists
- host coupling is provable
- policy ownership is explicit
- storage assumptions are operationally real

Avoid speculative findings.

Prefer under-reporting over hallucinated violations.

---

# Severity Levels

## P0 — Critical

Release blocker.

Core runtime neutrality is compromised.

Examples:
- Electron imports in runtime core
- direct SQLite ownership
- embedded business workflow logic
- organizational role ownership

---

## P1 — High

Major neutrality drift.

Must be corrected soon.

Examples:
- storage topology assumptions
- tenant-specific branching
- partial platform coupling

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

# Platform Neutrality Audit Report

## Audit Metadata

| Field | Value |
|---|---|
| Audit Timestamp | |
| Audit Suite | platform_neutrality |
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

## Overall Neutrality Score

| Invariant | Score |
|---|---|
| Host Agnosticism | |
| Storage Neutrality | |
| Policy Neutrality | |

---

## Findings

For EACH finding use:

---

### Finding ID

```text
PN-001
```

---

### Service

```text
runtimeConfigService
```

---

### File

```text
src/main/services/runtimeConfigService.ts
```

---

### Invariant Violated

- Host Agnosticism
- Storage Neutrality
- Policy Neutrality

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
- Host Ownership
- Storage Ownership
- Policy Ownership
- Infrastructure Ownership
- Organizational Ownership

---

### Violation Description

Describe:
- actual implementation behavior
- host/platform assumptions
- storage coupling
- business semantics leakage
- organizational coupling

Be concrete.

Do not speak generally.

---

### Evidence

Include:
- imports
- methods
- fields
- dependency paths
- orchestration flow
- persistence behavior

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
- portability impact
- infrastructure lock-in
- extensibility impact
- multi-tenant risk
- orchestration contamination

---

### Required Refactor

Describe:
- exact architectural correction
- capability extraction
- neutrality restoration
- adapter isolation
- ownership removal

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
- Electron ownership
- infrastructure lock-in
- vendor dependency
- policy contamination
- organization-aware orchestration

even if not currently violating invariants.

---

# Final Sections

## Release Blockers

List ALL:
- direct host coupling
- embedded business policy
- storage vendor ownership
- organizational semantics inside runtime core

---

## Host Dependency Risks

List:
- Electron assumptions
- Node-only behavior
- DOM/browser coupling
- platform branching

---

## Storage Risks

List:
- hardcoded persistence
- filesystem ownership
- vendor-specific logic
- topology assumptions

---

## Policy Risks

List:
- business workflow ownership
- tenant assumptions
- role semantics
- approval logic
- compliance branching

---

## Transitional Neutrality Registry

List:
- temporary infrastructure coupling
- policy debt
- platform leakage
- required deprecation markers
- target removal versions

---

## Recommended Priority Order

Generate:
1. Immediate neutrality corrections
2. Next-release infrastructure migrations
3. Long-term platform abstraction work

based on runtime risk.

---

# Report Persistence

Persist the FULL unabridged audit report to:

```text
/docs/raw/report/platform_neutrality/latest
```

Directory:
- latest : `/docs/raw/report/platform_neutrality/latest`
- archived : `/docs/raw/report/platform_neutrality/archived`

Requirements:

- Before creating new report move current latest to archived
- Create one report file per audit execution
- Use deterministic filenames
- Include timestamp
- Include audited suite name
- Include audited service/module name when applicable

Filename format:

```text
platform-neutrality-[service-name]-[timestamp].md
```

Example:

```text
platform-neutrality-runtime-config-2026-05-07T14-30-00.md
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

ONLY audit platform neutrality invariants.

---

# Architectural Philosophy

Prana is intended to be:

- host-agnostic
- storage-neutral
- policy-neutral
- orchestration-only
- capability-driven
- infrastructure-independent

The audit must measure divergence from this architecture.