# Storage Rules

## Purpose
Defines mandatory storage-governance rules so multi-app contracts stay consistent across vault and cache layers.

## Rule 1: Vault Is Git Tree
- Vault is documented as git-style tree structure.
- Vault tree root must be the app name.
- Large folders can be decomposed into subtrees.

Example shape:

```text
vault/
  <app-name>/
    registry/
    knowledge/
    email/
    audit/
    ...
```

## Rule 2: Cache Is SQLite Table Model
- Cache is documented as SQLite tables.
- Each app must be represented in an app registry table.
- App-scoped cache tables must reference app registry with foreign key.

Required ownership model:

```sql
app_registry(app_id PK, app_key UNIQUE, app_name, is_active, created_at, updated_at)

<app_table>(
  ...,
  app_id INTEGER NOT NULL,
  FOREIGN KEY (app_id) REFERENCES app_registry(app_id)
)
```

## Rule 3: Mirror Constraint
- Cache-only app configuration is allowed.
- Vault-only app configuration is not allowed.
- If any domain is added under vault for an app, the same domain key must be defined in cache for that app.

## Rule 4: Domain-Key Stability
- Domain keys are contract identifiers and should remain stable.
- If a key must change, update both vault and cache app files in the same PR.

## Rule 5: PR Contract
- New app integration must submit docs first as a PR.
- Minimum docs for cache-only app:
  - `storage/governance/cache/<app>.md`
- Minimum docs for cache+vault app:
  - `storage/governance/cache/<app>.md`
  - `storage/governance/vault/<app>.md`
- PR should include intended service/table/tree mapping notes.

## Compliance Checklist
- Vault tree uses app-name root.
- Large vault branches use subtrees where needed.
- Cache schema includes `app_registry`.
- App-specific tables include `app_id` foreign key.
- Vault domains are mirrored in cache for vault-enabled apps.

## Rule-to-Evidence Matrix (Prana)
| Rule | Evidence in Governance Docs | Evidence in Runtime Implementation |
| --- | --- | --- |
| Rule 1: Vault Is Git Tree | `storage/governance/vault/prana.md` tree contract and domain map | `src/main/services/vaultRegistryService.ts` (`global.metadata.json`), `src/main/services/vaultMetadataService.ts` (`apps/<app-key>/.metadata.json`) |
| Rule 2: Cache Is SQLite Table Model | `storage/governance/cache/prana.md` (`global_metadata` domain and table definitions) | `src/main/services/syncStoreService.ts` (`app_registry`, `app_vault_blueprint`) |
| Rule 3: Mirror Constraint | Matching domain key `cron_scheduler_state` in both `storage/governance/cache/prana.md` and `storage/governance/vault/prana.md`; `global_metadata` also mirrored | `src/main/services/governanceLifecycleQueueStoreService.ts` for cache authority; vault contract marks mirror-only semantics |
| Rule 4: Domain-Key Stability | Domain key list is explicit in app contracts and shared across cache/vault docs | Sync blueprint table keys in `src/main/services/syncStoreService.ts` (`domain_key` + UNIQUE(app_id, domain_key)) |
| Rule 5: PR Contract | `storage/governance/index.md` required file list and workflow | Documentation-first governance process enforced through PR review; implementation services mapped in app contracts |

## Notes for Reviewers
- `cron_scheduler_state` is mirrored in vault contract for governance consistency, while authoritative runtime state remains in cache.
- Prana currently uses a mixed ownership pattern: normalized app registry in sync store and decentralized app context in other stores.