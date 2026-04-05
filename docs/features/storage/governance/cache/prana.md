# Cache Storage Contract: Prana

## Scope
Defines the authoritative cache persistence contract used by Prana runtime services.

## Implementation Baseline
This contract reflects current implementation, not aspirational design.

Primary stores:
- `hybrid-sync.sqlite` (sync store)
- `runtime-config.sqlite` (runtime configuration store)
- `governance-lifecycle-queue.sqlite` (scheduler and lifecycle queue store)
- `conversation-store.sqlite` (conversation runtime store)

## Domain Allocation Summary
| Domain Key | Persisted In Cache | Persisted In Vault | Notes |
| --- | --- | --- | --- |
| `global_metadata` | Yes | Yes | Cache source for registry/blueprint, durable snapshot in vault |
| `runtime_config` | Yes | No | Environment/bootstrap runtime configuration snapshot |
| `sync_state` | Yes | No | Operational sync state and transient synchronization lineage |
| `llm_cache_index` | Yes | No | Prompt/response cache and embedding index |
| `governance_lifecycle` | Yes | No | Lifecycle drafts, cron proposals, task queue and audit trail |
| `cron_scheduler_state` | Yes | Mirror key only | Authoritative scheduler state remains in cache |
| `conversation_state` | Yes | No | Channel and in-app conversation state |

## Domain: global_metadata
Store: `hybrid-sync.sqlite`

### Table: app_registry
- app_id INTEGER PRIMARY KEY AUTOINCREMENT
- app_key TEXT UNIQUE NOT NULL
- app_name TEXT NOT NULL
- is_active INTEGER NOT NULL DEFAULT 1
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### Table: app_vault_blueprint
- blueprint_id INTEGER PRIMARY KEY AUTOINCREMENT
- app_id INTEGER NOT NULL (FK to app_registry.app_id)
- domain_key TEXT NOT NULL
- relative_path TEXT NOT NULL
- is_required INTEGER NOT NULL DEFAULT 1
- last_synced_at TEXT NULL
- updated_at TEXT NOT NULL

Indexes and constraints:
- UNIQUE(app_id, domain_key)

## Domain: runtime_config
Store: `runtime-config.sqlite`

### Table: runtime_config_meta
- key TEXT PRIMARY KEY
- payload_json TEXT NOT NULL
- updated_at TEXT NOT NULL

Usage notes:
- Snapshot key currently used by runtime config service: `runtime_config_snapshot`
- Data is reseedable from runtime props and therefore cache-only

## Domain: sync_state
Store: `hybrid-sync.sqlite`

### Table: sync_meta
- key TEXT PRIMARY KEY
- payload_json TEXT NOT NULL
- updated_at TEXT NOT NULL

### Table: sync_queue
- task_id TEXT PRIMARY KEY
- reason TEXT NOT NULL
- payload_json TEXT NOT NULL
- status TEXT NOT NULL
- attempts INTEGER NOT NULL
- last_error TEXT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### Table: sync_lineage
- record_key TEXT PRIMARY KEY
- table_name TEXT NOT NULL
- sync_status TEXT NOT NULL
- vault_hash TEXT NULL
- last_modified TEXT NOT NULL
- payload_hash TEXT NOT NULL
- updated_at TEXT NOT NULL

### Table: sync_runtime_lock
- lock_key TEXT PRIMARY KEY
- owner TEXT NOT NULL
- acquired_at TEXT NOT NULL
- expires_at TEXT NULL

## Domain: llm_cache_index
Store: `hybrid-sync.sqlite`

### Table: prompt_cache
- cache_key TEXT PRIMARY KEY
- prompt TEXT NOT NULL
- response TEXT NOT NULL
- model_provider TEXT NOT NULL
- created_at TEXT NOT NULL
- expires_at TEXT NULL
- hit_count INTEGER NOT NULL
- last_used_at TEXT NOT NULL

### Table: embedding_index
- embedding_id TEXT PRIMARY KEY
- namespace TEXT NOT NULL
- content_hash TEXT NOT NULL
- vector_json TEXT NOT NULL
- metadata_json TEXT NOT NULL
- updated_at TEXT NOT NULL

## Domain: governance_lifecycle
Store: `governance-lifecycle-queue.sqlite`

### Table: lifecycle_drafts
- draft_id TEXT PRIMARY KEY
- entity_type TEXT NOT NULL
- entity_id TEXT NOT NULL
- proposed_json TEXT NOT NULL
- status TEXT NOT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- reviewed_at TEXT NULL
- reviewer TEXT NULL
- review_note TEXT NULL

### Table: cron_proposals
- proposal_id TEXT PRIMARY KEY
- job_id TEXT NOT NULL
- name TEXT NOT NULL
- expression TEXT NOT NULL
- retention_days INTEGER NOT NULL
- max_runtime_ms INTEGER NOT NULL
- status TEXT NOT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- reviewed_at TEXT NULL
- reviewer TEXT NULL
- review_note TEXT NULL

### Table: task_queue
- task_id TEXT PRIMARY KEY
- job_id TEXT NOT NULL
- job_name TEXT NOT NULL
- scheduled_for TEXT NOT NULL
- source TEXT NOT NULL
- status TEXT NOT NULL
- attempt_count INTEGER NOT NULL
- last_error TEXT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### Table: task_audit_log
- id INTEGER PRIMARY KEY AUTOINCREMENT
- event_type TEXT NOT NULL
- job_id TEXT NULL
- task_id TEXT NULL
- details TEXT NOT NULL
- created_at TEXT NOT NULL

## Domain: cron_scheduler_state
Store: `governance-lifecycle-queue.sqlite`

### Table: cron_jobs
- id TEXT PRIMARY KEY
- name TEXT NOT NULL
- expression TEXT NOT NULL
- target TEXT NOT NULL
- status TEXT NOT NULL (active | paused)
- recovery_policy TEXT NOT NULL (SKIP | RUN_ONCE | CATCH_UP)
- retention_days INTEGER NOT NULL
- max_runtime_ms INTEGER NOT NULL
- last_run_at TEXT NULL
- next_run_at TEXT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### Table: cron_execution_log
- id TEXT PRIMARY KEY
- job_id TEXT NOT NULL (FK to cron_jobs.id)
- started_at TEXT NOT NULL
- completed_at TEXT NOT NULL
- status TEXT NOT NULL (success | failed | skipped_overlap)
- error_message TEXT NULL
- source TEXT NOT NULL (scheduler | manual | recovery)

### Table: cron_locks
- job_id TEXT PRIMARY KEY (FK to cron_jobs.id)
- lock_acquired_at TEXT NOT NULL
- lock_expires_at TEXT NOT NULL

Indexes:
- cron_jobs_next_run_idx on (status, next_run_at)
- cron_execution_log_job_idx on (job_id, started_at DESC)

## Domain: conversation_state
Store: `conversation-store.sqlite`

### Table: conversations
- conversation_id TEXT PRIMARY KEY
- conversation_key TEXT NOT NULL UNIQUE
- room_key TEXT NOT NULL
- app_id TEXT NOT NULL
- channel TEXT NOT NULL
- mode TEXT NOT NULL
- operator_canonical_id TEXT NOT NULL
- operator_display_name TEXT NULL
- target_persona_id TEXT NULL
- participant_agent_ids_json TEXT NOT NULL
- provider_room_id TEXT NULL
- metadata_json TEXT NOT NULL
- last_message_at TEXT NOT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### Table: conversation_messages
- message_id TEXT PRIMARY KEY
- conversation_id TEXT NOT NULL
- session_key TEXT NOT NULL
- role TEXT NOT NULL
- actor_id TEXT NULL
- actor_name TEXT NULL
- content TEXT NOT NULL
- channel TEXT NOT NULL
- status TEXT NOT NULL
- reply_to_message_id TEXT NULL
- work_order_id TEXT NULL
- metadata_json TEXT NOT NULL
- created_at TEXT NOT NULL

### Table: operator_identity_map
- identity_id TEXT PRIMARY KEY
- app_id TEXT NOT NULL
- canonical_operator_id TEXT NOT NULL
- channel TEXT NOT NULL
- external_user_id TEXT NOT NULL
- display_name TEXT NULL
- metadata_json TEXT NOT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

Indexes:
- idx_conversations_channel_last_message on (channel, last_message_at DESC)
- idx_conversation_messages_conversation on (conversation_id, created_at ASC)
- idx_operator_identity_unique on (app_id, channel, external_user_id)

## Ownership Notes
- Sync store uses normalized `app_registry` and foreign-key ownership in `app_vault_blueprint`.
- Conversation and governance lifecycle stores persist app context per record (`app_id` text fields where applicable) and are currently decentralized from sync store registry.

## Change Rules
- Keep domain keys stable.
- Any domain added to vault must be present here with the same domain key.
- Update `../vault/prana.md` in the same PR when adding or removing a vault-mirrored domain.