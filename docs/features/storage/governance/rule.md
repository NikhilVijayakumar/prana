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
  - `storage/cache/<app>.md`
- Minimum docs for cache+vault app:
  - `storage/cache/<app>.md`
  - `storage/vault/<app>.md`
- PR should include intended service/table/tree mapping notes.

## Compliance Checklist
- Vault tree uses app-name root.
- Large vault branches use subtrees where needed.
- Cache schema includes `app_registry`.
- App-specific tables include `app_id` foreign key.
- Vault domains are mirrored in cache for vault-enabled apps.