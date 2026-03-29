# E2E Checklist

## Pre-Run

- [ ] `.env.test` contains LM Studio base URL and model.
- [ ] LM Studio process is running locally.
- [ ] Required model is available in LM Studio.
- [ ] `npm run build` succeeds.
- [ ] Workspace uses sandbox test branch protections.

## During Run

- [ ] Startup and auth smoke scenarios pass.
- [ ] No app launch timeout in fixture startup.
- [ ] Evidence is captured for each scenario.
- [ ] No critical navigation dead-end found.

## Post-Run

- [ ] `e2e-quality-report.md` generated.
- [ ] `e2e-quality-report.json` generated.
- [ ] Screen coverage reviewed.
- [ ] Missing screen list triaged.
- [ ] Issues documented with evidence.
- [ ] Final report completed using template.
