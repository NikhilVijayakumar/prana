# Cron Recovery and Catch-up Contract

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
2. Sync pull before sync push when both due at startup (recommended policy).
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
- missed jobs enqueued count
- failed/skipped overlap summaries

No secret values or sensitive payload content exposed.
