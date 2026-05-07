# Prana Bug: SQLite Store Services EPERM on Windows Drive Root

**Status:** Fixed
**Owner repo:** Prana
**Reported by:** Chakra integration
**Affects:** All SQLite-backed store services on Windows when the virtual drive is mounted

---

## Problem

Four store services call `mkdir(getSqliteRoot(), { recursive: true })` using the bare Node.js `mkdir`. Every other service in Prana already uses the `mkdirSafe` helper (from `governanceRepoService.ts`) which guards against the WinFsp EPERM on drive roots. These four were missed.

After the virtual drive mounts, `setAppDataRootOverride('S:')` is called, so `getAppDataRoot()` returns `'S:'`. `getSqliteRoot()` falls back to `getAppDataRoot()` when no override is configured, returning `'S:'`. The bare `mkdir('S:', { recursive: true })` then raises:

```
Error: EPERM: operation not permitted, mkdir 'S:\'
```

This error propagates out of the `auth:get-status` IPC handler (via `authStoreService → initializeDatabase → mkdir`) and causes every auth check to fail — blocking login on Windows with a mounted virtual drive.

---

## Affected Files

All four services share the same pattern — two bare `mkdir(getSqliteRoot(), ...)` calls per service, one in `initializeDatabase` and one in `persistDatabase`:

| Service | File | Lines |
|---|---|---|
| Auth store | `src/main/services/authStoreService.ts` | 55, 61 |
| Business context store | `src/main/services/businessContextStoreService.ts` | 51, 57 |
| Context digest store | `src/main/services/contextDigestStoreService.ts` | 89, 95 |
| Runtime document store | `src/main/services/runtimeDocumentStoreService.ts` | 68, 74 |

---

## Root Cause

`mkdirSafe` was introduced in `governanceRepoService.ts` and applied to `ensureGovernanceRepoReady`, but the store services that call `mkdir(getSqliteRoot(), ...)` were not updated in the same pass.

---

## Fix

### Part 1 — Replace bare `mkdir` with `mkdirSafe` in all four services

Apply the same change to each of the four affected files:

```diff
- import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
+ import { readFile, rm, writeFile } from 'node:fs/promises';
  import { join } from 'node:path';
  import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
- import { getSqliteRoot } from './governanceRepoService';
+ import { getSqliteRoot, mkdirSafe } from './governanceRepoService';
```

In `initializeDatabase`:
```diff
- await mkdir(getSqliteRoot(), { recursive: true });
+ await mkdirSafe(getSqliteRoot());
```

In `persistDatabase`:
```diff
- await mkdir(getSqliteRoot(), { recursive: true });
+ await mkdirSafe(getSqliteRoot());
```

`mkdirSafe` already handles `{ recursive: true }` internally and swallows EPERM specifically when the path is a Windows drive-letter root (e.g. `S:\`). All other errors are rethrown unchanged.

### Part 2 — Fix `getSqliteRoot()` default in `governanceRepoService.ts`

The current fallback returns the bare app data root, which after drive mount is `S:` — the drive root itself. SQLite files should never land at the drive root.

```diff
  export const getSqliteRoot = (): string => {
    if (sqliteRootOverride) return sqliteRootOverride;
    const configRoot = getPranaRuntimeConfig()?.sqliteRoot;
    if (configRoot) return configRoot;
-   return getAppDataRoot();
+   return join(getAppDataRoot(), 'cache', 'sqlite');
  };
```

This default matches the `cache/sqlite/` directory in Chakra's `drive-layout.json` schema. Client apps that configure `sqliteRoot` explicitly (via `PranaRuntimeConfig.sqliteRoot`) are unaffected.

**Note:** `sqliteRoot` is already present in `PranaRuntimeConfig` (added in a prior pass). The `join` import is already at the top of `governanceRepoService.ts`.

---

## Why This Wasn't Caught Earlier

The `mkdirSafe` helper was added to fix the `governanceRepoService` mkdir in the EPERM PR. The store services use a separate `getSqliteRoot()` call rather than `getSystemDataRoot()` directly, so they were not listed in the original affected-files inventory. They surface only once the drive is mounted and `getAppDataRoot()` starts returning the drive letter root.

---

## Chakra Workaround (active, pending this fix)

Chakra currently sets the SQLite root override explicitly inside the `chakra:ensure-drive-layout` IPC handler, immediately after the drive layout is ensured:

```typescript
const { setSqliteRootOverride } = await import('prana/main/services/governanceRepoService')
setSqliteRootOverride(join(driveRoot, 'cache', 'sqlite'))
```

This routes `getSqliteRoot()` to `S:\cache\sqlite` before any auth IPC reaches the store services, preventing the EPERM in the current build. Once Prana applies Part 1 and Part 2 above, this override call in Chakra can be removed.

---

## Acceptance Criteria

- `auth:get-status` no longer throws EPERM on Windows after the virtual drive mounts.
- All four store services (`authStoreService`, `businessContextStoreService`, `contextDigestStoreService`, `runtimeDocumentStoreService`) use `mkdirSafe` for their SQLite root directory creation.
- `getSqliteRoot()` defaults to `join(getAppDataRoot(), 'cache', 'sqlite')` when no runtime config or override is set.
- Behavior in non-Windows environments and non-drive-root paths is unchanged.

---

## Related Documents

- `windows-drive-root-mkdir-eperm.md` — original EPERM root cause and `isWindowsDriveRoot` helper
- `client-configurable-sqlite-root-path.md` — `sqliteRoot` field in `PranaRuntimeConfig` (already implemented)
