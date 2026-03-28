# Handover Contract (Prana -> Astra)

## Purpose
Define responsibilities between Prana and Astra when promoting reusable UI components from Prana into Astra.

## 1. Inputs from Prana
Prana provides:
- Source component contracts from `src/ui`.
- Public props and exported type contracts.
- Category packaging docs:
  - `01-Atomic-Elements.md`
  - `02-Molecular-Layouts.md`
  - `03-Organism-Complex-UI.md`
- Validation evidence:
  - No business-logic behavior changes requested.
  - Reusability scope and coupling notes per component.

## 2. Astra Responsibilities
Astra may:
- Rename components to Astra naming conventions.
- Reorganize folder topology.
- Generalize visual implementation and theming.

Astra must preserve:
- Behavioral intent documented in user stories.
- Equivalent public prop behavior (or explicit migration guidance).
- Accessibility and localization compatibility.

## 3. Mapping Return Obligations (Mandatory)
Astra must return a mapping artifact with, per component:
- Old component name
- New component name
- Old import path
- New import path
- Breaking prop changes
- Migration notes

Accepted formats:
- `docs/pr/astra/mapping-report.template.json` (filled)
- `docs/pr/astra/Mapping-Template.md` (filled)

## 4. Re-import Contract for Prana
After mapping report is returned:
1. Update imports module-by-module.
2. Resolve prop contract deltas using migration notes.
3. Run typecheck and impacted UI smoke checks.
4. Remove local promoted components only after parity is confirmed.
5. Keep temporary wrapper shims only if needed for non-breaking rollout.

## 5. Versioning and Safety
Required:
- Mapping report references Astra package version/tag.
- Breaking changes are explicitly marked.
- Dropped components include rationale and replacement path.

## 6. Acceptance Checklist
Promotion is complete when:
- Proposed components import from Astra in Prana where accepted.
- No unresolved imports remain.
- Typecheck passes.
- UI smoke checks pass on impacted routes.
