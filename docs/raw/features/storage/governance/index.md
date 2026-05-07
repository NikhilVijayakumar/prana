# Storage Contract Index

## Purpose
Defines an app-scoped storage contract for the runtime library so multiple host apps can register storage behavior consistently.

## Governance Rule
- Canonical rule file: [rule.md](rule.md)

## Folder Model
- `docs/features/storage/governance/vault`: App-specific durable storage contracts.
- `docs/features/storage/governance/cache`: App-specific SQLite cache storage contracts.

Each app should contribute one file per layer using the app key as file name.

Examples:
- `docs/features/storage/governance/vault/prana.md`
- `docs/features/storage/governance/cache/prana.md`
- `docs/features/storage/governance/vault/another-app.md`
- `docs/features/storage/governance/cache/another-app.md`

## Core Rules
- Cache-only configuration is allowed.
- Vault-only configuration is not allowed.
- If a logical data domain is added to vault, the same logical data domain must also be documented in cache.
- Vault and cache files must use matching domain names so implementation can map one-to-one.
- Vault documentation should describe the vault working-root git-tree layout and durable artifacts.
- Cache documentation should describe SQLite tables with ownership model and service/store mapping notes.

## Why This Rule Exists
- Runtime operations read and write from SQLite during active sessions.
- Vault acts as durable archive and synchronization source.
- Without mirrored domain mapping, restore, sync, and audit flows become inconsistent.

## PR Contribution Workflow
- Add or update the app file in `storage/governance/cache` first.
- If the app needs durable archive behavior, add matching domains in `storage/governance/vault`.
- Include a short implementation note listing expected services and tables/paths.
- Open a PR with documentation changes first; implementation follows after contract review.

### Required PR Files (when updating storage rules)
- `storage/governance/rule.md`
- `storage/governance/cache/<app>.md`
- `storage/governance/vault/<app>.md` (only when app uses vault)

## Current App Registrations
- Prana cache contract: `storage/governance/cache/prana.md`
- Prana vault contract: `storage/governance/vault/prana.md`

## Current Prana Domain Keys
- Vault domains: `global_metadata`, `cron_scheduler_state` (mirror key)
- Cache domains: `global_metadata`, `runtime_config`, `sync_state`, `llm_cache_index`, `governance_lifecycle`, `cron_scheduler_state`, `conversation_state`

## Implementation Note
Prana governance contracts are implementation-backed and should be updated when persistence behavior changes in runtime services.