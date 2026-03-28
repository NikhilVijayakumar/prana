# 02 Molecular Layouts

## Goal
Reusable grouped forms and layout blocks that combine primitives while keeping workflow orchestration in containers/viewmodels.

## Promotion Rule
Molecular candidate must satisfy all:
- Parent controls persisted data and business decisions.
- Component owns at most transient UI state.
- Domain-specific models are adapted to neutral DTO contracts before Astra.

---

## ModelProviderForm

Path: `src/ui/onboarding/presentation/components/ModelProviderForm.tsx`

User story:
As a configurator, I need provider settings blocks to enable/disable providers, edit endpoints/models, and run connectivity checks.

Current coupling observations:
- Uses provider union: `lmstudio | openrouter | gemini`.
- Contains provider-specific placeholders and messages.
- Contains local UI test-status state.

Adapter checklist:
- [ ] Convert provider union to generic `providerId: string`.
- [ ] Move provider-specific copy to config props.
- [ ] Keep connectivity action callback-driven (`onTestConnection`).
- [ ] Keep validation list contract-driven from parent.

Promotion decision:
- **Lane B (Promote with adapter refactor)**.

---

## SkillRegistry

Path: `src/ui/onboarding/presentation/components/SkillRegistry.tsx`

User story:
As an operator, I need a registry chooser/editor to assign and curate reusable skills.

Current coupling observations:
- Imports `VirtualEmployeeProfile` type but does not use it in behavior.
- Uses onboarding-specific i18n keys.
- Local dialog and filter state are UI-only.

Adapter checklist:
- [ ] Remove unused domain type import from public contract.
- [ ] Rename contracts to generic terms (`itemIds`, `catalogItems`).
- [ ] Keep add-custom behavior callback-based for parent ownership.
- [ ] Allow external label props for non-onboarding contexts.

Promotion decision:
- **Lane B (Promote with adapter refactor)**.

---

## EmployeeProfileEditor

Path: `src/ui/onboarding/presentation/components/EmployeeProfileEditor.tsx`

User story:
As an operator, I need a profile editor panel so persona content can be maintained consistently.

Current coupling observations:
- Contract is tightly bound to `VirtualEmployeeProfile` fields.
- Field naming is lifecycle/onboarding-specific.
- Read-only design info section assumes agent-specific schema.

Adapter checklist:
- [ ] Replace `VirtualEmployeeProfile` with neutral `ProfileDto`.
- [ ] Split editable fields from read-only metadata panel.
- [ ] Provide field schema and labels from parent.
- [ ] Ensure no hidden persistence assumptions in component.

Promotion decision:
- **Lane B (Promote with deep DTO refactor)**.

---

## PreAuthLayout

Path: `src/ui/layout/PreAuthLayout.tsx`

User story:
As a user, I need a stable pre-auth shell that centers entry flows and keeps consistent frame behavior.

Current coupling observations:
- Includes app-branded title text currently hardcoded.
- Provides reusable frame behavior otherwise.

Adapter checklist:
- [ ] Move title text to prop.
- [ ] Keep frame-only concerns in shared component.
- [ ] Keep app branding composition in Prana wrapper.

Promotion decision:
- **Lane B (Promote after decomposition)**.

---

## Molecular Exit Criteria
1. Business data model abstracted behind neutral DTO.
2. Local state is UI-only.
3. Caller controls all side-effect actions.
4. Localization keys not hardwired to one workflow namespace.
