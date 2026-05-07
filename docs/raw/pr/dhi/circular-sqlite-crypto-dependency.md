# Bug Report: Circular Dependency in SQLite Crypto ↔ Config Store

## Issue Description
On **first boot** (no existing `runtime-config.sqlite`), prana's `sqliteCryptoUtil.getDbKey()` creates an irrecoverable circular dependency that crashes the application:

```
[PRANA_CONFIG_ERROR] Runtime config is not set. Host app must provide bootstrap config before calling app:bootstrap-host.
    at assertValidBootstrapConfig
    at getRuntimeBootstrapConfig
    at getDbKey
    at encryptSqliteBuffer
    at persistDatabase
    at initializeDatabase
    at readSnapshot
    at seedFromRuntimePropsIfEmpty
```

## Root Cause
The crash involves three modules forming a circular dependency:

```
sqliteCryptoUtil.ts::getDbKey()
  → runtimeConfigService.ts::getRuntimeBootstrapConfig()
    → sqliteConfigStoreService.readSnapshotSync()?.config  ← reads from SQLite
      → but SQLite can't be initialized without getDbKey() to encrypt the DB file
```

### Detailed Sequence

1. Splash UI calls `app:bootstrap-host` IPC with the host config
2. `ipcService.ts` handler calls `setPranaRuntimeConfig(payload.config)` ✅
3. Handler then calls `sqliteConfigStoreService.seedFromRuntimePropsIfEmpty(payload.config)`
4. → `readSnapshot()` → `getDatabase()` → `initializeDatabase()`
5. → `initializeDatabase()` creates an empty in-memory DB, runs CREATE TABLE, then calls `persistDatabase(database)`
6. → `persistDatabase()` → `encryptSqliteBuffer(bytes)` → `getDbKey()`
7. → `getDbKey()` → `getRuntimeBootstrapConfig()` which reads from **SQLite** (via `readSnapshotSync`)
8. → But SQLite is empty (we're trying to seed it right now!) → `assertValidBootstrapConfig(null)` → **CRASH**

## Applied Fix in Prana

The bug has been fixed in `prana`. `sqliteCryptoUtil.getDbKey()` now derives the vault encryption key from the **in-memory** `pranaRuntimeConfig` (set via `setPranaRuntimeConfig` during the initial bootstrap IPC call) rather than trying to read from the uninitialized SQLite database via `getRuntimeBootstrapConfig()`. 

This correctly breaks the circular dependency because the configuration is now available in-memory before the SQLite store needs to be created or encrypted.

```typescript
import { getPranaRuntimeConfig } from './pranaRuntimeConfig';

const getDbKey = (): Buffer => {
  const config = getPranaRuntimeConfig();
  if (!config?.vault) {
    throw new Error('[PRANA_CONFIG_ERROR] Vault config not available for DB key derivation');
  }
  const vaultConfig = config.vault;
  // ... (Key derived securely from vaultConfig)
};
```

## Resolution & Action Required

Because this issue is now resolved within the Prana library itself:
- **Downstream applications (like Dhi) no longer need workarounds.** 
- Any pre-seeding logic previously implemented in downstream packages (e.g., `src/main/services/pranaConfigPreSeed.ts` in Dhi) that manually replicates SQLite + AES-256-GCM logic to pre-create the encrypted database file **can and should be safely removed**.
- Host applications should continue to rely on the standard `app:bootstrap-host` IPC call to supply the initial runtime configuration. The internal `prana` bootstrap sequence will now proceed cleanly and initialize the local SQLite configuration store on the first launch without crashing.
