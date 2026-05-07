# Determinism Invariant

````md id="b7w1pr"
# Determinism Invariant

## Purpose

Prana is a deterministic orchestration runtime.

Given:
- identical inputs
- identical configuration
- identical persisted state
- identical execution history

the runtime must produce:
- identical orchestration decisions
- identical execution ordering
- identical outputs
- identical side-effect intent

Determinism is required for:
- replayability
- debugging
- auditability
- recovery
- reproducibility
- distributed consistency
- safe orchestration

The runtime must not rely on hidden nondeterministic behavior.

---

# Architectural Rule

Runtime behavior must derive only from explicit deterministic inputs.

Core runtime services may not depend on:
- implicit timing
- random values
- unordered concurrency
- hidden mutable memory
- unstable iteration order
- environment-dependent branching
- process-global mutation

All nondeterministic behavior must be:
- injected
- controlled
- reproducible
- observable

---

# Allowed Patterns

## Injected Clock Providers

Allowed:

```ts
interface ClockCapability {
  now(): number
}
````

Reason:
Time becomes deterministic and replayable.

---

## Injected Identifier Providers

Allowed:

```ts id="t0i8xv"
interface IdGenerator {
  generate(): string
}
```

Reason:
Identifier generation becomes controllable.

---

## Explicit Ordering

Allowed:

```ts id="9aq1hc"
tasks.sort(byPriority)
```

Reason:
Execution ordering becomes stable.

---

## Deterministic Retry Policies

Allowed:

```ts id="nh0r0f"
retryPolicy.execute(operation)
```

where:

* policy is injected
* retry behavior is explicit
* backoff is reproducible

---

## Immutable Execution Inputs

Allowed:

```ts id="bb77kt"
Object.freeze(config)
```

Reason:
Execution cannot mutate unexpectedly.

---

## Stable Event Sequencing

Allowed:

```ts id="zw9f1n"
for (const event of orderedEvents)
```

Reason:
Execution order remains reproducible.

---

# Forbidden Patterns

## Direct Time Access

Forbidden:

```ts id="6t1b9u"
Date.now()
new Date()
performance.now()
```

inside orchestration logic.

Reason:
Execution becomes time-dependent.

---

## Randomness Without Injection

Forbidden:

```ts id="4bzr9y"
Math.random()
crypto.randomUUID()
```

without deterministic provider injection.

Reason:
Outputs become unreproducible.

---

## Unstable Concurrent Ordering

Forbidden:

```ts id="jlwm6x"
await Promise.all(dynamicTasks)
```

where ordering affects behavior.

Reason:
Execution sequence becomes nondeterministic.

---

## Mutable Shared Runtime Memory

Forbidden:

```ts id="o0kqlf"
this.currentState = next
```

across execution boundaries.

Reason:
Behavior depends on hidden history.

---

## Environment-Dependent Logic

Forbidden:

```ts id="slf5ob"
if (process.platform === 'win32')
```

inside orchestration decisions.

Reason:
Behavior diverges by host environment.

---

## Iteration Over Unstable Structures

Forbidden:

```ts id="0r9ymu"
for (const key in object)
```

when ordering matters.

Reason:
Ordering may vary across runtimes.

---

## Hidden Retry Loops

Forbidden:

```ts id="w8m5bg"
while (!success)
```

without deterministic retry contract.

Reason:
Execution timing becomes unstable.

---

## Implicit Async Side Effects

Forbidden:

```ts id="9kw5h4"
void asyncOperation()
```

without deterministic coordination.

Reason:
Execution ordering becomes unpredictable.

---

# Detection Heuristics

Flag the following patterns:

---

## Direct Time Usage

Detect:

```ts id="m9azhf"
Date.now
new Date
performance.now
```

inside runtime orchestration layers.

---

## Randomness

Detect:

```ts id="jlwm2o"
Math.random
randomUUID
crypto.randomBytes
```

without deterministic abstraction.

---

## Unstable Concurrency

Detect:

* Promise.all
* race
* unordered async processing

where output ordering matters.

---

## Mutable Cross-Request State

Detect:

* previousResult
* currentState
* activeContext

stored in long-lived services.

---

## Platform Branching

Detect:

```ts id="g3ybzw"
process.platform
os.arch
process.env
```

inside orchestration decisions.

---

## Non-Deterministic Iteration

Detect:

* object iteration
* map iteration
* unordered collections

without stable sorting.

---

## Implicit Mutation

Detect:

* object mutation
* shared references
* mutable globals

inside orchestration flow.

---

# Severity Levels

## P0 — Critical

Execution outcome cannot be reproduced.

Examples:

* direct randomness
* hidden mutable state
* unstable orchestration ordering

Must fix before release.

---

## P1 — High

Execution partially diverges.

Examples:

* unstable retries
* environment branching
* implicit concurrency ordering

Must migrate.

---

## P2 — Transitional

Legacy nondeterministic behavior with migration plan.

Allowed temporarily only.

---

## P3 — Informational

Execution fully deterministic.

No action required.

---

# Refactoring Guidance

## Replace Direct Time Access

BAD:

```ts id="jlwmq2"
Date.now()
```

GOOD:

```ts id="m1o1s8"
clock.now()
```

---

## Replace Randomness

BAD:

```ts id="sgj3q7"
Math.random()
```

GOOD:

```ts id="l3lh6h"
idGenerator.generate()
```

---

## Stabilize Concurrency

BAD:

```ts id="jlwmuj"
Promise.all(tasks)
```

GOOD:

```ts id="0lw3c0"
for (const task of orderedTasks)
```

when ordering matters.

---

## Remove Shared Mutable State

BAD:

```ts id="xq3g55"
this.state = updated
```

GOOD:

```ts id="wr0gxy"
return nextState
```

---

## Externalize Environment Decisions

BAD:

```ts id="3gcjlwm"
if (process.platform === 'darwin')
```

GOOD:

```ts id="jlwm2s"
hostCapability.resolveBehavior()
```

---

## Enforce Stable Ordering

BAD:

```ts id="jlwmjw"
for (const key in object)
```

GOOD:

```ts id="n4g7ol"
Object.keys(object).sort()
```

---

# Runtime Impact

Violating determinism causes:

* unreplayable execution
* inconsistent orchestration
* debugging impossibility
* distributed divergence
* unreliable recovery
* unstable retries
* nondeterministic side effects
* operational unpredictability

Without determinism:
the runtime becomes behaviorally unsafe.

---

# Migration Notes

## Transitional Nondeterminism Must Include

```ts id="8a0qk5"
/**
 * @deprecated-nondeterminism
 * Source:
 * Replacement strategy:
 * Removal target:
 */
```

---

## Migration Strategy

1. Identify nondeterministic behavior
2. Inject deterministic providers
3. Stabilize execution ordering
4. Remove hidden mutation
5. Externalize environment assumptions
6. Add replay-safe orchestration

---

# Validation Requirements

A runtime service is compliant only if:

* identical inputs produce identical outputs
* execution ordering is stable
* randomness is injected
* time is injectable
* mutable hidden state does not exist
* orchestration behavior is reproducible
* environment assumptions are abstracted
* side-effect ordering is controlled

---

# Compliance Goal

Prana must behave as:

* a deterministic orchestration runtime
* a reproducible execution substrate
* a stable coordination kernel

NOT:

* a timing-sensitive runtime
* an unpredictable orchestration engine
* an environment-coupled execution system

```
```
