# Prana Reusability Gap Audit (2026-03-28)

## Status (2026-03-28)
Overall: CLOSED for Prana-side scope.

Resolution evidence:
1. ASTRA handover packet exists under `docs/pr/astra`.
2. Components are classified into promote/keep groups with coupling rationale.
3. Mapping templates and handover contract are defined for ASTRA implementation phase.

## Purpose
Identify UI modules that can be generalized for ASTRA promotion and list coupling gaps that should stay in Prana until contracts are split.

## Scope
- Directory focus: `src/ui/**`
- Promotion target: `docs/pr/astra` packet for ASTRA review
- Constraint: preserve business logic and intent

## Candidate Classification

### Strong Promotion Candidates (Low Coupling)
1. ReviewActionModal wrapper (`src/ui/shared-components/ReviewActionModal.tsx`) — retired
- Local wrapper removed during Astra migration cleanup.
- Astra target is `ReviewDecisionDialog`; currently not yet actively consumed in `src/ui`.

2. SyncHealthWidget wrapper (`src/ui/shared-components/SyncHealthWidget.tsx`) — retired
- Local wrapper removed during Astra migration cleanup.
- Astra target is `OperationHealthPanel`; currently not yet actively consumed in `src/ui`.

3. PhaseProgressIndicator wrapper (`src/ui/onboarding/presentation/components/PhaseProgressIndicator.tsx`) — retired
- Wrapper removed after migration to direct `MultiStepProgressIndicator` usage in onboarding container.

4. Placeholder wrappers
- `src/ui/common/components/PlaceholderPage.tsx` and `src/ui/shared-components/PlaceholderPage.tsx` were retired.
- Replacement is direct `HeroSection` usage in container/view files.

### Medium Candidates (Needs API Generalization)
1. `src/ui/onboarding/presentation/components/SkillRegistry.tsx`
- Reusable pattern, but domain shape (`VirtualEmployeeProfile`) is onboarding-specific.

2. `src/ui/onboarding/presentation/components/ModelProviderForm.tsx`
- Reusable config-card pattern, but provider vocabulary is specific.

3. `src/ui/onboarding/presentation/components/EmployeeProfileEditor.tsx`
- Useful editing shell, but currently coupled to lifecycle profile model.

### Keep in Prana (High Coupling)
1. `src/ui/components/DynamicProfileRenderer.tsx`
- Direct lifecycle state/domain coupling.

2. `src/ui/components/DirectorInteractionBar.tsx`
- Coupled to employee directory constants and Prana sender identity constants.

3. `src/ui/layout/MainLayout.tsx`
- App shell with navigation/route/state coupling.

## Gap Register

### GAP-REUSE-001: Domain types leak into reusable presentation candidates
Type: Contract boundary gap
Severity: Medium

Evidence:
- Onboarding presentation components import domain-specific types from `onboarding.types`.

Impact:
- ASTRA promotion becomes app-model-dependent.

Required fix:
- Define ASTRA-facing prop contracts with neutral interfaces.
- Keep adapters in Prana where domain mapping is required.

---

### GAP-REUSE-002: App shell components mixed with reusable UI blocks
Type: Layering gap
Severity: Medium

Evidence:
- `MainLayout` composes route and state concerns with visual shell concerns.

Impact:
- Hard to extract shared UI without pulling business dependencies.

Required fix:
- Promote only leaf presentation components to ASTRA.
- Keep shell orchestration in Prana.

---

### GAP-REUSE-003: Missing formal Prana->ASTRA promotion packet in repository
Type: Process gap
Severity: High

Evidence:
- `docs/pr/astra` package did not exist before this implementation round.

Impact:
- No reviewable handover contract or mapping traceability.

Required fix:
- Create `docs/pr/astra` with inventory, atomic/molecular/organism docs, mapping templates, and handover contract.

## Acceptance Criteria
1. PR packet exists under `docs/pr/astra` and follows reference format.
2. Each candidate includes contract notes and migration implications.
3. Mapping placeholders are ready for ASTRA team response.
4. No proposal modifies Prana business logic intent.

All criteria above are satisfied in this repository.
