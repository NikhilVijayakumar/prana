# Feature: Prana Sandbox Runtime

**Version:** 1.1.0
**Status:** Implemented / Core
**Capability:** Host-controlled application runtime orchestration fabric with capability governance, deterministic lifecycle management, and a lightweight development runtime for plugin testing.

---

## 1. Tactical Purpose

The **Prana Sandbox Runtime** is the execution fabric of the runtime. It manages:

* **Production Runtime** — orchestrates host, storage, and plugin module containers with capability governance, deterministic lifecycle, and Vault–SQLite sync
* **Development Runtime** — provides a lightweight bootstrap environment for plugin development and testing using real SQLite operational state rather than service mocking

The runtime is conceptually inspired by Docker but is:

```text
Application Runtime Container Orchestration
```

inside Electron — not an OCI runtime, not a kernel namespace abstraction, not a filesystem virtualization layer.

---

## 2. Core Principles

### 2.1 Stateless Runtime Modules

Runtime modules are:

* stateless
* disposable
* reconstructable
* runtime-hydrated
* operational-state driven

Runtime modules never own durable persistence. All behavior derives from:

```text
Operational Runtime State (SQLite)
```

### 2.2 Host Ownership

The host runtime is always authoritative.

**Runtime modules never own:**
- persistence, orchestration, synchronization, lifecycle control, encryption, runtime governance

**The host controls:**
- startup, teardown, capability injection, storage mediation, IPC routing, synchronization, recovery, state reconstruction

### 2.3 Persistence Externalization

```text
Runtime images never own persistence.
```

Persistence is externalized into SQLite Runtime Store and Vault Persistence Service. This enables runtime disposability, deterministic teardown, runtime replacement, and reconstruction without persistence corruption.

---

## 3. Runtime Architecture

### 3.1 High-Level Topology

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

## 4. Container Model

### 4.1 Runtime Container Characteristics

Every runtime container has:

| Characteristic | Description |
| -------------- | ----------- |
| Isolated lifecycle | Independent startup/shutdown |
| Runtime ownership | Managed by Runtime Orchestrator |
| Capability scope | Explicit runtime permissions |
| Deterministic teardown | Guaranteed cleanup |
| Disposable execution | Can be destroyed safely |
| Externalized persistence | State stored outside runtime |

### 4.2 Container Types

**Host Runtime Container** — Contains the operational host runtime. Remains active until Electron shutdown. Boot process is the Startup Orchestrator.

Boot sequence:
```text
Sandbox Runtime Engine creates Host Runtime Container
        ↓
Startup Orchestrator: INIT → FOUNDATION → IDENTITY_VERIFIED → STORAGE_READY → INTEGRITY_VERIFIED → OPERATIONAL
        ↓
Runtime Orchestrator accepts module lifecycle requests
```

**SQLite Runtime Container** — Owns centralized operational runtime state. Starts and stops with Host Runtime. Runtime modules derive all execution state from this store.

**Vault Runtime Container** — Owns durable protected persistence. No host service or runtime module accesses Vault directly during runtime. All Vault data is projected into SQLite on startup and flushed back on shutdown.

**Runtime Module Containers** — Execute sandbox runtime applications (plugins). Only one may exist simultaneously. Stateless, disposable, reconstructable.

---

## 5. Lifecycle States

### 5.1 Engine-Level State

```text
uninitialized → booting → operational → shutdown
                    ↓
                 failed
```

`operational` is the only state accepting module lifecycle operations. Enters `operational` only after Startup Orchestrator reaches `OPERATIONAL`.

### 5.2 Container State Machine

```text
IDLE → CREATED → PREPARING → STARTING → RUNNING → STOPPING → DESTROYED
                                              ↓          ↑
                                         SUSPENDING ─────┘
                                              ↓
                                         STOPPING → DESTROYED
                                              ↓
                                           FAILED → IDLE
```

**Valid transitions:**

| From | To (allowed) |
| ---- | ------------ |
| IDLE | CREATED, FAILED |
| CREATED | PREPARING, FAILED |
| PREPARING | STARTING, FAILED |
| STARTING | RUNNING, FAILED |
| RUNNING | SUSPENDING, STOPPING, FAILED |
| SUSPENDING | RUNNING, STOPPING, FAILED |
| STOPPING | DESTROYED, FAILED |
| DESTROYED | (terminal) |
| FAILED | IDLE |

Invalid transitions throw immediately. Only the Sandbox Runtime Engine may trigger transitions.

### 5.3 Transition Guards

Every transition validates:
* current state validity
* resource readiness
* capability validity
* IPC readiness
* hydration completion

### 5.4 Startup Flow

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

### 5.5 Shutdown Flow

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

## 6. Vault–SQLite Sync Protocol

### 6.1 Projection (Startup)

```text
Vault Container starts
      ↓
Decrypt durable artifacts
      ↓
Write projected records into SQLite vault_cache tables
      ↓
Vault Container suspends
```

SQLite `vault_cache` tables are the live operational representation of Vault state during runtime. No service accesses Vault directly during operation.

### 6.2 Flush (Shutdown)

```text
Runtime teardown initiated
      ↓
Read modified vault_cache records from SQLite
      ↓
Re-encrypt and write back to Vault
      ↓
Vault Container destroyed
```

### 6.3 Conflict Policy

SQLite cache is authoritative during runtime operation.

On cold start:
* no existing SQLite state → Vault projection is source of truth
* existing SQLite state present (e.g., after crash) → more recent record wins; conflicts are journaled

### 6.4 Encryption Boundary

Host decrypts Vault data during projection. SQLite `vault_cache` operates on plaintext within trusted host process. Host re-encrypts before flushing back to Vault. Encryption boundary is exclusively at the Vault container interface.

### 6.5 Sandbox and Test Mode

Vault projection is replaced by fixture injection. SQLite cache seeded directly from fixture files. No Vault container starts. Temp SQLite file discarded on teardown. Sandbox sessions operate identically to production without Vault infrastructure.

---

## 7. Runtime Hydration

Runtime modules reconstruct execution state from SQLite:

```text
SQLite Runtime Store
        ↓
Runtime Hydration
        ↓
Runtime State Reconstruction
        ↓
Runtime Operational
```

### 7.1 Cross-Session Continuity

Services with cross-session continuity (e.g., Context Engine) externalize all state to SQLite before runtime teardown. On next startup, they reconstruct from the SQLite operational store. Runtime module disposal does not destroy conversational or session state — only in-memory execution state.

---

## 8. Capability System

### 8.1 Capability Governance

```text
Capability-Oriented Runtime Governance
```

Runtime modules receive only explicitly granted permissions.

### 8.2 Policy Enforcement

Every runtime API call passes through policy enforcement:

```text
API Request → Policy Validator → Capability Resolver → Permission Decision → Operation Execution
```

### 8.3 Example Runtime Manifest

```json
{
  "id": "runtime.analytics",
  "version": "1.0.0",
  "entry": "dist/main.js",
  "permissions": {
    "sqlite": { "read": true, "write": true },
    "vault": { "read": false, "write": false }
  }
}
```

---

## 9. Runtime IPC Model

### 9.1 IPC Philosophy

Runtime modules never directly access SQLite internals, Vault internals, host runtime internals, filesystem persistence, or synchronization internals. All interaction occurs through runtime APIs.

### 9.2 IPC Topology

```text
Runtime Module Container
        ↓
Sandbox IPC Gateway
        ↓
Host Runtime Container
        ↓
Runtime Services
```

### 9.3 Sandbox IPC Gateway

Acts as runtime policy enforcement layer:

* capability validation
* runtime request routing
* runtime isolation enforcement
* runtime boundary mediation
* runtime lifecycle signaling

### 9.4 Runtime Module Event Emission

Runtime modules cannot directly access the host event bus. Event emission to the Notification Centre is mediated through the Sandbox IPC Gateway:

```text
Runtime Module
      ↓
Sandbox IPC Gateway (capability-validated)
      ↓
Host Runtime → Hook System → Notification Centre
```

### 9.5 IPC Handlers (Renderer → Main)

| Handler | Description |
| ------- | ----------- |
| `sandbox:initialize` | Initialize engine; boot Host Runtime Container |
| `sandbox:status` | Return engine state and full container listing |
| `sandbox:start-module` | Start Runtime Module Container from resolved image path |
| `sandbox:stop-module` | Stop the currently active Runtime Module Container |
| `sandbox:shutdown` | Shutdown entire engine; destroy all sessions |
| `sandbox:plugin-launch` | Create Plugin Sandbox Host instance and fork plugin process |
| `sandbox:plugin-shutdown` | Shutdown a Plugin Sandbox Host instance |
| `sandbox:plugin-status` | Get Plugin Sandbox Host status |
| `sandbox:plugin-journal` | Retrieve session journal entries (max 1000) |
| `sandbox:plugin-health` | Run on-demand health evaluation for active plugin session |

---

## 10. Runtime Supervision

### 10.1 Sandbox Supervisor

Monitors runtime container health.

| Concern | Strategy | Threshold |
| ------- | -------- | --------- |
| Crash detection | Heartbeat monitoring | 15,000 ms since last activity → recover |
| Memory leaks | Heap threshold monitoring | > 512 MB → restart |
| IPC latency | Timeout tracking | > 2,000 ms → logged |
| Vaidyar blocked | Diagnostic signal | Blocked status → destroy |

Monitoring interval: 5,000 ms.

### 10.2 Runtime Health Model

Health scoring enables automatic recovery, runtime restart, and telemetry. Fields tracked: heartbeat, memory usage, IPC latency, event loop lag, last activity timestamp.

### 10.3 Supervision Hierarchy

```text
Vaidyar
   ↓ observes
Sandbox Supervisor
   ↓ acts
Runtime Orchestrator
```

---

## 11. Runtime Images

### 11.1 Definition

Runtime images are Git-based executable runtime artifacts containing:

* runtime source code
* build artifacts
* runtime metadata
* capability manifest
* runtime configuration

Runtime images do NOT contain persistence.

### 11.2 Integrity Verification

* checksum validation
* manifest signature verification
* lockfile verification
* artifact hash validation

### 11.3 Runtime Image Manager

Responsibilities:

* image resolution and retrieval
* manifest validation
* version management
* integrity verification
* build coordination

---

## 12. Runtime Session Management

Sessions are execution-scoped and disposable. They are NOT conversational sessions. Conversation continuity belongs to the Context Engine, which exists independently of runtime container lifecycle.

Session tracking stores:
* transitions
* crashes
* startup failures
* teardown failures
* runtime metrics

---

## 13. Development Runtime — Plugin Sandbox Host

### 13.1 Purpose

Plugin Sandbox Host is a lightweight runtime launcher for developing and testing plugins inside a simulated Prana host — **without running the full application**.

It exists because plugins must:
* execute inside a real sandbox lifecycle
* hydrate from operational runtime data
* validate runtime teardown behavior
* reconstruct state from SQLite

Plugin Sandbox Host is NOT:
* a mocked runtime
* a fake infrastructure layer
* a service emulator
* a simulation framework

### 13.2 Development Runtime Lifecycle

```text
Start Plugin Sandbox Host
        ↓
Create Sandbox Runtime Container
        ↓
Inject SQLite Operational State
        ↓
Inject Runtime Capabilities
        ↓
Launch Plugin Runtime
        ↓
Runtime Hydration
        ↓
Plugin Operational
        ↓
Plugin Closed
        ↓
Flush Runtime Operations
        ↓
Destroy Runtime State
        ↓
Cleanup Runtime Container
        ↓
Return To Sandbox Host
```

### 13.3 SQLite Fixture System

Fixtures allow deterministic runtime hydration testing. The sandbox host injects fixture data into SQLite before runtime launch.

Supported fixture scenarios:

| Scenario | Purpose |
| -------- | ------- |
| Empty Runtime | Cold start validation |
| Partial State | Missing data validation |
| Corrupted State | Recovery testing |
| Large Dataset | Performance validation |
| AI Config Present | Capability validation |
| Vault Missing | Persistence failure testing |
| Notification Heavy | Runtime load validation |

### 13.4 Capability Injection

Plugin Sandbox Host supports runtime capability injection:

```json
{
  "sqlite": { "read": true, "write": true },
  "vault": { "read": false, "write": false }
}
```

Allows: permission testing, restricted runtime validation, policy enforcement validation, runtime governance testing.

### 13.5 Runtime Cleanup

After plugin shutdown:
* runtime memory destroyed
* IPC connections removed
* temporary runtime resources destroyed
* runtime container destroyed
* runtime session removed

Goal: prevent runtime leakage across sessions.

---

## 14. Dummy Host Mode

### 14.1 Purpose

Dummy Host Mode is a Plugin Sandbox Host configuration that provides a complete, fixture-backed host IPC surface for plugin development and testing without running any production services.

In Dummy Host Mode:
* Startup Orchestrator does not run (`suppressHostBoot: true`)
* all production services are absent
* SQLite cache is seeded entirely from fixture data
* all host IPC handlers are registered against the fixture-backed SQLite
* the full IPC gateway surface is available to the plugin

The plugin cannot distinguish Dummy Host Mode from a production host.

### 14.2 When To Use

| Scenario | Use Dummy Host Mode |
| -------- | ------------------- |
| Plugin feature development | Yes |
| Plugin IPC contract testing | Yes |
| Plugin lifecycle validation | Yes |
| Plugin capability boundary testing | Yes |
| Full production integration | No — use real host |

### 14.3 Vault Behaviour In Dummy Host Mode

No Vault projection occurs. The SQLite fixture replaces Vault data entirely. Provides deterministic, isolated state without Vault infrastructure.

---

## 15. Dummy Plugin

### 15.1 Purpose

The Dummy Plugin is a minimal, contract-conformant plugin implementation used to test host-side behaviour without requiring a real plugin.

| Tool | Tests |
| ---- | ----- |
| Dummy Host Mode | Plugin behaviour against a known host surface |
| Dummy Plugin | Host behaviour against a known plugin implementation |

### 15.2 Dummy Plugin Scenarios

| Scenario | Purpose |
| -------- | ------- |
| Silent plugin | Minimal IPC — validates baseline lifecycle |
| Read-heavy plugin | High sqlite:read volume — validates host IPC throughput |
| Write-heavy plugin | High sqlite:write volume — validates host write mediation |
| Notification emitter | Emits operational events — validates Notification Centre routing |
| Crash-prone plugin | Deliberate crash — validates host crash detection and recovery |
| Permission-violating plugin | Requests beyond capability grant — validates capability enforcement |

### 15.3 Architectural Note

The Dummy Plugin is NOT a mock. It is a real plugin process that exercises the real IPC protocol. It differs from production plugins only in having scripted, deterministic behaviour rather than domain logic.

---

## 16. E2E Testing With Dummy Pair

The Dummy Host and Dummy Plugin together form a self-contained E2E test harness validating the full sandbox runtime contract without any production dependencies.

```text
Dummy Host (Plugin Sandbox Host in Dummy Host Mode)
        ↓
Fixture-backed SQLite cache
        ↓
Dummy Plugin (scripted runtime stub with scenario)
        ↓
IPC round-trips
        ↓
Journal assertions
```

### 16.1 What E2E Tests Validate

| Concern | How |
| ------- | --- |
| Host startup with fixture state | Dummy Host boot |
| Plugin process fork and connect | Dummy Plugin launch |
| IPC routing correctness | Dummy Plugin requests + host responses |
| Capability enforcement | Permission-violating scenario |
| Runtime lifecycle (all states) | Full session |
| Crash recovery | Crash-prone scenario |
| Deterministic cleanup | Post-session resource audit |

### 16.2 E2E Invariant

E2E tests using the Dummy Pair must not require: a running Electron app, Vault infrastructure, network access, or production service initialization.

---

## 17. Failure Modes

| Scenario | Behavior | Recovery |
| -------- | -------- | -------- |
| Plugin crash | Crash detected via heartbeat | Supervisor triggers recover → restart |
| Memory threshold exceeded | Heap > 512 MB | Supervisor triggers restart |
| IPC timeout | Latency > 2,000 ms | Logged; no immediate action |
| Vaidyar blocked signal | Diagnostic signal received | Supervisor triggers destroy |
| Startup Orchestrator failure | Host Container fails to reach OPERATIONAL | Engine remains in failed state |
| Runtime teardown timeout | Graceful exit not received within 5,000 ms | Force-kill; SQLite cleanup proceeds |
| Fixture injection failure | Invalid table or column name | Abort before fork |

---

## 18. Observability

System tracks:
* container lifecycle transitions
* crash events per session
* startup and shutdown duration
* IPC latency per handler
* memory usage over time
* heartbeat miss frequency
* fixture injection results

---

## 19. Architectural Invariants

### Invariant: Single Active Runtime Module
Only one Runtime Module Container may execute simultaneously.

### Invariant: Externalized Persistence
Runtime images never own persistence.

### Invariant: Stateless Runtime Modules
Runtime modules remain disposable and reconstructable.

### Invariant: Deterministic Runtime Teardown
Runtime cleanup must completely destroy runtime execution state.

### Invariant: Capability Governance
Runtime modules receive only explicitly granted permissions.

### Invariant: Runtime Storage Mediation
Runtime modules never directly access persistence internals.

### Invariant: Vault Access Only Through SQLite Sync
No host service or runtime module accesses Vault directly during runtime operation. All Vault data is projected into SQLite on startup and flushed back on shutdown.

### Invariant: Real Runtime Lifecycle (Development)
Plugin Sandbox Host must execute a real sandbox runtime lifecycle — not simulated.

### Invariant: No Infrastructure Mocking
Dummy Host and Dummy Plugin are not mocks. They are contract-conformant stub implementations backed by real SQLite state and the real IPC protocol.

### Invariant: State-Driven Runtime
Runtime behavior derives from operational state, not mocked services.

---

## 20. Known Architectural Gaps

| Area | Gap | Impact |
| ---- | --- | ------ |
| Parallel Module Execution | Only one Runtime Module Container at a time | Medium |
| Domain-Level Concurrency | No safe parallel domain sync within a module | Medium |
| Vault Native Optimization | Vault engine not optimized for large artifact sets | Low |
| Distributed Locking | No cross-process coordination (future scaling) | Low |
| Real-Time Progress Streaming | Module lifecycle events not streamed to UI | Low |
