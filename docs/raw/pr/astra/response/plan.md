# Astra Plan and Deep Analysis (Prana Request)

Date: 2026-03-28

## Analysis Method

1. Reviewed all Prana request docs and candidate lanes.
2. Audited current Astra component export surfaces and existing implementations.
3. Applied decision rules from the Prana handover contract.
4. Selected implementation targets where reusable boundaries were clear.
5. Rejected net-new duplicates where Astra already had equivalent behavior.

## Fit Analysis By Candidate Group

### Atomic

- PhaseProgressIndicator: fit is high after replacing fixed 3-phase API with generic steps contract.
- PlaceholderPage: duplicate behavior already covered by HeroSection composition.
- PreAuthLayout frame extraction: fit is high as a neutral entry-shell primitive.

### Molecular

- ModelProviderForm, SkillRegistry, EmployeeProfileEditor: fit currently low-medium due domain DTO coupling and onboarding-specific naming/semantics. Deferred.

### Organism

- ReviewActionModal: duplicate-equivalent behavior already available as ReviewDecisionDialog in Astra. Mapped, not reimplemented.
- SyncHealthWidget: fit medium after reducing domain payload to generic summary/actions contract. Implemented as OperationHealthPanel plus adapter guidance.
- DirectorInteractionBar, DynamicProfileRenderer, MainLayout shell fragments: fit low for shared promotion due orchestration and app-domain coupling. Deferred.

## General Naming Outcomes

- PhaseProgressIndicator -> MultiStepProgressIndicator
- PreAuthLayout frame primitive -> EntryLayoutFrame
- SyncHealthWidget shell -> OperationHealthPanel

## Implementation Footprint

- Added new reusable components to Astra surface.
- Updated export barrel for astra/components imports.
- Produced complete response artifacts for Prana mapping and migration.

## Deferred Backlog Recommendations

1. Extract provider/profile/skill neutral DTO packages before UI promotion.
2. Define router/session guard contracts in Astra only after package-level router strategy is formalized.
3. Split orchestration-heavy components into view-only shared blocks plus app adapters.
