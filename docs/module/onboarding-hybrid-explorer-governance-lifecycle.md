# Onboarding: Hybrid Explorer & Governance Lifecycle Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- Hybrid explorer states and dependency-aware preview logic are fully documented.
- Runtime parity is improving but still partial across all routing and action-level gates.

## Target State
- Full preview-versus-active mode enforcement with deterministic action gating.
- Unified onboarding and management governance behavior with durable audit traces.

## Gap Notes
- Action-level dependency declarations and deep-link safety need complete parity coverage.

## Dependencies
- docs/module/onboarding-registry-approval.md
- docs/module/master-spec.md

## Acceptance Criteria
1. Preview users can explore safely without privileged mutation.
2. Action gates always return deterministic dependency diagnostics.
3. Completion transition immediately unlocks active mode and hides onboarding anchor.

## Immediate Roadmap
1. Complete action-level dependency precondition mapping.
2. Align deep-link handling with preview gating.
3. Integrate roadmap tracking with FP-004, FP-005, and FP-006.

## 1. Single Reason to Change (SRP)
This module defines the non-linear onboarding lifecycle that supports Home preview access while preserving strict dependency-based governance for any data commitment and agentic execution.

## 2. Objective
Introduce a Hybrid Explorer state that removes the onboarding hard wall for discovery, while enforcing the Stochastic Dependency Chain for all approvals and commits.

## 3. Core State Model

### 3.1 Global Onboarding Status
- `NOT_STARTED`: User has not approved any required phase.
- `IN_PROGRESS`: At least one phase is approved, but onboarding is not fully completed.
- `COMPLETED`: All required phases are approved and master commit has succeeded.

### 3.2 Experience Mode
- `PREVIEW`: User may browse Home and feature surfaces without committing dependency-bound actions.
- `ACTIVE`: Full execution and mutation actions are unlocked according to approved dependencies.

### 3.3 Effective Mode Resolution
- Effective mode is `PREVIEW` when onboarding status is `NOT_STARTED` or `IN_PROGRESS`.
- Effective mode becomes `ACTIVE` only when onboarding status is `COMPLETED`.

## 4. Explorer Navigation Logic

### 4.1 Skip to Home Provision
- Onboarding must expose a `Skip to Home` path at all times before completion.
- Skip action routes user to Home in `PREVIEW` mode.

### 4.2 Feature Gating in Preview
- Any feature requiring agentic execution (Goose, NemoClaw, OpenCLAW) must render in read-only preview.
- Mutation, execution, and commit actions are disabled until required dependencies are approved.
- Gated UI must present actionable rationale, including missing phase dependencies.

### 4.3 Return to Onboarding Anchor
- Home sidebar must show a `Back to Onboarding` link if onboarding status is not `COMPLETED`.
- Attempting to invoke a dependency-blocked action must show an inline CTA to resume onboarding at the first unmet phase.
- The sidebar link is dynamically hidden once onboarding status is `COMPLETED`.

## 5. Multi-Phase Preview and Strict Validation

### 5.1 Free Look-Ahead
- Users may navigate from Phase 1 through Phase 7 without entering data.
- Navigation freedom does not imply approval freedom.

### 5.2 Approve and Next Lock Rule
The `Approve and Next` action for phase `N` remains disabled unless all conditions hold:
1. Current phase payload satisfies the Minimum Viable Schema (MVS).
2. Every prior phase `1..N-1` is already approved.
3. Current phase is not already committed for the current revision.

### 5.3 Schema-Derived Validation
- Mandatory field checks must be programmatically derived from JSON schemas in `src/core/registry/schemas/`.
- UI must not hardcode required-field arrays when schema metadata exists.
- Validation output must map to user-facing field errors and gate status indicators.

### 5.4 Phase Map Visual Cues
Each phase in the map must expose one of:
- `DRAFT`: Data absent or present but not approved.
- `VALIDATED`: MVS passed but not yet approved.
- `LOCKED`: Not eligible for approval due to unmet previous dependencies.
- `APPROVED`: Phase approval completed and staged.

## 6. Unified Governance UI (Onboarding and Management)

### 6.1 Shared Component Contract
- Onboarding forms and Management Suite editors for Company/Product/Assets must use the same component and validation contracts.
- Any changes to Company or Product after onboarding must still follow Phase 1 -> Phase 2 sequence.

### 6.2 Draft-First Lifecycle
- All in-app registry updates are first staged as drafts into SQLite Hybrid DB.
- Director review is required before commit to Vault.
- No direct vault mutation is allowed from editing surfaces.

### 6.3 Context Integrity Rule
- Product-level updates cannot be committed if Company context is stale or invalid for the same revision window.
- Agent and infrastructure execution state must resolve against latest approved Company + Product context.

## 7. Dependency Chain Enforcement

### 7.1 Sequential Approval Backbone
The dependency chain remains strict even with non-linear navigation:
1. Company
2. Product
3. Assets
4. Agents
5. Infrastructure
6. Integration/Validation phases
7. Master Commit

### 7.2 Action-Level Dependency Checks
- Each action must declare required phase approvals.
- Runtime gate engine evaluates action preconditions against staged approval state.
- On failure, execution is blocked with deterministic dependency diagnostics.

## 8. Routing and UI Integration Requirements

### 8.1 Conditional Routing
- Electron routing layer must read global onboarding status to determine onboarding anchor visibility.
- Home and management routes remain accessible in preview mode, but privileged operations stay gated.

### 8.2 Sidebar Behavior
- Show `Back to Onboarding` only when status != `COMPLETED`.
- Hide the link immediately after completion state transition without requiring app restart.

### 8.3 Deep Link Safety
- Deep links to privileged screens in preview mode must route to read-only shell and expose unmet dependencies.

## 9. Persistence and Audit
- Hybrid DB persists phase drafts, phase approvals, and onboarding status transitions.
- Status transitions and approval attempts are audit logged with actor, timestamp, and result.
- Master commit writes approved snapshot to Vault and marks onboarding as `COMPLETED`.

## 10. Acceptance Criteria
1. User can skip onboarding and explore Home safely in preview mode.
2. Blocked feature attempts provide direct return-to-onboarding affordance.
3. Users can navigate all phases without data entry.
4. `Approve and Next` remains disabled until schema validity and previous approvals are satisfied.
5. Phase map displays Draft/Validated/Locked/Approved states consistently.
6. Post-onboarding Company/Product edits still enforce sequential context flow.
7. All updates stage to SQLite first; only Director-approved changes commit to Vault.
8. Sidebar onboarding anchor is visible only before completion.
9. Validation gating is sourced from schema metadata under `src/core/registry/schemas/`.

## 11. Non-Goals
- This module does not prescribe visual styling details.
- This module does not redefine domain schema payloads.
- This module does not replace existing governance queue semantics; it extends onboarding-state awareness into them.

## 12. Implementation References
- Existing approval flow baseline: `docs/module/onboarding-registry-approval.md`
- Existing post-onboarding governance baseline: `docs/module/management-suite.md`
- Existing policy governance editor baseline: `docs/module/governance-policy-editor.md`
