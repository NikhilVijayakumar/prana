# Configuration Migration: Props-Based Approach

## Overview

Prana has been refactored to use a props-based configuration approach instead of global config validation. This makes the library reusable across any context (Electron, web, other frameworks).

## What Changed

### Before (Removed)
- Global config validation in `src/ui/main.tsx`
- App showed "Configuration Error" screen if branding config was missing
- Config injected as environment variables in E2E tests
- `.env.test` file used for test configuration

### After (Current)
- No global config validation
- App starts without requiring branding config
- Each screen accepts config as optional props via `getPranaBranding()`
- Config stored in JSON file: `config/test_env.json`
- Screens gracefully handle missing config with empty string defaults

## Files Modified

### Application Code
- **`src/ui/main.tsx`** - Removed global config validation block
- **`src/ui/constants/pranaConfig.ts`** - Removed `validatePranaBranding()` function
- **`src/ui/integration/view/IntegrationVerificationPage.tsx`** - Removed validation from integration flow

### E2E Test Code
- **`tests/e2e/fixtures.ts`** 
  - Changed: Load config from JSON but don't inject as env vars
  - Added: `testConfig` fixture exposing loaded configuration
  - Kept: LM Studio health-check probe
  
- **`tests/e2e/wave-a-navigation.spec.ts`**
  - Updated: Tests now verify app works without config
  - Added: Tests that use testConfig fixture
  - Removed: Global config validation assertions

### Documentation
- **`docs/testing/e2e-strategy.md`** - Added section on config management

### Files Deleted
- **`.env.test`** - No longer needed (all config in JSON)

### Files Kept
- **`config/test_env.json`** - Central config for E2E tests (user-modifiable)

## Architecture Benefits

✅ **Library Reusable** - App works in any context without required config  
✅ **Props-Based Config** - Screens declare what config they need  
✅ **User Control** - Modify `config/test_env.json` to test different scenarios  
✅ **Zero Env Vars** - No environment variable pollution  
✅ **Fast Startup** - No validation delays at app initialization  

## Usage

### Running E2E Tests
```bash
npm run test:e2e
```

Tests automatically load config from `config/test_env.json`.

### Modifying Test Configuration

1. Edit `config/test_env.json`
2. Change any values you want to test
3. Run tests - they'll immediately use new config

Example:
```json
{
  "APP_BRAND_NAME": "My Brand",
  "LM_STUDIO_BASE_URL": "http://localhost:1234"
}
```

### Accessing Config in Tests
```ts
test('My test', async ({ window, testConfig }) => {
  const appBrandName = testConfig.APP_BRAND_NAME;
  // tests have access to all config values
});
```

## Migration Guide (If Importing Prana)

If you're using Prana as a library:

1. Don't set environment variables for branding config
2. Call `setPranaBrandingConfig()` before rendering the app if you need custom branding
3. Screens will use defaults if config is not provided
4. No validation errors will be thrown for missing config

Example:
```ts
import { setPranaBrandingConfig } from 'prana/ui/constants/pranaConfig';

// Set config before app renders
setPranaBrandingConfig({
  appBrandName: 'My App',
  appTitlebarTagline: 'My Tagline',
  appSplashSubtitle: 'Loading...',
  directorSenderName: 'Director',
  directorSenderEmail: 'director@example.com',
});

// Now render the app - it will use provided config
```

Or omit config entirely - app will render with defaults.

## Test Results

```
✓ 3 tests passed (6.2s)
  - Astra visual smoke: shell loads and root mount is ready
  - Wave A: App starts without requiring config
  - Wave A: App renders with branding config from test config file
```

All tests pass without requiring config validation.
