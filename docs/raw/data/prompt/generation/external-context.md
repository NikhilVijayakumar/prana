# External Context Generation — Astra for Prana

## Purpose

You are acting as:

- Repository Analyst
- Architecture Extraction Specialist
- Boilerplate Code Analyst
- Context Consolidation Specialist

Your responsibility is to generate:

```text
docs/raw/external-context/astra.md
```

from Astra's repository at:

```text
../astra
```

Astra is Prana's dependency (`"astra": "github:NikhilVijayakumar/astra"`). Prana uses Astra for:

- MVVM pattern (`useDataState`, `AppState`, `AppStateHandler`)
- Async state lifecycle (`StateType`, `AppState<T>`)
- Repository pattern (`ApiService`, `ServerResponse`, `HttpStatusCode`)
- Platform abstraction (IPC-based data access for Electron)

The generated document serves as architecture and boilerplate reference for Prana's AI systems.

---

## Core Principle

External Context exists for:

```text
Knowledge Transfer
```

not:

```text
Source Code Consumption
Runtime Consumption
Implementation Consumption
```

The generated document should answer:

- What architecture patterns does Astra provide?
- What is Astra's public API surface?
- What are Astra's architectural invariants?
- What boilerplate code patterns does Astra use?
- How does Prana consume Astra in its Electron runtime?
- What should Prana's AI understand before generating artifacts?

---

## Documentation-Only Rule (with Boilerplate Exception)

External Context generation must analyze documentation first.

Allowed Sources:

```text
../astra/docs/raw/architecture/**
../astra/README.md

../astra/docs/raw/architecture/core/**
../astra/docs/raw/architecture/invariants/**
../astra/docs/raw/architecture/integration-contracts/**
```

Boilerplate Exception — the generated document MAY include:

```text
src/lib.ts barrel export pattern
src/common/hooks/* hook signatures and patterns
src/common/repo/* repository implementation (ApiService, IpcService, ServerResponse, types)
src/common/state/* state type definitions
src/common/components/organisms/* AppStateHandler and AppStateContext patterns
```

These are not runtime consumption — they are boilerplate code patterns that Prana imports at runtime from Astra. Prana has a runtime dependency on Astra (`"astra": "github:NikhilVijayakumar/astra"`) and directly uses these exports. The generated document must document them accurately so Prana's AI can generate compliant consumer code.

Forbidden:

```text
../astra/src/** beyond the boilerplate exception
../astra/node_modules/**
../astra/test/**
```

---

## Dependency Scope Declaration

```text
Dependency Scope: Specific

Relevant Areas:
- MVVM Architecture Pattern
- State Management (AppState, StateType)
- Repository Pattern (ApiService, ServerResponse)
- Platform Abstraction (Electron IPC integration)
- Public API Surface
- Architectural Invariants
- Integration Contracts
- Boilerplate Code Patterns
```

---

## Repository Identity Verification

| Field | Value |
|-------|-------|
| Repository Name | Astra |
| Repository Purpose | Core architecture and pattern library for React/Electron applications |
| Repository Type | Shared Library |

---

## Discovery Phase 0 — Repository Discovery

### Goal

Understand Astra's identity and purpose.

Read:

```text
../astra/README.md
../astra/docs/raw/architecture/core/mvvm-pattern.md
../astra/docs/raw/architecture/core/state-management.md
../astra/docs/raw/architecture/core/repository.md
../astra/docs/raw/architecture/core/api-surface.md
```

Extract:

- Purpose
- Responsibilities
- Boundaries

---

## Discovery Phase 1 — Architecture Pattern Extraction

### Goal

Extract Astra's architecture patterns relevant to Prana.

Required Output:

| Pattern | Description | Key Types/Exports |
|---------|-------------|-------------------|
| MVVM | Model-View-ViewModel separation | useDataState, AppStateHandler, AppStateProvider |
| State Lifecycle | INIT → LOADING → COMPLETED/ERROR | StateType, AppState<T> |
| Repository | Data access abstraction | ApiService, ServerResponse<T>, HttpStatusCode |
| Platform Abstraction | Electron IPC / HTTP duality | IPC adapter pattern |
| Feature Structure | Canonical module layout | model/, repo/, hooks/, view/ |

---

## Discovery Phase 2 — API Surface Extraction

### Goal

Extract Astra's public API surface.

Required Matrix:

| Export | Category | Signature |
|--------|----------|-----------|
| useDataState | Hook | `useDataState<T>(initialState?): [AppState<T>, execute, setAppState]` |
| AppStateHandler | Component | `<AppStateHandler appState SuccessComponent emptyCondition errorMessage>` |
| AppStateHandlerProps | Type | Props interface for AppStateHandler component |
| AppStateProvider | Component | `<AppStateProvider value={Loading, Error, Empty}>` |
| AppStateContext | Context | `React.Context<AppStateComponents>` |
| AppStateComponents | Type | `{ Loading?: FC; Error?: FC<{message?}>; Empty?: FC }` |
| StateType | Enum | `INIT=0, LOADING=1, COMPLETED=2` |
| StateCode | Enum | Exported alongside StateType from AppState module |
| AppState | Interface | `{ state, isError, isSuccess, status, statusMessage, data }` |
| ApiService | Class | `new ApiService(baseURL, messages)` |
| IpcService | Class | `new IpcService(options?: { onError? }): implements ITransportService` — Electron IPC transport |
| ITransportService | Interface | `{ platform: Platform; onError?: (error: unknown) => void }` |
| Platform | Type | `'WEB' \| 'ELECTRON'` |
| ServerResponse | Class | `{ isError, isSuccess, status, statusMessage, data? }` — static `.success()` / `.error()` factories |
| HttpStatusCode | Enum | `SUCCESS=200, CREATED=201, ... IDLE=1000` |
| getApiService | Function | Singleton factory |
| getStatusMessage | Function | `(code: HttpStatusCode) => string` |

---

## Discovery Phase 3 — Invariant Extraction

### Goal

Extract Astra's architectural invariants.

Required Matrix:

| Invariant | Purpose | Key Rule |
|-----------|---------|----------|
| MVVM Separation | View never accesses Repository directly | ViewModel is the sole bridge |
| Repository Isolation | All external communication through Repository | No direct axios/fetch in hooks |
| Dependency Direction | Imports flow: hooks→state, hooks→repo | No circular deps |
| Public API Stability | Exports controlled through src/lib.ts | No internal leaks |
| Platform Neutrality | No platform-specific APIs in core | No window/process/fs |
| Deterministic Build | Reproducible artifacts | Lockfile, pinned versions |

---

## Discovery Phase 4 — Boilerplate Code Extraction

### Goal

Extract boilerplate code patterns Prana can reuse.

### Barrel Export Pattern

```typescript
// src/lib.ts
export { useDataState } from './common/hooks/useDataState';
export type { AppState } from './common/state/AppState';
export { StateType, StateCode } from './common/state/AppState';
export { default as AppStateHandler } from './common/components/organisms/AppStateHandler';
export type { AppStateHandlerProps } from './common/components/organisms/AppStateHandler';
export { AppStateProvider, AppStateContext } from './common/components/organisms/AppStateContext';
export type { AppStateComponents } from './common/components/organisms/AppStateContext';
export { ApiService } from './common/repo/ApiService';
export { getApiService } from './common/repo/apiServiceFactory';
export { HttpStatusCode, getStatusMessage } from './common/state/HttpStatusCode';
export { ServerResponse } from './common/repo/ServerResponse';
export { IpcService } from './common/repo/IpcService';
export type { ITransportService, Platform } from './common/repo/types';
```

### Feature Module Structure

```text
src/features/[feature-name]/
  model/    <feature>.types.ts
  repo/     <feature>Api.ts
  hooks/    use<Feature>.ts
  view/
    components/  <Name>Component.tsx
    pages/       <Feature>Page.tsx
```

### ViewModel Pattern

```typescript
import { useDataState } from 'astra';
export const useFeature = () => {
  const [state, execute] = useDataState<Data[]>();
  const load = () => execute(() => repo.list());
  return { state, load };
};
```

### Repository Pattern (HTTP)

```typescript
import { ApiService, ServerResponse } from 'astra';
const api = new ApiService('https://api.example.com', {});
export const repo = {
  list: (): Promise<ServerResponse<Data[]>> => api.get('/data'),
};
```

### Repository Pattern (Electron IPC)

```typescript
import { IpcService, ServerResponse } from 'astra';
const ipc = new IpcService();
export const repo = {
  list: (): Promise<ServerResponse<Data[]>> => ipc.invoke('resource:list'),
  get: (id: string): Promise<ServerResponse<Data>> => ipc.invoke('resource:get', { id }),
};
```

`IpcService` wraps `window.electronAPI.invoke` internally. Prana code must use `IpcService` — never call `window.electronAPI` directly in feature repositories.

### AppStateHandler Rendering

```typescript
<AppStateHandler
  appState={state}
  SuccessComponent={({ appState }) => <List data={appState.data} />}
  emptyCondition={(data) => data?.length === 0}
  errorMessage="Failed to load"
/>
```

---

## Discovery Phase 5 — Integration Contract Extraction

### Goal

Extract integration contracts relevant to Prana (Electron app).

Required Matrix:

| Contract | Purpose | Key Detail |
|----------|---------|------------|
| Electron IPC | Data access in Electron renderer | window.electronAPI.invoke |
| Provider Setup | AppStateProvider wiring at root | Wraps Loading/Error/Empty components |
| MVVM with IPC | ViewModel identical to browser pattern | Only repo changes |

---

## Cross Validation

Validate:

- Extracted signatures match actual exports
- Boilerplate patterns match source implementation
- Invariant rules are consistent across docs
- Integration contracts reflect actual usage
- Every section includes a `### Source Documentation` table with original repo path + summary
- Every evidence path uses the `../astra/` prefix (never bare filenames)

If evidence is insufficient:

Generate Open Question.

Never invent.

---

## Relative Path Rule

Every document reference must use a relative path from Prana's workspace root to the source file:

```text
Good:   ../astra/docs/raw/architecture/core/state-management.md
Bad:    docs/raw/architecture/core/state-management.md
Bad:    core/state-management.md
Bad:    state-management.md
```

Bare filenames or repo-relative paths without the `../repo-name/` prefix will cause an LLM to search locally in Prana's repo and find nothing. Always prefix with `../astra/` for Astra references.

---

## Documentation Summary Rule

Every evidence reference must include a 1-3 sentence summary of what the original document says. The summary must capture the document's core content and key rules, not merely restate its title.

Good:

```text
| Claim | Evidence | Documentation Summary |
|-------|----------|----------------------|
| MVVM separation rules | ../astra/docs/raw/architecture/invariants/mvvm-separation.md lines 6-8, 20-75 | Defines strict 3-layer separation: View is pure presentation (no data fetching), ViewModel orchestrates state (no JSX), Repository handles data access (no presentation logic). Each layer has may/may-not rules with forbidden patterns and detection heuristics. |
```

Bad:

```text
| Claim | Evidence | Documentation Summary |
|-------|----------|----------------------|
| MVVM separation rules | mvvm-separation.md | Documents MVVM separation |
```

---

## Traceability Rule

Every claim requires evidence from the source with a summary of what the source says.

Required Matrix (3 columns):

| Claim | Evidence | Documentation Summary |
|-------|----------|----------------------|
| {Claim} | ../astra/docs/raw/architecture/{path} | {1-3 sentence summary of the source document's content} |

---

## Output Location

```text
docs/raw/external-context/astra.md
```

---

## Required Document Structure

Each section must be present and must end with a `### Source Documentation` subsection containing a table of original source documents and their summaries.

### Overview

One paragraph. What Astra provides and why Prana depends on it.

### Repository Summary

Purpose, type, responsibilities from README.md.

### Dependency Scope

Declared scope and relevant areas.

### Architecture Patterns

Key patterns extracted from core architecture docs.

### Public API Surface

Complete export table with signatures.

### Architectural Invariants

All invariants with purpose and key rules.

### Boilerplate Code

Reusable code patterns: barrel export, feature structure, ViewModel, Repository (HTTP + IPC), AppStateHandler.

### Integration Contracts

Electron-specific patterns: IPC repository, provider setup, MVVM with IPC.

### AI Guidance

#### What to understand first

#### Important rules

#### Important boundaries

#### Common mistakes

#### Important assumptions

### Traceability Matrix

| Claim | Evidence | Documentation Summary |
|-------|----------|----------------------|

---

## Forbidden Behavior

The generator must never:

- Read ../astra/src/** beyond specified boilerplate patterns
- Read ../astra/node_modules/**
- Infer intent from test files
- Invent patterns not supported by documentation
- Override documented contracts with assumptions

---

## Success Criteria

The generated document is successful only when:

- Architecture patterns are extracted with key exports
- Public API surface is complete with signatures
- Invariants are documented with rules
- Boilerplate code patterns are provided
- Integration contracts are covered for Electron
- AI guidance is actionable
- Traceability is complete (3-column matrix with documentation summaries)
- All evidence paths use `../astra/` prefix (no bare filenames)
- Every major section has a `### Source Documentation` table with document paths and summaries
- Documentation summaries are substantive (1-3 sentences), not tautological
- Open Questions are recorded instead of assumed
