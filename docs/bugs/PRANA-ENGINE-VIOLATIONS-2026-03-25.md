# PRANA Engine Violation Audit (2026-03-25)

## Scope
- Source reviewed from dependency tree: `e:/Python/dhi/node_modules/prana/src`
- Objective: verify Prana shared-library behavior against split model (shared by Dhi and Vidhan, app-agnostic core)

## Findings

### 1. App-specific identity hardcoded in shared library runtime defaults
Severity: High

Evidence:
- `node_modules/prana/src/main/services/runtimeConfigService.ts:5`
- Value observed: `DEFAULT_DIRECTOR_EMAIL = 'director@dhi.local'`

Why this violates split intent:
- Prana is documented as shared engine library for multiple apps.
- Hardcoding `dhi.local` creates app-specific coupling in a shared runtime layer.

Recommended remediation:
- Externalize default identities to configuration/env per consuming app.
- Keep shared package defaults neutral (non-app-branded).

### 2. Shared library UI still contains dual-app hardcoded branding text
Severity: Medium

Evidence:
- `node_modules/prana/src/ui/layout/MainLayout.tsx:146`
- `node_modules/prana/src/ui/splash/view/SplashView.tsx:26`

Observed text:
- `Dhi & Vidhan`

Why this violates split intent:
- Shared UI primitives should avoid product-specific hardcoded branding strings.
- Branding should be injected by consumer app context/localization.

Recommended remediation:
- Move branding string to app-level localization/config input.
- Keep Prana UI shell app-neutral.

### 3. Test fixtures are app-branded
Severity: Low

Evidence:
- `node_modules/prana/src/main/services/channelRouterService.test.ts` (multiple lines)
- Uses `director@dhi.local` across test data.

Risk:
- Not a runtime break, but keeps package semantics biased to one app and obscures multi-app intent.

Recommended remediation:
- Replace with neutral test fixtures (e.g., `director@app.local`) or parameterized app identity.

## Notes
- No direct forbidden import coupling (`@dhi`, `@vidhan`) was identified in this audit sample.
- Primary violations are semantic coupling and contract fragility, not explicit import dependency.
