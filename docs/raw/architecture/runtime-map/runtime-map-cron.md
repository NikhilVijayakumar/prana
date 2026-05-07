# Runtime Map: Cron Scheduler

> Service Runtime Contract - Layer 3: Data Lifecycle & Sync

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/cron/cron.md` |
| Implementation | `src/main/services/cronSchedulerService.ts` |
| Layer | 3 - Data Lifecycle & Sync |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Persistent Scheduling Authority:** SQLite-backed job management
- **Recovery-Aware Executor:** Missed window reconciliation
- **Controlled Dispatcher:** Delegate to feature-specific handlers
- **Deterministic Task Scheduling:** Time-based operations with guarantees

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (job execution)
- [x] Explicit persistence through contracts (governanceLifecycleQueueStoreService)
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state (factory pattern)
- [x] **No setInterval** - scheduler is on-demand only
- [x] No jobs Map in class
- [x] No executor Maps in class

---

## 3. Persistence Rules

### Storage Interface
- **Job State:** `governanceLifecycleQueueStoreService` - better-sqlite3
- **Storage Domain:** `cron_scheduler_state`

### Migration Status (Key Fix)
- ✅ **setInterval removed** - scheduler now on-demand only
- ✅ **jobs Map removed** - state externalized to SQLite
- ✅ **executor Maps removed** - state externalized

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Single execution guarantee (no duplicate execution per window)
- Deterministic recovery for missed executions
- Reproducible job scheduling

---

## 5. Replayability Requirements

- [x] **Yes** - fully deterministic
- SQLite state is source of truth for job definitions, execution history, lock state

---

## 6. Side Effects

**Allowed side effects:**
- Job execution (via delegated handlers)
- Job state persistence
- Recovery operations

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { governanceLifecycleQueueStoreService } from './governanceLifecycleQueueService';
import { hookSystemService } from './hookSystemService';
import { syncProviderService } from './syncProviderService';
```

### Forbidden Imports
- ❌ setInterval / setTimeout for background scheduling
- ❌ Mutable in-memory registries

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Job definition lifecycle
- Execution lifecycle
- Recovery lifecycle

**Does NOT own:**
- User workflow lifecycle

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Queue Store | `IGovernanceLifecycleQueueStoreService` | `governanceLifecycleQueueStoreService` |
| Hooks | `IHookSystemService` | `hookSystemService` |
| Sync | `ISyncProviderService` | `syncProviderService` |

---

## 11. Extension Surface

**Clients may override:**
- Custom job handlers
- Recovery policies
- Execution timing

---

## 12. Security Boundaries

- [x] IPC (job scheduling)
- [x] Storage (job state)
- [ ] Auth
- [ ] None

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Migration Status (PRANA-ARCH-VIOLATION Fix)
- **Pattern:** Factory pattern
- **Key Fix:** setInterval removed, on-demand scheduler
- **State:** All job state externalized to SQLite

### Detection Heuristics Applied
- ✅ No `setInterval` in code (line 260: comment confirms removal)
- ✅ No jobs Map in class
- ✅ No executor Maps in class
- ✅ No mutable class properties

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Factory, state externalized |
| Determinism | ✅ Requirements | Single execution, deterministic recovery |
| Replayability | ✅ Yes | SQLite source of truth |
| Composability | ✅ | Uses store services |
| Dependency Direction | ✅ | Layer 3 service |
| Lifecycle Safety | ✅ | Job lifecycle only |
| Storage Neutrality | ✅ | Uses external SQLite |

---

## 15. System Invariants (From Feature)

1. **Single Execution Guarantee** - Job MUST NOT execute more than once per window
2. **Deterministic Recovery** - Missed executions resolved via explicit policy
3. **Persistence Authority** - SQLite is source of truth

---

## 16. Key Behaviors

- **On-Demand Scheduler:** No background intervals, triggered by external events
- **Recovery Policy:** Explicit handling for missed executions
- **Job State:** All state in SQLite, not memory

---

## 17. Verification Commands

```bash
# Verify no setInterval
grep -r "setInterval" src/main/services/cronSchedulerService.ts

# Verify no jobs Map
grep -r "jobs.*Map\|Map.*jobs" src/main/services/cronSchedulerService.ts
```

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 3 - Data Lifecycle & Sync*