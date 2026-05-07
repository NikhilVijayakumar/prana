# Runtime Map: Data Integrity Protocol

> Service Runtime Contract - Storage Security & Sync

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/storage/data-integrity-protocol.md` |
| Implementation | `vaultService.ts`, `syncEngineService.ts`, `dataFilterService.ts` |
| Layer | Storage Governance |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Zero-Trust, Integrity-First Runtime**
- **Encryption:** Cryptographic protection of persisted data
- **Validation:** No invalid or unscoped data enters system
- **Sync:** Deterministic reconciliation between Hot-Cache (SQLite) and Cold-Vault
- **Multi-App Isolation:** Storage isolation, deterministic, contract-bound

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (validation, sync)
- [x] Explicit persistence through contracts (vaultService, syncStoreService)
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state
- [x] No Vault state without Cache projection

---

## 3. Persistence Rules

- **Hot-Cache:** SQLite (better-sqlite3)
- **Cold-Vault:** Encrypted archives (AES-256-GCM)

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Sync reconciliation deterministic
- Conflict resolution deterministic
- Data validation deterministic

---

## 5. Replayability Requirements

- [x] **Yes** - fully deterministic
- Vault + Cache can be replayed

---

## 6. System Invariants (From Feature)

1. **Vault Is Git-Tree Structured** - Hierarchical archive
2. **Cache ↔ Vault Mirror** - Every Vault doc has SQLite projection
3. **Encryption First** - Data encrypted at rest
4. **Validation Gate** - No invalid data enters

---

## 7. Storage Governance Rules

- Vault structured as git-tree
- Domains decomposed into subtrees
- Multi-app storage isolated

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser

---

## 9. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Accepts state from stores |
| Determinism | ✅ Requirements | Sync + validation deterministic |
| Replayability | ✅ Yes | Vault + Cache replayable |
| Storage Neutrality | ✅ | SQLite + Vault |

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Storage Governance*