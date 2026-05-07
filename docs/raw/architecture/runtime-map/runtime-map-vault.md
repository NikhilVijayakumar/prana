# Runtime Map: Vault

> Service Runtime Contract - Layer 2: Secure Persistence

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/storage/vault.md` |
| Implementation | `src/main/services/vaultService.ts`, `vaultRegistryService.ts`, `vaultMetadataService.ts` |
| Layer | 2 - Secure Persistence |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Global App Discovery:** Canonical `vault/global.metadata.json`
- **Structural Fingerprinting:** Hash of app Vault structure
- **Selective Access Gating:** Validate host app before Vault ops
- **Cache ↔ Vault Alignment:** Cross-verify SQLite with Vault
- **Topology Awareness:** Global map without content access

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables
- [x] Explicit persistence through contracts
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state (factory pattern)
- [x] No runtime cache without governance

---

## 3. Persistence Rules

### Storage Interface
- **Global Registry:** `vaultService` - AES-256-GCM encrypted archives
- **Metadata:** `vaultMetadataService` - JSON metadata files
- **Registry:** `vaultRegistryService` - App discovery

### Current Implementation
- **Pattern:** Factory pattern
- **Encryption:** AES-256-GCM

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- App discovery must be reproducible
- Structural fingerprinting must be deterministic
- Access gating must be deterministic

---

## 5. Replayability Requirements

- [x] **Yes** - fully deterministic
- Metadata operations are idempotent

---

## 6. Side Effects

**Allowed side effects:**
- Encrypted file read/write
- Metadata file operations
- Vault mount/unmount coordination

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { vaultService } from './vaultService';
import { vaultRegistryService } from './vaultRegistryService';
import { vaultMetadataService } from './vaultMetadataService';
```

### Forbidden Imports
- ❌ Mutable state
- ❌ Direct business data storage

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Vault mount lifecycle
- Metadata lifecycle
- App registration lifecycle

**Does NOT own:**
- Business data lifecycle
- Sync lifecycle

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Vault | `IVaultService` | `vaultService` |
| Registry | `IVaultRegistryService` | `vaultRegistryService` |
| Metadata | `IVaultMetadataService` | `vaultMetadataService` |

---

## 11. Extension Surface

**Clients may override:**
- Custom encryption keys
- Metadata schemas

---

## 12. Security Boundaries

- [x] IPC
- [x] Storage (encrypted at rest)
- [x] Auth (access gating)
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

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Factory pattern |
| Determinism | ✅ Requirements | Reproducible discovery |
| Replayability | ✅ Yes | Idempotent metadata ops |
| Composability | ✅ | Layer 2 service |
| Lifecycle Safety | ✅ | Vault lifecycle only |
| Storage Neutrality | ✅ | Uses external encryption |

---

## 15. Two-Tier Metadata System

| Tier | Scope | Content |
|------|-------|---------|
| **Tier 1** | Global | `vault/global.metadata.json` - all registered apps |
| **Tier 2** | App-level | App-specific metadata - source for domain structure |

---

## 16. Key Behaviors

- **Selective Access:** Avoid expensive filesystem scans
- **Cross-App Governance:** Enforce rules across apps
- **Structural Fingerprint:** Fast integrity verification
- **Cache ↔ Vault Alignment:** Cross-verify registries

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 2 - Secure Persistence*