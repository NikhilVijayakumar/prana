# Vault Audit

## Summary
Vault encryption is implemented, but the lifecycle contract still mixes encrypted archive handling with temporary workspace behavior.

## Missing Logic / Edge Cases
- Vault operations rely on a materialized working tree under temp storage.
- Relock is represented by cleanup, not by guaranteed mount teardown.
- There is no dedicated runtime wrapper that ties mount, sync, and unmount into one atomic transaction.

## Documentation-to-Code Mismatches
- The docs should not describe vault as continuously mounted.
- The docs should explicitly say that publish and sync use a temporary working workspace.
- The archive is encrypted, but the working workspace itself is transient plaintext while active.

## Security Risks
- Any process crash during workspace materialization can leave plaintext working files until cleanup runs.
- Drive-level encryption is only as strong as the mount posture at the time of operation.

## Recommended Fixes
- Add a vault session manager that scopes mount/open/cleanup steps.
- Make cleanup visible in diagnostics and health checks.
- Consider more explicit zeroization/cleanup semantics for sensitive temp artifacts.
