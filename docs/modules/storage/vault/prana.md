# Prana Vault Storage Mapping

## Domain key mirror

This document mirrors cache domain keys required by storage governance.

- vault domain key: cron_scheduler_state
- cache domain key: cron_scheduler_state

## Mapping intent

The cron scheduler runtime state is persisted in SQLite cache tables and mirrored here as an ownership contract key.

Current implementation notes:
- Authoritative runtime state: cache (SQLite)
- Vault materialization: not required for scheduler execution semantics
- Mirror key exists to satisfy cross-domain ownership mapping invariants

## Responsible modules
- Scheduler runtime: src/main/services/cronSchedulerService.ts
- Scheduler storage adapter: src/main/services/governanceLifecycleQueueStoreService.ts
