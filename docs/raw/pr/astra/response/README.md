# Prana <- Astra PR Response

Status: Ready for Prana consumption  
Date: 2026-03-28  
Astra Version: 0.0.9  
Astra Commit: 53af9ad

This file records Astra-side decisions and delivered artifacts. For current Prana-side adoption status, see the consumption snapshot below.

## What Was Completed

- Deep overlap review of all 12 Prana candidates against Astra exports.
- Duplicate proposals explicitly rejected as new components and mapped to existing Astra components.
- New accepted reusable components implemented with generalized naming.
- Full mapping artifacts delivered in Markdown and JSON.

## New Components Implemented In Astra

- MultiStepProgressIndicator (generalized from PhaseProgressIndicator)
- EntryLayoutFrame (generalized from PreAuthLayoutFrame/PreAuthLayout shell)
- OperationHealthPanel (generalized shell from SyncHealthWidget use case)

## Duplicate Decisions (Rejected As New)

- PlaceholderPage -> map to HeroSection (existing Astra surface)
- ReviewActionModal -> map to ReviewDecisionDialog (existing Astra surface)

## Deferred Decisions

- ModelProviderForm
- SkillRegistry
- EmployeeProfileEditor
- AuthGuard suite
- DirectorInteractionBar
- DynamicProfileRenderer
- MainLayout shell fragments

Each deferred item includes explicit rationale and revisit triggers in HANDOVER_CONTRACT and Mapping-Prana.

## Prana Consumption Snapshot (2026-03-29)

- EntryLayoutFrame integration complete via `src/ui/layout/PreAuthLayoutAdapter.tsx`.
- MultiStepProgressIndicator integration complete via `src/ui/onboarding/presentation/containers/OnboardingGatekeeper.tsx`.
- PlaceholderPage duplicate replacement complete; HeroSection is used directly in 11 `src/ui` files.
- Local wrappers removed after parity checks:
	- `src/ui/common/components/PhaseProgressIndicator.tsx`
	- `src/ui/common/components/PlaceholderPage.tsx`
	- `src/ui/common/components/ReviewActionModal.tsx`
	- `src/ui/common/components/SyncHealthWidget.tsx`
	- `src/ui/common/components/PreAuthLayoutFrame.tsx`
	- `src/ui/shared-components/*` shim files for the above components
- ReviewDecisionDialog is not yet actively consumed in Prana `src/ui`.
- OperationHealthPanel is not yet actively consumed in Prana `src/ui`.
- Remaining local common package surface: `src/ui/common/components/RouteGuards.tsx`.

## Read Order

1. INDEX.md
2. Mapping-Prana.md
3. HANDOVER_CONTRACT.md
4. mapping-report.prana.json
5. INTEGRATION_SUMMARY.md
6. plan.md
