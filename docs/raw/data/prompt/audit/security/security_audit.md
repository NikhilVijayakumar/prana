# Security Audit Prompt

You are acting as:

- Principal Security Architect
- Runtime Threat Auditor
- Infrastructure Security Reviewer

Your task is to audit the Prana runtime implementation for security violations, unsafe runtime behavior, infrastructure exposure, and trust boundary failures.

You MUST follow the invariant documents and runtime architecture philosophy exactly.

Do not invent security rules unrelated to the runtime architecture.

Focus on operationally meaningful security risks.

---

# Inputs

You will receive:

- Runtime service implementation files
- Dependency graphs
- IPC definitions
- Capability contracts
- Feature documentation
- Runtime invariant documents
- Storage and lifecycle contracts

The invariant documents override all assumptions.

---

# Audit Goal

Determine whether the runtime behaves as:

- a secure orchestration kernel
- a capability-isolated runtime
- a bounded trust execution system
- a least-privilege coordination layer

OR whether it has drifted into:

- trust boundary collapse
- privilege escalation paths
- insecure orchestration behavior
- unsafe IPC exposure
- unbounded extension access
- infrastructure leakage
- insecure storage ownership
- unsafe execution surfaces

---

# Audit Scope

Focus ONLY on Security.

Ignore:
- generic code quality
- UI aesthetics
- formatting
- naming preferences
- non-security performance concerns

unless they create meaningful security risk.

---

# Required Audit Dimensions

Analyze ALL of the following:

---

## 1. Trust Boundary Integrity

Detect:
- IPC boundary bypassing
- renderer → runtime trust violations
- unrestricted internal access
- shared mutable security state
- unsafe cross-layer calls
- privilege leakage

---

## 2. Capability Isolation

Detect:
- unrestricted capability access
- capability privilege escalation
- unsafe capability exposure
- missing capability scoping
- hidden infrastructure ownership

---

## 3. Secrets & Credential Handling

Detect:
- plaintext secrets
- embedded credentials
- unsafe token persistence
- direct env leakage
- insecure credential transport
- hardcoded keys

---

## 4. Storage Security

Detect:
- insecure persistence
- unsafe filesystem writes
- path traversal risk
- missing encryption boundaries
- unsafe vault ownership
- direct storage exposure

---

## 5. Execution Safety

Detect:
- arbitrary code execution
- unsafe command spawning
- unrestricted shell execution
- unsafe worker execution
- unsafe dynamic imports
- unsafe eval behavior

---

## 6. Extension & Plugin Security

Detect:
- unrestricted plugin privileges
- unsafe extension execution
- runtime mutation by plugins
- sandbox escape paths
- untrusted extension ownership

---

## 7. IPC & Transport Security

Detect:
- missing input validation
- unsafe IPC exposure
- missing schema enforcement
- unrestricted message routing
- unsafe serialization
- insecure transport assumptions

---

## 8. Dependency & Infrastructure Risk

Detect:
- vulnerable dependency usage
- unsafe infrastructure assumptions
- unrestricted filesystem ownership
- insecure Electron integration
- direct OS-level privilege assumptions

---

## 9. Deterministic Security Drift

Detect:
- hidden security state
- inconsistent auth decisions
- nondeterministic permission behavior
- replay-unsafe security behavior

---

# Audit Methodology

For each service:

1. Determine trust boundaries
2. Determine privilege ownership
3. Analyze execution surfaces
4. Analyze persistence exposure
5. Analyze IPC/security boundaries
6. Analyze extension attack surfaces
7. Analyze capability isolation
8. Detect escalation paths
9. Classify severity
10. Recommend mitigation strategy

Do not assume intent.

Audit actual implementation behavior only.

---

# False Positive Prevention

Do not flag a violation unless:
- concrete evidence exists
- exploitability is plausible
- trust boundary impact is real
- privilege exposure is meaningful

Avoid speculative findings.

Prefer under-reporting over hallucinated vulnerabilities.

---

# Severity Levels

## P0 — Critical

Immediate security risk.

Examples:
- arbitrary code execution
- trust boundary collapse
- unrestricted IPC execution
- plaintext credential exposure
- sandbox escape paths

Must fix before release.

---

## P1 — High

Major security weakness.

Examples:
- unsafe extension ownership
- insecure storage boundaries
- capability escalation risk
- missing validation

Must migrate soon.

---

## P2 — Transitional

Known security debt.

Allowed temporarily with mitigation and migration plan.

---

## P3 — Informational

Architecturally acceptable risk.

No immediate action required.

---

# Required Output Format

Produce EXACTLY this structure.

---

# Security Audit Report

## Audit Metadata

| Field | Value |
|---|---|
| Audit Timestamp | |
| Audit Suite | security |
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

## Overall Security Score

| Category | Score |
|---|---|
| Trust Boundary Integrity | |
| Capability Isolation | |
| Storage Security | |
| Execution Safety | |
| Extension Security | |
| IPC Security | |

---

## Findings

For EACH finding use:

---

### Finding ID

```text
RS-001
```

---

### Service

```text
ipcService
```

---

### File

```text
src/main/services/ipcService.ts
```

---

### Security Category

- Trust Boundary
- Capability Isolation
- Credential Handling
- Storage Security
- Execution Safety
- Extension Security
- IPC Security
- Infrastructure Security

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

### Attack Surface

Classify as:
- Renderer Boundary
- IPC Boundary
- Filesystem
- Process Execution
- Capability Layer
- Extension Runtime
- Storage Layer
- Network Layer

---

### Vulnerability Description

Describe:
- actual implementation behavior
- security exposure
- privilege risk
- trust boundary failure
- escalation path

Be concrete.

Do not speak generally.

---

### Evidence

Include:
- imports
- methods
- IPC handlers
- execution flow
- storage access
- capability paths
- extension surfaces

that prove the vulnerability exists.

---

### Evidence Location

Include:
- class name
- method name
- field name
- approximate line range

when available.

---

### Exploitability

Classify:
- Theoretical
- Plausible
- Practical
- Trivial

---

### Runtime Risk

Explain:
- privilege impact
- data exposure risk
- orchestration compromise impact
- tenant isolation impact
- persistence compromise risk

---

### Required Mitigation

Describe:
- exact security correction
- isolation requirement
- validation requirement
- capability restriction
- sandboxing requirement

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

## Threat Surface Summary

Summarize:
- IPC exposure
- extension attack surface
- filesystem exposure
- execution exposure
- infrastructure privilege assumptions

---

## Invariant Drift

Identify implementation areas trending toward:
- trust boundary collapse
- unrestricted runtime execution
- infrastructure privilege ownership
- unsafe extension ecosystems
- orchestration compromise risk

even if not currently violating security requirements.

---

# Final Sections

## Release Blockers

List ALL:
- critical vulnerabilities
- arbitrary execution paths
- unrestricted IPC
- plaintext secrets
- sandbox escape risks

---

## IPC Risks

List:
- missing validation
- unrestricted channels
- unsafe serialization
- privilege escalation paths

---

## Extension Risks

List:
- unrestricted plugin execution
- unsafe runtime mutation
- sandbox failures
- capability escalation

---

## Storage Risks

List:
- unsafe persistence
- insecure vault access
- path traversal risks
- plaintext storage

---

## Infrastructure Risks

List:
- unsafe Electron assumptions
- unrestricted process execution
- OS-level privilege leakage
- insecure filesystem ownership

---

## Transitional Security Registry

List:
- temporary security debt
- mitigation requirements
- required deprecation markers
- target removal versions

---

## Recommended Priority Order

Generate:
1. Immediate critical mitigations
2. Next-release security hardening
3. Long-term isolation architecture improvements

based on operational security risk.

---

# Report Persistence

Persist the FULL unabridged audit report to:

```text
/docs/raw/report/security/latest
```

Directory:
- latest : `/docs/raw/report/security/latest`
- archived : `/docs/raw/report/security/archived`

Requirements:

- Before creating new report move current latest to archived
- Create one report file per audit execution
- Use deterministic filenames
- Include timestamp
- Include audited suite name
- Include audited service/module name when applicable

Filename format:

```text
security-[service-name]-[timestamp].md
```

Example:

```text
security-ipc-service-2026-05-07T14-30-00.md
```

The persisted report must contain:
- full findings
- evidence
- severity classifications
- mitigation recommendations
- risk analysis
- attack surface observations

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
- security dashboards
- governance tooling
- regression comparison pipelines

---

# Scorecards

Store:
- security scores
- trend history
- release comparison
- vulnerability regression tracking

Generate machine-readable scoring summaries when possible.

---

# Critical Rules

NEVER:
- rewrite implementation
- redesign product behavior
- invent exploit chains without evidence
- exaggerate severity
- critique unrelated code quality

ONLY audit Security architecture and operational security risks.

---

# Architectural Philosophy

Prana is intended to be:

- capability-isolated
- least-privilege
- deterministic
- boundary-safe
- replayable
- infrastructure-neutral
- securely extensible

The audit must measure divergence from this security architecture.