# Storage Contract Index

## Purpose
Defines an app-scoped storage contract for the runtime library so multiple host apps can register storage behavior consistently.

## Governance Rule
- Canonical rule file: [rule.md](rule.md)

## Folder Model
- `docs/modules/storage/vault`: App-specific durable storage contracts.
- `docs/modules/storage/cache`: App-specific SQLite cache storage contracts.

Each app should contribute one file per layer using the app key as file name.

Examples:
- `docs/modules/storage/vault/prana.md`
- `docs/modules/storage/cache/prana.md`
- `docs/modules/storage/vault/another-app.md`
- `docs/modules/storage/cache/another-app.md`

## Core Rules
- Cache-only configuration is allowed.
- Vault-only configuration is not allowed.
- If a logical data domain is added to vault, the same logical data domain must also be documented in cache.
- Vault and cache files must use matching domain names so implementation can map one-to-one.
- Vault documentation should describe git-tree structure rooted by app name.
- Cache documentation should describe SQLite tables, with app ownership keyed through an app registry relation.

## Why This Rule Exists
- Runtime operations read and write from SQLite during active sessions.
- Vault acts as durable archive and synchronization source.
- Without mirrored domain mapping, restore, sync, and audit flows become inconsistent.

## PR Contribution Workflow
- Add or update the app file in `storage/cache` first.
- If the app needs durable archive behavior, add matching domains in `storage/vault`.
- Include a short implementation note listing expected services and tables/paths.
- Open a PR with documentation changes first; implementation follows after contract review.

### Required PR Files (when updating storage rules)
- `storage/rule.md`
- `storage/cache/<app>.md`
- `storage/vault/<app>.md` (only when app uses vault)

## Current App Registrations
- Prana cache contract: `storage/cache/prana.md`
- Prana vault contract: `storage/vault/prana.md`

## Implementation Note
The current Prana runtime may not yet use all domains listed in these contracts. These files are normative planning contracts and can be implemented incrementally.