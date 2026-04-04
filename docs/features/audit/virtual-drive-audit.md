# Virtual Drive Audit

## Summary
The virtual-drive layer exists and is functional, but orchestration is incomplete for a strict mount/unmount lifecycle.

## Missing Logic / Edge Cases
- The system drive is mounted during bootstrap, but the vault drive is not automatically mounted during startup or explicit vault windows.
- Shutdown cleanup currently stops at temporary workspace removal and does not guarantee drive unmount.
- There is no policy switch for "fail closed" when mount setup is unavailable.

## Documentation-to-Code Mismatches
- Current documentation implied both DB and vault backing folders were mounted on demand as a first-class runtime posture.
- In code, only the system drive is currently initialized from the main bootstrap path.
- Vault mount APIs are service-layer capabilities, not runtime defaults.

## Security Risks
- Fallback mounts can move sensitive runtime data outside encrypted storage when mount setup fails.
- Mount state is not currently surfaced as a hard runtime blocker.

## Recommended Fixes
- Add startup and shutdown orchestration around the drive controller.
- Emit mount-state diagnostics into startup status.
- Add an explicit vault mount session wrapper for sync windows.
