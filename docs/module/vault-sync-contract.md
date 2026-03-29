# Vault and SQLite Sync Contract

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- First-install and returning-install flows are documented with pull and merge semantics.
- Startup diagnostics expose sync outcomes through startup and integration surfaces.
- Startup sync returns explicit install mode, pull status, merge status, and integrity status.
- SQLite lineage and transactional sync scaffolding now exist for approved runtime persistence.
- Vault storage may be mounted through a dedicated encrypted virtual drive separate from DB storage.

## Target State
- Deterministic conflict and freshness handling across all startup and runtime sync paths.
- Clear merge decision visibility and integrity failure behavior in every branch.

## Gap Notes
- Startup merge decisions are explicit, but fully locked-by-default vault operation and full-entity transactional push adoption are still in migration.

## Dependencies
- docs/module/startup-orchestrator.md
- docs/module/cron-recovery-contract.md
- docs/module/vault-folder-structure.md

## Acceptance Criteria
1. Install mode detection drives correct startup sync branch.
2. Integrity failures never merge invalid snapshots.
3. Recovery transitions for interrupted tasks are idempotent.
4. Remote-first deletion and mirror rebuild flows keep SQLite aligned with Vault state during splash reconciliation.

## Immediate Roadmap
1. Extend transactional sync from approved runtime state to remaining sync-eligible entities.
2. Enforce cold-vault startup closeout once remaining hot-vault consumers are migrated.

## Purpose
Define first-install and returning-install synchronization semantics between vault archive state and local SQLite projection layers.

## Actors
- Governance repository
- Vault archive workspace
- Local SQLite sync store
- Runtime registry state store
- Separate DB and Vault encrypted virtual-drive surfaces when enabled

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
6. Purge or rebuild mirrored SQLite runtime state when Vault-side deletion/mirroring requires it.
6. Recover interrupted queue/sync tasks.
7. Publish startup status.

## Data Direction Rules
1. Pull direction at startup: Vault -> SQLite projection.
2. Push direction by approved events: SQLite approved runtime -> Vault archive.
3. Push operations require explicit policy approval when configured.
4. Local auth/recovery SQLite state is excluded from this sync contract and never syncs to Vault.

## Conflict and Freshness Rules
1. If local source version is newer/equal than remote snapshot, skip merge.
2. If remote snapshot is newer and valid, merge to SQLite stores.
3. Integrity failure blocks merge and marks startup degraded/blocked based on policy.
4. If the remote snapshot disappears or is missing mirrored files relative to local cache, splash reconciliation may purge and rebuild the mirrored SQLite state.

## Queue and Recovery Rules
1. Pending and failed sync tasks are recoverable.
2. RUNNING tasks on restart must transition to FAILED/INTERRUPTED before retry.
3. Recovery runs once per startup cycle before normal scheduling resumes.
4. Approved runtime lineage in SQLite is tracked with `SYNCED`, `PENDING_UPDATE`, `PENDING_DELETE`, and `LOCAL_ONLY` states.

## Observability
Startup diagnostics must include:
- pull status
- merge status
- integrity status and issue count
- install mode
- sync queue summary counts

No secret values should be emitted.

Current implementation alignment (2026-03-29):
- Diagnostics are surfaced through startup status publication and integration verification surfaces:
	- `src/main/services/ipcService.ts` (`app:get-startup-status`)
	- `src/main/preload.ts` bridge
	- `src/ui/splash/viewmodel/useSplashViewModel.ts`
	- `src/ui/integration/view/IntegrationVerificationPage.tsx`
- There is currently no dedicated standalone `SyncHealthWidget` surface in `src/ui`; observability is currently startup-report driven.
- Transactional sync scaffolding currently centers on approved runtime state, sync lineage, transaction coordination, and mirror reconciliation in main-process services.

## Migration Compatibility
1. Vault archive envelope magic for new writes: `PRANA_VAULT_V1`.
2. Vault archive reads accept legacy `DHI_VAULT_V1` during migration window.
3. Local model-config encryption uses neutral KDF salt for new writes and supports legacy salt reads.
4. Legacy compatibility window target: through 2026-Q4, with removal planned for Prana v2.0.

## Non-Goals
1. No change to business meaning of approval workflows.
2. No exposure of encrypted payload values or secrets in UI.
3. No bypass of policy controls for vault publish actions.
