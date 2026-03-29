# E2E Run SOP

## 1. Preflight

1. Ensure LM Studio is running locally.
2. Ensure required model is loaded:
   - `PRANA_LM_STUDIO_MODEL` in `.env.test`
3. Ensure endpoint is reachable:
   - `PRANA_LM_STUDIO_BASE_URL` in `.env.test`
4. Ensure build output exists:
   - run `npm run build`

## 2. Execution

1. Headless baseline:
   - `npm run test:e2e`
2. Visual debug run (when needed):
   - `npm run test:e2e:headed`
3. Open HTML report:
   - `npm run test:e2e:show-report`

## 3. Evidence Capture Rules

For each executed scenario:

- Keep full-page screenshot.
- Keep step screenshots for key interactions.
- Keep trace zip.
- Keep video on failure.

## 4. Post-Run Validation

1. Open `test-results/playwright/e2e-quality-report.md`.
2. Confirm run summary and totals.
3. Confirm screen coverage counts and missing screen list.
4. Confirm issue section is complete and evidence links are valid.
5. Log defects using the defect template from `TEMPLATES.md`.

## 5. Fail-Fast Conditions

Stop run and triage immediately if:

- LM Studio preflight fails.
- App startup cannot create initial window.
- Required artifacts are missing.
- Critical auth or startup scenarios fail.
