# Email Cron Heartbeat & Recovery — Atomic Feature Specification

## 1. Single Reason to Change (SRP)
This document handles updates **exclusively** related to the scheduling, execution, and failure recovery of periodic email intake cycles for the Director's configured mailboxes. It does not handle triage logic, drafting, or UI rendering.

## 2. Input Data Required
- **Active Email Accounts:** From `email_accounts` SQLite table (`isActive = true`).
- **Cron Schedule:** Per-account `cronSchedule` (`once_daily` | `twice_daily`) and `cronTimes[]`.
- **Last Read Cursor:** Per-account `lastReadUID` from `email_read_cursors` table.

## 3. Registry Sub-Component Integration
- **Agents:** `mira` (heartbeat owner and triage initiator).
- **Skills:** Not directly used by the scheduler.
- **Workflows:** `mira/email-intake-triage` (triggered by heartbeat).
- **Protocols:** `clear-desk-protocol` (post-batch mark-as-read confirmation).
- **KPIs:** `email-triage-latency` (time from heartbeat fire to triage summary ready).
- **Data Inputs:** `email-intake-log`.

## 4. Configurable Heartbeat Mechanics

### Cron Registration
- Each active `EmailAccount` registers a cron job: `EMAIL_HEARTBEAT_<accountId>`.
- Registered with the existing `cronSchedulerService` (see `cron-orchestration.md`).
- Job definition persisted in SQLite alongside other cron jobs.

### Schedule Options
| Config | Fires At | Use Case |
|:-------|:---------|:---------|
| `once_daily` | `cronTimes[0]` (default 07:00) | Light inbox, daily review |
| `twice_daily` | `cronTimes[0]` + `cronTimes[1]` (default 07:00 + 19:00) | Active inbox, morning + evening review |

- Times are configurable per account via the Administration Suite settings panel.
- All times are server-local timezone.

### Heartbeat Cycle (per account)
1. Read `lastReadUID` from `email_read_cursors` for `accountId`.
2. IMAP FETCH all messages with UID > `lastReadUID`.
3. If **empty**: log `HEARTBEAT_OK` in task audit log, skip to next account.
4. If **new emails found**:
   a. Run spam pre-filter (rule-based, see `email-management.md` §8).
   b. Create `EmailActionItem` entries with status `PENDING_TRIAGE`.
   c. Group into batch `batch_<accountId>_<timestamp>`.
   d. Trigger Mira's triage workflow.
   e. Update `lastReadUID` to highest UID in batch.
   f. Update `lastCheckTimestamp`.

## 5. "Clear Desk" Protocol

Adapted from Goose `PermissionConfirmation` pattern:
1. After Mira completes triage summary for a batch, system registers a confirmation request.
2. Director sees batch summary: "Account 'Work Gmail': 12 emails processed. 5 selected for drafting, 4 FYI, 3 archived. Mark processed as read?"
3. Director responds:
   - **Approve** (`AllowOnce`): Mark all processed emails as read via IMAP STORE.
   - **Reject** (`DenyOnce`): Keep all unread for manual review.
4. Confirmation timeout: 4 hours. After timeout, escalates to in-app notification reminder (never auto-marks).

## 6. CronRecovery Logic

Extends existing `queue-orchestration.md` guarantees:

### INTERRUPTED Recovery
- If the app crashes during an IMAP fetch or triage cycle, the heartbeat task status is `RUNNING` in SQLite.
- On restart, `cronSchedulerService` marks it as `INTERRUPTED`.
- The interrupted job is re-enqueued for immediate processing.

### MISSED Recovery
- If the app was offline during a scheduled cron tick, the scheduler detects missed due jobs.
- Missed `EMAIL_HEARTBEAT_<accountId>` jobs are enqueued with source `MISSED` and fire immediately.

### Deduplication Guarantees
- **Cursor-based**: Only emails with UID > `lastReadUID` are fetched. Even if the cron fires multiple times, the same emails are never re-fetched.
- **UNIQUE constraint**: `email_action_items` table has a UNIQUE constraint on `(accountId, emailUid)`. Duplicate inserts are no-ops.
- **Idempotent triage**: If triage runs twice on the same batch, existing ActionItems are not duplicated or re-classified.

## 7. Triple-Engine Extraction Model
- **OpenCLAW:** Not directly used by the scheduler.
- **Goose:** Not directly used by the scheduler.
- **NemoClaw:** Webmail browser fallback when IMAP unavailable. The heartbeat detects IMAP connection failure and falls back to NemoClaw sandbox navigation of the webmail UI. This is degraded mode: slower (15-30s), fragile, and logs a WARNING-tier alert.

## 8. Hybrid DB & State Storage Flow
- **SQLite:** `email_read_cursors` (per-account UID cursor), task queue entries for heartbeat jobs.
- **Vault:** Not used directly by the scheduler.

## 9. Cron & Queue Management
- **Scheduler:** Existing `cronSchedulerService` manages timing and enqueue.
- **Queue:** Heartbeat jobs use the standard task queue with status lifecycle: `PENDING → RUNNING → COMPLETED / FAILED / INTERRUPTED`.
- **Audit:** All heartbeat events (fire, skip, fetch, error, recovery) logged in `task_audit_log`.
