# Runtime Map: Queue Scheduling

> Service Runtime Contract - Layer 4: Intelligence & Integration

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/queue-scheduling/queue-scheduling.md` |
| Implementation | `src/main/services/queueOrchestratorService.ts`, `queueService.ts`, `taskRegistryService.ts` |
| Layer | 4 - Intelligence & Integration |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Multi-Lane Isolation:** Model (AI), Channel (External), System (Cron)
- **Persistent Task Registry:** SQLite-backed crash recovery
- **Priority Scheduling:** Priority-based execution within/across lanes
- **Deterministic Execution:** Exactly-once or safe retry
- **Concurrency Control:** max_parallel_tasks per lane and global
- **Retry Management:** Lane-specific retry strategies
- **Temporal Scheduling:** One-shot and recurring (cron) tasks
- **Backpressure Handling:** Throttling and lane isolation

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (task execution)
- [x] Explicit persistence through contracts (taskRegistryService - better-sqlite3)
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state (factory pattern)
- [x] No in-memory queue accumulation

---

## 3. Persistence Rules

### Storage Interface
- **Task Registry:** `taskRegistryService` - better-sqlite3
- **Lifecycle Queue:** `governanceLifecycleQueueStoreService` - better-sqlite3

### Current Implementation
- **Pattern:** Factory pattern (`createQueueOrchestrator`)
- **State:** Instance-level only, all task state in SQLite

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Priority scheduling deterministic
- Exactly-once execution guarantee
- Retry behavior deterministic

---

## 5. Replayability Requirements

- [x] **Yes** - fully deterministic
- Task state persisted in SQLite for crash recovery

---

## 6. Side Effects

**Allowed side effects:**
- Task execution (delegated to domain services)
- Task state persistence
- Lane management

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { queueOrchestratorService } from './queueOrchestratorService';
import { taskRegistryService } from './taskRegistryService';
import { governanceLifecycleQueueStoreService } from './governanceLifecycleQueueService';
```

### Forbidden Imports
- ❌ Mutable in-memory queues
- ❌ Business logic execution (delegates to domain)

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Task lifecycle
- Queue lifecycle
- Execution lifecycle

**Does NOT own:**
- Business logic lifecycle (delegates)
- System health (respects Vaidyar)

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Queue Orchestrator | `IQueueOrchestratorService` | `queueOrchestratorService` |
| Task Registry | `ITaskRegistryService` | `taskRegistryService` |
| Lifecycle Queue | `IGovernanceLifecycleQueueStoreService` | `governanceLifecycleQueueStoreService` |

---

## 11. Extension Surface

**Clients may override:**
- Custom lane configurations
- Retry strategies
- Priority algorithms

---

## 12. Security Boundaries

- [x] IPC (queue operations)
- [x] Storage (task persistence)
- [ ] Auth
- [ ] None

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Migration Status
- **Pattern:** Factory (`createQueueOrchestrator`)
- **State:** Instance-level only, all state externalized

### Detection Heuristics Applied
- ✅ No mutable class properties
- ✅ No in-memory queue accumulation

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Factory, state externalized |
| Determinism | ✅ Requirements | Priority, retry deterministic |
| Replayability | ✅ Yes | SQLite crash recovery |
| Composability | ✅ | Uses store services |
| Lifecycle Safety | ✅ | Task lifecycle only |
| Policy Neutrality | ✅ | Pure queue orchestration |
| Storage Neutrality | ✅ | Uses external SQLite |

---

## 15. Lane Model (From Feature)

| Lane | Purpose |
|------|---------|
| **Model** | AI inference tasks |
| **Channel** | External communication |
| **System** | Cron / Maintenance |

---

## 16. Key Behaviors

- **Exactly-Once:** Execution guarantee or safe retry
- **Multi-Lane:** Segregated execution paths
- **Backpressure:** Throttling to prevent overload
- **Persistent:** All state in SQLite

---

## 17. What It Does NOT Do

- Execute business logic (delegates to domain services)
- Override system health (respects Vaidyar)
- Persist business data (only task metadata)

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 4 - Intelligence & Integration*