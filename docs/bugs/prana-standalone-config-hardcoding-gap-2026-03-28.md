# Prana Standalone Config and Hardcoding Gap Audit (2026-03-28)

## Status (2026-03-28)
Overall: CLOSED for current scope.

Closure evidence:
1. Required runtime keys are enforced in `src/main/services/runtimeConfigService.ts`.
2. Required renderer keys are enforced in `src/ui/constants/appBranding.ts`.
3. Vault archive magic writes are now neutral (`PRANA_VAULT_V1`) with legacy-read support (`DHI_VAULT_V1`) in `src/main/services/vaultService.ts`.
4. Local execution provider KDF salt now uses neutral default with legacy-read fallback in `src/main/services/localExecutionProviderService.ts`.

## Purpose
Track all static configuration hardcoding and default fallback behavior that blocks Prana from being a strict reusable library across client apps.

## Scope
- Workspace: `e:/Python/prana`
- Layers: main process config bootstrap + renderer static branding config
- Policy target: strict env injection with fail-fast validation (no defaults for required static keys)

## Summary
The required standalone env contract is now enforced and previous app-branded defaults in active config/bootstrap paths are removed or neutralized with backward compatibility where needed.

## Gap Register

### GAP-CONFIG-001: Required static values still have hardcoded defaults
Type: Configuration contract gap
Severity: High

Evidence:
- `src/main/services/runtimeConfigService.ts`
- `src/ui/constants/appBranding.ts`

Observed patterns:
- `DEFAULT_DIRECTOR_NAME`, `DEFAULT_DIRECTOR_EMAIL`
- `DEFAULT_SYNC_PUSH_INTERVAL_MS`, `DEFAULT_SYNC_CRON_ENABLED`
- `DEFAULT_SYNC_PUSH_CRON_EXPRESSION`, `DEFAULT_SYNC_PULL_CRON_EXPRESSION`
- `APP_BRAND_NAME`, `APP_TITLEBAR_TAGLINE`, `APP_SPLASH_SUBTITLE`, `DIRECTOR_SENDER_EMAIL`, `DIRECTOR_SENDER_NAME` all use fallback literals.

Impact:
- Client apps can run with implicit Prana-branded defaults.
- Integration contract is ambiguous; missing configuration is not detected early.

Required fix:
- Mark required keys as mandatory.
- Fail startup if any required key is missing or blank.
- Keep domain logic unchanged; only source-of-truth moves to env contract.

Acceptance criteria:
- Missing required keys trigger explicit validation error listing missing keys.
- Startup succeeds only when all required keys are present.

---

### GAP-CONFIG-002: Validation is partial and scoped only to vault encryption
Type: Validation coverage gap
Severity: High

Evidence:
- `src/main/services/runtimeConfigService.ts`

Observed behavior:
- Validation enforces only `PRANA_VAULT_ARCHIVE_PASSWORD` and `PRANA_VAULT_ARCHIVE_SALT`.
- Director and branding keys are optional due to defaults.

Impact:
- Incomplete config surfaces as branding/identity drift at runtime.

Required fix:
- Add unified required-key validation contract for both main and renderer required keys.
- Validate on bootstrap before runtime services initialize.

Acceptance criteria:
- Validation report includes all missing required main and renderer keys.
- Error guidance includes exact key names.

---

### GAP-CONFIG-003: Hardcoded app identity strings remain in runtime-adjacent constants
Type: App coupling gap
Severity: Medium

Evidence:
- `src/main/services/localExecutionProviderService.ts`: hardcoded KDF salt label.
- `src/main/services/vaultService.ts`: envelope and stash markers include app-branded labels.

Impact:
- Shared package semantics remain app-biased.
- Migration to other client app identities is harder to reason about.

Required fix:
- Keep cryptographic/business behavior unchanged.
- Externalize app-identity labels to runtime config/env where safe.
- Preserve backward compatibility for existing data format markers unless migration strategy exists.

Acceptance criteria:
- No app-specific literals in configurable static identity fields.
- Protocol constants are either neutralized or explicitly documented as format invariants.

---

### GAP-CONFIG-004: Legacy alias support lacks explicit sunset policy
Type: Migration governance gap
Severity: Low

Evidence:
- Runtime uses neutral+legacy fallback reads (`PRANA_*` and `DHI_*`).

Impact:
- Potential indefinite support of legacy names without migration deadline.

Required fix:
- Keep alias bridge temporarily.
- Document sunset version/date and removal conditions.

Acceptance criteria:
- Contract doc includes migration timeline and final removal criteria.

## Mandatory Config Contract (Approved)
Required keys to enforce with no defaults:

Main process:
- `PRANA_DIRECTOR_NAME`
- `PRANA_DIRECTOR_EMAIL`
- `PRANA_VAULT_ARCHIVE_PASSWORD`
- `PRANA_VAULT_ARCHIVE_SALT`
- `PRANA_VAULT_KDF_ITERATIONS`
- `PRANA_SYNC_PUSH_INTERVAL_MS`
- `PRANA_SYNC_CRON_ENABLED`
- `PRANA_SYNC_PUSH_CRON_EXPRESSION`
- `PRANA_SYNC_PULL_CRON_EXPRESSION`

Renderer process:
- `VITE_APP_BRAND_NAME`
- `VITE_APP_TITLEBAR_TAGLINE`
- `VITE_APP_SPLASH_SUBTITLE`
- `VITE_DIRECTOR_SENDER_NAME`
- `VITE_DIRECTOR_SENDER_EMAIL`

## Non-Goals
- Do not alter business workflows or domain decision logic.
- Do not change use-case intent.
- Do not redesign existing runtime feature behavior.

## Verification Checklist
1. Missing key error includes all missing keys.
2. `npm run typecheck` passes.
3. `npm run lint` passes.
4. `npm run build` passes with valid env configuration.
5. Login/splash/onboarding/main layout still behave as before when env is supplied.
