# Feature Request: Client-Controlled Virtual Drive Mounting

**Repository:** `prana`  
**Type:** Architecture / API Design  
**Files Affected:**
- `src/main/services/driveControllerService.ts`
- `src/main/services/startupOrchestratorService.ts`
- `src/main/services/vaidyarService.ts`

## Problem Statement

Currently, Prana **unilaterally decides** whether to mount virtual drives during the startup sequence. The `startupOrchestratorService` calls `driveControllerService.initializeSystemDrive()` and `mountVaultDrive()` as mandatory stages in its orchestration pipeline. If mounting fails, Prana marks the entire application as `BLOCKED` or `DEGRADED` — regardless of whether the host application actually needs or wants virtual drive functionality.

This creates a hard coupling where:

1. **The library dictates infrastructure requirements** — Prana forces consumers to install `rclone` + `WinFsp` even if the host app only uses Prana for auth, settings, or context engine features.
2. **The client cannot opt out** — There is no API for the host application to say "skip drive mounting" or "I'll manage my own storage".
3. **Diagnostic severity is hardcoded** — `vaidyarService` has `vault_mount` and `system_drive_posture` checks with hardcoded severity levels. The client cannot lower or disable these checks.
4. **Startup is blocked by unused features** — An application that never uses the vault (e.g., only needs auth + settings) is still blocked if rclone is missing.

## Current Architecture (Problem)

```
Host App (Dhi)
  │
  └─ calls app:bootstrap-host IPC
       │
       └─ Prana startupOrchestratorService (owns the decision)
            ├─ Stage: initializeSystemDrive()     ← MANDATORY
            ├─ Stage: mountVaultDrive()            ← MANDATORY
            ├─ Stage: vaidyarService.runChecks()   ← hardcoded severity
            └─ Result: BLOCKED if mount fails      ← host cannot override
```

## Proposed Architecture

The host application should control whether drives are mounted, what diagnostics are applied, and how failures are handled.

### Option A: Bootstrap Config Flag

Add a `virtualDrives.clientManaged: true` flag to the bootstrap config. When set, Prana skips all drive mounting during startup and exposes the mount API for the client to call when ready:

```typescript
// Host app (Dhi) bootstrap config
{
  virtualDrives: {
    clientManaged: true,  // NEW: Prana skips auto-mount
    enabled: true,        // drives CAN be mounted, but client decides when
    vault: { ... },
    system: { ... }
  }
}

// Host app mounts when it's ready
await pranaApi.driveController.mountVaultDrive(userPassword);
```

### Option B: Feature Manifest

Allow the host to declare which Prana subsystems it uses. If `vault` isn't in the manifest, drive mounting is skipped entirely:

```typescript
{
  features: {
    auth: true,
    settings: true,
    contextEngine: true,
    vault: false,          // skip vault drive mounting
    virtualDrives: false,  // skip all drive infrastructure
  }
}
```

### Option C: Diagnostic Severity Override

At minimum, allow the host app to override diagnostic check severities via bootstrap config:

```typescript
{
  diagnostics: {
    overrides: {
      vault_mount: { severity: 'low' },        // don't block on vault
      system_drive_posture: { severity: 'low' } // don't block on system drive
    }
  }
}
```

## Benefits

1. **Decoupled infrastructure** — Consumers don't need rclone/WinFsp unless they explicitly use vault features
2. **Faster startup** — Apps that don't need drives skip the mount sequence entirely
3. **Client autonomy** — The host app controls its own infrastructure posture
4. **Testability** — Development and CI environments can run without external dependencies
5. **Progressive adoption** — New consumers can start with auth/settings and add vault later

## Current Workaround (in Dhi)

Dhi patches `vaidyarService.ts` in `node_modules` to downgrade `vault_mount` and `system_drive_posture` check severities from `high` to `medium`. This prevents `BLOCKED` status but is fragile and overwritten on `npm install`. It also doesn't solve the fundamental issue — the mount is still attempted and fails with noisy error logs.
