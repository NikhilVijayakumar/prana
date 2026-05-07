# Replayability Invariant

````md id="2x4r2u"
# Replayability Invariant

## Purpose

Prana is a deterministic orchestration runtime.

All runtime behavior must be reproducible from:
- explicit inputs
- explicit configuration
- explicit persisted state
- explicit events

The runtime must support deterministic replay of orchestration behavior for:
- debugging
- auditing
- recovery
- simulation
- verification
- observability
- testing

Replayability guarantees that the same execution context can reproduce the same orchestration outcome.

---

# Architectural Rule

Runtime behavior must be reconstructable without hidden runtime memory.

All execution decisions must derive only from:
- input payloads
- injected capabilities
- explicit persisted state
- deterministic configuration
- recorded events

Runtime services may not rely on:
- hidden process memory
- implicit timing behavior
- unordered concurrency
- nondeterministic state accumulation
- external mutable globals

---

# Allowed Patterns

## Explicit Event Recording

Allowed:

```ts
await eventLog.record({
  type: 'TASK_EXECUTED',
  payload
})
````

Reason:
Execution history becomes reproducible.

---

## Deterministic Inputs

Allowed:

```ts id="7m3gk8"
execute({
  timestamp,
  requestId,
  config
})
```

Reason:
All execution dependencies are explicit.

---

## Injected Time Providers

Allowed:

```ts id="vb2kj5"
constructor(
  private readonly clock: ClockCapability
)
```

Reason:
Time becomes replayable.

---

## Idempotent Execution

Allowed:

```ts id="kcvqhl"
if (alreadyProcessed(eventId)) {
  return
}
```

Reason:
Replay does not corrupt state.

---

## Serializable Context

Allowed:

```ts id="0xv7jy"
JSON.stringify(executionContext)
```

Reason:
Execution can be reconstructed.

---

# Forbidden Patterns

## Hidden Runtime Memory Dependency

Forbidden:

```ts id="rj8d8z"
this.previousExecution = result
```

Reason:
Replay depends on invisible state.

---

## Direct Time Access

Forbidden:

```ts id="i7r6gc"
Date.now()
new Date()
```

inside orchestration logic.

Reason:
Execution becomes nondeterministic.

---

## Randomness Without Injection

Forbidden:

```ts id="6sm0kk"
Math.random()
crypto.randomUUID()
```

without deterministic providers.

Reason:
Replay cannot reproduce behavior.

---

## Untracked Side Effects

Forbidden:

```ts id="tmh0lq"
await sendEmail()
```

without event recording or effect tracking.

Reason:
Replay loses orchestration history.

---

## Unordered Concurrent Execution

Forbidden:

```ts id="e9hv0x"
await Promise.all(tasks)
```

where ordering affects behavior.

Reason:
Execution sequence becomes unstable.

---

## Implicit Retry Behavior

Forbidden:

```ts id="4r62zh"
while (!success) retry()
```

without deterministic retry policy recording.

Reason:
Replay diverges from original execution.

---

## Runtime-Owned Execution Context

Forbidden:

```ts id="67v91m"
this.activeExecutionContext
```

Reason:
Replay depends on hidden runtime state.

---

# Detection Heuristics

Flag the following patterns:

---

## Direct Time Usage

Detect:

```ts id="kjlwmq"
Date.now
new Date
performance.now
```

inside orchestration logic.

---

## Randomness

Detect:

```ts id="7ymfyy"
Math.random
randomUUID
crypto.randomBytes
```

without injected deterministic providers.

---

## Mutable Execution History

Detect:

* previousExecution
* lastResult
* cachedDecision

stored in service memory.

---

## Untracked Side Effects

Detect:

* email sends
* notifications
* network writes
* filesystem writes

without:

* event recording
* execution metadata
* correlation IDs

---

## Non-Deterministic Concurrency

Detect:

* Promise.all
* race conditions
* unordered async processing

where output ordering matters.

---

## Hidden Retry Loops

Detect:

* while retry
* recursive retry
* exponential backoff

without explicit replay metadata.

---

# Severity Levels

## P0 — Critical

Execution cannot be deterministically replayed.

Examples:

* hidden memory dependency
* direct randomness
* untracked orchestration state

Must fix before release.

---

## P1 — High

Replay partially diverges.

Examples:

* implicit retry timing
* unstable concurrency ordering
* missing event metadata

Must migrate.

---

## P2 — Transitional

Legacy orchestration lacking full replay guarantees.

Allowed temporarily with migration plan.

---

## P3 — Informational

Execution fully reconstructable.

No action required.

---

# Refactoring Guidance

## Inject Deterministic Providers

BAD:

```ts id="6i2n6m"
Date.now()
```

GOOD:

```ts id="zy2fcl"
clock.now()
```

---

## Externalize Execution History

BAD:

```ts id="0q42c7"
this.previousTask
```

GOOD:

```ts id="olrt9x"
eventStore.record()
```

---

## Record All Side Effects

BAD:

```ts id="9t9w0z"
await sendNotification()
```

GOOD:

```ts id="v6uyb9"
await eventLog.record(effect)
await notifier.send(effect)
```

---

## Serialize Execution Context

BAD:

```ts id="3tkwqf"
complex runtime closures
```

GOOD:

```ts id="8g0mhm"
plain serializable execution objects
```

---

## Stabilize Concurrency

BAD:

```ts id="r3pwbv"
Promise.all(dynamicTasks)
```

GOOD:

```ts id="2wlzql"
for (const task of orderedTasks)
```

when ordering matters.

---

# Runtime Impact

Violating replayability causes:

* impossible debugging
* recovery failures
* inconsistent orchestration
* audit gaps
* nondeterministic execution
* broken simulations
* irreproducible failures
* unsafe retries

Without replayability:
the runtime becomes operationally opaque.

---

# Migration Notes

## Transitional Non-Replayable Logic Must Include

```ts id="dfst8g"
/**
 * @deprecated-nonreplayable
 * Reason:
 * Replay gap:
 * Removal target:
 */
```

---

## Migration Strategy

1. Identify hidden execution state
2. Externalize execution history
3. Inject deterministic providers
4. Record orchestration events
5. Stabilize execution ordering
6. Remove implicit runtime memory

---

# Validation Requirements

A runtime service is compliant only if:

* execution depends only on explicit inputs
* orchestration history is reconstructable
* side effects are traceable
* execution ordering is deterministic
* runtime memory is not required for replay
* time/randomness are injectable
* execution context is serializable

---

# Compliance Goal

Prana must behave as:

* a replayable orchestration runtime
* a deterministic execution substrate
* an auditable coordination kernel

NOT:

* an opaque process runtime
* a hidden state machine
* an unreproducible orchestration engine

```
```
