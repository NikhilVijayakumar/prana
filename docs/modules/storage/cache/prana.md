# Prana Cache Storage Contract

## Domain: cron_scheduler_state

Owner: Prana runtime application.
Persistence: SQLite cache owned by app runtime.

### Table: cron_jobs
- id TEXT PRIMARY KEY
- name TEXT NOT NULL
- expression TEXT NOT NULL
- target TEXT NOT NULL
- status TEXT NOT NULL (active | paused)
- recovery_policy TEXT NOT NULL (SKIP | RUN_ONCE | CATCH_UP)
- retention_days INTEGER NOT NULL
- max_runtime_ms INTEGER NOT NULL
- last_run_at TEXT NULL
- next_run_at TEXT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

Indexes:
- cron_jobs_next_run_idx on (status, next_run_at)

### Table: cron_execution_log
- id TEXT PRIMARY KEY
- job_id TEXT NOT NULL (FK to cron_jobs.id)
- started_at TEXT NOT NULL
- completed_at TEXT NOT NULL
- status TEXT NOT NULL (success | failed | skipped_overlap)
- error_message TEXT NULL
- source TEXT NOT NULL (scheduler | manual | recovery)

Indexes:
- cron_execution_log_job_idx on (job_id, started_at DESC)

### Table: cron_locks
- job_id TEXT PRIMARY KEY (FK to cron_jobs.id)
- lock_acquired_at TEXT NOT NULL
- lock_expires_at TEXT NOT NULL

## Ownership and access
- Write path is restricted to main-process scheduler/store services.
- Renderer accesses scheduler state only through IPC contracts.
- Scheduler state in SQLite is authoritative; legacy JSON schedule file is migration input only.

## Domain key mapping
- cache domain key: cron_scheduler_state
- this key is mirrored in vault mapping documentation as required by storage governance.
