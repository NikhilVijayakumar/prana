# Plugin Sandbox Host

> **Status: Implemented and live.** See `src/main/services/sandbox/pluginSandboxHost.ts`.
> See `sandbox-runtime-architecture.md` for the full runtime architecture.

## Purpose

Plugin Sandbox Host is a lightweight runtime launcher for testing plugins and runtime libraries inside a simulated Prana host — **without running the full application**. It is the primary development and testing entry point for runtime modules.

It exists to:

* create a real sandbox runtime environment
* launch runtime modules/plugins inside sandbox execution
* inject predefined SQLite operational state
* validate runtime lifecycle behavior
* test plugin hydration and reconstruction
* cleanup runtime containers after shutdown

Plugin Sandbox Host is NOT:

* a mocked runtime
* a fake infrastructure layer
* a service emulator
* a simulation framework
* a replacement for the real host runtime

Instead, it is:

```text
A lightweight sandbox bootstrap runtime for plugin development.
```

---

# Why Plugin Sandbox Host Exists

## Core Architectural Reason

Prana runtime modules are:

* stateless
* disposable
* operational-state driven
* runtime-hydrated

Plugin behavior depends primarily on:

```text
SQLite operational state
```

rather than mocked services.

Because of this:

* plugins must execute inside a real sandbox lifecycle
* plugins must hydrate from operational runtime data
* plugins must validate runtime teardown behavior
* plugins must reconstruct state from SQLite

A normal isolated Electron app is insufficient.

---

# Problem Without Plugin Sandbox Host

Without Plugin Sandbox Host:

* plugins bypass runtime lifecycle
* plugins develop outside sandbox boundaries
* runtime hydration is not validated
* runtime teardown is not validated
* plugin lifecycle diverges from production
* developers directly access internals
* architectural coupling increases

Most importantly:

```text
Plugins stop behaving like runtime modules
and begin behaving like standalone applications.
```

This violates Prana runtime architecture.

---

# Architectural Philosophy

## State-Driven Runtime Execution

Prana follows:

```text
State → Runtime Behavior
```

NOT:

```text
Mock Services → Runtime Behavior
```

This is a critical distinction.

Plugins derive behavior from:

* operational SQLite state
* runtime hydration
* capability injection
* runtime lifecycle

Therefore:

Plugin Sandbox Host does NOT need:

* mocked APIs
* fake services
* infrastructure emulation
* simulated runtime systems

It only needs:

* real sandbox lifecycle
* real runtime execution
* real SQLite operational state
* deterministic cleanup

---

# Plugin Sandbox Host Responsibilities

## Responsibilities

Plugin Sandbox Host is responsible for:

* Sandbox Runtime Container creation
* runtime session creation
* SQLite fixture injection
* runtime capability injection
* runtime bootstrap
* plugin runtime launch
* runtime lifecycle execution
* runtime teardown
* runtime cleanup
* Sandbox Runtime Container destruction

---

# Plugin Sandbox Host Scope

## What It DOES

| Responsibility              | Supported |
| --------------------------- | --------- |
| Sandbox creation            | Yes       |
| Plugin launch               | Yes       |
| SQLite state injection      | Yes       |
| Capability injection        | Yes       |
| Runtime cleanup             | Yes       |
| Runtime lifecycle execution | Yes       |
| Runtime teardown validation | Yes       |

---

## What It DOES NOT DO

| Responsibility          | Supported |
| ----------------------- | --------- |
| Mock infrastructure     | No        |
| Fake services           | No        |
| API simulation          | No        |
| Sync emulation          | No        |
| Vault emulation         | No        |
| Runtime mocking         | No        |
| Notification simulation | No        |

The system intentionally avoids runtime simulation complexity.

---

# Core Runtime Flow

## Development Runtime Lifecycle

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

This flow intentionally mirrors production runtime lifecycle behavior.

---

# SQLite Operational State Injection

## Core Concept

SQLite operational data is the runtime hydration substrate.

Plugins derive runtime state from operational records.

Examples:

* notifications
* analytics records
* AI operational state
* onboarding records
* sync metadata
* communication state
* workflow state

Because of this:

```text
Testing runtime state requires testing operational data.
```

---

# Fixture System

## Purpose

Fixtures allow deterministic runtime hydration testing.

Examples:

```text
fixtures/
 ├── empty-runtime.json
 ├── onboarding-runtime.json
 ├── analytics-runtime.json
 ├── ai-runtime.json
 ├── notifications-runtime.json
 └── corrupted-runtime.json
```

The sandbox host injects fixture data into SQLite before runtime launch.

---

# Runtime Scenario Testing

## Supported Scenarios

Plugin Sandbox Host should support:

| Scenario           | Purpose                     |
| ------------------ | --------------------------- |
| Empty Runtime      | Cold start validation       |
| Partial State      | Missing data validation     |
| Corrupted State    | Recovery testing            |
| Large Dataset      | Performance validation      |
| AI Config Present  | Capability validation       |
| Vault Missing      | Persistence failure testing |
| Notification Heavy | Runtime load validation     |

---

# Runtime Isolation

## Runtime Container Isolation

Each plugin runtime executes inside:

```text
Sandbox Runtime Container
```

Responsibilities:

* runtime isolation
* process isolation
* runtime-scoped lifecycle
* memory cleanup
* deterministic teardown

Only one plugin runtime exists simultaneously.

---

# Runtime Cleanup

## Cleanup Philosophy

Plugin Sandbox Host must aggressively cleanup runtime state.

After plugin shutdown:

* runtime memory destroyed
* IPC connections removed
* temporary runtime resources destroyed
* runtime container destroyed
* runtime session removed

Goal:

```text
Prevent runtime leakage across sessions.
```

---

# Why Cleanup Is Critical

Without deterministic cleanup:

* runtime state leaks
* memory leaks accumulate
* plugin behavior becomes non-deterministic
* hidden shared state emerges
* runtime isolation breaks

Cleanup enforcement is a core architectural requirement.

---

# Relationship To Production Host

## Architectural Relationship

Plugin Sandbox Host is NOT a replacement for the production host runtime. See `sandbox-runtime-architecture.md#Host-Runtime-Container` for the production runtime model.

Relationship:

```text
Production Host Runtime (see sandbox-runtime-architecture.md)
        ↓
Full Runtime Ecosystem

Plugin Sandbox Host
        ↓
Minimal Runtime Bootstrap Layer
```

Plugin Sandbox Host exists only for runtime module development.

---

# Why Minimalism Matters

Plugin Sandbox Host intentionally remains minimal.

It should NOT:

* duplicate the production host architecture
* reimplement infrastructure systems
* emulate external services
* recreate synchronization engines
* recreate Vault internals

Reason:

```text
The runtime dependency is operational state,
not service simulation.
```

This keeps the architecture:

* deterministic
* lightweight
* maintainable
* aligned with production behavior

---

# Capability Injection

## Capability Testing

Plugin Sandbox Host should support runtime capability injection.

Example:

```json
{
  "sqlite": {
    "read": true,
    "write": true
  },
  "vault": {
    "read": false,
    "write": false
  }
}
```

This allows:

* permission testing
* restricted runtime validation
* policy enforcement validation
* runtime governance testing

---

# Runtime Module Independence

## Important Principle

Runtime modules/plugins must remain independently executable.

A runtime module should:

* hydrate from state
* reconstruct runtime context
* operate without hidden runtime assumptions
* remain deterministic

The sandbox host validates this architectural requirement.

---

# Runtime Data Philosophy

## Operational State Is The Contract

Prana runtime architecture treats:

```text
Operational runtime state
```

as the primary runtime execution contract.

NOT:

* service mocking
* infrastructure emulation
* runtime scripting

This is why Plugin Sandbox Host focuses only on:

* sandbox lifecycle
* SQLite operational data
* runtime execution
* deterministic cleanup

---

# Recommended Architecture

## Plugin Development Architecture

```text
Plugin Sandbox Host
        ↓
Sandbox Runtime Container
        ↓
Runtime Capability Injection
        ↓
SQLite Operational State
        ↓
Plugin Runtime Module
        ↓
Hydrated Runtime State
```

---

# Technology Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Sandbox Host | Electron + TypeScript | `pluginSandboxHost.ts` |
| Runtime Container | `child_process.fork()` | Process isolation (NOT virtual drive, NOT utilityProcess) |
| Operational Store | SQLite via `better-sqlite3` | Real DB at `<tmpdir>/prana-sandbox/<uuid>.sqlite` |
| Durable Storage | Vault | Not used in sandbox mode |
| Fixture Loader | JSON → SQLite | Writes into real tables before fork |
| IPC | Node.js message passing | `process.send()` / `process.on('message')` |
| Cleanup | Runtime teardown + `unlinkSync` | Temp SQLite file deleted on shutdown |

> **Process isolation over virtual drives**: An earlier design used a virtual drive abstraction. The final implementation uses `child_process.fork()` because it is Electron-native, requires no filesystem virtualization, and plugins interact with the host exclusively through IPC — making virtual drive isolation unnecessary.

---

# How the Plugin Sandbox Host Works

## Launch sequence

```text
pluginSandboxHost.launch(imagePath, capabilities, fixture?)
        ↓
Resolve runtime image from imagePath (reads runtime.json manifest)
        ↓
Create real SQLite DB at /tmp/prana-sandbox/<uuid>.sqlite
        ↓
Write fixture tables into SQLite (deterministic state injection)
        ↓
Register host-side IPC gateway handlers against SQLite
(sqlite:read, sqlite:write, notifications:emit, sync:read)
        ↓
fork(entryPath, [], { env: { SANDBOX_SESSION_ID, SANDBOX_RUNTIME_ID,
                              SANDBOX_RUNTIME_VERSION, SANDBOX_SQLITE_PATH } })
        ↓
Plugin process starts, reads env vars, connects via IPC
        ↓
Plugin is operational — queries SQLite through IPC (same as production)
```

## Shutdown sequence

```text
pluginSandboxHost.shutdown()
        ↓
Send shutdown signal to forked process
        ↓
Wait for graceful exit (5 000 ms timeout)
        ↓
Force-kill if timeout exceeded
        ↓
Close SQLite DB handle
        ↓
Delete temp SQLite file
        ↓
Destroy runtime containers and session
```

## Plugin process environment

The forked plugin process receives:

| Env Var | Value |
|---------|-------|
| `SANDBOX_SESSION_ID` | UUID for this session |
| `SANDBOX_RUNTIME_ID` | Runtime ID from manifest |
| `SANDBOX_RUNTIME_VERSION` | Runtime version from manifest |
| `SANDBOX_SQLITE_PATH` | Absolute path to temp SQLite DB |

The plugin uses `pluginRuntimeClient.ts` to read these env vars and set up its IPC connection to the host.

---

# Fixture Format

```json
{
  "tables": {
    "notifications": [
      { "id": "1", "title": "Test notification", "body": "Body text" }
    ],
    "ai_state": [
      { "model": "claude-3", "enabled": "true" }
    ]
  }
}
```

Table names and column names are validated against `/^[a-zA-Z_][a-zA-Z0-9_]*$/` before insertion. All values are stored as TEXT. Object values are JSON-stringified.

---

# Architectural Invariants

## Invariant: Real Runtime Lifecycle

Plugin Sandbox Host must execute real sandbox runtime lifecycle.

---

## Invariant: No Runtime Mocking

Infrastructure services should not be mocked.

---

## Invariant: State-Driven Runtime

Runtime behavior derives from operational state.

---

## Invariant: Deterministic Cleanup

Runtime teardown must remove runtime state completely.

---

## Invariant: Runtime Isolation

Each plugin runtime executes inside isolated sandbox execution.

---

# Final Summary

Plugin Sandbox Host is a lightweight development runtime designed to validate:

* real sandbox lifecycle behavior
* runtime hydration
* operational state reconstruction
* capability governance
* deterministic runtime teardown

It intentionally avoids:

* infrastructure emulation
* service mocking
* fake runtime systems

because Prana runtime architecture is fundamentally:

```text
State-driven rather than service-driven.
```

The Plugin Sandbox Host exists to ensure runtime modules behave like:

```text
Disposable sandbox execution units
```

rather than standalone Electron applications.
