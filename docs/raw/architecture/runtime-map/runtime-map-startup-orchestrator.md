# Runtime Map: Startup Orchestrator

> Service Runtime Contract - Layer 1: Bootstrap & Foundation

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/boot/startup-orchestrator.md` |
| Implementation | `src/main/services/startupOrchestratorService.ts` |
| Layer | 1 - Bootstrap & Foundation |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- Coordinate deterministic bootstrap lifecycle
- Enforce identity verification before secure storage
- Validate storage layers before system readiness
- Transition runtime from INIT → OPERATIONAL states

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (stage reports, progress)
- [x] Explicit persistence through contracts (vaultService, syncProviderService)
- [x] Immutable configuration (runtimeConfig)

### Forbidden
- [x] No mutable class-level state (factory pattern)
- [x] No in-memory session retention
- [x] No runtime cache without lifecycle governance

---

## 3. Persistence Rules

### Storage Interface
- **Vault:** `vaultService` - AES-256-GCM durable archives
- **Sync State:** `syncProviderService` - Pull/push reconciliation
- **Cron:** `cronSchedulerService` - Job scheduling
- **Memory Index:** `memoryIndexService` - Hot cache

### Current Implementation
- **Persistence Type:** External services (not direct DB)
- **Pattern:** Factory function returns instance with instance-level state only

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Bootstrap state machine transitions (INIT → FOUNDATION → ... → OPERATIONAL)
- Stage execution order (sequential, no parallel across critical layers)
- Failure handling (explicit state transitions, fail-fast)
- Recovery processes (only after STORAGE_READY + INTEGRITY_VERIFIED)

---

## 5. Replayability Requirements

- [x] **Yes** - fully deterministic
- Bootstrap sequence can be replayed with same inputs
- State machine transitions are idempotent

---

## 6. Side Effects

**Allowed side effects:**
- Vault initialization (filesystem)
- Sync provider initialization (network check)
- Cron scheduler setup (job queue loading)
- Hook system registration
- Memory index initialization
- Email orchestrator startup
- Google bridge initialization
- Virtual drive mounting
- Vaidyar (AI) initialization
- Notification centre setup

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { vaultService } from './vaultService';
import { syncProviderService } from './syncProviderService';
import { cronSchedulerService } from './cronSchedulerService';
import { hookSystemService } from './hookSystemService';
import { memoryIndexService } from './memoryIndexService';
import { emailOrchestratorService } from './emailOrchestratorService';
import { googleBridgeService } from './googleBridgeService';
import { driveControllerService } from './driveControllerService';
import { notificationCentreService } from './notificationCentreService';
import { vaidyarService } from './vaidyarService';
import { hostDependencyCapabilityService } from './hostDependencyCapabilityService';
```

### Forbidden Imports
- ❌ Mutable singletons (pre-migration services)
- ❌ In-memory caches without governance

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Bootstrap lifecycle (INIT → OPERATIONAL)
- Stage execution lifecycle
- Failure recovery lifecycle

**Does NOT own:**
- Authentication lifecycle (handled by host app)
- Session lifecycle (prerequisite to bootstrap)
- User workflow lifecycle

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Vault | `IVaultService` | `vaultService` |
| Sync | `ISyncProviderService` | `syncProviderService` |
| Cron | `ICronSchedulerService` | `cronSchedulerService` |
| Hooks | `IHookSystemService` | `hookSystemService` |
| Storage | `IVirtualDriveService` | `driveControllerService` |
| Notifications | `INotificationCentreService` | `notificationCentreService` |

---

## 11. Extension Surface

**Clients (e.g., Dhi app) may override:**
- Host dependency capability gate (custom capability checks)
- Stage timeout configurations
- Failure handling strategies

---

## 12. Security Boundaries

- [x] IPC (app:bootstrap-host)
- [x] Storage (vault access gates)
- [x] Auth (identity verification before storage)
- [ ] None

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100** (same as global)

### Migration Status
- **Pattern:** Factory (created: `createStartupOrchestrator`)
- **State:** Instance-level only, no class-level mutable state

### Detection Heuristics Applied
- ✅ No `new Map()` in class properties
- ✅ No `new Set()` in class properties
- ✅ No `[]` arrays as class properties
- ✅ No static mutable fields
- ✅ No registry holding mutable memory

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Factory pattern, instance state only |
| Determinism | ✅ Requirements | Sequential stage execution, explicit transitions |
| Replayability | ✅ Yes | Idempotent bootstrap sequence |
| Composability | ✅ | Imports capability services only |
| Dependency Direction | ✅ | Layer 1 depends on Layer 2-4 services |
| Lifecycle Safety | ✅ | Owns bootstrap lifecycle only |
| Policy Neutrality | ✅ | No policy decisions, pure orchestration |
| Storage Neutrality | ✅ | Uses external storage services |

---

## 15. Transitional Violations

- [x] None

---

## 16. Planned Deprecations

None.

---

## 17. Bootstrap State Machine (From Feature)

```
INIT → FOUNDATION → IDENTITY_VERIFIED → STORAGE_READY → STORAGE_MIRROR_VALIDATING → INTEGRITY_VERIFIED → OPERATIONAL
```

### Stage Execution
1. **integration** - Runtime integration status
2. **host-dependencies** - Host capability gate
3. **governance** - Governance repo ready
4. **vault** - Vault initialization
5. **storage-mirror-validation** - Cache ↔ Vault mirror contract
6. **vaidyar** - AI service initialization
7. **sync-recovery** - Sync state recovery
8. **cron-recovery** - Cron job catch-up

---

## 18. Verification Commands

```bash
# Verify no mutable state
grep -r "private.*=" src/main/services/startupOrchestratorService.ts | grep -v "readonly"

# Verify factory pattern
grep -r "export function create" src/main/services/startupOrchestratorService.ts
```

---

## 19. Key Decision Notes

- **Why Factory Pattern:** Prevents runtime from owning bootstrap state across requests
- **Why Sequential Stages:** Guarantees deterministic execution, fail-fast guarantee
- **Why Identity Precedence:** Zero-trust initialization requires identity before vault access

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 1 - Bootstrap & Foundation*