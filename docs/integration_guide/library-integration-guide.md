# Prana Library Integration Guide

This guide is for teams integrating Prana as a runtime library inside another Electron application.

The integration standard is docs-first and contract-driven. Before implementation, define your app contract in the atomic docs tree and pass storage governance checks.

## Source of Truth

Use these documents as canonical references:

- [../modules/index.md](../features/index.md)
- [../modules/storage/rule.md](../features/storage/governance/rule.md)
- [../modules/storage/index.md](../features/storage/governance/index.md)
- [../modules/audit/storage-contract-audit.md](../features/audit/storage-contract-audit.md)

## Integration Model

Prana is integrated as a runtime core with four main surfaces:

1. Bootstrap and readiness orchestration.
2. IPC bridge between renderer and main process.
3. Storage contracts (vault tree + SQLite cache tables).
4. Feature modules (orchestration, context, channels, email, audit).

Your host app should treat Prana as a generic runtime library. App-specific identity and storage ownership must be represented through app contracts, not hardcoded behavior.

## Required Storage Governance

All integrating apps must follow these rules:

1. Vault documentation uses git-style tree structure.
2. Vault tree root is the app name.
3. Cache documentation uses SQLite table model.
4. Cache ownership is represented by `app_registry` and `app_id` foreign-key relationships.
5. Cache-only app configuration is allowed.
6. Vault-only configuration is not allowed.
7. If a domain exists in vault, the same domain key must exist in cache for that app.

See full rule set in [../modules/storage/rule.md](../features/storage/governance/rule.md).

## Docs-First Onboarding Steps For A New App

### Step 1: Register storage contracts

Create:

- `docs/modules/storage/cache/<app>.md`
- `docs/modules/storage/vault/<app>.md` only if your app needs durable vault storage

### Step 2: Define cache ownership

In your cache contract, define table ownership via:

- `app_registry(app_id, app_key, app_name, ... )`
- `app_id` foreign key on app-specific tables

### Step 3: Define vault tree

In your vault contract, define app-rooted tree paths, for example:

```text
vault/
  <app-name>/
    registry/
    knowledge/
    email/
    audit/
```

Add subtrees when folder size or complexity grows.

### Step 4: Mirror domain keys

For each vault domain key, add the same domain key in the cache contract.

### Step 5: Submit docs PR first

Implementation begins only after contract review passes.

## Minimal Contract Templates

### Cache Contract Skeleton

```md
# Cache Storage Contract: <App>

## Ownership Rule
Uses app_registry and app_id foreign key in app tables.

## Domain Map
| Domain Key | SQLite Area (logical) | Purpose | Vault Mirror |
| --- | --- | --- | --- |
| `registry` | `app_runtime_config` | Runtime config projections | Required when vault exists |
| `session_only` | `app_context_sessions` | Runtime-only cache state | Optional |
```

### Vault Contract Skeleton

```md
# Vault Storage Contract: <App>

## Tree Contract
vault/
  <app>/
    registry/
    knowledge/

## Domain Map
| Domain Key | Vault Path Pattern | Purpose | Cache Mirror Required |
| --- | --- | --- | --- |
| `registry` | `vault/<app>/registry/**` | Durable config approvals | Yes |
```

## Runtime Integration Checklist

1. Host splash/bootstrap waits for Prana readiness report before opening protected screens.
2. Renderer uses preload-exposed APIs only; no direct Node access from UI.
3. Startup errors are surfaced as structured states in UI.
4. Degraded storage states are surfaced to users (not silent failures).
5. Background schedulers are initialized after configuration validation.
6. Shutdown path allows service disposal and store flush.

## Change Management Rules

1. Domain keys are stable identifiers; rename only with coordinated cache + vault updates in one PR.
2. New storage domains require audit update in [../modules/audit/storage-contract-audit.md](../features/audit/storage-contract-audit.md).
3. Feature docs belong in [../modules](../features); this file is an integration playbook, not a feature spec.

## What To Avoid

1. Vault-only app setup.
2. App-specific table groups without app ownership key.
3. App-specific runtime assumptions added to generic contracts.
4. Implementing services before storage/docs contracts are reviewed.

## References

- Atomic overview: [../modules/index.md](../features/index.md)
- Storage rules: [../modules/storage/rule.md](../features/storage/governance/rule.md)
- Storage contract index: [../modules/storage/index.md](../features/storage/governance/index.md)
- Prana cache contract example: [../modules/storage/cache/prana.md](../features/storage/governance/cache/prana.md)
- Prana vault contract example: [../modules/storage/vault/prana.md](../features/storage/governance/vault/prana.md)
