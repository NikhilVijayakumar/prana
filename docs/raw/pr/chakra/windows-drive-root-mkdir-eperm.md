# Prana Bug Report: Windows EPERM on mkdir at WinFsp drive root

## Summary
On Windows, after the system virtual drive mounts successfully at a drive letter (e.g. `S:`), downstream services crash with `EPERM: operation not permitted, mkdir 'S:\'` because `updateSystemDataRoot()` sets the app data root to the raw drive letter. When services call `mkdir(getAppDataRoot(), { recursive: true })`, it attempts to create the drive root itself — which WinFsp does not permit.

The intended directory layout uses the drive root directly (`S:\`), with subdirectories (`apps\`, `cache\`, `data\`) sitting at the root level. Introducing a `/live` subdirectory is **not** the desired fix. The drive root IS the data root; the EPERM must be silently swallowed when it refers to a Windows drive root, not worked around by relocating the root.

## Environment
- Host app: Chakra
- OS: Windows 11
- Runtime: Electron dev (`npm run dev`)
- Virtual drive provider: rclone + WinFsp
- rclone: v1.73.5 (cmount build)
- WinFsp: v2.1.25156

## Root Cause
WinFsp does not permit `mkdir` on the drive root itself (`S:\`). On a successfully mounted WinFsp drive, the root already exists as the mount — calling `mkdir('S:\', { recursive: true })` raises `EPERM`. Any Prana service that calls `mkdir(getSystemDataRoot(), { recursive: true })` blindly will crash on Windows when `getSystemDataRoot()` returns a drive letter root.

## Observed Error
```
Error occurred in handler for 'auth:get-status': [Error: EPERM: operation not permitted, mkdir 'S:\']
```
This repeats for any service calling `mkdir(getAppDataRoot(), { recursive: true })`.

## Downstream Effect: BLOCKED Startup Status

The `auth:get-status` EPERM causes the `app:bootstrap-host` orchestration to return `overallStatus: 'BLOCKED'`. Chakra logs:
```
[PRANA] Startup orchestration completed with non-ready status: BLOCKED
```
Chakra's splash screen treats BLOCKED as non-fatal and allows the renderer to continue to the login page, but auth cannot complete because the status handler keeps throwing. This is not a Chakra bug — the BLOCKED handling is intentional. The fix is in Prana (see below).

## Correct Fix

### Helper — detect Windows drive root

```typescript
// Returns true for paths like "S:", "S:\", "S:/"
function isWindowsDriveRoot(p: string): boolean {
  return /^[A-Za-z]:[/\\]?$/.test(p.trim())
}
```

### In every service that calls mkdir on the data root

```diff
- await mkdir(getSystemDataRoot(), { recursive: true })

+ const root = getSystemDataRoot()
+ try {
+   await mkdir(root, { recursive: true })
+ } catch (err: unknown) {
+   // WinFsp returns EPERM when you attempt to mkdir a drive-letter root (e.g. "S:\").
+   // The directory already exists as the mount point — swallow this specific error.
+   if (
+     err &&
+     typeof err === 'object' &&
+     'code' in err &&
+     (err as { code: string }).code === 'EPERM' &&
+     isWindowsDriveRoot(root)
+   ) {
+     return
+   }
+   throw err
+ }
```

### Readiness probe — check mount, not mkdir

```diff
  if (isWindows()) {
    try {
-     await mkdir(mountedRoot, { recursive: true })
+     await access(mountedRoot)
    } catch {
      // mount not ready
    }
  }
```

## Why This Works
- `S:\` already exists as the WinFsp mount — there is nothing to create.
- Subdirectories (`S:\apps`, `S:\cache`, `S:\data`) can be created normally inside the mount.
- Catching only EPERM on a drive-root path is precise — other EPERM errors (real permission failures on subdirectories) are still rethrown.
- The drive root stays at `S:\`; no `/live` subdirectory is introduced.

## Expected Layout After Fix

```
S:\
  apps\
    chakra\
    dhi\
  cache\
    sqlite\
  data\
    governance\
```

This structure is defined by Chakra's `src/main/config/drive-layout.json` and created on every startup by `chakra:ensure-drive-layout`.

## Files Expected to Change in Prana

- `src/main/services/driveControllerService.ts` — readiness probe mkdir logic (line ~300: `await mkdir(mountedRoot, { recursive: true })` should use `access` not `mkdir`)
- `src/main/services/authStoreService.ts`, `businessContextStoreService.ts`, `contextDigestStoreService.ts`, `runtimeDocumentStoreService.ts` — all four call `mkdir(getSqliteRoot(), { recursive: true })` without `mkdirSafe`. Full fix documented in `sqlite-store-mkdir-eperm-fix.md`.
- `src/main/services/governanceRepoService.ts` — `getSqliteRoot()` (line ~89) falls back to `getAppDataRoot()` which is the bare drive root after mount. Fix: default to `join(getAppDataRoot(), 'cache', 'sqlite')`. Covered in `sqlite-store-mkdir-eperm-fix.md`.
- Any other service that calls `mkdir(getSystemDataRoot() | getAppDataRoot(), ...)` without `mkdirSafe`

## Chakra Workaround (applied, pending Prana fix)

Until Prana fixes `authStoreService.ts`, Chakra sets the SQLite root override explicitly after `chakra:ensure-drive-layout` completes:

```typescript
const { setSqliteRootOverride } = await import('prana/main/services/governanceRepoService')
setSqliteRootOverride(join(driveRoot, 'cache', 'sqlite'))
```

This routes `getSqliteRoot()` to `S:\cache\sqlite` (matching `drive-layout.json`) before `auth:get-status` is called, so `authStoreService.mkdir(getSqliteRoot())` creates a subdirectory — not the drive root — and the EPERM is avoided.
