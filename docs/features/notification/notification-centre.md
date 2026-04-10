# 🔔 Feature: Event Registry & Notification Centre (Enhanced)

**Version:** 1.2.0
**Status:** Stable
**Pattern:** Event-Driven Observer · Deterministic Event Pipeline
**Services:** `hookSystemService.ts` · `notificationCentreService.ts` · `notificationStoreService.ts` · `notificationValidationService.ts` · `notificationRateLimiterService.ts` · `vaidyarService.ts`
**UI Stack:** `shared-components/notifications/` · `DirectorInteractionBar.tsx`
**Capability:** Provides a centralized event registry and notification pipeline for capturing, classifying, and surfacing real-time system signals, workflow updates, and diagnostic alerts.

---

## 1. Tactical Purpose

The **Event Registry & Notification Centre** acts as the **central nervous system** of the Prana runtime.

It ensures that:

* All system events are **captured deterministically**
* Events are **classified and prioritized consistently**
* Critical signals are **never lost or suppressed**
* Operators maintain **continuous situational awareness**

It operates as:

* A **system-wide event ingestion layer**
* A **priority classification engine**
* A **UI notification bridge**
* A **real-time observability surface**

---

## 2. System Invariants (Critical)

1. **Event Immutability**

   * Once emitted, an event MUST NOT be mutated
   * All transformations must produce derived events

2. **Deterministic Delivery**

   * Events MUST be delivered in emission order per channel
   * No silent drops allowed for CRITICAL events

3. **At-Least-Once Delivery**

   * Events MUST be delivered at least once to subscribers
   * Duplicate handling must be consumer-safe

4. **Priority Integrity**

   * Priority classification MUST NOT be overridden downstream
   * CRITICAL events MUST always surface

5. **Separation of Concerns**

   * Event Bus ≠ Notification UI ≠ Audit Log
   * Each layer must remain independent

---

## 3. Architectural Layers

### 3.1 Event Bus Layer (`hookSystemService`)

Responsibilities:

* Event emission
* Channel-based routing
* Subscriber management

---

### 3.2 Classification Layer (Notification Centre Core)

Responsibilities:

* Priority assignment
* enrichment (`actionRoute`, metadata)
* filtering rules

---

### 3.3 Delivery Layer (IPC Bridge)

Responsibilities:

* Main → Renderer propagation
* batching (if needed)
* delivery guarantees

---

### 3.4 Presentation Layer (UI)

Responsibilities:

* Toast rendering
* notification list
* unread state management

---

## 4. Event Data Contract (Formalized)

### 4.1 Base Event Schema

```ts
{
  event_id: string,
  event_type: string,
  source: string,
  timestamp: number,
  payload: Record<string, any>,
  priority: 'INFO' | 'WARN' | 'CRITICAL' | 'ACTION',
  actionRoute?: string
}
```

---

### 4.2 Event Naming Convention

```text
<domain>:<action>[:<state>]
```

**Examples:**

```text
vaidyar:pulse_fail
vault:mount:failed
email:poll:success
cron:job:missed
```

---

### 4.3 Event Channels (Logical Separation)

| Channel       | Purpose               |
| :------------ | :-------------------- |
| `system`      | Core runtime events   |
| `storage`     | Vault / Drive events  |
| `integration` | Email / Google        |
| `agent`       | AI / workflow signals |
| `diagnostic`  | Vaidyar health        |

---

## 5. Event Lifecycle

```text
EMITTED → REGISTERED → CLASSIFIED → DELIVERED → DISPLAYED → EXPIRED
```

---

### 5.1 Lifecycle Rules

* Events MUST:

  * be timestamped at emission
  * be classified before delivery

* Expiry:

  * INFO → auto-expire
  * WARN → persistent until viewed
  * CRITICAL → persistent until resolved

---

## 6. The Notification Pipeline (Refined)

### 6.1 Emission

Example:

```ts
hookSystem.emit('vaidyar:pulse_fail', payload)
```

---

### 6.2 Registration

* Event stored in in-memory registry
* Assigned `event_id`

---

### 6.3 Classification

* Determine:

  * priority tier
  * action route
  * display rules

---

### 6.4 Delivery

* Sent via IPC to renderer
* Guaranteed ordering per channel

---

### 6.5 Presentation

* Toast + Notification list update
* Badge increment

---

## 7. Priority Model (Extended)

| Tier                | Semantic         | Behavior                |
| :------------------ | :--------------- | :---------------------- |
| **CRITICAL (Roga)** | System failure   | Blocking / persistent   |
| **WARN (Glani)**    | Degraded state   | Persistent until viewed |
| **INFO (Swastha)**  | Normal operation | Auto-dismiss            |
| **ACTION**          | Requires input   | Sticky + interactive    |

---

## 8. Vaidyar Integration (Deepened)

### 8.1 Event Sources

* Health pulse failures
* subsystem degradation
* recovery success/failure

---

### 8.2 Mapping Rules

| Vaidyar Signal   | Notification |
| :--------------- | :----------- |
| Security failure | CRITICAL     |
| Storage issue    | CRITICAL     |
| Connectivity lag | WARN         |
| Recovery success | INFO         |

---

### 8.3 Constraints

* Vaidyar events MUST:

  * bypass filtering
  * always surface to UI

---

## 9. Persistence & Retention Model

### 9.1 Session Window

* In-memory sliding window (default N events)

---

### 9.2 Optional Persistence (Future)

* SQLite-backed notification history
* queryable by:

  * time range
  * priority
  * source

---

### 9.3 Retention Rules

| Tier     | Retention       |
| :------- | :-------------- |
| INFO     | ephemeral       |
| WARN     | session         |
| CRITICAL | until resolved  |
| ACTION   | until completed |

---

## 10. Integration Points

### 10.1 With Cron Scheduler

* Emits:

  * job success/failure
  * missed executions

---

### 10.2 With Email Pipeline

* Emits:

  * new mail processed
  * draft ready
  * errors

---

### 10.3 With Vault / Sync

* Emits:

  * sync status
  * conflict alerts
  * mount failures

---

### 10.4 With Startup Orchestrator

* Emits:

  * bootstrap progress
  * failure states

---

## 11. Failure Modes & Handling

| Scenario               | Behavior                                |
| :--------------------- | :-------------------------------------- |
| Event emission failure | Log + retry                             |
| IPC delivery failure   | Queue + retry                           |
| UI not mounted         | Buffer events                           |
| Duplicate event        | Allow (consumer-safe)                   |
| Event flood            | Apply rate limiting (non-critical only) |

---

## 12. Observability

System MUST track:

* events emitted per module
* delivery latency
* dropped/failed deliveries
* CRITICAL event frequency
* user interaction (click-through rate)

---

## 13. Security Model

### 13.1 Event Validation

* Payload MUST:

  * conform to schema
  * avoid unsafe content

---

### 13.2 Injection Protection

* UI MUST:

  * sanitize event payload before rendering
  * prevent script injection

---

### 13.3 Access Constraints

* Sensitive events MUST:

  * respect access level (future ACL layer)

---

## 14. Deterministic Guarantees

* Events are immutable after emission
* Delivery order is preserved per channel
* CRITICAL events are never dropped
* Notification rendering is consistent
* Event → Notification mapping is deterministic

---

## 15. Known Architectural Gaps (Expanded)

| Area                     | Gap                                     | Impact   |
| :----------------------- | :-------------------------------------- | :------- |
| Host Coupling            | `DirectorInteractionBar` not abstracted | Critical |
| Deep Linking             | Weak `actionRoute` granularity          | High     |
| Persistence              | No durable notification store           | High     |
| External Forwarding      | No Telegram/WhatsApp bridge             | High     |
| Event Schema Enforcement | No strict validation layer              | Medium   |
| Rate Limiting            | No flood protection logic               | Medium   |

---

## 16. Cross-Module Contracts

* **Hook System**

  * MUST guarantee event emission reliability

* **Vaidyar**

  * MUST emit structured diagnostic events

* **UI Layer**

  * MUST not mutate event data
  * MUST respect priority rules

* **Future Sync Engine**

  * MUST emit conflict + reconciliation events

---

## 17. Deterministic Boundaries

### Event Boundary

```
SERVICE → EVENT EMISSION → HOOK SYSTEM
```

---

### Classification Boundary

```
RAW EVENT → PRIORITIZED EVENT
```

---

### Notification Boundary

```
EVENT → UI NOTIFICATION
```

---

### Audit Boundary

```
EVENT ≠ AUDIT LOG (separate persistence)
```

---

## 18. System Role (Final Positioning)

This module is now:

* The **central event backbone** of the runtime
* The **real-time visibility layer** for all subsystems
* The **bridge between backend state and operator awareness**

---

## 19. Strategic Role in Architecture

It binds:

* **Scheduler** → operational visibility
* **Email** → workflow awareness
* **Vault/Sync** → data integrity alerts
* **Vaidyar** → system health enforcement

---

### Critical Observation

Right now, your system has:

* Strong execution (**Scheduler**)
* Strong orchestration (**Startup**)
* Strong inspection (**Viewer**)
* Strong event visibility (**Notification Centre**)

---

## 20. Security Enforcement (v1.2)

| Enforcement | Mechanism | Status |
|---|---|---|
| **IPC Validation** | All notification IPC handlers accept typed payloads | ✅ Enforced |
| **Event Schema** | `notificationValidationService.ts` provides schema enforcement per §13.1 | ✅ Resolved in v1.2 |
| **Rate Limiting** | `notificationRateLimiterService.ts` enforces rate limits per §8.3 | ✅ Resolved in v1.2 |
| **Injection Protection** | UI rendering sanitizes event payloads per §13.2 | ✅ Enforced |
| **Priority Bypass** | CRITICAL events bypass rate limiting filters | ✅ Enforced |

> **Note:** Event Schema Enforcement and Rate Limiting were previously listed as gaps — both are now covered by dedicated services introduced in v1.2.

