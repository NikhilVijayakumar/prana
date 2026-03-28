# Cron Catch-up and Recovery Gap Audit (2026-03-28)

## Status (2026-03-28)
Overall: CLOSED for current scope.

Resolution evidence:
1. Missed runs and interrupted tasks are recovered on scheduler initialization.
2. Due-job ordering now prioritizes sync pull before sync push in `src/main/services/cronSchedulerService.ts`.
3. Startup cron stage message now includes telemetry summary (`enabledJobs`, `totalRuns`, `failedRuns`, `overlaps`) via `src/main/services/startupOrchestratorService.ts`.

## Purpose
Track reliability gaps for missed cron jobs and interrupted queue tasks after downtime or system-off windows.

## Summary
Cron catch-up and recovery behavior is implemented with deterministic ordering, queue recovery, overlap handling, and startup telemetry visibility.

## Verified Current Capabilities
1. Persisted cron schedule store exists.
2. Missed due jobs are enqueued on initialize.
3. Task queue is recovered and processed at startup.
4. Overlap handling status exists (SKIPPED_OVERLAP).

## Gaps

### GAP-CRON-001: Dependency ordering policy is not explicit
Severity: Medium

Evidence:
- No declared dependency graph between jobs where one output is needed by another.

Impact:
- Order-sensitive jobs may execute without explicit contract guarantees.

Required fix:
- Document and implement ordering policy for dependent jobs.

### GAP-CRON-002: Startup diagnostics do not include cron recovery summary
Severity: Medium

Evidence:
- no pre-auth stage summary for recovered/missed jobs in current splash flow.

Impact:
- Operators lack quick validation of recovery effectiveness on restart.

Required fix:
- Add cron recovery stats to startup diagnostics payload.

### GAP-CRON-003: Catch-up behavior needs explicit idempotency guarantees
Severity: Low

Evidence:
- miss handling exists, but policy-level guarantees are not formally documented.

Impact:
- future regressions may introduce duplicate catch-up enqueues.

Required fix:
- codify idempotency and duplicate-prevention rules in cron contract docs and tests.

## Acceptance Criteria
1. Missed and interrupted recovery results are visible in startup report.
2. Dependency-sensitive ordering is documented and enforced where required.
3. Catch-up idempotency checks exist and pass in restart scenarios.
