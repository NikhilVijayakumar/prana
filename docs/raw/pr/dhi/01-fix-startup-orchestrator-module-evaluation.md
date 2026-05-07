# Fix: Early Module Evaluation Crash in StartupOrchestratorService

## Context
Prana is designed as a standalone generic runtime library that assumes a "Cold-Vault" architecture. In this architecture, the Main process waits for the host application to pass down the configuration payload via the `app:bootstrap-host` IPC event before establishing the SQLite stores or attempting to read the `RuntimeBootstrapConfig`.

## The Bug
A fatal architectural bug exists in `src/main/services/startupOrchestratorService.ts` where module-scope initialization invokes a dependency chain leading to premature database reads:

```typescript
let latestStartupReport: StartupStatusReport = {
  startedAt: nowIso(),
  finishedAt: null,
  currentState: 'INIT',
  overallStatus: 'DEGRADED',
  overallProgress: 0,
  stages: createInitialStages(),
  diagnostics: {
    // 🔴 BUG: This function call executes immediately when the module is imported
    virtualDrives: driveControllerService.getDiagnostics(),
  },
};
```

### Dependency Chain:
1. When `index.ts` is imported, it registers IPC handlers (`ipcService.ts`).
2. `ipcService.ts` imports `startupOrchestratorService.ts`.
3. `startupOrchestratorService.ts` defines `latestStartupReport` natively inside its root scope, immediately evaluating `driveControllerService.getDiagnostics()`.
4. `driveControllerService.getDiagnostics()` synchronously triggers `computeDiagnostics()`.
5. `computeDiagnostics()` invokes `getNormalizedVirtualDriveConfig()` which attempts to read the DB: `getRuntimeBootstrapConfig()`.
6. Because the host hasn't emitted `app:bootstrap-host` yet (and thus the config hasn't been set), this throws a fatal `[PRANA_CONFIG_ERROR] Runtime config is not set.`
7. This completely corrupts the JS evaluation phase and acts as an Unhandled Rejection, tearing down the Main process logic early.

## The Solution
This bug affects **all host applications** using Prana, not just `dhi`. The target state variable should defer diagnostic resolution until a valid configuration is fully booted and stored.

**File:** `src/main/services/startupOrchestratorService.ts`

**Fix:** Remove `diagnostics` from the initial static definition or make it explicitly `undefined` until the startup orchestrator actually executes.

```typescript
// Proposed Fix:
let latestStartupReport: StartupStatusReport = {
  startedAt: nowIso(),
  finishedAt: null,
  currentState: 'INIT',
  overallStatus: 'DEGRADED',
  overallProgress: 0,
  stages: createInitialStages(),
  // Omit diagnostics or set to undefined at module scope
};
```

## Mitigation Strategy for DHI
Since Prana is meant to be a standalone, purely downstream dependency, any direct patches inside `node_modules/prana` will be completely overwritten during the next environment pull or `npm install`.

The maintainers of the `prana` repository must apply this fix to enable downstream Electron hosts to bootstrap successfully. Wait for an upstream version bump on `prana`.
