# Runtime Map: Notification Centre

> Service Runtime Contract - Layer 1: Bootstrap & Foundation

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/notification/notification-centre.md` |
| Implementation | `src/main/services/notificationCentreService.ts` |
| Layer | 1 - Bootstrap & Foundation |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- Centralized event ingestion layer
- Priority classification engine
- UI notification bridge
- Real-time observability surface

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (notification objects, telemetry)
- [x] Explicit persistence through contracts (notificationStoreService)
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state (factory pattern)
- [x] No in-memory session retention
- [x] No runtime cache without lifecycle governance

---

## 3. Persistence Rules

### Storage Interface
- **Notification Store:** `notificationStoreService` - better-sqlite3
- Events persisted for audit trail and replay

### Current Implementation
- **Persistence Type:** better-sqlite3 via notificationStoreService
- **Pattern:** Factory pattern with instance state

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Event emission order per channel
- Priority classification consistency
- CRITICAL events always surface (no silent drops)
- At-least-once delivery guarantee

---

## 5. Replayability Requirements

- [x] **Partial** - with external state (notificationStoreService)
- Event history can be replayed from store
- Consumer handles duplicate detection

---

## 6. Side Effects

**Allowed side effects:**
- Persist notification to SQLite store
- Rate limiting enforcement
- Emit to registered listeners
- UI bridge notifications

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { vaidyarService, VaidyarHealthEvent } from './vaidyarService';
import { notificationStoreService, Notification } from './notificationStoreService';
import { notificationRateLimiterService } from './notificationRateLimiterService';
import { notificationValidationService } from './notificationValidationService';
```

### Forbidden Imports
- ❌ Mutable in-memory registries
- ❌ Stateful singletons

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Event ingestion lifecycle
- Classification lifecycle
- Delivery lifecycle

**Does NOT own:**
- User session lifecycle
- Authentication lifecycle

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Storage | `INotificationStoreService` | `notificationStoreService` |
| Validation | `INotificationValidationService` | `notificationValidationService` |
| Rate Limiting | `INotificationRateLimiterService` | `notificationRateLimiterService` |
| AI Events | `IVaidyarService` | `vaidyarService` |

---

## 11. Extension Surface

**Clients may override:**
- Custom notification channels
- Priority thresholds
- Rate limiting policies

---

## 12. Security Boundaries

- [x] IPC (event transmission)
- [x] Storage (notification persistence)
- [ ] Auth
- [ ] None

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Migration Status
- **Pattern:** Factory (created: `createNotificationCentre`)
- **State:** Instance-level only, no class-level mutable state

### Detection Heuristics Applied
- ✅ No `new Map()` in class properties
- ✅ No `new Set()` in class properties
- ✅ No `[]` arrays as class properties
- ✅ No static mutable fields

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Factory pattern, instance state only |
| Determinism | ✅ Requirements | Event order, priority classification |
| Replayability | ✅ Partial | With external store |
| Composability | ✅ | Imports validation/rate-limiter services |
| Dependency Direction | ✅ | Layer 1 depends on Layer 2 services |
| Lifecycle Safety | ✅ | Event lifecycle only |
| Policy Neutrality | ✅ | Pure notification routing |
| Storage Neutrality | ✅ | Uses external notificationStoreService |

---

## 15. System Invariants (From Feature)

1. **Event Immutability** - Once emitted, events MUST NOT be mutated
2. **Deterministic Delivery** - Events delivered in emission order, no silent drops for CRITICAL
3. **At-Least-Once Delivery** - Events delivered at least once to subscribers
4. **Priority Integrity** - CRITICAL events MUST always surface
5. **Separation of Concerns** - Event Bus ≠ Notification UI ≠ Audit Log

---

## 16. Notification Channels

| Channel | Event Types |
|---------|-------------|
| `system` | General system events |
| `storage` | vault:, storage: events |
| `integration` | email:, integration: events |
| `agent` | agent: events |
| `diagnostic` | vaidyar:, diagnostic: events |

---

## 17. Priority Levels

| Priority | Expiry | Behavior |
|----------|--------|----------|
| `INFO` | 1 hour auto-expire | Low urgency |
| `WARN` | Session-based | User must dismiss |
| `CRITICAL` | Never expire | Always surface |

---

## 18. Verification Commands

```bash
# Verify no mutable state
grep -r "private.*=" src/main/services/notificationCentreService.ts | grep -v "readonly"

# Verify better-sqlite3
grep -r "better-sqlite3" src/main/services/notificationStoreService.ts
```

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 1 - Bootstrap & Foundation*