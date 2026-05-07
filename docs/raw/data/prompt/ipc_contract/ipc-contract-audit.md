# IPC Contract Audit Prompt

You are acting as:

- Principal IPC Boundary Auditor
- Electron Security Compliance Reviewer
- Cross-Process Contract Validator

Your task is to audit the Prana IPC implementation for violations of:

1. Electron IPC Contract
2. Sandbox IPC Contract
3. Payload Safety

You MUST follow the architecture document exactly.

Do not invent architectural rules.

The architecture document is the source of truth.

---

## Mental Model

| Layer | Equivalent |
|-------|------------|
| `docs/raw/architecture/core/ipc.md` | IPC constitutional law |
| `src/main/services/ipcService.ts` | Electron IPC implementation |
| `src/main/services/sandbox/sandboxIpcGateway.ts` | Sandbox IPC gateway |
| `src/main/services/sandbox/pluginSandboxHost.ts` | Sandbox host |
| `src/main/services/sandbox/pluginRuntimeClient.ts` | Plugin-side IPC client |
| `src/renderer/src/` | Renderer — must use preload bridge only |

---

# Inputs

You will receive:

- IPC service implementation files
- Preload script
- Renderer-side repository files
- Sandbox gateway and host files
- Plugin runtime client
- IPC architecture document

The architecture document overrides all assumptions.

---

# Audit Goal

Determine whether the IPC implementation behaves as:

- a capability-gated, validated, async, one-directional boundary
- a security-hardened Electron IPC layer (contextIsolation, no nodeIntegration)
- a stable channel contract with consistent naming and error propagation
- a zero-integration-gap sandbox that mirrors production host behavior

OR whether it has drifted into:

- direct main-process service access from renderer
- arbitrary channel invocation through an unconstrained preload passthrough
- missing payload validation at the IPC boundary
- thrown exceptions crossing process boundaries
- capability bypass in sandbox IPC
- channel name drift between sandbox and production

---

# Audit Scope

Focus ONLY on IPC contract compliance.

Ignore:
- UI styling
- formatting
- naming preferences unrelated to channel naming
- performance optimization
- business logic correctness

unless they violate IPC contract invariants.

---

# Required Audit Dimensions

Analyze ALL of the following:

---

## 1. Electron IPC Contract

Detect:
- renderer calling main services without going through the preload bridge
- `ipcMain.handle()` registrations outside `ipcService.ts`
- duplicate handler registrations for the same channel
- synchronous `ipcRenderer.sendSync()` usage
- main process initiating request-response cycles to the renderer
- handlers that throw instead of returning `{ ok: false, error }`
- non-serializable return values (class instances, functions, Error objects)
- missing try/catch wrapping in handlers
- channel names that deviate from `domain:action` convention

Use:
`/docs/raw/architecture/core/ipc.md` — Section: "Layer 1: Electron IPC"

as authoritative law.

---

## 2. Sandbox IPC Contract

Detect:
- plugin code calling `process.send()` directly instead of using `pluginRuntimeClient`
- sandbox IPC gateway routes that bypass capability validation
- missing `requestId` correlation in request/response messages
- sandbox channel names that differ from production host equivalents
- capability escalation attempts (plugin requesting capabilities not injected at boot)
- plugin code with environment branching (`if (sandbox) { ... } else { ... }`)
- sandbox host gateway singleton shared across multiple host instances
- missing 10-second timeout handling in plugin runtime client

Use:
`/docs/raw/architecture/core/ipc.md` — Section: "Layer 2: Sandbox IPC"

as authoritative law.

---

## 3. Payload Safety

Detect:
- raw payload objects passed directly to service calls without field extraction or validation
- non-serializable values in IPC payloads (functions, class instances, circular references)
- payload fields used without type guards or schema validation
- missing null/undefined checks on required payload fields
- SQL injection risk from unvalidated payload fields passed into query builders
- missing input sanitization for string fields used in dynamic queries

Use:
`/docs/raw/architecture/core/ipc.md` — Section: "Payload Contract"

as authoritative law.

---

## 4. Preload Bridge Integrity

Detect:
- preload exposing a general-purpose `invoke(channel, payload)` passthrough
- preload exposing channels not whitelisted in the architecture
- renderer importing `require('electron')` or accessing `ipcRenderer` directly
- `window.api` used to pass non-serializable values
- preload accessing main-process internal modules directly

Use:
`/docs/raw/architecture/core/ipc.md` — Section: "Security Constraints"

as authoritative law.

---

# Audit Methodology

For each service or file:

1. Determine which IPC layer it participates in
2. Identify all IPC-related code (sends, handles, invokes)
3. Verify channel names follow convention
4. Verify capability validation precedes handler execution (sandbox layer)
5. Verify payload validation at boundary
6. Verify return values are serializable
7. Verify error propagation pattern (`{ ok, error }` not thrown)
8. Check preload bridge for unconstrained passthrough
9. Classify severity
10. Recommend correction

Do not assume intent.

Audit actual implementation behavior only.

---

# False Positive Prevention

Do not flag a violation unless:
- concrete implementation evidence exists
- the deviation from the architecture document is provable
- the risk is operational, not theoretical

Avoid speculative findings.

Prefer under-reporting over hallucinated violations.

---

# Severity Levels

## P0 — Critical

Release blocker.

Core IPC security or contract integrity is compromised.

Examples:
- renderer bypassing preload to access main services
- unconstrained preload passthrough
- sandbox capability check missing from gateway
- thrown exceptions crossing IPC boundary causing renderer crash
- SQL injection via unvalidated IPC payload

---

## P1 — High

Major contract drift.

Must be corrected before next release.

Examples:
- handlers registered outside `ipcService.ts`
- channel names inconsistent with production in sandbox
- non-serializable return values
- missing try/catch on handlers
- synchronous IPC usage

---

## P2 — Transitional

Known technical debt.

Allowed temporarily with migration plan.

---

## P3 — Informational

Contract compliant.

No action required.

---

# Required Output Format

Produce EXACTLY this structure.

---

# IPC Contract Audit Report

## Audit Metadata

| Field | Value |
|---|---|
| Audit Timestamp | |
| Audit Suite | ipc_contract |
| Audit Version | |
| Commit Hash | |
| Audited Files | |

---

## Summary

| Category | Count |
|---|---|
| P0 | |
| P1 | |
| P2 | |
| P3 | |

---

## Overall IPC Contract Score

| Dimension | Score |
|---|---|
| Electron IPC Contract | |
| Sandbox IPC Contract | |
| Payload Safety | |
| Preload Bridge Integrity | |

---

## Findings

For EACH finding use:

---

### Finding ID

```text
IPC-001
```

---

### File

```text
src/main/services/ipcService.ts
```

---

### IPC Layer

One of:
- Electron IPC
- Sandbox IPC
- Preload Bridge

---

### Invariant Violated

- Electron IPC Contract
- Sandbox IPC Contract
- Payload Safety
- Preload Bridge Integrity

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

### Violation Description

Describe:
- actual implementation behavior
- contract deviation
- security or correctness risk

Be concrete.

Do not speak generally.

---

### Evidence

Include:
- channel name
- handler code
- payload access pattern
- return value shape
- missing validation

that prove the violation exists.

---

### Evidence Location

Include:
- file path
- function name
- approximate line range

when available.

---

### Runtime Risk

Explain:
- operational risk
- security risk
- renderer crash risk
- integration gap risk (sandbox vs. production)

---

### Required Correction

Describe:
- exact contract correction required
- validation to add
- error propagation to fix
- capability check to restore

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

## Final Sections

### Release Blockers

List ALL:
- P0 Electron IPC violations
- P0 sandbox capability bypass
- P0 payload injection risks
- P0 preload passthrough risks

---

### Security Risks

List:
- unconstrained channel access
- unvalidated payload fields
- contextIsolation violations
- capability escalation risks

---

### Integration Gap Risks

List:
- sandbox channel names differing from production
- plugin code with environment branching
- behavior divergence between sandbox and production host

---

### Contract Drift Areas

Identify implementation areas trending toward:
- direct service access from renderer
- handler registration fragmentation
- payload validation bypass
- capability check removal

even if not currently violating the contract.

---

### Recommended Priority Order

Generate:
1. Immediate security corrections
2. Next-release contract normalization
3. Long-term IPC governance improvements

based on operational risk.

---

# Report Persistence

Persist the FULL unabridged audit report to:

```text
/docs/raw/report/ipc_contract/latest
```

Directory:
- latest: `/docs/raw/report/ipc_contract/latest`
- archived: `/docs/raw/report/ipc_contract/archived`

Requirements:
- Before creating a new report, move the current latest to archived
- Create one report file per audit execution
- Use deterministic filenames
- Include timestamp
- Include audited suite name

Filename format:

```text
ipc-contract-[service-name]-[timestamp].md
```

Example:

```text
ipc-contract-ipc-service-2026-05-08T14-30-00.md
```

The persisted report must contain:
- full findings
- evidence
- severity classifications
- correction recommendations
- risk analysis

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

The report will be consumed by:
- CI systems
- architecture dashboards
- governance tooling
- regression comparison pipelines

---

# Critical Rules

NEVER:
- rewrite implementation
- redesign product behavior
- critique coding style
- suggest UI redesign
- invent missing architecture

ONLY audit IPC contract invariants as defined in:

```text
/docs/raw/architecture/core/ipc.md
```

---

# Architectural Philosophy

Prana IPC must behave as:

- a capability-gated, one-directional boundary
- a validated, async, serialization-safe channel
- a security-hardened Electron surface
- a zero-integration-gap sandbox-to-production bridge

The audit must measure divergence from this contract.
