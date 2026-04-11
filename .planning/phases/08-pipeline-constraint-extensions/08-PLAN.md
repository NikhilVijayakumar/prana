---
plan_id: 08-pipeline-constraint-extensions
wave: 1
depends_on: []
files_modified:
  - src/main/services/emailOrchestratorService.ts
  - src/main/services/piiRedactionService.ts
  - src/main/services/pdfGeneratorService.ts
autonomous: true
---

# Phase 8: Pipeline Constraint Extensions - Execution Plan

## Goal
Enforce backpressure on email ingestion, apply text-based PII redaction at intake, and provide lightweight PDF generation using Electron's built-in Chromium renderer — all with zero new npm dependencies.

## Tasks

<task>
<id>implement-backpressure-gate</id>
<title>Implement Backpressure Gate in Email Orchestrator</title>
<read_first>
- src/main/services/emailOrchestratorService.ts
</read_first>
<action>
1. In `emailOrchestratorService.ts`, add a constant `MAX_PENDING_ACTION_ITEMS = 200` near the existing `MAX_BATCH_HISTORY` constant.
2. Expand the `EmailBatchRecord.status` union type from `'SUCCESS' | 'FAILED' | 'PARTIAL'` to `'SUCCESS' | 'FAILED' | 'PARTIAL' | 'BACKPRESSURED'`.
3. In `fetchUnread`, immediately after loading the store and validating the account exists, insert a backpressure check:
   ```typescript
   const pendingCount = store.actionItems.filter(
     (entry) => entry.status === 'PENDING_TRIAGE' || entry.status === 'TRIAGED'
   ).length;
   if (pendingCount >= MAX_PENDING_ACTION_ITEMS) {
     const batch: EmailBatchRecord = {
       batchId, accountId, createdAt, source,
       status: 'BACKPRESSURED',
       fetched: 0, createdActionItems: 0, duplicateCount: 0,
       message: `Backpressure active: ${pendingCount} pending items exceed threshold (${MAX_PENDING_ACTION_ITEMS}).`
     };
     pushBatch(store, batch);
     await saveStore(store);
     return batch;
   }
   ```
4. This gate fires before any IMAP fetch, preventing network calls when the pipeline is saturated.
</action>
<acceptance_criteria>
- `MAX_PENDING_ACTION_ITEMS` constant is configurable at top of file.
- `EmailBatchRecord.status` includes `'BACKPRESSURED'` union member.
- `fetchUnread` returns early with `BACKPRESSURED` status when threshold exceeded.
- No IMAP calls are made when backpressured.
</acceptance_criteria>
</task>

<task>
<id>implement-pii-redaction</id>
<title>Implement Text-Based PII Redaction Service</title>
<read_first>
- src/main/services/emailOrchestratorService.ts
</read_first>
<action>
1. Create `src/main/services/piiRedactionService.ts`.
2. Define a `PII_PATTERNS` array of `{ name: string; pattern: RegExp; replacement: string }` covering:
   - SSN: `/\b\d{3}-\d{2}-\d{4}\b/g` → `[SSN-REDACTED]`
   - Credit card: `/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g` → `[CC-REDACTED]`
   - Phone (US): `/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g` → `[PHONE-REDACTED]`
   - Raw email: `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g` → `[EMAIL-REDACTED]`
3. Export `redactPii(text: string): string` which iterates all patterns and replaces matches.
4. Export `containsPii(text: string): boolean` which returns true if any pattern matches.
5. In `emailOrchestratorService.ts`, import `redactPii` and apply it to `bodyPreview` and `subject` fields during action item creation inside `fetchUnread`, after line 501 (`bodyPreview: toBodyPreview(row)`) — wrap the values: `bodyPreview: redactPii(toBodyPreview(row))`.
</action>
<acceptance_criteria>
- `piiRedactionService.ts` exports `redactPii` and `containsPii`.
- SSN, CC, phone, and email patterns are covered.
- `emailOrchestratorService.fetchUnread` applies redaction to `bodyPreview` at ingestion time.
</acceptance_criteria>
</task>

<task>
<id>implement-pdf-generator</id>
<title>Implement Lightweight Electron PDF Generator</title>
<read_first>
- src/main/index.ts
</read_first>
<action>
1. Create `src/main/services/pdfGeneratorService.ts`.
2. Import `BrowserWindow` from `electron`.
3. Export `async generatePdfFromHtml(htmlContent: string, options?: { landscape?: boolean; pageSize?: string }): Promise<Buffer>`:
   - Create a hidden `BrowserWindow` with `show: false` and `webPreferences: { offscreen: true }`.
   - Load the HTML content using `win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent))`.
   - Wait for `did-finish-load` event.
   - Call `win.webContents.printToPDF({ printBackground: true, landscape: options?.landscape ?? false, pageSize: options?.pageSize ?? 'A4' })`.
   - Destroy the window and return the PDF buffer.
4. Export `async generatePdfFromUrl(url: string, options?: { landscape?: boolean; pageSize?: string }): Promise<Buffer>` with the same pattern but using `win.loadURL(url)` directly.
5. Add a 15-second timeout safety net — if `did-finish-load` doesn't fire, destroy the window and throw.
</action>
<acceptance_criteria>
- `pdfGeneratorService.ts` exports `generatePdfFromHtml` and `generatePdfFromUrl`.
- Uses Electron's built-in `BrowserWindow` and `printToPDF` — zero npm dependencies.
- Hidden window is created, used, and destroyed per call.
- 15-second timeout prevents orphaned windows.
</acceptance_criteria>
</task>

## Verification Strategy
- Run `npm run typecheck` to confirm all three new/modified files compile cleanly.
- Verify `EmailBatchRecord` status union includes `BACKPRESSURED` without breaking existing consumers.
- Confirm `redactPii('My SSN is 123-45-6789')` returns `'My SSN is [SSN-REDACTED]'`.

## Must Haves
- Zero new npm dependencies across all three tasks.
- Backpressure gate must fire before any IMAP network call.
- PII redaction is applied at ingestion — never stored in raw form.
