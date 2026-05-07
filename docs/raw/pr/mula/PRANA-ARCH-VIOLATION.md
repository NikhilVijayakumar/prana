# PRANA-ARCH-VIOLATION: Stateful Services Instead of Stateless Library

## Status
Confirmed — documented for prana maintainers

## Severity
High — violates core architectural contract

## Expected Contract

Prana was designed as a **stateless general-purpose library** that:
1. Accepts schemas from host apps (Mūla, Chakra, etc.)
2. Accepts explicit state/parameters from host apps (DB paths, storage backends, config)
3. Creates tables and provides utilities based on provided schemas
4. Has **no built-in storage** — the host app provides state based on use case

## Current Reality

### 1. Hardcoded State via sql.js (15+ services)

Every prana service creates its own SQLite database using `sql.js` WASM:

| Service | File |
|---------|------|
| templateService | `src/main/services/templateService.ts` |
| sqliteConfigStoreService | `src/main/services/sqliteConfigStoreService.ts` |
| runtimeDocumentStoreService | `src/main/services/runtimeDocumentStoreService.ts` |
| contextDigestStoreService | `src/main/services/contextDigestStoreService.ts` |
| conversationStoreService | `src/main/services/conversationStoreService.ts` |
| notificationStoreService | `src/main/services/notificationStoreService.ts` |
| syncStoreService | `src/main/services/syncStoreService.ts` |
| taskRegistryService | `src/main/services/taskRegistryService.ts` |
| governanceLifecycleQueueStoreService | `src/main/services/governanceLifecycleQueueStoreService.ts` |
| authStoreService | `src/main/services/authStoreService.ts` |
| onboardingStageStoreService | `src/main/services/onboardingStageStoreService.ts` |
| registryRuntimeStoreService | `src/main/services/registryRuntimeStoreService.ts` |
| businessContextStoreService | `src/main/services/businessContextStoreService.ts` |
| emailKnowledgeContextStoreService | `src/main/services/emailKnowledgeContextStoreService.ts` |
| googleSheetsCacheService | `src/main/services/googleSheetsCacheService.ts` |

Pattern in every file:
```ts
import initSqlJs from 'sql.js'

const getSqlRuntime = async (): Promise<SqlJsStatic> => {
  if (!sqlRuntimePromise) {
    sqlRuntimePromise = initSqlJs({ locateFile: resolveSqlJsAsset })
  }
  return sqlRuntimePromise
}

const initializeDatabase = (): void => {
  const sqlRuntime = await getSqlRuntime()  // ← creates in-memory SQLite
  // ... hardcoded CREATE TABLE statements
}
```

### 2. Top-Level Side Effects on Import

`prana/main/index.ts` runs `registerIpcHandlers()` at module load time:
```ts
app.whenReady().then(async () => {
  registerIpcHandlers()  // ← calls templateService.ensureDefaultTemplates() at top level
  createWindow()
})
```

This means `await import('prana/main/index')` in Mūla triggers:
- Full prana app initialization (vault, sync, governance, WhatsApp/Baileys, AI)
- IPC handler registration for all 15+ stores
- `ensureDefaultTemplates()` → sql.js WASM load → **crash**

### 3. sql.js WASM Bundler Incompatibility

`sql.js` requires WebAssembly loading that electron-vite's bundler breaks:
```
TypeError: Cannot set properties of undefined (setting 'exports')
    at Object.initSqlJs
```

This is a known incompatibility between `sql.js` and bundlers (vite, webpack, rollup) that transform CommonJS/ESM module interop.

### 4. No Schema Parameterization

All store services hardcode their own table schemas. Mūla/Chakra cannot:
- Inject custom column definitions
- Choose a different storage backend (e.g., `better-sqlite3` instead of `sql.js`)
- Share a single database connection across prana services

## Impact on Mūla

Mūla only needs 2 stateless prana utilities:
- `pranaPlatformRuntime` — environment/metadata registry (works fine)
- `pranaRuntimeConfig` — config validation with Zod (works fine)

The remaining 15+ stateful services are **not used** by Mūla and cause the app to crash on startup due to the sql.js bundler issue.

## Mūla Workaround

Both prana initialization blocks wrapped in try-catch with informative logging.
Mūla uses its own `better-sqlite3` + Drizzle ORM stack (`src/main/db/`) for all state.

## Required Prana Fixes

1. **Remove all hardcoded state** — convert services to accept schema + DB connection from host
2. **Remove top-level side effects** — no `registerIpcHandlers()` at module load; export functions for host to call
3. **Replace sql.js with better-sqlite3** — or make storage backend pluggable
4. **Export only utilities, not a full app** — `prana/main/index` should not create windows, not call `app.whenReady()`
5. **Add proper API contract** — define interfaces for schema injection, state injection, and utility composition

## References
- `prana/main/index.ts` — top-level side effects
- `prana/main/services/ipcService.ts:62` — `ensureDefaultTemplates()` at IPC registration time
- `prana/package.json` — includes `sql.js`, `@whiskeysockets/baileys`, `@xenova/transformers` (heavy deps for a "stateless library")
