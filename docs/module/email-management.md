# Email Management — Atomic Feature Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Pipeline

## Current State
- Contract and lifecycle are fully documented, including multi-mailbox and collaborative drafting expectations.
- Runtime implementation remains incomplete for full end-to-end email desk orchestration.

## Target State
- Deliver complete read-and-draft workflow across intake, triage, contribution, review, and save stages.
- Keep strict no-send behavior with Director-only manual outbound sending.

## Gap Notes
- Heartbeat scheduling, account cursor isolation, and shared draft runtime assembly need full service integration.

## Dependencies
- docs/module/email-orchestrator-service.md
- docs/module/email-cron-heartbeat.md
- docs/module/onboarding-channel-configuration.md

## Acceptance Criteria
1. Account-level intake and cursor management are deterministic.
2. Collaborative draft flow enforces Director review before final save.
3. No SMTP or direct send behavior exists in runtime.

## Immediate Roadmap
1. Implement multi-mailbox heartbeat and deduplication.
2. Implement shared draft contribution merge and approval gate.
3. Integrate degraded mode fallback visibility in diagnostics.

## 1. Single Reason to Change (SRP)
This document handles updates **exclusively** related to the intake, triage, collaborative drafting, and local persistence of email correspondence for the Director's desk. It never handles sending — all drafts are saved locally for the Director to send manually from their email client.

## 2. Input Data Required
- **Mailbox Accounts:** Configurable list of Director email accounts (Gmail, Outlook, generic IMAP).
- **Credentials:** IMAP host, port, auth credentials — runtime-local only (never persisted to Vault).
- **Cron Schedule:** `once_daily` or `twice_daily` with configurable times, executed via existing `cronSchedulerService`.
- **Last Read UID:** Per-account cursor stored in SQLite `email_read_cursors` table.

## 3. Multi-Mailbox Configuration Model
- Director configures N email accounts via onboarding or the Administration Suite settings panel.
- Each account has: `accountId`, `label`, `provider`, IMAP connection details, `cronSchedule`, `cronTimes[]`, `lastReadUID`, `isActive`.
- Accounts are polled independently — each has its own cron job registered as `EMAIL_HEARTBEAT_<accountId>`.
- Account credentials remain runtime-local and excluded from Vault payload.

## 4. Email Lifecycle State Machine

```
INTAKE → TRIAGE_SUMMARY → DIRECTOR_SELECTS → MULTI_ROLE_INPUT → DIRECTOR_REVIEW → DRAFT_SAVED
```

| State | Owner | Action |
|:------|:------|:-------|
| `INTAKE` | Cron heartbeat | Fetch unread per account since `lastReadUID` via IMAP |
| `TRIAGE_SUMMARY` | Mira (Secretary) | Classify all emails by priority and domain, present summary to Director |
| `DIRECTOR_SELECTS` | Director (Human) | Picks which emails to draft responses for; marks others as FYI/archive |
| `MULTI_ROLE_INPUT` | Assigned agents | Contribute domain-specific content to shared draft |
| `DIRECTOR_REVIEW` | Director (Human) | Review aggregated draft, edit inline, approve save |
| `DRAFT_SAVED` | System | Persist final draft to Vault; Director copies and sends from their email client |

### New Email Drafting
The Director can also instruct Mira to compose a **fresh outbound draft** (not a reply) with specific details. The system routes to relevant agents for data, assembles the draft, and saves it for Director review. These follow: `MULTI_ROLE_INPUT → DIRECTOR_REVIEW → DRAFT_SAVED`.

## 5. Registry Sub-Component Integration
- **Agents:** `mira` (orchestrator), `arya` (strategy), `nora` (finance), `eva` (compliance), `elina` (operations), `sofia` (design), `lina` (HR).
- **Skills:** `email-triage-classifier`, `spam-newsletter-filter`, `secretary-global-router`.
- **Workflows:** `mira/email-intake-triage`, `mira/email-collaborative-draft`.
- **Protocols:** `clear-desk-protocol`, `intent-parsing-protocol`, `deterministic-handoff-protocol`.
- **KPIs:** `email-triage-latency`, `draft-cycle-time`, `director-selection-rate`.
- **Data Inputs:** `email-intake-log`.

## 6. Triple-Engine Extraction Model
- **OpenCLAW:** Enforces pre-flight security on draft content — no internal Vault keys, no unapproved attachments, no confidential data leakage in outgoing drafts.
- **Goose:** Extracts email body into structured ActionItems with priority, department, and due-date tags.
- **NemoClaw:** Webmail browser fallback when IMAP unavailable (degraded mode only).

## 7. Hybrid DB & State Storage Flow

### SQLite (High-Performance)
| Table | Purpose |
|:------|:--------|
| `email_accounts` | Configured mailbox accounts with IMAP details and schedule |
| `email_read_cursors` | Per-account `lastReadUID` and `lastCheckTimestamp` |
| `email_intake_log` | Raw email metadata per heartbeat batch |
| `email_action_items` | Classified ActionItems with priority, department, Director action, status |
| `email_drafts` | Shared draft entries with state and version |
| `email_draft_contributions` | Per-agent sections within a shared draft |

### Vault (Secure Commit State)
- Approved final drafts archived under `/org/administration/email/drafts/`.
- Archived spam/newsletter log for audit trail.

## 8. Zero-Spam Pre-Filter
- Rule-based pre-processing runs before Mira's LLM triage.
- Checks: `List-Unsubscribe` header presence, sender domain against configurable newsletter/promotional patterns, known bulk-sender lists.
- Auto-classified as `ARCHIVE` — stored in intake log but never enters Director's triage summary.
- Mira's LLM classification handles edge cases the rule-based filter misses.

## 9. Chat Scenarios (Internal vs External)
- **Internal Chat:** Mira posts triage summary notification to Director. Agents coordinate draft contributions via internal work order system.
- **External Chat:** None. The app never sends emails. Optional Telegram notification when a new batch triage summary is ready.

## 10. Cron & Queue Management
- **Cron Job:** `EMAIL_HEARTBEAT_<accountId>` registered per active account with the existing `cronSchedulerService`.
- **Schedule:** Configurable — `once_daily` (default 07:00) or `twice_daily` (07:00 + 19:00), times adjustable.
- **Failover / Catch-up:** Uses existing `queue-orchestration.md` guarantees — INTERRUPTED jobs re-enqueued on restart, MISSED schedules fire immediately on boot.
- **Deduplication:** `lastReadUID` cursor + `emailUid` UNIQUE constraint on ActionItems prevents duplicate processing.

## 11. **HARD CONSTRAINT — READ & DRAFT ONLY**
- The app **never** sends emails via SMTP.
- All drafted responses and new compositions are saved locally.
- Director uses "Copy to Clipboard" to transfer draft to their email client for manual sending.
- No outbound email channel, no SMTP credentials, no send API.
