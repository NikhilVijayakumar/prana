# Cache Storage Contract: Prana

## Scope
Defines the SQLite cache domains for the Prana app.

## Contract State
This file defines structure and intended mapping. Domains can be implemented progressively.

## Ownership Rule
Cache ownership is app-scoped through an app registry table.

```sql
CREATE TABLE app_registry (
	app_id INTEGER PRIMARY KEY,
	app_key TEXT NOT NULL UNIQUE,
	app_name TEXT NOT NULL,
	is_active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
```

All app-specific tables should include `app_id INTEGER NOT NULL` with a foreign key to `app_registry(app_id)`.

```sql
FOREIGN KEY (app_id) REFERENCES app_registry(app_id)
```

## Domain Map
| Domain Key | SQLite Area (logical) | Purpose | Vault Mirror |
| --- | --- | --- | --- |
| `registry` | `app_runtime_config`, `app_registry_runtime` | Fast-access runtime registry and policy projections | Required when vault domain exists |
| `knowledge_documents` | `app_documents`, `app_document_meta` | Active-session document access and staging | Required when vault domain exists |
| `email_artifacts` | `app_email_intake`, `app_email_drafts`, `app_email_context` | Intake, triage, draft and context operations | Required when vault domain exists |
| `audit_exports` | `app_audit_events`, `app_audit_exports` | Runtime audit retrieval and export preparation | Required when vault domain exists |
| `session_only` | `app_context_sessions`, `app_context_messages` | Cache-only operational state with no mandatory vault archive | Optional |

## Table Pattern
Each app table follows this ownership pattern:

```sql
CREATE TABLE app_documents (
	id INTEGER PRIMARY KEY,
	app_id INTEGER NOT NULL,
	document_key TEXT NOT NULL,
	payload_json TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (app_id) REFERENCES app_registry(app_id)
);
```

## Cache-Only Allowance
Domains can exist in cache without a vault counterpart. This is valid for transient or non-archival runtime state.

## Mirror Rule for Vault Domains
If a domain is present in vault contract, the same domain key must exist here.

## Implementation Hints
- Map each domain key to concrete tables during implementation PRs.
- Keep domain keys stable even if table names evolve.

## Change Rules
- Add cache domains freely for runtime-only behavior.
- When adding or removing vault-mirrored domains, update `../vault/prana.md` in the same PR.
- Keep `app_registry` as the canonical app ownership table.