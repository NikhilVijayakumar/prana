# Bug Triage Ledger

## Purpose
This ledger classifies every item in docs/bugs so defect tracking stays clean and feature planning is moved to contract-driven implementation plans.

Classification types:
- DEFECT: runtime or build behavior issue.
- FEATURE-GAP: missing capability or architectural layer.
- PROCESS-QUALITY: readiness/reporting quality issue.

## Triage Table

| File | Classification | Action | Migration Target |
|:--|:--|:--|:--|
| docs/bugs/resolved/esm-bundling-bug.md | DEFECT | Retain in bug log with resolved context | N/A |
| docs/bugs/resolved/legacy-internal-imports-bug.md | DEFECT | Retain in bug log with resolved context | N/A |
| docs/bugs/resolved/PRANA-CONSOLIDATED-LOG-2026-03-25.md | PROCESS-QUALITY | Retain as historical incident rollup | docs/module/master-spec.md |
| docs/bugs/resolved/PRANA-ENGINE-VIOLATIONS-2026-03-25.md | DEFECT | Retain with contract-violation summary | docs/module/props-config-principle.md |
| docs/bugs/resolved/prana-standalone-config-hardcoding-gap-2026-03-28.md | FEATURE-GAP | Migrate to implementation roadmap | docs/bugs/feature-implementation-plans.md |
| docs/bugs/resolved/cron-catchup-recovery-gap-2026-03-28.md | FEATURE-GAP | Migrate to implementation roadmap | docs/bugs/feature-implementation-plans.md |
| docs/bugs/resolved/GAP-004-readiness-checklist-accuracy.md | PROCESS-QUALITY | Retain as governance-quality control reference | docs/module/master-spec.md |
| docs/bugs/resolved/GAP-013-business-context-registry-alignment.md | FEATURE-GAP | Migrate to implementation roadmap | docs/bugs/feature-implementation-plans.md |
| docs/bugs/resolved/GAP-014-business-alignment-cross-reference.md | FEATURE-GAP | Migrate to implementation roadmap | docs/bugs/feature-implementation-plans.md |
| docs/bugs/resolved/GAP-015-sequential-governance-onboarding-chain.md | FEATURE-GAP | Migrate to implementation roadmap | docs/bugs/feature-implementation-plans.md |
| docs/bugs/resolved/GAP-017-governance-review-ui-enhancements.md | FEATURE-GAP | Migrate to implementation roadmap | docs/bugs/feature-implementation-plans.md |
| docs/bugs/resolved/GAP-018-context-compaction-and-token-budgeting.md | FEATURE-GAP | Keep as feature history and map to roadmap parity checks | docs/bugs/feature-implementation-plans.md |
| docs/bugs/resolved/GAP-019-model-context-window-runtime-capture.md | FEATURE-GAP | Migrate to implementation roadmap | docs/bugs/feature-implementation-plans.md |
| docs/bugs/resolved/GAP-020-global-collaboration-handshake-and-agent-directory.md | FEATURE-GAP | Migrate to implementation roadmap | docs/bugs/feature-implementation-plans.md |
| docs/bugs/resolved/GAP-022-email-desk-multi-agent-draft-gaps.md | FEATURE-GAP | Migrate to implementation roadmap | docs/bugs/feature-implementation-plans.md |
| docs/bugs/resolved/prana-reusability-gap-audit-2026-03-28.md | PROCESS-QUALITY | Retain as architecture quality evidence | docs/module/master-spec.md |
| docs/bugs/resolved/splash-startup-orchestration-gap-2026-03-28.md | FEATURE-GAP | Migrate to implementation roadmap | docs/bugs/feature-implementation-plans.md |
| docs/bugs/resolved/vault-sqlite-sync-gap-2026-03-28.md | FEATURE-GAP | Migrate to implementation roadmap | docs/bugs/feature-implementation-plans.md |

## Cleanup Rule
Feature-gap files remain for historical context but must not be treated as defect backlog. Active feature execution must be tracked in docs/bugs/feature-implementation-plans.md and corresponding module contracts.
