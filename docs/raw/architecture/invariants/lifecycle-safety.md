# Lifecycle Safety Invariant

````md id="n6r1fk"
# Lifecycle Safety Invariant

## Purpose

Prana is a deterministic orchestration runtime.

The runtime must not create unmanaged execution lifecycles,
orphaned processes, hidden background ownership,
or uncontrolled resource persistence.

All runtime lifecycle behavior must be:
- explicit
- bounded
- observable
- disposable
- recoverable

Lifecycle ownership must always be clearly defined.

The runtime may coordinate execution lifecycles,
but it must not implicitly own perpetual process behavior.

---

# Architectural Rule

Runtime services must explicitly define:
- startup behavior
- shutdown behavior
- cleanup behavior
- cancellation behavior
- disposal behavior
- resource ownership

No runtime component may create long-lived execution
without deterministic lifecycle governance.

All resources must have:
- explicit owner
- explicit cleanup path
- explicit termination semantics

---

# Allowed Patterns

## Explicit Startup/Shutdown Contracts

Allowed:

```ts
interface RuntimeLifecycle {
  start(): Promise<void>
  stop(): Promise<void>
}
````

Reason:
Lifecycle ownership becomes explicit.

---

## Disposable Resource Ownership

Allowed:

```ts id="u3c7x4"
await subscription.dispose()
```

Reason:
Resources are bounded and recoverable.

---

## Managed Scheduler Registration

Allowed:

```ts id="r6jx5s"
scheduler.register(job)
```

where:

* cancellation exists
* ownership exists
* cleanup exists

---

## Abortable Async Operations

Allowed:

```ts id="xw8vl2"
execute({
  signal: abortController.signal
})
```

Reason:
Execution can terminate safely.

---

## Explicit Resource Cleanup

Allowed:

```ts id="8f6v6d"
finally {
  await connection.close()
}
```

Reason:
Lifecycle is bounded.

---

## Controlled Worker Ownership

Allowed:

```ts id="twblsz"
workerManager.spawn(worker)
```

only if:

* ownership tracked
* shutdown coordinated
* recovery defined

---

# Forbidden Patterns

## Unmanaged Intervals

Forbidden:

```ts id="1z4xk5"
setInterval(() => {}, 1000)
```

without:

* cleanup
* disposal
* owner tracking

Reason:
Creates orphaned runtime behavior.

---

## Hidden Background Processes

Forbidden:

```ts id="twn1hn"
startWorker()
```

without lifecycle contract.

Reason:
Runtime silently owns execution lifecycle.

---

## Orphaned Event Listeners

Forbidden:

```ts id="hm8c0w"
eventEmitter.on(...)
```

without removal/disposal.

Reason:
Causes memory retention and lifecycle leaks.

---

## Infinite Retry Ownership

Forbidden:

```ts id="j4u8wy"
while (true) retry()
```

Reason:
Creates uncontrolled execution ownership.

---

## Runtime-Owned Permanent Subscriptions

Forbidden:

```ts id="4z17g3"
this.activeSubscriptions.push(subscription)
```

without disposal governance.

Reason:
Runtime accumulates hidden lifecycle state.

---

## Fire-And-Forget Async Execution

Forbidden:

```ts id="scm2pt"
void asyncTask()
```

without:

* tracking
* cancellation
* recovery semantics

Reason:
Execution becomes operationally invisible.

---

## Untracked Child Processes

Forbidden:

```ts id="jlwmta"
spawn('process')
```

without ownership registry.

Reason:
Runtime loses process control.

---

# Detection Heuristics

Flag the following patterns:

---

## Timers

Detect:

```ts id="o3g7tv"
setInterval
setTimeout
```

without:

* cleanup
* cancellation
* disposal path

---

## Event Listener Registration

Detect:

```ts id="64krq1"
.on(
addEventListener(
```

without:

* removeListener
* cleanup
* abort signals

---

## Detached Async Work

Detect:

```ts id="9zjlwm"
void promise
```

or:

* unawaited promises
* background async execution

---

## Infinite Loops

Detect:

```ts id="p0u4i2"
while(true)
for(;;)
```

---

## Worker/Process Spawning

Detect:

* spawn
* fork
* Worker
* child_process

without lifecycle manager ownership.

---

## Retained Subscription Collections

Detect:

* subscriptions
* listeners
* activeJobs
* activeWorkers

stored in long-lived runtime memory.

---

# Severity Levels

## P0 — Critical

Runtime creates unmanaged lifecycle ownership.

Examples:

* orphaned workers
* unmanaged intervals
* unbounded retries
* hidden background execution

Must fix before release.

---

## P1 — High

Lifecycle partially unmanaged.

Examples:

* missing cleanup
* missing disposal
* detached async tasks

Must migrate.

---

## P2 — Transitional

Legacy lifecycle ownership with explicit migration plan.

Allowed temporarily only.

---

## P3 — Informational

Lifecycle fully governed.

No action required.

---

# Refactoring Guidance

## Replace Raw Timers With Lifecycle Scheduler

BAD:

```ts id="vhm6y6"
setInterval(job, 1000)
```

GOOD:

```ts id="jlwm4g"
scheduler.register(job)
```

---

## Add Disposal Contracts

BAD:

```ts id="cyv4d2"
eventEmitter.on(event, handler)
```

GOOD:

```ts id="mgp8mg"
const disposable = listener.attach()
await disposable.dispose()
```

---

## Replace Fire-And-Forget Execution

BAD:

```ts id="qz0a7p"
void asyncTask()
```

GOOD:

```ts id="vq4e0f"
taskManager.track(task)
```

---

## Externalize Worker Ownership

BAD:

```ts id="5n5v7x"
spawn(worker)
```

GOOD:

```ts id="mhly6z"
workerLifecycleManager.spawn(worker)
```

---

## Inject Cancellation Support

BAD:

```ts id="jr4v0z"
execute()
```

GOOD:

```ts id="4tpm7e"
execute({ signal })
```

---

# Runtime Impact

Violating lifecycle safety causes:

* memory leaks
* zombie processes
* orphaned workers
* unstable shutdown
* unrecoverable orchestration
* operational invisibility
* retry storms
* resource exhaustion

Without lifecycle safety:
the runtime becomes operationally dangerous.

---

# Migration Notes

## Transitional Lifecycle Ownership Must Include

```ts id="s3v2kn"
/**
 * @deprecated-lifecycle-ownership
 * Resource:
 * Cleanup strategy:
 * Removal target:
 */
```

---

## Migration Strategy

1. Identify hidden lifecycle ownership
2. Add explicit lifecycle contracts
3. Add disposal semantics
4. Add cancellation support
5. Centralize lifecycle management
6. Remove unmanaged background execution

---

# Validation Requirements

A runtime service is compliant only if:

* all resources have explicit owners
* all async execution is observable
* all listeners are disposable
* all workers are governed
* all timers are managed
* shutdown behavior is deterministic
* cancellation is supported
* cleanup paths are explicit

---

# Compliance Goal

Prana must behave as:

* a lifecycle-safe orchestration runtime
* a bounded execution substrate
* a recoverable coordination kernel

NOT:

* a perpetual background runtime
* an unmanaged process container
* a hidden worker system
* an orphaned execution engine

```
```
