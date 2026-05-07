# Composability Invariant

````md id="r4k9dp"
# Composability Invariant

## Purpose

Prana is a modular orchestration runtime.

All runtime capabilities must be:
- independently usable
- independently replaceable
- independently testable
- independently deployable
- independently evolvable

Runtime services must compose through explicit contracts,
NOT through hidden coupling or shared internal state.

The runtime must behave like a capability graph,
not a monolithic execution container.

---

# Architectural Rule

Runtime modules must interact only through:
- explicit contracts
- typed interfaces
- deterministic messages
- capability boundaries

No module may require hidden knowledge of:
- internal implementation
- execution ordering
- storage topology
- process-global state
- lifecycle internals
- framework-specific behavior

Modules must remain plug-compatible.

---

# Allowed Patterns

## Capability Composition

Allowed:

```ts
runtime.register({
  queueCapability,
  storageCapability,
  policyCapability
})
````

Reason:
Modules remain independently replaceable.

---

## Explicit Contracts

Allowed:

```ts id="jlwm3w"
interface NotificationCapability {
  publish(event): Promise<void>
}
```

Reason:
Integration occurs through stable boundaries.

---

## Stateless Service Composition

Allowed:

```ts id="jlwm2w"
execute(context, dependencies)
```

Reason:
Composition does not require hidden runtime ownership.

---

## Message-Driven Coordination

Allowed:

```ts id="jlwm9x"
await eventBus.publish(event)
```

Reason:
Modules communicate through explicit semantics.

---

## Optional Capability Registration

Allowed:

```ts id="jlwm5x"
if (capabilities.notifications)
```

Reason:
Runtime remains modular.

---

## Replaceable Adapters

Allowed:

```text id="jlwm8x"
/adapters/sqlite/
/adapters/postgres/
/adapters/memory/
```

Reason:
Infrastructure implementations remain swappable.

---

# Forbidden Patterns

## Hidden Cross-Service Mutation

Forbidden:

```ts id="jlwm4y"
sharedState.currentTask = task
```

Reason:
Modules become execution-coupled.

---

## Direct Internal Service Access

Forbidden:

```ts id="jlwm1z"
service.internalQueue.push()
```

Reason:
Composition bypasses boundaries.

---

## Implicit Execution Ordering

Forbidden:

```ts id="jlwm7z"
serviceB.executeAfter(serviceA)
```

without explicit orchestration contract.

Reason:
Modules become tightly sequenced.

---

## Shared Mutable Globals

Forbidden:

```ts id="jlwm6a"
globalRuntimeContext
```

Reason:
Composable isolation collapses.

---

## Hard Dependency Requirements

Forbidden:

```ts id="jlwm2b"
if (!notificationService) throw Error()
```

inside core orchestration.

Reason:
Optional capabilities become mandatory coupling.

---

## Internal Type Leakage

Forbidden:

```ts id="jlwm3b"
import { InternalQueueState }
```

across module boundaries.

Reason:
Modules become implementation-aware.

---

## Monolithic Service Ownership

Forbidden:

```ts id="jlwm5b"
class RuntimeManager {
  // owns all orchestration behavior
}
```

Reason:
System becomes non-composable.

---

# Detection Heuristics

Flag the following patterns:

---

## Shared Mutable State

Detect:

* globalContext
* sharedCache
* activeState
* singleton stores

shared across runtime modules.

---

## Internal Cross-Imports

Detect:

* internal implementation imports
* non-public service imports
* deep runtime coupling

---

## Ordering Dependencies

Detect:

* startup order assumptions
* execution sequence assumptions
* implicit orchestration dependencies

between modules.

---

## Capability Assumptions

Detect:

* required services without contracts
* direct concrete service dependencies

inside orchestration layers.

---

## Monolithic Runtime Managers

Detect:

* god objects
* giant orchestrators
* centralized ownership containers

with excessive responsibilities.

---

## Cross-Layer Internal Mutation

Detect:

* modifying another service’s internal state
* accessing private runtime collections

---

# Severity Levels

## P0 — Critical

Modules cannot operate independently.

Examples:

* shared runtime globals
* direct internal mutation
* monolithic orchestration ownership

Must fix before release.

---

## P1 — High

Composition partially constrained.

Examples:

* startup ordering assumptions
* hidden capability requirements
* internal type leakage

Must migrate.

---

## P2 — Transitional

Legacy tight coupling with migration plan.

Allowed temporarily only.

---

## P3 — Informational

Module composition fully compliant.

No action required.

---

# Refactoring Guidance

## Replace Shared State With Explicit Contracts

BAD:

```ts id="jlwm8b"
sharedRuntimeState.currentUser
```

GOOD:

```ts id="jlwm1c"
execute(context)
```

---

## Remove Internal Imports

BAD:

```ts id="jlwm0c"
import { InternalStore }
```

GOOD:

```ts id="jlwm4c"
interface StoreCapability
```

---

## Replace Implicit Ordering

BAD:

```ts id="jlwm6c"
serviceB.startAfter(serviceA)
```

GOOD:

```ts id="jlwm7c"
orchestrator.execute(plan)
```

---

## Eliminate Monolithic Managers

BAD:

```ts id="jlwm2d"
RuntimeManager
```

controlling everything.

GOOD:

```ts id="jlwm9d"
composable capability graph
```

---

## Externalize Capability Requirements

BAD:

```ts id="jlwm3d"
notificationService.send()
```

GOOD:

```ts id="jlwm5d"
notificationCapability?.publish()
```

---

# Runtime Impact

Violating composability causes:

* rigid architecture
* impossible modular reuse
* hidden orchestration coupling
* deployment inflexibility
* upgrade instability
* poor testability
* integration fragility
* architectural monolith growth

Without composability:
the runtime becomes an inseparable application platform.

---

# Migration Notes

## Transitional Composition Violations Must Include

```ts id="jlwm8d"
/**
 * @deprecated-composition-coupling
 * Coupling:
 * Replacement boundary:
 * Removal target:
 */
```

---

## Migration Strategy

1. Identify hidden service coupling
2. Extract capability contracts
3. Remove shared mutable state
4. Introduce explicit orchestration boundaries
5. Split monolithic managers
6. Externalize capability ownership

---

# Validation Requirements

A runtime service is compliant only if:

* modules communicate through contracts
* shared mutable state does not exist
* internal implementation details are hidden
* capabilities remain independently replaceable
* orchestration dependencies are explicit
* lifecycle ownership is isolated
* optional capabilities remain optional

---

# Compliance Goal

Prana must behave as:

* a composable orchestration runtime
* a capability-driven execution substrate
* a modular coordination kernel

NOT:

* a monolithic runtime platform
* a tightly coupled orchestration container
* a shared-state execution engine

```
```
