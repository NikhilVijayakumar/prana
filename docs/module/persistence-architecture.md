# Persistence Architecture

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- SQLite already stores runtime-approved onboarding state, sync queue state, cron queue state, and several operational caches.
- Vault remains the durable encrypted archive and startup pull source for sync snapshots.
- Multiple runtime surfaces still read directly from runtime props or vault-backed files, so locked-by-default cold-vault posture is not yet fully enforced.

## Target State
- SQLite is the exclusive runtime read layer for application state and local-only configuration.
- Vault is cold storage by default: opened only for startup sync or explicit write-back events, then relocked.
- Runtime configuration props seed SQLite only during bootstrap/first-run; downstream features must not read raw props directly.

## Gap Notes
- The write-through cache model is only partially implemented today.
- A compatibility period is still required because some Dhi/Vidhan-era services still depend on direct runtime props or vault working-root reads.

## Dependencies
- docs/module/vault-sync-contract.md
- docs/module/startup-orchestrator.md
- docs/module/props-config-principle.md

## Acceptance Criteria
1. Runtime features read configuration and approved registry state through SQLite provider services only.
2. Vault open/sync/close lifecycle is tracked globally and defaults to locked state outside explicit sync windows.
3. Local-only configuration never syncs to Vault payloads.
4. SQLite sync-pending flags remain durable when Vault write-back or git push fails.

## Immediate Roadmap
1. Seed local runtime config snapshot into SQLite during startup bootstrap.
2. Route more runtime consumers through `SqliteDataProvider`.
3. Replace remaining hot-vault read paths with SQLite-backed projections.
4. Enforce actual relock after startup sync once hot-vault gaps are closed.

## Lifecycle Contract

### Boot: Sync-and-Lock
1. Validate runtime props.
2. Seed local-only runtime config into SQLite if empty.
3. Open Vault for startup sync.
4. Pull and validate remote registry snapshot.
5. Merge into SQLite only when remote snapshot is newer and valid.
6. Publish sync decision to startup diagnostics.
7. Return Vault lifecycle to locked state when feature parity allows.

### Runtime
1. UI and agents read from SQLite-backed provider services.
2. Mutations write to SQLite first.
3. Records awaiting durable archive commit must remain marked pending until Vault write-back succeeds.

### Write-Back
1. Explicit save flow unlocks Vault.
2. Pending SQLite changes are committed in batch.
3. Vault archive and git push complete or pending flags remain intact.
4. Vault is relocked and lifecycle status updated.

## Current Implementation Alignment (2026-03-29)
- Local runtime config seed scaffolding:
  - `src/main/services/sqliteConfigStoreService.ts`
  - `src/main/services/sqliteDataProvider.ts`
- Vault lifecycle state scaffolding:
  - `src/main/services/vaultLifecycleManager.ts`
- Startup bootstrap seeding:
  - `src/main/services/startupOrchestratorService.ts`
- Startup sync decision reporting:
  - `src/main/services/syncProviderService.ts`
  - `src/main/services/startupOrchestratorService.ts`

## Security Posture
1. Vault is the encrypted durable source of truth.
2. SQLite is the hot read cache and local operational state layer.
3. Secrets and local endpoints are allowed in local SQLite config, but must not be included in Vault sync payloads.
4. Any future failure to relock Vault after an explicit lifecycle close must be treated as critical.
