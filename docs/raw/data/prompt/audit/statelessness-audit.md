# Statelessness & MVVM Boundary Audit — Prompt Engine

## Purpose

You are acting as:

- State Management Auditor
- Side Effect Inspector
- Component Purity Reviewer

Your responsibility is to audit Prana's runtime services for statelessness violations against the documented invariants:

```text
docs/raw/external-context/astra.md  (MVVM patterns reference)
README.md                           (Prana statelessness rules)
```

You MUST follow the invariant and README statelessness rules exactly. Do not invent architectural rules. The referenced documents are the source of truth.

---

# Understanding Prana

Prana is an **Electron runtime library & host application shell** for intelligent agent applications. It hosts ~100+ services across main and renderer processes, providing orchestration, persistence, context management, security, and UI infrastructure.

Prana does NOT export a UI component library. Its public surface is runtime services organized in a layered architecture:

```text
src/main/
  common/             ← shared infrastructure (events, scheduling, config, logging, utilities)
  features/           ← business capabilities by domain (auth, vault, sync, communication,
  |                      agent, orchestration, sandbox, storage, context, registry,
  |                      governance, operations, intelligence, config)
  types/              ← TypeScript type definitions
  utils/              ← shared utility functions
  workers/            ← background worker processes
```

Prana uses **MVVM in the renderer process**, consuming Astra's patterns (`useDataState`, `AppStateHandler`, `ApiService`) as documented in `docs/raw/external-context/astra.md`.

Prana uses **IPC** for main-renderer communication. Services in the main process expose operations via typed IPC channels; the renderer invokes them through auto-generated service proxies.

Prana's statelessness rules: Services must not hold mutable domain state across requests. Service instances are scoped per-operation or injected as singletons with immutable configuration. Renderer components follow MVVM boundary rules — they receive data through props, emit events through callbacks, and delegate data fetching to ViewModel hooks.

---

# Scope

Primary input:

```text
src/main/common/**
src/main/features/**
src/renderer/**
```

Reference invariants: `docs/raw/external-context/astra.md` (MVVM patterns), `README.md` (Prana statelessness rules)

---

# Explicit Non-Goals

The Statelessness Audit MUST NOT:

- evaluate visual design and styling
- evaluate naming conventions
- evaluate feature completeness
- evaluate test coverage
- evaluate build correctness
- evaluate security

unless they directly indicate state management or MVVM boundary violations.

---

# Mental Model

| State Type              | Ownership            | Location                              | Allowed In Component |
|-------------------------|----------------------|---------------------------------------|----------------------|
| UI interaction state    | Component            | `useState(false)` for open/close/toggle | Yes               |
| Animation state         | Component            | `useState(0)` for progress, transition  | Yes               |
| Props-only rendering    | Component            | Data arrives via props                  | Yes               |
| Controlled component    | Component            | `value` + `onChange` pattern            | Yes               |
| Data state              | ViewModel            | `useDataState` in hooks                 | No                |
| Business logic          | ViewModel            | Computation, transformation             | No                |
| API calls               | ViewModel / Repository | `ApiService` in hooks or repo         | No                |
| Persistence             | ViewModel / Repository | `localStorage` in hooks               | No                |
| Hidden mutable state    | None                 | `useRef` for display values, module-level vars | No        |

---

# Audit Goal

Determine whether Prana's runtime services and renderer components behave as:

- stateless presentation units with no business logic, data fetching, or persistence
- pure rendering functions that receive data through props and emit events through callbacks
- properly layered ViewModel hooks that isolate all async state management from the View

OR whether they have drifted into:

- mutable state via `useState<T>` where T is a domain entity (not UI state)
- data fetching via `useEffect` + `axios` / `fetch`
- direct API service calls in component files
- persistence calls (`localStorage`, `sessionStorage`, `IndexedDB`) in component files
- business logic computation in JSX or event handlers
- hidden mutable state via `useRef` for display values
- domain utility imports in component scope
- repository imports inside component files
- module-level mutable variables

---

# Required Audit Dimensions

Analyze ALL of the following:

---

## 1. Mutable State

Detect:
- `useState<T>` where T is a domain entity (not boolean, number, or string for UI)
- `useState` objects with more than 3 fields (suggests domain data)
- `useReducer` in component files
- module-level `let` or `var` variables holding display state
- `useRef` used to store values that affect rendering
- class components with instance state

Allowed:
- [ ] `useState(false)` for open/close/toggle
- [ ] `useState(0)` for animation progress
- [ ] `useState<string>` for controlled input values
- [ ] Controlled component props (`value`, `onChange`)

Forbidden:
- [ ] No domain entity state in components
- [ ] No `useReducer` in components
- [ ] No module-level mutable state
- [ ] No `useRef` for display-affecting values
- [ ] No class component instance state

Severity mapping:
- P0: domain entity stored in `useState`, `useReducer` with domain logic, module-level mutable state
- P1: `useRef` for display values, `useState` with 3+ fields
- P2: complex UI state that borders on domain (documented)
- P3: UI interaction state only or no state at all

---

## 2. Hidden Side Effects

Detect:
- `useEffect` with data fetching (`axios`, `fetch`, `ApiService`)
- `useEffect` with persistence (`localStorage.setItem`)
- `useEffect` with DOM manipulation (`document.title`, `window.scrollTo`)
- `useEffect` with subscription setup without cleanup
- `useLayoutEffect` for visual side effects
- imperative handle methods that trigger data operations
- event handlers that call API services directly

Allowed:
- [ ] `useEffect` for event listener setup/teardown
- [ ] `useEffect` for animation coordination
- [ ] `useEffect` with empty deps for mount-only UI setup

Forbidden:
- [ ] No data fetching in `useEffect`
- [ ] No persistence in `useEffect`
- [ ] No DOM manipulation in `useEffect`
- [ ] No API calls in event handlers

Severity mapping:
- P0: `useEffect` with data fetching or persistence
- P1: `useEffect` with DOM manipulation, event handlers calling APIs
- P2: `useEffect` with side effects that are UI-only but complex
- P3: no hidden side effects

---

## 3. Persistence Leakage

Detect:
- `localStorage.getItem` / `setItem` / `removeItem` in component files
- `sessionStorage` access in component files
- `IndexedDB` access in component files
- cookies read/write in component files
- persistent state managed by components

Allowed:
- [ ] Persistence only in ViewModel hooks or Repository layer
- [ ] Persistence through abstracted storage service

Forbidden:
- [ ] No `localStorage` in components
- [ ] No `sessionStorage` in components
- [ ] No `IndexedDB` in components
- [ ] No cookie access in components

Severity mapping:
- P0: any persistence API call directly in component code
- P1: persistence through a helper imported by a component
- P2: documented persistence access with migration plan
- P3: no persistence in component layer

---

## 4. Runtime Coupling

Detect:
- direct `axios` import in component files
- `fetch()` calls in component files
- `ApiService` import in component files
- `WebSocket` instantiation in component files
- `XMLHttpRequest` in component files
- `import.meta.env` access for API URLs in components

Allowed:
- [ ] IO operations only in Repository layer
- [ ] API access through typed repository abstractions

Forbidden:
- [ ] No `axios`/`fetch` in components
- [ ] No `WebSocket` in components
- [ ] No XHR in components
- [ ] No env var access in components for API config

Severity mapping:
- P0: direct HTTP client import in component, `fetch()` in component
- P1: env var access for API URLs in component, `WebSocket` in component
- P2: documented runtime coupling with abstraction plan
- P3: no runtime coupling in component layer

---

# Finding Format

Each finding MUST include:

```
### Finding ID
SLESS-{nnn}

### File
{file-path}

### Category
Mutable State / Hidden Side Effects / Persistence Leakage / Runtime Coupling

### Invariant Violated
docs/raw/external-context/astra.md (MVVM) / README.md (Prana statelessness)

### Severity
P0 / P1 / P2 / P3

### Violation Type
{short description}

### Evidence
{exact code snippet}

### Invariant Rule Violated
astra.md (MVVM) §{Section} — {rule}, or README.md §{Section} — {Prana statelessness rule}

### Recommendation
{actionable remediation — move to ViewModel or Repository}

### Impact
{what breaks if not fixed — coupling, testability, reusability}
```

---

# Severity Classification

| Severity | Meaning                                          | Action                              |
|----------|--------------------------------------------------|-------------------------------------|
| P0       | Critical — component fetches or persists data    | Must extract to ViewModel/Repository |
| P1       | High — component has hidden side effects         | Must migrate next release           |
| P2       | Transitional — documented UI state complexity    | Allowed temporarily with plan       |
| P3       | Compliant — component is stateless               | No action required                  |

---

# Scoring Model

Score each dimension 0–10. Apply weights:

| Dimension            | Weight |
|----------------------|--------|
| Mutable State        | 30%    |
| Hidden Side Effects  | 30%    |
| Persistence Leakage  | 20%    |
| Runtime Coupling     | 20%    |

Formula:

```text
Statelessness Score =
(
  Mutable State × 0.30
  + Hidden Side Effects × 0.30
  + Persistence Leakage × 0.20
  + Runtime Coupling × 0.20
)
```

Start each dimension at 10. Deduct per finding in that dimension:

| Severity | Deduction per Finding |
|----------|-----------------------|
| P0       | −3.0                  |
| P1       | −1.5                  |
| P2       | −0.5                  |
| P3       | −0.0 (compliant)      |

Floor per dimension: 0.0.

---

# Final Assessment

| Score Range | Assessment              |
|-------------|-------------------------|
| 9.0–10.0    | Excellent               |
| 7.0–8.9     | Good                    |
| 5.0–6.9     | Needs Improvement       |
| 3.0–4.9     | Major Revision Required |
| 0.0–2.9     | MVVM Boundary Violated  |

---

# Required Report Structure

## 1. Executive Summary

```text
# Statelessness & MVVM Boundary Audit Report — Prana

Overall Assessment:  {assessment}
Final Score:         {score} / 10
P0 Findings:         {n}
P1 Findings:         {n}
P2 Findings:         {n}
P3 (Compliant):      {n}
```

Followed immediately by the Files Audited table:

| File | Role |
|------|------|
| `src/main/**` | Prana runtime services (main process) |
| `src/renderer/**` | Prana renderer components and hooks |
| `docs/raw/external-context/astra.md` | MVVM invariant authority |
| `README.md` | Prana statelessness rules |

## 2. Component Inventory

Summary of components and hooks reviewed with statelessness characteristics.

## 3. Mutable State Report

Findings per check. Compliance table at end.

## 4. Hidden Side Effects Report

Findings per check. Compliance table at end.

## 5. Persistence Leakage Report

Findings per check. Compliance table at end.

## 6. Runtime Coupling Report

Findings per check. Compliance table at end.

## 7. Findings Summary

All findings grouped by severity:

### P0 — Critical

| ID | File | Finding |
|----|------|---------|

### P1 — High

| ID | File | Finding |
|----|------|---------|

### P2 — Transitional

| ID | File | Finding |
|----|------|---------|

## 8. Transitional Violations

Known documented tech debt accepted for this release with rationale and migration plan.

## 9. Scoring Breakdown

| Dimension            | Raw Score | Weight | Weighted Score |
|----------------------|-----------|--------|----------------|
| Mutable State        |           | 30%    |                |
| Hidden Side Effects  |           | 30%    |                |
| Persistence Leakage  |           | 20%    |                |
| Runtime Coupling     |           | 20%    |                |

```text
Total Score: X.X / 10
```

## 10. Score Improvement Summary

Compare against the previous report from `docs/raw/report/statelessness/archive/` (highest timestamp). If no previous report exists, state "Baseline — no prior report to compare."

```text
Previous Report: {filename}
Previous Score:  X.X / 10
Current Score:   Y.Y / 10
Change:          +N.N / −N.N / No change
```

| Dimension            | Previous | Current | Change |
|----------------------|----------|---------|--------|
| Mutable State        | X        | Y       | +N     |
| Hidden Side Effects  | X        | Y       | +N     |
| Persistence Leakage  | X        | Y       | +N     |
| Runtime Coupling     | X        | Y       | +N     |

List resolved findings from previous report. List new findings not in previous report.

## 11. Final Verdict

```text
{Assessment} ({Score}/10)
```

Provide a concise statelessness and MVVM boundary health summary.

## 12. Audit Traceability

| Reference          | Location                                                                            |
|--------------------|-------------------------------------------------------------------------------------|
| Invariant Docs     | `docs/raw/external-context/astra.md`, `README.md`                                    |
| Components         | `src/renderer/**`                                                                    |
| Services           | `src/main/common/**`, `src/main/features/**`                                        |
| Audit Report       | `docs/raw/report/statelessness/latest/statelessness-audit-{timestamp}.md`           |
| Previous Report    | `docs/raw/report/statelessness/archive/{previous-filename}`                         |

---

# Report Rotation

Before writing the new report, rotate the previous report:

```text
mv docs/raw/report/statelessness/latest/* docs/raw/report/statelessness/archive/
mkdir -p docs/raw/report/statelessness/latest
```

---

# Output Location

```text
docs/raw/report/statelessness/latest/statelessness-audit-{timestamp}.md
```

Timestamp format: `YYYY-MM-DD-HHMM`

---

# Invariant Document Authority

When checking compliance:

- The invariant document is the source of truth
- For each finding, reference the specific Allowed or Forbidden pattern section from `docs/raw/external-context/astra.md` (MVVM) or `README.md` (Prana statelessness)
- Do NOT override invariant rules based on perceived convenience
- A component that receives data through props and renders without side effects is compliant even if the parent fetches data
- `useDataState` (from Astra, consumed by Prana) in hooks is the correct ViewModel location — its internal `mountedRef` guard and async `execute()` are not violations; they are documented ViewModel behaviors
