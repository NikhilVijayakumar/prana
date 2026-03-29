# Prana E2E Strategy (Playwright + Electron)

## Goals

- Keep default E2E execution fast and deterministic in headless mode.
- Allow developer-controlled visual debugging in headed mode.
- Preserve sandbox safety by forcing E2E runs onto the test-sandbox branch.
- Capture traces for replay-driven debugging in local and CI runs.

## Dynamic Headless Control

Prana E2E uses a dynamic headless resolver in `playwright.config.ts`.

Resolution order:

1. CLI flag `--headed` (highest priority): forces headed mode.
2. Env variable `HEADLESS`: supports `true/false`, `1/0`, `yes/no`, `on/off`.
3. Default: headless mode (`true`).

When headed mode is active:

- `slowMo` is auto-enabled (default: `500ms`, override with `PLAYWRIGHT_SLOW_MO_MS`).

## Commands

- Default E2E run (headless):

```bash
npm run test:e2e
```

- Visual run (headed):

```bash
npm run test:e2e:headed
```

- Rapid visual iteration loop (headed + Playwright UI watcher):

```bash
npm run test:watch
```

- Open the Playwright HTML report:

```bash
npm run test:e2e:show-report
```

## Visual Verification Workflow

1. Apply the bug fix in Dhi or Vidhan package code.
2. Run visual mode (`npm run test:e2e:headed` or `npm run test:watch`).
3. Observe the Electron window behavior through Astra flows.
4. Keep assertions strict so pass/fail still depends on actual UI state.

## Inspector and Pause Debugging

- Add `await page.pause()` or `await window.pause()` inside a test step to open Playwright Inspector.
- Optional pattern:

```ts
if (process.env.PWDEBUG === '1') {
  await window.pause();
}
```

- Run with inspector env when needed:

```bash
PWDEBUG=1 npm run test:e2e:headed
```

## Trace Viewer Policy

- Trace collection is always enabled (`trace: "on"`).
- This guarantees a `trace.zip` artifact per test run, including headless CI/sandbox runs.
- Replay traces after failures:

```bash
npx playwright show-trace path/to/trace.zip
```

## Configuration Management for E2E Tests

All E2E test configuration is stored in `config/test_env.json` (no environment variables).

### Using Test Configuration

- Configuration file: `config/test_env.json`
- Fixture: `tests/e2e/fixtures.ts` automatically loads this config
- Fixture provides: `testConfig` parameter available to all tests

Example test accessing config:

```ts
test('My test', async ({ window, testConfig }) => {
  const appBrandName = testConfig.APP_BRAND_NAME;
  const lmStudioUrl = testConfig.LM_STUDIO_BASE_URL;
  // ... test logic
});
```

### Modifying Configuration

1. Edit `config/test_env.json` with your test values
2. Run tests normally (`npm run test:e2e`)
3. Tests automatically read the updated configuration
4. Changes take effect immediately without rebuilding

Example: Testing with different branding:

```json
{
  "APP_BRAND_NAME": "My Custom Brand",
  "APP_TITLEBAR_TAGLINE": "Custom Tagline",
  "APP_SPLASH_SUBTITLE": "Custom Splash",
  "DIRECTOR_SENDER_NAME": "Test Sender",
  "DIRECTOR_SENDER_EMAIL": "test@example.com"
}
```

### Zero Environment Variable Policy

- Prana uses a zero environment variable policy for runtime configuration
- All config is passed as optional props to components
- Tests do NOT inject config as environment variables
- This makes the app library-reusable across any context (Electron, web, other frameworks)

### Config Is Optional

- App starts without requiring branding config
- Integration verification gate runs regardless of config state
- Each screen that needs config receives it as props via `getPranaBranding()`
- Screens handle missing config gracefully with defaults

## QA-Style Report Output

Each E2E run now generates additional QA artifacts:

- `test-results/playwright/e2e-quality-report.md`
- `test-results/playwright/e2e-quality-report.json`

For full QA governance templates and execution SOP, use:

- `docs/qa/e2e/README.md`
- `docs/qa/e2e/MASTER_PLAN.md`
- `docs/qa/e2e/SCENARIO_MATRIX.md`
- `docs/qa/e2e/RUN_SOP.md`
- `docs/qa/e2e/REPORT_TEMPLATE.md`
- `docs/qa/e2e/CHECKLIST.md`
- `docs/qa/e2e/TEMPLATES.md`

The quality report includes:

- pass/fail/flaky/skipped totals
- test file coverage
- screen inventory vs covered screens
- missing screens list
- issue table (auto-created for failures)
- evidence links (trace/screenshot/video attachment paths)

## Screen Coverage and Issue Marking

Annotate tests to make coverage and issue sections reflect tester-style reporting:

```ts
test.info().annotations.push({ type: 'screen', description: 'login' });
test.info().annotations.push({ type: 'severity', description: 'high' });
test.info().annotations.push({ type: 'issue', description: 'Login spinner overlaps submit button at 125% scaling' });
```

- Screen inventory source: `tests/e2e/screen-inventory.json`
- `screen` annotation: marks a screen as covered by the test.
- `severity` annotation: supports `critical | high | medium | low`.
- `issue` annotation: creates explicit issue rows even if a test passes.

## Sandbox and Dharma Branch Safety

E2E fixture enforcement in `tests/e2e/fixtures.ts` applies the following safeguards:

- Tests fail fast if `PRANA_TEST_BRANCH` is not `test-sandbox`.
- Electron launch env forces:
  - `PRANA_TEST_BRANCH=test-sandbox`
  - `PRANA_DHARMA_BRANCH=test-sandbox`
  - `DHARMA_BRANCH=test-sandbox`

This prevents accidental observation or mutation of production-linked data during manual visual runs.

## LM Studio Runtime Policy (No Mock Model Calls)

- Model-dependent runtime app behavior in E2E must use local LM Studio directly.
- E2E fixture preflight verifies:
  - `PRANA_LM_STUDIO_BASE_URL` is reachable via `/v1/models`.
  - `PRANA_LM_STUDIO_MODEL` exists in returned models.
- If either check fails, test run fails fast before app launch.
- Report generation remains deterministic and code-driven; no LLM-generated report synthesis is used.

## Bug Logging Alignment

If visual debugging finds issues, log them in the correct channel:

- Styling/visual regressions: `docs/issue/astra/`
- Logic/behavioral failures: `docs/bugs/`

Use concise evidence:

- command used
- failing assertion
- trace path
- screenshot/video references
- suspected root cause
