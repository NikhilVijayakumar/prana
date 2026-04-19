# Bug Report: Application Crashes When RClone / WinFsp Are Not Installed

**Repository:** `prana`  
**Severity:** Critical — blocks application startup and vault access  
**Files Affected:**
- `src/main/services/driveControllerService.ts`
- `src/main/services/virtualDriveProvider.ts`
- `src/main/services/notificationCentreService.ts`
- `src/main/services/ipcService.ts`
- `src/ui/vault/view/VaultContainer.tsx`
- `src/ui/vault-knowledge/view/VaultKnowledgeContainer.tsx`

## Issue Description

Prana's virtual drive system hard-depends on the `rclone` binary and `WinFsp` driver being installed on the host machine. When these prerequisites are missing (which is the default state on a fresh developer or user machine), the application suffers **five cascading fatal crashes**:

### Crash 1: `spawn rclone ENOENT` during startup

`virtualDriveProvider.mount()` calls `spawn('rclone', [...])`. When the binary doesn't exist, Node.js throws an unhandled `ENOENT` error. This error is **not caught** by `mountDriveInternal()` in `driveControllerService.ts`, which only checks `result.success` but never wraps the `provider.mount()` call in a `try-catch`.

```
[Sync] Failed to mount virtual drive, skipping direct node merge integration. Error: spawn rclone ENOENT
    at acquireVaultDriveSession (driveControllerService.ts)
```

### Crash 2: Stale session counter blocks startup

When `acquireVaultDriveSession` increments `sessionDepthByDrive` before calling `mountDrive`, and `mountDrive` fails, the session counter is never rolled back. This leaves `activeSessionCount: 1` in the mount registry. The `vaidyarService` diagnostic then sees an active session on a failed drive and reports `status: Blocked`, permanently preventing the application from proceeding past the splash screen.

### Crash 3: `PRANA_CONFIG_ERROR` during shutdown

`driveControllerService.dispose()` calls `unmountMountedDrive()`, which calls `getNormalizedVirtualDriveConfig()`, which calls `getRuntimeBootstrapConfig()`. If the app is shutting down before bootstrap completed, this throws:

```
[PRANA_FATAL_ERROR] Unhandled rejection: Error: [PRANA_CONFIG_ERROR] Runtime config is not set.
    at unmountMountedDrive → getNormalizedVirtualDriveConfig → getRuntimeBootstrapConfig
```

### Crash 4: `MODULE_NOT_FOUND` for hookSystemService

`notificationCentreService.initialize()` uses a CommonJS `require('./hookSystemService')` which fails in the bundled ESM output:

```
[PRANA_WARNING] Failed to initialize notificationCentreService: Error: Cannot find module './hookSystemService'
```

### Crash 5: White screen on Vault page

`VaultContainer.tsx` and `VaultKnowledgeContainer.tsx` call `throwPranaUiError()` during React render when the IPC call fails. This throws an exception **during render** which crashes React entirely, producing an unrecoverable white screen. The `PranaModuleErrorBoundary` wrapper cannot catch this because the error is thrown before the component's JSX is returned.

## Prerequisites Not Documented

There is **no documentation** in prana's README, setup guide, or error messages telling consumers that the following must be installed:

1. **[RClone](https://rclone.org/downloads/)** — cloud storage mount tool (must be in PATH)
2. **[WinFsp](https://winfsp.dev/)** — Windows File System Proxy driver (required by rclone mount on Windows)
3. **[FUSE](https://github.com/libfuse/libfuse)** — required by rclone mount on macOS/Linux

## Proposed Fix

### 1. Wrap `provider.mount()` in try-catch

```typescript
// driveControllerService.ts — mountDriveInternal()
let result: VirtualDriveMountResult;
try {
  result = await provider.mount({ ... });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  return persistDriveFailure(driveId, config, message, null);
}
```

### 2. Roll back session counter on mount failure

```typescript
// driveControllerService.ts — acquireVaultDriveSession()
if (!result.success) {
  const reducedDepth = Math.max(nextDepth - 1, 0);
  sessionDepthByDrive.set('vault', reducedDepth);
  const updatedRecord = getDriveRecord('vault');
  if (updatedRecord) {
    updateRegistry({ ...updatedRecord, activeSessionCount: reducedDepth });
  }
  throw new Error(result.message);
}
```

### 3. Wrap shutdown paths in try-catch

`unmountMountedDrive()` and `dispose()` must be wrapped defensively so that config-not-set errors during premature shutdown don't produce unhandled rejections.

### 4. Remove dynamic `require()`

Replace `const hookSystemModule = require('./hookSystemService')` with a static import or remove the dead code entirely (the `if` body is an empty placeholder).

### 5. Replace `throwPranaUiError` with `PranaModuleErrorView` in vault containers

```tsx
// VaultContainer.tsx — BEFORE (crashes React)
if (moduleError) {
  throwPranaUiError(moduleError);  // throws during render → white screen
}

// VaultContainer.tsx — AFTER (renders error UI)
if (moduleError) {
  return <PranaModuleErrorView error={moduleError} onRetry={() => { clearModuleError(); reload(); }} />;
}
```

### 6. Wrap vault IPC handlers

`vault:list-files` and `vault-knowledge:get-snapshot` handlers should catch errors and return safe defaults (`[]` and `{ status: 'UNAVAILABLE' }`) instead of letting the error propagate to Electron's IPC error handler.

## Current Workaround (in Dhi)

All six fixes above have been applied as `node_modules` patches in the Dhi repository. These patches will be overwritten on the next `npm install` and must be upstreamed to Prana.
