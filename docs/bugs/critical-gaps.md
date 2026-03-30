# Prana-Dharma Critical Gaps & Leaks

**Role**: Principal Systems Architect & Lead Security Auditor
**Date**: March 30, 2026

The following "leaks" were identified during the holistic architectural check. These gaps break the principle of least privilege, memory cleanliness, or bypass data reconciliation layers.

## Leak 1: The Config Property Bypass (CRITICAL)
**Location:** `src/main/services/pranaRuntimeConfig.ts` & `src/main/services/runtimeConfigService.ts`
**Description:** The application utilizes a floating Javascript closure (`let runtimeConfig: PranaRuntimeConfig | null`) to retain configurations passed during boot up. Other core services (`driveControllerService`, `syncEngineService`) query this Javascript buffer natively instead of querying the SQLite `runtime_config_meta` table. 
**Impact:** A vulnerability against memory injection and a strict violation of the architecture's requirement that SQLite serves as the exclusive and untempered source of truth post app-startup. Furthermore, this produces race conditions if `setPranaRuntimeConfig` is invoked by the renderer via IPC while the sync engine expects an updated SQLite hash.

## Leak 2: Sql.js Garbage Collection Stale Descriptors (MODERATE)
**Location:** `src/main/services/sqliteConfigStoreService.ts`
**Description:** While Rclone cleans the `vault-temp` staging paths appropriately, the internal `Sql.js` databases instantiated inside `sqliteConfigStoreService` and `syncStoreService` do not currently perform an explicit `database.close()` when the Virtual Drive `app.on('before-quit')` is invoked.
**Impact:** `sql.js` keeps buffers allocated heavily in Node.js heap memory, resulting in memory fragmentation and minor resource leaks if the process persists or hot-reloads over long durations.

## Leak 3: Missing Drive Failure Fallback Hook (MINOR)
**Location:** `src/main/services/driveControllerService.ts`
**Description:** If `WinFsp` crashes mid-execution (after initial `spawnMount` settles successfully), `child.on('close')` writes the internal registry array as `FAILED` but does NOT broadcast an IPC event to the renderer. 
**Impact:** The user's UI may continue displaying "Drive Ready," whilst subsequent SQLite sync operations queue infinitely to a disabled network location.
