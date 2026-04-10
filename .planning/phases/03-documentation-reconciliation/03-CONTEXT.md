# Phase 03: Documentation Reconciliation - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Deep rewrite of `docs/features/` specifications to align with the actual implementation state after Phase 1 (security hardening) and Phase 2 (feature audit). Update `README.md` (project overview) and `docs/integration_guide/library-integration-guide.md` (host app reference). Reorganize audit reports into `docs/features/audit/`. Remove `docs/modules/` (outdated, archived — superseded by `docs/features/`).

</domain>

<decisions>
## Implementation Decisions

### Reconciliation Scope
- **D-01:** Primary target is `docs/features/` — the canonical specification tree.
- **D-02:** Also update `README.md` (project root) as it serves as the overview entry point.
- **D-03:** Also update `docs/integration_guide/library-integration-guide.md` — the host-app reference for apps consuming this library.
- **D-04:** `docs/modules/` is outdated and archived. If all features are properly captured in `docs/features/`, remove `docs/modules/` entirely to avoid confusion.

### Audit Report Organization
- **D-05:** Move the 11 audit reports from `docs/features/*-audit-report.md` into a dedicated `docs/features/audit/` directory. Sub-directories inside `audit/` may be created as needed for organization.

### Spec Gap Table Updates
- **D-06:** Update the original feature specs to close gaps that have been resolved. For example, `notification-centre.md` §15 lists "Rate Limiting" and "Event Schema Enforcement" as gaps, but `notificationRateLimiterService.ts` and `notificationValidationService.ts` now cover these — the gap rows should be removed or marked as resolved.

### Depth of Changes
- **D-07:** Deep rewrite — not a lightweight patch. Restructure sections, update invariants, add security notes reflecting Phase 1 changes (Zod validation, path traversal gating, wrappedFetch), rewrite gap tables, and ensure architectural diagrams/state models reflect the current implementation.

### Agent's Discretion
- Folder structure within `docs/features/audit/` — organize by domain, chronology, or flat as makes sense.
- Whether to create a `docs/features/audit/index.md` summary file linking all reports.
- Writing style and section ordering in rewritten specs — maintain consistency with existing tone.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Feature Specifications (to be rewritten)
- `docs/features/chat/communication.md` — Agent communication & channel orchestration
- `docs/features/cron/` — Cron & scheduling domain
- `docs/features/email/email.md` — Email intelligence & orchestration pipeline
- `docs/features/Integration/google-ecosystem-integration.md` — Google Workspace bridge
- `docs/features/Integration/viewer-markdown-screen.md` — Markdown viewer
- `docs/features/Integration/viewer-pdf-screen.md` — PDF viewer
- `docs/features/notification/notification-centre.md` — Event registry & notification centre
- `docs/features/Onboarding/onboarding-pipeline-orchestrator.md` — Onboarding pipeline
- `docs/features/Onboarding/onboarding-channel-configuration.md` — Channel config
- `docs/features/Onboarding/onboarding-model-configuration.md` — Model config
- `docs/features/Onboarding/onboarding-registry-approval.md` — Registry approval
- `docs/features/Onboarding/onboarding-hybrid-explorer-governance-lifecycle.md` — Explorer governance
- `docs/features/queue-scheduling/queue-scheduling.md` — Task scheduler & universal queue
- `docs/features/splash/` — Splash & bootstrap
- `docs/features/storage/` — Vault & storage governance
- `docs/features/vaidyar/vaidyar.md` — Runtime integrity engine
- `docs/features/visual/visual-identity-engine.md` — Visual identity engine

### Audit Reports (source of truth for gap/match data)
- `docs/features/storage-audit-report.md`
- `docs/features/cron-audit-report.md`
- `docs/features/splash-audit-report.md`
- `docs/features/communication-audit-report.md`
- `docs/features/email-audit-report.md`
- `docs/features/queue-scheduling-audit-report.md`
- `docs/features/Integration-audit-report.md`
- `docs/features/visual-audit-report.md`
- `docs/features/Onboarding-audit-report.md`
- `docs/features/notification-audit-report.md`
- `docs/features/vaidyar-audit-report.md`

### Project Overview & Integration
- `README.md` — Project root overview (to be updated)
- `docs/integration_guide/library-integration-guide.md` — Host app reference (to be updated)

### Prior Phase Artifacts
- `.planning/phases/01-baseline-security-ipc-hardening/01-CONTEXT.md` — Security hardening decisions
- `.planning/phases/02-comprehensive-feature-audit/02-SUMMARY.md` — Audit execution summary

### Obsolete (to be removed)
- `docs/modules/` — Outdated architectural docs, superseded by `docs/features/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Key Implementation Files (for cross-referencing spec accuracy)
- `src/main/services/pranaRuntimeConfig.ts` — Zod-validated runtime config (Phase 1+2 change)
- `src/main/services/ipcService.ts` — IPC handler surface (~50+ handlers)
- `src/main/utils/network/globalFetchWrapper.ts` — wrappedFetch with timeout enforcement
- `src/main/services/notificationRateLimiterService.ts` — Rate limiting (closes spec gap)
- `src/main/services/notificationValidationService.ts` — Event schema enforcement (closes spec gap)
- `src/main/services/vaidyarService.ts` — Most complete domain per audit

### Established Patterns
- Zod validation at IPC boundaries (Phase 1 decision, applied in Phase 2)
- wrappedFetch for all external HTTP calls (no raw fetch() remains)
- Cold-Vault architecture with SQLite ↔ Vault mirror constraint

### Integration Points
- Feature specs feed into host app integration guide
- README.md synthesizes from feature specs + integration guide

</code_context>

<specifics>
## Specific Ideas

- When updating gap tables in specs, mark resolved gaps with a "Resolved in v1.2" annotation rather than silently deleting rows — this preserves audit trail.
- The `docs/features/index.md` file should be updated to reflect the new audit directory structure.
- The integration guide should reference the new Zod validation contract for IPC payloads — host apps need to know about this change.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---
*Phase: 03-documentation-reconciliation*
*Context gathered: 2026-04-11*
