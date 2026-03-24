# Prana Consolidated Bug and Gap Log (2026-03-25)

Source ledgers reviewed:
- `docs/reference/issue/prana/Engine/Logic/PRANA-ENGINE-VIOLATIONS-2026-03-25.md`
- `docs/reference/bugs/Dhi Executive/IMPLEMENTATION-VIOLATION-AUDIT-2026-03-25.md`
- `docs/reference/bugs/Dhi Executive/VIDHAN-MIGRATION-AUDIT-2026-03-25.md`

This log classifies each verified item as:
- Bug: existing behavior is broken or unsafe
- Gap: expected capability is missing or incomplete

## [CRITICAL] BUG-001 - Local config path residue in separate-repo model
Type: Bug
Status: RESOLVED (2026-03-25)

Evidence:
- `electron.vite.config.ts` references `packages/prana/main/index.ts` while workspace implementation is under `src/main/index.ts`.
- `tsconfig.node.json` and `tsconfig.web.json` include `packages/prana/*` and related package globs not present in workspace.

Impact:
- High risk of broken builds/tooling and invalid import graph assumptions.

Action:
- Re-align local build and TS path mappings to actual repository layout (`src/*`). Keep cross-repo reuse through Git dependencies in consuming app `package.json` files.

## [CRITICAL] BUG-002 - Recovery execution loop contains placeholder command executor
Type: Bug
Status: RESOLVED (2026-03-25)

Evidence:
- `src/main/services/recoveryService.ts` has `executeCommand` TODO placeholder returning synthetic success.

Impact:
- Recovery behavior can report success without executing real remediation steps.

Action:
- Implement real process execution with timeout, stdout/stderr handling, and exit-code enforcement.

Resolution summary:
- `src/main/services/recoveryService.ts` now executes commands via `node:child_process` (`spawn` + `shell: true`).
- Added timeout enforcement, stdout/stderr capture, explicit non-zero exit handling for primary and cleanup commands.
- `http_check` success checks now perform real HTTP GET verification against expected status.

## [CRITICAL] BUG-003 - Prana shared engine still has Dhi-coupled runtime defaults
Type: Bug
Status: RESOLVED (2026-03-25)

Evidence:
- `src/main/services/runtimeConfigService.ts` default director email uses `director@dhi.local`.
- `src/ui/constants/employeeDirectory.ts` uses absolute Dhi-specific resources path.
- `src/ui/onboarding/repo/OnboardingRepository.ts` and onboarding types include `~/.dhi` paths.

Impact:
- Violates app-neutral shared engine contract and increases cross-app migration friction.

Action:
- Introduce app-level branding and path injection; keep neutral defaults in shared layer.

Resolution summary:
- `src/main/services/runtimeConfigService.ts` now uses neutral defaults (`director@prana.local`, `vault_export_`) and supports `PRANA_*` env keys with legacy `DHI_*` fallback compatibility.
- `src/ui/constants/employeeDirectory.ts` replaced absolute `file:///E:/Python/dhi/resources/` path with injected `VITE_EMPLOYEE_AVATAR_BASE_URL` (default `/resources/`).
- `src/ui/onboarding/repo/OnboardingRepository.ts` and `src/ui/onboarding/domain/onboarding.types.ts` moved fallback/path hints from `~/.dhi/...` to neutral `~/.prana/...`.

## [ENHANCEMENT] GAP-001 - Intent confirmation loop is partial, not generalized
Type: Gap
Status: RESOLVED (2026-03-25)

Evidence:
- `src/main/services/toolPolicyService.ts` requires explicit approval for `vault.publish` only.
- No centralized confirmation policy for all high-impact mutating actions.

Impact:
- Inconsistent user confirmation semantics across destructive or sensitive operations.

Action:
- Add policy matrix that enforces confirmation for every mutation class (write/delete/publish/exec/escalation).

Resolution summary:
- `src/main/services/toolPolicyService.ts` now includes a mutation policy matrix that classifies actions and enforces explicit approval for mutating classes.
- `vault.publish` continues to produce explicit director-approval semantics; other mutation classes now return `mutation_approval_required` when confirmation is missing.

## [ENHANCEMENT] GAP-002 - Vault reflection loop not implemented
Type: Gap
Status: RESOLVED (2026-03-25)

Evidence:
- Policy checks exist pre-action, but no explicit post-action reflection gate before commit finalization.

Impact:
- Reduced auditability and reduced safety in complex mutation chains.

Action:
- Add reflection phase: evaluate action intent, result, policy fit, and human-approval evidence before final commit.

Resolution summary:
- Added `reflect()` and reflection telemetry in `src/main/services/toolPolicyService.ts`.
- Integrated post-action reflection calls into mutating IPC paths in `src/main/services/ipcService.ts` (`vault.publish`, `vault-knowledge.approve`, `vault-knowledge.reject`, `subagents.spawn`).

## [ENHANCEMENT] GAP-003 - Multi-agent architecture is bounded, not infinite-persona capable
Type: Gap
Status: RESOLVED (2026-03-25)

Evidence:
- `src/main/services/subagentService.ts` uses fixed depth limit (`MAX_DEPTH = 3`).
- `src/main/services/toolPolicyService.ts` denies subagent spawn above policy depth threshold.

Impact:
- Does not satisfy new Dhi requirement for effectively unbounded persona scaling.

Action:
- Move from hard depth cap to policy-driven dynamic graph controls with quotas, budgets, and adaptive limits.

Resolution summary:
- `src/main/services/subagentService.ts` removed fixed hard depth cap.
- Added adaptive guardrails: max active running agents and depth-aware branch fan-out limits.
- `src/main/services/toolPolicyService.ts` now enforces policy-driven quota checks using metadata (`depth`, `activeSubagents`, policy maxima) instead of fixed compile-time depth denial.

## [TECHNICAL-DEBT] TD-001 - Legacy schema contract diverges from implementation
Type: Gap
Status: OPEN

Evidence:
- Legacy contract in `docs/reference/monorepo/system/hybrid schema.md` defines canonical tables not fully mirrored by current runtime table naming and model split.

Impact:
- Documentation trust gap, onboarding confusion, migration risk.

Action:
- Either implement canonical schema or publish an explicit compatibility matrix and migration notes.

## [TECHNICAL-DEBT] TD-002 - Legacy docs mention feature sets without matching service implementation
Type: Gap
Status: PARTIALLY RESOLVED (documentation status labeling)

Evidence:
- Feature docs for email heartbeat and draft sync exist, but dedicated email service implementation is not present under `src/main/services/*email*`.

Impact:
- Product expectation drift and incomplete operational readiness.

Action:
- Implement missing services or mark docs as future scope and update status labels.

Resolution summary:
- Email capability documents now include explicit future-scope labeling pending dedicated runtime service implementation.

## Relevance decision for legacy bug cleanup

Carried forward into active log:
- Shared engine Dhi coupling issues (still relevant to standalone Prana quality).
- Build/contract drift impacting Dhi integration.
- Migration residue that still affects runtime assumptions.

Not carried as active standalone blockers:
- Purely Dhi-side `astra` API mismatch lines that are outside Prana repository control.
- Historical notes that are already fixed and have no current runtime effect in this workspace.
