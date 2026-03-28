# Prana Standalone Configuration Contract

## Purpose
Define the required environment contract for any client application integrating Prana as a reusable module.

## Policy
- Required static configuration keys must be provided by the consuming app.
- Prana fails fast during bootstrap when required keys are missing.
- This contract changes configuration sourcing only; business logic intent remains unchanged.

## Required Keys

### Main Process Required Keys
- `PRANA_DIRECTOR_NAME`
- `PRANA_DIRECTOR_EMAIL`
- `PRANA_VAULT_ARCHIVE_PASSWORD`
- `PRANA_VAULT_ARCHIVE_SALT`
- `PRANA_VAULT_KDF_ITERATIONS`
- `PRANA_SYNC_PUSH_INTERVAL_MS`
- `PRANA_SYNC_CRON_ENABLED`
- `PRANA_SYNC_PUSH_CRON_EXPRESSION`
- `PRANA_SYNC_PULL_CRON_EXPRESSION`

### Renderer Required Keys
- `VITE_APP_BRAND_NAME`
- `VITE_APP_TITLEBAR_TAGLINE`
- `VITE_APP_SPLASH_SUBTITLE`
- `VITE_DIRECTOR_SENDER_NAME`
- `VITE_DIRECTOR_SENDER_EMAIL`

## Validation Behavior
Validation points:
1. Main bootstrap validation executes during app startup before runtime services initialize.
2. Renderer branding constants require all VITE keys and throw on missing/blank values.

Error behavior:
- Missing keys produce explicit fail-fast config errors.
- Startup is blocked until required keys are provided.

## Integration Verification Screen (Pre-Login)
Prana now exposes a pre-login integration verification screen for internal client apps.

Goals:
1. Verify integration contract before authentication flow starts.
2. Show only key names and status (AVAILABLE, MISSING, INVALID).
3. Never show secret values on screen.

Main process verification channel:
- IPC: `app:get-integration-status`
- Returned payload includes:
	- overall readiness
	- key-level status for required main keys
	- summary counts (total, available, missing, invalid)

Renderer verification behavior:
1. Validates required VITE keys locally in renderer.
2. Combines renderer status with main-process status into one screen.
3. If preload bridge is missing, screen reports missing bridge capability explicitly.

Security rule:
- Verification output must include key identifiers only.
- No environment value or secret content is returned or rendered.

## Legacy Alias Bridge
Current runtime reader supports legacy DHI aliases for transition:
- `DHI_DIRECTOR_NAME`
- `DHI_DIRECTOR_EMAIL`
- `DHI_VAULT_ARCHIVE_PASSWORD`
- `DHI_VAULT_ARCHIVE_SALT`
- `DHI_VAULT_KDF_ITERATIONS`
- `DHI_SYNC_PUSH_INTERVAL_MS`
- `DHI_SYNC_CRON_ENABLED`
- `DHI_SYNC_PUSH_CRON_EXPRESSION`
- `DHI_SYNC_PULL_CRON_EXPRESSION`

Guidance:
- New integrations should use PRANA-prefixed keys only.
- Legacy aliases are transitional compatibility inputs.

Sunset policy:
- Legacy `DHI_*` alias reads are supported through 2026-Q4 for migration safety.
- New integrations must not add new `DHI_*` usage.
- Removal target for legacy alias support: Prana v2.0 (or later if a formal extension is approved).

## Example .env Template
```env
PRANA_DIRECTOR_NAME=Director
PRANA_DIRECTOR_EMAIL=director@example.com
PRANA_VAULT_ARCHIVE_PASSWORD=change_this_to_a_strong_secret
PRANA_VAULT_ARCHIVE_SALT=change_this_to_a_unique_salt
PRANA_VAULT_KDF_ITERATIONS=210000
PRANA_SYNC_PUSH_INTERVAL_MS=120000
PRANA_SYNC_CRON_ENABLED=true
PRANA_SYNC_PUSH_CRON_EXPRESSION=*/10 * * * *
PRANA_SYNC_PULL_CRON_EXPRESSION=*/15 * * * *

VITE_APP_BRAND_NAME=Client Workspace
VITE_APP_TITLEBAR_TAGLINE=Powered by Prana Engine
VITE_APP_SPLASH_SUBTITLE=Booting instruments...
VITE_DIRECTOR_SENDER_NAME=Director
VITE_DIRECTOR_SENDER_EMAIL=director@example.com
```

## Implementation References
- `src/main/services/runtimeConfigService.ts`
- `src/main/index.ts`
- `src/main/services/ipcService.ts`
- `src/main/preload.ts`
- `src/ui/integration/view/IntegrationVerificationPage.tsx`
- `src/ui/constants/appBranding.ts`
- `src/ui/env.d.ts`
