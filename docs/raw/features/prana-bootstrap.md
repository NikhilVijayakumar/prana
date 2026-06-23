# ⚙️ Feature: Prana Bootstrap

**Version:** 2.0.0
**Status:** Core / Foundational
**Service:** `pranaBootstrapService.ts`
**Pattern:** Runtime Initialization & Service Registration
**Capability:** Initializes the Prana Runtime, loads runtime configuration, registers core services, and exposes a runtime context that applications consume during their own bootstrap process.

---

## 1. Tactical Purpose

Prana Bootstrap is the initialization entry point of the Prana Runtime.

It is responsible for:

* loading runtime configuration
* initializing runtime infrastructure
* registering core services
* exposing runtime context
* transitioning the runtime to an operational state

Prana Bootstrap is not responsible for:

* application startup
* application readiness checks
* application identity flows
* application storage validation
* business initialization logic

These responsibilities belong to applications.

---

## 2. Design Philosophy

### Runtime Owns Infrastructure

Prana owns:

```text
Configuration
Service Registry
Storage Infrastructure
Event Infrastructure
Runtime Lifecycle
```

---

### Applications Own Policy

Applications own:

```text
Startup Flow
Identity Requirements
Readiness Checks
Feature Initialization
Business Logic
```

---

### Runtime First

Applications must initialize through Prana Runtime.

```text
Application
      ↓
Prana Bootstrap
      ↓
Runtime Context
      ↓
Application Bootstrap
```

---

## 3. Core Principle

### Infrastructure Only

Prana Bootstrap exists solely to make runtime services available.

It must not impose:

```text
Storage Policies
Authentication Policies
Application Lifecycle Rules
Business Rules
```

---

### Service Discovery

Applications discover services through the runtime.

Applications must not:

```text
Read Runtime Files
Read Runtime Paths
Read Runtime Secrets
Read Runtime Credentials
```

directly.

---

## 4. Runtime Lifecycle

### Bootstrap Flow

```text
INIT
  ↓
CONFIGURATION_READY
  ↓
SERVICES_READY
  ↓
OPERATIONAL
  ↓
STOPPING
  ↓
STOPPED
```

### Failure Path

```text
INIT / CONFIGURATION_READY / SERVICES_READY
  ↓ (on error)
FAILED
```

A FAILED state during bootstrap MUST halt all initialization. No services are made available. No applications may bootstrap. The failure reason MUST be recorded before the process exits or suspends.

### Shutdown Path

```text
OPERATIONAL
  ↓ (shutdown signal)
STOPPING
  ↓
STOPPED
```

On `STOPPING`, services are torn down in reverse registration order. The Event Registry is an exception: it MUST be torn down last, after all other services, to preserve event observability throughout the teardown sequence. Storage Scheduler flushes pending jobs before teardown. `runtime:shutdown` is emitted via Event Registry before teardown begins. On `STOPPED`, no services are available and the process may exit cleanly.

---

### State Definitions

#### INIT

Runtime startup begins.

- No configuration loaded
- No services available
- No context exposed
- Platform paths resolved; logging initialized

---

#### CONFIGURATION_READY

Runtime configuration loaded and validated.

- Configuration service available
- Storage paths resolved
- All other services still unavailable
- Applications must not begin bootstrap at this stage

Validation at this state requires:

```text
All required configuration keys present
Storage paths exist and are accessible
Runtime version field present and parseable
No contradictory values between configuration categories
```

Bootstrap MUST NOT proceed to SERVICES_READY if any required key is absent or validation fails.

Configuration keys with present but semantically invalid values MUST fail validation with the same behavior as absent keys. Examples: `runtimeVersion` present but not parseable as a valid version string; a required path that exists but is not accessible. Bootstrap MUST NOT proceed to SERVICES_READY.

---

#### SERVICES_READY

All required runtime services registered and initialized.

- Service registry available
- Storage Scheduler initialized
- Identity Service initialized
- Event Registry active
- Optional services registered if enabled
- Applications must not begin bootstrap at this stage

Bootstrap MUST impose a timeout on service registration. If any required service does not complete initialization within the configured timeout, bootstrap MUST transition to FAILED. The failing service name MUST be recorded.

---

#### OPERATIONAL

Runtime context fully available.

- `IPranaRuntime` context exposed
- Applications may begin their own bootstrap sequence
- Runtime configuration becomes read-only for the duration of runtime execution
- No further service registration occurs after this state
- `runtime:startup` event MUST be emitted via Event Registry on entry to this state

---

#### FAILED

Bootstrap did not reach OPERATIONAL.

- Failure reason recorded
- No runtime context exposed
- No applications launched
- Recovery requires restart

"Restart" means the host process exits and re-initializes from INIT in a clean process context. No services, configuration, or state carry over from the failed bootstrap. There is no maximum restart retry count defined at the Bootstrap level — retry policy is an operator concern.

---

## 5. Runtime Configuration

### Purpose

Provides shared runtime configuration loaded during bootstrap. Becomes the authoritative, read-only configuration surface from OPERATIONAL state onward.

Applications access configuration exclusively through the Configuration Service. Applications must not read configuration files, environment paths, or provider internals directly.

---

### Initialization Ordering

Configuration loads first — before any service registration.

Bootstrap MUST NOT proceed to SERVICES_READY until configuration is loaded and validated.

---

### Write Rules

| Phase | Write Allowed |
|---|---|
| INIT → CONFIGURATION_READY | Bootstrap process writes initial config |
| CONFIGURATION_READY → SERVICES_READY | Services may write defaults during registration |
| OPERATIONAL | **Read-only.** No writes permitted during normal execution |

Configuration writes during runtime (post-OPERATIONAL) must go through explicit runtime APIs — never direct storage access.

When a runtime API performs a configuration write post-OPERATIONAL, it MUST emit `runtime:configuration:changed` via the Event Registry. This event is the only mechanism by which configuration changes are observable after OPERATIONAL state. Direct configuration mutation without this event is a violation of the configuration contract.

---

### Configuration Categories

```text
Runtime Settings      — platform paths, runtime version, environment
Storage Settings      — SQLite location, domain adapter config
Workspace Settings    — external provider accounts and endpoints
Identity Settings     — authentication provider config
Distribution Settings — update provider, package source
```

---

### Configuration Contract

```typescript
interface IConfigurationService {

    get<T>(key: string): T;

    set<T>(
        key: string,
        value: T
    ): Promise<void>;

    isReady(): boolean;

}
```

---

## 6. Service Registry

### Purpose

Provides runtime-wide service discovery and registration. The single authority for locating runtime services. Becomes available at SERVICES_READY state.

---

### Contract

```typescript
interface IServiceRegistry {

    register<T>(
        name: string,
        service: T
    ): void;

    resolve<T>(
        name: string
    ): T;

    resolveOptional<T>(
        name: string
    ): T | null;

    isRegistered(name: string): boolean;

}
```

---

### Registration Rules

- Registration occurs only during bootstrap, before OPERATIONAL
- Required services MUST be registered before SERVICES_READY transitions to OPERATIONAL
- Failure to register a required service MUST halt bootstrap → FAILED
- No service may be registered after OPERATIONAL state — attempting to do so MUST throw immediately with a descriptive error (service name + reason). This MUST NOT crash the runtime — the call site receives the error.
- Event Registry failure is treated as a required service failure — bootstrap MUST halt. All subsequent services depend on Event Registry for observability; proceeding without it produces a silent, unmonitorable runtime.

---

### Resolution Rules

- Applications resolve services — they never instantiate them
- `resolve<T>` is for required services — MUST throw if unregistered
- `resolveOptional<T>` is for optional services — MUST return null if unregistered, never throw
- Applications MUST use `resolveOptional` for optional services; using `resolve` on an optional service is a contract violation
- Applications MUST check `isRegistered` before resolving optional services when presence affects logic
- If `resolveOptional<T>` is called before the registry is initialized (before SERVICES_READY), it MUST return null. Pre-SERVICES_READY, all services are considered unregistered.

---

### Registration Ordering

Services register in this sequence during bootstrap:

```text
1. Configuration Service
2. Event Registry
3. Storage Service (SQLite)
4. Storage Scheduler
5. Identity Service
6. Application Registry
7. Document Service
8. Sheet Service
9. Optional services (if enabled)
```

Each service may depend only on services registered before it.

---

## 7. Runtime Context

### Purpose

The Runtime Context is the single entry point applications use to access all runtime infrastructure. It is created and exposed only after OPERATIONAL state is reached.

---

### Contract

```typescript
interface IPranaRuntime {

    configuration: IConfigurationService;

    events: IEventRegistry;

    services: IServiceRegistry;

    state: 'OPERATIONAL';

}
```

---

### Availability

- Context is `null` before OPERATIONAL
- Context is immutable after creation — services and configuration references do not change
- Applications must not cache individual service references before receiving the context
- A FAILED bootstrap never produces a runtime context — `prana.initialize()` throws instead. Applications must not handle a partially-initialized context; recovery requires restart.

---

### Access Pattern

```typescript
const runtime = await prana.initialize();
// throws BootstrapError if bootstrap reaches FAILED
// runtime.state is always 'OPERATIONAL' when returned
```

---

### Service Resolution

```typescript
const storage = runtime.services.resolve('storage');
const scheduler = runtime.services.resolve('storageScheduler');
const identity = runtime.services.resolve('identity');

// Event Registry is available directly on the context
runtime.events.subscribe('storage:sync:completed', handler);

// Optional services must use resolveOptional
const documents = runtime.services.resolveOptional('documents');
```

---

## 8. Core Runtime Services

### Required Services

These MUST be registered before OPERATIONAL. Bootstrap fails if any required service fails to initialize.

| Service | Registry Key | Responsibility |
|---|---|---|
| Configuration Service | `configuration` | Runtime-wide configuration access |
| Event Registry | `events` | Runtime event coordination |
| Storage Service (SQLite) | `storage` | SQLite runtime store access |
| Storage Scheduler | `storageScheduler` | Domain sync orchestration |
| Identity Service | `identity` | Authentication and session management |
| Application Registry | `appRegistry` | Installed application records |

---

### Optional Services

Registered if enabled by configuration. Applications MUST check availability before resolving.

| Service | Registry Key | Responsibility |
|---|---|---|
| Document Service | `documents` | Document domain sync and projection |
| Sheet Service | `sheets` | Sheet domain sync and projection |

---

### Service Failure During Registration

If a required service throws during initialization:

```text
Bootstrap → FAILED
Failure reason logged
No context exposed
No applications launched
```

If an optional service throws during initialization:

```text
Service skipped
Warning logged
Bootstrap continues
```

If a required service that registered successfully then fails before OPERATIONAL is reached (e.g., during post-registration initialization), the registration timeout detection covers this case. Additionally, any required service that emits a failure signal before OPERATIONAL causes bootstrap to halt → FAILED, with the failing service name recorded.

---

## 9. Application Bootstrap

Applications own startup.

---

### Example

```typescript
async function bootstrap() {

    const runtime =
        await prana.initialize();

    const storage =
        runtime.services.resolve(
            'storage'
        );

    await initializeApplication(
        storage
    );

}
```

---

### Application Responsibility

Applications define:

```text
Identity Flow
Feature Initialization
Readiness Validation
Recovery Logic
Startup Sequence
```

Prana does not participate.

---

## 10. Configuration Ownership

Runtime owns all shared configuration. Applications consume — they do not own, copy, or cache configuration state.

### Ownership Boundaries

| Owned By | Examples |
|---|---|
| Runtime | Storage paths, provider endpoints, identity config, workspace accounts |
| Application | Application-specific preferences, feature flags, domain schema |

### Access Rules

- Applications read via `runtime.configuration.get(key)`
- Applications MUST NOT hard-code paths, provider internals, or credential locations
- Applications MUST NOT duplicate runtime configuration into their own storage

```typescript
// correct
runtime.configuration.get('workspace.defaultAccount');

// wrong — hard-codes platform-specific knowledge
const account = process.env.WORKSPACE_ACCOUNT;
```

---

## 11. Platform Independence

Prana Bootstrap must abstract platform-specific details.

Applications must remain independent of:

```text
Windows
Linux
macOS
```

implementation differences.

---

### Example

Applications must never assume:

```text
C:\Data
/home/user
/Users/name
```

Runtime services resolve platform-specific behavior.

---

## 12. Security Model

### Runtime Responsibility

Runtime owns:

```text
Configuration Storage
Credential Storage
Provider Configuration
Service Registration
```

---

### Application Responsibility

Applications own:

```text
Authorization Logic
Business Security Rules
Feature Security
```

---

## 13. Observability

Bootstrap should expose:

```text
Current State
Initialization Duration
Service Registration Status
Configuration Load Status
```

for diagnostics.

---

## 14. Design Invariants

### Runtime Before Application

Applications must not initialize before runtime becomes operational.

---

### Configuration Through Services

Applications access configuration through runtime services only.

---

### Service Resolution Only

Applications discover runtime infrastructure through the service registry.

---

### Infrastructure Only

Prana Bootstrap provides infrastructure, not application behavior.

---

### Platform Independence

Applications must remain portable across operating systems.

---

### Global Configuration Ownership

Shared configuration belongs to the runtime.

Applications consume configuration but do not own it.

---

### Throw On Failure

`prana.initialize()` MUST throw on bootstrap failure. No FAILED-state context is ever exposed to callers.

---

### Required/Optional Service Distinction

Required services use `resolve<T>` — throws if absent.

Optional services use `resolveOptional<T>` — returns null if absent.

---

### Event Registry Is Non-Optional

Event Registry failure MUST halt bootstrap. It is required infrastructure for all runtime observability.

---

### Ordered Teardown

Services MUST be torn down in reverse registration order on shutdown.

---

## 15. Completion Status

Prana Bootstrap is the foundational runtime initialization service responsible for:

```text
Runtime Initialization
Configuration Loading
Service Registration
Runtime Context Creation
Runtime Lifecycle Management
```

while explicitly excluding:

```text
Application Startup
Application Readiness
Business Logic
Identity Initialization
Feature Initialization
```

Applications remain fully responsible for their own bootstrap process while leveraging shared infrastructure provided by the Prana Runtime.
