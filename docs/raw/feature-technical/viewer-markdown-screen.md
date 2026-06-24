# Markdown Viewer Engine — Technical Realization

**Version:** 2.0.0
**Feature Spec:** docs/raw/features/viewer-markdown-screen.md
**Architecture Ref:** docs/raw/external-context/astra.md

---

## 1. Overview

This document bridges the Markdown Viewer Engine feature specification (L2) with Astra's architecture patterns (L1) to define how the feature is technically realized within the Prana Electron runtime. It establishes the precise mapping between feature responsibilities and Astra's MVVM boilerplate, IPC contracts, and state lifecycle.

The Markdown Viewer Engine is a renderer-facing feature. The renderer is responsible for requesting document content from the main process via IPC, then executing the full validation, sanitization, and rendering pipeline before presenting output. The main process owns source resolution and raw content delivery. The renderer owns the parsing, sanitization, and rendering pipeline.

This document does not redefine Astra's architectural invariants or the feature's functional requirements. Conflicts and gaps are recorded in Section 17.

---

## 2. Feature Summary

The Markdown Viewer Engine provides a secure, read-only pipeline for loading, validating, sanitizing, and rendering Markdown documents from runtime and vault sources. Its core purpose is to produce trusted, sanitized HTML output from untrusted Markdown input without ever mutating source documents.

Key behaviors:
- Source resolution against `runtimeDocumentStore` (hot) then `vaultService` (cold)
- Strict validation of file type, encoding (UTF-8), and size (maximum 10 MB)
- Deterministic GFM-compliant parsing
- Allowlist-based sanitization before any render output is produced
- Synchronous rendering of sanitized AST to HTML
- Pipeline-stage state emission (IDLE → LOADING → VALIDATING → PARSING → SANITIZING → RENDERED)
- Fail-closed behavior on any pipeline stage failure

The engine is explicitly read-only: it does not mutate documents, does not manage authentication or access control, does not provide export, and does not depend on external systems at render time.

---

## 3. Architecture Mapping

| Feature Concern | Astra Pattern Applied | Prana Layer Responsible |
| :--- | :--- | :--- |
| IPC transport to main process | IpcService (ELECTRON repository pattern) | Renderer — Repository layer |
| IPC response normalization | ServerResponse\<T\> | Main process IPC handler |
| Async state lifecycle (load request) | useDataState (INIT → LOADING → COMPLETED) | Renderer — ViewModel layer (hooks/) |
| Conditional UI rendering | AppStateHandler | Renderer — View layer (view/pages/) |
| Application-wide state slot components | AppStateProvider (wired at renderer root) | Prana renderer root (Prana-owned) |
| Feature module structure | Canonical model/ repo/ hooks/ view/ layout | Renderer — feature module |
| Source resolution and raw content delivery | Main process service (Prana-owned) | Main process — service layer |
| Parsing, sanitization, rendering pipeline | Renderer-side engine logic (Prana-owned) | Renderer — hooks/ and model/ |
| SQLite runtime state | Prana runtime store (Prana-owned) | Main process — storage layer |

The Markdown Viewer Engine maps to the Astra MVVM canonical structure in full. The feature's IPC transport is provided entirely by Astra's `IpcService`. The feature's state lifecycle (INIT → LOADING → COMPLETED) is driven by `useDataState`. Conditional rendering slots (loading, error, empty, content) are routed by `AppStateHandler`. Prana does not re-implement any of these boilerplate components.

---

## 4. Main Process Design

### 4.1 Service Architecture

The main process exposes two services that the Markdown Viewer Engine consumes via IPC:

**runtimeDocumentStore**
- Serves as the hot cache for actively loaded documents.
- The IPC handler for document fetch queries this store first.
- Returns the raw document buffer and metadata (path, format, ownerType) if the document is present.
- Trust level for content from this source: Medium.

**vaultService**
- Serves as the cold archive for committed documents.
- The IPC handler falls back to this source when `runtimeDocumentStore` returns no result.
- Returns decrypted, validated document content per the cross-module contract.
- Trust level for content from this source: High.

The main process IPC handler orchestrates the resolution sequence: attempt `runtimeDocumentStore`, then attempt `vaultService`. If both sources fail to resolve the document, the handler returns `ServerResponse.error(...)` with a structured failure reason. It does not throw to the renderer.

The main process does not perform Markdown parsing, sanitization, or rendering. Its sole responsibility is source resolution and raw content delivery.

### 4.2 IPC Channel Contract

All channels follow the `{feature}:{action}` naming convention. All invoke channels return `ServerResponse<T>`. The main process handler must never throw to the renderer — failures are returned as `ServerResponse.error(...)`.

| Channel | Direction | Request Payload | Response Data (T) | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `markdownViewer:load` | Renderer → Main | `{ source: 'runtime' \| 'vault', path: string, format: 'markdown', ownerType?: string }` | `{ content: string, path: string, format: string, ownerType?: string }` | Fetch raw Markdown content from the appropriate source |

**Success response:** `ServerResponse.success({ status: 200, statusMessage: 'OK', data: { content, path, format, ownerType } })`

**Failure response:** `ServerResponse.error({ status: 404, statusMessage: 'Document not found' })` or `ServerResponse.error({ status: 500, statusMessage: '<structured reason>' })`

The `ownerType` field, if present, must be validated against known values (`VAULT_DOCUMENT`, `SYSTEM_LOG`, `AUDIT_REPORT`, `GOOGLE_DOC`) before returning. Unknown `ownerType` values must be treated as lowest trust level before transmission.

### 4.3 SQLite Schema

The Markdown Viewer Engine is a read-only rendering feature. It does not write to SQLite. It consumes document content from `runtimeDocumentStore` (which manages its own runtime state) and `vaultService` (which manages its own vault state). No SQLite schema is owned by this feature.

Observability counters (document load latency, render latency, sanitizer rejection count, parser failure rate, load failure rate by source) are tracked in-memory within the renderer session. Persistence of observability data, if required, is deferred and recorded as an Open Question.

### 4.4 Startup and Teardown

**Startup:** The IPC handler for `markdownViewer:load` must be registered during Prana main process startup, before any renderer window is created. No pre-warming of content caches is required by this feature — source resolution is on-demand per load request.

**Teardown:** No teardown logic is owned by this feature. Source stores (`runtimeDocumentStore`, `vaultService`) manage their own lifecycle.

---

## 5. Renderer Design (Astra MVVM)

### 5.1 Feature Module Layout

The Markdown Viewer Engine feature module follows Astra's canonical four-layer structure:

| Module | Responsibility |
|---|---|
| model | Document types, engine input/output contracts, engine state types. No logic. |
| repo | IPC data access via IpcService (`markdownViewer:load`). Returns `ServerResponse<T>`. No presentation logic. |
| hooks | ViewModel: `useMarkdownViewer` wrapping `useDataState`; drives the full pipeline (load → validate → parse → sanitize → render). No JSX or UI imports. |
| view — components | Presentational leaf components (rendered HTML display, error display, loading indicator). Receive props only. No data fetching. |
| view — pages | `MarkdownViewerPage`: stateful container composing the ViewModel hook and `AppStateHandler`. No direct repository access. |

### 5.2 Repository Layer (IpcService)

The repository layer uses Astra's `IpcService` to invoke `markdownViewer:load` on the main process. The `IpcService` instance is created once within the repository module. All repository methods return `Promise<ServerResponse<T>>`. The repository never calls `window.electronAPI` directly.

The repository exposes a single operation corresponding to the IPC channel:

- **load(input):** Invokes `markdownViewer:load` with the document input payload. Returns `ServerResponse` carrying the raw content and metadata on success, or an error response on failure.

`IpcService` normalizes all failure conditions — including `window.electronAPI` unavailability and unexpected exceptions — to `ServerResponse.error(...)` with `status: 500`. The repository does not implement try/catch.

### 5.3 ViewModel Layer (useDataState)

The ViewModel is implemented as a custom hook (`useMarkdownViewer`) that wraps `useDataState<EngineState>` from Astra. It is the sole bridge between the view and the repository.

**Lifecycle driven by useDataState:**
- On `execute()` call: state transitions to `LOADING`
- On `ServerResponse` return: state transitions to `COMPLETED` (with `isError: false` or `isError: true`)

**Pipeline orchestration within the ViewModel:**
After the IPC load succeeds (COMPLETED, isError false), the ViewModel orchestrates the renderer-side pipeline stages sequentially:
1. Validate raw content (file type, encoding, size)
2. Parse Markdown deterministically using GFM
3. Sanitize parsed output against the allowlist
4. Render sanitized AST to HTML string

Each stage is performed synchronously where possible. If any stage fails, the ViewModel transitions `appState` to a completed error state with a structured failure reason matching the pipeline stage (VALIDATION\_FAILED, SANITIZATION\_FAILED, etc.).

**Internal engine state vs AppState:**
The feature-level pipeline stages (IDLE → LOADING → VALIDATING → PARSING → SANITIZING → RENDERED) are tracked within the ViewModel's local state. The Astra `AppState` lifecycle (INIT → LOADING → COMPLETED) maps to the coarser IPC fetch operation. The renderer-side pipeline stages are internal to the ViewModel and are surfaced to the view via the `data` field of `AppState<EngineState>`.

The ViewModel does not contain JSX or import UI components. It does not call `setAppState` for normal data fetching — it always uses `execute()`.

### 5.4 View Layer (AppStateHandler)

The `MarkdownViewerPage` container uses `AppStateHandler` from Astra to route rendering based on the current `AppState`. It does not access the repository directly.

**AppStateHandler slot mapping:**

| AppState Condition | Slot Rendered |
| :--- | :--- |
| `state === LOADING` | Loading component (spinner / progress indicator) |
| `isError === true` (COMPLETED + error) | Error component with structured failure message |
| `isSuccess && data !== null && emptyCondition` | Empty component (document not found / no content) |
| `isSuccess && data !== null` | Success: Rendered view displaying the sanitized HTML string from the completed render pipeline |

The `emptyCondition` is applied when the engine state indicates an empty or unresolvable document (e.g., content is empty after sanitization, or source returned no document).

The `errorMessage` prop is populated from the structured failure reason surfaced by the ViewModel.

Rendered HTML output is displayed within a sandboxed container component. The rendered output boundary prevents DOM escape per the feature's sandbox isolation requirement.

### 5.5 AppState Lifecycle Mapping

| Astra StateType | Astra isError | Feature Pipeline Stage | Renderer Behavior |
| :--- | :--- | :--- | :--- |
| INIT (0) | false | IDLE | AppStateHandler renders Empty fallback or nothing |
| LOADING (1) | false | LOADING (IPC in flight) | AppStateHandler renders Loading slot |
| COMPLETED (2) | false | VALIDATING → PARSING → SANITIZING → RENDERED | AppStateHandler renders Success slot with engine state |
| COMPLETED (2) | true | LOAD\_FAILED | AppStateHandler renders Error slot with LOAD\_FAILED reason |
| COMPLETED (2) | true | VALIDATION\_FAILED | AppStateHandler renders Error slot with VALIDATION\_FAILED reason |
| COMPLETED (2) | true | SANITIZATION\_FAILED | AppStateHandler renders Error slot with SANITIZATION\_FAILED reason |

Note: Astra's `AppState` COMPLETED + isError maps all feature-level pipeline failures to the Error slot. The specific failure stage (LOAD\_FAILED, VALIDATION\_FAILED, SANITIZATION\_FAILED, UNSUPPORTED\_FORMAT) is carried in `AppState.data.error` and surfaced in the Error component's message.

---

## 6. Responsibility Realization Matrix

| L2 Responsibility | Realized By | Layer |
| :--- | :--- | :--- |
| Source resolution — runtimeDocumentStore (hot) | Main process IPC handler | Main process — service layer |
| Source resolution — vaultService (cold) | Main process IPC handler | Main process — service layer |
| Emit LOAD\_FAILED if both sources fail | Main process IPC handler returns ServerResponse.error | Main process — IPC handler |
| Content loading (raw buffer fetch) | IPC invoke via IpcService repository | Renderer — repo/ |
| Validate file type (text/markdown or .md) | ViewModel pipeline — validation stage | Renderer — hooks/ |
| Validate encoding (UTF-8) | ViewModel pipeline — validation stage | Renderer — hooks/ |
| Validate content size (max 10 MB) | ViewModel pipeline — validation stage | Renderer — hooks/ |
| Emit VALIDATION\_FAILED on encoding/type/size failure | ViewModel transitions AppState to COMPLETED + isError | Renderer — hooks/ |
| Validate content is parseable Markdown | ViewModel pipeline — validation stage | Renderer — hooks/ |
| Reject binary content / null bytes / malformed encoding | ViewModel pipeline — validation stage | Renderer — hooks/ |
| Parse Markdown deterministically (GFM) | ViewModel pipeline — parsing stage | Renderer — hooks/ |
| Normalize heading and list structure | ViewModel pipeline — parsing stage | Renderer — hooks/ |
| Preserve semantic meaning | ViewModel pipeline — parsing stage | Renderer — hooks/ |
| Flag raw HTML blocks for sanitization | ViewModel pipeline — parsing stage passes to sanitization | Renderer — hooks/ |
| Allowlist-based sanitization (tags, attributes, protocols) | MarkdownSanitizer component invoked by ViewModel | Renderer — hooks/ |
| Strip event handlers, style, data-\* attributes | MarkdownSanitizer | Renderer — hooks/ |
| Emit SANITIZATION\_FAILED on sanitization failure | ViewModel transitions AppState to COMPLETED + isError | Renderer — hooks/ |
| Fail-closed: no partial render of unsanitized content | Sanitization must complete before rendering; ViewModel enforces gate | Renderer — hooks/ |
| Synchronous rendering to HTML string | ViewModel pipeline — rendering stage | Renderer — hooks/ |
| GFM extension support (tables, task lists, strikethrough, autolinks, fenced code) | ViewModel pipeline — rendering stage | Renderer — hooks/ |
| Disable raw HTML passthrough | ViewModel pipeline — rendering stage configuration | Renderer — hooks/ |
| Sandboxed render container | Presentational component enforces DOM isolation | Renderer — view/components/ |
| Context-aware rendering via ownerType | ownerType passed in IPC request; validated before use | Main process + Renderer — model/ |
| Treat unknown ownerType as lowest trust | Main process validates before return; ViewModel validates on receipt | Main process + Renderer — hooks/ |
| Sanitization pipeline enforced regardless of ownerType | Sanitization applied unconditionally | Renderer — hooks/ |
| Read-only enforcement (no document mutation) | Engine is request/response only; no write IPC channels | All layers |
| Deterministic rendering (same input → same output) | Parsing and sanitization are pure functions; no external state dependency | Renderer — hooks/ |
| Observability tracking (latency, rejections, failure rates) | Tracked within ViewModel; surfaced via engine state or telemetry | Renderer — hooks/ |
| Emit structured engine state per pipeline stage | ViewModel updates internal engine state at each stage | Renderer — hooks/ |
| Each stage completes before the next begins | Sequential pipeline execution in ViewModel | Renderer — hooks/ |

---

## 7. Workflow Realization

### Workflow: Load and Render Markdown Document

1. The view layer (`MarkdownViewerPage`) invokes the ViewModel's load trigger with the document input (`source`, `path`, `format`, `ownerType`).
2. The ViewModel calls `execute()` on `useDataState`, transitioning AppState to LOADING.
3. The repository invokes `markdownViewer:load` via `IpcService`. AppStateHandler renders the Loading slot.
4. The main process IPC handler attempts resolution from `runtimeDocumentStore`, then `vaultService`.
5. On success, the handler returns `ServerResponse.success(...)` with raw content and metadata.
6. On resolution failure (both sources fail), the handler returns `ServerResponse.error(...)`. AppState transitions to COMPLETED + isError. AppStateHandler renders the Error slot with LOAD\_FAILED reason.
7. On IPC success, AppState transitions to COMPLETED. The ViewModel begins the renderer-side pipeline:
   a. Validation stage: checks file type, encoding, size. On failure → COMPLETED + isError (VALIDATION\_FAILED).
   b. Parsing stage: GFM parse of content. On failure → COMPLETED + isError (VALIDATION\_FAILED).
   c. Sanitization stage: MarkdownSanitizer applies allowlist rules. On failure → COMPLETED + isError (SANITIZATION\_FAILED).
   d. Rendering stage: sanitized AST rendered to HTML string synchronously.
8. On successful pipeline completion, ViewModel updates AppState data with engine state `{ status: 'RENDERED', content: '<sanitized HTML>' }`.
9. AppStateHandler detects `isSuccess && data !== null` and renders the Success slot with the sanitized HTML string from the completed render pipeline.
10. The sandboxed container component renders the HTML within an isolated boundary.

### Workflow: Pipeline Failure (Any Stage)

1. At any pipeline stage failure, the ViewModel transitions AppState to COMPLETED + isError with the appropriate failure reason.
2. AppStateHandler renders the Error slot with the structured failure message.
3. No partial or unsanitized content is rendered. The pipeline halts immediately at the failing stage.

---

## 8. State Realization

### 8.1 Main Process States

The main process is stateless with respect to the Markdown Viewer Engine. It performs on-demand resolution and returns a single synchronous IPC response per request. There are no persistent main-process states owned by this feature.

Source stores (`runtimeDocumentStore`, `vaultService`) manage their own internal states independently.

### 8.2 Renderer AppState Mapping

The renderer AppState driven by `useDataState` maps to the feature's document state model as follows:

| Feature Document State | Astra AppState | AppStateHandler Slot |
| :--- | :--- | :--- |
| IDLE | INIT (state=0, isError=false, data=null) | Empty fallback |
| LOADING (IPC in flight) | LOADING (state=1) | Loading slot |
| VALIDATING (post-IPC, pre-parse) | COMPLETED (state=2, isError=false, data={status:'VALIDATING'}) | Success slot (intermediate) |
| PARSING | COMPLETED (state=2, isError=false, data={status:'PARSING'}) | Success slot (intermediate) |
| SANITIZING | COMPLETED (state=2, isError=false, data={status:'SANITIZING'}) | Success slot (intermediate) |
| RENDERED | COMPLETED (state=2, isError=false, data={status:'RENDERED', content:'...'}) | Success slot (final — displays HTML) |
| LOAD\_FAILED | COMPLETED (state=2, isError=true, data={status:'ERROR', error:'LOAD_FAILED: ...'}) | Error slot |
| VALIDATION\_FAILED | COMPLETED (state=2, isError=true, data={status:'ERROR', error:'VALIDATION_FAILED: ...'}) | Error slot |
| SANITIZATION\_FAILED | COMPLETED (state=2, isError=true, data={status:'ERROR', error:'SANITIZATION_FAILED: ...'}) | Error slot |
| UNSUPPORTED\_FORMAT | COMPLETED (state=2, isError=true, data={status:'ERROR', error:'UNSUPPORTED_FORMAT: ...'}) | Error slot |

Astra does not define ERROR as a separate StateType. All error conditions are represented as COMPLETED + isError=true. The feature-level pipeline failure stage is carried in `AppState.data.error`.

Note: The intermediate pipeline states (VALIDATING, PARSING, SANITIZING) are surfaced by updating `data.status` within the COMPLETED AppState slot — the view does not show an error slot during pipeline processing. If a failure occurs at any pipeline stage, a final transition to `COMPLETED + isError=true + error={status: 'VALIDATION_FAILED'}` (or the appropriate failure state) occurs in a single `setAppState` call. The intermediate-state data is NOT persisted between the intermediate COMPLETED update and the error COMPLETED update.

---

## 9. Boilerplate Application Mapping

Prana consumes Astra's boilerplate imports from `'astra'`. This feature does not re-implement any Astra boilerplate.

| Astra Export Consumed | Applied In | Purpose |
| :--- | :--- | :--- |
| `IpcService` | repo/ — repository layer | Electron IPC transport for `markdownViewer:load` |
| `ServerResponse<T>` | Main process IPC handler | Response normalization contract |
| `useDataState<EngineState>` | hooks/ — ViewModel | Drives INIT → LOADING → COMPLETED lifecycle |
| `AppStateHandler` | view/pages/ — MarkdownViewerPage | Routes loading / error / empty / success slots |
| `AppStateProvider` | Prana renderer root (wired once) | Provides default Loading/Error/Empty components |
| `AppState<T>`, `StateType`, `StateCode` | hooks/ — ViewModel, model/ — types | State container types |

**Invariants enforced:**
- The repository uses `IpcService` exclusively. `window.electronAPI` is never called directly.
- The ViewModel uses `execute()` for the load operation. `setAppState` is not used for normal data fetching.
- The view does not access the repository directly.
- The main process IPC handler returns `ServerResponse.success(...)` or `ServerResponse.error(...)` using factory methods — never a raw object.
- `AppStateProvider` is wired once at the Prana renderer root. This feature only uses `AppStateHandler`.

---

## 10. Permission Realization

| Access Type | Granted To | Basis |
| :--- | :--- | :--- |
| Read document content from runtimeDocumentStore | Main process IPC handler | Feature is read-only; main process owns store access |
| Read document content from vaultService | Main process IPC handler | Feature is read-only; vault service owns decryption |
| Invoke `markdownViewer:load` via IPC | Renderer repository layer | IPC channel registered at main process startup |
| Render sanitized HTML in sandboxed container | Renderer view layer | Content passes full sanitization pipeline before render |

The engine has no write permissions. No document mutation operations are defined. The feature does not own access control or per-document permission filtering — this is recorded as an architectural gap in L2 (Section 14) and carried forward as an Open Question.

Current no-ACL behavior: in the absence of per-document permission filtering, the main process IPC handler returns document content to any renderer call that provides a valid document path. No session-level or user-level filtering is applied. Access restriction is the responsibility of the calling context (the page or component that initiates the document load). Unauthorized access in the current version means: content is returned if the path resolves — there is no rejection based on caller identity.

---

## 11. Validation Realization

| L2 Validation Rule | Where Enforced | Failure Outcome |
| :--- | :--- | :--- |
| File type must be `text/markdown` or `.md` extension | Renderer ViewModel — validation stage | VALIDATION\_FAILED |
| Encoding must be UTF-8 | Renderer ViewModel — validation stage | VALIDATION\_FAILED |
| Content size must not exceed 10 MB | Renderer ViewModel — validation stage | VALIDATION\_FAILED |
| Content must be parseable Markdown | Renderer ViewModel — validation stage | VALIDATION\_FAILED |
| Binary content, null bytes, malformed encoding rejected | Renderer ViewModel — validation stage | VALIDATION\_FAILED |
| `ownerType` must be a known value | Main process validates before return; Renderer validates on receipt | Unknown ownerType treated as lowest trust level |
| Raw HTML blocks in Markdown flagged before sanitization | Parser output fed to sanitizer — no passthrough | Stripped by sanitizer |
| href/src protocol allowlist (http:, https: only) | Sanitizer | Stripped; SANITIZATION\_FAILED if pipeline fails |
| Event handler attributes stripped | Sanitizer | Stripped; SANITIZATION\_FAILED if pipeline fails |
| style= and \<style\> tags stripped | Sanitizer | Stripped; SANITIZATION\_FAILED if pipeline fails |
| data-\* attributes stripped | Sanitizer | Stripped; SANITIZATION\_FAILED if pipeline fails |
| javascript: and data: protocols blocked | Sanitizer | Stripped; SANITIZATION\_FAILED if pipeline fails |

---

## 12. Error Realization

| L2 Failure Mode | IPC/Pipeline Mechanism | AppState Result | AppStateHandler Slot |
| :--- | :--- | :--- | :--- |
| File not found (both sources fail) | Main process returns `ServerResponse.error(404, ...)` | COMPLETED + isError, data.error = 'LOAD\_FAILED: ...' | Error slot |
| Unsupported format | Renderer ViewModel — validation stage rejects | COMPLETED + isError, data.error = 'UNSUPPORTED\_FORMAT: ...' | Error slot |
| Corrupted content / malformed encoding | Renderer ViewModel — validation stage rejects | COMPLETED + isError, data.error = 'VALIDATION\_FAILED: ...' | Error slot |
| Parse failure | Renderer ViewModel — parsing stage rejects | COMPLETED + isError, data.error = 'VALIDATION\_FAILED: ...' | Error slot |
| Sanitization failure | Renderer ViewModel — sanitization stage rejects | COMPLETED + isError, data.error = 'SANITIZATION\_FAILED: ...' | Error slot |
| window.electronAPI unavailable | IpcService normalizes to `ServerResponse.error(500, ...)` | COMPLETED + isError, data.error = 'LOAD\_FAILED: IPC unavailable' | Error slot |
| IPC handler unexpected exception | Main process catches and returns `ServerResponse.error(500, ...)` | COMPLETED + isError | Error slot |
| Partial render of unsanitized content | Rendering stage is gated behind sanitization stage; pipeline halts on sanitization failure | COMPLETED + isError | Error slot — no partial content rendered |

All errors are fail-closed. The engine never partially renders unsanitized content. The Error slot message is populated from the structured failure reason in `AppState.data.error`.

---

## 13. Integration Realization

### 13.1 Internal Prana Integrations

| Integration | Contract | Trust Level | Notes |
| :--- | :--- | :--- | :--- |
| runtimeDocumentStore | Must provide consistent document access API; returns raw content buffer and metadata | Medium | Hot cache; queried first during source resolution |
| vaultService | Must return decrypted, validated content; returns raw Markdown content | High | Cold archive; queried as fallback |
| Google Bridge | Must provide Markdown projection with source provenance metadata | Low | External-origin content; full sanitization pipeline applies regardless |
| Storage Governance (audit logs) | Engine renders long-form audit log documents | Medium | No special pipeline bypass; size limit enforced |

### 13.2 IPC Surface

| Channel | Request | Response | Notes |
| :--- | :--- | :--- | :--- |
| `markdownViewer:load` | `{ source, path, format, ownerType? }` | `ServerResponse<{ content, path, format, ownerType? }>` | Single IPC call per document load; no streaming |

No push channels (`ipc.receive`) are defined for this feature. The engine is request/response only.

### 13.3 External Systems

The Markdown Viewer Engine has no direct external system dependencies at render time. Google Ecosystem Integration content is projected into Markdown form by the Google Bridge before it reaches this engine. The engine treats all such content as low-trust and applies the full sanitization pipeline.

---

## 14. Ownership Mapping

### 14.1 Responsibility Ownership

| Responsibility | Owner |
| :--- | :--- |
| Source resolution (runtimeDocumentStore, vaultService) | Main process — Prana-owned |
| IPC handler registration and lifecycle | Main process — Prana-owned |
| IPC response normalization (ServerResponse) | Main process — Prana-owned (contract shape from Astra) |
| IPC transport (IpcService) | Renderer repository layer — Astra-provided, Prana-consumed |
| AppState lifecycle (useDataState) | Renderer ViewModel — Astra-provided, Prana-consumed |
| Renderer-side pipeline (validate, parse, sanitize, render) | Renderer ViewModel — Prana-owned |
| MarkdownSanitizer logic | Renderer ViewModel/hooks — Prana-owned |
| Rendering output (HTML string) | Renderer ViewModel — Prana-owned |
| Sandboxed render container | Renderer view/components — Prana-owned |
| AppStateHandler conditional rendering | Renderer view/pages — Astra-provided, Prana-consumed |
| AppStateProvider (root wiring) | Prana renderer root — Prana-owned setup, Astra-provided component |
| Observability tracking | Renderer ViewModel — Prana-owned |
| SQLite runtime state (document stores) | Main process — Prana-owned |

### 14.2 Astra vs Prana Ownership

| Component | Astra Owns | Prana Owns |
| :--- | :--- | :--- |
| IpcService | Boilerplate implementation | Consumes via import from 'astra' |
| ServerResponse\<T\> | Type contract and factory methods | Constructs responses in IPC handlers using factories |
| useDataState | Hook implementation | Wraps in useMarkdownViewer ViewModel hook |
| AppStateHandler | Component implementation and rendering priority | Configures slots and emptyCondition in page component |
| AppStateProvider | Component implementation | Wires at renderer root with design system components |
| AppState, StateType, StateCode | Type definitions | Uses in ViewModel and model layer |
| Electron runtime (ipcMain, contextBridge, BrowserWindow) | Not owned | Owned and managed |
| SQLite, file system, vaultService, runtimeDocumentStore | Not owned | Owned and managed |
| MarkdownSanitizer, GFM parser, rendering pipeline | Not owned | Owned and implemented |

---

## 15. Architecture Traceability Matrix

| L1 Architecture Claim | Applied In This Feature | Evidence |
| :--- | :--- | :--- |
| Feature repositories must use IpcService — never window.electronAPI directly | repo module invokes `markdownViewer:load` via IpcService.invoke() | L1 §Repository Isolation Invariant; §Integration Contracts |
| All IPC invoke calls return ServerResponse\<T\> | Main process handler returns ServerResponse.success/error; IpcService normalizes all responses | L1 §IPC Response Shape; §IpcService Error Normalization |
| Main process IPC handler must never throw to renderer — use ServerResponse.error | Handler wraps both source failures and exceptions in ServerResponse.error | L1 §Integration Contracts — IPC Response Shape |
| ViewModel (hooks layer) is the sole bridge between view and repository | useMarkdownViewer is the only consumer of the repository; view only receives AppState | L1 §MVVM Separation Invariant |
| View must never import repositories or call data-fetching directly | MarkdownViewerPage accesses only the ViewModel hook | L1 §MVVM Separation Invariant |
| ViewModel must contain no JSX or UI imports | useMarkdownViewer contains pipeline logic only | L1 §MVVM Separation Invariant |
| AppStateProvider is wired once at renderer root — features only use AppStateHandler | AppStateProvider is Prana renderer root concern; this feature only uses AppStateHandler | L1 §Integration Contracts — Provider Setup |
| Error is COMPLETED + isError=true — no separate ERROR StateType | All failure states are COMPLETED + isError; feature error stage is in data.error | L1 §State Lifecycle; §AppState and StateType |
| INIT → LOADING → COMPLETED lifecycle | IPC fetch drives INIT → LOADING → COMPLETED; pipeline stages are internal to ViewModel | L1 §State Management; §useDataState |
| ServerResponse constructed only via factory methods — never raw objects | Main process uses ServerResponse.success() and ServerResponse.error() | L1 §ServerResponse static factories; §Common Mistakes |
| Prana does not re-implement Astra boilerplate | IpcService, useDataState, AppStateHandler, AppStateProvider all consumed from 'astra' | L1 §Boilerplate Ownership Invariant |
| AppStateHandler rendering priority (LOADING → error → emptyCondition → children → SuccessComponent) | Slot assignment in MarkdownViewerPage follows fixed priority | L1 §AppStateHandler — Full Props Signature |
| Canonical feature module layout (model, repo, hooks, view components, view pages) | Markdown Viewer Engine follows the canonical four-layer structure (§5.1) | L1 §Feature Module Structure |

---

## 16. Feature Traceability Matrix

| L2 Section | L2 Requirement | Realized In |
| :--- | :--- | :--- |
| §2 System Invariants — Read-Only | Engine must not mutate documents; all ops non-destructive | No write IPC channels; engine is request/response only (§4.2, §10) |
| §2 System Invariants — Sanitization Guarantee | All content through full sanitization before render | Sanitization gate in ViewModel pipeline; fail-closed (§5.3, §12) |
| §2 System Invariants — Source Integrity | Render content exactly as stored | Raw content passed unmodified from IPC response to renderer pipeline (§4.1, §7) |
| §2 System Invariants — Deterministic Rendering | Same input → identical output; no external state dependency | Parsing and sanitization are pure functions; no external runtime calls at render time (§5.3, §13.3) |
| §2 System Invariants — Secure Isolation | All content treated as untrusted; sandboxed render container | Sanitization unconditional; sandboxed container component (§5.4, §9) |
| §3 Architectural Dependencies — runtimeDocumentStore | Hot document source | Main process IPC handler queries first (§4.1, §7) |
| §3 Architectural Dependencies — vaultService | Cold document source | Main process IPC handler queries as fallback (§4.1, §7) |
| §4 Document State Model | Pipeline stage state emission | Internal engine state tracked in ViewModel; mapped to AppState in §8.2 |
| §4.2 Failure States | LOAD\_FAILED, VALIDATION\_FAILED, SANITIZATION\_FAILED, UNSUPPORTED\_FORMAT | All realized as COMPLETED + isError with structured error reason (§8.2, §12) |
| §5.1 Source Resolution | Resolution order: runtime store then vault | IPC handler implements resolution sequence (§4.1) |
| §5.2 Content Loading | Fetch raw buffer; validate type, encoding, size | IPC delivers raw content; ViewModel validates (§4.1, §5.3, §11) |
| §5.3 Validation | Parseable Markdown; reject binary/null/malformed | ViewModel validation stage (§5.3, §11) |
| §5.4 Parsing | GFM; normalize headings/lists; preserve semantics; flag raw HTML | ViewModel parsing stage (§5.3) |
| §5.5 Sanitization | Tag/attribute/protocol allowlist; strip event handlers, style, data-\* | MarkdownSanitizer invoked by ViewModel (§5.3, §11) |
| §5.6 Rendering | Sanitized AST → HTML; GFM extensions; no raw HTML passthrough; synchronous | ViewModel rendering stage (§5.3) |
| §7 Data Contracts | Engine input shape; engine state shape | Defined in feature model/ layer (§5.1) |
| §8 Context-Aware Rendering — ownerType | Validate ownerType; unknown → lowest trust; no sanitization bypass | Validated at main process and ViewModel; sanitization unconditional (§4.2, §11) |
| §9.1 Sanitization Pipeline | Security rule enforcement | MarkdownSanitizer enforces all rules (§5.3, §11, §12) |
| §9.2 Sandbox Isolation | Isolated render container; prevent DOM escape | Sandboxed container component (§5.4) |
| §9.3 Content Trust Levels | Runtime=Medium, Vault=High, External=Low | Propagated via ownerType; does not alter sanitization pipeline (§4.2, §10) |
| §10 Integration Points — Vault System | Preserve content integrity | Raw content passed unmodified (§4.1) |
| §10 Integration Points — Storage Governance | Long-form audit log rendering | No pipeline bypass; size limit enforced (§11) |
| §10 Integration Points — Google Ecosystem | Low-trust external content; full sanitization | ownerType=GOOGLE\_DOC; full pipeline applied (§13.1) |
| §11 Failure Modes | All five scenarios handled | §12 Error Realization covers all five |
| §12 Observability | Latency, rejection count, failure rates | Tracked in ViewModel; exact persistence mechanism deferred (§17) |
| §13 Deterministic Guarantees | Read-only, sanitized, non-mutating, consistent, no external runtime deps | Enforced by architecture (§2, §7, §13.3) |
| §14 Architectural Gaps | Doc-Owner Coupling, Large File, Export, Access Control | Carried to Open Questions (§17) |
| §15 Cross-Module Contracts | runtimeDocumentStore API, vaultService decryption, Google Bridge projection | Reflected in integration contracts (§13.1) |

---

## 17. Open Questions

| ID | Area | Question | Source |
| :--- | :--- | :--- | :--- |
| OQ-1 | Doc-Owner Coupling | L2 §14 identifies no standardized owner binding contract as a High-impact gap. The technical realization assumes `ownerType` is passed as a field in the IPC request and validated at both ends. How is the owner binding contract formalized and where is its authoritative schema defined? | L2 §14 |
| OQ-2 | Large File Handling | L2 §14 identifies no pagination or virtualization for large documents as a High-impact gap. The current design enforces a 10 MB content size limit at the validation stage. Is the 10 MB limit a hard ceiling or a configurable threshold? What is the expected behavior for documents that exceed the limit — is pagination or streaming ever anticipated? | L2 §14, §5.2 |
| OQ-3 | Observability Persistence | RESOLVED. Observability metrics are maintained as in-memory counters per ViewModel session. Per-session metrics (load latency, render latency, sanitizer rejection count, parser failure rate) are not persisted to SQLite. Session metrics are emitted to the Event Registry on session end (document unload) via a `viewer:markdown:session-metrics` event for consumption by infrastructure monitoring. Persistent tracking requires an infrastructure monitoring subscriber — it is not the viewer's responsibility. | L2 §12 |
| OQ-4 | Export | L2 §14 identifies no native export support as a Medium-impact gap. Export is currently out of scope. If export is added in a future iteration, it would require new IPC channels and potentially write-side pipeline stages. No export channel is defined in this document. | L2 §14 |
| OQ-5 | Access Control | L2 §14 identifies no per-document permission filtering as a Medium-impact gap. This feature has no access control mechanism. If per-document permissions are added, the main process IPC handler would need to enforce them before returning content. The renderer should not be the access control boundary. | L2 §14 |
| OQ-6 | Renderer Pipeline Stage Granularity vs AppState | RESOLVED. The view does NOT display progress for intermediate pipeline stages (VALIDATING, PARSING, SANITIZING). The loading slot is displayed for the full duration of the pipeline. Only the final state (RENDERED or ERROR) transitions the view out of the loading slot. `appState.data.status` is used for debugging and observability, not for view branching. | L2 §4.1, L1 §State Management |
| OQ-7 | Google Bridge ownerType Contract | L2 §10.3 states the Google Bridge must provide Markdown projection with source provenance metadata. The IPC request carries `ownerType: 'GOOGLE_DOC'`. Is the Google Bridge responsible for setting `ownerType` before passing the load request to this engine, or does the caller always set `ownerType` explicitly? | L2 §10.3, §8 |
| OQ-8 | runtimeDocumentStore IPC vs Direct Call | The main process IPC handler for `markdownViewer:load` accesses `runtimeDocumentStore` and `vaultService` as internal main-process services. Are these accessed via direct module calls within the main process, or do they have their own IPC channels that the markdown viewer handler delegates to? This affects the handler's internal architecture but not the IPC surface exposed to the renderer. | L2 §3 |
| OQ-9 | RENDER\_READY vs RENDERED Stage Distinction | RESOLVED. RENDER\_READY has no distinct behavioral meaning in the technical realization — the sanitization pipeline produces content that is immediately ready for the synchronous rendering step with no intermediate gate. The pipeline therefore transitions directly from SANITIZING to RENDERED in a single AppState update. RENDER\_READY is not surfaced as a separate stage in the AppState lifecycle. The L2 feature spec's RENDER\_READY stage is collapsed into the RENDERED stage. | L2 §4.1 |
| OQ-10 | Sandbox Isolation Mechanism | L2 §9.2 requires a sandboxed render container that prevents DOM escape. The technical realization assigns this to a presentational component. The specific DOM isolation mechanism (e.g., shadow DOM, iframe sandbox, CSS containment, dangerouslySetInnerHTML with sanitized string) is not defined in L1 or L2. What is the approved sandboxing mechanism in the Prana renderer? | L2 §9.2 |
