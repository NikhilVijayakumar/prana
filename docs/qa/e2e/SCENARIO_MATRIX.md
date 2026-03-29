# Scenario Matrix

## Usage

- Keep this file updated whenever a screen or flow is added.
- Each scenario must list covered screens.
- Each screen must appear in at least one scenario.

## Screen Inventory Baseline

- app-shell
- login
- forgot-password
- reset-password
- onboarding
- main-layout
- vault
- vault-knowledge
- profile

## Matrix

| Scenario ID | Journey | Covered Screens | Primary Assertions | Evidence |
| --- | --- | --- | --- | --- |
| E2E-A-001 | Startup to shell | app-shell | Title, root render, startup completion | full-page + trace |
| E2E-A-002 | Login valid path | login, main-layout | auth success, route transition, home visible | step shots + trace |
| E2E-A-003 | Login invalid path | login | validation state, error visibility, no route leak | step shots + trace |
| E2E-A-004 | Forgot password flow | forgot-password | challenge path render, submit behavior | step shots + trace |
| E2E-A-005 | Reset password flow | reset-password | token gate UI, validation messages | step shots + trace |
| E2E-B-001 | Onboarding happy path | onboarding, main-layout | phase transitions, state retention | full-page + step shots + trace |
| E2E-B-002 | Onboarding back/forward | onboarding | no state loss on back navigation | step shots + trace |
| E2E-B-003 | Queue and notifications | main-layout | list visibility, status updates | step shots + trace |
| E2E-B-004 | Vault knowledge navigation | vault, vault-knowledge | panel visibility, content render | full-page + trace |
| E2E-B-005 | Profile/settings actions | profile | persistence and visible confirmation | step shots + trace |
| E2E-C-001 | Hover/focus quality | main-layout, profile | hover state, focus ring/keyboard progression | step shots + trace |
| E2E-C-002 | Animation safety | app-shell, onboarding | controls remain actionable during transitions | step shots + trace |
| E2E-C-003 | Restart recovery | app-shell, main-layout | app relaunch and stable state restoration | full-page + trace + failure video |

## Orphan Detection Rule

After each run, compare:

- Inventory screens in `tests/e2e/screen-inventory.json`
- Covered screens in `test-results/playwright/e2e-quality-report.json`

Any inventory entry absent from covered list is an orphan candidate and must be addressed before release sign-off.
