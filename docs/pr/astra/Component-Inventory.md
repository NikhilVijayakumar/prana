# Component Inventory (Prana -> Astra)

## Scope
Audit target: `src/ui`

Goal:
- Identify reusable TSX components that can be generalized in ASTRA.
- Keep business workflows in Prana.

## Master List

| # | Component | Layer Bucket | Path | Coupling | Promotion Status |
|---|---|---|---|---|---|
| 1 | ReviewActionModal | Organism | src/ui/shared-components/ReviewActionModal.tsx | Low | Proposed |
| 2 | SyncHealthWidget | Organism | src/ui/shared-components/SyncHealthWidget.tsx | Low | Proposed |
| 3 | PhaseProgressIndicator | Atomic | src/ui/onboarding/presentation/components/PhaseProgressIndicator.tsx | Low | Proposed |
| 4 | PlaceholderPage | Atomic | src/ui/shared-components/PlaceholderPage.tsx | Low | Proposed |
| 5 | ModelProviderForm | Molecular | src/ui/onboarding/presentation/components/ModelProviderForm.tsx | Medium | Proposed with adapter notes |
| 6 | SkillRegistry | Molecular | src/ui/onboarding/presentation/components/SkillRegistry.tsx | Medium | Proposed with adapter notes |
| 7 | EmployeeProfileEditor | Molecular | src/ui/onboarding/presentation/components/EmployeeProfileEditor.tsx | Medium | Proposed with adapter notes |
| 8 | DynamicProfileRenderer | Organism | src/ui/components/DynamicProfileRenderer.tsx | High | Keep in Prana |
| 9 | DirectorInteractionBar | Molecular | src/ui/components/DirectorInteractionBar.tsx | High | Keep in Prana |
| 10 | MainLayout shell fragments | Template | src/ui/layout/MainLayout.tsx | High | Keep in Prana |

## Coupling Validation Rules
- Promote only components that do not import main-process services/repositories.
- Domain-specific types must be abstracted behind neutral prop contracts before ASTRA landing.
- Keep route/state orchestration in Prana.

## PR Slice Mapping
- Atomic package details: `docs/pr/astra/01-Atomic-Elements.md`
- Molecular package details: `docs/pr/astra/02-Molecular-Layouts.md`
- Organism package details: `docs/pr/astra/03-Organism-Complex-UI.md`

## Validation Status
- Deep import risk from `@astra/...`: not present in current Prana UI.
- Legacy internal alias risk from `@prana/...`: resolved in code (only stale comment found).
