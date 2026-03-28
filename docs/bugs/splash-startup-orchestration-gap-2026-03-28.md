# Splash Startup Orchestration Gap Audit (2026-03-28)

## Status (2026-03-28)
Overall: CLOSED for current scope.

Resolution evidence:
1. Canonical startup sequencing exists in `src/main/services/startupOrchestratorService.ts`.
2. Startup status is published to renderer via `app:get-startup-status`.
3. Pre-auth integration screen and splash gate progression on required stage success (`integration`, `governance`, `vault`).

## Purpose
Track gaps between intended splash initialization behavior and current implementation ordering.

## Summary
Startup ownership is now consolidated and deterministic, with pre-auth diagnostics surfacing stage-level health and blocking login when required stages fail.

## Verified Current Flow
1. Main process boot registers IPC handlers.
2. IPC registration initializes hook, cron scheduler, and memory index services.
3. Startup also runs syncProviderService.initializeOnSplash in main bootstrap path.
4. Splash UI separately checks auth SSH status and model gateway status.

## Gaps

### GAP-STARTUP-001: Startup sequence is distributed across multiple entry points
Severity: High

Evidence:
- src/main/index.ts
- src/main/services/ipcService.ts
- src/ui/splash/viewmodel/useSplashViewModel.ts

Impact:
- Hard to guarantee ordering and dependency rules.
- Startup behavior can drift with future changes.

Required fix:
- Introduce canonical StartupOrchestrator service and stage contract.

### GAP-STARTUP-002: Splash checks do not represent full startup state
Severity: High

Evidence:
- splash viewmodel checks SSH and model gateway only.

Impact:
- Vault sync, SQLite hydration/recovery, and cron catch-up are not surfaced in splash status.

Required fix:
- Publish stage-by-stage startup status to renderer and gate login on required stage success.

### GAP-STARTUP-003: Duplicate or overlapping initialization responsibilities
Severity: Medium

Evidence:
- cron initialize in IPC registration plus startup sync bootstrap paths.

Impact:
- Potential for overlap complexity and inconsistent diagnostics.

Required fix:
- Move orchestration ownership into one startup stage runner.

## Acceptance Criteria
1. Startup stages have single owner and deterministic order.
2. Splash/pre-auth diagnostics show complete startup stage health.
3. Login transition blocked on required startup stage failures.
