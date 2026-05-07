# Runtime Map: Google Ecosystem Integration

> Service Runtime Contract - Layer 4: Intelligence & Integration

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/Integration/google-ecosystem-integration.md` |
| Implementation | `src/main/services/googleBridgeService.ts`, `googleSheetsCacheService.ts` |
| Layer | 4 - Intelligence & Integration |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Remote Discovery Engine:** Drive traversal
- **Content Projection:** Docs/Sheets → structured local form
- **Controlled Staging:** Agent → Google Docs handoff
- **Metadata Synchronization:** State tracking + change detection
- **Zero-Dependency REST Bridge:** Port 3111 OAuth to Google Workspace

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (API calls, sync operations)
- [x] Explicit persistence through contracts (SQLite metadata, Vault storage)
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state
- [x] No direct dependency for runtime-critical operations

---

## 3. Persistence Rules

### Storage Interface
- **Metadata:** SQLite (`google_workspace_meta`)
- **Durable Storage:** Vault (`vault/google/`)
- **Sheets Cache:** `googleSheetsCacheService`

### Current Implementation
- **Pattern:** Service accepts state via parameters
- **Storage:** SQLite + Vault

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Sync boundary deterministic (Scheduler or explicit user action)
- Metadata authority in SQLite
- Change detection deterministic

---

## 5. Replayability Requirements

- [x] **Partial** - with external state (SQLite metadata)

---

## 6. Side Effects

**Allowed side effects:**
- Google Drive API calls
- Document ingestion
- Metadata updates

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { googleBridgeService } from './googleBridgeService';
import { googleSheetsCacheService } from './googleSheetsCacheService';
```

### Forbidden Imports
- ❌ Direct runtime dependency on Google Workspace
- ❌ Mutable in-memory state

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Discovery lifecycle
- Sync lifecycle
- Metadata lifecycle

**Does NOT own:**
- Google Workspace lifecycle (external)
- User authentication lifecycle (handled by OAuth)

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Bridge | `IGoogleBridgeService` | `googleBridgeService` |
| Sheets Cache | `IGoogleSheetsCacheService` | `googleSheetsCacheService` |

---

## 11. Extension Surface

**Clients may override:**
- Custom sync strategies
- Document type handlers

---

## 12. Security Boundaries

- [x] IPC (Google operations)
- [x] Storage (metadata + vault)
- [x] Auth (OAuth)

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Detection Heuristics Applied
- ✅ No mutable class properties
- ✅ No direct runtime dependency

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Accepts state from stores |
| Determinism | ✅ Requirements | Sync boundary deterministic |
| Replayability | ✅ Partial | With SQLite metadata |
| Composability | ✅ | External adapter pattern |
| Lifecycle Safety | ✅ | Sync lifecycle only |
| Policy Neutrality | ✅ | Pure integration |
| Storage Neutrality | ✅ | SQLite + Vault |

---

## 15. System Invariants (From Feature)

1. **Mirror Constraint** - Google docs MUST exist in SQLite + Vault
2. **Read-First Safety** - Default to read-only
3. **External Isolation** - Google Workspace as untrusted external
4. **Deterministic Sync** - Scheduler-triggered or explicit user action
5. **Metadata Authority** - SQLite is state tracker

---

## 16. Key Behaviors

- **Local-First Mirror:** Google docs → SQLite + Vault
- **Read-Only Default:** Safe by default
- **OAuth Bridge:** Port 3111 for authentication

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 4 - Intelligence & Integration*