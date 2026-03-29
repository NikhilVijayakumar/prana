# Data Integrity Protocol

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Purpose
Define the stage-review-commit lifecycle for create, update, and delete operations between SQLite and the encrypted Vault.

## Current State
- SQLite lineage can now represent pending update/delete/local-only states for approved runtime data.
- Startup sync can detect remote-first deletion and mirror SQLite down to Vault state.
- Transaction coordination and audit logging are scaffolded for approved runtime state.

## Target State
- All sync-eligible CRUD operations are staged in SQLite first.
- User review gates every durable Vault commit.
- Successful Vault push is the only condition that clears pending SQLite mutation state.

## Dependencies
- docs/module/persistence-architecture.md
- docs/module/sync-protocol.md
- docs/module/vault-sync-contract.md

## Acceptance Criteria
1. UI deletions become `PENDING_DELETE`, not immediate hard-delete.
2. Remote Vault deletions discovered on splash purge mirrored SQLite state.
3. Commit approval runs inside a single open-commit-push-close window.
4. Pending states survive interruptions until final durable success.
5. Every pending-to-synced or pending-to-delete transition is audit logged.

## Stage-Review-Commit Flow

### Stage
1. Create or update sets `sync_status = PENDING_UPDATE`.
2. Delete sets `sync_status = PENDING_DELETE`.
3. Local-only settings use `sync_status = LOCAL_ONLY`.

### Review
1. Director/Admin reviews staged changes in a sync dashboard or approval surface.
2. Approval identity must be attached to the commit attempt.

### Commit
1. Unlock Vault lifecycle.
2. Process pending changes sequentially.
3. Push Vault archive to remote.
4. Mark SQLite state `SYNCED` only after push succeeds.
5. Remove SQLite state only after approved delete succeeds.
6. Relock Vault lifecycle immediately.

## Remote-First Deletion Rule
If a previously mirrored Vault snapshot disappears or loses files during splash reconciliation, SQLite must mirror that deletion:
- purge synced mirrored runtime state
- clear cached remote snapshot
- log the mirror action

## Crash Recovery Rule
If the app stops after a Vault mutation but before successful push finalization:
- SQLite state remains pending
- next startup or commit attempt retries finalization

## Current Implementation Alignment (2026-03-29)
- Diff-based Vault mirror detection:
  - `src/main/services/diffEngine.ts`
- Pending state transaction coordinator:
  - `src/main/services/transactionCoordinator.ts`
- Audit trail hooks:
  - `src/main/services/auditLogService.ts`
- Remote-first deletion handling:
  - `src/main/services/syncProviderService.ts`

## Open Gaps
1. Current delete staging is applied to approved runtime state scaffolding first, not every CRUD entity.
2. There is not yet a dedicated sync dashboard UI wired to these review surfaces.
3. Vault archive mutation is still archive-level, so per-file delete verification remains a later step.
