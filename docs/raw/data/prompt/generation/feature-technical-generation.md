# Feature Technical Generation — Prompt Engine v3.0

## Purpose

You are acting as:

- Technical Designer
- Architecture Mapping Specialist
- Technical Documentation Author

Your responsibility is to produce a single Feature Technical document per Prana feature that bridges:

```
WHAT the feature must do   (docs/raw/features/{feature}.md)
        ↕
HOW it is technically realized  (docs/raw/feature-technical/{feature}.md)
```

using Astra's architecture patterns and boilerplate code as the realization substrate.

---

## Authority Hierarchy

| Level | Source | Defines |
|-------|--------|---------|
| 1 | `docs/raw/external-context/astra.md` | Architecture patterns, boilerplate contracts, invariants |
| 2 | `docs/raw/features/{feature}.md` | What this feature must do |
| 3 | `docs/raw/feature-technical/{feature}.md` | How this feature is technically realized (output of this prompt) |

Rules:
- Feature Technical realizes L1 + L2. It cannot redefine either.
- Conflicts between L1 and L2 → record as Open Questions. Never silently resolve.
- Missing architecture guidance → record as Open Questions. Never invent patterns.

---

## Understanding Prana

Prana is an **Electron runtime platform**. Every feature spans two processes:

```
Electron Main Process (Node.js)
  └── Prana Services (feature logic, orchestration, persistence)
  └── IPC Handlers (typed channels returning ServerResponse<T>)
  └── SQLite Runtime (operational state)

Electron Renderer Process (React)
  └── Feature Module (Astra canonical structure: model/ repo/ hooks/ view/)
  └── Repository Layer (IpcService from Astra — never window.electronAPI directly)
  └── ViewModel Layer (useDataState from Astra)
  └── View Layer (AppStateHandler from Astra + Prana UI components)
```

**Architecture and boilerplate code for the renderer process come entirely from Astra** (`docs/raw/external-context/astra.md`). Prana owns the main process runtime, IPC handlers, SQLite schema, and business logic.

### Astra Boilerplate Consumed by Prana

These are imported at runtime from `'astra'`. Prana must not re-implement them.

| Astra Export | Layer | Purpose in Prana |
|---|---|---|
| `IpcService` | Repository | Electron IPC transport — wraps window.electronAPI; returns ServerResponse\<T\> |
| `ServerResponse<T>` | Repository + IPC | Response contract — all IPC handlers must return this shape |
| `useDataState<T>` | ViewModel | Drives INIT→LOADING→COMPLETED lifecycle for async feature state |
| `AppStateHandler` | View | Renders correct UI slot based on AppState (Loading/Error/Empty/Success) |
| `AppStateProvider` | Root | Wires design system components once at renderer root |
| `AppState<T>` | ViewModel | State container — `state`, `isError`, `isSuccess`, `status`, `data` |
| `StateType` | ViewModel | INIT=0, LOADING=1, COMPLETED=2 — error is COMPLETED + isError |
| `StateCode` | ViewModel | IDLE=1000 — initial status before any IPC activity |
| `ITransportService` | Repository | Interface implemented by both IpcService and ApiService |
| `Platform` | Repository | `'WEB' \| 'ELECTRON'` — identifies transport layer |

---

## Inputs

```text
docs/raw/external-context/astra.md    ← L1: Architecture + boilerplate (read first)
docs/raw/features/{feature}.md        ← L2: Feature contract
```

## Output

```text
docs/raw/feature-technical/{feature}.md    ← single flat file
```

One feature spec → one Feature Technical document. No folder structures in output.

---

## Core Rules

### Architecture Rule

Feature Technical must realize Astra's architecture. It must not redefine it.

Map every renderer-side concern to the correct Astra pattern:
- Data access → `IpcService` repository
- Async state → `useDataState` ViewModel hook
- Rendering states → `AppStateHandler`
- Response contract → `ServerResponse<T>` from IPC handlers

If Astra's pattern does not cover a concern → record as Open Question.

### Feature Rule

Feature Technical must realize all feature requirements from L2.
It must not redefine responsibilities, workflows, business rules, or permissions.

### Boilerplate Rule

Prana does not own the boilerplate code for MVVM, repository, or state management.
These are consumed from Astra. The Feature Technical document must:
- Name which Astra exports apply to this feature's renderer-side realization
- Describe how Prana's main process IPC handlers return `ServerResponse<T>`
- Never describe re-implementing patterns Astra already provides

### IPC Contract Rule

Every Prana feature that has renderer-facing functionality must define its IPC channel contract:
- Channel names (format: `{feature}:{action}`)
- Direction (invoke, send, receive)
- Payload shape (input)
- Response shape (always `ServerResponse<T>`)
- Which process handles it (main → feature service)

---

## Forbidden Content

Feature Technical documents must NOT contain:

| Category | Examples | Belongs In |
|---|---|---|
| Source code | TypeScript, React, SQL | `src/**` |
| File paths | `src/features/vault/repo/...` | Implementation |
| Import statements | `import { useDataState } from 'astra'` | Implementation |
| UX / screens | Dialogs, drawers, forms, navigation | `docs/raw/feature-design/**` |
| Wireframes | Layouts, visual composition | `docs/raw/mockup/**` |
| Architecture redefinition | New patterns not in Astra | Not allowed |

**Exception:** Astra pattern names may be used in this document since they describe behavioral contracts, not source code. E.g., "data access uses the IpcService repository pattern" is acceptable. Actual TypeScript class instantiation syntax is not.

---

## Generation Phases

### Phase 0 — Read and Understand Inputs

Before generating anything, extract from L1 and L2:

**From `docs/raw/features/{feature}.md` (L2):**
- Feature purpose
- Responsibilities
- Non-responsibilities
- All defined workflows with triggers, steps, and outcomes
- All states and transitions
- Permissions and access rules
- Validation rules
- Failure scenarios
- Dependencies on other Prana features

**From `docs/raw/external-context/astra.md` (L1):**
- Which architecture patterns apply to this feature
- Which boilerplate exports are relevant (IpcService, useDataState, AppStateHandler, etc.)
- Applicable invariants (MVVM separation, repository isolation, runtime boundary)
- IPC contract rules (ServerResponse<T> shape, channel patterns)

Output:

```text
Feature: {name}
Version: {from feature doc}
Renderer-facing: Yes / No
Main-process-only: Yes / No

Applicable Astra Patterns:
- {pattern}: {why it applies to this feature}

Applicable Astra Exports:
- {export}: {how Prana uses it for this feature}

Applicable Astra Invariants:
- {invariant}: {enforcement point in this feature}
```

---

### Phase 1 — Main Process Design

**Goal:** Define how this feature is realized in the Electron main process.

Map each feature responsibility to its main process technical realization:

#### Service Architecture

For each responsibility from L2:
- Which Prana service or module owns it?
- What is its lifecycle? (singleton / per-request / scoped)
- What operational state does it manage in SQLite?
- What are its dependencies on other Prana services?

#### IPC Handler Design

For each renderer-facing operation this feature exposes:

| Channel | Direction | Input | Response Type | Handler Service |
|---------|-----------|-------|---------------|----------------|
| `{feature}:{action}` | invoke / send / receive | `{payload shape}` | `ServerResponse<{T}>` | `{service name}` |

Rules for IPC handlers:
- All `invoke` channels must return `ServerResponse<T>` shape
- `send` channels are fire-and-forget (no response)
- `receive` channels push events from main to renderer
- Main process handler failures must return `ServerResponse.error({status, statusMessage})` — never throw to renderer

#### SQLite Schema Design

For each domain this feature persists:

| Table | Purpose | Key Fields | Lifecycle |
|-------|---------|------------|-----------|
| `{table_name}` | {what it stores} | {primary key, key columns} | {when created/deleted} |

#### Startup and Teardown

- What does this service require before becoming operational?
- What must it clean up on shutdown?
- Does it participate in the Startup Orchestrator sequence?

---

### Phase 2 — Renderer Design (Astra MVVM)

**Goal:** Define the renderer-side feature module using Astra's canonical structure.

Only applicable if the feature has a renderer-facing surface. If main-process-only, state that and skip this phase.

#### Feature Module Layout

Describe the four Astra layers for this feature:

**Model Layer**
- What TypeScript types and DTOs does this feature require?
- Types mirror the data shapes returned by IPC handlers in `ServerResponse<T>.data`

**Repository Layer (IpcService)**
- What IPC channels does this feature's repository invoke?
- Each method wraps one IPC channel via IpcService
- Response type is always `Promise<ServerResponse<T>>`
- Direct `window.electronAPI` calls are forbidden (Astra repository isolation invariant)

**ViewModel Layer (useDataState)**
- What async operations does the feature ViewModel orchestrate?
- Each operation maps to `useDataState<T>` + `execute(() => repository.method())`
- How many separate `useDataState` instances does this feature require? (one per independent async concern)
- Which operations require optimistic state updates via `setAppState`?

**View Layer (AppStateHandler)**
- What states does the feature UI need to handle? (Loading, Error, Empty, Success)
- What is the `emptyCondition` for each list or optional data set?
- Does this feature override slot components per-instance or rely on `AppStateProvider` defaults?
- What does each rendering state display?

#### AppState Lifecycle Mapping

| Feature State | AppState Equivalent | Trigger | Rendering Outcome |
|---|---|---|---|
| {feature state} | INIT / LOADING / COMPLETED+isSuccess / COMPLETED+isError | {what triggers it} | {what renders} |

---

### Phase 3 — Responsibility Realization

**Goal:** Verify every L2 responsibility has a concrete technical owner.

Required matrix:

| L2 Responsibility | Process | Technical Owner | Astra Pattern | IPC Channel (if applicable) |
|---|---|---|---|---|
| {responsibility} | Main / Renderer | {service or module} | {IpcService / useDataState / AppStateHandler / N/A} | `{feature}:{action}` |

Every responsibility must have an owner. No responsibility may be orphaned.

---

### Phase 4 — Workflow Realization

**Goal:** Define the internal technical flow for each L2 workflow.

For each workflow defined in L2:

**Trigger:** {what starts this workflow — user action, IPC event, timer, system event}

**Main Process Flow:**
1. {step}: {what happens in main process}
2. {validation performed by which service}
3. {state change in SQLite}
4. {response built as ServerResponse<T>}

**Renderer Flow:**
1. {step}: {what triggers the ViewModel}
2. `useDataState` execute → calls repository
3. Repository → IpcService → IPC channel → main process
4. Response received as ServerResponse<T>
5. AppState transitions: INIT/LOADING → COMPLETED (isError or isSuccess)
6. AppStateHandler renders appropriate slot

**Failure Paths:**
- {failure}: {which layer detects it} → {how it propagates as ServerResponse.error}

---

### Phase 5 — State Realization

**Goal:** Map all L2 feature states to technical implementation.

Two layers of state to define:

#### Main Process State (Prana service state)

| Feature State | SQLite Representation | Service State Machine | Recovery Path |
|---|---|---|---|

#### Renderer State (Astra AppState)

| Feature State | StateType | isError | status | data | Rendering |
|---|---|---|---|---|---|
| {state} | INIT / LOADING / COMPLETED | true/false | {code} | {type or null} | {slot} |

State transitions: how does each main process state event propagate to renderer AppState via IPC?

---

### Phase 6 — Boilerplate Application Mapping

**Goal:** Declare precisely how Astra's boilerplate code is applied for this feature.

This is the explicit record of which Astra exports Prana uses for this feature and how.

Required matrix:

| Astra Export | Used For This Feature | How Applied | Invariant Enforced |
|---|---|---|---|
| `IpcService` | Yes / No | {what channels, what pattern} | Repository Isolation |
| `ServerResponse<T>` | Yes / No | {what T, what handlers return it} | IPC Contract Rule |
| `useDataState<T>` | Yes / No | {what T, how many instances, what operations} | MVVM Separation |
| `AppStateHandler` | Yes / No | {what states handled, slot overrides?} | MVVM Separation |
| `AppStateProvider` | Yes / No | {wired at root; feature does not set this up} | — |
| `AppState<T>` | Yes / No | {what T is for this feature's data} | — |
| `StateType` | Yes / No | {how INIT/LOADING/COMPLETED used in this feature} | — |
| `StateCode` | Yes / No | {IDLE as initial status} | — |

**Boilerplate Not Re-Implemented:**

Confirm that Prana's feature-technical design does NOT re-implement:
- IpcService (consumed, not re-implemented)
- useDataState (consumed, not re-implemented)
- AppStateHandler (consumed, not re-implemented)
- ServerResponse (consumed via factory methods, not re-implemented)

---

### Phase 7 — Permission Realization

**Goal:** Map L2 permissions to technical enforcement.

| L2 Permission | Enforcement Layer | Enforcement Point | Failure Behavior |
|---|---|---|---|
| {permission} | Main Process / IPC | {which service or handler validates} | {ServerResponse.error returned with which status} |

---

### Phase 8 — Validation Realization

**Goal:** Map all L2 validation rules to technical enforcement.

| L2 Rule | Validation Layer | When Validated | Failure Outcome |
|---|---|---|---|
| {rule} | Main / Renderer | {trigger point} | {ServerResponse.error / UI feedback} |

Validation ownership:
- Business rule validation → main process service (before persisting)
- Input shape validation → IPC handler entry point
- UI-level validation → renderer ViewModel (before dispatch)

---

### Phase 9 — Error Realization

**Goal:** Define how every L2 failure scenario propagates through the technical stack.

For each failure scenario in L2:

| L2 Failure | Detection Layer | ServerResponse Shape | AppState Result | Recovery Path |
|---|---|---|---|---|
| {failure} | Main / IPC / Renderer | `{ isError: true, status: {code}, statusMessage: '{msg}' }` | COMPLETED + isError | {retry / escalate / notify} |

Error propagation invariant: errors always flow as `ServerResponse.error(...)` from main → renderer. The renderer never receives raw exceptions. AppStateHandler always receives a valid AppState.

---

### Phase 10 — Integration Realization

**Goal:** Define all integration points with other Prana features and external systems.

#### Internal Prana Integrations

| Dependency Feature | Integration Point | Direction | Contract |
|---|---|---|---|
| {feature} | {what is consumed} | Prana→Feature / Feature→Prana | {type or event shape} |

#### IPC Surface

The complete IPC surface this feature exposes to the renderer:

| Channel | Type | Input | Output | Error Codes |
|---|---|---|---|---|
| `{feature}:{action}` | invoke/send/receive | `{shape}` | `ServerResponse<{T}>` | {codes} |

#### External System Integrations

| System | Integration | Protocol | Error Handling |
|---|---|---|---|
| {system} | {what this feature consumes} | {HTTP/IPC/SQLite/etc} | {how errors surface as ServerResponse} |

---

### Phase 11 — Ownership Mapping

**Goal:** Confirm unambiguous ownership for every responsibility.

| Responsibility | Owner | Process | Notes |
|---|---|---|---|
| {responsibility} | {Prana service / Astra pattern / External} | Main / Renderer / Both | |

No responsibility may have dual ownership. No responsibility may be unowned.

Explicitly declare what Astra owns vs what Prana owns for this feature:

| Concern | Owned By | Rationale |
|---|---|---|
| IPC transport | Astra (IpcService) | Boilerplate invariant |
| Response normalization | Astra (ServerResponse) | Boilerplate invariant |
| Async state machine | Astra (useDataState) | Boilerplate invariant |
| Rendering state router | Astra (AppStateHandler) | Boilerplate invariant |
| Business logic | Prana | Feature-specific |
| SQLite schema | Prana | Runtime responsibility |
| IPC handler implementation | Prana | Runtime responsibility |
| Feature-specific validation | Prana | Business rule |

---

### Phase 12 — Architecture Traceability

**Goal:** Verify every Astra architectural rule is honored in this feature's design.

| Astra Invariant | Feature Design Decision | Status | Evidence |
|---|---|---|---|
| MVVM Separation | {how this feature separates View/ViewModel/Repo} | Honored / Violated | {phase reference} |
| Repository Isolation | {IpcService used, no direct window.electronAPI} | Honored / Violated | Phase 6 |
| Runtime Boundary | {no Electron APIs in renderer layer} | Honored / Violated | Phase 2 |
| Dependency Direction | {no reverse imports across layers} | Honored / Violated | Phase 2 |
| IPC Contract | {all channels return ServerResponse<T>} | Honored / Violated | Phase 1 |

---

### Phase 13 — Feature Traceability

**Goal:** Verify every L2 requirement is realized in this document.

| L2 Requirement | Realized In Phase | Technical Owner | Status |
|---|---|---|---|
| {responsibility/workflow/state/rule} | {Phase N} | {owner} | Realized / Gap |

Every L2 requirement must appear. Gaps generate Open Questions.

---

## Required Document Structure

The generated Feature Technical document must contain these sections in order:

```markdown
# {Feature Name} — Technical Realization

**Version:** {from L2}
**Feature Spec:** docs/raw/features/{feature}.md
**Architecture Ref:** docs/raw/external-context/astra.md

---

## 1. Overview
{What this document covers and its authority position}

## 2. Feature Summary
{Purpose from L2 distilled into technical terms}
{Main-process-only / renderer-facing / both}

## 3. Architecture Mapping
{Which Astra patterns apply and why}

## 4. Main Process Design
### 4.1 Service Architecture
### 4.2 IPC Channel Contract
### 4.3 SQLite Schema
### 4.4 Startup and Teardown

## 5. Renderer Design (Astra MVVM)
### 5.1 Feature Module Layout
### 5.2 Repository Layer (IpcService)
### 5.3 ViewModel Layer (useDataState)
### 5.4 View Layer (AppStateHandler)
### 5.5 AppState Lifecycle Mapping

## 6. Responsibility Realization Matrix

## 7. Workflow Realization
{One subsection per L2 workflow}

## 8. State Realization
### 8.1 Main Process States
### 8.2 Renderer AppState Mapping

## 9. Boilerplate Application Mapping
{Required Astra export matrix}

## 10. Permission Realization

## 11. Validation Realization

## 12. Error Realization

## 13. Integration Realization
### 13.1 Internal Prana Integrations
### 13.2 IPC Surface
### 13.3 External Systems

## 14. Ownership Mapping
### 14.1 Responsibility Ownership
### 14.2 Astra vs Prana Ownership

## 15. Architecture Traceability Matrix

## 16. Feature Traceability Matrix

## 17. Open Questions
{Any L1/L2 conflicts, missing guidance, or ambiguous requirements}
```

---

## Open Questions Rule

Never invent missing information. Record these categories under Open Questions:

- Missing architecture guidance (Astra pattern doesn't cover this concern)
- Missing feature guidance (L2 doesn't specify this behavior)
- Ambiguous requirements (L2 is unclear)
- L1/L2 conflicts (Astra pattern contradicts feature requirement)
- IPC channels not defined in L2 but required for technical realization

---

## Output Location

```text
docs/raw/feature-technical/{feature}.md
```

Single flat file. Not a folder.

---

## Final Quality Gate

A Feature Technical document passes only when:

1. Every L2 responsibility is in the Responsibility Realization Matrix with an owner
2. Every L2 workflow is realized in Workflow Realization with main and renderer flows
3. Every L2 failure scenario is in Error Realization with a ServerResponse shape
4. Every Astra export used is in the Boilerplate Application Mapping matrix
5. Every Astra invariant is in the Architecture Traceability Matrix with status
6. IPC Channel Contract is complete — all renderer-facing channels defined with ServerResponse types
7. No source code, file paths, import statements, or UI design content appears in the document
8. No Astra boilerplate is re-implemented — all consumed patterns are named as consumed, not re-defined
9. Open Questions captures every gap rather than inventing answers
