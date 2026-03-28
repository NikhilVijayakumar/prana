# Prana -> Astra Mapping (Response)

Status: Completed  
Astra Version: 0.0.9  
Astra Commit: 53af9ad  
Date: 2026-03-28

| Old Component | New Astra Component | Old Import | New Import | Status | Phase | Priority | Effort | Breaking Prop Changes | Migration Notes |
|---|---|---|---|---|---|---|---|---|---|
| PhaseProgressIndicator | MultiStepProgressIndicator | import { PhaseProgressIndicator } from 'prana/ui/common/components/PhaseProgressIndicator' | import { MultiStepProgressIndicator } from 'astra/components' | mapped | B | MEDIUM | 30-60 min | API changed from fixed phase props to steps array + currentStepId | Build steps with ids/labels/status and pass currentStepId from container state |
| PlaceholderPage | HeroSection | import { PlaceholderPage } from 'prana/ui/common/components/PlaceholderPage' | import { HeroSection } from 'astra/components' | duplicate | C | MEDIUM | 15-30 min | headline/code contract replaced by headline/description composition | Reject as net-new; map to HeroSection and compose description from route context |
| ReviewActionModal | ReviewDecisionDialog | import { ReviewActionModal } from 'prana/ui/common/components/ReviewActionModal' | import { ReviewDecisionDialog } from 'astra/components' | duplicate | B | CRITICAL | 4-6 hrs | uncontrolled state -> fully controlled mode/note props | Reject as net-new; map to existing ReviewDecisionDialog and move state to container/viewmodel |
| SyncHealthWidget | OperationHealthPanel | import { SyncHealthWidget } from 'prana/ui/common/components/SyncHealthWidget' | import { OperationHealthPanel } from 'astra/components' | mapped | B | HIGH | 2-4 hrs | sync-specific shape replaced by generic summaryItems/actions | Build adapter in Prana that transforms SyncStatusSnapshot into summaryItems/actions |
| ModelProviderForm | - | import { ModelProviderForm } from 'prana/ui/onboarding/presentation/components/ModelProviderForm' | - | deferred | D | HIGH | 1-2 days | N/A | Deferred due provider-domain coupling; revisit after provider config schema is extracted to neutral DTO |
| SkillRegistry | - | import { SkillRegistry } from 'prana/ui/onboarding/presentation/components/SkillRegistry' | - | deferred | D | HIGH | 1-2 days | N/A | Deferred due skill catalog ownership and onboarding wording coupling |
| EmployeeProfileEditor | - | import { EmployeeProfileEditor } from 'prana/ui/onboarding/presentation/components/EmployeeProfileEditor' | - | deferred | D | HIGH | 2-3 days | N/A | Deferred until ProfileDto schema and metadata panel split are extracted from lifecycle model |
| AuthGuard suite | - | import { AuthGuard, MainAppGuard, OnboardingGuard, PublicOnlyGuard, ModuleRouteGuard } from 'prana/ui/components/AuthGuard' | - | deferred | D | HIGH | 1-2 days | N/A | Deferred in Astra package because current library surface does not include router-bound guards/contracts |
| PreAuthLayout | EntryLayoutFrame | import { PreAuthLayout } from 'prana/ui/layout/PreAuthLayout' | import { EntryLayoutFrame } from 'astra/components' | mapped | A | MEDIUM | 30-60 min | title moved to generic titleText and optional drag region | Replace shell frame with EntryLayoutFrame and keep app branding wrapper in Prana adapter |
| DirectorInteractionBar | - | import { DirectorInteractionBar } from 'prana/ui/components/DirectorInteractionBar' | - | deferred | D | HIGH | 2-3 days | N/A | Deferred due direct channel/work-order and orchestration coupling |
| DynamicProfileRenderer | - | import { DynamicProfileRenderer } from 'prana/ui/components/DynamicProfileRenderer' | - | deferred | D | HIGH | 2-3 days | N/A | Deferred due lifecycle-specific provider types and schema assumptions |
| MainLayout shell fragments | - | import { MainLayout } from 'prana/ui/layout/MainLayout' | - | deferred | D | HIGH | 2-3 days | N/A | Deferred due route/session orchestration and app shell policy coupling |

## Duplicate Rejection Notes

- PlaceholderPage proposal is rejected as a new shared component because Astra already has HeroSection suitable for this scenario.
- ReviewActionModal proposal is rejected as a new shared component because Astra already exposes ReviewDecisionDialog with the required controlled contract.

## New Export Surface Added

- MultiStepProgressIndicator
- EntryLayoutFrame
- OperationHealthPanel
