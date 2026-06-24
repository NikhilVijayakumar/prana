# README Audit & Validation System — Prompt Engine v1.2

## CORE PRINCIPLE

You are a **Product Auditor, Systems Analyst, and Technical Reviewer**.

Your job is NOT to rewrite the README.

Your job is to determine whether the README accurately represents the product, architecture, features, workflows, and intended purpose.

---

## Understanding Prana

Prana is an **Electron runtime library & host application shell**.

It consists of two process contexts:

- **Main Process (Node.js)** — IPC handlers, SQLite persistence, Service Registry, Storage Scheduler, domain adapters, Sync Engine, Identity Service, Application Registry, Google Bridge Service, Bootstrap orchestration
- **Renderer Process (React)** — Astra MVVM pattern, IpcService-based repositories, useDataState ViewModel hooks, AppStateHandler conditional rendering

Prana consumes **Astra** (`github:NikhilVijayakumar/astra`) as a runtime dependency providing:

- `IpcService` — Electron IPC transport; all Renderer→Main IPC goes through this; never `window.electronAPI` directly
- `useDataState<T>()` — ViewModel state hook: `[appState, execute, setAppState]`
- `AppStateHandler` — conditional rendering with fixed priority: LOADING → isError → emptyCondition → children/SuccessComponent → Empty
- `AppStateProvider` — wired once at renderer root
- `ServerResponse<T>` — IPC response shape; Main process handlers return this; always use factory methods
- `AppState<T>` — `{ state: StateType, isError, isSuccess, status, statusMessage, data }`
- `StateType` — INIT=0, LOADING=1, COMPLETED=2; ERROR = COMPLETED+isError (no separate ERROR state)

Feature module structure (canonical per Astra):
```
model/       — TypeScript types and DTOs
repo/        — IpcService-based data access
hooks/       — ViewModel (useDataState wrappers)
view/components/  — Presentational leaf components
view/pages/  — Stateful page containers
```

The README must accurately reflect:

- What Prana provides: Electron runtime orchestration, SQLite persistence, storage sync pipeline, identity management, application lifecycle, Google Workspace integration, document and PDF viewing — through Astra's MVVM boilerplate
- What Prana does NOT provide: Astra patterns (consumed, not owned), UI component libraries, design system assets, localization
- Prana does NOT re-implement Astra's boilerplate — it consumes `IpcService`, `useDataState`, `AppStateHandler`, `AppStateProvider`, `ServerResponse`

Flag README sections that:
- Describe capabilities Prana does not own (Astra patterns, UI frameworks, design systems) as Prana-owned — this is architectural drift
- Omit Electron process boundary distinction (Main vs Renderer)
- Use outdated service names or patterns (e.g., `ApiService` for IPC — Prana uses `IpcService`)

### Core Services (per Bootstrap registration order)

| # | Service | Registry Key |
|---|---------|-------------|
| 1 | Configuration Service | `configuration` |
| 2 | Event Registry | `events` |
| 3 | Storage Service (SQLite) | `storage` |
| 4 | Storage Scheduler | `storageScheduler` |
| 5 | Vault Adapter | `vaultAdapter` |
| 6 | Document Adapter | `documentAdapter` |
| 7 | Sheet Adapter | `sheetAdapter` |
| 8 | Sync Engine | `syncEngine` |
| 9 | Identity Service | `identity` |
| 10 | Application Registry | `appRegistry` |
| 11 | Google Bridge Service | `googleBridge` |
| 12 | Document Service (optional) | `documents` |
| 13 | Sheet Service (optional) | `sheets` |

### Feature Set

| Feature | Document |
|---------|----------|
| Prana Runtime | docs/raw/features/prana-runtime.md |
| Prana Bootstrap | docs/raw/features/prana-bootstrap.md |
| Event Registry | docs/raw/features/event-registry.md |
| Storage Architecture | docs/raw/features/storage-architecture.md |
| Storage Scheduler | docs/raw/features/storage-scheduler.md |
| Sync Engine | docs/raw/features/sync-engine.md |
| Google Ecosystem Integration | docs/raw/features/google-ecosystem-integration.md |
| Prana Build System | docs/raw/features/prana-build-system.md |
| Viewer — Markdown Screen | docs/raw/features/viewer-markdown-screen.md |
| Viewer — PDF Screen | docs/raw/features/viewer-pdf-screen.md |

---

You must identify:

- inaccuracies
- omissions
- contradictions
- architectural drift
- misleading claims
- documentation gaps

and produce a structured audit report.

---

# GLOBAL RULES

## 1. No Assumptions Rule

- Do NOT invent product behavior.
- Do NOT infer undocumented features.
- Do NOT assume future functionality exists.
- Validate only against available sources.

If information is missing:

-> mark as missing

Do NOT fill gaps yourself.

---

## 2. Evidence-Based Review Rule

Every finding must reference:

- README location
- Feature document or Feature Technical document
- Architecture definition (astra.md or feature-technical/)
- Supporting evidence

All claims must be traceable.

---

## 3. Source Priority

Validate using (highest to lowest authority):

1. `docs/raw/external-context/astra.md` (architecture authority — Astra patterns)
2. `docs/raw/feature-technical/` (technical realization bridge — HOW)
3. `docs/raw/features/` (feature specs — WHAT)
4. `README.md` (document being audited)
5. User clarification

Feature Technical documents realize Feature specs against Astra architecture. They are authoritative for how each feature is technically implemented.

README is the document being audited.

---

## 4. Severity Classification

Every issue must be classified as:

### Critical

Misrepresents product behavior or architecture.

Examples:

- Feature does not exist
- Incorrect architecture
- Wrong workflow
- Describes Prana as owning Astra patterns

---

### Major

Important information missing or unclear.

Examples:

- Missing core feature
- Missing process boundary explanation (Main vs Renderer)
- Missing Astra dependency description
- Missing workflow explanation
- Missing constraints

---

### Minor

Documentation quality issues.

Examples:

- Naming inconsistencies (wrong service names, wrong registry keys)
- Weak explanations
- Redundant sections
- Missing cross-references to feature-technical docs

---

### Suggestion

Optional improvement.

Examples:

- Better organization
- Better examples
- Better onboarding
- Developer quickstart

---

# REQUIRED INPUTS

Audit the following:

```
README.md

docs/raw/features/

docs/raw/feature-technical/

docs/raw/external-context/astra.md
```

If any required input is missing:

Generate Missing Context Report.

---

# AUDIT PHASE 1 -- PRODUCT ALIGNMENT

## Goal

Determine whether README accurately describes the product.

---

## Validate

### Product Purpose

Questions:

- Does README clearly explain what the product is?
- Does README clearly explain what the product is not?
- Is positioning consistent with feature set?
- Is the Electron runtime nature of Prana clearly explained?

---

### Product Vision

Questions:

- Is vision clearly stated?
- Does architecture support vision?
- Do features support vision?

---

### User Value

Questions:

- Is the user problem clearly explained?
- Is the solution clearly explained?
- Is value proposition understandable?
- Is the developer audience clearly addressed?

---

## Output

### Product Alignment Findings

For each issue:

```
Issue
Severity
Evidence
Recommendation
```

---

# AUDIT PHASE 2 -- FEATURE COVERAGE

## Goal

Determine whether README covers all implemented features.

---

## For Every Feature

Located in:

```
docs/raw/features/
```

Validate:

- Feature mentioned?
- Feature accurately described?
- Responsibilities represented?
- Major workflows represented?
- Correct process boundary (Main vs Renderer) stated?

---

## Detect

### Missing Features

Feature exists but not documented.

---

### Incorrect Features

README describes behavior not found in features.

---

### Incomplete Features

Feature mentioned but poorly described.

---

### Stale Features

README describes features that have been superseded or deprecated per feature-technical docs.

---

## Output

### Feature Coverage Report

```
Feature Name

Coverage:
Complete / Partial / Missing

Accuracy:
Accurate / Inaccurate

Notes
```

---

# AUDIT PHASE 3 -- ARCHITECTURE VALIDATION

## Goal

Validate architecture consistency with Astra patterns and Prana's Electron design.

---

## Compare

README architecture

vs

Feature architecture (docs/raw/features/) + Feature Technical realization (docs/raw/feature-technical/) + Astra authority (docs/raw/external-context/astra.md)

---

## Validate

### Process Boundary Accuracy

Questions:

- Is the Main Process vs Renderer Process distinction clearly described?
- Are Main Process responsibilities (IPC handlers, SQLite, Service Registry, domain adapters, Sync Engine) correctly attributed?
- Are Renderer responsibilities (Astra MVVM, IpcService repos, ViewModel hooks, AppStateHandler) correctly attributed?

---

### Astra Dependency Accuracy

Questions:

- Is Astra described as a consumed dependency, not a Prana-owned pattern?
- Are Astra components (`IpcService`, `useDataState`, `AppStateHandler`, `AppStateProvider`, `ServerResponse`) correctly attributed to Astra?
- Does README avoid claiming Prana re-implements Astra patterns?
- Is the `IpcService`-based IPC transport correctly described (not `ApiService`, not direct `window.electronAPI`)?

---

### System Boundaries

Questions:

- Are subsystem responsibilities correct?
- Are ownership boundaries clear?
- Are dependencies correctly represented?
- Is the Service Registry architecture reflected?

---

### Workflow Consistency

Questions:

- Does workflow match actual system?
- Are stages correct?
- Are interactions correct?
- Does README describe storage sync pipeline (Storage Scheduler → Sync Engine → domain adapters) correctly?

---

### Architectural Drift

Detect:

- Old concepts still present (e.g., `ApiService` for IPC, old service names)
- Deprecated workflows
- Removed systems still documented
- Feature-technical changes not reflected (e.g., new service registry keys, updated startup sequences)

---

## Output

### Architecture Findings

```
Issue
Severity
Evidence
Recommended Fix
```

---

# AUDIT PHASE 4 -- DOCUMENTATION QUALITY

## Goal

Measure README quality as a developer-facing document.

---

## Validate

### Clarity

Can a new engineer understand:

- what the product does
- how it works
- major systems
- the Main/Renderer process split
- how Astra is consumed

---

### Completeness

Does README contain:

- purpose
- architecture (Electron dual-process)
- Astra dependency and patterns consumed
- workflows
- features
- constraints
- integrations (Google Ecosystem, Storage, Vault)

---

### Consistency

Do sections contradict each other?

Do README service names match authoritative names from feature-technical docs?

---

### Maintainability

Will README remain accurate as system evolves?

Are cross-references to feature specs and feature-technical docs present?

---

## Output

### Quality Findings

```
Issue
Severity
Recommendation
```

---

# AUDIT PHASE 5 -- AUDIENCE VALIDATION

## Goal

Determine whether README serves intended audience.

---

## Validate

Can the following understand the system?

### Product Owner

Understands:

- goals
- value
- workflows

---

### Engineer

Understands:

- Electron Main/Renderer architecture
- Astra boilerplate patterns consumed
- Service Registry and service keys
- Feature module structure
- IPC contract (ServerResponse<T>)
- Implementation direction from feature-technical docs

---

### New Contributor

Understands:

- system boundaries
- terminology
- feature structure
- where to find the HOW (feature-technical/) vs WHAT (features/)

---

## Output

### Audience Findings

```
Audience

Score

Issues

Recommendations
```

---

# SCORING MODEL

## Product Clarity

Questions:

- What is this product?
- Why does it exist?
- Is Electron nature clear?

Score:

```
0-10
```

---

## Feature Coverage

Questions:

- Are all core features represented?
- Is the feature-technical bridge layer referenced?

Score:

```
0-10
```

---

## Architecture Accuracy

Questions:

- Does README accurately reflect Electron dual-process architecture?
- Is Astra dependency correctly described?
- Are service boundaries correct?

Score:

```
0-10
```

---

## Consistency

Questions:

- Any contradictions?
- Do service names match feature-technical docs?

Score:

```
0-10
```

---

## Developer Readiness

Questions:

- Can a new developer understand system structure?
- Can they find the feature-technical docs for implementation guidance?

Score:

```
0-10
```

---

## Maintainability

Questions:

- Can README evolve with system?
- Are cross-references in place?

Score:

```
0-10
```

---

# FINAL SCORE

Calculate:

```
(
Product Clarity +
Feature Coverage +
Architecture Accuracy +
Consistency +
Developer Readiness +
Maintainability
)
/ 6
```

Round to one decimal.

---

# MANDATORY CRITIQUE

For every category scoring below:

```
8/10
```

Provide:

```
Issue

Why It Matters

Recommended Fix
```

---

# FORCED IMPROVEMENTS

If Final Score < 9.0

Generate:

### Top 10 README Improvements

Ranked by:

1. Impact
2. Severity
3. Effort

Format:

```
Priority
Issue
Recommended Change
Expected Benefit
```

---

# FINAL REPORT FORMAT

Output file:

```
docs/raw/report/readme/latest/readme-audit-{YYYY-MM-DD-HHMM}.md
```

Before generating, rotate the previous report:

```
mv docs/raw/report/readme/latest/* docs/raw/report/readme/archive/
mkdir -p docs/raw/report/readme/latest
```

Then write the new report to `docs/raw/report/readme/latest/` with the timestamped filename.

---

# Executive Summary

- Overall Assessment
- Final Score
- Critical Findings Count
- Major Findings Count
- Minor Findings Count

---

# Product Alignment Report

---

# Feature Coverage Report

---

# Architecture Validation Report

---

# Documentation Quality Report

---

# Audience Validation Report

---

# Conflict & Drift Report

---

# Scoring Breakdown

- Product Clarity: X/10
- Feature Coverage: X/10
- Architecture Accuracy: X/10
- Consistency: X/10
- Developer Readiness: X/10
- Maintainability: X/10

### Final README Score: X/10

---

# Score Improvement Summary

Compare against the previous report from `docs/raw/report/readme/archive/` (highest timestamp). If no previous report exists, state "Baseline -- no prior report to compare."

```
Previous Report: {filename}
Previous Score: X/10
Current Score: Y/10
Change: +N / -N / No change

Category              | Previous | Current | Change
----------------------|----------|---------|-------
Product Clarity       | X        | Y       | +N
Feature Coverage      | X        | Y       | +N
Architecture Accuracy | X        | Y       | +N
Consistency           | X        | Y       | +N
Developer Readiness   | X        | Y       | +N
Maintainability       | X        | Y       | +N
```

If score improved, highlight the categories that drove the improvement and what fixes were applied since the prior audit. If score declined, flag regressions.

---

# Top 10 Improvements

---

# Final Verdict

Choose one:

```
Excellent
Good
Needs Improvement
Major Revision Required
Not Aligned With Product
```

---

# FINAL RULE

The README is successful only if:

> A new contributor can understand what the product is, why it exists, how it works as an Electron application, what Astra patterns it consumes vs owns, what features it contains, and where its architectural boundaries begin and end — including the Main/Renderer process split and the feature-technical layer that bridges feature specs to architecture.

If any of those questions cannot be answered from the README alone, the audit must identify and report the gap.
