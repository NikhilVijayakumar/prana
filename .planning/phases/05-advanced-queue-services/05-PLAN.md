---
plan_id: 05-advanced-queue-services
wave: 1
depends_on: []
files_modified:
  - src/main/services/taskRegistryService.ts
  - src/main/services/queueOrchestratorService.ts
autonomous: true
---

# Phase 5: Advanced Queue Services - Execution Plan

## Goal
Integrate complex DAG tasks and strict throttling logic. Provide a Dead Letter Queue (DLQ), DAG processing dependencies, and adaptive throttling controls into the existing Queue infrastructure.

## Tasks

<task>
<id>add-dlq-state</id>
<title>Add DLQ task lifecycle state</title>
<read_first>
- src/main/services/taskRegistryService.ts
</read_first>
<action>
1. Locate `export type TaskRegistryStatus` and add `'DLQ'` to the union type.
2. Locate `markTaskFailed` function. In the `const nextStatus` logic, change it so that fallback is `'DLQ'` instead of `'FAILED'`:
`const nextStatus: TaskRegistryStatus = shouldRetry ? 'RETRY_PENDING' : 'DLQ';`
3. Leave `'FAILED'` inside `TaskRegistryStatus` for explicit abortion if needed, but standard limit-exhaustion drops to `DLQ`.
</action>
<acceptance_criteria>
- `TaskRegistryStatus` contains `'DLQ'`
- `markTaskFailed` sets `nextStatus` to `DLQ` when `shouldRetry` evaluates to false.
</acceptance_criteria>
</task>

<task>
<id>implement-dag-dependencies</id>
<title>Implement DAG dependency validation</title>
<read_first>
- src/main/services/taskRegistryService.ts
</read_first>
<action>
1. Locate `claimNextTask` function. Inside the `queueWrite` closure, after pulling `available` tasks, filter out tasks that have unresolved dependencies.
2. Inside the filter or for-loop evaluating the next logical task: Parse `task.payloadMetaJson` using `this.parsePayloadMeta(task.payloadMetaJson)`.
3. Check for the `dependency_task_ids` property (Array of strings).
4. If it exists and length > 0, issue an inline SQL query `SELECT status FROM task_registry WHERE task_id IN (...)` mapped with `?` parameters to fetch the statuses of those dependency tasks.
5. If ANY of those dependent tasks have a status OTHER than `COMPLETED`, skip this task (do not assign lease) and evaluate the next `available` task.
6. The `next` assigned task must either have no dependencies, or all listed dependencies must actively be `COMPLETED`.
</action>
<acceptance_criteria>
- `claimNextTask` logic correctly parses `payloadMetaJson`.
- A database query ensures that `dependency_task_ids` execute dependencies validation before issuing a `RUNNING` lease lock.
</acceptance_criteria>
</task>

<task>
<id>implement-adaptive-throttling</id>
<title>Implement Lane Circuit Breaker</title>
<read_first>
- src/main/services/queueOrchestratorService.ts
</read_first>
<action>
1. Locate `claimNextTask`. 
2. Determine failure-throttling dynamics: if `telemetry.byLane[lane].failed > 5` (Circuit Breaker tripping threshold), effectively cap the `targetParallelism` for that lane to 0 (shut down assignments temporarily) or 1 (throttled trickle state).
3. In `const allowedLanes = (lanes ?? ['CHANNEL', 'MODEL', 'SYSTEM']).filter(`, update the map boundary logic:
```typescript
      const allowedLanes = (lanes ?? ['CHANNEL', 'MODEL', 'SYSTEM']).filter(
        (lane) => {
          // Adaptive throttling: if > 5 failed tasks exist in this lane, throttle concurrency to 0
          const dynamicLimit = laneDepth[lane].failed > 5 ? 0 : PER_LANE_PARALLELISM[lane];
          return laneDepth[lane].running < dynamicLimit;
        }
      );
```
4. Adjust `getHealthCheck` to report the dynamically computed `perLaneParallelism` in the Snapshot response based on the same failure rules.
</action>
<acceptance_criteria>
- `queueOrchestratorService.ts` modifies `allowedLanes` computation to implement a lane-specific `dynamicLimit`.
- Parallelism dynamically scales down correctly when `telemetry.byLane[lane].failed` exceeds 5.
</acceptance_criteria>
</task>

## Verification Strategy
- `npm run typecheck` across node codebase.
- Injecting a task with a known `payload_meta_json` array structure holding a `dependency_task_ids` pointing to a `'QUEUED'` task should safely be bypassed during `claimNextTask`.
- Hitting `getHealthCheck` after faking 6 failed tasks in `MODEL` Lane should mirror the throttling dynamic limit dropping to `0`.

## Must Haves
- DLQ lifecycle integration.
- Directed Acyclic Graph (DAG) task scheduling enforced before assignment.
- Circuit breaker (Adaptive throttling) implemented inside Orchestrator.
