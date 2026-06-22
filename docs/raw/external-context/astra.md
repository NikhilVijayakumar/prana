# Astra — External Context for Prana

## Overview

Astra is a core architecture and pattern library for React and Electron applications that Prana depends on as a runtime dependency (`"astra": "github:NikhilVijayakumar/astra"`). It provides MVVM state orchestration via `useDataState`, a type-safe repository layer with `ApiService` (HTTP) and `IpcService` (Electron IPC), and UI state routing through `AppStateHandler`. Prana directly imports and uses Astra's boilerplate code at runtime — `IpcService` for all Electron IPC transport, `ServerResponse` for response normalization, `useDataState` for ViewModel state management, and `AppStateHandler` for conditional rendering. The generated document covers both the architecture patterns these exports implement and the boilerplate code itself so Prana's AI can generate correct consumer code.

### Source Documentation

| Document | Summary |
|----------|---------|
| `../astra/README.md` | Defines Astra as a core architecture and pattern library providing MVVM, async state management, and a type-safe API layer. Explicitly states what Astra is not: not a UI framework, not localization, not state persistence, not a design system, not a backend. |

---

## Repository Summary

| Field | Value |
|-------|-------|
| Repository Name | Astra |
| Repository Purpose | Core architecture and pattern library for React/Electron applications |
| Repository Type | Shared Library (private: false, GitHub-hosted) |
| Responsibilities | MVVM hooks, async state management, type-safe API layer, IpcService (Electron IPC abstraction), AppStateHandler (UI state routing) |
| Boundaries | Not a UI framework, not a localization library, not a state persistence library, not a design system, not a backend |

### Source Documentation

| Document | Summary |
|----------|---------|
| `../astra/README.md` | Lists all features: MVVM Architecture (useDataState), State Management (AppState INIT→LOADING→COMPLETED lifecycle), AppStateHandler (UI state router), API Repository (Axios-based ApiService), IPC Service (IpcService wraps window.electronAPI with ServerResponse normalization). Declares explicit non-responsibilities. |

---

## Dependency Scope

```
Dependency Scope: Specific

Relevant Areas:
- MVVM Architecture Pattern
- State Management (AppState, StateType, StateCode)
- Repository Pattern (ApiService, ServerResponse)
- Platform Abstraction (IpcService, ITransportService, Platform)
- Public API Surface
- Architectural Invariants
- Integration Contracts
- Boilerplate Code Patterns (imported at runtime by Prana)
```

---

## Architecture Patterns

| Pattern | Description | Key Types/Exports |
|---------|-------------|-------------------|
| MVVM | Model-View-ViewModel separation — ViewModel is the sole bridge between View and Repository | `useDataState`, `AppStateHandler`, `AppStateProvider` |
| State Lifecycle | INIT → LOADING → COMPLETED/ERROR; error is `COMPLETED + isError`, not a separate state | `StateType` (INIT=0, LOADING=1, COMPLETED=2), `AppState<T>`, `StateCode` |
| Repository (WEB) | HTTP data access abstraction — all HTTP communication through ApiService | `ApiService`, `ServerResponse<T>`, `HttpStatusCode` |
| Repository (ELECTRON) | IPC data access abstraction — all Electron IPC through IpcService; never use `window.electronAPI` directly | `IpcService`, `ServerResponse<T>`, `ITransportService`, `Platform` |
| Platform Abstraction | WEB/ELECTRON duality — only the repository changes per platform; ViewModel code is identical | `Platform = 'WEB' \| 'ELECTRON'`, `ITransportService` interface |
| Feature Structure | Canonical feature module layout with 4 layers | `model/`, `repo/`, `hooks/`, `view/components/`, `view/pages/` |

### Source Documentation

| Document | Summary |
|----------|---------|
| `../astra/docs/raw/architecture/core/mvvm-pattern.md` | Defines MVVM pattern: useDataState hook for ViewModel state, AppState\<T\> interface, canonical feature structure mapping (model→repo→hooks→view/pages), Electron IPC integration using IpcService with identical ViewModel code. |
| `../astra/docs/raw/architecture/core/state-management.md` | Documents stateless state management: StateType enum (INIT=0, LOADING=1, COMPLETED=2), StateCode (IDLE=1000), AppState\<T\> interface, HttpStatusCode enum, useDataState usage patterns, rules (always use useDataState for async, useState for UI state only). |
| `../astra/docs/raw/architecture/core/repository.md` | Documents Repository pattern: ApiService (Axios wrapper) for WEB, IpcService for ELECTRON, ServerResponse\<T\> contract with static factory methods (never construct raw), composed API calls, and rules (always use ServerResponse, never try/catch in repos). |
| `../astra/docs/raw/architecture/core/platform-abstraction.md` | Documents runtime-agnostic design: core must not depend on Electron/Node/browser APIs; IpcService is the service abstraction over window.electronAPI — repositories consume IpcService, never raw window.electronAPI. |
| `../astra/docs/raw/architecture/core/feature-structure.md` | Defines canonical feature module layout (model/, repo/, hooks/, view/components/, view/pages/), layer responsibilities with rules, data flow diagram, and consumer adaptation principles. |

---

## Public API Surface

All public exports flow through `src/lib.ts` only. Import path is always `from 'astra'`.

| Export | Category | Signature |
|--------|----------|-----------|
| `useDataState` | Hook | `useDataState<T>(customInitialState?): [AppState<T>, execute, setAppState]` |
| `AppStateHandler` | Component | `<AppStateHandler appState SuccessComponent? emptyCondition? errorMessage? loadingComponent? errorComponent? emptyComponent?>{children}</AppStateHandler>` |
| `AppStateHandlerProps` | Type | `{ appState: S; SuccessComponent?: FC<{appState: S}>; emptyCondition?: (data: T) => boolean; errorMessage?: string; children?: ReactNode; loadingComponent?: ReactNode; errorComponent?: ReactNode; emptyComponent?: ReactNode }` |
| `AppStateProvider` | Component | `<AppStateProvider value={{ Loading?, Error?, Empty? }}>` |
| `AppStateContext` | Context | `React.Context<AppStateComponents>` |
| `AppStateComponents` | Type | `{ Loading?: FC; Error?: FC<{message?: string}>; Empty?: FC }` |
| `StateType` | Enum | `INIT=0, LOADING=1, COMPLETED=2` |
| `StateCode` | Enum | `IDLE=1000` — initial status before any HTTP activity; exported separately from `HttpStatusCode` |
| `AppState` | Interface | `{ state: StateType; isError: boolean; isSuccess: boolean; status: HttpStatusCode \| StateCode; statusMessage: string; data: T \| null }` |
| `ApiService` | Class | `new ApiService(baseURL: string, literal: Record<string, string>, options?: { onError? }): { get<T>, post<T>, put<T>, delete<T> }` |
| `IpcService` | Class | `new IpcService(options?: { onError?: (error: unknown) => void })` — methods: `invoke<T>(channel, ...args): Promise<ServerResponse<T>>`, `send(channel, ...args): void`, `receive<T>(channel, callback): () => void` |
| `ITransportService` | Interface | `{ readonly platform: Platform; onError?: (error: unknown) => void }` — implemented by both `ApiService` and `IpcService` |
| `Platform` | Type | `'WEB' \| 'ELECTRON'` |
| `ServerResponse` | Class | Static factories: `ServerResponse.success({ status, statusMessage, data })`, `ServerResponse.error({ status, statusMessage })` — fields: `isError`, `isSuccess`, `status`, `statusMessage`, `data?` |
| `HttpStatusCode` | Enum | `SUCCESS=200, CREATED=201, BAD_REQUEST=400, UNAUTHORIZED=401, NOT_FOUND=404, INTERNAL_SERVER_ERROR=500, INTERNET_ERROR=0` |
| `getApiService` | Function | `getApiService(baseUrl: string, literal: Record<string, string>, options?): ApiService` — singleton factory keyed by baseURL |
| `getStatusMessage` | Function | `getStatusMessage(code: HttpStatusCode, literal: Record<string, string>): string` |

### Source Documentation

| Document | Summary |
|----------|---------|
| `../astra/docs/raw/architecture/core/api-surface.md` | Documents public API contract: src/lib.ts controls root entry exports; IpcService and ITransportService/Platform are part of the Repository layer (ELECTRON); UI/theming exports belong to design system packages (Prati), never in astra; barrel export rules. |
| `../astra/README.md` lines 195-214 | Lists all available exports with descriptions: useDataState, AppState/StateType/StateCode, AppStateHandler/Provider/Context/Components, getApiService/ApiService/ServerResponse/HttpStatusCode/getStatusMessage, IpcService, ITransportService/Platform. |
| `../astra/src/lib.ts` | Authoritative barrel export — the single source of truth for all public exports. Exports IpcService from `./common/repo/IpcService` and ITransportService/Platform from `./common/repo/types`. |

---

## Architectural Invariants

| Invariant | Purpose | Key Rule |
|-----------|---------|----------|
| MVVM Separation | View never accesses Repository directly | ViewModel is the sole bridge; View has no data fetching, ViewModel has no JSX, Repository has no presentation logic |
| Repository Isolation | All external communication through Repository and Astra service abstractions | No `axios`/`fetch`/`window.electronAPI` in hooks or views; WEB uses `ApiService`, ELECTRON uses `IpcService` |
| Dependency Direction | Imports flow: hooks→state, hooks→repo | No circular deps; no feature-to-feature internal imports; shared types go in `common/` |
| Public API Stability | Exports controlled through `src/lib.ts` | Only symbols exported through declared entry points are public; no internal leaks; semver-compliant |
| Runtime Boundary | No platform-specific APIs in core Astra code | No `ipcRenderer`/`ipcMain`/`BrowserWindow` in Astra core; IpcService delegates to `window.electronAPI` without importing Electron |
| Deterministic Build | Reproducible artifacts | Lockfile committed; no timestamps/random IDs in output; no environment-dependent build behavior |
| Dependency Safety | Minimal, auditable, version-pinned deps | No abandoned packages; no wildcard versions; no unused deps; MIT/Apache/BSD licenses only |
| Target Consistency | Identical ViewModel code across WEB and ELECTRON | Only the repository import differs between platforms; useDataState API and AppState transitions are identical |

### Source Documentation

| Document | Summary |
|----------|---------|
| `../astra/docs/raw/architecture/invariants/mvvm-separation.md` | Defines may/may-not rules per MVVM layer with forbidden patterns, allowed patterns, detection heuristics, refactoring guidance, and severity levels. View is pure presentation, ViewModel orchestrates state (no JSX, no UI imports), Repository provides data access (no presentation logic). |
| `../astra/docs/raw/architecture/invariants/repository-isolation.md` | All external communication must flow through Repositories built on ApiService (WEB) or IpcService (ELECTRON); no direct use of axios/fetch/window.electronAPI in Repository files; Views must never import Repositories; all Repository responses must be ServerResponse\<T\>. |
| `../astra/docs/raw/architecture/invariants/runtime-boundary.md` | Astra core never imports Electron (ipcRenderer), Node.js (fs/path/process), or raw browser IPC APIs; IpcService is the abstraction layer that wraps window.electronAPI; platform-specific code lives in consumer-managed adapters. |
| `../astra/docs/raw/architecture/invariants/public-api-stability.md` | Only symbols exported through src/lib.ts are public; no deep imports into build output; deprecation cycle before breaking changes; semver rules enforced. |
| `../astra/docs/raw/architecture/invariants/deterministic-build.md` | Build must produce identical output from identical source; lockfile committed; no timestamps/random IDs; env vars with documented defaults. |
| `../astra/docs/raw/architecture/invariants/dependency-safety.md` | Dependencies must be auditable, minimal, actively maintained, version-pinned; no abandoned packages/wildcard versions/unused deps/high-severity CVEs; lockfile committed. |
| `../astra/docs/raw/architecture/core/hooks.md` lines 169-199 | Target Consistency: the ViewModel hook is structurally identical for WEB and ELECTRON — only the repository import (tasksIpc vs usersApi) differs; AppState transitions and useDataState API are identical across both targets. |

---

## Boilerplate Code

Prana imports the following boilerplate code at runtime from Astra. All patterns are derived from `../astra/src/lib.ts` and the allowed src directories.

### Barrel Export Pattern

```typescript
// ../astra/src/lib.ts — authoritative public API
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

```
src/features/[feature-name]/
  model/           <feature>.types.ts         — TypeScript types and DTOs only; no logic
  repo/            <feature>Ipc.ts            — Data access via IpcService (ELECTRON)
  hooks/           use<Feature>.ts            — ViewModel custom hooks wrapping useDataState
  view/
    components/    <Name>Component.tsx        — Presentational leaf components (props only)
    pages/         <Feature>Page.tsx          — Stateful page containers composing hooks + UI
```

### ViewModel Pattern

```typescript
import { useDataState } from 'astra';
import { featureIpc } from '../repo/featureIpc';

export const useFeature = () => {
  const [appState, execute] = useDataState<Data[]>();
  const load = () => execute(() => featureIpc.list());
  return { appState, load };
};
```

### Repository Pattern — ELECTRON (IpcService)

```typescript
import { IpcService, ServerResponse } from 'astra';
import { Data } from '../model/feature.types';

const ipc = new IpcService();

export const featureIpc = {
  list: (): Promise<ServerResponse<Data[]>> => ipc.invoke('feature:list'),
  get: (id: string): Promise<ServerResponse<Data>> => ipc.invoke('feature:get', { id }),
  create: (payload: Partial<Data>): Promise<ServerResponse<Data>> => ipc.invoke('feature:create', payload),
  delete: (id: string): Promise<ServerResponse<boolean>> => ipc.invoke('feature:delete', { id }),
};
```

`IpcService` wraps `window.electronAPI.invoke` internally. Prana code must always use `IpcService` — never call `window.electronAPI` directly in feature repositories. `IpcService` normalizes all responses to `ServerResponse<T>` and handles `window.electronAPI` unavailability gracefully (returns `status: 500`).

### Repository Pattern — WEB (ApiService)

```typescript
import { ApiService, ServerResponse } from 'astra';
import { Data } from '../model/feature.types';

const api = new ApiService('https://api.example.com', {
  internal_server_error: 'Server unavailable',
});

export const featureApi = {
  list: (): Promise<ServerResponse<Data[]>> => api.get('/data'),
  get: (id: string): Promise<ServerResponse<Data>> => api.get(`/data/${id}`),
};
```

### AppStateHandler — Full Props Signature

```typescript
import { AppStateHandler } from 'astra';

// Via SuccessComponent prop (receives typed appState)
<AppStateHandler
  appState={appState}
  SuccessComponent={({ appState }) => <List data={appState.data} />}
  emptyCondition={(data) => data?.length === 0}
  errorMessage="Failed to load"
/>

// Via children (simpler, appState.data accessed externally)
<AppStateHandler
  appState={appState}
  emptyCondition={(data) => data?.length === 0}
  errorMessage="Failed to load"
>
  <List data={appState.data} />
</AppStateHandler>

// Per-instance slot overrides (override AppStateProvider context)
<AppStateHandler
  appState={appState}
  loadingComponent={<Spinner />}
  errorComponent={<ErrorBanner message="Failed to load." />}
  emptyComponent={<EmptyList />}
>
  <List data={appState.data} />
</AppStateHandler>
```

**Rendering priority (fixed order):**
1. `state === LOADING` → Loading component
2. `isError || status === 0 (INTERNET_ERROR)` → Error component
3. `isSuccess && data !== null && emptyCondition(data) === true` → Empty component
4. `isSuccess && data !== null && children` → children
5. `isSuccess && data !== null && SuccessComponent` → SuccessComponent
6. Fallback (INIT / no data) → Empty component

### AppStateHandler Props Type

```typescript
// From ../astra/src/common/components/organisms/AppStateHandler.tsx
export interface AppStateHandlerProps<T, S extends AppState<T> = AppState<T>> {
  appState: S;
  SuccessComponent?: FC<{ appState: S }>;
  emptyCondition?: (data: T) => boolean;
  errorMessage?: string;
  children?: ReactNode;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
  emptyComponent?: ReactNode;
}
```

### AppState and StateType

```typescript
// From ../astra/src/common/state/AppState.ts
export enum StateType {
  INIT = 0,
  LOADING = 1,
  COMPLETED = 2,
}

export interface AppState<T> {
  state: StateType;
  isError: boolean;
  isSuccess: boolean;
  status: HttpStatusCode | StateCode;
  statusMessage: string;
  data: T | null;
}

// StateCode exported separately
export enum StateCode {
  IDLE = 1000,  // initial status before any HTTP activity
}
```

### IpcService Full Signature

```typescript
// From ../astra/src/common/repo/IpcService.ts
export class IpcService implements ITransportService {
  readonly platform: Platform = 'ELECTRON';
  onError?: (error: unknown) => void;

  constructor(options?: { onError?: (error: unknown) => void });

  // Request/response — returns ServerResponse<T>
  invoke<T>(channel: string, ...args: unknown[]): Promise<ServerResponse<T>>;

  // Fire-and-forget — no response
  send(channel: string, ...args: unknown[]): void;

  // Push events — returns unsubscribe function
  receive<T>(channel: string, callback: (data: T) => void): () => void;
}
```

### IpcService Error Normalization

| Cause | `status` in ServerResponse |
|-------|---------------------------|
| IPC handler returns error | Status from the response |
| `window.electronAPI` unavailable | `500` (INTERNAL_SERVER_ERROR) |
| Unexpected exception | `500` (INTERNAL_SERVER_ERROR) |

### Composed Repository Operation

```typescript
export const OrderRepo = {
  getFullOrder: async (orderId: string): Promise<ServerResponse<FullOrder>> => {
    const order = await ipc.invoke<Order>(`orders:get`, { id: orderId });
    if (order.isError) return order;
    const items = await ipc.invoke<OrderItem[]>(`orders:items`, { orderId });
    if (items.isError) return items;
    return ServerResponse.success({
      status: 200,
      statusMessage: 'OK',
      data: { ...order.data, items: items.data },
    });
  },
};
```

### Optimistic Update Pattern

```typescript
const deleteItem = async (id: string) => {
  setListState((prev) => ({ ...prev, data: prev.data?.filter((i) => i.id !== id) ?? null }));
  await executeDelete(() => featureIpc.delete(id));
  if (deleteState.isError) executeList(() => featureIpc.list());
};
```

### Source Documentation

| Document | Summary |
|----------|---------|
| `../astra/src/lib.ts` | Authoritative barrel export defining all public symbols. IpcService exported from `./common/repo/IpcService`; ITransportService/Platform from `./common/repo/types`. This is the ground truth for import paths and available exports. |
| `../astra/src/common/repo/IpcService.ts` | IpcService implementation: wraps window.electronAPI; invoke() returns ServerResponse\<T\> normalizing both success and errors; send() is fire-and-forget; receive() registers push callbacks and returns unsubscribe function; gracefully handles window.electronAPI unavailability. |
| `../astra/src/common/components/organisms/AppStateHandler.tsx` | AppStateHandler implementation: fixed rendering priority (LOADING→error→emptyCondition→children→SuccessComponent→fallback); slot props (loadingComponent/errorComponent/emptyComponent) override AppStateContext; uses generics `<T, S extends AppState<T>>`. |
| `../astra/src/common/state/AppState.ts` | AppState interface definition with StateType enum (INIT/LOADING/COMPLETED) and StateCode re-export (IDLE=1000); `status` field typed as `HttpStatusCode \| StateCode`. |
| `../astra/docs/raw/architecture/core/hooks.md` | Complete useDataState API: returns [appState, execute, setAppState]; execute() drives lifecycle; setAppState() for optimistic updates/manual resets; strongly recommends wrapping in ViewModel hooks; ELECTRON ViewModel pattern is structurally identical to WEB. |
| `../astra/docs/raw/architecture/core/repository.md` | Repository pattern with ApiService (get/post/put/delete), IpcService (invoke/send/receive), ServerResponse\<T\> contract, single-call and composed-call patterns, rules. |
| `../astra/docs/raw/architecture/core/feature-structure.md` | Canonical feature layout with ELECTRON IpcService repository example (`tasksIpc` using `new IpcService()`); layer rules; data flow diagram. |
| `../astra/docs/raw/architecture/core/state-management.md` | AppState\<T\> interface, StateType enum, StateCode (IDLE=1000), AppStateHandler rendering priority, manual state handling patterns, HttpStatusCode values. |
| `../astra/docs/raw/architecture/invariants/boilerplate-ownership.md` | Declares Astra owns all boilerplate: ApiService, IpcService, base repository templates, ViewModel templates, hook templates. Applications (including Prana) must not re-implement these — they consume Astra's implementations. |

---

## Integration Contracts

| Contract | Purpose | Key Detail |
|----------|---------|------------|
| Electron IPC via IpcService | Data access in Electron renderer — always use IpcService, never window.electronAPI directly | `new IpcService(); ipc.invoke('channel:action', payload)` — IpcService wraps and normalizes window.electronAPI |
| IPC Response Shape | IPC handlers (main process, Prana-owned) must return ServerResponse\<T\> | `{ isError: false, isSuccess: true, status: 200, statusMessage: 'OK', data: T }` |
| Provider Setup | AppStateProvider wiring at root renderer | Wraps Loading/Error/Empty design system components once at app root; all `AppStateHandler` instances auto-use them |
| MVVM with IPC | ViewModel code identical to browser pattern | Only the repository import differs (`featureIpc` vs `featureApi`); useDataState API and state transitions are identical |
| Push Events via receive() | Real-time push from main process | `ipc.receive('channel', callback)` — returns unsubscribe function; call on unmount |

### Source Documentation

| Document | Summary |
|----------|---------|
| `../astra/docs/raw/architecture/integration-contracts/electron.md` | Electron setup with Vite, AppStateProvider wiring at root with design system components, IPC repository pattern using `new IpcService()` and `ipc.invoke()`, IPC handler must return ServerResponse\<T\>, best practices (context isolation, preload scripts, never import Electron in renderer). |
| `../astra/src/common/repo/IpcService.ts` | IpcService.invoke() delegates to window.electronAPI.invoke(); if result is already a ServerResponse it passes through; otherwise wraps raw result in ServerResponse.success(); exceptions normalized to ServerResponse.error with status 500. |
| `../astra/docs/raw/architecture/invariants/repository-isolation.md` | ELECTRON flow must be View→ViewModel→Repository→IpcService→Prana IPC Runtime; direct use of window.electronAPI in Repository is forbidden (P0 Critical); ipcRenderer direct imports are forbidden. |

---

## AI Guidance

### What to understand first

1. Prana is an Electron app — repositories use `IpcService` from astra, not `ApiService`. The ViewModel (`useDataState`) and View (`AppStateHandler`) code are identical across both platforms.
2. `IpcService` is Astra's service abstraction over Electron IPC. It wraps `window.electronAPI` internally. Prana code must always use `IpcService` — never call `window.electronAPI.invoke()` directly in feature repositories.
3. State lifecycle is `INIT → LOADING → COMPLETED` — error is `COMPLETED + isError === true`, not a separate enum value. Always check `appState.isError` after `COMPLETED`.
4. The feature structure (`model/`, `repo/`, `hooks/`, `view/components/`, `view/pages/`) is canonical — always follow it. Prana features are Electron consumers, so `repo/` files use `IpcService`.
5. `AppStateProvider` is wired once at the Electron renderer root with design system components. Feature modules only use `AppStateHandler`.

### Important rules

- Feature repositories must use `IpcService` for Electron IPC — never `window.electronAPI` directly.
- ViewModel must never import UI components or contain JSX.
- View must never call repositories or fetch data directly.
- Repository must never import UI components or hooks.
- All IPC calls return `ServerResponse<T>` — `IpcService.invoke()` guarantees this.
- Main process IPC handlers (Prana-owned) must return `ServerResponse<T>` shape for `useDataState` to process correctly.
- Always use `ServerResponse.success()` / `ServerResponse.error()` factory methods — never construct raw objects.
- `AppStateProvider` is wired once at root — feature modules only use `AppStateHandler`.
- Never use `setAppState` for normal data fetching — always use `execute()`.
- Use `StateCode.IDLE` (not `HttpStatusCode.IDLE`) for the initial status value.

### Important boundaries

- Astra is stateless — persistence (SQLite, file system, IndexedDB) is Prana's responsibility.
- Astra is not a UI framework — bring your own components for atoms/molecules/organisms.
- Astra is not a localization library — string management is Prana's responsibility.
- Astra core never imports Electron or Node.js APIs — `IpcService` delegates to `window.electronAPI` without importing Electron.
- Astra does not own the Electron runtime (ipcMain, contextBridge, BrowserWindow, SQLite) — those belong to Prana.

### Common mistakes

- Calling `window.electronAPI.invoke()` directly in feature repositories — must use `IpcService`.
- Importing `AppState` as a class — it is an interface, not a class.
- Checking for a separate `ERROR` state — there is none; check `appState.isError` on `COMPLETED`.
- Calling `useDataState` in a view component — it belongs in ViewModel hooks in `hooks/` only.
- Using `HttpStatusCode.IDLE` — use `StateCode.IDLE` instead (they are separate enums).
- Constructing `ServerResponse` as a plain object `{ isError, isSuccess, ... }` — always use `ServerResponse.success()` or `ServerResponse.error()` factories.
- Forgetting to return `ServerResponse<T>` from Prana's IPC handlers — `useDataState` expects this shape.
- Sharing ViewModel state between features — each feature owns its own ViewModel; lift to context only if explicitly required.

### Important assumptions

- Prana is an Electron app — all feature repository code uses `IpcService`.
- `window.electronAPI` is exposed by Prana's preload context bridge (Prana-owned, not Astra-owned).
- Design system components (Loading, Error, Empty) are wired via `AppStateProvider` at Prana's renderer root.
- IPC handlers live in the Electron main process (Prana-owned) and must return `ServerResponse<T>`.
- Each feature owns its own ViewModel — state is local to the feature unless explicitly shared via context.

### Source Documentation

| Document | Summary |
|----------|---------|
| `../astra/docs/raw/architecture/core/mvvm-pattern.md` | Integration with Electron: repositories use IpcService instead of HTTP; ViewModel hook is structurally identical across both platforms. |
| `../astra/docs/raw/architecture/core/state-management.md` | INIT→LOADING→COMPLETED lifecycle, error as COMPLETED+isError, AppState\<T\> interface, AppStateHandler rendering priority. |
| `../astra/docs/raw/architecture/core/repository.md` | ApiService HTTP client, IpcService Electron client, ServerResponse contract, composed operations using factory methods. |
| `../astra/docs/raw/architecture/core/hooks.md` | useDataState API: execute() for fetching, setAppState() for optimistic updates, ViewModel wrapper pattern. |
| `../astra/docs/raw/architecture/integration-contracts/electron.md` | Electron integration: IpcService patterns, AppStateProvider wiring, IPC handler response shape, best practices. |
| `../astra/docs/raw/architecture/invariants/repository-isolation.md` | Strict layer isolation: ELECTRON flow must go through IpcService, not window.electronAPI directly. |
| `../astra/docs/raw/architecture/invariants/boilerplate-ownership.md` | Astra owns IpcService, ApiService, base templates, hooks — applications must not re-implement these. |

---

## Traceability Matrix

| Claim | Evidence | Documentation Summary |
|-------|----------|----------------------|
| Astra is a core architecture and pattern library for React/Electron | `../astra/README.md` line 3 | Defines Astra as a core architecture and pattern library providing MVVM, async state management, and a type-safe API layer for React and Electron applications. |
| Prana must use IpcService, not window.electronAPI directly | `../astra/docs/raw/architecture/invariants/repository-isolation.md` lines 158-174 | Repositories must not directly use `window.electronAPI`, `ipcRenderer`, `ipcMain`, or `contextBridge` — these are forbidden service dependencies; must use `IpcService` instead. |
| IpcService wraps window.electronAPI | `../astra/src/common/repo/IpcService.ts` lines 18-83 | IpcService.invoke() delegates to window.electronAPI.invoke(); normalizes result to ServerResponse\<T\>; handles unavailability (status 500) and exceptions (status 500). |
| IpcService is part of Astra's public API | `../astra/src/lib.ts` lines 23-26 | IpcService exported from `./common/repo/IpcService`; ITransportService/Platform from `./common/repo/types` — both are public exports via the root entry point. |
| MVVM separation rules | `../astra/docs/raw/architecture/invariants/mvvm-separation.md` lines 6-8, 20-75 | Strict 3-layer separation: View is pure presentation (no data fetching), ViewModel orchestrates state (no JSX), Repository handles data access (no presentation logic). Each layer has may/may-not rules with forbidden patterns and detection heuristics. |
| Repository isolation — all external communication through Astra services | `../astra/docs/raw/architecture/invariants/repository-isolation.md` lines 6-40 | All external communication must flow only through Repository abstractions; Repositories use ApiService (WEB) or IpcService (ELECTRON); no direct platform APIs in Repository code. |
| State lifecycle INIT→LOADING→COMPLETED | `../astra/docs/raw/architecture/core/state-management.md` lines 16-23 | Three-state lifecycle; LOADING preserves previous data (stale-while-reloading); error is COMPLETED+isError, not a separate enum value. |
| Error is COMPLETED + isError, not separate enum | `../astra/docs/raw/architecture/core/state-management.md` lines 22-23 | Error represented by `state === COMPLETED && isError === true`; always check appState.isError after COMPLETED. |
| Public API exports through src/lib.ts | `../astra/docs/raw/architecture/core/api-surface.md` lines 25-44 | src/lib.ts controls root entry point exports; no internal re-exports; deprecation policy with @deprecated JSDoc; Astra exports state/data primitives; IpcService is part of Repository layer (ELECTRON). |
| Runtime boundary — no Electron in Astra core | `../astra/docs/raw/architecture/invariants/runtime-boundary.md` | Core must not import Electron (ipcRenderer), Node.js (fs/path/process), or raw browser IPC APIs; IpcService delegates to window.electronAPI without importing Electron. |
| Deterministic build rules | `../astra/docs/raw/architecture/invariants/deterministic-build.md` | Build must produce identical output from identical source; lockfile committed; no timestamps/random IDs. |
| Feature structure layout | `../astra/docs/raw/architecture/core/feature-structure.md` lines 23-44 | Canonical feature module layout: model/ (types), repo/ (data access via IpcService for ELECTRON), hooks/ (ViewModel), view/components/ (presentation), view/pages/ (containers). |
| ViewModel pattern (useDataState wrapper) | `../astra/docs/raw/architecture/core/hooks.md` lines 86-95, 169-199 | Strongly recommends wrapping useDataState in custom ViewModel hooks; ELECTRON ViewModel is structurally identical to WEB — only the repository import differs. |
| IPC repository pattern uses IpcService | `../astra/docs/raw/architecture/integration-contracts/electron.md` lines 89-107 | IpcService is Astra's abstraction over window.electronAPI; repositories instantiate `new IpcService()` and call `ipc.invoke('channel')`. |
| AppStateHandler rendering priority | `../astra/src/common/components/organisms/AppStateHandler.tsx` lines 30-54 | Fixed rendering order: LOADING→(isError or status===INTERNET_ERROR)→(isSuccess && data && emptyCondition)→children→SuccessComponent→Empty fallback. |
| AppState interface fields | `../astra/src/common/state/AppState.ts` lines 11-18 | Interface with state (StateType), isError, isSuccess, status (HttpStatusCode\|StateCode), statusMessage, data (T\|null). |
| StateType enum values | `../astra/docs/raw/architecture/core/state-management.md` lines 7-14 | INIT=0, LOADING=1, COMPLETED=2 — error is COMPLETED+isError, not a separate value. |
| StateCode.IDLE initial status | `../astra/docs/raw/architecture/core/state-management.md` lines 98-108 | StateCode.IDLE=1000 is the initial value of AppState.status before any HTTP activity; exported separately from HttpStatusCode to make clear it is not an HTTP response code. |
| ApiService class | `../astra/docs/raw/architecture/core/repository.md` lines 19-26 | Axios-based HTTP client; methods: get\<T\>, post\<T\>, put\<T\>, delete\<T\>; never throws — all errors returned as ServerResponse. |
| ServerResponse static factories | `../astra/docs/raw/architecture/core/repository.md` lines 32-46 | ServerResponse.success({status, statusMessage, data}) and ServerResponse.error({status, statusMessage}); never construct raw objects — always use factory methods. |
| IcpService error normalization | `../astra/src/common/repo/IpcService.ts` lines 30-58 | window.electronAPI unavailable → status 500; exceptions → status 500; result already a ServerResponse → pass through; raw result → wrapped in ServerResponse.success. |
| ITransportService interface | `../astra/src/common/repo/types.ts` lines 1-6 | `{ readonly platform: Platform; onError?: (error: unknown) => void }` — implemented by both ApiService and IpcService; Platform type is `'WEB' \| 'ELECTRON'`. |
| Boilerplate ownership — Astra owns IpcService/ApiService | `../astra/docs/raw/architecture/invariants/boilerplate-ownership.md` lines 64-100 | Astra owns all boilerplate code: ApiService, IpcService, base repository templates, ViewModel templates, hook templates. Applications must not re-implement these — they import and use Astra's implementations. |
| IPC main process handler must return ServerResponse | `../astra/docs/raw/architecture/integration-contracts/electron.md` lines 111-119 | IPC handler returns `{ isError, isSuccess, status, statusMessage, data }` shape so useDataState can process it correctly. |
| Astra does not own Electron runtime | `../astra/docs/raw/architecture/invariants/repository-isolation.md` lines 196-230 | Prana owns ipcMain, contextBridge, BrowserWindow, SQLite Runtime, Storage Runtime; Astra owns Repository Pattern, IpcService, ServerResponse — Astra provides the abstraction, Prana provides the runtime. |

---

## Open Questions

None at this time. All claims are traceable to evidence from `../astra/docs/raw/architecture/**`, `../astra/README.md`, and the explicitly allowed src paths.
