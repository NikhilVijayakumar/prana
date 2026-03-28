# Prana <- Astra Handover Contract (Response)

Date: 2026-03-28  
Astra Version: 0.0.9  
Astra Commit: 53af9ad

## 1. Scope Outcome

This response covers all candidates from the Prana request package and applies the required decision semantics:

- Approved with rename or contract adaptation when reusable in Astra.
- Duplicate mapped when Astra already provides equivalent component behavior.
- Deferred when domain or orchestration coupling remains too high for shared promotion.

## 2. Final Decisions

### Approved and implemented

- PhaseProgressIndicator -> MultiStepProgressIndicator
- SyncHealthWidget -> OperationHealthPanel (via adapter in Prana)
- PreAuthLayout -> EntryLayoutFrame (keep branding wrapper in Prana)

### Duplicate mapped (new proposal rejected)

- PlaceholderPage -> HeroSection
- ReviewActionModal -> ReviewDecisionDialog

### Deferred

- ModelProviderForm
- SkillRegistry
- EmployeeProfileEditor
- AuthGuard suite
- DirectorInteractionBar
- DynamicProfileRenderer
- MainLayout shell fragments

## 3. Why Deferred Items Were Not Promoted

- ModelProviderForm: provider-specific schema and connectivity semantics remain app-domain specific.
- SkillRegistry: skill catalog model and onboarding namespace coupling remain unresolved.
- EmployeeProfileEditor: lifecycle-profile DTO assumptions and metadata schema are still product-specific.
- AuthGuard suite: router/session policy coupling not yet represented in Astra package contracts.
- DirectorInteractionBar: direct channel and workflow orchestration side effects.
- DynamicProfileRenderer: lifecycle-specific type coupling.
- MainLayout shell fragments: route/session composition policy remains app-local.

## 4. Migration Phases For Prana

### Phase A (rename-only / low risk)

- PreAuthLayout -> EntryLayoutFrame where only frame behavior is needed.

### Phase B (contract migration)

- PhaseProgressIndicator -> MultiStepProgressIndicator
- SyncHealthWidget -> OperationHealthPanel
- ReviewActionModal -> ReviewDecisionDialog (already available in Astra)

### Phase C (duplicate replacement)

- PlaceholderPage -> HeroSection

### Phase D (deferred)

- Keep deferred components in Prana until revisit triggers are met.

## 5. Safety Gates

Proceed phase-by-phase only when current phase is clean:

1. Typecheck passes.
2. Build passes in Prana and Astra consumption workspace.
3. UI smoke checks pass for impacted routes.
4. No unresolved imports to retired local components.

## 6. Revisit Triggers For Deferred Components

Promote deferred components only after these conditions are satisfied:

- Public contracts use domain-neutral DTOs.
- No direct route/session/main-process orchestration in promoted component.
- Labels/messages are externalized and caller-injected.
- App-level side effects are moved into adapters or viewmodel containers.
