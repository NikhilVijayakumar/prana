# Prana Runtime — Technical Realization

**Version:** 2.0.0
**Feature Spec:** docs/raw/features/prana-runtime.md
**Architecture Ref:** docs/raw/external-context/astra.md

---

## 1. Overview

Prana Runtime is the foundational execution platform of the Prana ecosystem. It manages the complete lifecycle of applications that run on the Prana platform: installation, version updates, launching, shared configuration, storage infrastructure, identity management, and inter-service event coordination. This document describes how each responsibility defined in the feature spec is technically realized within Prana's Electron architecture, using Astra's boilerplate patterns where applicable.

Prana Runtime is a Main Process-heavy feature. Its core services — Application Registry, Installer, Updater, Launcher, Shared Configuration, Event Service, and Storage Infrastructure — are all implemented as Main Process services. The Renderer Process provides operator-facing surfaces for monitoring and controlling the runtime (application list, installation status, lifecycle transitions) using Astra's canonical MVVM pattern.

---

## 2. Feature Summary

| Attribute | Value |
|-----------|-------|
| Feature Name | Prana Runtime |
| Version | 2.0.0 |
| Status | Core / Foundational |
| Process Boundary | Primary: Main Process (Node.js); Secondary: Renderer (React + Astra MVVM) |
| Persistence | SQLite Runtime Database (Main Process) |
| IPC Transport | Astra IpcService (Renderer → Main); Astra receive() for push events (Main → Renderer) |
| Architecture Dependency | Astra boilerplate: IpcService, ServerResponse, useDataState, AppStateHandler, AppStateProvider |

---

## 3. Architecture Mapping

| L2 Component | Prana Process | Astra Pattern Applied |
|---|---|---|
| Identity Service | Main Process service | IPC handler returning ServerResponse\<T\> |
| Application Registry | Main Process service + SQLite table | IPC handler returning ServerResponse\<T\> |
| Application Installer | Main Process service | IPC handler returning ServerResponse\<T\>; push events via receive() |
| Application Updater | Main Process service | IPC handler returning ServerResponse\<T\>; push events via receive() |
| Application Launcher | Main Process service | IPC handler returning ServerResponse\<T\>; push events via receive() |
| Shared Configuration Service | Main Process service + SQLite table | IPC handler returning ServerResponse\<T\> |
| Event Service (Event Registry) | Main Process service | Internal Main Process event bus; exposed to Renderer via push channel if needed |
| Storage Infrastructure | Main Process (SQLite + Scheduler) | Not directly exposed to Renderer; backing service for all other IPC handlers |
| Renderer operator surfaces | Renderer Process | Astra MVVM: IpcService → useDataState → AppStateHandler |

Astra owns: IpcService, ServerResponse, useDataState, AppStateHandler, AppStateProvider.
Prana owns: all IPC handler implementations, SQLite schema and migrations, service business logic, preload contextBridge, process lifecycle.

---

## 4. Main Process Design

### 4.1 Service Architecture

The Main Process hosts all runtime services. Each service is a discrete unit with a defined responsibility boundary. Services communicate with each other through the Event Service (Event Registry) for side-effect notifications; direct inter-service calls are only used when a synchronous return value is required.

**Identity Service**
Manages authentication, credential storage, user profile, account linking across providers, and session lifecycle. Applications resolve their identity context through this service via IPC; they do not manage credentials or sessions directly.

**Application Registry Service**
Maintains the authoritative record of all installed applications. Stores application metadata, installed version, and installation status. Only the Installer and Updater may write to registry records. Applications may read their own registry entry via IPC; they do not write to it.

**Application Installer Service**
Executes the full installation flow: package discovery, download from distribution provider, hash-based integrity verification, extraction and placement, and registry record creation. It is the sole service authorized to create Application Registry records. The Installer emits progress events through the Event Service during long-running operations; the Renderer receives these via push channels.

**Application Updater Service**
Discovers available versions from the distribution provider, computes delta (installed vs. available), downloads and applies the upgrade package, updates the registry record, and initiates rollback on failure. The Updater emits upgrade lifecycle events through the Event Service. Applications are notified of updates; they do not initiate them.

**Application Launcher Service**
Controls application process startup and shutdown. Monitors process health during execution. Restarts crashed applications within policy limits. Owns the application process lifecycle entirely; applications expose a defined entry point and do not control their own launch.

**Shared Configuration Service**
Maintains the authoritative store of runtime-wide configuration: identity settings, Google account linkage, storage locations, workspace configuration, and the installed application catalog. Provides read access to applications via IPC. Applications must not access configuration storage directly or cache configuration independently.

**Event Service (Event Registry)**
Provides runtime-wide event emission and subscription. Decouples runtime services from direct dependencies. All inter-service communication that does not require a return value must go through the Event Service. Push notifications to the Renderer (for long-running operations such as installation or update progress) are delivered via IpcService's receive() channel pattern.

**Storage Infrastructure**
Manages the SQLite Runtime Database, Storage Scheduler, and domain adapters (Local, Vault, Document, Sheet). Applications interact with data through the SQLite Runtime Store; they do not directly access Vault, Git, Google Docs, or Google Sheets. All synchronization occurs through runtime services.

---

### 4.2 IPC Channel Contract

All invoke channels return `ServerResponse<T>`. Channel format: `{feature}:{action}`.

#### Identity Service Channels

| Channel | Direction | Payload | Response Data |
|---|---|---|---|
| `runtime:identity-get` | invoke | none | User identity record |
| `runtime:identity-link-account` | invoke | Provider credentials | Success confirmation |
| `runtime:session-validate` | invoke | none | Session validity status |

#### Application Registry Channels

| Channel | Direction | Payload | Response Data |
|---|---|---|---|
| `runtime:registry-list` | invoke | none | Array of application registry records |
| `runtime:registry-get` | invoke | `{ appId }` | Single application registry record |

#### Application Installer Channels

| Channel | Direction | Payload | Response Data |
|---|---|---|---|
| `runtime:install` | invoke | `{ appId, downloadUrl }` | Installation result |
| `runtime:install-progress` | receive (push) | none | Installation progress event |

#### Application Updater Channels

| Channel | Direction | Payload | Response Data |
|---|---|---|---|
| `runtime:update-check` | invoke | `{ appId }` | Available version info |
| `runtime:update-apply` | invoke | `{ appId }` | Update result |
| `runtime:update-progress` | receive (push) | none | Update progress event |

#### Application Launcher Channels

| Channel | Direction | Payload | Response Data |
|---|---|---|---|
| `runtime:launch` | invoke | `{ appId }` | Launch result |
| `runtime:stop` | invoke | `{ appId }` | Stop result |
| `runtime:app-state-change` | receive (push) | none | Application lifecycle state event |

#### Shared Configuration Channels

| Channel | Direction | Payload | Response Data |
|---|---|---|---|
| `runtime:config-get` | invoke | `{ key? }` | Configuration record or full config map |
| `runtime:config-set` | invoke | `{ key, value }` | Updated configuration confirmation |

All invoke channels return `ServerResponse<T>` with the Astra-defined shape. Prana's IPC handler implementations must use `ServerResponse.success()` and `ServerResponse.error()` factory methods — never construct raw response objects.

---

### 4.3 SQLite Schema

The Prana Runtime maintains a single runtime SQLite database in the Main Process. All tables below are Prana-owned. Astra has no schema responsibilities.

#### application_registry

| Column | Type | Notes |
|---|---|---|
| app_id | TEXT | Primary key |
| name | TEXT | Display name |
| version | TEXT | Installed version |
| installed_at | TEXT | ISO 8601 timestamp |
| status | TEXT | Enum: NOT_INSTALLED, INSTALLING, INSTALLED, RUNNING, STOPPED, UPDATING, UNINSTALLING, FAILED, CORRUPTED |
| entry_point | TEXT | Application entry file |
| build_hash | TEXT | Integrity hash of installed package |
| runtime_version | TEXT | Minimum compatible runtime version |

#### runtime_configuration

| Column | Type | Notes |
|---|---|---|
| config_key | TEXT | Primary key |
| config_value | TEXT | JSON-serialized value |
| updated_at | TEXT | ISO 8601 timestamp |

#### identity_accounts

| Column | Type | Notes |
|---|---|---|
| account_id | TEXT | Primary key |
| provider | TEXT | Provider identifier (e.g., google) |
| credentials_ref | TEXT | Reference to secured credential store |
| linked_at | TEXT | ISO 8601 timestamp |
| is_active | INTEGER | 1 = active session |

#### update_metadata

| Column | Type | Notes |
|---|---|---|
| app_id | TEXT | Foreign key to application_registry |
| available_version | TEXT | Latest discovered version |
| download_url | TEXT | Package download location |
| checked_at | TEXT | ISO 8601 timestamp |
| build_hash | TEXT | Expected hash of available package |

All schema migrations are Prana-owned. Astra provides no migration tooling.

---

### 4.4 Startup and Teardown

#### Runtime Startup Sequence

1. SQLite Runtime Database initialized and migrations applied.
2. Shared Configuration Service reads runtime configuration from database.
3. Identity Service initializes; existing session validated.
4. Event Service (Event Registry) starts; internal subscriptions registered.
5. Application Registry Service loads installed application records.
6. Storage Scheduler starts; domain adapters initialized.
7. IPC handlers registered on ipcMain for all runtime channels.
8. Renderer process launched; preload contextBridge exposes window.electronAPI.

#### Runtime Teardown Sequence

1. Application Launcher issues stop signals to all running application processes.
2. Storage Scheduler flushes pending sync operations and stops.
3. IPC handlers deregistered.
4. SQLite Runtime Database connection closed cleanly.
5. Event Service flushed and stopped.

Prana owns the complete startup and teardown orchestration. Astra has no startup or teardown responsibilities.

---

## 5. Renderer Design (Astra MVVM)

The Renderer Process provides operator-facing surfaces: the application catalog view, installation and update status, lifecycle controls, and runtime configuration display. All data access from the Renderer to the Main Process uses Astra's IpcService. Prana consumes Astra's boilerplate — it does not re-implement it.

### 5.1 Feature Module Layout

Prana Runtime's Renderer-facing feature module follows Astra's canonical four-layer structure:

| Layer | Responsibility |
|---|---|
| model/ | TypeScript types for application registry records, configuration entries, identity records, lifecycle state events |
| repo/ | Data access via IpcService; one repository per logical service surface (registry, installer, updater, launcher, config) |
| hooks/ | ViewModel hooks wrapping useDataState; one hook per data concern |
| view/components/ | Presentational leaf components receiving typed props only |
| view/pages/ | Stateful page containers composing ViewModel hooks and components |

### 5.2 Repository Layer (IpcService)

Each repository in the runtime feature module instantiates IpcService from Astra and invokes the IPC channels defined in Section 4.2. Prana code must always use IpcService — never call window.electronAPI directly in repository files.

Push event subscriptions (install progress, update progress, app state changes) use IpcService's receive() method. The receive() call returns an unsubscribe function that must be called on component unmount.

All repository methods return `Promise<ServerResponse<T>>`. IpcService normalizes all responses to this shape, including error conditions.

### 5.3 ViewModel Layer (useDataState)

Each ViewModel hook is a custom hook wrapping Astra's useDataState. One ViewModel hook per data concern:

- Application registry list state
- Single application detail state
- Installation operation state
- Update check and apply state
- Launcher control state
- Runtime configuration state

The ViewModel hook calls execute() to trigger the INIT → LOADING → COMPLETED lifecycle. It never imports UI components or contains JSX. setAppState() is used only for optimistic UI updates (e.g., reflecting an in-progress state immediately before the IPC result confirms).

Long-running operations (install, update) that deliver progress via push channels use the receive() pattern in the ViewModel or in the repository, with state updates delivered via setAppState().

### 5.4 View Layer (AppStateHandler)

Each page container renders its data surface using Astra's AppStateHandler, consuming the appState returned by the ViewModel hook. The View layer never imports repositories or calls IpcService directly.

AppStateHandler rendering priority (consumed, not re-implemented by Prana):
1. LOADING → Loading component
2. isError or status === INTERNET_ERROR → Error component
3. isSuccess + data + emptyCondition true → Empty component
4. isSuccess + data + children → children
5. isSuccess + data + SuccessComponent → SuccessComponent
6. Fallback (INIT / no data) → Empty component

AppStateProvider is wired once at the Prana renderer root with design system components. All runtime feature module AppStateHandler instances automatically inherit the provider's Loading, Error, and Empty slot components.

### 5.5 AppState Lifecycle Mapping

| Application State | useDataState Lifecycle | AppState Fields |
|---|---|---|
| Not yet loaded | INIT | state=INIT, data=null, status=StateCode.IDLE |
| Fetching registry / config | LOADING | state=LOADING, data=previous or null |
| Successfully loaded | COMPLETED | state=COMPLETED, isSuccess=true, isError=false, status=200 |
| IPC error or handler failure | COMPLETED | state=COMPLETED, isSuccess=false, isError=true, status=error code |
| Install / update in progress | LOADING (operation state) | state=LOADING, data=null |
| Install / update succeeded | COMPLETED | state=COMPLETED, isSuccess=true |
| Install / update failed | COMPLETED + isError | state=COMPLETED, isError=true |

Error is always COMPLETED + isError === true. There is no separate ERROR StateType value. Prana code must check appState.isError after COMPLETED.

---

## 6. Responsibility Realization Matrix

Every L2 responsibility is mapped to its technical realization below.

| L2 Responsibility | Realized In | Pattern |
|---|---|---|
| Application installation | Main Process: Application Installer Service | IPC invoke channel; SQLite registry write; hash verification; Event Service notification |
| Application updates | Main Process: Application Updater Service | IPC invoke channel; version delta computation; SQLite registry update; rollback on failure |
| Application launching | Main Process: Application Launcher Service | IPC invoke channel; process lifecycle management; health monitoring; restart policy |
| Shared runtime configuration | Main Process: Shared Configuration Service + SQLite runtime_configuration table | IPC invoke channels for get/set; Renderer reads via ViewModel hook |
| Storage infrastructure | Main Process: Storage Infrastructure (SQLite + Scheduler + domain adapters) | Backing service; not directly invoked by Renderer; serves all runtime services |
| Identity management | Main Process: Identity Service + SQLite identity_accounts table | IPC invoke channels; credential reference management; session validation |
| Application lifecycle management | Main Process: Application Registry + Launcher + State model | SQLite application_registry status column; IPC push events for state transitions |
| Application Registry (read/write) | Main Process: Application Registry Service + SQLite | Installer and Updater write; applications and Renderer read via IPC |
| Event coordination | Main Process: Event Service (Event Registry) | Internal pub/sub; decouples services; push events to Renderer via receive() channels |
| Package integrity verification | Main Process: Application Installer Service | Build hash comparison before extraction |
| Rollback on upgrade failure | Main Process: Application Updater Service | Failure path restores prior registry record and package state |
| Service resolution contract | Main Process: Service Registry | Applications resolve runtime services through registry; no direct instantiation |
| Configuration centralization | Main Process: Shared Configuration Service | Single authoritative store; applications read-only via IPC |
| SQLite as operational surface | Main Process: SQLite Runtime Database | All runtime state persisted in SQLite; no direct file or external system access by applications |

---

## 7. Workflow Realization

### Installation Workflow

| Step | Technical Realization |
|---|---|
| 1. Discover build | Application Updater or operator invokes `runtime:update-check`; Updater queries distribution provider |
| 2. Download package | Application Installer Service initiates download; progress emitted via Event Service → `runtime:install-progress` push channel |
| 3. Verify package | Installer computes hash of downloaded package; compares against metadata buildHash |
| 4. Extract package | Installer extracts ZIP to target location |
| 5. Register application | Installer writes record to application_registry table; status set to INSTALLED |
| 6. Ready to launch | Application Registry record reflects INSTALLED status; Launcher may now accept launch requests |

### Update Workflow

| Step | Technical Realization |
|---|---|
| 1. Check for updates | `runtime:update-check` invoke; Updater queries distribution provider; stores result in update_metadata |
| 2. Delta detection | Updater compares installed version in application_registry against available_version in update_metadata |
| 3. Download package | Updater initiates download; progress emitted via `runtime:update-progress` push channel |
| 4. Apply upgrade | Updater replaces package; updates application_registry version and build_hash; status set to UPDATING during operation |
| 5. Rollback on failure | On any failure during upgrade, Updater restores prior package and registry record; status set to FAILED |

### Launch Workflow

| Step | Technical Realization |
|---|---|
| 1. Request launch | Operator or application invokes `runtime:launch` with appId |
| 2. Validate registry | Launcher reads application_registry; verifies status is INSTALLED or STOPPED |
| 3. Start process | Launcher spawns application process using entryPoint from registry record |
| 4. Update status | Launcher updates application_registry status to RUNNING; emits event via Event Service |
| 5. Health monitoring | Launcher monitors process; on crash within policy, restarts; beyond policy sets FAILED |

### Configuration Read Workflow

| Step | Technical Realization |
|---|---|
| 1. Renderer requests config | ViewModel hook calls execute() → repository invokes `runtime:config-get` via IpcService |
| 2. Main Process handler | Shared Configuration Service reads from runtime_configuration SQLite table; returns ServerResponse\<T\> |
| 3. State transition | useDataState drives LOADING → COMPLETED; AppStateHandler renders result |

---

## 8. State Realization

### 8.1 Main Process States

The Application Registry tracks the following application lifecycle states in the application_registry.status column:

| State | Meaning | Trigger |
|---|---|---|
| NOT_INSTALLED | No registry record exists or record is pending deletion | Default / post-uninstall |
| INSTALLING | Installer is executing the installation flow | Installer Service starts |
| INSTALLED | Installation completed successfully; application ready to launch | Installer Service completes |
| RUNNING | Launcher has started the application process | Launcher Service starts process |
| STOPPED | Application process has exited normally | Launcher Service detects clean exit |
| UPDATING | Updater is executing an upgrade | Updater Service starts upgrade |
| UNINSTALLING | Removal is in progress | Uninstall flow initiated |
| FAILED | Installation or launch failed; operator action required | Installer / Launcher error path |
| CORRUPTED | Package integrity check failed; reinstall required | Hash verification failure |

State transitions are written to SQLite by the owning service and emitted as push events via the Event Service to notify the Renderer.

### 8.2 Renderer AppState Mapping

| Renderer Operation | StateType | isError | Notes |
|---|---|---|---|
| Initial page load (before fetch) | INIT | false | status = StateCode.IDLE |
| Fetching registry list | LOADING | false | Previous data preserved (stale-while-reloading) |
| Registry list loaded | COMPLETED | false | isSuccess = true; status = 200 |
| IPC failure on registry fetch | COMPLETED | true | status = 500 or handler error code |
| Install operation in-flight | LOADING | false | Operation-state hook; progress via push channel |
| Install succeeded | COMPLETED | false | isSuccess = true |
| Install failed | COMPLETED | true | isError = true; error surfaced via AppStateHandler |
| Update check in-flight | LOADING | false | |
| Update check returned result | COMPLETED | false | |
| Update apply failed | COMPLETED | true | Rollback triggered in Main Process |

---

## 9. Boilerplate Application Mapping

Prana consumes Astra's boilerplate. It does not re-implement any of the following.

| Astra Boilerplate | How Prana Runtime Consumes It |
|---|---|
| IpcService | Repository layer instantiates IpcService to invoke all runtime IPC channels and subscribe to push event channels |
| ServerResponse\<T\> | All Prana IPC handler implementations return ServerResponse\<T\> using ServerResponse.success() and ServerResponse.error() factory methods |
| useDataState\<T\> | Every ViewModel hook wraps useDataState; execute() drives the fetch lifecycle; setAppState() used only for optimistic or progress-driven updates |
| AppStateHandler | All runtime page containers use AppStateHandler to route LOADING / error / empty / success rendering |
| AppStateProvider | Wired once at Prana renderer root; runtime feature pages inherit Loading, Error, and Empty slot components automatically |
| AppState\<T\>, StateType, StateCode | Runtime ViewModel hooks and views reference these types for state inspection; StateCode.IDLE is the initial status value |

Astra's boilerplate-ownership invariant applies: Prana must not re-implement IpcService, ServerResponse, useDataState, AppStateHandler, or AppStateProvider.

---

## 10. Permission Realization

| Permission Concern | Owner | Realization |
|---|---|---|
| Application Registry write | Installer and Updater only | Enforced in Main Process service layer; no direct registry write IPC channel exposed to applications |
| Configuration write | Runtime Shared Configuration Service only | Applications access configuration read-only via IPC; write channel is runtime-internal |
| Storage domain access | Runtime Storage Infrastructure | Applications access only their assigned storage domain via SQLite; cross-domain access blocked at service layer |
| Identity / credential management | Identity Service | Applications resolve identity through IPC; they do not manage credentials directly |
| Package download and extraction | Installer and Updater only | Distribution and filesystem access is encapsulated in Installer and Updater services |
| Process lifecycle control | Launcher only | Applications expose entry points; they do not control their own launch or shutdown |

---

## 11. Validation Realization

| Validation Concern | Where Validated | Mechanism |
|---|---|---|
| Package integrity | Main Process: Application Installer and Updater | Hash comparison of downloaded package against metadata buildHash before extraction |
| Application metadata completeness | Main Process: Application Installer | Required fields (appId, version, buildHash, runtimeVersion, downloadUrl, entryPoint) validated before installation proceeds |
| Runtime version compatibility | Main Process: Application Installer | Installed runtimeVersion in metadata compared against current Prana Runtime version |
| Registry record existence before launch | Main Process: Application Launcher | Status in application_registry must be INSTALLED or STOPPED before launch is permitted |
| IPC response shape | Astra IpcService (consumed by Prana) | IpcService.invoke() normalizes all responses to ServerResponse\<T\>; Prana IPC handlers must return ServerResponse\<T\> shape |
| Configuration key validity | Main Process: Shared Configuration Service | Key existence and type validation before write; unknown keys rejected |

---

## 12. Error Realization

Every L2 failure mode is mapped to its technical error path below.

| Failure Scenario | L2 Source | Error Realization |
|---|---|---|
| Package download failure | Application Installer / Updater | IPC handler returns ServerResponse.error with status 500; installation status set to FAILED in registry; Event Service emits failure event |
| Package integrity check failed | Application Installer | Installation aborted; status set to CORRUPTED in registry; error returned via IPC; reinstall required |
| Extraction failure | Application Installer | Status set to FAILED; partial extraction cleaned up; error returned via IPC |
| Registry record not found on launch | Application Launcher | IPC handler returns ServerResponse.error with status 404; launch aborted |
| Application already in FAILED or CORRUPTED state | Application Launcher | Launch request rejected; error returned via IPC; operator action required |
| Application process crash | Application Launcher | Launcher detects crash; restart attempted within policy; beyond policy, status set to FAILED; push event emitted via Event Service → Renderer |
| Upgrade failure / rollback | Application Updater | Prior package and registry record restored; status set to FAILED; error returned via IPC |
| Identity / session invalid | Identity Service | IPC handler returns ServerResponse.error with status 401; applications must re-authenticate |
| IpcService unavailable (window.electronAPI missing) | Astra IpcService | IpcService normalizes to ServerResponse with status 500; Renderer AppStateHandler surfaces error state |
| Configuration key not found | Shared Configuration Service | IPC handler returns ServerResponse.error with status 404 |
| Storage domain access violation | Storage Infrastructure | Access blocked at service layer; error returned to calling service; not exposed directly to Renderer |

Error state in the Renderer is always COMPLETED + isError === true. There is no separate ERROR StateType. AppStateHandler renders the error slot when isError is true or status equals INTERNET_ERROR (0).

---

## 13. Integration Realization

### 13.1 Internal Prana Integrations

| Integration | Nature | Contract |
|---|---|---|
| Storage Architecture | Runtime owns Storage Infrastructure; applications and other runtime services access data through SQLite Runtime Store | Storage Scheduler mediates sync to Vault, Document, and Sheet domains; applications do not access external systems directly |
| Event Registry | All inter-service notifications within the Main Process go through the Event Registry | Services subscribe to events rather than calling each other directly for side effects |
| Identity → Configuration | Shared Configuration Service stores identity settings; Identity Service reads from the same SQLite database | Single authoritative configuration store; no duplication |
| Installer → Registry | Installer is the sole writer of new application_registry records | Updater may update existing records; no other service may create registry entries |
| Launcher → Registry | Launcher reads registry to validate launch eligibility and updates status during lifecycle transitions | Status transitions (INSTALLED → RUNNING → STOPPED) owned by Launcher |
| Updater → Registry | Updater writes version, build_hash, and status updates during upgrade operations | Rollback path restores prior values |

### 13.2 IPC Surface

The full IPC surface is defined in Section 4.2. Summary:

| Surface | Channel Prefix | Pattern |
|---|---|---|
| Identity | `runtime:identity-*`, `runtime:session-*` | invoke |
| Application Registry | `runtime:registry-*` | invoke |
| Installer | `runtime:install` | invoke + receive (progress) |
| Updater | `runtime:update-*` | invoke + receive (progress) |
| Launcher | `runtime:launch`, `runtime:stop` | invoke + receive (state change) |
| Shared Configuration | `runtime:config-*` | invoke |

All invoke channels return `ServerResponse<T>`. Push channels use IpcService.receive() and return an unsubscribe function that must be called on Renderer component unmount.

### 13.3 External Systems

| External System | Integration Owner | Access Pattern |
|---|---|---|
| Distribution Provider | Application Installer, Application Updater | Main Process HTTP request for package discovery and download; no direct Renderer access |
| Git (Vault domain) | Storage Infrastructure (Sync Engine) | Vault domain sync only; applications read via SQLite projection |
| Google Docs | Storage Infrastructure (Document domain adapter) | Document domain sync only; applications read via SQLite projection |
| Google Sheets | Storage Infrastructure (Sheet domain adapter) | Sheet domain sync only; applications read via SQLite projection |

Applications never access these external systems directly. All synchronization is managed by the Storage Infrastructure in the Main Process.

---

## 14. Ownership Mapping

### 14.1 Responsibility Ownership

| Responsibility | Owner |
|---|---|
| Identity, accounts, sessions | Prana Runtime (Identity Service) |
| Application Registry (authoritative record) | Prana Runtime (Application Registry Service) |
| Package download and verification | Prana Runtime (Application Installer, Updater) |
| Application lifecycle (install, update, launch, stop) | Prana Runtime |
| Storage Infrastructure (SQLite, Scheduler, domain adapters) | Prana Runtime (Storage Infrastructure) |
| Runtime-wide configuration | Prana Runtime (Shared Configuration Service) |
| Inter-service event coordination | Prana Runtime (Event Service) |
| Business logic, domain models, application features | Individual applications |
| Application-specific schemas and migrations | Individual applications |

### 14.2 Astra vs Prana Ownership

| Concern | Owner | Notes |
|---|---|---|
| IpcService (transport abstraction) | Astra | Prana consumes; never re-implements |
| ServerResponse\<T\> (response contract) | Astra | Prana IPC handlers return this shape using factory methods |
| useDataState (ViewModel lifecycle) | Astra | Prana ViewModel hooks wrap this; never re-implement |
| AppStateHandler (UI state routing) | Astra | Prana View layer consumes; never re-implements |
| AppStateProvider (root context) | Astra | Wired once at Prana renderer root |
| IPC handler implementations (ipcMain) | Prana | Astra has no ipcMain involvement |
| SQLite schema and migrations | Prana | Astra has no persistence responsibilities |
| Electron preload contextBridge | Prana | Exposes window.electronAPI consumed by IpcService |
| BrowserWindow, process lifecycle | Prana | Astra has no Electron runtime responsibilities |
| Event Registry (internal Main Process bus) | Prana | Not an Astra concern |
| Storage domain adapters | Prana | Not an Astra concern |

---

## 15. Architecture Traceability Matrix

| Architectural Invariant (L1) | Application in Prana Runtime |
|---|---|
| MVVM Separation: View never accesses Repository directly | Runtime Renderer Views use AppStateHandler consuming ViewModel state only; no IpcService calls in View layer |
| Repository Isolation: all IPC through IpcService, never window.electronAPI directly | All runtime repository functions use IpcService.invoke() and IpcService.receive(); window.electronAPI is not called directly |
| Dependency Direction: hooks → repo, no circular deps | Runtime ViewModel hooks import only from repo/ and model/; no cross-feature imports |
| Public API Stability: Astra exports through src/lib.ts only | Prana imports IpcService, ServerResponse, useDataState, AppStateHandler, AppStateProvider, AppState, StateType, StateCode from 'astra' only |
| Runtime Boundary: no Electron in Astra core | IpcService delegates to window.electronAPI; Prana owns preload and contextBridge; Astra core has no ipcRenderer or ipcMain imports |
| Boilerplate Ownership: applications consume, not re-implement | Prana does not re-implement IpcService, ServerResponse, useDataState, AppStateHandler, or AppStateProvider |
| IPC handler returns ServerResponse\<T\> | All Prana runtime IPC handlers return ServerResponse\<T\> using factory methods; useDataState processes this shape correctly |
| Error is COMPLETED + isError, not a separate StateType | Runtime ViewModel hooks check appState.isError after COMPLETED; no separate ERROR branch |
| AppStateProvider wired once at renderer root | AppStateProvider is registered at Prana's renderer root; runtime feature modules use AppStateHandler only |
| StateCode.IDLE for initial status | Runtime ViewModel hooks rely on useDataState's initial AppState with status = StateCode.IDLE |

---

## 16. Feature Traceability Matrix

| L2 Section | L2 Requirement | L3 Realization |
|---|---|---|
| §3 Runtime Architecture | Identity Service | Section 4.1: Identity Service; Section 4.2: identity IPC channels; Section 4.3: identity_accounts table |
| §3 Runtime Architecture | Application Registry | Section 4.1: Application Registry Service; Section 4.2: registry IPC channels; Section 4.3: application_registry table |
| §3 Runtime Architecture | Application Installer | Section 4.1: Application Installer Service; Section 4.2: install channels; Section 7: Installation Workflow |
| §3 Runtime Architecture | Application Updater | Section 4.1: Application Updater Service; Section 4.2: update channels; Section 7: Update Workflow |
| §3 Runtime Architecture | Application Launcher | Section 4.1: Application Launcher Service; Section 4.2: launch channels; Section 7: Launch Workflow |
| §3 Runtime Architecture | Storage Services | Section 4.1: Storage Infrastructure; Section 4.3: SQLite schema |
| §3 Runtime Architecture | Event Service | Section 4.1: Event Service; Section 13.1: Internal integrations |
| §3 Runtime Architecture | Shared Configuration | Section 4.1: Shared Configuration Service; Section 4.2: config IPC channels; Section 4.3: runtime_configuration table |
| §4.1 Identity Service | Authentication, credential verification, session lifecycle | Section 4.1, Section 4.2, Section 4.3: identity_accounts, Section 12: identity error paths |
| §4.2 Application Registry | Authoritative record, metadata, version tracking | Section 4.1, Section 4.3: application_registry, Section 10: write permissions |
| §4.3 Application Installer | Download, integrity, extraction, registry creation | Section 4.1, Section 7: Installation Workflow, Section 11: validation, Section 12: install errors |
| §4.4 Application Updater | Version discovery, delta, download, rollback | Section 4.1, Section 7: Update Workflow, Section 12: update errors |
| §4.5 Application Launcher | Process startup, shutdown, health, restart | Section 4.1, Section 7: Launch Workflow, Section 12: crash errors |
| §4.6 Shared Configuration Service | Runtime-wide config, read access via service | Section 4.1, Section 4.2: config channels, Section 7: Configuration Read Workflow |
| §4.7 Event Service | Runtime-wide event emission, decoupling | Section 4.1, Section 13.1 |
| §5 Application Distribution | Build model, ZIP package, distribution provider | Section 4.1: Installer/Updater, Section 7: workflows, Section 13.3: external systems |
| §6 Application Metadata | Required metadata fields | Section 4.3: application_registry columns, Section 11: metadata validation |
| §7 Storage Integration | SQLite, Scheduler, domain adapters | Section 4.1: Storage Infrastructure, Section 4.3: schema, Section 13.1 |
| §8 Runtime Service Boundaries | Service resolution contract; no direct instantiation | Section 10: permission realization, Section 14.1 |
| §9 Lifecycle Management | Application states, transition states, failure states | Section 8.1: Main Process States |
| §10 Runtime Storage | Runtime database contents | Section 4.3: SQLite schema |
| §11 Security Model | Package verification, credential management | Section 11: validation, Section 10: permissions |
| §12 Observability | Launch, install, update, storage, health events | Section 4.1: Event Service; Section 4.2: push channels |
| §13 Architectural Invariants | All six invariants | Section 15: Architecture Traceability Matrix |

---

## 17. Open Questions

| # | Question | Source | Impact |
|---|---|---|---|
| OQ-1 | Does the renderer require a dedicated management UI surface (application catalog, install/update controls, lifecycle status) or is this runtime-internal only? The L2 feature spec focuses on Main Process responsibilities and does not explicitly define which runtime data surfaces are exposed to the Renderer. If no Renderer surface is required, Section 5 and the Renderer IPC channels should be scoped out. | L2 §3, §8 — no Renderer UI specified | Determines whether Astra MVVM sections apply |
| OQ-2 | What is the distribution provider protocol? The L2 spec references a distribution provider for package discovery and download but does not specify the protocol (HTTP API, GitHub Releases, custom registry). This affects how the Installer and Updater perform version discovery and download. | L2 §5, §4.3, §4.4 | Installer and Updater service design |
| OQ-3 | What is the rollback mechanism for the Application Updater? The L2 spec states rollback occurs on upgrade failure, but does not specify whether this is file-system snapshot, registry-only rollback, or re-download of the prior version. | L2 §4.4 | Updater failure path implementation |
| OQ-4 | How are credentials stored in the Identity Service? The L2 spec references credential management but does not specify the secure storage mechanism (OS keychain, encrypted SQLite column, separate vault). The identity_accounts table uses a credentials_ref field as a placeholder; the backing store is undefined. | L2 §4.1, §11 | Security model and identity_accounts schema |
| OQ-5 | What is the service registry mechanism for application service resolution? The L2 spec defines a service resolution contract (Application → Service Registry → Runtime Service) but does not specify whether this is an IPC-based registry, an in-process module, or a discovery file. | L2 §8 — Service Resolution Contract | How applications obtain runtime service references |
| OQ-6 | Are storage domain adapters (Vault/Git, Document/Google Docs, Sheet/Google Sheets) in scope for this feature or owned by separate features (Storage Architecture, Google Ecosystem Integration)? The L2 spec lists these as part of runtime infrastructure but they may have their own feature technical documents. | L2 §7 | Boundary between Prana Runtime and Storage Architecture feature docs |
| OQ-7 | Does the Event Service need an IPC-facing push channel to the Renderer, or is it purely internal to the Main Process? The L2 spec defines the Event Service as a runtime-wide coordination mechanism; the Renderer integration path is not explicit. | L2 §4.7 | Whether receive() channels for lifecycle events are part of the runtime IPC surface |
