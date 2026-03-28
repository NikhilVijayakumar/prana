# Vault and SQLite Sync Contract

## Purpose
Define first-install and returning-install synchronization semantics between vault archive state and local SQLite projection layers.

## Actors
- Governance repository
- Vault archive workspace
- Local SQLite sync store
- Runtime registry state store

## Modes

### First Install
Conditions:
- Governance repo not cloned locally

Required flow:
1. Verify SSH access.
2. Clone governance repo.
3. Initialize vault workspace.
4. Pull remote vault archive (if present).
5. Hydrate local working vault root.
6. Initialize SQLite stores.
7. Recover interrupted sync tasks.
8. Publish startup status.

### Returning Install
Conditions:
- Governance repo already present

Required flow:
1. Verify SSH access.
2. Pull latest governance repository.
3. Hydrate local vault workspace from remote archive.
4. Validate snapshot integrity.
5. Merge approved runtime state into local SQLite stores if remote is newer.
6. Recover interrupted queue/sync tasks.
7. Publish startup status.

## Data Direction Rules
1. Pull direction at startup: Vault -> SQLite projection.
2. Push direction by approved events: SQLite approved runtime -> Vault archive.
3. Push operations require explicit policy approval when configured.

## Conflict and Freshness Rules
1. If local source version is newer/equal than remote snapshot, skip merge.
2. If remote snapshot is newer and valid, merge to SQLite stores.
3. Integrity failure blocks merge and marks startup degraded/blocked based on policy.

## Queue and Recovery Rules
1. Pending and failed sync tasks are recoverable.
2. RUNNING tasks on restart must transition to FAILED/INTERRUPTED before retry.
3. Recovery runs once per startup cycle before normal scheduling resumes.

## Observability
Startup diagnostics must include:
- pull status
- merge status
- integrity status and issue count
- sync queue summary counts

No secret values should be emitted.

## Migration Compatibility
1. Vault archive envelope magic for new writes: `PRANA_VAULT_V1`.
2. Vault archive reads accept legacy `DHI_VAULT_V1` during migration window.
3. Local model-config encryption uses neutral KDF salt for new writes and supports legacy salt reads.
4. Legacy compatibility window target: through 2026-Q4, with removal planned for Prana v2.0.

## Non-Goals
1. No change to business meaning of approval workflows.
2. No exposure of encrypted payload values or secrets in UI.
3. No bypass of policy controls for vault publish actions.
