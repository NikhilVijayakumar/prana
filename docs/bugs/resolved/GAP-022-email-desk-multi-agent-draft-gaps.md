# GAP-022: Email Desk ΓÇö Multi-Agent Draft & Cron Gaps

## Executive Summary
The current DHI system has a Gmail/Zapier/MCP ingestion stub (`google-ecosystem-integration.md`) and functional cron orchestration with durable recovery, but lacks the email desk workflow, multi-agent collaborative drafting, multi-mailbox account management, and email-specific cron heartbeat required for the Secretary's Email Desk feature.

## Identified Gaps

| ID | Gap | Severity | Current State | Required State |
|:---|:----|:---------|:-------------|:---------------|
| G1 | No multi-agent draft merging | HIGH | `agentBaseProtocol` supports single-agent task execution only | `SharedDraft` + `DraftContribution` model with section merging |
| G2 | No `EMAIL_HEARTBEAT` cron job | HIGH | `cronSchedulerService` exists but no email-specific job registered | Per-account `EMAIL_HEARTBEAT_<accountId>` job with configurable schedule |
| G3 | No multi-mailbox account model | HIGH | `google-ecosystem-integration.md` assumes single Gmail | N accounts with independent cursors, credentials, and cron schedules |
| G4 | Missing "Clear Desk" confirmation gate | MEDIUM | No Director-facing confirmation flow for batch operations | Goose-derived `PermissionConfirmation` gate for mark-as-read |
| G5 | Google Ecosystem doc is connector-only | MEDIUM | Defines auth/setup but no desk workflow | New `email-management.md` defines full 6-state lifecycle |
| G6 | No spam pre-filter | LOW | Triage relies entirely on Mira's LLM classification | Rule-based pre-filter using `List-Unsubscribe` and domain patterns |
| G7 | IMAP polling latency | LOW | Not applicable (no IMAP integration exists) | Gmail IMAP has 1-5 min sync delay; acceptable for daily/twice-daily schedule |
| G8 | NemoClaw webmail fallback undocumented | LOW | NemoClaw sandbox exists but no email use case defined | Degraded-mode webmail navigation documented as backup |

## Remediation

All gaps are addressed by the new deliverables:
- G1 ΓåÆ `email-orchestrator-service.md` (SharedDraft model + `email:contribute-to-draft` API)
- G2 ΓåÆ `email-cron-heartbeat.md` (configurable heartbeat registration with `cronSchedulerService`)
- G3 ΓåÆ `email-management.md` ┬º Multi-Mailbox Configuration Model
- G4 ΓåÆ `email-cron-heartbeat.md` ┬º "Clear Desk" Protocol
- G5 ΓåÆ `email-management.md` (full 6-state lifecycle spec)
- G6 ΓåÆ `email-management.md` ┬º Zero-Spam Pre-Filter
- G7 ΓåÆ Accepted as limitation; daily/twice-daily polling mitigates impact
- G8 ΓåÆ `email-integration-audit.md` ┬º NemoClaw audit + `email-cron-heartbeat.md` fallback section

## Status
**Open** ΓÇö Implementation deliverables created; source code implementation pending.
