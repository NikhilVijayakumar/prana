# Persistence Architecture Audit

## Summary
The persistence architecture documentation is now more accurate than before, but it still overstates the completeness of virtual-drive orchestration and understates the fallback behavior in several places.

## Missing Logic / Edge Cases
- `driveControllerService.dispose()` is implemented, but the app shutdown path does not call it, so explicit unmount is not guaranteed.
- Vault-drive mount/unmount APIs exist but are not invoked by a central sync lifecycle wrapper.
- SQLite storage is file-backed via `sql.js` export and is not inherently encrypted unless the system drive mount is active.
- Temporary vault workspace cleanup is not equivalent to a mount-level lock or unmount.

## Documentation-to-Code Mismatches
- The target-state language says vault is opened only for startup sync or explicit write-back; in code, the vault workspace is also used for general read/write operations that need archive context.
- The document implies separate encrypted virtual drives for DB and vault; in code, only the system drive is automatically mounted at bootstrap.
- The document should distinguish "workspace cleanup" from "drive unmount".

## Security Risks
- Fallback to local app data path can reduce at-rest confidentiality if the encrypted system drive is unavailable.
- A missing shutdown unmount hook can leave mount artifacts behind after a crash or abrupt exit.

## Recommended Fixes
- Wire `driveControllerService.dispose()` into process shutdown.
- Add an explicit vault mount scope around sync/write-back operations.
- Tag fallback path usage in diagnostics whenever encrypted mount mode is unavailable.
- Add tests for mount, cleanup, and fallback behavior.
