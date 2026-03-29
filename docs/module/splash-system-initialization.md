# Setup & Config: System Initialization - Atomic Feature Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- Startup responsibilities are documented and implementation sync notes identify distributed ownership.
- Pre-auth diagnostics and recovery initialization exist with partial consolidation.

## Target State
- Fully unified startup orchestration ownership with deterministic stage boundaries and replay reporting.
- Consistent startup diagnostics across integration, vault hydration, sync recovery, and cron catch-up.

## Gap Notes
- Startup ownership is still spread across bootstrap and service layers while consolidation progresses under orchestrator contracts.

## Dependencies
- docs/module/startup-orchestrator.md
- docs/module/vault-sync-contract.md
- docs/module/cron-recovery-contract.md

## Acceptance Criteria
1. Startup stage ownership is explicit and deterministic.
2. Recovery summaries are visible and policy-safe in pre-auth diagnostics.
3. Startup transition to protected flows respects required gates.

## Immediate Roadmap
1. Complete startup consolidation to orchestrator-led stage control.
2. Align splash diagnostics with full sync and cron recovery counters.

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
1. Startup concerns are distributed across main bootstrap, IPC init side effects, sync provider splash init, and splash/auth checks.
2. Pre-auth integration diagnostics exist, but full startup stage reporting is still being consolidated.
3. Cron missed-run recovery exists in scheduler initialization, but startup diagnostics do not yet expose complete cron recovery summaries.
4. Vault pull/hydration and SQLite sync recovery exist, but deterministic stage ownership is being moved to a unified orchestrator.

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

## 8. Constraint
- Do not expose any env values, credentials, or secret payloads in pre-auth diagnostics.
- Diagnostics can show key names and statuses only.
