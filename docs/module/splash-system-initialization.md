# Setup & Config: System Initialization - Atomic Feature Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- Startup responsibilities are documented and implementation sync notes identify distributed ownership.
- Pre-auth diagnostics and recovery initialization are orchestrator-led and expose startup, sync, and cron recovery summaries.

## Target State
- Keep startup orchestration ownership unified under deterministic stage boundaries and replay reporting.
- Keep startup diagnostics consistent across integration, vault hydration, sync recovery, and cron catch-up.

## Gap Notes
- Core startup orchestration is unified, but some lower-level implementation remains distributed across specialized services by design.

## Dependencies
- docs/module/startup-orchestrator.md
- docs/module/vault-sync-contract.md
- docs/module/cron-recovery-contract.md

## Acceptance Criteria
1. Startup stage ownership is explicit and deterministic.
2. Recovery summaries are visible and policy-safe in pre-auth diagnostics.
3. Startup transition to protected flows respects required gates.
4. Startup status reflects sync merge decisions and cron recovery counters without exposing secrets.

## Immediate Roadmap
1. Keep splash diagnostics aligned as deeper sync/cron telemetry is added.
2. Reduce legacy wording in implementation notes that predates orchestrator ownership.

## Implementation Sync (2026-03-28)

Current implemented services relevant to splash startup:
- `src/main/index.ts`
- `src/main/services/ipcService.ts`
- `src/main/services/governanceRepoService.ts`
- `src/main/services/vaultService.ts`
- `src/main/services/syncProviderService.ts`
- `src/main/services/syncStoreService.ts`
- `src/main/services/cronSchedulerService.ts`
- `src/main/services/recoveryOrchestratorService.ts`
- `src/ui/splash/viewmodel/useSplashViewModel.ts`
- `src/ui/integration/view/IntegrationVerificationPage.tsx`

Current reality:
1. Startup stage ownership is coordinated through `startupOrchestratorService` with stage-by-stage status publication.
2. Pre-auth integration diagnostics and startup reporting are available through splash and integration verification surfaces.
3. Cron recovery summaries now include recovered, detected, enqueued, duplicate-prevented, processed, and failed counts.
4. Vault pull/hydration and SQLite sync recovery publish explicit install mode, pull, merge, and integrity outcomes.

Planned alignment docs:
- `docs/module/startup-orchestrator.md`
- `docs/module/vault-sync-contract.md`
- `docs/module/cron-recovery-contract.md`
- `docs/bugs/resolved/splash-startup-orchestration-gap-2026-03-28.md`
- `docs/bugs/resolved/vault-sqlite-sync-gap-2026-03-28.md`
- `docs/bugs/resolved/cron-catchup-recovery-gap-2026-03-28.md`

## 1. Single Reason to Change (SRP)
This document handles updates **exclusively** related to the background loading and hydration sequence that triggers when the Electron application boots up. It is entirely headless.

## 2. Input Data Required
- **Disk IO:** Reading the actual `.yaml` and `.json` registry definitions from the Vault filesystem path.

## 3. Registry Sub-Component Integration
- **Agents:** Loads them into RAM.
- **Skills:** Loads them into RAM.
- **Workflows:** Loads them into RAM.
- **Protocols:** Loads them into RAM.
- **KPIs:** Loads them into RAM.
- **Data Inputs:** Loads them into RAM.

## 4. Triple-Engine Extraction Model
- **OpenCLAW:** Not executing logic here, just being loaded into the binary context.
- **Goose:** Parses schema version drifts if the codebase updated while offline.
- **NemoClaw:** Renders the Splash Screen loading bar to indicate hydration progress.

## 5. Hybrid DB & State Storage Flow
- **Hydration Bridge:** This is the core sync function. The system reads the permanent state from the **Vault** (the Git-backed files) and mathematically translates them into relational tables in **SQLite DB** for fast operational querying.
- **Disconnection Check:** If Model Configurations (which are DB-only) are missing, it blocks the transition to the `Home` screen and forces a `Model Configuration` UI overlay.

## 6. Chat Scenarios (Internal vs External)
- **Internal Chat:** System trace: "System hydrated successfully in 410ms."
- **External Chat:** None.

## 7. Cron & Queue Management
- **Failover / Catch-up Mechanic:** The Initialization logic is the *executor* of all catch-ups. During the final hydration millisecond, it checks all SQLite `last_run` timestamps against `Date.now()`. If gaps exist for crons or queue items, it dispatches the failover routines immediately to the execution engines.
- The catch-up path is idempotent per due occurrence and runs before normal scheduler looping resumes.

## 8. Constraint
- Do not expose any env values, credentials, or secret payloads in pre-auth diagnostics.
- Diagnostics can show key names and statuses only.
