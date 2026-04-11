# Phase 5: Advanced Queue Services - Context

## Domain
Integrating robust DAG scheduling, Dead Letter Queues (DLQ), and adaptive throttling into the existing SQLite-backed TaskRegistryService and QueueOrchestratorService.

## Canonical Refs
- `e:\Python\prana\src\main\services\taskRegistryService.ts`
- `e:\Python\prana\src\main\services\queueOrchestratorService.ts`
- `e:\Python\prana\src\main\services\queueService.ts`

## Decisions
The following implementations have been explicitly approved by the operator:

1. **Dead Letter Queue (DLQ) Implementation**
   We will add `'DLQ'` to the `TaskRegistryStatus` enum natively in `taskRegistryService.ts` rather than spinning up a new database table. When a task exhausts its `maxRetries`, it transitions from `FAILED` into `DLQ` instead. Operators can replay these tasks by resetting their status to `QUEUED`.

2. **DAG Task Dependencies**
   We will utilize the existing `payload_meta_json` to define a `dependency_task_ids` string array. The `claimNextTask` SQL selector will be updated to only fetch tasks where `dependency_task_ids` are either empty or all listed upstream task IDs correspond to tasks heavily marked as `COMPLETED`.

3. **Adaptive Throttling Constraints**
   We will implement dynamic scaling of `PER_LANE_PARALLELISM` inside `queueOrchestratorService.ts`. During periods of systemic high failures within a lane, the concurrency cap will scale down (Circuit Breaker approach). As tasks begin succeeding again, the parallelism limit will gradually rebuild up to its default maximum.

## Deferred Ideas
None at this time.
