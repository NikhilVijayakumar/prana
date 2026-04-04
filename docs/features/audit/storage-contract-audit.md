# Storage Contract Audit

## Scope
Verifies that app-level storage contracts follow the required cache/vault mapping policy.

## Contract Under Review
- `docs/modules/storage/index.md`
- `docs/modules/storage/cache/prana.md`
- `docs/modules/storage/vault/prana.md`

## Findings
- The storage tree is now app-scoped and supports multi-app extension.
- Cache-only contract is explicitly allowed.
- Vault-only contract is explicitly disallowed.
- Vault domain keys are required to exist in cache with one-to-one key matching.
- Vault contract now documents app-rooted git-tree structure with subtree support.
- Cache contract now documents SQLite table model with `app_registry` ownership and `app_id` foreign key pattern.

## Current Prana Status
- Prana has both cache and vault contract files in place.
- Current domain keys are mirrored across both files: `registry`, `knowledge_documents`, `email_artifacts`, `audit_exports`.
- Cache also defines an extra cache-only domain: `session_only`.
- Prana vault contract is rooted at `vault/prana/**`.
- Prana cache contract defines registry-first app ownership for tables.

## Risks
- Future PRs can drift if new vault keys are added without corresponding cache keys.
- Domain-key renames can silently break mapping unless both files change together.

## Review Checklist For New App PRs
- App includes `storage/cache/<app>.md`.
- If app includes `storage/vault/<app>.md`, every vault key exists in cache file.
- Domain keys remain stable and semantic.
- PR description explains planned implementation services/tables/paths.
- Vault docs use app-rooted tree and subtree decomposition where needed.
- Cache docs define app ownership through `app_registry` + foreign keys in app tables.

## Recommendation
- Keep this audit as a required check in docs-first storage PR review.