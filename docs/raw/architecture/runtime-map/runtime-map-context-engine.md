# Runtime Map: Context Engine

> Service Runtime Contract - Layer 4: Intelligence & Integration

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/context/context-engine.md` |
| Implementation | `src/main/services/contextEngineService.ts` |
| Layer | 4 - Intelligence & Integration |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- **Token Budget Enforcement:** Track token consumption against model context windows
- **Deterministic Compaction:** Trigger summarization at predictable thresholds
- **Segmented Context Preservation:** Maintain head, digest, tail structure
- **Recursive Summarization:** Multi-level compression for long sessions
- **Cross-Session Continuity:** Session rollover using persisted digests
- **Audit Persistence:** Store compaction artifacts in SQLite
- **RAG Integration:** Make digests retrievable via vector search
- **Prompt Assembly:** Produce optimized "Prompt Packs"

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (context messages, token counts)
- [x] Explicit persistence through contracts (contextDigestStoreService - better-sqlite3)
- [x] Immutable configuration

### Forbidden
- [x] No mutable class-level state
- [x] No runtime cache without lifecycle governance

---

## 3. Persistence Rules

### Storage Interface
- **Context Digests:** `contextDigestStoreService` - better-sqlite3
- **Sync State:** `syncStoreService` - better-sqlite3

### Current Implementation
- **Pattern:** Service accepts state via parameters
- **Persistence:** External SQLite stores

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Token budget enforcement must be reproducible
- Compaction thresholds must be deterministic
- Prompt assembly must produce same output for same input

---

## 5. Replayability Requirements

- [x] **Partial** - with external state
- Session state can be replayed from digest store

---

## 6. Side Effects

**Allowed side effects:**
- Context digest persistence
- Token count operations
- RAG index updates

---

## 7. Dependency Rules

### Allowed Imports
```ts
import { contextOptimizerService } from './contextOptimizerService';
import { contextDigestStoreService } from './contextDigestStoreService';
import { summarizationAgentService } from './summarizationAgentService';
import { tokenManagerService } from './tokenManagerService';
import { syncStoreService } from './syncStoreService';
```

### Forbidden Imports
- ❌ Mutable in-memory caches
- ❌ LLM inference services (not its responsibility)

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Context session lifecycle
- Token budget lifecycle
- Compaction lifecycle

**Does NOT own:**
- LLM inference lifecycle
- Business data lifecycle

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Context Store | `IContextDigestStoreService` | `contextDigestStoreService` |
| Token Manager | `ITokenManagerService` | `tokenManagerService` |
| Optimizer | `IContextOptimizerService` | `contextOptimizerService` |

---

## 11. Extension Surface

**Clients may override:**
- Token budget configurations
- Compaction thresholds
- Summary strategies

---

## 12. Security Boundaries

- [x] IPC (context operations)
- [x] Storage (digest persistence)
- [ ] Auth
- [ ] None

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Detection Heuristics Applied
- ✅ No mutable class properties
- ✅ No static mutable fields
- ✅ No in-memory session retention

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Accepts state from external stores |
| Determinism | ✅ Requirements | Token budget, compaction deterministic |
| Replayability | ✅ Partial | With digest store |
| Composability | ✅ | Uses optimizer, store services |
| Lifecycle Safety | ✅ | Context lifecycle only |
| Storage Neutrality | ✅ | Uses external SQLite |

---

## 15. Context Architecture (From Feature)

- **Head:** Recent messages (full fidelity)
- **Digest:** Compressed summary (from past sessions)
- **Tail:** Future context placeholder

---

## 16. Key Behaviors

- **Token Budget:** Per-model context window enforcement
- **Recursive Summarization:** Multi-level compression
- **Cross-Session:** Rollover via persisted digests
- **RAG:** Vector-searchable digests

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 4 - Intelligence & Integration*