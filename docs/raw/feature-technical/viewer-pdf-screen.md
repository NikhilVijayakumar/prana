# PDF Viewer Screen — Technical Realization

**Version:** 2.0.0
**Feature Spec:** docs/raw/features/viewer-pdf-screen.md
**Architecture Ref:** docs/raw/external-context/astra.md

---

## 1. Overview

The PDF Viewer Screen is the secure, read-only PDF inspection surface within the Prana runtime. It is the final human verification boundary before operator decisions are made on PDF-class artifacts — covering runtime documents, vault archives, audit reports, and externally ingested content.

This document defines how the feature is technically realized by mapping the L2 feature contract onto Astra's MVVM architecture patterns and Prana's Electron runtime. All renderer-side implementation consumes Astra boilerplate (`IpcService`, `useDataState`, `AppStateHandler`, `ServerResponse`) without re-implementing it. All main-process implementation returns `ServerResponse<T>` from every IPC handler.

The feature's key complexity — sandboxed PDF rendering and large-document virtualization — is realized entirely within the renderer process. The main process is responsible only for resolving, reading, and returning raw document content via IPC.

---

## 2. Feature Summary

| Attribute | Value |
|-----------|-------|
| Feature Name | PDF Viewer Screen |
| Version | 2.0.0 |
| Status | Stable |
| Pattern | MVVM — Astra canonical feature module |
| Renderer Pattern | model / repo / hooks / view |
| IPC Transport | Astra `IpcService` |
| State Management | Astra `useDataState` |
| UI State Routing | Astra `AppStateHandler` |
| Primary Process Boundary | Main Process: document resolution, IPC handlers; Renderer: validation, sanitization, sandboxed render |
| Access Mode | Read-only; no document mutation permitted |
| Document Sources | `runtimeDocumentStore` (runtime), `vaultService` (vault) |

---

## 3. Architecture Mapping

The PDF Viewer Screen spans both Electron processes according to Astra's ELECTRON platform pattern.

**Main Process responsibilities (Prana-owned):**
- Registers IPC handlers for document fetch channels.
- Resolves document source (`runtimeDocumentStore` or `vaultService`) and returns raw content.
- Returns `ServerResponse<T>` from every handler — never throws to the renderer.
- Manages provenance metadata retrieval.

**Renderer Process responsibilities (Prana-owned, Astra-pattern-governed):**
- Consumes `IpcService` in the repository layer — never calls `window.electronAPI` directly.
- Drives the document load lifecycle through `useDataState` in the ViewModel.
- Executes validation, sanitization, and sandboxed rendering within the renderer after IPC data is received.
- Routes UI state slots (loading, error, empty, success) through `AppStateHandler`.
- Emits context-aware action intents without executing mutations directly.

**Astra boundary:** Astra owns `IpcService`, `useDataState`, `AppStateHandler`, `ServerResponse`, and their contracts. Prana consumes these and must not re-implement them. Prana owns the Electron runtime (`ipcMain`, `contextBridge`, `BrowserWindow`, SQLite) and all IPC handler logic.

---

## 4. Main Process Design

### 4.1 Service Architecture

The main process exposes two Prana-owned services to the PDF viewer feature via IPC:

**`runtimeDocumentStore`**
- Manages hot documents held in SQLite runtime state.
- Provides consistent retrieval by document path or ID.
- Returns raw document content and provenance metadata.

**`vaultService`**
- Manages encrypted document archives.
- Decrypts and validates content before returning it.
- Must return decrypted, pre-validated content to the IPC handler so the handler can wrap it in `ServerResponse<T>`.

Both services are consumed by their respective IPC handler registrations. The IPC handler is the boundary — it calls the service, handles service errors, and returns `ServerResponse<T>`. Service errors are caught and converted to `ServerResponse.error(...)`. Exceptions must never propagate to the renderer.

### 4.2 IPC Channel Contract

All channels follow the `{feature}:{action}` naming convention. All invoke channels return `ServerResponse<T>`. Main process failures return `ServerResponse.error(...)` — never throw.

| Channel | Direction | Request Payload | Response Data Type | Description |
|---------|-----------|-----------------|-------------------|-------------|
| `viewer-pdf:fetch` | Renderer → Main | `{ source: 'runtime' \| 'vault', path: string, documentId?: string }` | `PdfDocumentContent` | Fetch raw PDF document bytes and provenance metadata from the declared source |
| `viewer-pdf:fetch-provenance` | Renderer → Main | `{ documentId: string }` | `PdfProvenanceMetadata` | Fetch provenance metadata for a document already in the viewer |
| `viewer-pdf:log-event` | Renderer → Main (fire-and-forget) | `{ eventType: string, documentId?: string, detail?: string }` | N/A (`send`, no response) | Emit a structured observability event to the main-process telemetry/log system |

**`PdfDocumentContent`** carries the raw document payload (byte content or base64-encoded representation) and the resolved source identifier.

**`PdfProvenanceMetadata`** carries `document_id`, `source`, `origin_path`, `created_at`, and `last_modified` as defined in the L2 data contract.

The `viewer-pdf:log-event` channel uses `IpcService.send()` (fire-and-forget) because observability events must not block the rendering pipeline.

**Failure contract:** If `runtimeDocumentStore` or `vaultService` cannot resolve the document, or if an unexpected exception occurs, the handler must return `ServerResponse.error({ status: 404 | 500, statusMessage: '...' })`. The renderer `useDataState` lifecycle will transition to `COMPLETED + isError: true` and `AppStateHandler` will render the error slot.

### 4.3 SQLite Schema

The PDF viewer feature itself does not define new SQLite tables. Document content and provenance metadata are owned by the `runtimeDocumentStore` and `vaultService` schemas respectively. Those schemas are defined in their own feature-technical documents.

The viewer relies on the following existing data:
- Document path / ID lookup (owned by `runtimeDocumentStore`).
- Provenance fields: `document_id`, `source`, `origin_path`, `created_at`, `last_modified` (owned by the storage layer).

No viewer-specific write operations occur against SQLite. The viewer is strictly read-only with respect to storage.

### 4.4 Startup and Teardown

**Startup:** IPC channels (`viewer-pdf:fetch`, `viewer-pdf:fetch-provenance`, `viewer-pdf:log-event`) are registered during Prana's main-process startup sequence alongside all other feature IPC handlers.

**Teardown:** No teardown logic is required for these channels. They are stateless request/response handlers. The renderer ViewModel is responsible for cleaning up any `IpcService.receive()` subscriptions (push channels) on component unmount by calling the returned unsubscribe function. No push channels are defined for this feature in the current specification.

---

## 5. Renderer Design (Astra MVVM)

### 5.1 Feature Module Layout

The PDF viewer follows Astra's canonical feature module layout exactly.

| Module | Responsibility |
|---|---|
| model | TypeScript types and DTOs: document input, document content, provenance metadata, viewer state, owner type enumerations. No logic. |
| repo | IPC data access via IpcService: fetch document content, fetch provenance, send observability events. Uses `IpcService` exclusively — never `window.electronAPI` directly. |
| hooks | ViewModel: `useViewerPdf` wrapping `useDataState`; drives document load lifecycle, validation, sanitization sequencing. No JSX, no UI imports. |
| view — components | Presentational leaf components: sandboxed PDF render container, provenance badge, action bar, error banner, loading indicator. Pure presentational — no data fetching. |
| view — pages | Stateful page container: composes ViewModel hooks, `AppStateHandler`, and view components. No direct IPC calls. |

### 5.2 Repository Layer (IpcService)

The repository layer instantiates a single `IpcService` instance and exposes named operations. Prana consumes Astra's `IpcService` — it does not re-implement IPC transport.

**Operations exposed by the PDF viewer repository:**

| Operation | IPC Channel | Return Type | Pattern |
|-----------|-------------|-------------|---------|
| `fetchDocument(input)` | `viewer-pdf:fetch` | `Promise<ServerResponse<PdfDocumentContent>>` | `ipc.invoke(...)` |
| `fetchProvenance(documentId)` | `viewer-pdf:fetch-provenance` | `Promise<ServerResponse<PdfProvenanceMetadata>>` | `ipc.invoke(...)` |
| `logEvent(event)` | `viewer-pdf:log-event` | `void` | `ipc.send(...)` |

All `invoke` operations return `ServerResponse<T>` via `IpcService`'s normalization. The repository layer must not contain try/catch blocks — `IpcService` guarantees `ServerResponse<T>` is always returned, including on exceptions (status 500).

The `fetchDocument` and `fetchProvenance` operations may be composed into a single repository call when both document content and provenance are required on initial load, using the composed repository pattern: call `fetchDocument`, check `isError`, then call `fetchProvenance`, merge the results into a `ServerResponse.success(...)` with a combined data shape.

### 5.3 ViewModel Layer (useDataState)

The ViewModel is a custom hook (`useViewerPdf`) that wraps `useDataState` from Astra. Prana consumes Astra's `useDataState` — it does not re-implement state management.

**State driven by `useDataState`:**

The hook manages a `PdfViewerState` type via `AppState<PdfViewerState>`. The `execute()` function from `useDataState` drives the load lifecycle.

**Lifecycle sequence within the ViewModel:**

1. On load trigger (document input received), call `execute(() => pdfViewerIpc.fetchDocument(input))`.
2. `useDataState` transitions: `INIT → LOADING → COMPLETED`.
3. On `COMPLETED` with `isError: false`: the raw content is available in `appState.data`.
4. On `COMPLETED` with `isError: true`: surface the error through `appState` — `AppStateHandler` renders the error slot.
5. If fetch succeeds, the ViewModel performs validation and sanitization logic before the view renders the PDF. Validation and sanitization failures are surfaced by calling `setAppState` to manually transition to an error state, preserving the Astra `AppState` contract.
6. The `logEvent` repository operation is called via `pdfViewerIpc.logEvent(...)` for observability events — this is fire-and-forget and does not affect `appState`.

**Key ViewModel rules:**
- `execute()` is used for all async data fetching — `setAppState` is reserved for validation/sanitization failure overrides and manual resets only.
- The ViewModel exposes no JSX and imports no UI components.
- State is local to the feature — not shared across features unless explicitly lifted to a React context.

Note: Using `setAppState` for validation and sanitization failure transitions is consistent with Astra's Optimistic Update Pattern (L1) — where the ViewModel manually controls state transitions for operations that don't follow the standard fetch lifecycle. This is the approved pattern for pipeline failures that occur outside the `execute()` flow.

### 5.4 View Layer (AppStateHandler)

The page component (`ViewerPdfPage`) composes the ViewModel hook and wraps the PDF render area in `AppStateHandler`. Prana consumes Astra's `AppStateHandler` — it does not re-implement state routing.

**`AppStateHandler` usage for the PDF viewer:**

| Prop | Purpose |
|------|---------|
| `appState` | The `AppState<PdfViewerState>` from `useViewerPdf` |
| `SuccessComponent` or `children` | Renders the sandboxed PDF canvas/iframe and provenance metadata when state is `COMPLETED + isSuccess` |
| `emptyCondition` | Returns true when `appState.data` is null or document content is absent |
| `errorMessage` | Human-readable error description surfaced to the error slot |
| `loadingComponent` | Optional per-instance override of the global loading indicator |
| `errorComponent` | Optional per-instance override of the global error display |
| `emptyComponent` | Rendered when no document is loaded yet |

The view layer has no direct calls to the repository. All data flows through the ViewModel hook via `appState`. The contextual action bar is surfaced within the success slot and routes actions through the owning module per the L2 action routing rules.

### 5.5 AppState Lifecycle Mapping

The Astra `AppState` lifecycle is the controlling state machine for the PDF viewer from the renderer's perspective. The L2 feature document defines a richer internal lifecycle (`IDLE → LOADING → VALIDATING → PDFJS_INIT → SANDBOX_RENDER → DISPLAYED`) that is realized *within* the Astra lifecycle, not as a replacement for it.

| Astra StateType | Astra isError | Rendered Slot | L2 Lifecycle Stage |
|-----------------|---------------|---------------|-------------------|
| `INIT` (0) | false | Empty slot | IDLE |
| `LOADING` (1) | false | Loading slot | LOADING (IPC fetch in flight) |
| `COMPLETED` (2) | true | Error slot | LOAD_FAILED / VALIDATION_FAILED / SANITIZATION_FAILED / SECURITY_BLOCKED / PDF_ENGINE_FAILED |
| `COMPLETED` (2) | false | Empty slot (if data absent) | IDLE (no document loaded) |
| `COMPLETED` (2) | false | Success slot | VALIDATING → PDFJS_INIT → SANDBOX_RENDER → DISPLAYED (renderer-internal progression) |

The VALIDATING, PDFJS_INIT, and SANDBOX_RENDER sub-stages occur after `COMPLETED + isSuccess` is reached. These are renderer-internal progressions managed within the success slot component — they do not create new Astra state transitions. If any of these sub-stages fail, the ViewModel calls `setAppState` to force `COMPLETED + isError: true`, returning control to `AppStateHandler`'s error slot.

---

## 6. Responsibility Realization Matrix

Every responsibility declared in the L2 feature spec is mapped here.

| L2 Responsibility | Realized By | Process | Mechanism |
|-------------------|-------------|---------|-----------|
| Fetch document from `runtimeDocumentStore` | `viewer-pdf:fetch` IPC handler + PDF viewer repository | Main + Renderer | IPC invoke via `IpcService` |
| Fetch document from `vaultService` | `viewer-pdf:fetch` IPC handler + `vaultService` | Main | IPC handler calls vault service, returns `ServerResponse<T>` |
| Source resolution priority (runtime before vault) | `viewer-pdf:fetch` IPC handler | Main | Handler resolves source by declared `source` field; logs if fallback occurs |
| Validate file type, encoding, content size, PDF signature | PDF viewer ViewModel / success-slot renderer logic | Renderer | Post-fetch validation in ViewModel before triggering render |
| Sanitize embedded JS, launch actions, remote links, metadata | PDF viewer ViewModel / sanitization stage | Renderer | Renderer-side sanitization of fetched content before PDF engine init |
| Render PDF in sandboxed environment | `PdfRenderAdapter` (isolated iframe or shadow DOM) | Renderer | View component; no direct DOM injection; script execution prevented |
| Enforce read-only — never mutate document state | ViewModel and IPC handler contracts | Both | No write IPC channels; ViewModel has no mutation operations |
| Provenance traceability (source, document ID / path) | `viewer-pdf:fetch-provenance` channel + ViewModel | Main + Renderer | Provenance metadata fetched and surfaced in success slot |
| Context-aware action bar (owner-type-based actions) | View layer action bar component | Renderer | Rendered in success slot; emits intent events; does not execute mutations |
| Action routing through owning module | Action intent callbacks in view layer | Renderer | Actions dispatched as events/callbacks; PDF viewer does not execute them |
| Large document handling — virtualization, lazy loading | PDF canvas component / large-document strategy | Renderer | Page-by-page rendering, scroll-based loading, canvas reuse in view layer |
| Large document fallback — partial preview or export intent | View layer fallback component | Renderer | Rendered when rendering exceeds memory/size limits |
| Observability: load time, validation failures, render latency, blocked content events | `viewer-pdf:log-event` fire-and-forget channel | Renderer → Main | `ipc.send(...)` calls from ViewModel at each lifecycle stage transition |
| Fail-closed on uncertainty (format, sanitization, corruption) | ViewModel validation/sanitization with `setAppState` | Renderer | Any ambiguity sets `isError: true`; `AppStateHandler` blocks render |
| Deterministic rendering — same input, identical output | Read-only ViewModel and view contracts | Renderer | No runtime/global state influences render; stateless rendering pipeline |
| Sandbox isolation — no DOM escape, no script execution | `PdfRenderAdapter` isolated iframe / shadow DOM | Renderer | Renderer view component enforces sandbox attributes |

---

## 7. Workflow Realization

Every L2 workflow is mapped to its technical realization.

### Workflow 1: Document Load (Happy Path)

1. The viewer page component receives `PdfViewerInput` (`source`, `path`, `format`, `documentId?`, `ownerType?`).
2. ViewModel calls `execute(() => pdfViewerIpc.fetchDocument(input))`.
3. `useDataState` transitions to `LOADING` — `AppStateHandler` renders the loading slot.
4. `IpcService.invoke('viewer-pdf:fetch', payload)` dispatches to the main process.
5. Main-process handler resolves the document from `runtimeDocumentStore` or `vaultService` per the declared source, returns `ServerResponse.success({ data: PdfDocumentContent })`.
6. `useDataState` transitions to `COMPLETED + isSuccess`.
7. ViewModel performs validation (file type, encoding, size, PDF signature). If validation fails: `setAppState` → `COMPLETED + isError` → `AppStateHandler` renders error slot. Stop.
8. ViewModel performs sanitization (disable embedded JS, launch actions, remote links, sanitize metadata). If sanitization fails: `setAppState` → `COMPLETED + isError`. Stop.
9. `AppStateHandler` renders success slot. `PdfRenderAdapter` initializes the PDF engine in its sandbox, renders pages.
10. ViewModel calls `pdfViewerIpc.logEvent({ eventType: 'PDF_RENDERED', ... })` via `ipc.send(...)`.

### Workflow 2: Document Load Failure

1. Steps 1–4 as above.
2. Main-process handler cannot resolve document (not found, vault decryption error, or exception) — returns `ServerResponse.error({ status: 404 | 500, statusMessage: '...' })`.
3. `useDataState` transitions to `COMPLETED + isError: true`.
4. `AppStateHandler` renders error slot with the `statusMessage`.
5. ViewModel calls `pdfViewerIpc.logEvent({ eventType: 'LOAD_FAILED', ... })`.

### Workflow 3: Validation or Sanitization Failure

1. Fetch succeeds (steps 1–6 above).
2. Validation or sanitization logic in the ViewModel detects a violation.
3. ViewModel calls `setAppState` to force `COMPLETED + isError: true` with an appropriate status message.
4. `AppStateHandler` renders the error slot — rendering is fully blocked (fail-closed).
5. ViewModel calls `pdfViewerIpc.logEvent({ eventType: 'VALIDATION_FAILED' | 'SANITIZATION_FAILED' | 'SECURITY_BLOCKED', ... })`.

### Workflow 4: Large Document Handling

1. After successful validation and sanitization, the view layer detects document size or page count exceeds the threshold.
2. `PdfRenderAdapter` activates page-by-page virtualized rendering with scroll-based lazy loading and canvas reuse.
3. If rendering exceeds memory/size limits mid-render, the view layer falls back to partial preview and surfaces an export intent action.
4. ViewModel calls `pdfViewerIpc.logEvent({ eventType: 'LARGE_DOCUMENT_VIRTUALIZED', ... })`.

### Workflow 5: Context-Aware Action Dispatch

1. Document renders successfully in the success slot.
2. The action bar renders owner-type-specific actions (e.g., View Metadata for VAULT_DOCUMENT, Export for SYSTEM_LOG).
3. User triggers an action — the view layer emits an intent callback/event.
4. The intent is handled by the owning module — the PDF viewer does not execute the action itself.
5. The PDF viewer's document state is not modified.

### Workflow 6: Provenance Metadata Display

1. After successful document fetch, the ViewModel optionally calls `execute(() => pdfViewerIpc.fetchProvenance(documentId))` if provenance was not included in the initial fetch response.
2. Provenance data (`document_id`, `source`, `origin_path`, `created_at`, `last_modified`) is surfaced in the success slot provenance badge component.

---

## 8. State Realization

### 8.1 Main Process States

The main process is stateless with respect to the PDF viewer. It does not maintain viewer session state. Each IPC invocation is an independent request resolved against the current state of `runtimeDocumentStore` or `vaultService`.

| Condition | Main Process Response |
|-----------|-----------------------|
| Document found in resolved source | `ServerResponse.success({ data: PdfDocumentContent })` |
| Document not found | `ServerResponse.error({ status: 404, statusMessage: 'Document not found' })` |
| Source service error (vault decrypt failure, store error) | `ServerResponse.error({ status: 500, statusMessage: '...' })` |
| Unexpected exception | `ServerResponse.error({ status: 500, statusMessage: 'Internal error' })` |

### 8.2 Renderer AppState Mapping

The full L2 document state model is realized through Astra's `AppState<T>` lifecycle. The renderer-internal sub-states (VALIDATING, PDFJS_INIT, SANDBOX_RENDER) are progression stages within the success-slot rendering pipeline and are not distinct `AppState` transitions.

| L2 State | Astra StateType | Astra isError | AppStateHandler Slot |
|----------|-----------------|---------------|----------------------|
| IDLE | INIT (0) | false | Empty |
| LOADING (IPC fetch) | LOADING (1) | false | Loading |
| LOAD_FAILED | COMPLETED (2) | true | Error |
| VALIDATION_FAILED | COMPLETED (2) | true | Error |
| SANITIZATION_FAILED | COMPLETED (2) | true | Error |
| UNSUPPORTED_FORMAT | COMPLETED (2) | true | Error |
| SECURITY_BLOCKED | COMPLETED (2) | true | Error |
| PDF_ENGINE_FAILED | COMPLETED (2) | true | Error |
| VALIDATING (renderer-internal) | COMPLETED (2) | false | Success slot (pre-render gate) |
| PDFJS_INIT (renderer-internal) | COMPLETED (2) | false | Success slot (pre-render gate) |
| SANDBOX_RENDER (renderer-internal) | COMPLETED (2) | false | Success slot (rendering) |
| DISPLAYED | COMPLETED (2) | false | Success slot (fully rendered) |

---

## 9. Boilerplate Application Mapping

Prana consumes Astra's boilerplate for this feature. The following table maps each consumed boilerplate element to its application within the PDF viewer.

| Astra Boilerplate | Applied As | Notes |
|-------------------|------------|-------|
| `IpcService` | PDF viewer repository — `fetchDocument`, `fetchProvenance`, `logEvent` | `new IpcService()` instantiated once in the repository module; never `window.electronAPI` directly |
| `IpcService.invoke(...)` | `fetchDocument` and `fetchProvenance` operations | Returns `Promise<ServerResponse<T>>`; repository does not try/catch |
| `IpcService.send(...)` | `logEvent` operation | Fire-and-forget; does not block render pipeline |
| `ServerResponse<T>` | All IPC handler return types in main process | Handlers use `ServerResponse.success(...)` / `ServerResponse.error(...)` factories; never raw objects |
| `useDataState<T>` | `useViewerPdf` ViewModel hook | Drives INIT→LOADING→COMPLETED lifecycle; `execute()` for fetching; `setAppState` for validation/sanitization overrides |
| `AppState<T>` | `AppState<PdfViewerState>` — the ViewModel's state shape | Consumed by `AppStateHandler`; not re-implemented |
| `AppStateHandler` | `ViewerPdfPage` page container — wraps the PDF render area | Routes loading / error / empty / success slots automatically |
| `AppStateProvider` | Wired once at Prana's renderer root | Provides global Loading / Error / Empty design system components; not re-wired per feature |
| `StateType` | Read in ViewModel for conditional logic if needed | INIT=0, LOADING=1, COMPLETED=2 |
| `StateCode.IDLE` | Initial `status` value in `AppState` before any fetch | Used instead of `HttpStatusCode`; they are separate enums |
| `HttpStatusCode` | Consumed from handler responses (`200`, `404`, `500`) | Populated by `IpcService` normalization from main-process `ServerResponse` |

---

## 10. Permission Realization

The PDF viewer is a read-only consumer. It requires the following runtime permissions (Prana-owned, not Astra-owned):

| Permission | Scope | Justification |
|------------|-------|---------------|
| IPC channel access: `viewer-pdf:fetch` | Renderer → Main | Required to retrieve document content from `runtimeDocumentStore` or `vaultService` |
| IPC channel access: `viewer-pdf:fetch-provenance` | Renderer → Main | Required to retrieve provenance metadata |
| IPC channel access: `viewer-pdf:log-event` | Renderer → Main (send) | Required for structured observability event emission |
| Read access to `runtimeDocumentStore` | Main process | Document fetch from runtime store |
| Read access to `vaultService` (decrypted content) | Main process | Document fetch from vault; vault service owns decryption |
| No write access to any storage | — | Viewer is read-only by invariant; no write IPC channels are registered for this feature |

Access control per document (per-document ACL) is identified in L2 as a known architectural gap. This realization document records it as an Open Question — see Section 17.

Current no-ACL behavior: the main process IPC handler returns document content to any renderer call that provides a valid document path. No session-level or user-level filtering is applied. Access restriction is the responsibility of the calling context. Content is returned if the path resolves — there is no rejection based on caller identity.

---

## 11. Validation Realization

Validation occurs in two locations: the main process (source and channel level) and the renderer ViewModel (content level).

### Main Process Validation

| Validation | Mechanism | Failure Response |
|------------|-----------|-----------------|
| `source` field is `'runtime'` or `'vault'` | IPC handler parameter check | `ServerResponse.error({ status: 400 })` |
| `path` field is present and non-empty | IPC handler parameter check | `ServerResponse.error({ status: 400 })` |
| Document exists at resolved source | Service lookup | `ServerResponse.error({ status: 404 })` |

### Renderer ViewModel Validation

| Validation | Mechanism | Failure Effect |
|------------|-----------|----------------|
| File type matches declared format (`'pdf'`) | ViewModel post-fetch check | `setAppState` → `COMPLETED + isError` |
| Encoding integrity | ViewModel post-fetch check | `setAppState` → `COMPLETED + isError` |
| Content size within limits | ViewModel post-fetch check | `setAppState` → `COMPLETED + isError` or large-document path |
| PDF magic bytes / file signature | ViewModel post-fetch check | `setAppState` → `COMPLETED + isError` |
| Content passes sanitization (no embedded JS, no blocked launch actions) | ViewModel sanitization stage | `setAppState` → `COMPLETED + isError` |

All validation failures are fail-closed — rendering is fully blocked. Validation failures are emitted as observability events via `pdfViewerIpc.logEvent(...)`.

---

## 12. Error Realization

Every L2 failure mode is mapped to its technical handling.

| L2 Failure Scenario | Error Origin | Astra State | AppStateHandler Slot | Observability Event |
|---------------------|-------------|-------------|----------------------|---------------------|
| File not found | Main process handler (404) | `COMPLETED + isError` | Error | `LOAD_FAILED` |
| Validation failure (type, encoding, size, signature) | Renderer ViewModel | `COMPLETED + isError` (via `setAppState`) | Error | `VALIDATION_FAILED` |
| Sanitization failure (embedded JS, launch actions) | Renderer ViewModel | `COMPLETED + isError` (via `setAppState`) | Error | `SANITIZATION_FAILED` |
| PDF script detected (security block) | Renderer ViewModel sanitization | `COMPLETED + isError` (via `setAppState`) | Error | `SECURITY_BLOCKED` |
| Unsupported format | Renderer ViewModel | `COMPLETED + isError` (via `setAppState`) | Error | `UNSUPPORTED_FORMAT` |
| Large file overload (partial render) | View layer `PdfRenderAdapter` | `COMPLETED + isSuccess` (partial) | Success slot with fallback UI | `LARGE_DOCUMENT_PARTIAL` |
| PDF engine crash | View layer `PdfRenderAdapter` | `setAppState` → `COMPLETED + isError` | Error | `PDF_ENGINE_FAILED` |
| Main process service exception | Main process IPC handler | `ServerResponse.error({ status: 500 })` → `COMPLETED + isError` | Error | `LOAD_FAILED` |
| `window.electronAPI` unavailable | `IpcService` normalization | `COMPLETED + isError` (status 500) | Error | (status 500 surfaced as error message) |

Note: Partial render (first N pages) is surfaced through the success slot rather than an error slot by design — the operator receives usable content and is not shown an error state. The partial render is indicated in the action bar or document metadata (a 'Document truncated — showing first N pages' notice), not via the AppState error path. This design prioritizes operator utility over strict success/failure binary.

**Fail-closed rule:** Any unresolvable uncertainty (format ambiguity, sanitization result unclear, PDF engine state unknown) must produce `COMPLETED + isError` — rendering is never attempted on uncertain content.

**Main process rule:** All exceptions in IPC handlers are caught and returned as `ServerResponse.error(...)`. Handlers never throw to the renderer.

---

## 13. Integration Realization

### 13.1 Internal Prana Integrations

| Integrated System | Integration Point | Direction | Contract |
|-------------------|------------------|-----------|----------|
| `runtimeDocumentStore` | `viewer-pdf:fetch` IPC handler | Main process consumes store | Store provides consistent retrieval by path / document ID; returns document bytes and metadata |
| `vaultService` | `viewer-pdf:fetch` IPC handler | Main process consumes vault | Vault must return decrypted, validated content to the handler |
| `VisualIdentityEngine` | View layer styling (typography tokens, layout rules) | Renderer consumes | Design tokens applied in view components; not an IPC integration |
| Telemetry / Log System | `viewer-pdf:log-event` fire-and-forget channel | Renderer → Main | Structured event object sent via `ipc.send(...)`; main process writes to log/telemetry store |
| Owning module action handlers | Context-aware action bar intent dispatch | Renderer emits, owning module receives | PDF viewer emits intent callbacks; owning module executes the action |

### 13.2 IPC Surface

| Channel | Pattern | Caller | Handler |
|---------|---------|--------|---------|
| `viewer-pdf:fetch` | `invoke` (request/response) | PDF viewer repository | Main process: `runtimeDocumentStore` or `vaultService` resolver |
| `viewer-pdf:fetch-provenance` | `invoke` (request/response) | PDF viewer repository | Main process: provenance metadata resolver |
| `viewer-pdf:log-event` | `send` (fire-and-forget) | PDF viewer repository | Main process: telemetry/log writer |

All `invoke` channels return `ServerResponse<T>` as required by Astra's IPC contract. The renderer `useDataState` expects this shape — deviating from it will break the state lifecycle.

### 13.3 External Systems

| External System | Integration | Constraint |
|----------------|-------------|------------|
| Google Drive (Google Bridge) | `GOOGLE_DOC` owner type — action bar surfaces "Open in Drive" intent | PDF viewer emits the intent only; Google Bridge module executes it; viewer has no direct Google API dependency |
| Sandboxed PDF rendering engine (renderer-local; no network calls; renderer controls sandbox lifecycle) | `PdfRenderAdapter` wraps the PDF engine in the renderer sandbox | Engine is renderer-local; no network calls; renderer controls sandbox lifecycle |

---

## 14. Ownership Mapping

### 14.1 Responsibility Ownership

| Responsibility | Owner |
|----------------|-------|
| IPC channel registration and handler logic | Prana (main process) |
| Document resolution from `runtimeDocumentStore` | Prana (main process, `runtimeDocumentStore` module) |
| Document resolution from `vaultService` | Prana (main process, `vaultService` module) |
| Provenance metadata retrieval | Prana (main process) |
| IPC transport (IpcService) | Astra (consumed by Prana, not re-implemented) |
| State lifecycle management (useDataState) | Astra (consumed by Prana, not re-implemented) |
| UI state routing (AppStateHandler) | Astra (consumed by Prana, not re-implemented) |
| Response shape normalization (ServerResponse) | Astra (Prana uses factories only) |
| Content validation (type, encoding, size, signature) | Prana (renderer ViewModel) |
| Content sanitization (embedded JS, launch actions, metadata) | Prana (renderer ViewModel) |
| Sandboxed PDF rendering | Prana (renderer view layer, `PdfRenderAdapter`) |
| Large document virtualization | Prana (renderer view layer) |
| Context-aware action bar | Prana (renderer view layer) |
| Action execution (route to owning module) | Owning module (not the PDF viewer) |
| Observability event emission | Prana (renderer ViewModel fire-and-forget) |
| Observability event persistence | Prana (main process telemetry/log handler) |
| Design tokens and styling | Prana (VisualIdentityEngine / design system) |
| AppStateProvider wiring at renderer root | Prana (renderer root, wired once) |

### 14.2 Astra vs Prana Ownership

| Component | Astra Owns | Prana Owns |
|-----------|------------|------------|
| `IpcService` | Implementation, normalization contract | Instantiation in repository; channel names; payload shapes |
| `useDataState` | Hook implementation, lifecycle contract | ViewModel wrapper (`useViewerPdf`); `execute()` call targets; `setAppState` calls for overrides |
| `AppStateHandler` | Rendering priority logic; slot routing | Prop values (`appState`, `emptyCondition`, `errorMessage`); slot override components |
| `AppStateProvider` | Context contract | Wiring at renderer root with design system components |
| `ServerResponse<T>` | Factory methods; normalization | Handler return values; use of `success()`/`error()` factories |
| `AppState<T>`, `StateType`, `StateCode` | Type definitions and enum values | Data type parameter (`PdfViewerState`); reading `isError`, `isSuccess`, `data` |
| IPC main process runtime (`ipcMain`, `contextBridge`) | Not owned | Fully owned by Prana |
| SQLite runtime state | Not owned | Fully owned by Prana |
| Electron `BrowserWindow` | Not owned | Fully owned by Prana |

---

## 15. Architecture Traceability Matrix

| Architecture Claim | Source in L1 (astra.md) | Applied In This Feature |
|--------------------|------------------------|------------------------|
| Repositories use `IpcService`, never `window.electronAPI` directly | Architectural Invariants — Repository Isolation; AI Guidance — Important Rules | PDF viewer repository `fetchDocument`, `fetchProvenance`, `logEvent` all use `IpcService` |
| All IPC handlers return `ServerResponse<T>` | Integration Contracts — IPC Response Shape; Boilerplate — IpcService Error Normalization | `viewer-pdf:fetch`, `viewer-pdf:fetch-provenance` handlers return `ServerResponse<PdfDocumentContent>`, `ServerResponse<PdfProvenanceMetadata>` |
| Main process failures return `ServerResponse.error(...)`, never throw | AI Guidance — Important Rules | All handler exceptions caught and returned as `ServerResponse.error(...)` |
| ViewModel is the sole bridge between View and Repository | Architectural Invariants — MVVM Separation | `useViewerPdf` hook is the only entry point for view components to trigger data fetching |
| View never imports Repository | Architectural Invariants — MVVM Separation | `ViewerPdfPage` and view components import only from `hooks/`; never from `repo/` |
| `useDataState` drives INIT→LOADING→COMPLETED lifecycle | Architecture Patterns — State Lifecycle; Boilerplate — ViewModel Pattern | `useViewerPdf` wraps `useDataState`; `execute()` drives lifecycle |
| Error is `COMPLETED + isError`, not a separate enum value | Architecture Patterns — State Lifecycle; AI Guidance — Common Mistakes | All failure states realized as `COMPLETED + isError: true`; no ERROR StateType |
| `AppStateProvider` wired once at renderer root | Integration Contracts — Provider Setup | Wired at Prana renderer root; feature module uses only `AppStateHandler` |
| `setAppState` reserved for non-fetch state overrides | Boilerplate — ViewModel Pattern; AI Guidance — Important Rules | Used only for validation/sanitization failure overrides; `execute()` used for all IPC fetches |
| Feature module follows canonical layout | Architecture Patterns — Feature Structure | viewer-pdf module follows the canonical four-layer structure (model, repo, hooks, view components, view pages) — see §5.1 |
| Astra owns boilerplate; applications must not re-implement | Boilerplate — Source Documentation (boilerplate-ownership.md) | Prana imports `IpcService`, `useDataState`, `AppStateHandler` from `'astra'`; no re-implementation |
| `StateCode.IDLE` used for initial status, not `HttpStatusCode` | Public API Surface — StateCode; AI Guidance — Common Mistakes | Initial `AppState.status` uses `StateCode.IDLE = 1000` |
| `IpcService.receive()` unsubscribe called on unmount | Public API Surface — IpcService Full Signature | No push channels defined in current spec; if added, unsubscribe returned from `receive()` must be called on unmount |

---

## 16. Feature Traceability Matrix

| L2 Requirement | L2 Section | Realized In |
|----------------|------------|-------------|
| Zero-trust PDF rendering boundary | Section 1 | Sections 4.2, 5.3, 11, 12 |
| Document provenance surface | Section 1 | Sections 4.2, 5.2, 7 (Workflow 6), 13.1 |
| Human decision interface — read-only | Section 2.1 | Sections 4.3, 6 (read-only row), 10 |
| Read-only enforcement — no mutation | Section 2.1 | Sections 4.2 (no write channels), 10, 14.1 |
| Sanitization completeness — no bypass | Section 2.2 | Sections 5.3, 11, 12 |
| Provenance traceability to source and document ID | Section 2.3 | Sections 4.2 (`viewer-pdf:fetch-provenance`), 5.2, 6 (Workflow 6) |
| Deterministic rendering | Section 2.4 | Sections 8.2, 13 |
| Strict sandbox isolation | Section 2.5 | Sections 5.4, 6 (Responsibility row), 12 |
| Fail-closed on uncertainty | Section 2.6 | Sections 5.3, 11, 12 |
| `runtimeDocumentStore` as primary source | Section 3, 5.1 | Sections 4.1, 4.2, 7 (Workflow 1) |
| `vaultService` as secondary source | Section 3, 5.1 | Sections 4.1, 4.2, 7 (Workflow 1) |
| Source declared explicitly (`runtime` \| `vault`) | Section 5.1 | Sections 4.2, 11 (main process validation) |
| Validation stage: type, encoding, size, signature | Section 5.2 | Sections 5.3, 11 |
| Sanitization: disable embedded JS, launch actions, remote links | Section 5.3 | Sections 5.3, 11, 12 |
| Sandboxed rendering: isolated iframe or shadow DOM | Section 5.4, 9.2 | Sections 5.4, 6, 9 |
| Owner type binding and contextual actions | Section 8 | Sections 6, 7 (Workflow 5) |
| Actions routed through owning module | Section 8.3 | Sections 6, 7 (Workflow 5), 13.1 |
| Multi-layer defense: validation, sanitization, sandbox | Section 9.1 | Sections 11, 12 |
| Content trust levels (Vault=High, Runtime=Medium, Google=Low) | Section 9.3 | Section 13.1 (constraint on Google Bridge integration) |
| Large document virtualization — page-by-page, scroll, canvas reuse | Section 10 | Sections 6, 7 (Workflow 4) |
| Large document fallback — partial preview or export | Section 10.3 | Sections 7 (Workflow 4), 12 |
| All failure modes handled (7 scenarios) | Section 11 | Section 12 |
| Observability: load time, failures, latency, blocked events | Section 12 | Sections 4.2 (`viewer-pdf:log-event`), 5.2, 6 |
| Deterministic guarantees: read-only, no unsafe content, consistent output | Section 13 | Sections 8, 10 |
| `runtimeDocumentStore` consistent retrieval API contract | Section 15 | Section 4.1 |
| `vaultService` decrypted validated content contract | Section 15 | Section 4.1 |
| Google Bridge document linkage contract | Section 15 | Section 13.3 |

---

## 17. Open Questions

| ID | Area | Question | Source |
|----|------|----------|--------|
| OQ-1 | Access Control | L2 identifies "No per-document ACL enforcement" as a high-impact architectural gap (Section 14). How and when will per-document access control be introduced? Does it live in the main-process IPC handler (pre-fetch permission check), in `vaultService`, in `runtimeDocumentStore`, or as a new middleware layer? Until resolved, no ACL contract can be defined for `viewer-pdf:fetch`. | L2 Section 14 |
| OQ-2 | Owner Type Schema | L2 identifies "No enforced schema for ownerType" as a high-impact gap (Section 14). The `ownerType` field in `PdfViewerInput` is currently unvalidated. Which module owns the ownerType registry? Is validation performed in the renderer ViewModel, the main process, or a shared types package? | L2 Section 14 |
| OQ-3 | Export Pipeline | L2 identifies a missing export pipeline as a medium-impact gap (Section 14). The large-document fallback surfaces an export intent (Section 10.3) and `SYSTEM_LOG` owner type includes an Export action (Section 8.2). What is the IPC contract for the export pipeline? Which module owns export execution? | L2 Sections 8.2, 10.3, 14 |
| OQ-4 | Search and Highlight | L2 identifies "No internal search engine" as a medium-impact gap (Section 14). If search is added, it would require a new ViewModel state slice and potentially a new IPC channel for server-side index queries. Deferred until the search feature is scoped. | L2 Section 14 |
| OQ-5 | Large File Threshold | RESOLVED. The large document threshold is 50 pages OR 10MB, whichever is reached first. Documents exceeding this threshold use on-demand page rendering (canvas reuse per §10.2). The threshold values are configurable via the viewer's configuration (runtime configuration key `viewer.pdf.largeDocumentPageThreshold` and `viewer.pdf.largeDocumentSizeThreshold`). Default values: 50 pages, 10MB. | L2 Section 10.1 |
| OQ-6 | Provenance Fetch Strategy | L2 defines provenance metadata (Section 7.3) including a `source` field that includes `'google'` as a value, while the viewer input source only declares `'runtime' \| 'vault'`. Does a Google-sourced document arrive via the vault service (after ingestion) or is there a separate Google-sourced fetch path? This affects the `viewer-pdf:fetch` channel contract and handler routing logic. | L2 Sections 7.1, 7.3, 15 |
| OQ-7 | Validation in Renderer vs Main | The current realization places content validation (type, encoding, size, PDF signature) in the renderer ViewModel. L2 does not specify which process owns validation. Is there a security or performance requirement to move any of these checks to the main process before returning content to the renderer? | L2 Section 5.2 |
| OQ-8 | Push Channel for Render Progress | L2's internal lifecycle (VALIDATING → PDFJS_INIT → SANDBOX_RENDER → DISPLAYED) may benefit from a push channel to report per-stage progress for large documents. No push channel is defined in the current spec. Is renderer-internal state sufficient, or is a `viewer-pdf:render-progress` push channel required for observability integration? | L2 Sections 4.1, 12 |
