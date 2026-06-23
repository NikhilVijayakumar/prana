# 🔔 Feature: Event Registry (Notification Centre)

**Version:** 2.0.0
**Status:** Core / Foundational
**Service:** `eventRegistryService.ts`
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

## 3. Core Principle

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

## 4. Event Contract

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

## 5. Event Channels

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

## 6. Event Lifecycle

```text
EMITTED
    ↓
ROUTED
    ↓
DELIVERED
```

---

### Lifecycle Rules

Events must:

```text
Receive timestamp at emission
Receive unique identifier
Be immutable after emission
```

---

## 7. Subscription Model

### Registration

Subscribers register interest in specific events.

Example:

```typescript
eventRegistry.subscribe(
    "storage:*",
    handler
);
```

---

### Unregistration

Subscribers may unsubscribe at any time.

Example:

```typescript
eventRegistry.unsubscribe(
    subscriptionId
);
```

---

## 8. Delivery Guarantees

### Deterministic Ordering

Events are delivered in emission order.

Ordering is guaranteed within a channel.

---

### At-Least-Once Delivery

Events must be delivered to all active subscribers.

Consumers must tolerate duplicate handling if necessary.

---

### Isolation

Subscriber failures must not:

```text
Block delivery
Crash registry
Impact other subscribers
```

---

## 9. Service API

### Emit Event

```typescript
eventRegistry.emit(event);
```

---

### Subscribe

```typescript
eventRegistry.subscribe(
    pattern,
    handler
);
```

---

### Unsubscribe

```typescript
eventRegistry.unsubscribe(
    subscriptionId
);
```

---

## 10. Integration Contracts

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

## 11. Security Model

### Event Validation

Events must:

```text
Contain valid event type
Contain valid source
Contain timestamp
```

---

### Payload Safety

Payloads must be treated as opaque data.

The registry must not mutate payloads.

---

### Isolation

Subscribers must not modify event instances.

Events are immutable after emission.

---

## 12. Observability

The Event Registry should expose:

```text
Events Emitted
Events Delivered
Active Subscribers
Delivery Failures
```

for runtime diagnostics.

---

## 13. Design Invariants

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

## 14. Completion Status

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
