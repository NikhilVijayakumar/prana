# PR Document: Fix Unhandled Promise Rejection in syncProviderService

**Repository:** `prana`
**File:** `src/main/services/syncProviderService.ts`

## Issue Description
During application bootstrap, the "Cold-Vault" architecture attempts to mount virtual drives via `driveControllerService.withVaultDriveSession`. However, if `rclone` is disabled or fails to initialize, `withVaultDriveSession` inherently throws a fatal exception.

Currently, the `pullLatestFromRemoteVaultAndMerge` function invokes this subroutine without wrapping it in a resilient `try-catch` mechanism. As a direct result, any failure correctly reported by the virtual drive provider propagates up as an Unhandled Promise Rejection, instantly crashing the NodeJS application orchestrator before it reaches the main UI window.

## Proposed Fix
Implement a structured fallback gracefully catching `mountDrive` exceptions. If the remote vault drive fails to mount, it should gracefully bypass or run direct initialization instead of abruptly bringing down the `startupOrchestratorService`.

```typescript
// Proposed structure within pullLatestFromRemoteVaultAndMerge()
try {
  await driveControllerService.withVaultDriveSession(context, async (session) => {
    // Merge operations...
  });
} catch (error) {
  console.warn('[Sync] Failed to mount virtual drive, skipping direct node merge integration.', error);
  // Perform fallback cache initialization...
}
```

## Context
This directly impacts consumers of the `prana` library (like `dhi`) running under conditions where RClone mounting is manually disabled (`virtualDrives.enabled: false`) to bypass environment constraints. This fix was previously mocked locally via `node_modules` modifications.
