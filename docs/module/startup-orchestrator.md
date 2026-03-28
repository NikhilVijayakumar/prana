# Startup Orchestrator Contract

## Purpose
Define deterministic app-start sequencing before pre-auth navigation, including integration validation, governance repo readiness, vault hydration, SQLite recovery, and cron catch-up.

## Scope
This contract applies to startup flow in the main process and pre-auth startup diagnostics surfaces.

## Stage Order (Canonical)
1. Integration Contract Check
2. Governance Repo Access Check
3. First-Time Clone Check
4. Vault Workspace Initialization
5. Vault Remote Pull and Local Hydration
6. SQLite Recovery and Pending Sync Recovery
7. Cron Scheduler Recovery and Missed Job Catch-up
8. Startup Summary Publication for Renderer

## Stage Definitions

### 1. Integration Contract Check
Input:
- Required runtime keys
- Required renderer keys

Output:
- Key-level status only (AVAILABLE, MISSING, INVALID)
- No key values exposed

Failure behavior:
- Startup enters blocked pre-auth diagnostics mode.
- Login routing remains blocked.

### 2. Governance Repo Access Check
Input:
- repo URL and path config
- SSH environment

Output:
- SSH verified status
- repo ready status
- clone-needed determination

Failure behavior:
- Vault/sync stages skipped.
- Startup report marks blocking reason.

### 3. First-Time Clone Check
Input:
- governance repo path state

Output:
- clonedNow true/false
- clone error details if failure

Failure behavior:
- Startup report blocks transition to login.

### 4. Vault Workspace Initialization
Input:
- vault encryption runtime config
- governance repo path

Output:
- working vault root prepared
- schema/index baseline ensured

Failure behavior:
- Startup report blocks transition to login.

### 5. Vault Remote Pull and Local Hydration
Input:
- governance repository and vault archive

Output:
- pull status
- merge status
- integrity summary

Failure behavior:
- Startup report blocks transition to login for mandatory vault failures.

### 6. SQLite Recovery and Pending Sync Recovery
Input:
- hybrid sync sqlite queue state

Output:
- number of recovered interrupted tasks
- pending queue status snapshot

Failure behavior:
- Startup report marks degraded mode; may continue if policy allows.

### 7. Cron Scheduler Recovery and Missed Job Catch-up
Input:
- persisted cron schedule table
- task queue status and due windows

Output:
- interrupted tasks recovered
- missed runs enqueued and processed by policy

Failure behavior:
- Startup report marks degraded mode.

### 8. Startup Summary Publication for Renderer
Output contract:
- stage-by-stage status
- overall status: READY | DEGRADED | BLOCKED
- non-sensitive diagnostics only

## Security Rules
1. Do not expose secret values in startup diagnostics.
2. Show key names and status labels only.
3. Keep pre-auth telemetry redacted for sensitive fields.

## Idempotency Rules
1. Startup orchestrator can be called repeatedly; duplicate execution must not corrupt state.
2. Cron catch-up must not enqueue duplicate due jobs repeatedly within same tick window.
3. Sync recovery must transition RUNNING tasks safely to recoverable states before retry.

## Required IPC Surface
- app:get-startup-status
- app:get-integration-status

## Startup Success Gate
Transition to login or splash completion requires:
1. Integration stage success.
2. Governance repo ready.
3. Vault init/hydration success.

If any required gate fails, remain in pre-auth diagnostics screen.
