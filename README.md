# Prana — Electron Runtime Library & Host Application Shell

**Version 2.0.0** · Electron + TypeScript · Astra MVVM · SQLite Runtime Store · Git-backed Vault

Prana is a standalone **Electron application runtime** that installs, updates, launches, and manages independent applications (Prabandha, Yantra, Niyantr, and custom apps). It provides shared runtime infrastructure — storage, sync, identity, configuration, event coordination — that every application running on the platform consumes rather than reimplements.

> **Technical documentation lives in [`docs/raw/features/`](docs/raw/features/) (feature specs) and [`docs/raw/feature-technical/`](docs/raw/feature-technical/) (technical realization).**
> Each document owns one runtime responsibility and one reason to change.

---

## Table of Contents

- [Architectural Philosophy](#architectural-philosophy)
- [System Architecture](#system-architecture)
- [Astra Dependency](#astra-dependency)
- [Bootstrap & Service Registry](#bootstrap--service-registry)
- [Storage Architecture](#storage-architecture)
- [Core Features](#core-features)
- [Build System](#build-system)
- [Repository Layout](#repository-layout)
- [Security Model](#security-model)
- [Build, Run, and Test](#build-run-and-test)
- [Contribution Workflow](#contribution-workflow)
- [Quick Navigation](#quick-navigation)

---

## Architectural Philosophy

Four governing principles:

1. **Applications Are First-Class Citizens** — Applications (Prabandha, Yantra, Niyantr) are independent deployable units installed and managed by the runtime. They are not plugins, not modules, not embedded libraries. Each is independently installable with its own manifest, version, and lifecycle.

2. **SQLite First** — Applications interact with all data exclusively through the SQLite Runtime Store. No application directly accesses Vault, Git, Google Docs, or Google Sheets. All synchronization runs through runtime services operating outside the application execution path.

3. **Astra MVVM Renderer** — Every UI surface follows Astra's canonical MVVM pattern. Renderer code consumes Astra's `IpcService`, `useDataState`, `AppStateHandler`, and `ServerResponse` — it does not re-implement them. Main Process code owns all IPC handlers, services, and SQLite access.

4. **Docs-First Implementation** — Major changes begin with documentation. Feature specs define WHAT; feature-technical docs define HOW. Implementation follows.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     APPLICATIONS (Prabandha, Yantra, Niyantr)       │
│              Installed, updated, and launched by Prana Runtime       │
│                   Consume IPranaRuntime context                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ IPranaRuntime context
┌──────────────────────────────▼──────────────────────────────────────┐
│                        PRANA MAIN PROCESS (Node.js)                 │
│                                                                     │
│  Bootstrap ──► Service Registry (13 registered services)           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  INFRASTRUCTURE LAYER                                       │   │
│  │  Configuration · Event Registry · SQLite Runtime Store      │   │
│  │  Identity Service · Application Registry                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  STORAGE SYNC PIPELINE                                      │   │
│  │  Storage Scheduler                                          │   │
│  │    └─► Sync Engine                                          │   │
│  │          ├─► Vault Adapter      ──► Git Repository          │   │
│  │          ├─► Document Adapter   ──► Google Docs             │   │
│  │          └─► Sheet Adapter      ──► Google Sheets           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  APPLICATION RUNTIME                                        │   │
│  │  Installer · Updater · Launcher                             │   │
│  │  Shared Configuration (read-only post-OPERATIONAL)          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  INTEGRATION LAYER                                          │   │
│  │  Google Bridge Service (Workspace Bridge)                   │   │
│  │  OAuth port 3111 · Drive discovery · Docs/Sheets sync       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ contextBridge (preload)
┌──────────────────────────────▼──────────────────────────────────────┐
│                     PRANA RENDERER (React + Astra MVVM)             │
│                                                                     │
│  AppStateProvider (root)                                            │
│  ├── Splash / Bootstrap status                                      │
│  ├── Application catalog, install / update / launch surfaces        │
│  ├── Runtime configuration display                                  │
│  ├── Google Workspace sync status & document list                   │
│  ├── Storage Scheduler job monitoring                               │
│  ├── Markdown Viewer (load → validate → sanitize → render)          │
│  └── PDF Viewer (sandboxed rendering)                               │
│                                                                     │
│  Pattern per feature: model/ → repo/ (IpcService) →                │
│                        hooks/ (useDataState) →                      │
│                        view/components/ + view/pages/ (AppStateHandler) │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Astra Dependency

Prana consumes **Astra** (`github:NikhilVijayakumar/astra`) as a runtime dependency. Astra provides the MVVM boilerplate — Prana uses it, not reimplements it.

| Astra Export | What Prana Uses It For |
|---|---|
| `IpcService` | All Renderer→Main IPC calls; instantiated once per feature in `repo/` layer |
| `useDataState<T>()` | All async ViewModel state in `hooks/` layer; returns `[appState, execute, setAppState]` |
| `AppStateHandler` | Conditional rendering in `view/pages/`; priority: LOADING → `isError \|\| status===0` → emptyCondition → children → SuccessComponent → Empty |
| `AppStateProvider` | Wired once at renderer root; features only use `AppStateHandler` |
| `ServerResponse<T>` | All IPC response shapes; Main process handlers always use `ServerResponse.success()` / `ServerResponse.error()` factories |
| `AppState<T>` | `{ state: StateType, isError, isSuccess, status, statusMessage, data }` |
| `StateType` | `INIT=0, LOADING=1, COMPLETED=2`; error is `COMPLETED + isError=true` — no separate ERROR state |

**Key rules:**
- Renderer repositories use `IpcService` exclusively — never `window.electronAPI` directly
- All Main Process IPC handlers return `ServerResponse<T>` — never throw to renderer
- `AppStateProvider` is wired once at renderer root — feature modules never wire it
- `StateCode.IDLE` (not `HttpStatusCode.IDLE`) is the initial status value

**Astra is not:**
- A UI component library (Prana brings its own atoms/molecules)
- A localization library
- A state persistence library
- Part of the Main Process

---

## Bootstrap & Service Registry

Bootstrap initializes the runtime and registers all services in a deterministic, dependency-ordered sequence. Services registered earlier may be consumed by services registered later.

The `IPranaRuntime` context — `{ configuration, events, services, state: 'OPERATIONAL' }` — is created only after all required services register successfully. `prana.initialize()` resolves with this context.

### Registration Order

| # | Service | Registry Key | Required |
|---|---------|-------------|---------|
| 1 | Configuration Service | `configuration` | Yes |
| 2 | Event Registry | `events` | Yes |
| 3 | Storage Service (SQLite) | `storage` | Yes |
| 4 | Storage Scheduler | `storageScheduler` | Yes |
| 5 | Vault Adapter | `vaultAdapter` | Yes |
| 6 | Document Adapter | `documentAdapter` | Yes |
| 7 | Sheet Adapter | `sheetAdapter` | Yes |
| 8 | Sync Engine | `syncEngine` | Yes |
| 9 | Identity Service | `identity` | Yes |
| 10 | Application Registry | `appRegistry` | Yes |
| 11 | Google Bridge Service | `googleBridge` | Yes |
| 12 | Document Service | `documents` | Optional |
| 13 | Sheet Service | `sheets` | Optional |

### Bootstrap States

```
INIT → CONFIGURATION_READY → SERVICES_READY → OPERATIONAL
                                     └─► FAILED (any required service fails)
```

**Teardown** follows reverse registration order. Exception: Event Registry (`events`, #2) is always torn down last — it is held back to preserve observability throughout the entire teardown sequence.

**Technical realization:** [`docs/raw/feature-technical/prana-bootstrap.md`](docs/raw/feature-technical/prana-bootstrap.md)

---

## Storage Architecture

Prana persistence is divided into four logical domains. All domains surface through the **SQLite Runtime Store** — the single access surface for all runtime services and applications.

```
                   ┌──────────────────────────┐
                   │    SQLite Runtime Store   │
                   │   (single access surface) │
                   └────────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │               │               │               │
        ▼               ▼               ▼               ▼
  Local Domain    Vault Domain   Document Domain   Sheet Domain
        │               │               │               │
  (SQLite only)   SQLite +         SQLite +          SQLite +
                  Git repo        Google Docs       Google Sheets
```

| Domain | Authority | Sync Direction | Who Writes |
|--------|-----------|---------------|-----------|
| **Local** | SQLite only | None — never synced | Any runtime service |
| **Vault** | Git repository | PUSH (SQLite → Git) | Sync Engine only |
| **Document** | Google Docs | PULL (Google Docs → SQLite) | Sync Engine only |
| **Sheet** | Google Sheets | PULL (Google Sheets → SQLite) | Sync Engine only |

### Mirror Constraint

Every external domain (Vault, Document, Sheet) must satisfy:

> **SQLite projection MUST exist before the corresponding external record.**

A write that cannot maintain Mirror Constraint consistency is rolled back. Cache-only is allowed. External-only is forbidden.

### Sync Pipeline

```
Storage Scheduler
  └─► dispatch job (PUSH / PULL / VERIFY / RECONCILE / RECOVER)
        └─► Sync Engine
              └─► domain adapter (Vault / Document / Sheet)
                    └─► external system (Git / Google Docs / Google Sheets)
```

The **Sync Engine** is the sole authorized mutator for Vault, Document, and Sheet domains. It enforces Mirror Constraint post-write via an implicit VERIFY on every PUSH or PULL. If VERIFY detects divergence, the write is rolled back.

The **Storage Scheduler** creates VERIFY jobs on a schedule or event trigger, monitors results, and generates RECONCILE or RECOVER jobs as needed. Applications interact only with SQLite — they never touch the sync pipeline.

**Technical realization:** [`docs/raw/feature-technical/storage-architecture.md`](docs/raw/feature-technical/storage-architecture.md) · [`docs/raw/feature-technical/storage-scheduler.md`](docs/raw/feature-technical/storage-scheduler.md) · [`docs/raw/feature-technical/sync-engine.md`](docs/raw/feature-technical/sync-engine.md)

---

## Core Features

### Prana Runtime

Manages the complete lifecycle of applications on the Prana platform.

**Responsibilities:** application installation, version updates, launching, shared runtime configuration, storage infrastructure, identity management, application lifecycle state machine.

**Application lifecycle states:** `NOT_INSTALLED → INSTALLING → INSTALLED → RUNNING → STOPPED`. Update path: `INSTALLED → UPDATING → INSTALLED`. Removal path: `INSTALLED → UNINSTALLING → NOT_INSTALLED`. Failure states: `FAILED` (unrecoverable error), `CORRUPTED` (package hash mismatch — requires reinstall). Crash recovery policy: configurable via application manifest (`crashRecovery: { maxCrashes, windowSeconds }`).

**Not responsible for:** application business logic, application domain models, application startup flow, application authentication, network request logic for applications.

Spec: [`docs/raw/features/prana-runtime.md`](docs/raw/features/prana-runtime.md) · Technical: [`docs/raw/feature-technical/prana-runtime.md`](docs/raw/feature-technical/prana-runtime.md)

---

### Prana Bootstrap

Initializes the Prana Runtime and exposes the `IPranaRuntime` context.

**Responsibilities:** load and validate runtime configuration, initialize and register the 13 core services in order, expose `IPranaRuntime` to applications, enforce OPERATIONAL state before any application launches.

**Not responsible for:** application startup, application identity flows, application readiness checks, business initialization logic.

Spec: [`docs/raw/features/prana-bootstrap.md`](docs/raw/features/prana-bootstrap.md) · Technical: [`docs/raw/feature-technical/prana-bootstrap.md`](docs/raw/feature-technical/prana-bootstrap.md)

---

### Event Registry

In-process, in-memory publish–subscribe event bus for runtime-wide service coordination.

**Responsibilities:** event emission, typed subscription, pattern-based routing, at-most-once intra-tick ordered delivery.

**Key events:** `runtime:startup`, `runtime:shutdown`, `storage:sync:completed`, `document:pull:failed`, `application:started`, `application:crashed`.

**Not responsible for:** persistence, network transport, cross-process delivery, ordered delivery guarantees across processes.

IPC channel: `events:{action}`. Service key: `events`.

Spec: [`docs/raw/features/event-registry.md`](docs/raw/features/event-registry.md) · Technical: [`docs/raw/feature-technical/event-registry.md`](docs/raw/feature-technical/event-registry.md)

---

### Storage Architecture

Defines the four-domain storage model and the Mirror Constraint governing all writes.

See [Storage Architecture](#storage-architecture) above for domain breakdown and sync pipeline. This feature defines the contracts and rules that all storage-touching components must follow.

Spec: [`docs/raw/features/storage-architecture.md`](docs/raw/features/storage-architecture.md) · Technical: [`docs/raw/feature-technical/storage-architecture.md`](docs/raw/feature-technical/storage-architecture.md)

---

### Storage Scheduler

Deterministic job queue for all asynchronous storage operations. The only component that dispatches jobs to the Sync Engine.

**Responsibilities:** job lifecycle management (CREATED → QUEUED → CLAIMED → RUNNING → COMPLETED / failure states), multi-domain lane isolation, concurrency control and execution locking, Mirror Constraint enforcement via scheduled VERIFY/RECONCILE/RECOVER jobs, startup recovery of interrupted jobs.

**Job types:** `PUSH`, `PULL`, `VERIFY`, `RECONCILE`, `RECOVER`

**Trigger types:** event-triggered, time-triggered, startup-triggered, shutdown-triggered, recovery-triggered, manual (IPC).

**Not responsible for:** domain-specific sync logic (Sync Engine), general-purpose task scheduling (not a cron system).

IPC channels: `storage-scheduler:{action}`. Service key: `storageScheduler`.

Spec: [`docs/raw/features/storage-scheduler.md`](docs/raw/features/storage-scheduler.md) · Technical: [`docs/raw/feature-technical/storage-scheduler.md`](docs/raw/feature-technical/storage-scheduler.md)

---

### Sync Engine

The sole authorized mutator for Vault, Document, and Sheet storage domains.

**Responsibilities:** execute PUSH/PULL/VERIFY/RECONCILE/RECOVER operations via domain adapters, enforce Mirror Constraint on every write (post-write implicit VERIFY), maintain write ordering (SQLite projection before external record), delegate all domain-specific logic to adapters.

**System invariants:** single write authority (no bypass), Mirror Constraint enforcement, idempotent execution (safe to retry), write consistency (fail toward known state on divergence).

**Not responsible for:** job scheduling (Scheduler), domain schemas (Storage Architecture), external API access (adapters), conflict resolution strategy.

Service key: `syncEngine`.

Spec: [`docs/raw/features/sync-engine.md`](docs/raw/features/sync-engine.md) · Technical: [`docs/raw/feature-technical/sync-engine.md`](docs/raw/feature-technical/sync-engine.md)

---

### Google Ecosystem Integration (Workspace Bridge)

Native REST bridge to Google Workspace for document, sheet, and metadata synchronization into the local SQLite Runtime Store.

**Responsibilities:** OAuth handshake on port 3111, Drive folder traversal and file enumeration by MIME type, five-stage pipeline per document (DISCOVERED → METADATA_SYNCED → EXTRACTED → STORED → PROJECTED), Google Docs extraction to Markdown projected into Document domain, Google Sheets extraction to structured rows projected into Sheet domain, stale detection via scheduled VERIFY jobs, Google Workspace always treated as non-trusted external system.

**Pipeline:**

```
Discovery → Metadata Sync → Extraction → Local Projection → Vault Persistence (out-of-band)
```

**Not responsible for:** storage scheduling (Storage Scheduler dispatches jobs), domain schema ownership (Storage Architecture), direct application feature access to Google API.

IPC channels: `google-bridge:{action}`. Service key: `googleBridge`.

Spec: [`docs/raw/features/google-ecosystem-integration.md`](docs/raw/features/google-ecosystem-integration.md) · Technical: [`docs/raw/feature-technical/google-ecosystem-integration.md`](docs/raw/feature-technical/google-ecosystem-integration.md)

---

### Viewer — Markdown Screen

Secure, read-only pipeline for loading, validating, sanitizing, and rendering Markdown documents from runtime and vault sources.

**Pipeline:** `IDLE → LOADING → VALIDATING → PARSING → SANITIZING → RENDERED`

**Validation:** file type (text/markdown or .md), encoding (UTF-8), content size (max 10 MB exclusive), parseable Markdown.

**Sanitization:** allowlist-based (tags, attributes, protocols); strips event handlers, style, and `data-*` attributes; fail-closed — no partial render of unsanitized content.

**Not responsible for:** document storage or mutation (read-only), access control (known functional gap), content authoring.

**Renderer implementation:** Astra MVVM — `useMarkdownViewer` hook wraps `useDataState`; `MarkdownViewerPage` uses `AppStateHandler`; `markdownViewerIpc` uses `IpcService`.

IPC channel: `markdownViewer:load`. 

Spec: [`docs/raw/features/viewer-markdown-screen.md`](docs/raw/features/viewer-markdown-screen.md) · Technical: [`docs/raw/feature-technical/viewer-markdown-screen.md`](docs/raw/feature-technical/viewer-markdown-screen.md)

---

### Viewer — PDF Screen

Secure, sandboxed, read-only PDF rendering pipeline for runtime documents, audit reports, and external artifacts.

**Pipeline:** `IDLE → LOADING → VALIDATING → ENGINE_INIT → SANDBOX_RENDER → RENDERED`

**Guarantees:** all content sanitized before render (embedded scripts stripped, launch actions and remote links disabled unconditionally), fail-closed (render fails entirely on sanitization failure), provenance preserved (every rendered document traceable to source system and document ID).

**Large document handling:** documents exceeding 50 pages or 10 MB use on-demand page rendering.

**Not responsible for:** document mutation (read-only), access control enforcement (known functional gap), document storage.

IPC channels: `viewer-pdf:fetch` · `viewer-pdf:fetch-provenance` · `viewer-pdf:log-event`.

Spec: [`docs/raw/features/viewer-pdf-screen.md`](docs/raw/features/viewer-pdf-screen.md) · Technical: [`docs/raw/feature-technical/viewer-pdf-screen.md`](docs/raw/feature-technical/viewer-pdf-screen.md)

---

## Build System

The **Prana Build System** (`prana-build`) is a CLI tool that standardizes how applications are packaged for the Prana Runtime. It operates on the output of the application's own build process (Vite, webpack, etc.).

**Pipeline:**

```
1. Manifest Validation    — required fields, semantic version, appId format
2. Runtime Compatibility  — declared runtimeVersion vs installed runtime
3. Dependency Resolution  — service requirements against Service Registry
4. Hash Generation        — SHA-256 of package archive
5. Publication            — artifact + manifest to configured provider
```

**Key properties:**
- Provider-independent: storage provider is an adapter (Google Drive, S3, GitHub Releases, local)
- Manifest-driven: apps declare `appId`, `version`, `runtimeVersion`, `serviceRequirements`
- Integrity-first: hash generation failure halts the pipeline; unpublished artifacts are never missing a hash
- Fail-safe publication: if manifest publish fails after artifact upload, the orphaned artifact is logged for operator remediation

**CLI:** `prana-build --config prana-build.json`

Spec: [`docs/raw/features/prana-build-system.md`](docs/raw/features/prana-build-system.md) · Technical: [`docs/raw/feature-technical/prana-build-system.md`](docs/raw/feature-technical/prana-build-system.md)

---

## Repository Layout

```text
src/
  main/
    index.ts                      # Electron lifecycle, window management
    preload.ts                    # contextBridge IPC surface (window.electronAPI)
    features/                     # Main Process feature implementations
      bootstrap/                  # pranaBootstrapService — 13-service ordered init
      runtime/                    # App registry, installer, updater, launcher
      storage/                    # SQLite schema, Storage Scheduler, domain adapters
      sync-engine/                # Sync Engine (sole write authority)
      google-bridge/              # Google Workspace bridge (OAuth, Drive, Docs, Sheets)
      identity/                   # Identity Service
      events/                     # Event Registry
      configuration/              # Configuration Service
      viewers/                    # PDF and Markdown viewer IPC handlers
  renderer/
    main.tsx                      # React mount point + AppStateProvider wiring
    features/
      {feature}/
        model/                    # TypeScript types and DTOs
        repo/                     # IpcService-based data access (never window.electronAPI)
        hooks/                    # ViewModel hooks wrapping useDataState
        view/
          components/             # Presentational leaf components (props only)
          pages/                  # Stateful containers (AppStateHandler)

docs/
  raw/
    features/                     # Feature specs (WHAT) — 10 features
    feature-technical/            # Technical realization (HOW) — 10 documents
    external-context/             # astra.md — Astra architecture authority
    data/prompt/                  # Audit and generation prompt engines
    report/                       # Audit report outputs (feature, feature-technical, readme)

prana-build.json                  # Build System configuration (provider + app manifest)
```

---

## Security Model

| Layer | Mechanism |
|---|---|
| **IPC Boundary** | `contextBridge` preload; all IPC through validated `window.electronAPI`; renderer never imports `ipcRenderer` directly |
| **IPC Transport** | `IpcService` (Astra) wraps all Renderer→Main calls; Main handlers return `ServerResponse<T>`, never throw |
| **IPC Response** | All handlers return `ServerResponse.success()` or `ServerResponse.error()` factories; never raw objects |
| **Vault writes** | Sync Engine only; Mirror Constraint enforced on every write (SQLite projection before external record) |
| **Google API** | Timeout-enforced HTTP client; Google Workspace treated as non-trusted external; no runtime-critical dependency on external availability |
| **PDF Viewer** | Sandboxed rendering; launch actions and remote links stripped unconditionally |
| **Markdown Viewer** | Allowlist-based sanitization; fail-closed (no partial render on sanitization failure) |
| **Build artifacts** | SHA-256 hash on every package archive; hash failure halts pipeline; no artifact published without valid hash |
| **Configuration** | Read-only after OPERATIONAL (proxy enforces `ConfigurationMutationError`); no `process.env` access in runtime features |

---

## Build, Run, and Test

**Prerequisites:** Node.js, npm

```bash
# Development
npm run dev              # Start Electron in dev mode with hot reload

# Build
npm run build            # Typecheck + production build
npm run build:win        # Build Windows installer
npm run build:mac        # Build macOS installer
npm run build:linux      # Build Linux installer

# Testing
npm run test             # Run unit tests (alias for test:unit)
npm run test:unit        # Run unit tests via Vitest
npm run test:unit:watch  # Watch mode for unit tests
npm run test:e2e         # Run E2E tests via Playwright
npm run test:e2e:headed  # E2E tests with visible browser
npm run test:watch       # Interactive Playwright UI

# Quality
npm run lint             # ESLint
npm run format           # Prettier
npm run typecheck        # TypeScript (node + web configs)

# Build System (packaging applications for Prana Runtime)
npx prana-build --config prana-build.json
```

---

## Contribution Workflow

### Adding or Modifying Runtime Features

1. Update or create feature spec in [`docs/raw/features/`](docs/raw/features/) — defines WHAT.
2. Update or create feature-technical doc in [`docs/raw/feature-technical/`](docs/raw/feature-technical/) — defines HOW (IPC channels, state machine, module layout, Astra patterns, process boundary).
3. If storage is impacted: verify Mirror Constraint compliance in [`docs/raw/feature-technical/storage-architecture.md`](docs/raw/feature-technical/storage-architecture.md).
4. If a new service is added: add it to the bootstrap registration table in [`docs/raw/feature-technical/prana-bootstrap.md`](docs/raw/feature-technical/prana-bootstrap.md) with the correct position and registry key.
5. Implement in `src/` after doc agreement. Follow the feature-technical doc as the implementation guide.
6. Renderer features follow Astra canonical structure: `model/ → repo/ (IpcService) → hooks/ (useDataState) → view/components/ + view/pages/ (AppStateHandler)`.

### Adding a New Application to the Platform

1. Build and compile the application using its own build toolchain.
2. Create `prana-build.json` with `appId`, `version`, `runtimeVersion`, `serviceRequirements`.
3. Run `npx prana-build --config prana-build.json` to package and publish.
4. The Prana Runtime installs from the configured provider on the target machine.

### Documentation Audit

Run the feature-technical audit to verify all docs stay consistent:

```text
Audit prompt: docs/raw/data/prompt/audit/feature-technical-audit.md
Reports:      docs/raw/report/feature-technical/latest/
```

---

## Quick Navigation

| Resource | Link |
|---|---|
| Feature specs (WHAT) | [`docs/raw/features/`](docs/raw/features/) |
| Technical realization (HOW) | [`docs/raw/feature-technical/`](docs/raw/feature-technical/) |
| Astra architecture authority | [`docs/raw/external-context/astra.md`](docs/raw/external-context/astra.md) |
| Bootstrap registration order | [`docs/raw/feature-technical/prana-bootstrap.md §4.1`](docs/raw/feature-technical/prana-bootstrap.md) |
| Storage domains & Mirror Constraint | [`docs/raw/feature-technical/storage-architecture.md`](docs/raw/feature-technical/storage-architecture.md) |
| Sync pipeline | [`docs/raw/feature-technical/sync-engine.md`](docs/raw/feature-technical/sync-engine.md) |
| Audit prompt (feature-technical) | [`docs/raw/data/prompt/audit/feature-technical-audit.md`](docs/raw/data/prompt/audit/feature-technical-audit.md) |
| Audit prompt (README) | [`docs/raw/data/prompt/audit/readme-audit.md`](docs/raw/data/prompt/audit/readme-audit.md) |
| Implementation generation prompt | [`docs/raw/data/prompt/generation/implementation.md`](docs/raw/data/prompt/generation/implementation.md) |
| Latest audit reports | [`docs/raw/report/`](docs/raw/report/) |
| Main Process entry | [`src/main/index.ts`](src/main/index.ts) |
| Preload bridge | [`src/main/preload.ts`](src/main/preload.ts) |
| Renderer entry | [`src/renderer/main.tsx`](src/renderer/main.tsx) |
