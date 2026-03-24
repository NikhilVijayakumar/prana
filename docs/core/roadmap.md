# Prana Roadmap - Gap Closure Plan (2026-Q2 to 2026-Q3)

## Priority 0 - Critical Stabilization

### 1. Fix local build graph residue
Owner: Platform
Status: Planned

Tasks:
- Replace legacy `packages/prana/*` local build entries with actual `src/*` entry points in `electron.vite.config.ts`.
- Update `tsconfig.node.json` and `tsconfig.web.json` includes/paths to match real local source layout.
- Preserve cross-repo composition through Git dependencies in consuming app `package.json` files.
- Validate `npm run typecheck` and `npm run build` after path migration.

Acceptance criteria:
- No references to non-existent package paths in active build configs.
- Clean typecheck and build in this workspace.

### 2. Replace recovery placeholders with production execution
Owner: Runtime
Status: Planned

Tasks:
- Implement `executeCommand` in `src/main/services/recoveryService.ts` using robust child-process execution.
- Implement assertion and HTTP success checks in `validateSuccessCheck`.
- Add tests for transient vs permanent classification behavior with actual command outcomes.

Acceptance criteria:
- Recovery loop executes real commands and fails correctly on non-zero exit.
- Success checks are fully functional and tested.

### 3. Remove Dhi-coupled defaults from shared Prana runtime
Owner: Core Runtime + UI
Status: Planned

Tasks:
- Replace hardcoded `director@dhi.local` defaults with neutral values and app-injected config.
- Replace absolute Dhi resource path in employee avatar resolver with configurable path provider.
- Remove or parameterize `~/.dhi` path assumptions in onboarding repository flow.

Acceptance criteria:
- Shared engine contains no app-branded runtime defaults.
- Branding and tenant paths are injected per consuming app.

## Priority 1 - Security and Governance Hardening

### 4. Generalize intent confirmation loop (Goose parity)
Owner: Security Runtime
Status: Planned

Tasks:
- Define high-impact action classes (write, delete, publish, external execute, policy mutate).
- Extend `toolPolicyService` so these classes require explicit confirmation, not only `vault.publish`.
- Emit audit entries for request, approval, denial, and timeout states.

Acceptance criteria:
- All configured mutation classes are consistently confirmation-gated.
- Policy behavior is test-covered.

### 5. Add reflection loop for vault-sensitive operations (Nemo parity)
Owner: Security Runtime
Status: Planned

Tasks:
- Introduce post-action reflection stage before final commit publication.
- Validate action intent, effect, policy compliance, and approval evidence.
- Block publish if reflection fails and emit structured compliance event.

Acceptance criteria:
- Sensitive commit paths cannot complete without reflection pass.
- Reflection outcomes are observable in telemetry/audit logs.

### 6. Define deny-by-default external execution/network profile
Owner: Security Platform
Status: Planned

Tasks:
- Introduce explicit allowlist policy model for risky external interactions.
- Integrate with existing policy/interceptor services.
- Provide override channel with approval and audit trace.

Acceptance criteria:
- Policy defaults deny unknown external actions.
- Overrides are explicit, time-bound, and audited.

## Priority 2 - Multi-Agent and Channel Scale (OpenClaw parity path)

### 7. Evolve subagent depth model to policy-governed scaling
Owner: Multi-Agent Runtime
Status: Planned

Tasks:
- Replace static depth constants with policy-governed dynamic limits.
- Add per-session and per-agent budget controls (token, concurrency, timeout).
- Implement graph safety checks (cycles, runaway fan-out, orphan handling).

Acceptance criteria:
- Subagent scale is configurable and safe without hardcoded low-depth ceiling.
- Telemetry includes depth, fan-out, budget, and timeout metrics.

### 8. Persona registry and dynamic agent provisioning
Owner: Registry + Runtime
Status: Planned

Tasks:
- Add runtime persona registry source of truth.
- Support agent provisioning and retirement without code changes.
- Map persona-to-channel bindings with policy checks.

Acceptance criteria:
- New personas can be introduced through governed config updates.
- Channel routing honors approved persona bindings.

## Priority 3 - Legacy Contract Reconciliation

### 9. Hybrid schema contract alignment
Owner: Data Platform
Status: Planned

Tasks:
- Compare implemented SQLite schema with legacy canonical contract.
- Either implement missing canonical tables or publish explicit compatibility map.
- Add retention/compaction jobs where contract requires.

Acceptance criteria:
- Single authoritative schema reference matches runtime behavior.
- Migration notes exist for renamed/replaced tables.

### 10. Email orchestration feature parity decision
Owner: Product + Runtime
Status: Planned

Tasks:
- Confirm whether email heartbeat/draft sync docs represent required scope.
- If required: implement missing services and queue integration.
- If deferred: mark docs as future and remove "implemented" ambiguity.

Acceptance criteria:
- Doc status and code reality are aligned.
- No orphaned "implemented" claims without backing services.

## Dependency Integrity Gate

### 11. Prana as foundation gate for Dhi
Owner: Architecture
Status: Planned

Tasks:
- Add CI check that blocks direct Dhi-coupled constants/paths in shared runtime.
- Add import-boundary rule to prevent main-service back coupling into app UI layers.
- Add config sanity check for nonexistent include/alias targets.

Acceptance criteria:
- Foundational package rules are enforced automatically in CI.
- Circular or reverse coupling regressions are caught before merge.
