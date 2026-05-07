# Runtime Map: Virtual Drive

> Service Runtime Contract - Layer 2: Secure Persistence

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/storage/virtual-drive.md` |
| Implementation | `src/main/services/driveControllerService.ts` |
| Layer | 2 - Secure Persistence |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **System Drive Management:** Hot cache root for SQLite and transient files
- **Vault Drive Orchestration:** Encrypted mount/unmount for sync operations
- **Path Resolution:** Deterministic abstracted mount paths
- **Lifecycle Tracking:** Real-time mount registry
- **Security Posture:** Differentiate encrypted vs fallback modes

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (mount operations, path resolution)
- [x] Explicit persistence through contracts (mountRegistryService with better-sqlite3)
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state (factory pattern)
- [x] No runtime cache without lifecycle governance

---

## 3. Persistence Rules

### Storage Interface
- **Mount Registry:** `mountRegistryService` - better-sqlite3
- **Mount State:** Tracks mount state, timestamps, failures, metadata
- **Storage Domain:** `mount_registry`

### Current Implementation
- **Persistence Type:** better-sqlite3 via mountRegistryService
- **Pattern:** Factory pattern

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Mount path resolution must be deterministic
- Mount state transitions must be reproducible
- Fallback resolution must be deterministic

---

## 5. Replayability Requirements

- [x] **Partial** - with external mount registry
- Can replay mount operations from registry

---

## 6. Side Effects

**Allowed side effects:**
- OS-level mount/unmount operations
- Filesystem path resolution
- Mount state persistence

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { mountRegistryService } from './mountRegistryService';
import { virtualDriveProvider } from './virtualDriveProvider';
import { vaultService } from './vaultService';
```

### Forbidden Imports
- ❌ Direct filesystem access (go through provider)
- ❌ Mutable state

---

## 8. Host Assumptions

- [x] Electron (primary host - OS mount operations)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Mount/unmount lifecycle
- Path resolution lifecycle
- Security posture lifecycle

**Does NOT own:**
- Encryption lifecycle (Vault Service)
- Data policy lifecycle
- Sync timing lifecycle

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Mount Registry | `IMountRegistryService` | `mountRegistryService` |
| Provider | `IVirtualDriveProvider` | `virtualDriveProvider` |
| Vault | `IVaultService` | `vaultService` |

---

## 11. Extension Surface

**Clients may override:**
- Provider implementation (custom mount logic)
- Fallback behavior
- Fail-closed vs fail-open policy

---

## 12. Security Boundaries

- [x] IPC (mount operations)
- [x] Storage (mount point security)
- [ ] Auth
- [ ] None

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Migration Status
- **Pattern:** Factory pattern
- **State:** Instance-level only

### Detection Heuristics Applied
- ✅ No mutable class properties
- ✅ No static mutable fields

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Factory pattern, path resolution stateless |
| Determinism | ✅ Requirements | Deterministic path resolution |
| Replayability | ✅ Partial | With mount registry |
| Composability | ✅ | Provider abstraction |
| Dependency Direction | ✅ | Layer 2 depends on Layer 3 services |
| Lifecycle Safety | ✅ | Mount lifecycle only |
| Policy Neutrality | ✅ | Pure storage gatekeeper |
| Storage Neutrality | ✅ | Uses external mount registry |

---

## 15. Drive Types

| Drive | Purpose | Lifecycle |
|-------|---------|-----------|
| **System Drive** | Hot cache (SQLite, transient files) | Always mounted when runtime active |
| **Vault Drive** | Cold archive (encrypted) | On-demand mount/unmount |

---

## 16. Key Behaviors

- **Fail-Closed Policy:** Can block startup instead of silently downgrading
- **Provider Abstraction:** Uses virtualDriveProvider contract
- **Health Visibility:** Exposes signals to Vaidyar (Runtime Doctor)
- **Fallback Resolution:** Controlled fallback to local filesystem

---

## 17. Verification Commands

```bash
# Verify mount registry uses better-sqlite3
grep -r "better-sqlite3" src/main/services/mountRegistryService.ts
```

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 2 - Secure Persistence*