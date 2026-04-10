# Phase 03: Documentation Reconciliation — Research

**Researched:** 2026-04-11
**Domain:** Deep documentation rewrite to align `docs/features/`, `README.md`, and integration guide with current implementation state.

## Current Documentation Inventory

### docs/features/ — Canonical Spec Tree (41 files)
- 11 domain specs (communication, cron, email, integration, notification, onboarding×5, queue-scheduling, splash, storage×7, vaidyar, visual)
- 11 audit reports (Phase 2 output — flat in features/ root, need relocation)
- 1 index.md (atomic documentation index)
- Supporting governance/boot/auth docs

### docs/modules/ — OBSOLETE (4 files)
- `context-engine-ui-implementation.md` — Legacy reference only
- `storage/index.md` — Duplicates `docs/features/storage/governance/index.md`
- `storage/cache/prana.md` — Duplicates `docs/features/storage/governance/cache/prana.md`
- `storage/vault/prana.md` — Duplicates `docs/features/storage/governance/vault/prana.md`
- **Decision:** Safe to remove. All content is captured in `docs/features/`.

### README.md (701 lines)
- References `docs/modules/` in 12+ places (Quick Nav, Contribution Workflow, Storage sections)
- Version shows "1.1.0" — must update to reflect v1.2 hardening
- "Known Architectural Gaps" section needs update: some gaps are now closed (e.g., IPC validation, Notification rate limiting)
- Missing: Phase 1 security enhancements (Zod IPC validation, wrappedFetch, path traversal gating)
- Several broken/outdated links pointing to `docs/modules/` paths

### docs/integration_guide/library-integration-guide.md (240 lines)
- Generally current but missing v1.2 security notes
- Missing: Zod IPC payload validation contract for host apps
- Missing: `wrappedFetch` timeout enforcement documentation
- Missing: Notification subsystem services (rateLimiter, validation)

## Gap Inventory from Phase 2 Audit Reports

### Gaps Confirmed CLOSED (must update specs)
| Domain | Gap Previously Listed | Now Covered By |
|--------|----------------------|----------------|
| Notification | Rate Limiting | `notificationRateLimiterService.ts` |
| Notification | Event Schema Enforcement | `notificationValidationService.ts` |
| Onboarding | Welcome/Orientation Stage | Runtime implementation (spec §0 updated 2026-04-06) |
| Onboarding | Policy/Consent Gate | Runtime implementation |
| Onboarding | Final Review Checkpoint | Runtime implementation |
| Onboarding | Completion Handoff | Runtime implementation |
| Splash | Runtime Config Validation | Zod schema in `pranaRuntimeConfig.ts` |
| All Services | Raw fetch() calls | Migrated to `wrappedFetch` |

### Gaps Confirmed OPEN (must remain in specs)
| Domain | Gap | Notes |
|--------|-----|-------|
| Communication | WhatsApp bridge | No adapter exists |
| Communication | Agent loop prevention | No multi-agent orchestration guard |
| Email | Attachment handling | No binary attachment pipeline |
| Email | PII redaction | No redaction service |
| Queue | Adaptive throttling | Static concurrency limits only |
| Queue | Task DAG | No dependency chaining |
| Integration | Write-back pipeline | Read-only mirror only |
| Visual | Puppeteer rendering | No headless PDF generation |
| Visual | Google Docs mapping | Complex layout mapping unsupported |
| Vaidyar | Background heartbeat | Relies on cron intervals |
| Vaidyar | Auto-recovery hooks | Reports only, doesn't repair |

## README.md Link Audit

### Broken/Stale References Found
1. Line 7: `docs/modules/index.md` → should be `docs/features/index.md`
2. Line 57: References "docs/modules" in philosophy section
3. Line 237: `docs/modules/storage/cache` → `docs/features/storage/governance/cache`
4. Line 553: `docs/modules/ui/` → should reference `docs/features/splash`
5. Line 654: Contribution workflow references `docs/modules`
6. Line 662-663: New App Integration references `docs/modules/storage/`
7. Line 669: UI Screen references `docs/modules/ui`
8. Line 690: Quick Nav → `docs/modules/index.md`
9. Line 691-693: Quick Nav storage/audit links reference `docs/modules/`

## Security Documentation Gaps (Phase 1 Changes Not Documented)

### Must Document
1. **Zod IPC Validation** — All IPC handlers now enforce typed payloads via Zod `.safeParse()`. Host apps must conform to schema contracts.
2. **wrappedFetch** — All network calls route through `globalFetchWrapper.ts` with timeout enforcement. No raw `fetch()` calls permitted.
3. **Path Traversal Gating** — `virtualDriveProvider.ts` enforces `resolvedPath.startsWith(vaultRoot)` for all filesystem operations.
4. **Fail-Fast Bootstrap** — System stays BLOCKED until splash provides valid config. Invalid config triggers structured error reporting, not silent failure.

## Validation Architecture

### Build Verification
- `npm run typecheck` — Ensure no doc link changes break TypeScript (unlikely but verify after README changes)
- Manual: All internal doc links in README.md, index.md, and integration guide must resolve to existing files

### Content Verification
- Each updated spec gap table accurately reflects current implementation
- All `docs/modules/` references removed from README.md
- Audit reports successfully moved to `docs/features/audit/` subdirectory
- `docs/modules/` directory deleted

## RESEARCH COMPLETE
