# Vault Storage Contract: Prana

## Scope
Defines which Prana data is durably archived in vault storage.

## Implementation Baseline
This contract reflects current implementation and active persistence behavior.

## Tree Contract
Vault is documented as git-tree shape rooted by app name.

```text
<vault-working-root>/
  global.metadata.json
  apps/
    <app-key>/
      .metadata.json
  global_metadata/
    app_registry.json
    app_vault_blueprint.json
```

Notes:
- `global.metadata.json` is the global registry index file managed by vault registry service.
- `apps/<app-key>/.metadata.json` is the per-app metadata snapshot managed by vault metadata service.

## Domain Map
| Domain Key | Vault Path Pattern | What Must Be Saved In Vault | Cache Mirror Required |
| --- | --- | --- | --- |
| `global_metadata` | `<vault-working-root>/global.metadata.json`, `<vault-working-root>/apps/<app-key>/.metadata.json`, `<vault-working-root>/global_metadata/**` | Durable app registration and blueprint metadata snapshots used for archive/sync identity | Yes |
| `cron_scheduler_state` | Mirror key only (no required materialized files) | No authoritative scheduler rows in vault; key exists for governance mirror invariants | Yes |

## Domain: global_metadata
This is the only domain that must be materially persisted to vault in current implementation.

Required durable artifacts:
- Global app registry snapshot (`global.metadata.json`)
- Per-app metadata snapshot (`apps/<app-key>/.metadata.json`)

Contracted durable artifacts for export/archive flows:
- Domain ownership blueprint snapshot (`global_metadata/app_vault_blueprint.json`)
- App registry projection snapshot (`global_metadata/app_registry.json`)

## Domain: cron_scheduler_state
This domain key is mirrored for governance consistency with cache contracts.

Current policy:
- Authoritative scheduler state remains in cache (`cron_jobs`, `cron_execution_log`, `cron_locks`).
- Vault materialization is optional and not required for runtime semantics.

## What Is Not Saved In Vault (Current Contract)
The following domains are cache-only and intentionally not vault-backed:
- `runtime_config`
- `sync_state`
- `llm_cache_index`
- `governance_lifecycle`
- `conversation_state`

## Change Rules
- Any new vault domain must be added to `../cache/prana.md` with the same domain key.
- If vault durable artifacts change path shape, keep domain key stable and update mapping notes in the same PR.
- Keep app-key metadata under `apps/<app-key>` stable unless a migration contract is approved.