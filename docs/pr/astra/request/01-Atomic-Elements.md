# 01 Atomic Elements

## Goal
Small, composable primitives that remain workflow-agnostic, stateless from business perspective, and safe for Astra promotion.

## Promotion Rule
Atomic candidate must satisfy all:
- Pure render from props.
- No route/session orchestration.
- No app-specific service calls.
- Domain-neutral naming or clearly documented rename path.

---

## PhaseProgressIndicator

Path: `src/ui/common/components/PhaseProgressIndicator.tsx`

User story:
As an operator, I need a visible multi-step status line so progress through staged workflows is immediately clear.

Current state contract:
- Stateless component.
- Depends on onboarding status type and onboarding i18n keys.

Current API:
```ts
export interface PhaseProgressIndicatorProps {
  currentPhase: 1 | 2 | 3;
  phase1Status: OnboardingPhaseStatus;
  phase2Status: OnboardingPhaseStatus;
  phase3Status: OnboardingPhaseStatus;
  sx?: SxProps<Theme>;
}
```

Astra promotion notes:
- Replace `OnboardingPhaseStatus` with generic `StepStatus`.
- Accept `steps` array instead of fixed 3-phase props if Astra prefers generic stepper contract.
- Move labels to caller-provided values or Astra-level reusable keys.

Promotion decision:
- **Lane A (Promote now)** with low-risk type generalization.

---

## PlaceholderPage

Path: `src/ui/common/components/PlaceholderPage.tsx`

User story:
As a product team member, I need a neutral placeholder shell so in-progress routes remain stable and testable.

Current state contract:
- Stateless.
- Caller controls message content.

Current API:
```ts
export interface PlaceholderPageProps {
  headline: string;
  code: string;
}
```

Astra promotion notes:
- Run duplicate check against existing Astra empty/hero placeholders.
- If duplicate exists, map component instead of promoting a new one.

Promotion decision:
- **Lane C (Duplicate check in Astra)**.

---

## PreAuthLayout Frame Primitive (Extraction Candidate)

Source path for decomposition: `src/ui/layout/PreAuthLayout.tsx`

Why included in atomic plan:
- Full `PreAuthLayout` includes branded titlebar text and shell composition.
- A reusable frame primitive can be atomic if extracted as a neutral container.

Proposed extraction contract:
```ts
export interface AuthFrameProps {
  titleText?: string;
  children: ReactNode;
}
```

Promotion decision:
- **Lane B (Promote with refactor)** after splitting branding concerns.

---

## Atomic Exit Criteria
1. No business state inside component.
2. No app-brand-specific text hardcoded.
3. Public props are domain-neutral.
4. Typecheck and smoke checks pass in Prana after common extraction.
