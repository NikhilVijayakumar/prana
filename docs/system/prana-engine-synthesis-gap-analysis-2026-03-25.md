# Prana Engine Synthesis and Gap Analysis (2026-03-25)

## Scope
This audit compares the current Prana implementation in `src` against:
- Goose reference patterns (`goose-main`)
- NemoClaw reference patterns (`NemoClaw-main`)
- OpenClaw reference patterns (`openclaw-main`)
- Legacy monorepo specs (`docs/reference/monorepo` and `docs/reference/core`)
- Legacy issue/bug ledgers (`docs/reference/issue/prana` and `docs/reference/bugs`)

## Executive Summary
Prana already has meaningful building blocks for recovery, policy checks, cron persistence, context compaction, and subagent lifecycle management. However, there are critical implementation and architecture gaps that block full parity with Goose/Nemo/OpenClaw extraction goals and weaken Prana-as-foundation for Dhi.

Top blockers:
1. Legacy local config path residue (`packages/prana/*`) versus actual repository layout (`src/*`) inside this Prana repo.
2. Recovery loop implementation is partially stubbed (`executeCommand` placeholder), so recovery behavior is not production-grade.
3. Shared-engine neutrality is not complete (`dhi.local`, `~/.dhi`, absolute Dhi resource path).
4. Multi-agent scalability is depth-limited and policy-capped, not aligned with the new "Dhi infinite personas" direction.

## 1) Reference Alignment Audit

### 1.1 The Goose Factor (Robustness)

What Prana has:
- Structured retry and backoff orchestration in `src/main/services/recoveryService.ts`.
- Error classification and retry bookkeeping.
- Cron queue persistence and restart recovery in `src/main/services/cronSchedulerService.ts` and `src/main/services/governanceLifecycleQueueStoreService.ts`.
- Sync recovery orchestration in `src/main/services/recoveryOrchestratorService.ts` and `src/main/services/syncProviderService.ts`.

What is missing or weak:
- `recoveryService.executeCommand` is a TODO placeholder that currently returns synthetic success output; this makes the loop behavior non-authoritative in production.
- `validateSuccessCheck` contains placeholder logic for assertion and HTTP checks.
- Intent confirmation is narrow and action-specific (mainly `vault.publish`) rather than a generalized mutation confirmation loop similar to Goose tool confirmation flows.

Assessment:
- Current behavior trends toward "correct" in design but can still effectively "pass through" due to stubbed execution paths.
- Status: Partial parity, not robust parity.

### 1.2 The NemoClaw Factor (Security)

What Prana has:
- Policy enforcement gateway at IPC boundary (`src/main/services/ipcService.ts`, `src/main/services/toolPolicyService.ts`).
- Path restriction and loop guardrails in `toolPolicyService`.
- Runtime policy/compliance constructs in `src/main/services/protocolInterceptor.ts` and `src/main/services/policyOrchestratorService.ts`.
- Encrypted snapshot storage flow in `src/main/services/syncStoreService.ts`.

What is missing or weak:
- No deny-by-default sandbox/e-gress policy system equivalent to Nemo/OpenShell runtime enforcement.
- No explicit reflection loop that performs post-action policy reflection before final commit on sensitive vault operations.
- Approval model is not uniformly applied across all high-impact mutations.

Assessment:
- Guardrails exist but are not yet enterprise-grade parity with NemoClaw baseline policy model.
- Status: Medium maturity, not enterprise parity.

### 1.3 The OpenClaw Factor (Multi-Agent/Channel)

What Prana has:
- Subagent lifecycle tracking with telemetry and tree in `src/main/services/subagentService.ts`.
- Context delegation support in `src/main/services/contextEngineService.ts`.
- Runtime channel configuration in `src/main/services/operationsService.ts`.

What is missing or weak:
- Hard subagent depth limit (`MAX_DEPTH = 3`) and explicit policy depth blocking for `subagents.spawn` in `toolPolicyService`.
- No evidence of dynamic infinite-persona orchestration model equivalent to OpenClaw multi-agent routing strategy.
- Current architecture is bounded and governance-driven rather than unbounded persona expansion.

Assessment:
- Useful multi-agent foundation exists, but "infinite personas" is currently a future capability, not current capability.
- Status: Foundational only.

## 2) Documentation and Implementation Gap Analysis

### 2.1 Legacy vs Reality (Legacy docs vs current code)

Observed gaps:
- Legacy docs define canonical hybrid schema tables (`queue_jobs`, `cron_definitions`, `cron_runs`, etc.), but implementation currently uses a split data model (`task_queue`, `task_audit_log`, `sync_queue`, etc.) and does not fully mirror the canonical contract.
- Legacy docs describe richer email cron heartbeat and email draft sync behavior; codebase currently has docs for those features but no corresponding dedicated email services in `src/main/services/*email*`.
- Legacy docs and some local configs still imply a package-style layout. Current workspace implementation is mostly `src/*`, and local build/type configs still reference `packages/prana/*`.

### 2.2 Orphaned Feature Check

Likely orphaned or partially ported:
- Email heartbeat orchestration service behavior in doc contract is not represented by a dedicated service implementation.
- Email draft sync/contribution pipeline appears documented but not implemented as standalone services.
- Canonical hybrid schema tables and retention contracts are not fully implemented exactly as specified in legacy reference.

### 2.3 Path Alignment (@app/core -> @prana)

Result:
- No `@app/core` references were found in reviewed current files.
- In this separate-repo model, dependency sharing should happen through Git-based package dependencies in consuming apps (for example `"prana": "github:<org>/prana"`).
- Local namespace/config drift remains: current config files still reference non-existent `packages/prana/*` paths while source lives in `src/*`.

## 3) Dependency Audit (Prana as Dhi foundation)

### 3.1 Circular dependency risk (UI back-reference)

Current state:
- No direct `src/main` imports from UI modules were observed in reviewed files.
- However, Prana still contains Dhi-specific coupling in runtime/UI data:
  - `director@dhi.local` default in `src/main/services/runtimeConfigService.ts`
  - `~/.dhi` hardcoded governance paths in onboarding UI repository logic
  - Absolute Dhi resource path in `src/ui/constants/employeeDirectory.ts`

### 3.2 Build graph health

Critical local mismatch:
- `electron.vite.config.ts`, `tsconfig.node.json`, and `tsconfig.web.json` point to `packages/prana/*` and related package folders not present in this workspace.
- This indicates unresolved migration residue in local config and a high risk of broken builds or stale assumptions.

Conclusion:
- Prana is not yet a clean, app-neutral base for Dhi due to local path/config residue and embedded Dhi assumptions.

## 4) What Prana Has vs What Prana Needs

### What Prana Has
- Core context engine with compaction and digest persistence.
- Cron scheduler with queue persistence and restart recovery.
- Policy enforcement primitives and vault operation controls.
- Subagent lifecycle and delegation telemetry.
- Encrypted sync snapshot pipeline and machine lock handling.

### What Prana Needs From Goose
- Real command execution inside recovery loops (remove placeholder behavior).
- Full success-check implementation (assertion and HTTP checks).
- Generalized intent confirmation loop for all high-impact mutations.

### What Prana Needs From NemoClaw
- Deny-by-default runtime security envelope for sensitive operations.
- Stronger policy tiers and explicit approval workflows beyond one-off action checks.
- Reflection loop before finalizing sensitive vault/policy mutations.

### What Prana Needs From OpenClaw
- Scalable multi-agent routing model beyond fixed depth.
- Persona management model that supports dynamic growth and channel binding at scale.
- Governance controls for large persona graphs instead of static/depth-limited rules.

## 5) Consolidated Gap Severity Snapshot

Critical:
- Local build/config path residue to non-existent `packages/*` paths.
- Recovery command execution stub prevents true Goose-grade recovery reliability.
- Shared library still contains Dhi-coupled defaults and paths.

Enhancement:
- Expand intent confirmation coverage to all risky tool actions.
- Add reflection loops for vault-sensitive operations.
- Extend multi-agent architecture toward dynamic persona scale.

Technical debt:
- Align legacy docs/contracts with actual schema names and runtime behavior.
- Remove residual Dhi-specific literals from reusable engine code.
