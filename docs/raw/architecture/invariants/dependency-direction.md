# Dependency Direction Invariant

````md id="u8f4zc"
# Dependency Direction Invariant

## Purpose

Prana is a reusable orchestration runtime library.

Core runtime layers must not depend on:
- infrastructure implementations
- UI layers
- storage vendors
- transport mechanisms
- host applications
- framework-specific behavior

Dependencies must always flow inward toward abstractions.

High-level orchestration policy must never depend on low-level implementation details.

This invariant enforces:
- replaceability
- composability
- testability
- portability
- host neutrality
- architectural stability

---

# Architectural Rule

Dependency flow must move only:

```text
Infrastructure -> Adapters -> Capabilities -> Runtime Core
````

NEVER:

```text
Runtime Core -> Infrastructure
Runtime Core -> UI
Runtime Core -> Storage Vendor
Runtime Core -> Client App
```

Core runtime services may depend only on:

* contracts
* interfaces
* pure orchestration abstractions
* deterministic primitives

Implementation details must remain external.

---

# Allowed Patterns

## Interface-Driven Dependencies

Allowed:

```ts
interface StorageCapability {
  save(data): Promise<void>
}
```

Reason:
Runtime depends on abstraction only.

---

## Constructor Injection

Allowed:

```ts id="jlwm3r"
constructor(
  private readonly storage: StorageCapability
) {}
```

Reason:
Dependency ownership is inverted.

---

## Adapter Isolation

Allowed:

```text id="8l5c7z"
/adapters/sqlite/
/adapters/filesystem/
/adapters/google/
```

Reason:
Infrastructure remains replaceable.

---

## Capability Composition

Allowed:

```ts id="jlwm1h"
runtime.start({
  capabilities
})
```

Reason:
Host application owns infrastructure assembly.

---

## Pure Runtime Contracts

Allowed:

```ts id="jlwm3m"
interface QueueCapability
interface ClockCapability
interface PolicyCapability
```

Reason:
Core remains infrastructure-neutral.

---

# Forbidden Patterns

## Infrastructure Imports In Runtime Core

Forbidden:

```ts id="jlwm7q"
import Database from 'better-sqlite3'
```

inside orchestration/runtime services.

Reason:
Core becomes infrastructure-coupled.

---

## UI Dependencies In Runtime

Forbidden:

```ts id="jlwm8f"
import React from 'react'
```

inside runtime core.

Reason:
Runtime becomes renderer-aware.

---

## Client Application Imports

Forbidden:

```ts id="jlwm9k"
import { appConfig } from '@/client'
```

Reason:
Runtime becomes host-dependent.

---

## Framework-Coupled Orchestration

Forbidden:

```ts id="jlwm4u"
electron.ipcMain.handle(...)
```

inside orchestration services.

Reason:
Core becomes platform-specific.

---

## Static Global Service Access

Forbidden:

```ts id="jlwm2x"
GlobalContainer.resolve(Service)
```

Reason:
Dependencies become hidden and irreversible.

---

## Bidirectional Dependencies

Forbidden:

```text id="jlwm6p"
runtime -> adapter
adapter -> runtime
```

Reason:
Creates architectural cycles.

---

## Cross-Layer Leakage

Forbidden:

```ts id="jlwm0n"
runtimeService.renderNotification()
```

Reason:
Execution layer owns presentation behavior.

---

# Detection Heuristics

Flag the following patterns:

---

## Infrastructure Imports

Detect:

* sqlite
* drizzle
* filesystem
* electron
* react
* mui
* express
* axios

inside runtime orchestration layers.

---

## Framework Ownership

Detect:

* ipcMain
* BrowserWindow
* React hooks
* DOM APIs

inside runtime core.

---

## Global Containers

Detect:

* singleton registries
* service locators
* global mutable containers

inside orchestration layers.

---

## Cyclic Dependencies

Detect:

* runtime importing adapters
* adapters importing orchestration internals

---

## Cross-Layer Calls

Detect:

* UI calls from runtime
* renderer imports in main process core
* infrastructure branching inside orchestration

---

## Static Shared Infrastructure

Detect:

```ts id="jlwm7b"
sharedDatabaseInstance
sharedFilesystem
sharedElectronWindow
```

inside runtime core.

---

# Severity Levels

## P0 — Critical

Runtime directly depends on infrastructure/frameworks.

Examples:

* sqlite imports
* electron ownership
* UI framework imports

Must fix before release.

---

## P1 — High

Dependency flow partially inverted.

Examples:

* service locators
* cyclic imports
* framework leakage

Must migrate.

---

## P2 — Transitional

Legacy coupling with migration plan.

Allowed temporarily only.

---

## P3 — Informational

Dependency flow fully compliant.

No action required.

---

# Refactoring Guidance

## Replace Infrastructure Imports With Contracts

BAD:

```ts id="jlwm3d"
import Database from 'better-sqlite3'
```

GOOD:

```ts id="jlwm4r"
interface PersistenceCapability
```

---

## Move Framework Logic Outward

BAD:

```ts id="jlwm9r"
ipcMain.handle(...)
```

inside runtime service.

GOOD:

```ts id="jlwm5u"
/platform/electron/
```

adapter layer.

---

## Remove UI Awareness

BAD:

```ts id="jlwm8s"
showToastNotification()
```

inside runtime core.

GOOD:

```ts id="jlwm2j"
notificationCapability.publish()
```

---

## Eliminate Global Service Locators

BAD:

```ts id="jlwm4n"
Container.resolve()
```

GOOD:

```ts id="jlwm1q"
constructor(dependency)
```

---

## Break Cyclic Dependencies

BAD:

```text id="jlwm8q"
runtime <-> adapter
```

GOOD:

```text id="jlwm6r"
adapter -> capability -> runtime
```

---

# Runtime Impact

Violating dependency direction causes:

* infrastructure lock-in
* framework coupling
* broken portability
* testing difficulty
* architectural cycles
* hidden dependencies
* host coupling
* unstable evolution

Without dependency inversion:
the runtime becomes a tightly coupled application platform.

---

# Migration Notes

## Transitional Dependency Violations Must Include

```ts id="jlwm9m"
/**
 * @deprecated-dependency-coupling
 * Dependency:
 * Reason:
 * Replacement abstraction:
 * Removal target:
 */
```

---

## Migration Strategy

1. Identify infrastructure imports
2. Extract capability contracts
3. Move implementation into adapters
4. Inject dependencies explicitly
5. Remove cyclic dependencies
6. Enforce inward dependency flow

---

# Validation Requirements

A runtime service is compliant only if:

* core depends only on abstractions
* infrastructure is externalized
* UI layers are isolated
* frameworks remain outside runtime core
* dependency flow is one-directional
* cyclic dependencies do not exist
* dependency ownership is explicit

---

# Compliance Goal

Prana must behave as:

* a dependency-inverted orchestration runtime
* a composable execution kernel
* a framework-neutral coordination substrate

NOT:

* an Electron-coupled platform
* a UI-aware runtime
* a storage-bound orchestration engine
* a tightly coupled application framework

```
```
