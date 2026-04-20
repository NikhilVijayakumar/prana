---
phase: 01-chakra-is-the-app-which-now-integrate-drive-apart-from-dhi-r
plan: 01
subsystem: startup
tags: [startup, diagnostics, dependencies, host-capability]
requires: []
provides:
  - Reusable host dependency capability service for SSH, Git, and virtual-drive runtime checks
  - Startup blocking stage that consumes host dependency capability diagnostics
  - Regression test coverage for missing host dependency startup behavior
affects: [startup-orchestrator, governance-bootstrap, host-integrations]
tech-stack:
  added: []
  patterns: [service-level capability contract, deterministic startup gating]
key-files:
  created:
    - src/main/services/hostDependencyCapabilityService.ts
  modified:
    - src/main/services/startupOrchestratorService.ts
    - src/main/services/startupOrchestratorService.test.ts
    - docs/features/boot/startup-orchestrator.md
key-decisions:
  - "Host dependency checks run through a reusable core service and are consumed by startup via a dedicated blocking stage."
  - "Configured virtual-drive binary path is preferred; PATH-based rclone check is used as fallback."
patterns-established:
  - "Startup gating should fail with explicit missing dependency diagnostics and skip downstream blocking stages."
requirements-completed:
  - CHAKRA-PR-01
duration: 42 min
completed: 2026-04-20
---

# Phase 01 Plan 01: Reusable Host Dependency Capability Summary

**Startup now enforces reusable host dependency capability checks for SSH, Git, and virtual-drive runtime before governance and vault stages.**

## Performance

- Duration: 42 min
- Started: 2026-04-20T09:20:00Z
- Completed: 2026-04-20T10:02:00Z
- Tasks: 3
- Files modified: 4

## Accomplishments
- Added a new core service, hostDependencyCapabilityService, that reports passed, missing, and per-dependency diagnostics.
- Added a new blocking startup stage host-dependencies that runs after integration and before governance.
- Updated startup tests to validate dependency-missing blocking behavior and updated startup documentation to include the new capability gate.

## Task Commits

1. Task 1+2+3: b7ea72a (feat)

Plan metadata commit: pending with phase execution orchestration.

## Files Created/Modified
- src/main/services/hostDependencyCapabilityService.ts - Reusable host dependency capability contract and binary checks.
- src/main/services/startupOrchestratorService.ts - Added host dependency stage and blocking/skip behavior wiring.
- src/main/services/startupOrchestratorService.test.ts - Added and adjusted tests for host dependency outcomes.
- docs/features/boot/startup-orchestrator.md - Added Host Dependency Capability Gate section and invariants.

## Decisions Made
- Introduced host dependency checks as an explicit startup stage instead of embedding checks inside governance logic.
- Kept stage output human-readable with dependency-specific failure details for host diagnostics surfaces.

## Deviations from Plan

### Auto-fixed Issues

1. [Rule 1 - Bug] Watchdog helper invoked stage operations twice and caused unhandled rejections.
- Found during: Task 2 verification.
- Issue: executeWithWatchdog called operation() inside both Promise.race branches.
- Fix: Refactored watchdog logic to invoke operation once and clear timeout safely in finally.
- Files modified: src/main/services/startupOrchestratorService.ts
- Verification: npm run test -- src/main/services/startupOrchestratorService.test.ts
- Committed in: b7ea72a

---

Total deviations: 1 auto-fixed (1 bug)
Impact on plan: Fix was required for deterministic startup test reliability; no scope creep.

## Issues Encountered
- ESLint reported one no-explicit-any error in new service parsing; resolved by introducing typed shape for virtual drive config fields.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 01 completed and verified.
- Ready for Plan 02 (virtual-drive policy ownership decoupling and diagnostics policy wiring).

---
Phase: 01-chakra-is-the-app-which-now-integrate-drive-apart-from-dhi-r
Completed: 2026-04-20
