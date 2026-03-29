# Sync Protocol

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Purpose
Define the transactional synchronization handshake between the SQLite runtime cache and the encrypted Vault archive.

## Current State
- Snapshot-based pull and push flows exist.
- Queue recovery and startup merge decisions are implemented.
- SQLite lineage tracking for sync-eligible runtime state is now scaffolded, but not yet expanded to every domain table.

## Target State
- Every sync-eligible SQLite record carries lineage metadata.
- Push flows commit to Vault transactionally and flip SQLite state to `SYNCED` only after durable success.
- Reconciliation can rebuild SQLite state from Vault after local deletion.

## Dependencies
- docs/module/vault-sync-contract.md
- docs/module/persistence-architecture.md
- docs/module/startup-orchestrator.md

## Acceptance Criteria
1. Sync-eligible SQLite records track `sync_status`, `vault_hash`, and `last_modified`.
2. Successful Vault push is the only point where pending SQLite state can transition to `SYNCED`.
3. Integrity failures block merge and preserve local pending work.
4. Local cache deletion can be reconstructed from valid Vault state.

## SQLite Lineage Model

### Sync Status
- `SYNCED`: SQLite and Vault agree on the durable representation.
- `PENDING_UPDATE`: SQLite has local mutations not yet durably committed to Vault.
- `PENDING_DELETE`: SQLite has a local delete intent waiting for Vault commit.
- `LOCAL_ONLY`: Data must stay local and never sync to Vault.

### Required Lineage Fields
- `sync_status`
- `vault_hash`
- `last_modified`
- `payload_hash`

## Splash Reconciliation Flow
1. Detect install mode.
2. Seed local-only runtime config into SQLite when needed.
3. Open Vault for startup sync.
4. Pull remote snapshot.
5. Validate snapshot integrity.
6. Resolve conflict using `last_modified`, local `sync_status`, and integrity result.
7. Import valid newer Vault state or preserve newer/pending local state.
8. Return lifecycle target to locked state after sync window.

## Commit-and-Push Flow
1. Query SQLite lineage for non-`SYNCED` records.
2. Open Vault lifecycle.
3. Materialize pending updates/deletes into Vault representation.
4. Verify written representation and compute `vault_hash`.
5. Push remote commit.
6. Mark SQLite lineage `SYNCED` only after push succeeds.
7. Close and relock Vault lifecycle.

## Failure Rules
1. If push fails, SQLite records remain pending.
2. If app exits during `RUNNING` queue work, queue items recover on next startup.
3. If Vault integrity fails, merge is blocked and no local pending changes are cleared.
4. If SQLite is missing but Vault is valid, reconstruct from Vault.

## Current Implementation Alignment (2026-03-29)
- Lineage storage:
  - `src/main/services/syncStoreService.ts`
- Conflict resolution scaffold:
  - `src/main/services/conflictResolver.ts`
- Transactional sync engine scaffold:
  - `src/main/services/syncEngineService.ts`
- Runtime state lineage updates:
  - `src/main/services/registryRuntimeStoreService.ts`

## Open Gaps
1. Record-level lineage is currently applied to approved runtime state first, not every sync-eligible table.
2. `PENDING_DELETE` is specified but not yet wired into all UI deletion flows.
3. Vault push currently still operates at archive level, so per-record verification is staged rather than fully realized.
