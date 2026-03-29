# Master E2E Plan

## 1. Scope

This plan covers all user-visible Prana screens and critical backend-driven flows visible through UI behavior.

In scope:

- Startup and splash orchestration
- Authentication and recovery
- Onboarding and setup flows
- Dashboard and operational modules
- Registry management UIs
- Queue, notifications, and email workflows
- Settings/profile and persistence checks
- Recovery and restart behavior

Out of scope:

- Low-level unit behavior already validated in service unit tests
- External provider correctness beyond handshake/health and app-facing contract behavior

## 2. Coverage Contract

A run is only considered complete when:

1. Every known screen id appears in the screen inventory.
2. Every screen id has at least one mapped E2E scenario.
3. Every E2E scenario maps back to one or more screen ids.
4. No dead-end navigation remains (Back/Home escape path always available).

## 3. Test Depth Rules

For each scenario, verify:

- Entry path and exit path
- Required visible elements rendered and readable
- Primary action path (click/type/submit)
- Secondary navigation path
- Keyboard focus order for key controls
- Hover behavior where UI state changes are expected
- Animation/transition does not hide or block actionable controls
- Error/empty state handling where applicable

## 4. Execution Waves

### Wave A: Navigation Completeness

- Validate all route/screen entry points.
- Confirm no orphan screen in inventory output.
- Confirm no unreachable menu branch.

### Wave B: Core Interaction Reliability

- Validate all primary user actions per screen.
- Validate key integration flows end to end.
- Validate persisted state behavior on refresh/reopen where relevant.

### Wave C: Exhaustive Edge and UX Quality

- Hover/focus/animation assertions in critical screens.
- Error paths and fallback paths.
- Recovery scenarios (restart, interrupted tasks, delayed jobs).

## 5. LM Studio Runtime Policy

- Model-dependent runtime paths must use local LM Studio endpoint and model from `.env.test`.
- E2E run fails fast if LM Studio preflight fails.
- Reporting and assertion logic remains deterministic and code-driven.

## 6. Quality Gates

Pre-run gates:

- Build succeeds
- LM Studio preflight succeeds
- Sandbox branch guard succeeds
- Fixture startup succeeds

Post-run gates:

- Screen coverage report generated
- Required evidence artifacts generated
- Missing screen count reviewed
- Critical failures triaged with issue entries

## 7. Ownership

- Test author updates scenario mapping.
- Reviewer validates screen traceability and orphan count.
- Release owner signs off only after quality report and checklist pass.
