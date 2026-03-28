# 01 Atomic Elements

## Goal
Small, composable UI primitives that remain workflow-agnostic and do not orchestrate business state.

---

## PhaseProgressIndicator

Path: `src/ui/onboarding/presentation/components/PhaseProgressIndicator.tsx`

User story:
As a user, I need a visual multi-step phase indicator so I can quickly understand progress in a staged workflow.

State contract:
- Stateless rendering from props.
- No side effects.

API definition:
```ts
export interface PhaseProgressIndicatorProps {
  currentPhase: 1 | 2 | 3;
  phase1Status: OnboardingPhaseStatus;
  phase2Status: OnboardingPhaseStatus;
  phase3Status: OnboardingPhaseStatus;
  sx?: SxProps<Theme>;
}
```

Generalization notes:
- Replace onboarding-specific status union with generic step status type in Astra if needed.

---

## PlaceholderPage

Path: `src/ui/shared-components/PlaceholderPage.tsx`

User story:
As a product team member, I need a neutral placeholder shell so in-progress modules can be mounted without broken routes.

State contract:
- Stateless.
- Caller controls headline and code values.

API definition:
```ts
export interface PlaceholderPageProps {
  headline: string;
  code: string;
}
```
