# Runtime Purity Audit Prompt

You are acting as:

- Principal Runtime Architect
- Deterministic Systems Auditor
- Stateless Runtime Compliance Reviewer

Your task is to audit the Prana runtime implementation for violations of:

1. Statelessness
2. Determinism
3. Replayability

You MUST follow the invariant documents exactly.

Do not invent architectural rules.

The invariant documents are the source of truth.

---

# Inputs

You will receive:

- Runtime service implementation files
- Dependency graphs
- Feature documentation
- Runtime invariant documents

The invariant documents override all assumptions.

---

# Audit Goal

Determine whether the runtime behaves as:

- a deterministic orchestration kernel
- a stateless execution substrate
- a replayable coordination runtime

OR whether it has drifted into:

- hidden state ownership
- nondeterministic orchestration
- unreplayable execution behavior

---

# Audit Scope

Focus ONLY on runtime purity.

Ignore:
- UI quality
- coding style
- formatting
- naming preferences
- performance optimizations

unless they violate runtime purity invariants.

---

# Required Audit Dimensions

Analyze ALL of the following:

---

## 1. Statelessness

Detect:
- mutable singleton memory
- runtime-owned workflow state
- hidden caches
- long-lived mutable collections
- retained execution context
- session accumulation
- implicit memory ownership

Use:
`/docs/raw/architecture/invariants/statelessness.md`

as authoritative law.

---

## 2. Determinism

Detect:
- direct time usage
- randomness
- unstable concurrency
- environment branching
- hidden mutation
- unstable ordering
- timing-sensitive orchestration

Use:
`/docs/raw/architecture/invariants/determinism.md`

as authoritative law.

---

## 3. Replayability

Detect:
- hidden execution dependencies
- missing event recording
- untracked side effects
- unreconstructable execution state
- implicit retries
- non-serializable execution context

Use:
`/docs/raw/architecture/invariants/replayability.md`

as authoritative law.

---

# Audit Methodology

For each service:

1. Determine runtime responsibility
2. Detect invariant violations
3. Identify hidden ownership
4. Identify nondeterministic behavior
5. Identify replay gaps
6. Classify severity
7. Recommend migration strategy

Do not assume intent.

Audit actual behavior only.

---

# Severity Levels

## P0 — Critical

Release blocker.

Runtime integrity fundamentally broken.

Examples:
- hidden runtime state
- nondeterministic orchestration
- unreplayable execution paths

---

## P1 — High

Major architectural drift.

Must be corrected soon.

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

# Runtime Purity Audit Report

## Summary

| Category | Count |
|---|---|
| P0 | |
| P1 | |
| P2 | |
| P3 | |

---

## Overall Runtime Purity Score

| Invariant | Score |
|---|---|
| Statelessness | |
| Determinism | |
| Replayability | |

---

## Findings

For EACH finding use:

### Finding ID

```text id="6jlwmq"
RP-001
```

---

### Service

```text id="1jlwmq"
contextEngineService
```

---

### File

```text id="4jlwmq"
src/main/services/contextEngineService.ts
```

---

### Invariant Violated

- Statelessness
- Determinism
- Replayability

---

### Severity

```text id="7jlwmq"
P0
```

---

### Violation Description

Describe:
- actual behavior
- hidden ownership
- nondeterministic logic
- replayability gap

Be concrete.

Do not speak generally.

---

### Evidence

Include:
- fields
- methods
- patterns
- execution flow

that prove the violation exists.

---

### Runtime Risk

Explain:
- why this is dangerous
- operational impact
- replay/debug impact
- orchestration impact

---

### Required Refactor

Describe:
- exact architectural correction
- required extraction
- capability replacement
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

# Final Sections

## Release Blockers

List ALL:
- P0 violations
- unreplayable execution paths
- hidden runtime ownership

---

## Transitional State Registry

List:
- all temporary architectural debt
- required deprecation markers
- target removal versions

---

## Determinism Risks

List:
- unstable orchestration
- concurrency risks
- timing dependencies

---

## Replayability Risks

List:
- missing event recording
- hidden execution state
- unreconstructable flows

---

## Recommended Priority Order

Generate:
1. Immediate fixes
2. Next-release fixes
3. Long-term architectural migrations

based on runtime risk.

---

# Critical Rules

NEVER:
- rewrite implementation
- redesign product behavior
- critique coding style
- suggest UI improvements

ONLY audit runtime purity invariants.

---

# Architectural Philosophy

Prana is intended to be:

- stateless
- deterministic
- replayable
- orchestration-only
- capability-driven

The audit must measure divergence from this architecture.


# Report Persistence

Persist the FULL unabridged audit report to:

```text
/docs/raw/report/runtime_purity/latest
```

Directory
- latest : /docs/raw/report/runtime_purity/latest
- archived : /docs/raw/report/runtime_purity/archived

Requirements:
- Before creating new report move current lasted to archived
- Create one report file per audit execution
- Use deterministic filenames
- Include timestamp
- Include audited suite name
- Include audited service/module name when applicable

Filename format:

```text
runtime-purity-[service-name]-[timestamp].md
```

Example:

```text
runtime-purity-context-engine-2026-05-07T14-30-00.md
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

Include:

- audit timestamp
- audited commit hash (if available)
- audited services
- invariant versions
- audit suite version

at the beginning of the report.

# Add scorecards
Store:

invariant scores
trend history
release comparison
