# Statelessness Invariant

````md
# Statelessness Invariant

## Purpose

Prana is a deterministic orchestration runtime library.

The runtime must not own business state, user state, workflow state, or long-lived execution memory.

All state ownership belongs to:
- client applications
- explicit persistence contracts
- external storage capabilities

The runtime itself must remain behaviorally stateless.

---

# Architectural Rule

Runtime services must not retain mutable runtime state across execution boundaries.

A service may:
- transform inputs
- orchestrate capabilities
- coordinate execution
- emit deterministic outputs

A service may NOT:
- accumulate memory implicitly
- retain business context
- own workflow progress
- cache mutable data without explicit lifecycle governance

---

# Allowed Patterns

## Request-Scoped Ephemeral Variables

Allowed:

```ts
async execute(input) {
  const normalized = normalize(input)
  return processor.run(normalized)
}
````

Reason:
Memory exists only within execution scope.

---

## Explicit Persistence Through Contracts

Allowed:

```ts
await storageCapability.save(record)
```

Reason:
State ownership is externalized.

---

## Immutable Configuration

Allowed:

```ts
const config = Object.freeze(runtimeConfig)
```

Reason:
Immutable data is not runtime-owned mutable state.

---

## Explicitly Governed Transitional Cache

Allowed only if:

* lifecycle defined
* invalidation defined
* documented
* marked transitional

Example:

```ts
/**
 * @deprecated-runtime-state
 * Removal target: v2.0
 */
private readonly cache = new Map()
```

---

# Forbidden Patterns

## Mutable Singleton State

Forbidden:

```ts
class RegistryService {
  private registry = new Map()
}
```

Reason:
Service owns long-lived mutable memory.

---

## Hidden In-Memory Session Retention

Forbidden:

```ts
this.activeContexts[userId] = context
```

Reason:
Runtime becomes session owner.

---

## Service-Level Business State

Forbidden:

```ts
private currentWorkflowState
```

Reason:
Workflow ownership belongs to client domain.

---

## Implicit Runtime Cache

Forbidden:

```ts
private memoizedResponses = {}
```

without:

* invalidation
* lifecycle
* governance

---

## Cross-Request Memory Accumulation

Forbidden:

```ts
history.push(event)
```

inside long-lived service instances.

---

## Stateful Static Variables

Forbidden:

```ts
static activeConnections = []
```

---

# Detection Heuristics

Flag the following patterns:

## Mutable Collections

```ts
new Map()
new Set()
[]
{}
```

inside:

* class properties
* singleton exports
* module-level variables

---

## Static Mutable Fields

```ts
static something
```

where mutable.

---

## Long-Lived Registries

Detect:

* registry
* store
* cache
* manager

holding mutable memory.

---

## Memory Accumulation

Patterns:

* push
* splice
* set
* add

on long-lived objects.

---

## Background Retention

Detect:

* listeners
* subscriptions
* intervals
* retained closures

holding state references.

---

# Severity Levels

## P0 — Critical

Runtime owns business or workflow state.

Examples:

* context retention
* session memory
* mutable registries

Must fix before release.

---

## P1 — High

Hidden runtime cache without lifecycle governance.

Must migrate soon.

---

## P2 — Transitional

Explicitly documented temporary state.

Allowed temporarily with migration plan.

---

## P3 — Informational

Request-scoped ephemeral memory only.

No action required.

---

# Refactoring Guidance

## Replace Runtime State With Capability Contracts

BAD:

```ts
private state = new Map()
```

GOOD:

```ts
await stateCapability.store()
```

---

## Replace Registries With Immutable Descriptors

BAD:

```ts
registry.register(dynamic)
```

GOOD:

```ts
const registryManifest = [...]
```

---

## Replace Runtime Ownership With Injected Context

BAD:

```ts
this.currentContext = context
```

GOOD:

```ts
execute(context)
```

---

## Externalize Persistence

Move:

* queues
* session state
* workflow state
* retry state

into explicit persistence providers.

---

# Runtime Impact

Violating statelessness causes:

* nondeterministic execution
* memory leaks
* hidden coupling
* replay failures
* multi-tenant bleed
* orchestration corruption
* difficult debugging
* lifecycle ambiguity

---

# Migration Notes

## Transitional State Must Include

```ts
/**
 * @deprecated-runtime-state
 * Reason:
 * Removal target:
 * Replacement:
 */
```

---

## Acceptable Transitional Cases

Only:

* performance stabilization
* legacy compatibility
* unavoidable infrastructure adaptation

Temporary only.

---

# Validation Requirements

A runtime service is compliant only if:

* no mutable long-lived state exists
* all persistence is externalized
* all memory ownership is request-scoped
* lifecycle ownership is explicit
* runtime behavior remains reproducible

---

# Compliance Goal

Prana must behave as:

* a deterministic orchestration kernel
* a pure runtime coordinator
* a stateless execution substrate

NOT:

* a workflow engine
* a business state container
* a session runtime
* a memory owner

```
```
