# 🔔 Feature: Event Registry

**Version:** 2.0.0
**Status:** Core / Foundational
**Service:** `eventRegistryService`
**Pattern:** In-Memory Publish–Subscribe Event Bus
**Capability:** Provides deterministic event emission, routing, subscription, and delivery across Prana Runtime services.

---

## 1. Tactical Purpose

The Prana Event Registry is the central event coordination mechanism of the runtime.

It provides:

* event emission
* event subscription
* event routing
* event delivery

between runtime services.

The Event Registry enables runtime components to communicate without direct dependencies.

---

### 1.1 It Does

#### Event Emission

Allows services to emit runtime events.

Example:

```text
storage:sync:completed
document:pull:failed
application:started
runtime:shutdown
```

---

#### Event Subscription

Allows services to subscribe to events.

Example:

```text
Storage Scheduler
      ↓
Event Registry
      ↓
Application Launcher
```

---

#### Event Routing

Routes events to registered subscribers.

---

#### Event Delivery

Delivers events to subscribers in deterministic order.

---

### 1.2 It Does Not

#### Notification System

The Event Registry does not:

```text
Display notifications
Render toasts
Manage badges
Manage unread state
Provide notification history
```

---

#### Audit System

The Event Registry does not:

```text
Persist events
Store event history
Provide compliance records
```

---

#### Logging System

The Event Registry does not replace:

```text
Application logs
Runtime logs
Diagnostic logs
```

---

#### UI System

The Event Registry has no knowledge of:

```text
React
Electron Renderer
Screens
Components
Views
```

Applications determine how events are presented.

---

## 2. Architectural Position

```text
Storage Scheduler
      │
Vault Service
      │
Workspace Bridge
      │
Identity Service
      │
Application Launcher
      │
Application Registry
      ▼

Prana Event Registry

      ▼

Subscribers
```

---

## 3. Runtime Availability

The Event Registry becomes available at `SERVICES_READY` bootstrap state — registered second, after Configuration Service, before all other runtime services.

Callers MUST NOT emit events before `SERVICES_READY`. Events emitted before the registry is initialized have undefined behavior.

The Event Registry MUST remain available for the full duration of `OPERATIONAL` state. It is torn down during `STOPPING` after all other services, as the last service to be deregistered.

---

## 4. Core Principle

### Runtime Decoupling

Services communicate through events rather than direct dependencies.

Instead of:

```text
Service A
     ↓
Service B
```

use:

```text
Service A
     ↓
Event Registry
     ↓
Service B
```

---

### In-Memory Only

The Event Registry is transient.

Events exist only for delivery purposes.

Events are not persisted.

---

### Runtime Scoped

Events exist only during runtime execution.

Restarting the runtime clears all events.

---

## 5. Event Contract

### Base Event

```typescript
interface RuntimeEvent {
    eventId: string;

    eventType: string;

    source: string;

    timestamp: number;

    payload?: unknown;
}
```

### Field Contracts

**`eventId`** — assigned by the registry at emission. Emitters MUST NOT set this field. Format: UUID v4.

**`timestamp`** — assigned by the registry at emission as a Unix millisecond timestamp. Emitters MUST NOT set this field.

**`source`** — the service-registry key of the emitting service (e.g., `"storageScheduler"`, `"identity"`, `"appRegistry"`). MUST match the key used to register the service in the runtime service registry. Free-form strings are not permitted.

**`payload`** — optional. MUST be a serializable plain object when present. Functions, class instances, and circular references are not permitted. The registry MUST NOT mutate payload contents.

---

### Event Naming Convention

Format:

```text
<domain>:<action>[:<state>]
```

Examples:

```text
storage:sync:started
storage:sync:completed
storage:sync:failed

document:pull:completed
document:push:failed

sheet:sync:completed

application:started
application:stopped

runtime:startup
runtime:shutdown
```

---

## 6. Event Channels

Channels provide logical separation.

---

### Runtime

```text
runtime
```

Examples:

```text
runtime:startup
runtime:shutdown
runtime:configuration:changed
```

---

### Storage

```text
storage
```

Examples:

```text
storage:sync:started
storage:sync:completed
storage:sync:failed
```

---

### Integration

```text
integration
```

Examples:

```text
integration:connected
integration:disconnected
integration:sync:failed
```

---

### Identity

```text
identity
```

Examples:

```text
identity:login
identity:logout
identity:account:linked
```

---

### Application

```text
application
```

Examples:

```text
application:installed
application:started
application:stopped
application:updated
```

---

## 7. Event Lifecycle

```text
EMITTED
    ↓
ROUTED
    ↓
DISPATCHED
    ↓
FAILED (per subscriber, isolated)
```

**State definitions:**

- `EMITTED` — registry receives the event from the emitter. `eventId` and `timestamp` are assigned. Event is validated. Invalid events are rejected here and never proceed.
- `ROUTED` — registry resolves the set of active subscribers whose patterns match the event type. If no subscribers match, the event is silently dropped — this is not a failure.
- `DISPATCHED` — handler invoked for each matched subscriber in registration order. Dispatch to all subscribers completes regardless of individual subscriber failures.
- `FAILED` — a subscriber handler threw during dispatch. The failure is isolated: remaining subscribers continue to receive the event. The failure MUST be counted in observability metrics as a delivery failure. Registry-internal errors during dispatch (e.g., iteration error) MUST be isolated to that dispatch cycle. The registry MUST NOT propagate internal errors to the emitter. Internal errors MUST be recorded in observability metrics as delivery failures.

---

### Lifecycle Rules

Events must:

```text
Have eventId assigned by the registry at EMITTED
Have timestamp assigned by the registry at EMITTED
Be validated before ROUTED — invalid events rejected, not dropped silently
Be immutable after EMITTED
```

---

## 8. Subscription Model

### Handler Type

```typescript
type EventHandler = (event: RuntimeEvent) => void;
```

Handlers MUST be synchronous or fire-and-forget. A handler that returns a Promise the registry awaits would break delivery isolation — the registry does not await handler results.

---

### Pattern Syntax

Patterns follow the event naming convention `<domain>:<action>[:<state>]`.

Wildcard rules:

```text
*        — matches exactly one segment
storage:*         — matches storage:sync, storage:pull (not storage:sync:completed)
storage:sync:*    — matches storage:sync:started, storage:sync:completed
storage:*:*       — matches any two-segment event under storage:
storage:sync:completed — exact match only
```

Multi-segment wildcards (`**`) are not supported. Each `*` matches exactly one colon-delimited segment.

**Segment count mismatch:** if a pattern has more segments than the event type (e.g., pattern `storage:sync:*` applied to event `storage:sync` with 2 segments), the pattern does NOT match. Each `*` requires exactly one segment to exist in the event type.

---

### Registration

Subscribers register interest in specific events. Registration returns a `SubscriptionId` required for unsubscription.

Example:

```typescript
const subId = eventRegistry.subscribe(
    "storage:*",
    handler
);
```

---

### Unregistration

Subscribers may unsubscribe at any time using the `SubscriptionId` returned at registration.

Example:

```typescript
eventRegistry.unsubscribe(subId);
```

---

## 9. Delivery Guarantees

### Deterministic Ordering

Events are delivered in emission order.

Ordering is guaranteed within a channel.

---

### Delivery to All Active Subscribers

Each active subscriber receives each emitted event exactly once per emission.

The Event Registry is in-memory only. There is no re-delivery after process restart. Subscribers MUST NOT assume delivery across restarts. Persistence-backed delivery guarantees are out of scope.

**Intra-tick ordering:** within a single process tick, if multiple calls to `emit()` are made synchronously, events are delivered in the order they were emitted. This guarantee is per-emission, not per-subscriber — a subscriber that receives event A then event B from the same tick will receive them in that order.

---

### Isolation

Subscriber failures must not:

```text
Block delivery
Crash registry
Impact other subscribers
```

---

## 10. Service API

```typescript
interface IEventRegistry {

    emit(
        event: Omit<RuntimeEvent, 'eventId' | 'timestamp'>
    ): void;

    subscribe(
        pattern: string,
        handler: EventHandler
    ): SubscriptionId;

    unsubscribe(
        subscriptionId: SubscriptionId
    ): void;

}
```

`emit` accepts the event without `eventId` or `timestamp` — the registry assigns both. Emitters provide `eventType`, `source`, and optional `payload`.

`subscribe` returns a `SubscriptionId`. This token is required for unsubscription and MUST be retained by the caller.

`unsubscribe` silently succeeds if the `SubscriptionId` is no longer active.

---

## 11. Integration Contracts

### Storage Scheduler

May emit:

```text
storage:sync:started
storage:sync:completed
storage:sync:failed
storage:reconcile:completed
```

---

### Vault Service

May emit:

```text
vault:mounted
vault:sync:completed
vault:sync:failed
```

---

### Workspace Bridge

May emit:

```text
document:pull:completed
document:push:completed
sheet:sync:completed
```

---

### Application Launcher

May emit:

```text
application:started
application:stopped
application:crashed
```

---

### Identity Service

May emit:

```text
identity:login
identity:logout
identity:account:linked
```

---

## 12. Security Model

### Event Validation

The registry MUST validate events at emission before routing begins. Invalid events MUST be rejected — not silently dropped, not partially forwarded.

An event is invalid if any of the following are true:

```text
eventType is absent or empty
eventType does not match <domain>:<action>[:<state>] format
source is absent or empty
source does not match a recognized service-registry key format
payload contains non-serializable values (functions, class instances)
```

Rejection MUST be counted in observability metrics as a rejected event.

---

### Payload Safety

Payloads must be treated as opaque data.

The registry must not mutate payloads.

---

### Isolation

Subscribers must not modify event instances.

Events are immutable after emission.

---

## 13. Observability

The Event Registry MUST expose:

```text
Events Emitted            — total and per channel
Events Delivered          — total and per channel
Active Subscriber Count   — total and per pattern
Delivery Failures         — subscriber threw during dispatch (per channel)
Rejected Events           — failed validation at emit
```

for runtime diagnostics.

Per-channel metrics are required. Aggregated totals alone are insufficient for diagnosing which channel is generating failures or saturation.

---

## 14. Design Invariants

### Event Immutability

Events must not be modified after emission.

---

### In-Memory Only

Events are transient.

No persistence is performed.

---

### Service Decoupling

Services communicate through events.

---

### UI Independence

The Event Registry has no UI responsibility.

---

### Runtime Independence

The Event Registry must not depend on specific services.

---

### Subscriber Isolation

Subscriber failures must not affect event delivery.

---

## 15. Completion Status

The Prana Event Registry is the runtime-wide event coordination service responsible for:

```text
Event Emission
Event Subscription
Event Routing
Event Delivery
```

while explicitly excluding:

```text
Notifications
UI Rendering
Event Persistence
Audit Logging
Application Logic
```

This makes it a lightweight infrastructure service that aligns with the new Prana architecture focused on runtime services, storage coordination, application lifecycle management, and service decoupling.
