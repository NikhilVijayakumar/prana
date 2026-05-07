# Prana Sandbox Runtime Architecture

# Overview

Prana Sandbox Runtime is a runtime orchestration fabric designed for:

* host-controlled runtime execution
* deterministic runtime lifecycle management
* isolated runtime containers
* stateless runtime modules
* centralized operational state
* selective durable persistence
* capability-governed execution
* disposable runtime sessions

The runtime system is conceptually inspired by Docker.

However, Prana is NOT:

* an OCI container runtime
* a Linux container system
* a filesystem virtualization layer
* a kernel namespace abstraction
* a network orchestration platform

Instead, Prana provides:

```text
Application Runtime Container Orchestration
```

inside Electron.

---

# Comparison With Docker

| Aspect | Docker Runtime | Prana Runtime |
|--------|---------------|---------------|
| Core function | OS container orchestration | Application runtime orchestration |
| Parallelism | Multi-container parallelism | Single active runtime model |
| State assumption | Persistent container assumptions | Disposable runtime assumptions |
| Storage ownership | Runtime-owned storage | Host-mediated storage |
| Data model | Filesystem-centric | Operational-data-centric |
| Philosophy | Infrastructure-first | Application-runtime-first |

---

# Core Runtime Philosophy

## Stateless Runtime Execution

Prana runtime modules are:

* stateless
* disposable
* reconstructable
* runtime-hydrated
* operational-state driven

Runtime modules never own durable persistence.

All runtime behavior derives from:

```text
Operational Runtime State
```

stored externally.

---

# Persistence Externalization

## Critical Principle

```text
Runtime images never own persistence.
```

Persistence is externalized into:

* SQLite Runtime Store
* Vault Persistence Service

This allows:

* runtime disposability
* deterministic teardown
* runtime replacement
* runtime reconstruction
* runtime upgrades
* runtime isolation

without persistence corruption.

---

# Host Ownership

## Authoritative Runtime Principle

The host runtime is always authoritative.

**Runtime modules never own:**
* persistence
* orchestration
* synchronization
* lifecycle control
* encryption
* runtime governance

**The host controls:**
* startup
* teardown
* capability injection
* storage mediation
* IPC routing
* synchronization
* recovery
* state reconstruction

---

# Runtime Architecture

## High-Level Runtime Topology

```text
Electron Application
        ↓
Sandbox Runtime Engine
        ↓
Runtime Orchestrator
        ├── Host Runtime Container
        ├── SQLite Runtime Container
        ├── Vault Runtime Container
        └── Runtime Module Containers
```

---

# Runtime Orchestrator

## Definition

Runtime Orchestrator is the orchestration layer responsible for:

* runtime lifecycle management
* runtime container ownership
* runtime startup
* runtime teardown
* runtime supervision
* runtime cleanup
* runtime dependency coordination
* capability enforcement
* runtime execution governance

The Runtime Orchestrator acts similarly to:

```text
A lightweight application runtime kernel.
```

### Transition Guards

Every state transition should validate:

* current state validity
* resource readiness
* capability validity
* IPC readiness
* hydration completion

```ts
transition(current, target) {
  validateTransition(current, target)
  assertResourcesReady()
  assertHydrationComplete()
  performTransition()
}
```

---

# Sandbox Runtime Engine

## Purpose

Sandbox Runtime Engine is the root runtime service.

It is the FIRST runtime system initialized by Electron.

Responsibilities:

* initialize runtime fabric
* create host runtime container
* coordinate runtime startup
* manage runtime containers
* supervise runtime lifecycle
* destroy runtime containers
* enforce deterministic teardown
* coordinate runtime dependencies

The Sandbox Runtime Engine owns the runtime state machine.

---

# Runtime Container Model

## Runtime Containers

Prana containers are:

```text
Lifecycle-managed runtime execution units.
```

They are NOT:

* Linux containers
* kernel-isolated namespaces
* virtual machines
* filesystem sandboxes

Instead, they provide:

* runtime ownership
* execution isolation
* lifecycle control
* deterministic startup/shutdown
* runtime cleanup
* capability boundaries

---

# Runtime Container Characteristics

Every runtime container has:

| Characteristic           | Description                  |
| ------------------------ | ---------------------------- |
| Isolated lifecycle       | Independent startup/shutdown |
| Runtime ownership        | Managed by Runtime Orchestrator    |
| Capability scope         | Explicit runtime permissions |
| Deterministic teardown   | Guaranteed cleanup           |
| Disposable execution     | Can be destroyed safely      |
| Externalized persistence | State stored outside runtime |

---

# Runtime Lifecycle States

## Runtime State Machine

```text
IDLE
CREATED
PREPARING
STARTING
RUNNING
SUSPENDING
STOPPING
DESTROYED
FAILED
```

Only the Sandbox Runtime Engine may transition runtime states.

---

### Runtime Startup Flow

```text
Resolve Runtime Image
        ↓
Validate Runtime Manifest
        ↓
Resolve Capabilities
        ↓
Restore Operational Projections
        ↓
Create Runtime Session
        ↓
Create Isolated Runtime Process
        ↓
Attach IPC Router
        ↓
Inject Runtime APIs
        ↓
Start Runtime Bootstrap
        ↓
Health Validation
        ↓
Runtime Operational
```

---

### Runtime Shutdown Flow

```text
Freeze Runtime Input
        ↓
Flush Pending Operations
        ↓
Commit Required Operational Data
        ↓
Persist Durable Artifacts (if needed)
        ↓
Detach IPC Channels
        ↓
Terminate Runtime Process
        ↓
Cleanup Runtime Resources
        ↓
Release Runtime Session
        ↓
Return Host To IDLE
```

---

# Host Runtime Container

## Purpose

The Host Runtime Container contains the operational host runtime.

The host itself executes inside sandbox orchestration.

Responsibilities:

* runtime coordination
* operational orchestration
* plugin runtime management
* runtime service ownership
* operational state governance

The Host Runtime Container remains active until Electron shutdown.

## Boot Process

The Host Runtime Container's boot process is the **Startup Orchestrator** (`startupOrchestratorService.ts`).

The Sandbox Runtime Engine does not transition the host to `OPERATIONAL` directly — it delegates that responsibility to the Startup Orchestrator running inside the Host Runtime Container.

Boot sequence:

```text
Sandbox Runtime Engine creates Host Runtime Container
        ↓
Host Runtime Container executes Startup Orchestrator as boot process
        ↓
Startup Orchestrator: INIT → FOUNDATION → IDENTITY_VERIFIED → STORAGE_READY → INTEGRITY_VERIFIED → OPERATIONAL
        ↓
Runtime Orchestrator accepts module lifecycle requests
```

Only after the Startup Orchestrator reaches `OPERATIONAL` does the Runtime Orchestrator begin managing Runtime Module Container lifecycles.

---

# SQLite Runtime Container

## Purpose

SQLite Runtime Container owns the operational runtime store.

SQLite acts as:

```text
Centralized Operational Runtime State
```

Responsibilities:

* operational state persistence
* runtime hydration substrate
* runtime coordination state
* ingestion normalization
* operational indexing
* runtime projections
* temporary persistence

SQLite Runtime Container lifecycle:

```text
Starts with Host Runtime
Stops with Host Runtime
```

because operational state is always required.

---

# Operational Runtime Store

## Runtime Philosophy

The SQLite Runtime Store is NOT merely cache.

It is:

```text
The operational execution substrate of the runtime fabric.
```

Runtime modules derive runtime state from operational records.

Examples:

* notifications
* analytics
* onboarding state
* AI operational state
* synchronization metadata
* runtime coordination state
* workflow projections

---

# Runtime Hydration

## Runtime Reconstruction

Runtime modules reconstruct execution state from SQLite.

Hydration flow:

```text
SQLite Runtime Store
        ↓
Runtime Hydration
        ↓
Runtime State Reconstruction
        ↓
Runtime Operational
```

This allows runtime modules to remain:

* stateless
* disposable
* reconstructable

## Cross-Session Continuity

Services with cross-session continuity (e.g., the Context Engine) externalize all state to SQLite before runtime teardown. On the next runtime module startup, they reconstruct from the SQLite operational store.

This is the mechanism by which conversational continuity survives runtime module disposal:

```text
Runtime Teardown
        ↓
Context Engine flushes digests, sessions, messages → SQLite
        ↓
Runtime Module Container destroyed
        ↓
Next Runtime Session starts
        ↓
Context Engine hydrates from SQLite → continuity restored
```

Runtime module disposal does not destroy conversational state — only in-memory execution state. The Context Engine's session lifecycle (`ACTIVE → COMPACTED → ROLLED_OVER → ARCHIVED`) is independent of the runtime container lifecycle.

---

# Vault Runtime Container

## Purpose

Vault Runtime Container owns durable protected persistence.

Vault is NOT:

* operational runtime storage
* shared runtime database
* plugin-owned persistence

Vault is:

```text
Selective durable protected persistence.
```

---

# Vault Responsibilities

Vault stores:

* AI skill configuration
* encrypted protected assets
* archival state
* snapshots
* exportable durable artifacts
* recovery state

Vault supports:

* encryption
* integrity validation
* Git synchronization
* cloud replication
* snapshot recovery

---

# Vault Lifecycle

Vault Runtime Container is lazy-loaded.

Flow:

```text
Vault Request
      ↓
Start Vault Container
      ↓
Perform Operation
      ↓
Flush State
      ↓
Destroy Vault Container
```

Benefits:

* reduced memory usage
* reduced attack surface
* reduced runtime overhead
* deterministic persistence lifecycle

---

# Runtime Module Containers

## Runtime Modules

Runtime modules are sandbox-executed runtime applications.

Each runtime module executes inside:

```text
Runtime Module Container
```

Responsibilities:

* isolated execution
* runtime hydration
* operational processing
* capability-governed access
* deterministic teardown

Only one Runtime Module Container may exist simultaneously.

---

# Runtime Module Philosophy

Runtime modules are:

* execution units
* operational processors
* state-driven runtimes
* disposable runtime sessions

NOT standalone Electron applications.

---

# Runtime Session Manager

## Purpose

Runtime Session Manager owns runtime execution session lifecycle.

Responsibilities:

* session creation and tracking
* session state management
* session journaling
* crash and failure recording
* runtime metrics collection

Sessions are execution-scoped and disposable. They are NOT conversational sessions. Conversation continuity belongs to the Context Engine, which exists independently of runtime container lifecycle.

### Runtime Session Model

```ts
interface RuntimeSession {
  sessionId: string
  runtimeId: string
  runtimeVersion: string
  state: RuntimeState
  startedAt: number
  capabilities: Capability[]
  hydrationVersion: number
  runtimeHealth: RuntimeHealth
  processId?: number
  metadata: Record<string, unknown>
}
```

### Session Journaling

Store:

* transitions
* crashes
* startup failures
* teardown failures
* runtime metrics

This improves debugging, analytics, crash recovery, and orchestration diagnostics.

---

# Runtime Images

## Definition

Runtime images are:

```text
Git-based executable runtime artifacts.
```

A runtime image contains:

* runtime source code
* build artifacts
* runtime metadata
* capability manifest
* runtime configuration

Runtime images do NOT contain persistence.

---

# Runtime Image Manager

## Purpose

Runtime Image Manager owns the lifecycle of Git-based runtime artifacts.

Responsibilities:

* image resolution and retrieval
* manifest validation
* version management
* integrity verification
* build coordination

### Runtime Image Manifest Versioning

```json
{
  "schemaVersion": 1,
  "runtime": {
    "id": "plugin.analytics",
    "entry": "dist/main.js"
  }
}
```

This enables forward compatibility, manifest migration, and runtime validation.

### Runtime Integrity Verification

* checksum validation
* manifest signature verification
* lockfile verification
* artifact hash validation

---

# Runtime Image Structure

Example:

```text
runtime-image/
 ├── runtime.json
 ├── package.json
 ├── src/
 ├── dist/
 └── assets/
```

---

# Runtime Image Pipeline

## Build Flow

```text
Clone Repository
        ↓
Install Dependencies
        ↓
Build Runtime
        ↓
Cache Runtime Artifacts
        ↓
Prepare Runtime Image
```

---

# Runtime Build Cache

## Purpose

Runtime Build Cache avoids repeated runtime rebuilds.

### Recommended Cache Key

```text
repoHash
+ commitHash
+ lockfileHash
+ nodeVersion
+ buildVersion
+ runtimeManifestHash
```

### Layered Build Cache

Separate caches for:

* Dependencies Cache
* Build Artifact Cache
* Asset Cache
* Metadata Cache

Benefits: faster rebuilds, partial invalidation, better CI reuse.

---

# Runtime Capability System

## Capability Governance

Prana uses:

```text
Capability-Oriented Runtime Governance
```

Runtime modules receive only explicitly granted permissions.

### Runtime Policy Enforcement Layer

Every runtime API call passes through policy enforcement:

```text
API Request
     ↓
Policy Validator
     ↓
Capability Resolver
     ↓
Permission Decision
     ↓
Operation Execution
```

---

# Example Runtime Manifest

```json
{
  "id": "runtime.analytics",
  "version": "1.0.0",
  "entry": "dist/main.js",
  "permissions": {
    "sqlite": {
      "read": true,
      "write": true
    },
    "vault": {
      "read": false,
      "write": false
    }
  }
}
```

---

# Runtime IPC Model

## IPC Philosophy

Runtime modules never directly access:

* SQLite internals
* Vault internals
* host runtime internals
* filesystem persistence
* synchronization internals

All interaction occurs through runtime APIs.

---

# Runtime IPC Topology

```text
Runtime Module Container
        ↓
Sandbox IPC Gateway
        ↓
Host Runtime Container
        ↓
Runtime Services
```

---

# Sandbox IPC Gateway

## Purpose

Sandbox IPC Gateway acts as:

```text
Runtime policy enforcement layer.
```

Responsibilities:

* capability validation
* runtime request routing
* runtime isolation enforcement
* runtime boundary mediation
* runtime lifecycle signaling

The Sandbox IPC Gateway is NOT a replacement for the Notification Centre.

It exists only for:

```text
Sandbox runtime boundary governance.
```

### Runtime IPC Architecture

```text
Runtime Process
      ↓
Runtime IPC Client
      ↓
Sandbox IPC Gateway
      ↓
Capability Validator
      ↓
Host Services
      ↓
Operational Store / Vault / Sync
```

### Runtime Module Event Emission

Runtime modules cannot directly access `hookSystemService` or any host-internal event bus. Event emission to the Notification Centre is mediated through the Sandbox IPC Gateway:

```text
Runtime Module
      ↓
Sandbox IPC Gateway (capability-validated)
      ↓
Host Runtime → hookSystemService
      ↓
Notification Centre
```

This preserves sandbox isolation while allowing runtime modules to surface operational events (e.g., analytics completions, AI state changes) into the system-wide event pipeline.

### Structured IPC Messages

```ts
interface IPCMessage<T = unknown> {
  id: string
  type: string
  sessionId: string
  runtimeId: string
  payload: T
  timestamp: number
}
```

---

# Runtime Isolation Model

## Isolation Strategy

Isolation is enforced through:

* process isolation
* lifecycle ownership
* capability restriction
* API mediation
* deterministic teardown
* runtime cleanup

Prana intentionally avoids:

* kernel namespaces
* container networking
* mounted filesystem virtualization
* OCI isolation semantics

because Prana is:

```text
Application-runtime oriented.
```

---

# Runtime Cleanup

## Deterministic Teardown

Deterministic cleanup is a core architectural requirement.

During runtime shutdown:

* runtime memory destroyed
* IPC connections removed
* temporary runtime resources destroyed
* runtime session removed
* runtime container destroyed

Goal:

```text
Prevent runtime leakage across execution sessions.
```

---

# Runtime Supervision

## Sandbox Supervisor

Sandbox Supervisor monitors runtime container health.

### Monitoring Responsibilities

| Concern | Strategy |
|---------|----------|
| Crash detection | Heartbeat monitoring |
| Deadlock detection | IPC timeout tracking |
| Zombie processes | Process tree cleanup |
| Memory leaks | Heap threshold monitoring |
| Infinite loops | Event loop lag monitoring |
| Hung startup | Startup timeout enforcement |

Responsibilities:

* runtime crash detection
* cleanup enforcement
* timeout detection
* runtime heartbeat validation
* zombie runtime prevention
* runtime recovery

Sandbox Supervisor uses:

```text
Vaidyar diagnostic telemetry
```

as its runtime observation source.

### Runtime Health Scoring

```ts
interface RuntimeHealth {
  heartbeat: boolean
  memoryUsage: number
  ipcLatency: number
  eventLoopLag: number
  lastActivity: number
}
```

Health scoring enables automatic recovery, runtime restart, runtime diagnostics, and telemetry.

Relationship:

```text
Vaidyar
   ↓ observes
Sandbox Supervisor
   ↓ acts
Runtime Orchestrator
```

---

# Runtime Dependency Topology

## Runtime Dependency Graph

```text
Sandbox Runtime Engine
        ↓
Host Runtime Container
        ├── SQLite Runtime Container
        ├── Vault Runtime Container
        └── Runtime Module Container
```

---

# Runtime Development Model

## Plugin Sandbox Host

Plugin Sandbox Host is a lightweight runtime launcher used during runtime module development.

Responsibilities:

* create sandbox runtime environment
* inject SQLite operational state
* launch runtime modules
* validate runtime lifecycle
* cleanup runtime containers

Plugin Sandbox Host intentionally avoids:

* service mocking
* infrastructure emulation
* fake runtime systems

because runtime behavior derives from:

```text
Operational runtime state
```

rather than mocked services.

---

# Runtime Optimization Strategy

## Current Optimization Priorities

Primary priorities:

* lifecycle correctness
* runtime determinism
* runtime cleanup
* capability governance
* runtime hydration
* orchestration stability

NOT:

* low-level kernel optimization
* container networking
* filesystem virtualization
* native micro-optimization

---

# Technology Stack

| Component           | Technology                     |
| ------------------- | ------------------------------ |
| Runtime Engine      | Electron + TypeScript          |
| Runtime Containers  | child_process / utilityProcess |
| Runtime Store       | SQLite                         |
| Durable Persistence | Vault                          |
| Cloud Sync          | Git                            |
| Runtime Images      | Git repositories               |
| Runtime Isolation   | Process lifecycle isolation    |

---

# Future Native Optimization

Native optimization is optional and deferred.

Potential future native candidates:

| Component      | Candidate |
| -------------- | --------- |
| Vault Engine   | Rust      |
| Compression    | Rust      |
| Binary Storage | Rust      |
| Vector Search  | Rust      |
| Sync Daemon    | Go        |

Native optimization should occur only after runtime stabilization.

---

# Architectural Invariants

## Invariant: Single Active Runtime Module

Only one Runtime Module Container may execute simultaneously.

---

## Invariant: Externalized Persistence

Runtime images never own persistence.

---

## Invariant: Stateless Runtime Modules

Runtime modules remain disposable and reconstructable.

---

## Invariant: Deterministic Runtime Teardown

Runtime cleanup must completely destroy runtime execution state.

---

## Invariant: Capability Governance

Runtime modules receive only explicitly granted permissions.

---

## Invariant: Runtime Storage Mediation

Runtime modules never directly access persistence internals.

---

# Final Summary

Prana Sandbox Runtime Architecture is a:

```text
Host-controlled application runtime orchestration fabric
```

built inside Electron.

The architecture combines:

* runtime image execution
* runtime container lifecycle
* centralized operational state
* selective durable persistence
* capability-governed execution
* deterministic teardown
* disposable runtime sessions

while intentionally avoiding:

* kernel container complexity
* OCI networking
* mounted filesystem virtualization
* Linux namespace semantics

because the architecture is fundamentally:

```text
Application-runtime oriented rather than infrastructure-container oriented.
```
