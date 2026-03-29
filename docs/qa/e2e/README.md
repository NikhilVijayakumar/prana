# Prana E2E QA Framework

This folder is the source of truth for Prana end-to-end QA planning, execution, and reporting.

## Objectives

- Ensure full navigation coverage with no orphan screens or hidden dead-ends.
- Validate all major interactions: click, keyboard focus, hover, visibility, animation transitions, and critical error states.
- Keep test execution deterministic and code-driven.
- Use LM Studio directly for model-dependent runtime app behavior. No mocked model calls in those flows.
- Produce tester-grade evidence for every scenario.

## Required Artifacts Per Scenario

- Full-page screenshot
- Step screenshots
- Playwright trace zip
- Video on failure

## Core Documents

- `MASTER_PLAN.md`: complete strategy, waves, and coverage gates.
- `SCENARIO_MATRIX.md`: screen-to-scenario and scenario-to-screen mapping.
- `RUN_SOP.md`: preflight, execution, and post-run process.
- `REPORT_TEMPLATE.md`: execution report and issue/evidence structure.
- `CHECKLIST.md`: run-time checklist for consistency.
- `TEMPLATES.md`: reusable templates for scenarios, defects, and summaries.

## Command Baseline

- `npm run build`
- `npm run test:e2e`
- `npm run test:e2e:show-report`

## LM Studio Policy

- E2E fixture preflight checks LM Studio availability and model presence before app launch.
- If LM Studio is not available or the required model is missing, test run fails fast.
- Model behavior in runtime-required screens must use local LM Studio endpoint from `.env.test`.
