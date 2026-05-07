# Persistence Layer Runtime Map

## Feature → Code Mapping

### SQLite Cache (Layer 2)
- **Doc:** `docs/raw/features/storage/sqlite-cache.md`
- **Implementation:** `src/main/services/sqliteCacheService.ts`
- **Invariant:** [Storage Neutrality](architecture/invariants/storage-neutrality.md)
- **Compliance:** ✅ better-sqlite3 (native module, not sql.js WASM)

### Store Services (Migrated to better-sqlite3)
```
src/main/services/
├── sqliteService.ts                  # ✅ Wrapper using better-sqlite3
├── sqliteCacheService.ts             # ✅ better-sqlite3 + drizzle
├── sqliteConfigStoreService.ts       # ✅ better-sqlite3
├── authStoreService.ts               # ✅ better-sqlite3
├── conversationStoreService.ts       # ✅ better-sqlite3
├── notificationStoreService.ts       # ✅ better-sqlite3
├── taskRegistryService.ts            # ✅ better-sqlite3
├── templateService.ts                # ✅ better-sqlite3
├── emailKnowledgeContextStoreService.ts  # ✅ better-sqlite3
├── businessContextStoreService.ts    # ✅ better-sqlite3
├── registryRuntimeStoreService.ts    # ✅ better-sqlite3
├── onboardingStageStoreService.ts    # ✅ better-sqlite3
├── governanceLifecycleQueueStoreService.ts  # ✅ better-sqlite3
├── syncStoreService.ts               # ✅ better-sqlite3
├── contextDigestStoreService.ts      # ✅ better-sqlite3
├── runtimeDocumentStoreService.ts    # ✅ better-sqlite3
├── memoryIndexService.ts             # ✅ better-sqlite3
├── mountRegistryService.ts           # ✅ better-sqlite3
└── taskRegistryService.ts            # ✅ better-sqlite3
```

### Statelessness Compliance

**✅ Allowed Patterns (Used):**
- Request-scoped ephemeral variables
- Explicit persistence through contracts (better-sqlite3)
- Immutable configuration

**✅ Migrated From:**
- sql.js WASM (breaks electron-vite bundler)
- In-memory caches (removed or externalized)

**✅ Services Using Factory Pattern:**
- `agentRegistryService.ts` - factory returns instance
- `channelRegistryService.ts` - factory returns instance
- `coreRegistryService.ts` - factory returns instance
- `skillRegistry.ts` - factory returns instance
- `queueOrchestratorService.ts` - factory returns instance
- `syncProviderService.ts` - factory returns instance
- `hookSystemService.ts` - factory returns instance
- `workOrderService.ts` - factory returns instance
- `syncEngineService.ts` - factory returns instance
- `systemHealthService.ts` - factory returns instance
- `emailService.ts` - factory returns instance
- `pranaPlatformRuntime.ts` - factory returns instance
- `channelRouterService.ts` - factory returns instance
- `notificationCentreService.ts` - factory returns instance
- `tokenManagerService.ts` - factory returns instance
- `startupOrchestratorService.ts` - factory returns instance
- `cronSchedulerService.ts` - removed setInterval/jobs Map

---

## Verification Commands

```bash
# Verify no sql.js usage
grep -r "sql.js\|sqljs" src/main/services/ --include="*.ts"

# Verify better-sqlite3 usage
grep -r "better-sqlite3" src/main/services/ --include="*.ts" | wc -l
# Expected: 20

# Verify no mutable state in services
grep -r "private.*=" src/main/services/*.ts | grep -v "readonly"
```

---

*Map Version: 1.0*
*Updated: 2026-05-07*