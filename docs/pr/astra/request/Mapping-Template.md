# Prana -> Astra Mapping Template

Fill one row per candidate returned by Astra.

| Old Component | New Component | Old Import | New Import | Status | Execution Phase | Priority | Effort | Breaking Prop Changes | Migration Notes |
|---|---|---|---|---|---|---|---|---|---|
| PhaseProgressIndicator |  | import { PhaseProgressIndicator } from 'prana/ui/common/components/PhaseProgressIndicator' | import {  } from 'astra/components' | mapped | A | LOW | < 30 min |  |  |
| PlaceholderPage |  | import { PlaceholderPage } from 'prana/ui/common/components/PlaceholderPage' | import {  } from 'astra/components' | duplicate or mapped | C | MEDIUM | 30-45 min |  |  |
| ReviewActionModal |  | import { ReviewActionModal } from 'prana/ui/common/components/ReviewActionModal' | import {  } from 'astra/components' | mapped | B | HIGH/CRITICAL | 2-4 hrs |  |  |
| SyncHealthWidget |  | import { SyncHealthWidget } from 'prana/ui/common/components/SyncHealthWidget' | import {  } from 'astra/components' | mapped or deferred | B | MEDIUM | 1-2 hrs |  |  |
| ModelProviderForm |  | import { ModelProviderForm } from 'prana/ui/onboarding/presentation/components/ModelProviderForm' | import {  } from 'astra/components' | mapped | B | MEDIUM | 2-3 hrs |  |  |
| SkillRegistry |  | import { SkillRegistry } from 'prana/ui/onboarding/presentation/components/SkillRegistry' | import {  } from 'astra/components' | mapped | B | MEDIUM | 2-3 hrs |  |  |
| EmployeeProfileEditor |  | import { EmployeeProfileEditor } from 'prana/ui/onboarding/presentation/components/EmployeeProfileEditor' | import {  } from 'astra/components' | mapped or deferred | B | HIGH | 3-5 hrs |  |  |
| AuthGuard suite |  | import { AuthGuard, MainAppGuard, OnboardingGuard, PublicOnlyGuard, ModuleRouteGuard } from 'prana/ui/components/AuthGuard' | import {  } from 'astra/components' | mapped or deferred | B | HIGH | 3-4 hrs |  |  |
| PreAuthLayout |  | import { PreAuthLayout } from 'prana/ui/layout/PreAuthLayout' | import {  } from 'astra/components' | mapped or deferred | B | MEDIUM | 1-2 hrs |  |  |
| DirectorInteractionBar |  | import { DirectorInteractionBar } from 'prana/ui/components/DirectorInteractionBar' | import {  } from 'astra/components' | deferred | D | HIGH | 4-6 hrs |  |  |
| DynamicProfileRenderer |  | import { DynamicProfileRenderer } from 'prana/ui/components/DynamicProfileRenderer' | import {  } from 'astra/components' | deferred | D | HIGH | 4-6 hrs |  |  |
| MainLayout shell fragments |  | import { MainLayout } from 'prana/ui/layout/MainLayout' | import {  } from 'astra/components' | deferred or split-mapped | D | HIGH | 4-6 hrs |  |  |

## Fill Instructions
- Old Import: exact import currently used in Prana.
- New Import: exact Astra import path after promotion/mapping.
- Status values: mapped | duplicate | deferred | rejected | blocked.
- Execution phase:
  - A = rename-only
  - B = contract refactor
  - C = duplicate replacement
  - D = deferred/split-required
- Breaking Prop Changes: include renamed, removed, type-change, behavior-change entries.
- Migration Notes: include direct code-level replacement guidance.

## Required Metadata (Top of Returned Artifact)
- Astra package version:
- Astra commit/tag:
- Owner:
- Date:
- PR reference:
