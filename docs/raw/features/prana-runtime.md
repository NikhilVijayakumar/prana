# 🚀 Feature: Prana Runtime

**Version:** 2.0.0
**Status:** Core / Foundational
**Capability:** Application runtime platform providing installation, lifecycle management, storage services, shared configuration, update management, and application launching for the Prana ecosystem.

---

## 1. Tactical Purpose

Prana Runtime is the operational foundation of the Prana ecosystem.

It provides:

* application installation
* application updates
* application launching
* shared runtime configuration
* storage infrastructure
* identity management
* application lifecycle management

Prana Runtime is not an application framework.

Prana Runtime is not a plugin host.

Prana Runtime is not a container orchestration system.

Prana Runtime is an application runtime and launcher responsible for managing applications that execute on top of the Prana platform.

---

## 2. Core Principles

### 2.1 Applications Are First-Class Citizens

Applications are independent deployable units.

Examples:

```text
Prabandha
Yantra
Niyantr
Custom Applications
```

Applications are not plugins.

Applications are not runtime modules.

Applications are independently installable products.

---

### 2.2 Shared Runtime Services

Applications consume shared runtime infrastructure. Runtime owns these services — applications resolve and consume them, never reimplement them.

```text
Storage Services     — SQLite, Storage Scheduler, domain adapters
Document Services    — Document domain sync and projection
Sheet Services       — Sheet domain sync and projection
Identity Services    — Authentication, accounts, session management
Event Services       — Event Registry for runtime-wide event coordination
Update Services      — Version discovery, package download, upgrade
```

Applications must not duplicate any of the above.

---

### 2.3 SQLite First

Applications interact with data through SQLite Runtime Store.

Applications do not directly access:

```text
Vault
Git
Google Docs
Google Sheets
```

All synchronization occurs through runtime services.

---

### 2.4 Configuration Centralization

Global runtime configuration is owned by Prana Runtime.

Applications may consume configuration.

Applications should not duplicate shared settings.

Examples:

```text
User Identity
Google Accounts
Storage Locations
Workspace Configuration
Installed Applications
```

---

## 3. What the Runtime Does Not Own

Prana Runtime is an infrastructure layer. It explicitly does not own:

```text
Application business logic
Application domain models
Application feature behavior
Application startup sequence
Application authentication flows
Application-specific schemas and migrations
Network request logic for application features
```

These responsibilities belong to applications. Applications build on top of runtime infrastructure — they do not inherit runtime ownership.

Applications access the runtime through the `IPranaRuntime` context defined in `prana-bootstrap.md`.

---

## 4. Runtime Architecture

### 4.1 High-Level Topology

```text
Prana Runtime
│
├── Identity Service
├── Application Registry
├── Application Installer
├── Application Updater
├── Application Launcher
├── Storage Services
├── Storage Scheduler
├── Event Service (Event Registry)
└── Shared Configuration
        │
        ▼
Applications
```

---

## 5. Runtime Components

### 5.1 Identity Service

**Owner:** Runtime

**Responsibilities:**
- Authentication and credential verification
- User profile and account management
- Account linking across providers
- Session lifecycle management

**Boundary:** Applications resolve identity through this service. Applications do not manage credentials or sessions directly.

---

### 5.2 Application Registry

**Owner:** Runtime

**Responsibilities:**
- Authoritative record of installed applications
- Application metadata and version tracking
- Installation status per application

**Boundary:** Only the Installer and Updater may mutate registry records. Applications read their own registry entry; they do not write to it.

**Record contract:**

```json
{
  "appId": "prabandha",
  "version": "1.4.0",
  "installedAt": "2026-01-01",
  "status": "INSTALLED"
}
```

---

### 5.3 Application Installer

**Owner:** Runtime

**Responsibilities:**
- Package download from distribution provider
- Package integrity verification (hash check)
- Extraction and placement
- Registry record creation on successful install

**Boundary:** Installer is the only service that creates Application Registry records. Applications do not self-register. The distribution provider contract is defined in `prana-build-system.md`.

**Hash verification failure:** If package hash verification fails during installation, the download MUST be discarded. The application transitions to FAILED with reason = `hash_mismatch`. No retry is attempted automatically — restarting the installation operation is required.

---

### 5.4 Application Updater

**Owner:** Runtime

**Responsibilities:**
- Version discovery from distribution provider
- Delta detection (installed vs available)
- Package download and upgrade execution
- Rollback on upgrade failure

**Boundary:** Updater mutates registry records. Applications are notified of updates; they do not initiate them.

**Rollback behavior:** Rollback is triggered automatically when an upgrade fails after extraction begins. On rollback: the previous version's files are restored from the pre-upgrade snapshot retained in the update staging area. The application returns to INSTALLED state at the previous version. If rollback fails (staging area lost or corrupted), the application transitions to FAILED. Rollback is not available if the upgrade fails before extraction begins (download or verify failure) — in those cases, the installed version is unaffected.

---

### 5.5 Application Launcher

**Owner:** Runtime

**Responsibilities:**
- Application process startup and shutdown
- Health monitoring during execution
- Restart on crash within policy limits

**Boundary:** Launcher owns the application process lifecycle. Applications expose a defined entry point; they do not control their own launch.

**Crash recovery policy:** The runtime default is 3 crashes within 60 seconds. When this threshold is exceeded, the application transitions to FAILED and is not relaunched. The policy window and threshold are configurable by the application in its manifest via `crashRecovery: { maxCrashes: N, windowSeconds: T }`. When policy limits are exhausted, an `application:crashed` event is emitted with `policy_exceeded: true`.

---

### 5.6 Shared Configuration Service

**Owner:** Runtime

**Responsibilities:**
- Authoritative store for runtime-wide configuration
- Provides read access to applications via service interface
- Manages storage settings, workspace settings, identity settings

**Boundary:** Applications read configuration through the service API. Applications must not access configuration storage directly or cache configuration independently of this service.

---

### 5.7 Event Service (Event Registry)

**Owner:** Runtime

**Responsibilities:**
- Runtime-wide event emission and subscription
- Decouples runtime services from direct dependencies
- Coordinates lifecycle events across services

**Boundary:** All inter-service communication that does not require a direct return value MUST go through the Event Service. Services must not call each other directly for side-effect notifications.

---

## 6. Application Distribution

### 6.1 Build Model

Applications are distributed as build artifacts.

Prana Runtime does not build applications.

---

#### Build Flow

```text
Application Source
       ↓
Build Pipeline
       ↓
ZIP Package
       ↓
Distribution Provider
```

---

### 6.2 Runtime Installation Flow

**Happy path:**

```text
Discover Build
      ↓
Download Package
      ↓
Verify Package
      ↓
Extract Package
      ↓
Register Application
      ↓
Ready To Launch
```

**Failure branches:**

| Step | Failure | Behavior |
| :--- | :--- | :--- |
| Download Package | Network failure | Retry up to 3 times with exponential backoff; all retries fail → FAILED (reason: `download_failed`) |
| Verify Package | Hash mismatch | Discard download → FAILED (reason: `hash_mismatch`); no retry |
| Extract Package | I/O failure mid-extraction | Cleanup partial extraction → FAILED (reason: `extraction_failed`) |
| Register Application | Write failure after extraction | Cleanup extracted files → FAILED (reason: `registration_failed`) |

---

## 7. Application Metadata

Every application must publish metadata.

---

### Example Metadata

```json
{
  "appId": "prabandha",
  "name": "Prabandha",
  "version": "1.0.0",
  "buildHash": "abc123",
  "runtimeVersion": "2.0.0",
  "downloadUrl": "...",
  "entryPoint": "main.js"
}
```

---

## 8. Storage Integration

Prana Runtime owns storage infrastructure.

Applications consume storage services.

---

### Storage Topology

```text
Application
      ↓
SQLite Runtime Store
      ↓
Storage Scheduler
      ↓
Storage Domains
```

---

### Supported Domains

#### Local Domain

```text
Window Layouts
Theme Settings
Session State
Cache Artifacts
Temporary Files
```

Device-scoped. Not synchronized.

---

#### Vault Domain

```text
Runtime configuration
Registry metadata
Committed knowledge artifacts
System-owned durable state
```

Backed by:

```text
Git
```

Write policy: Sync Engine only. Runtime components read via SQLite projection.

---

#### Document Domain

```text
Knowledge Articles
Policies
Research
Documentation
```

Backed by:

```text
Google Docs
```

---

#### Sheet Domain

```text
Master Data
Reference Data
Catalog Data
```

Backed by:

```text
Google Sheets
```

---

## 9. Runtime Service Boundaries

### What Runtime Owns

```text
Identity — authentication, accounts, sessions
Application Registry — installed state, versions, status
Installation — package download, verification, extraction
Updates — version discovery, upgrade, rollback
Launch — process startup, shutdown, monitoring
Storage Infrastructure — SQLite, Storage Scheduler, domain adapters
Configuration — runtime-wide shared settings
Event Coordination — Event Registry
```

---

### What Applications Own

```text
Business logic
Domain models
Feature behavior
Application-specific schemas and migrations
Application startup sequence
```

---

### Service Resolution Contract

Applications access runtime services through the service registry — never through direct instantiation or file access.

```text
Application
      ↓
Service Registry (resolve)
      ↓
Runtime Service
```

Applications must not:

```text
Instantiate runtime services directly
Read runtime configuration files
Access storage paths outside their domain
Manage their own identity or sessions
```

---

## 10. Lifecycle Management

### Application States

```text
NOT_INSTALLED
      ↓
INSTALLING
      ↓
INSTALLED
      ↓
RUNNING
      ↓
STOPPED
```

---

#### Transition States

```text
UPDATING       — upgrade in progress; application not launchable
UNINSTALLING   — removal in progress; registry record pending deletion
```

---

#### Failure States

```text
FAILED         — installation or launch failed; requires operator action
CORRUPTED      — package integrity check failed; reinstall required
```

---

### State Definitions

| State | Entry Condition | Exit Condition | Launchable |
| :--- | :--- | :--- | :--- |
| NOT_INSTALLED | appId registered with no installation record | Installation triggered by user or update action | No |
| INSTALLING | Installation operation started | All files extracted + registry record written | No |
| INSTALLED | Extraction complete + registry entry verified | Launch or update triggered | Yes |
| RUNNING | Process started successfully | Process exits cleanly or crash limit exceeded | — |
| STOPPED | Clean process exit | Re-launch triggered | Yes |
| UPDATING | Update job dispatched by Updater | New version installed + registry record updated | No |
| UNINSTALLING | Uninstall operation triggered | Files removed + registry record deleted | No |
| FAILED | Unrecoverable error during INSTALLING, UPDATING, or RUNNING | Operator re-triggers install or reinstall (resets to NOT_INSTALLED) | No |
| CORRUPTED | Package integrity check failure on installed files (hash mismatch) | Operator-triggered reinstall resets to NOT_INSTALLED | No |

**CORRUPTED recovery:** automatic reinstall is NOT triggered. The application remains in CORRUPTED state until the operator explicitly initiates a reinstall. The application is not launchable while CORRUPTED.

---

### Invalid Transitions

The following state transitions are not permitted:

| From | To | Reason |
| :--- | :--- | :--- |
| RUNNING | INSTALLING | Application must stop before a new installation |
| INSTALLED | UPDATING | Update must be triggered via the Updater; direct transition not allowed |
| CORRUPTED | UPDATING | Must reinstall to INSTALLED before an update can be applied |
| FAILED | RUNNING | Must recover through NOT_INSTALLED → INSTALLING before relaunching |

---

## 11. Runtime Storage

Prana Runtime maintains its own runtime database.

---

### Runtime Database

Stores:

```text
Application Registry
Installed Versions
Runtime Configuration
User Preferences
Identity Information
Update Metadata
```

---

## 12. Security Model

### Runtime Responsibilities

Prana Runtime is responsible for:

```text
Package Verification
Build Integrity Validation
Configuration Protection
Credential Management
```

---

### Application Responsibilities

Applications are responsible for:

```text
Business Logic
Domain Models
Application Features
```

---

## 13. Observability

The runtime tracks:

```text
Application Launch Events
Installation Events
Update Events
Storage Synchronization
Runtime Health
```

---

## 14. Architectural Invariants

#### Applications Are Independent

Applications must be installable and removable independently.

---

#### Shared Services Are Centralized

Common infrastructure belongs to Prana Runtime.

---

#### SQLite Is The Operational Surface

Applications access storage through SQLite.

---

#### Configuration Is Centralized

Global runtime configuration belongs to Prana Runtime.

---

#### Distribution Uses Build Artifacts

Applications are distributed as packaged builds.

---

#### Runtime Owns Lifecycle

Prana Runtime is the authority for:

```text
Installation
Updates
Launching
Stopping
Uninstalling
```

---

## 15. Future Extensions

Potential future runtime services:

```text
Marketplace
Licensing
Telemetry
Cross-App Communication
Shared Search
```

without changing application architecture.

---

## 16. Completion Status

Prana Runtime is the foundational execution platform for the Prana ecosystem.

It provides:

```text
Identity
Installation
Updates
Launching
Storage
Configuration
Lifecycle Management
```

while allowing applications to focus exclusively on business functionality.
