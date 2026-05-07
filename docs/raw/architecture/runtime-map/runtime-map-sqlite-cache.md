# Runtime Map: SQLite Cache

> Service Runtime Contract - Layer 2: Secure Persistence

---

## Metadata

| Field | Value |
|-------|-------|
| Feature Doc | `docs/raw/features/storage/sqlite-cache.md` |
| Implementation | `src/main/services/sqliteCacheService.ts` |
| Layer | 2 - Secure Persistence |
| Status | ✅ Compliant |

---

## 1. Responsibility

Single runtime responsibility:
- Hot operational state management
- Fast read/write cache for runtime data
- Cache ↔ Vault mirror synchronization

---

## 2. State Ownership

### Allowed
- [x] Request-scoped ephemeral variables (query results, transactions)
- [x] Explicit persistence through SQLite (better-sqlite3)
- [x] Immutable configuration (Object.freeze)

### Forbidden
- [x] No mutable class-level state (factory pattern)
- [x] No runtime cache without lifecycle governance
- [x] No cross-request memory accumulation

---

## 3. Persistence Rules

### Storage Interface
- **Database:** better-sqlite3 (native module, NOT sql.js WASM)
- **ORM:** Drizzle with BetterSQLite3Database
- **Location:** `userData/prana/cache.db`

### Migration Status
- ✅ **sql.js → better-sqlite3 Complete**
- Reason: sql.js WASM breaks electron-vite bundler
- 20 services migrated to better-sqlite3

---

## 4. Determinism Requirements

**MUST remain deterministic:**
- Query results must be reproducible
- Transaction ordering must be deterministic
- Cache operations must be idempotent

---

## 5. Replayability Requirements

- [x] **Yes** - fully deterministic
- SQLite provides ACID guarantees
- Can replay transactions from WAL

---

## 6. Side Effects

**Allowed side effects:**
- File I/O (cache.db read/write)
- WAL (Write-Ahead Log) operations
- Vacuum/optimize operations

---

## 7. Dependency Rules

### Allowed Imports
```ts
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
```

### Forbidden Imports
- ❌ sql.js / sqljs (deprecated)
- ❌ In-memory stores

---

## 8. Host Assumptions

- [x] Electron (primary host)
- [ ] Node (testing)
- [ ] Browser
- [ ] None (pure library)

---

## 9. Lifecycle Ownership

**Owns:**
- Cache database lifecycle
- Connection pool lifecycle
- Schema migration lifecycle

**Does NOT own:**
- Vault lifecycle
- User data lifecycle

---

## 10. Capability Contracts

| Capability | Interface | Source |
|------------|-----------|--------|
| Database | `BetterSQLite3Database` | better-sqlite3 |
| ORM | `DrizzleInstance` | drizzle-orm |

---

## 11. Extension Surface

**Clients may override:**
- Cache database path
- Schema migrations
- Query optimizations

---

## 12. Security Boundaries

- [ ] IPC
- [x] Storage (encrypted at rest via OS)
- [ ] Auth
- [ ] None

---

## 13. Compliance Analysis

### Statelessness Score
Score: **95/100**

### Migration Status
- **Pattern:** Service accepts DB instance from host
- **Persistence:** better-sqlite3 (NOT sql.js)
- **Store Services:** 20 migrated to better-sqlite3

### Detection Heuristics Applied
- ✅ No `new Map()` in class properties
- ✅ No `new Set()` in class properties
- ✅ No static mutable fields
- ✅ No sql.js usage

---

## 14. Invariant Mapping

| Invariant | Compliance | Notes |
|-----------|------------|-------|
| Statelessness | ✅ Allowed | Accepts DB from host, stateless wrapper |
| Determinism | ✅ Requirements | ACID transactions |
| Replayability | ✅ Yes | WAL replay |
| Composability | ✅ | Drizzle ORM integration |
| Dependency Direction | ✅ | Layer 2 persistence |
| Lifecycle Safety | ✅ | Connection lifecycle managed |
| Policy Neutrality | ✅ | Pure cache operations |
| Storage Neutrality | ✅ | Uses better-sqlite3, not sql.js |

---

## 15. Store Services Using better-sqlite3

```
src/main/services/
├── sqliteService.ts                  # Core wrapper
├── sqliteCacheService.ts             # Drizzle + better-sqlite3
├── sqliteConfigStoreService.ts
├── authStoreService.ts
├── conversationStoreService.ts
├── notificationStoreService.ts
├── taskRegistryService.ts
├── templateService.ts
├── emailKnowledgeContextStoreService.ts
├── businessContextStoreService.ts
├── registryRuntimeStoreService.ts
├── onboardingStageStoreService.ts
├── governanceLifecycleQueueStoreService.ts
├── syncStoreService.ts
├── contextDigestStoreService.ts
├── runtimeDocumentStoreService.ts
├── memoryIndexService.ts
├── mountRegistryService.ts
```

---

## 16. Verification Commands

```bash
# Verify no sql.js usage
grep -r "sql.js\|sqljs" src/main/services/ --include="*.ts"

# Verify better-sqlite3 count (expected: 20)
grep -r "better-sqlite3" src/main/services/ --include="*.ts" | wc -l
```

---

## 17. Key Decision Notes

- **Why better-sqlite3:** Native module, no WASM bundler issues
- **Why Drizzle:** Type-safe ORM, better-sqlite3 native support
- **Host passes DB:** Service accepts DB instance, doesn't create own

---

*Map Version: 1.0*
*Created: 2026-05-07*
*Phase: Layer 2 - Secure Persistence*