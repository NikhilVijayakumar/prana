# Runtime Doctor Audit (Prana)

## Summary
A Doctor-style diagnostic feature is not yet implemented as a unified runtime module. Only partial health signals exist today.

## Missing Logic / Edge Cases
- `systemHealthService` only reports OS/process telemetry.
- There is no single orchestrator that aggregates storage, security, integration, browser, email, and cron checks into one report.
- There is no optional plugin/execution policy for post-bootstrap diagnostics.
- There is no report delivery surface through IPC for client apps.

## Documentation-to-Code Mismatches
- The desired Doctor feature is broader than current startup telemetry.
- Startup status is not equivalent to a user-consumable health report.
- Health checks are scattered across services and lack a single registry.

## Security Risks
- Without a unified diagnostic surface, degraded mount or integration states can be easy to miss.
- Hidden failures in email/browser/cron paths can remain invisible until a later runtime failure.

## Recommended Fixes
- Add a Doctor service that composes health checks after bootstrap.
- Make it pluggable and optional.
- Return a structured diagnostic report with per-check status, error hints, and remediation guidance.
- Expose it through IPC for UI and host integration.
