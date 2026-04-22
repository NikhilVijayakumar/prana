# Prana Bug Report: Windows virtual drive spawn readiness can break auth startup

## Summary
On Windows dev startup, Prana can report the virtual drive as mounted immediately on process spawn, then set app data root to `S:` before the mount is actually usable. This leads to runtime failures during auth initialization:

- `Error occurred in handler for 'auth:get-status': [Error: ENOENT: no such file or directory, mkdir 'S:']`

This is not an `rclone` availability issue. `rclone version` succeeds from both PowerShell and Node `execFile`.

## Environment
- Host app: Chakra
- OS: Windows 11
- Runtime: Electron dev (`npm run dev`)
- Virtual drive provider: rclone (WinGet install)

## Reproduction
1. Start Chakra in dev mode: `npm run dev`.
2. Wait for app startup to reach auth splash/status checks.
3. Observe startup logs.

## Observed behavior
- Startup continues past host dependency checks.
- Later, auth status fails with:
  - `ENOENT: no such file or directory, mkdir 'S:'`
- Logs also show startup orchestration ending as blocked.

## Why this appears to be in Prana
1. In Prana virtual drive provider, mount success resolves on child process `spawn`, not confirmed mount readiness.
2. Drive controller marks system drive mounted and updates app data root to drive-letter mount point (`S:` on Windows).
3. Auth/runtime services then attempt filesystem operations against `S:` and fail when mount is not ready/valid.

Relevant Prana paths in Chakra workspace:
- `node_modules/prana/src/main/services/virtualDriveProvider.ts`
- `node_modules/prana/src/main/services/driveControllerService.ts`
- `node_modules/prana/src/main/services/runtimeConfigService.ts`

## Additional integration hazard (also observed)
- Prana `runtimeConfigService` reads bootstrap config from SQLite snapshot (`sqliteConfigStoreService.readSnapshotSync()`), not directly from in-memory runtime override.
- If snapshot is stale, auth/runtime behavior can diverge from current host-provided runtime config.

## Suggested upstream fixes
1. **Mount readiness contract**
   - Do not mark mount success on `spawn` alone.
   - Add readiness probe for mounted path before returning success and before setting system data root.
2. **Windows drive-letter handling**
   - Treat raw `X:` as potentially unavailable until readiness confirmed.
   - Prefer fallback path when readiness probe fails.
3. **Runtime config source consistency**
   - Make `getRuntimeBootstrapConfig()` prioritize current in-memory runtime config when available, then snapshot fallback.

## Chakra-side mitigation applied
Chakra now mitigates this in dev by:
- Not pre-mounting system drive in main startup before bootstrap.
- Defaulting virtual drives to disabled in development unless explicitly enabled.
- Overwriting Prana SQLite runtime snapshot from current runtime config in development to avoid stale snapshot drift.

These are mitigations; upstream Prana readiness/source fixes are still needed.
