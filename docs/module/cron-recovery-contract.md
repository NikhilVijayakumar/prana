# Cron Recovery and Catch-up Contract

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- Recovery lifecycle and missed-job handling are defined with startup-first ordering.
- Diagnostics contract is documented and connected to startup reporting surfaces.
- Queue-level duplicate prevention and deterministic startup replay ordering are implemented.

## Target State
- Full deterministic replay behavior across repeated restarts and overlapping due windows.
- Strong parity between documented ordering rules and all runtime branches.

## Gap Notes
- Startup recovery counters are implemented, but deeper parity testing across all future cron job classes is still pending.

## Dependencies
- docs/module/startup-orchestrator.md
- docs/module/vault-sync-contract.md
- docs/module/master-spec.md

## Acceptance Criteria
1. Missed and interrupted jobs recover once per due occurrence.
2. Recovery runs before normal scheduler loop every startup cycle.
3. Overlap and failure summaries are consistently reported in diagnostics.
4. Duplicate enqueue attempts for the same due occurrence are prevented durably at the queue store.

## Immediate Roadmap
1. Add broader parity verification for additional cron job families beyond sync pull/push.
2. Keep startup diagnostics aligned with recovery counters as new recovery classes are added.

## Purpose
Define restart-safe cron behavior when app downtime causes missed schedules or interrupted runs.

## Source of Truth
- Persisted cron job store
- Persisted task queue store

## Recovery Lifecycle
1. Load persisted cron jobs.
2. Recover interrupted queue tasks from RUNNING to recoverable status.
3. Detect missed due jobs using nextRunAt and current time.
4. Enqueue MISSED tasks exactly once per due occurrence.
5. Process pending queue in deterministic order.
6. Advance nextRunAt immediately after enqueue to prevent duplication.

## Execution Sources
- scheduler: normal scheduled tick
- manual: explicit run request
- missed/recovery: startup catch-up

## Status Rules
- SUCCESS: job completed.
- FAILED: job execution failed.
- SKIPPED_OVERLAP: job already running, overlapping trigger skipped.

## Ordering Rules
1. Recovery runs before normal periodic timer loop.
2. Sync pull before sync push when both due at startup.
3. Dependency-sensitive jobs can declare priority ordering in future extension.

## Missed Job Policy
1. Missed jobs must run immediately after restart.
2. Catch-up execution should be idempotent where feasible.
3. Repeated startup in short windows must not duplicate already enqueued missed runs.

## Safety and Limits
1. Respect maxRuntimeMs and overlap prevention.
2. Keep retention and telemetry for failed/overlap events.
3. Persist all status transitions for audit.

## Observability
Pre-auth diagnostics or startup report should include:
- total jobs
- enabled jobs
- recovered interrupted task count
- missed jobs detected count
- missed jobs enqueued count
- duplicate prevented count
- processed recovery task count
- failed recovery task count
- failed/skipped overlap summaries

No secret values or sensitive payload content exposed.

Current implementation alignment (2026-03-29):
- These diagnostics are exposed via startup report IPC + pre-auth diagnostics views:
	- `src/main/services/ipcService.ts`
	- `src/main/preload.ts`
	- `src/ui/splash/viewmodel/useSplashViewModel.ts`
	- `src/ui/integration/view/IntegrationVerificationPage.tsx`
- Due-occurrence idempotency is enforced in `src/main/services/governanceLifecycleQueueStoreService.ts`.
