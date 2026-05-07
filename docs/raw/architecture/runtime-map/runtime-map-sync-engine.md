# Runtime Map: Sync Engine

> Service Runtime Contract - Layer 3: Data Lifecycle & Sync

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/storage/sync-engine.md` |
| Implementation | `src/main/services/syncEngineService.ts` |
| Layer | 3 - Data Lifecycle & Sync |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Reconciliation Engine:** Cache ↔ Vault alignment
- **Governance Enforcement:** Enforce Storage Governance Rules
- **Conflict Arbitration:** Explicit conflict resolution rules
- **Recovery Backbone:** Auditable and recoverable sync operations
- **Source-of-Truth Arbitration:** Deterministic truth resolution

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (sync operations)
- [x] Explicit persistence through contracts (syncStoreService, vaultService)
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state (factory pattern - `createSyncEngine`)
- [x] No runtime cache without lifecycle governance

---

## 3. Persistence Rules

### Storage Interface
- **Sync State:** `syncStoreService` - better-sqlite3
- **Vault:** `vaultService` - AES-256-GCM
- **Cache:** `sqliteCacheService` - better-sqlite3

### Current Implementation
- **Pattern:** Factory pattern
- **State:** Instance-level only

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Reconciliation pipeline must be reproducible
- Conflict resolution must be deterministic
- Transaction boundaries must be deterministic
- Every operation must be auditable and recoverable

---

## 5. Replayability Requirements

- [x] **Yes** - fully deterministic
- All sync operations are idempotent
- Audit trail for replay

---

## 6. Side Effects

**Allowed side effects:**
- Cache read/write operations
- Vault read/write operations
- Sync state persistence
- Conflict resolution logging

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { syncStoreService } from './syncStoreService';
import { vaultService } from './vaultService';
import { sqliteCacheService } from './sqliteCacheService';
import { syncProviderService } from './syncProviderService';
```

### Forbidden Imports
- ❌ Mutable singletons
- ❌ In-memory caches

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Sync operation lifecycle
- Reconciliation lifecycle
- Conflict resolution lifecycle

**Does NOT own:**
- User session lifecycle
- Authentication lifecycle

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Sync Store | `ISyncStoreService` | `syncStoreService` |
| Vault | `IVaultService` | `vaultService` |
| Cache | `ISQLiteCacheService` | `sqliteCacheService` |
| Provider | `ISyncProviderService` | `syncProviderService` |

---

## 11. Extension Surface

**Clients may override:**
- Conflict resolution strategies
- Sync timing policies
- Custom reconciliation rules

---

## 12. Security Boundaries

- [x] IPC (sync operations)
- [x] Storage (cache + vault)
- [ ] Auth
- [ ] None

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Migration Status
- **Pattern:** Factory (`createSyncEngine`)
- **State:** Instance-level only, no class-level mutable state

### Detection Heuristics Applied
- ✅ No mutable class properties
- ✅ No static mutable fields
- ✅ No cross-request memory accumulation

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Factory pattern |
| Determinism | ✅ Requirements | Reproducible reconciliation |
| Replayability | ✅ Yes | Idempotent operations, audit trail |
| Composability | ✅ | Uses store services |
| Dependency Direction | ✅ | Layer 3 orchestration |
| Lifecycle Safety | ✅ | Sync lifecycle only |
| Policy Neutrality | ✅ | Pure reconciliation |
| Storage Neutrality | ✅ | Uses cache + vault |

---

## 15. Key Behaviors

- **Deterministic Reconciliation:** Every sync produces same result
- **Source-of-Truth Arbitration:** Clear authority for truth
- **Idempotent Execution:** Safe to retry
- **Auditable Operations:** Full audit trail

---

## 16. Verification Commands

```bash
# Verify factory pattern
grep -r "createSyncEngine" src/main/services/syncEngineService.ts
```

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 3 - Data Lifecycle & Sync*