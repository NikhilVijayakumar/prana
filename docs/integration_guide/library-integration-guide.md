# Prana Library Integration Guide

Welcome to the Prana Integration Guide. This document outlines the core architectural paradigms required to properly integrate the Prana Engine as a backend module into a Host UI application (like Dhi or Astra). Prana is structurally designed as a zero-environment, cold-vault, standalone library. 

---

## The Cold-Vault Philosophy

Prana operates on a strict **"Cold-Vault"** persistence model. When your node process or Electron Main process first parses Prana, **nothing happens**. The backend lies dormant, waiting to be properly seeded with user configuration from the Host UI.

Prana **does not** rely on `.env` files, process arguments, or global volatile memory to initialize. Instead, all configurations are passed dynamically through Inter-Process Communication (IPC) by a Splash Screen and immediately hashed into an Encrypted **SQLite Repository** Native Configuration Table. All subsequent queries map instantly back to this localized SQLite memory block.

> [!WARNING]
> Do not attempt to prematurely invoke any internal Prana Services directly inside `app.whenReady()` during your `index.ts` boot phase. Premature service mounting will trigger unexpected exceptions and missing configurations. The entire system is meant to be deferred to your Frontend UI Splash rendering pipeline.

---

## 1. Deferred Startup Validation (The Splash Screen)

The entry point for hydrating the backend is `app:bootstrap-host`. The frontend Splash screen gathers the required properties (such as director details, vault passwords, or git credentials) and dispatches them over the bridge.

Prana enforces a **Fail-Fast** design pattern. If the properties are malformed, initialization is completely blocked, and a structured `BLOCKED` payload gracefully aborts the boot process without crashing Node.js with a White Screen.

### Example UI Integration Block
```typescript
import { StartupStatusReport } from 'prana/types';

// During Splash Mount...
try {
  const report: StartupStatusReport = await window.api.invoke('app:bootstrap-host', {
    config: {
      director: { name: 'Admin', email: 'admin@local.com' },
      governance: { repoUrl: 'git@github.com:usr/repo.git', repoPath: '~/.prana/governance' },
      vault: { archivePassword: 'test', archiveSalt: 'test', kdfIterations: 500000 },
      sync: { cronEnabled: true, pushCronExpression: '*/5 * * * *', pullCronExpression: '*/5 * * * *' }
    }
  });

  if (report.overallStatus === 'READY') {
    // Stage 8 Complete: Route User to Login Dashboard
    router.push('/login');
  } else if (report.overallStatus === 'BLOCKED') {
    // Fail Fast: Route User to the Astra `<ErrorState />` Component using the report messages.
    this.handleBootstrapFailure(report.stages);
  }
} catch (error) {
  // Catch Critical Native Core Failures
  renderCrashScreen(error.message);
}
```

---

## 2. The 8-Step Boot Sequence Architecture

When your front-end explicitly fires `'app:bootstrap-host'`, the backend synchronously cascades through 8 highly secure stages before handing control back:

1. **Host Request**: The backend catches the configurations securely over IPC boundary.
2. **SQLite Bootstrapping**: Prana natively filters the data through `validatePranaRuntimeConfig()`. If valid, it writes the configuration immediately to its local `sqliteConfigStoreService` and awakes the database drivers.
3. **Encrypted Virtual Drive Mount**: Prana attempts to bridge your Vault directly to the Host OS (via WinFsp/RClone). The physical folder `~/.prana/db/vault` converts invisibly into a natively mounted Disk Drive for transparent desktop app reading.
4. **Git & SSH Validation**: Prana clones or establishes SSH connectivity to the remote `governance-repo`. Should SSH keys fail, Boot fails gracefully.
5. **Vault Extractor Reconciler**: Fresh Vault `.zip` nodes are decrypted with AES iterations, unpacked, and the corresponding flat JSON documents are pushed intelligently directly into Native SQLite tables for raw read speed.
6. **Background Task & Sync Recovery**: The Orchestrator spins up the `cronSchedulerService` to compute missed triggers or dropped file uploads since the application was last killed. Any incomplete transactions resume in the background automatically.
7. **Login Bridge Clearance**: The `overallStatus: 'READY'` tag is sent out to resolve the Splash Promise.
8. **Lifecycle & Native Storage Route**: Across your entire app's active usage, no `.env` lookups ever occur again. All state natively reads the `readSnapshotSync()` off the active Disk.

---

## 3. Graceful Storage Degradation 

Should the user uninstall WinFsp natively, lack appropriate user permissions, or drop their network mapped drives unexpectedly—**Prana adapts on the fly**. 

Prana leverages `driveControllerService` native bindings. If absolute physical disk virtualization fails completely, Prana alerts the renderer by falling back dynamically to flat root folder locations (`.prana/db/live`), and triggers a background hook system telemetry ping:

```typescript
hookSystemService.emit('system.status', { 
  component: 'drive', 
  status: 'degraded' 
});
```

> [!TIP]
> **Best Practice:** The host UI application MUST actively subscribe to the `'system.status'` HookEvent via its Master Layout in order to paint silent degradation warnings persistently into the user's dashboard header.

---

## 4. Teardown & Lifecycle Memory Closure

Due to SQLite native WASM binary integration, Node.js memory pointers are kept completely synchronous. However, when the consumer closes the Main window or the application shuts down, **do not force-kill the process**. Prana explicitly wires DB closing routines into the Host’s native App loop.

By importing Prana, `app.on('before-quit')` is automatically appended to securely flush all pending SQLite WAL (Write-Ahead-Logs), securely dispatch `dispose()` onto handlers, and remove any leftover temporary un-encrypted JSON workspace drops securely from memory before freeing context limits.
