# Component Inventory (Prana -> Astra)

## Scope
Audit target: `src/ui`

Goal:
- Build a common-first promotion path in Prana.
- Propose only reusable, atomic/stateless-capable components to Astra.
- Keep route orchestration, app wiring, and strongly domain-coupled UI in Prana unless decomposed.

## Promotion Lanes
- **Lane A - Promote now**: already stateless or close to stateless; low coupling.
- **Lane B - Promote with refactor**: requires adapter/decomposition before Astra.
- **Lane C - Duplicate check in Astra**: map to existing Astra equivalent if present.
- **Lane D - Keep local / defer**: domain or orchestration coupling remains high.

## Master List

| # | Component | Layer Bucket | Path | Coupling | Promotion Lane | Risk | Effort | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | PhaseProgressIndicator | Atomic | src/ui/common/components/PhaseProgressIndicator.tsx | Low | Lane A | Low | < 30 min | Proposed |
| 2 | PlaceholderPage | Atomic | src/ui/common/components/PlaceholderPage.tsx | Low | Lane C | Medium | 30-45 min | Proposed |
| 3 | ReviewActionModal | Organism | src/ui/common/components/ReviewActionModal.tsx | Medium | Lane B | High | 2-4 hrs | Proposed with refactor |
| 4 | SyncHealthWidget | Organism | src/ui/common/components/SyncHealthWidget.tsx | Medium | Lane B | Medium | 1-2 hrs | Proposed with neutrality audit |
| 5 | ModelProviderForm | Molecular | src/ui/onboarding/presentation/components/ModelProviderForm.tsx | Medium | Lane B | Medium | 2-3 hrs | Proposed with adapter notes |
| 6 | SkillRegistry | Molecular | src/ui/onboarding/presentation/components/SkillRegistry.tsx | Medium | Lane B | Medium | 2-3 hrs | Proposed with adapter notes |
| 7 | EmployeeProfileEditor | Molecular | src/ui/onboarding/presentation/components/EmployeeProfileEditor.tsx | Medium-High | Lane B | High | 3-5 hrs | Proposed with DTO abstraction |
| 8 | AuthGuard suite (5 guards) | Infrastructure | Decomposed: [RouteGuards.tsx](src/ui/common/components/RouteGuards.tsx) + [Adapter](src/ui/components/AuthGuardAdapter.tsx) | Medium→Low | Lane B | High | 3-4 hrs | **Phase 2: Decomposed** |
| 9 | PreAuthLayout | Molecular Layout | Decomposed: [Frame](src/ui/common/components/PreAuthLayoutFrame.tsx) + [Adapter](src/ui/layout/PreAuthLayoutAdapter.tsx) | Medium→Low | Lane B | Medium | 1-2 hrs | **Phase 2: Decomposed** |
| 10 | MainLayout shell fragments | Organism/Layout | src/ui/layout/MainLayout.tsx | High | Lane D (unless split) | High | 4-6 hrs | Keep orchestration local |
| 11 | DirectorInteractionBar | Organism | src/ui/components/DirectorInteractionBar.tsx | High | Lane D (unless split) | High | 4-6 hrs | Keep local until decoupled |
| 12 | DynamicProfileRenderer | Organism | src/ui/components/DynamicProfileRenderer.tsx | High | Lane D (unless split) | High | 4-6 hrs | Keep local until lifecycle-neutral |

## Coupling Validation Gates (Mandatory)
A candidate is eligible for Astra only if all checks pass:
1. No direct import from main-process services or app-specific repositories.
2. No route/session orchestration.
3. Public API uses domain-neutral nouns and types.
4. Business state is externalized; UI is stateless from business perspective.
5. Localization and labels are caller-injected or reusable contract-safe.
6. Styling uses Astra/MUI token-driven values.

## Observed Usage Evidence (Current)
- DirectorInteractionBar usage from main shell:
  - `src/ui/layout/MainLayout.tsx` imports `prana/ui/components/DirectorInteractionBar`.
- DynamicProfileRenderer usage from onboarding view:
  - `src/ui/onboarding/view/OnboardingView.tsx` imports `prana/ui/components/DynamicProfileRenderer`.
- Onboarding component chain:
  - `OnboardingGatekeeper` -> `PhaseProgressIndicator`
  - `Phase1EmployeeManager` -> `EmployeeProfileEditor`, `SkillRegistry`
  - `Phase3ModelManager` -> `ModelProviderForm`

## Why high-impact candidates were added now
User-requested scope expansion requires planning for Common-first extraction before Astra handover. Therefore, guard/layout/interaction/rendering candidates are included with explicit decomposition gates rather than immediate promotion.

## PR Slice Mapping
- Atomic package details: `docs/pr/astra/01-Atomic-Elements.md`
- Molecular package details: `docs/pr/astra/02-Molecular-Layouts.md`
- Organism package details: `docs/pr/astra/03-Organism-Complex-UI.md`
- Handover and reimport contract: `docs/pr/astra/Handover-Contract.md`

## Validation Status
- Current Prana UI has no direct Astra deep import pattern in candidate files.
- Legacy internal alias concerns are outside this planning packet and should be rechecked during implementation PRs.
