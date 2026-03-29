# Feature Implementation Plans

## Purpose
This document is the implementation roadmap for missing or partial engine capabilities that are architectural feature gaps, not defects.

## Planning Model
Each item includes:
- Gap source and target contract.
- Scope and technical tasks.
- Dependencies.
- Verification gates.
- Definition of done.

## Wave 1: Contract Integrity and Startup Foundation

### FP-001 Config Validation Hardening
- Source: docs/bugs/resolved/prana-standalone-config-hardcoding-gap-2026-03-28.md
- Target contract: docs/module/master-spec.md and docs/module/props-config-principle.md
- Scope:
  1. Define required runtime keys and fail-fast behavior.
  2. Remove silent defaults for critical identifiers/secrets.
  3. Add diagnostic-safe validation output model.
- Dependencies: startup contract and integration diagnostics.
- Verification gates:
  1. Missing critical config blocks startup gate.
  2. Diagnostics do not expose secret values.
- Definition of done: startup consistently enters blocked mode when critical keys are absent.

### FP-002 Cron Catch-up Idempotency Completion
- Source: docs/bugs/resolved/cron-catchup-recovery-gap-2026-03-28.md
- Target contract: docs/module/cron-recovery-contract.md
- Scope:
  1. Formalize dependency ordering for recovery tasks.
  2. Enforce duplicate prevention across restart windows.
  3. Publish recovery counters in startup summary.
- Dependencies: startup orchestrator and queue state model.
- Verification gates:
  1. Restart replay does not duplicate due jobs.
  2. Catch-up metrics appear in diagnostics.
- Definition of done: missed and interrupted jobs recover deterministically with observable counters.

### FP-003 Vault-SQLite Sync Deterministic Merge
- Source: docs/bugs/resolved/vault-sqlite-sync-gap-2026-03-28.md
- Target contract: docs/module/vault-sync-contract.md
- Scope:
  1. Tighten first-install vs returning-install merge semantics.
  2. Strengthen freshness and integrity branching behavior.
  3. Add conflict decision visibility in diagnostics.
- Dependencies: governance repo readiness, startup sequencing.
- Verification gates:
  1. Corrupt remote snapshot blocks merge.
  2. Freshness rules are deterministic and testable.
- Definition of done: sync behavior is reproducible and observable across install modes.

## Wave 2: Governance and Registry Alignment

### FP-004 Business Context Registry Alignment
- Source: docs/bugs/resolved/GAP-013-business-context-registry-alignment.md
- Target contract: docs/module/onboarding-registry-approval.md
- Scope:
  1. Define company and product context schema requirements.
  2. Enforce asset dependency chain in onboarding approvals.
  3. Add validation outcomes for incomplete context maps.
- Dependencies: onboarding lifecycle and registry data model.
- Verification gates:
  1. Missing mandatory context blocks approval progression.
  2. Validation outcomes are user-visible and auditable.
- Definition of done: onboarding approvals cannot complete without valid context hierarchy.

### FP-005 Business Alignment Cross-Reference Completion
- Source: docs/bugs/resolved/GAP-014-business-alignment-cross-reference.md
- Target contract: docs/module/onboarding-hybrid-explorer-governance-lifecycle.md
- Scope:
  1. Map KPI, protocol, workflow, skill, and data-input dependencies.
  2. Enforce cross-reference checks before approval.
  3. Add unresolved dependency reporting.
- Dependencies: registry metadata model.
- Verification gates:
  1. Unlinked dependencies are surfaced before approval.
  2. Approval action requires resolution or explicit override.
- Definition of done: registry assets are cross-referenced and traceable before commit.

### FP-006 Governance Review UI Enforcement
- Source: docs/bugs/resolved/GAP-017-governance-review-ui-enhancements.md
- Target contract: docs/reference/module/management-suite.md
- Scope:
  1. Require reject rationale input.
  2. Add review status filtering surfaces.
  3. Persist reviewer notes and decision metadata.
- Dependencies: governance queue storage and review actions.
- Verification gates:
  1. Reject path is blocked without rationale.
  2. Review list supports status-based filtering and audit trace.
- Definition of done: review flow is fully auditable and policy-compliant.

## Wave 3: Model and Collaboration Intelligence

### FP-007 Runtime Model Context Window Capture
- Source: docs/bugs/resolved/GAP-019-model-context-window-runtime-capture.md
- Target contract: docs/module/onboarding-model-configuration.md
- Scope:
  1. Capture context-window metadata during model configuration.
  2. Resolve provider defaults against selected runtime model.
  3. Feed context budget services with explicit context window values.
- Dependencies: model configuration flow and token management services.
- Verification gates:
  1. Runtime config persists selected model context window.
  2. Token budget logic consumes persisted window value.
- Definition of done: context budgeting is model-aware at runtime.

### FP-008 Global Collaboration Handshake Persistence
- Source: docs/bugs/resolved/GAP-020-global-collaboration-handshake-and-agent-directory.md
- Target contract: docs/module/master-spec.md and docs/reference/module/registry-workflow-editor.md
- Scope:
  1. Persist handoff ledger events across restarts.
  2. Add WAITING_ON_ROLE state transitions to durable store.
  3. Expose director visibility timeline from persisted events.
- Dependencies: work order storage and agent directory rules.
- Verification gates:
  1. Restart preserves handshake state.
  2. Timeline reconstructs correctly from durable events.
- Definition of done: collaboration transitions are durable and reviewable.

## Wave 4: Email Desk End-to-End Delivery

### FP-009 Multi-Mailbox Intake and Cursor Isolation
- Source: docs/bugs/resolved/GAP-022-email-desk-multi-agent-draft-gaps.md
- Target contract: docs/module/email-management.md
- Scope:
  1. Add account-level heartbeat orchestration.
  2. Isolate read cursors per account.
  3. Add deduplication guarantees per email UID.
- Dependencies: cron scheduler and SQLite storage model.
- Verification gates:
  1. Concurrent account polling does not cross-contaminate cursors.
  2. Duplicate intake is rejected by contract constraints.
- Definition of done: intake is stable across multiple active accounts.

### FP-010 Multi-Agent Draft Assembly Workflow
- Source: docs/bugs/resolved/GAP-022-email-desk-multi-agent-draft-gaps.md
- Target contract: docs/module/email-orchestrator-service.md
- Scope:
  1. Implement shared draft lifecycle and contribution merge rules.
  2. Enforce attribution and ordered section assembly.
  3. Add director review checkpoints before save.
- Dependencies: work order orchestration and policy rules.
- Verification gates:
  1. Contributions merge deterministically.
  2. Director approval required before final draft persist.
- Definition of done: collaborative draft flow is complete and auditable.

### FP-011 Email Heartbeat Scheduling and Recovery
- Source: docs/bugs/resolved/GAP-022-email-desk-multi-agent-draft-gaps.md
- Target contract: docs/module/email-cron-heartbeat.md
- Scope:
  1. Register per-account heartbeat jobs.
  2. Add missed-run catch-up behavior.
  3. Add fallback notification and degraded mode signaling.
- Dependencies: cron recovery and queue model.
- Verification gates:
  1. Missed heartbeats recover after restart.
  2. Heartbeat failures are visible in diagnostics.
- Definition of done: heartbeat execution is deterministic and observable.

## Traceability Table

| Plan ID | Source Gap File | Target Module Contract |
|:--|:--|:--|
| FP-001 | docs/bugs/resolved/prana-standalone-config-hardcoding-gap-2026-03-28.md | docs/module/props-config-principle.md |
| FP-002 | docs/bugs/resolved/cron-catchup-recovery-gap-2026-03-28.md | docs/module/cron-recovery-contract.md |
| FP-003 | docs/bugs/resolved/vault-sqlite-sync-gap-2026-03-28.md | docs/module/vault-sync-contract.md |
| FP-004 | docs/bugs/resolved/GAP-013-business-context-registry-alignment.md | docs/module/onboarding-registry-approval.md |
| FP-005 | docs/bugs/resolved/GAP-014-business-alignment-cross-reference.md | docs/module/onboarding-hybrid-explorer-governance-lifecycle.md |
| FP-006 | docs/bugs/resolved/GAP-017-governance-review-ui-enhancements.md | docs/reference/module/management-suite.md |
| FP-007 | docs/bugs/resolved/GAP-019-model-context-window-runtime-capture.md | docs/module/onboarding-model-configuration.md |
| FP-008 | docs/bugs/resolved/GAP-020-global-collaboration-handshake-and-agent-directory.md | docs/module/master-spec.md |
| FP-009 | docs/bugs/resolved/GAP-022-email-desk-multi-agent-draft-gaps.md | docs/module/email-management.md |
| FP-010 | docs/bugs/resolved/GAP-022-email-desk-multi-agent-draft-gaps.md | docs/module/email-orchestrator-service.md |
| FP-011 | docs/bugs/resolved/GAP-022-email-desk-multi-agent-draft-gaps.md | docs/module/email-cron-heartbeat.md |

## Exit Criteria Before Phase 2 Coding
1. Every feature-gap file is represented by one or more FP items in this document.
2. Module docs contain target acceptance criteria that match FP scope.
3. Defect-only bug log remains clean from pure feature narratives.
4. Wave order is approved by Director for implementation kickoff.
