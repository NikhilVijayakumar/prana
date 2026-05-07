# Runtime Map: Vector Search & RAG

> Service Runtime Contract - Storage Layer (Semantic Retrieval)

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/storage/vector-search-rag.md` |
| Implementation | `src/main/services/vectorSearchService.ts`, `ragOrchestratorService.ts` |
| Layer | Storage (Semantic Layer) |
| Status | ⚠️ Transitional (has mutable state violation) |

---

## 1. Responsibility

Single runtime responsibility:
- **Semantic Retrieval:** Local-first vector search
- **Embedding Generation:** Using Xenova/BGE-micro-v2
- **Context Assembly:** KNN-based context retrieval
- **Loop Protection:** Prevent LLM loops
- **RAG Pipeline:** Query → Intent → Embed → Search → Context → LLM

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (query processing)
- [x] Model loading (transformer pipeline)

### Forbidden (VIOLATION)
- [x] **NO** `semanticCache = new Map()` - mutable class property ❌

---

## 3. Transitional Violation

### Current Issue
```typescript
// vectorSearchService.ts line 17
private semanticCache = new Map<string, { vector: number[], metadata: Record<string, any>, namespace?: string }>();
```

### Severity: P1 (High)
- Mutable runtime cache without lifecycle governance
- Must be externalized or removed

### Recommendation
- Externalize cache to SQLite (memoryIndexService)
- Or document as transitional with `@deprecated-runtime-state`

---

## 4. Persistence Rules

### Current Implementation
- **Memory Index:** Uses `memoryIndexService` (better-sqlite3)
- **Model:** Xenova/BGE-micro-v2 in-memory

---

## 5. Determinism Requirements

**MUST remain deterministic:**
- Embedding generation deterministic (same input → same vector)
- KNN search deterministic
- Context assembly deterministic

---

## 6. Replayability Requirements

- [x] **Partial** - with memory index store

---

## 7. Side Effects

**Allowed side effects:**
- Embedding computation
- KNN search in memory index
- Context assembly

---

## 8. Dependency Rules

### Allowed Imports
```ts
import { pipeline } from '@xenova/transformers';
import { vectorSearchService } from './vectorSearchService';
import { memoryIndexService } from './memoryIndexService';
```

### Forbidden Imports
- ❌ External vector databases (by design: local-first)

---

## 9. Host Assumptions

- [x] Electron (primary host - main process)
- [ ] Node
- [ ] Browser
- [ ] None

---

## 10. Lifecycle Ownership

**Owns:**
- Embedding lifecycle
- Search lifecycle
- Loop protection lifecycle

**Does NOT own:**
- External LLM lifecycle
- Business data lifecycle

---

## 11. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Vector Search | `IVectorSearchService` | `vectorSearchService` |
| Memory Index | `IMemoryIndexService` | `memoryIndexService` |
| RAG Orchestrator | `IRagOrchestratorService` | `ragOrchestratorService` |

---

## 12. Security Boundaries

- [ ] IPC (vector operations)
- [ ] Storage (memory index)
- [ ] Auth
- [x] **Local-First** - No external data exposure

---

## 13. Compliance Analysis

### Statelessness Score
Score: **90/100** (5 points deducted for mutable cache)

### Migration Status
- **Pattern:** Service with singleton export
- **Violations:** 1 (semanticCache Map)

### Detection Heuristics Applied
- ❌ **Found** - `new Map()` in class property (line 17)
- ✅ No static mutable fields
- ✅ No cross-request memory accumulation (except cache)

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ⚠️ Partial | Has mutable cache (P1 violation) |
| Determinism | ✅ Requirements | Embedding + search deterministic |
| Replayability | ✅ Partial | With memory index |
| Composability | ✅ | Uses memory index service |
| Storage Neutrality | ✅ | Local-first, no external DB |

---

## 15. RAG Pipeline (From Feature)

```
USER QUERY
   ↓
INTENT EXTRACTION
   ↓
EMBEDDING GENERATION (BGE-micro-v2)
   ↓
VECTOR SEARCH (KNN)
   ↓
CONTEXT ASSEMBLY
   ↓
LLM AUGMENTED RESPONSE
```

---

## 16. Key Behaviors

- **Local-First:** No external data exposure, data stays encrypted locally
- **Deterministic:** Same query → same context
- **Loop Protection:** Prevents LLM infinite loops

---

## 17. Fix Required

**For full compliance, the semanticCache must be:**
1. **Option A:** Externalized to SQLite via memoryIndexService
2. **Option B:** Documented with `@deprecated-runtime-state` and removal timeline

---

## 18. Verification Commands

```bash
# Verify no mutable cache
grep -r "semanticCache.*new Map" src/main/services/vectorSearchService.ts
```

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Note: Contains P1 violation - transitional state*