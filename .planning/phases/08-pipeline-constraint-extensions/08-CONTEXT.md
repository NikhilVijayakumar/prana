# Phase 8: Pipeline Constraint Extensions - Context

## Domain
Enforce backpressure handling, automated PII redaction, and lightweight PDF generation across the email/visual pipeline without heavy external dependencies.

## Canonical Refs
- `src/main/services/emailOrchestratorService.ts`
- `src/main/services/emailBrowserAgentService.ts`
- `.planning/REQUIREMENTS.md` (PIPE-01, PIPE-02, PIPE-03)

## Note on Numbering
This is execution Phase 8 but maps to Roadmap Phase 7 ("Pipeline Constraint Extensions"). Roadmap Phase 8 (Google Ecosystem) was executed first under directory `07-google-ecosystem-integration/`.

## Decisions

1. **Backpressure Mechanism (PIPE-01)**
   Implement a configurable `MAX_PENDING_ACTION_ITEMS` threshold (default: 200). Before `fetchUnread` processes new emails, it checks how many action items are in `PENDING_TRIAGE` or `TRIAGED` status. If above threshold, the fetch returns a `BACKPRESSURED` batch status and skips IMAP retrieval. Existing cron/IMAP architecture remains untouched — this is purely a pre-flight gate.

2. **Text-Based PII Redaction (PIPE-02)**
   Implement regex-based PII scrubbing applied at ingestion time inside `emailOrchestratorService.fetchUnread`. Patterns cover SSNs, credit card numbers, phone numbers, and raw email addresses embedded in body previews. Extends the existing `containsRestrictedContent` approach. Binary/image PII (OCR + blur) is explicitly **deferred to a future milestone**.

3. **Lightweight PDF Generation (PIPE-03)**
   Use Electron's built-in `webContents.printToPDF()` API via a hidden `BrowserWindow` instead of bundling Puppeteer (~300MB). Create a `pdfGeneratorService.ts` that accepts HTML strings, loads them into an off-screen window, calls `printToPDF()`, and returns a `Buffer`. Zero new npm dependencies.

## Deferred Ideas
- Binary/image PII redaction via OCR + blur (future milestone)
- Full Puppeteer integration for external browser automation (not needed — Electron provides equivalent PDF capability)
