# EmailOrchestrator Service — Atomic Feature Specification

## 1. Single Reason to Change (SRP)
This document handles updates **exclusively** related to the service orchestrating email handoffs between Mira (Secretary) and other Virtual Employees for collaborative drafting and Director review. It does not handle IMAP connectivity, cron scheduling, or UI rendering.

## 2. Input Data Required
- **Classified ActionItems:** From Mira's triage stage with priority, department, and Director's selection (draft reply / compose new / FYI / archive).
- **Agent Directory Registry:** To resolve which agent handles which domain.
- **Work Order System:** Existing `QueueService` for dispatching tasks to agents.

## 3. Registry Sub-Component Integration
- **Agents:** `mira` (orchestrator), all domain agents via Agent Directory lookup.
- **Skills:** `secretary-global-router` (role-aware delegation), `email-triage-classifier` (input source).
- **Workflows:** `mira/email-collaborative-draft`.
- **Protocols:** `deterministic-handoff-protocol`, `clear-desk-protocol`.
- **KPIs:** Not directly measured — delegates to `draft-cycle-time` (measured at module level).
- **Data Inputs:** `email-intake-log`, `agent-directory-registry`.

## 4. Service Responsibilities
1. Receive classified ActionItems from Mira's triage stage.
2. Resolve target agent(s) based on department tags using Agent Directory Registry:
   - Finance → `nora`, Compliance → `eva`, HR → `lina`, Operations → `elina`, Strategy → `arya`, Design → `sofia`, General → `mira`.
3. Create `SharedDraft` entries in `email_drafts` SQLite table.
4. Dispatch work orders to target agents via existing `QueueService`.
5. Collect agent contributions and merge into unified draft (ordered by `section_index`).
6. Present final draft to Director with contributor attribution.
7. On Director approval, persist to Vault (never send).
8. Handle "Clear Desk" confirmation gate for batch mark-as-read.

## 5. IPC API Surface

| Endpoint | Direction | Description |
|:---------|:----------|:------------|
| `email:configure-account` | Renderer → Main | Add/edit/remove a Director email account |
| `email:list-accounts` | Renderer → Main | List all configured email accounts |
| `email:fetch-unread` | Renderer → Main | Manual trigger for a specific account |
| `email:fetch-all-accounts` | Renderer → Main | Trigger intake across all active accounts |
| `email:get-triage-summary` | Renderer → Main | Retrieve Mira's classified summary for Director |
| `email:select-for-draft` | Renderer → Main | Director marks specific emails for response drafting |
| `email:compose-new-draft` | Renderer → Main | Director instructs a fresh outbound draft (not a reply) |
| `email:contribute-to-draft` | Agent → Service | Agent submits their section to a shared draft |
| `email:get-draft` | Renderer → Main | Retrieve shared draft with contributor attribution |
| `email:approve-draft` | Renderer → Main | Director approves → saves to Vault (never sends) |
| `email:mark-batch-read` | Renderer → Main | "Clear Desk" with Director confirmation gate |
| `email:get-batch-history` | Renderer → Main | List past intake batches with status |

## 6. Data Schemas

### EmailAccount
```typescript
interface EmailAccount {
  accountId: string;        // UUID
  label: string;            // e.g., "Work Gmail", "Personal Outlook"
  provider: 'gmail' | 'outlook' | 'imap-generic';
  imapHost: string;
  imapPort: number;
  useTls: boolean;
  credentials: 'runtime-local';  // marker: never persisted to Vault
  cronSchedule: 'once_daily' | 'twice_daily';
  cronTimes: string[];       // e.g., ["07:00"] or ["07:00", "19:00"]
  lastReadUID: number;
  lastCheckTimestamp: string;
  isActive: boolean;
  createdAt: string;
}
```

### EmailActionItem
```typescript
interface EmailActionItem {
  id: string;               // UUID
  accountId: string;        // FK to EmailAccount
  emailUid: number;         // IMAP UID — UNIQUE per account
  subject: string;
  sender: string;
  senderDomain: string;
  receivedAt: string;
  bodyPreview: string;      // First 500 chars
  priority: 'CRITICAL' | 'URGENT' | 'IMPORTANT' | 'ROUTINE';
  department: string;
  directorAction: 'DRAFT_REPLY' | 'COMPOSE_NEW' | 'FYI' | 'ARCHIVE' | null;
  status: 'PENDING_TRIAGE' | 'TRIAGED' | 'SELECTED' | 'DRAFT_IN_PROGRESS' | 'DRAFT_SAVED';
  assignedAgentIds: string[];
  batchId: string;
  isSpam: boolean;
}
```

### SharedDraft
```typescript
interface SharedDraft {
  draftId: string;          // UUID
  actionItemId: string;     // FK to EmailActionItem (null for new compositions)
  draftType: 'REPLY' | 'NEW_COMPOSITION';
  subject: string;
  recipientAddress: string | null;
  mergedContent: string;    // Final merged draft
  status: 'IN_PROGRESS' | 'AWAITING_REVIEW' | 'APPROVED' | 'DISCARDED';
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

### DraftContribution
```typescript
interface DraftContribution {
  contributionId: string;
  draftId: string;          // FK to SharedDraft
  agentId: string;
  sectionIndex: number;     // Ordering within the merged draft
  content: string;
  contributedAt: string;
  version: number;
}
```

## 7. Triple-Engine Extraction Model
- **OpenCLAW:** Enforces pre-flight security on all draft content before save — scans for internal Vault key patterns, unapproved data references, and policy violations.
- **Goose:** Extracts structured ActionItems from raw email bodies; decomposes Director's composition instructions into atomic task assignments.
- **NemoClaw:** Not directly used by this service.

## 8. Hybrid DB & State Storage Flow
- **SQLite:** `email_accounts`, `email_action_items`, `email_drafts`, `email_draft_contributions`, `email_read_cursors` — all operational state.
- **Vault:** Approved final drafts committed to `/org/administration/email/drafts/<draftId>.md`.

## 9. Cron & Queue Integration
- This service is **triggered by** cron heartbeat jobs but does not manage cron registration itself.
- Cron registration is handled by the `email-cron-heartbeat.md` spec using the existing `cronSchedulerService`.
- Agent work orders dispatched via existing `QueueService` with standard priority ordering.
