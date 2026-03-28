# 02 Molecular Layouts

## Goal
Reusable grouped form and editing structures that combine primitives into coherent, domain-adaptable UI blocks.

---

## ModelProviderForm

Path: `src/ui/onboarding/presentation/components/ModelProviderForm.tsx`

User story:
As a configurator, I need a provider settings card so I can enable/disable providers and validate connectivity.

State contract:
- Controlled by parent props and callbacks.
- Local state is transient UI feedback only.

Generalization notes:
- Provider enum can become generic (`providerId: string`) in Astra.
- Keep validation display and action callbacks contract-driven.

---

## EmployeeProfileEditor

Path: `src/ui/onboarding/presentation/components/EmployeeProfileEditor.tsx`

User story:
As an operator, I need a profile editor block so I can maintain persona details consistently.

State contract:
- Controlled component.
- No data persistence side effects.

Generalization notes:
- Replace lifecycle-specific data shape with neutral profile DTO in Astra.

---

## SkillRegistry

Path: `src/ui/onboarding/presentation/components/SkillRegistry.tsx`

User story:
As an operator, I need a registry chooser/editor so I can assign and curate reusable skills.

State contract:
- Parent controls selected ids and save handlers.
- Component owns only local filter/dialog UI state.

Generalization notes:
- Decouple `VirtualEmployeeProfile` references via adapter props.
