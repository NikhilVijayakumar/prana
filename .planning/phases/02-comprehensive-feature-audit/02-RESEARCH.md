# Phase 02: Research - Comprehensive Feature Audit

## Technical Domain Audit
The goal of this phase is to perform an exhaustive structural comparison of the documented feature blueprints in `docs/features/` mapped against the operational code representations in `src/`.

### Sub-Domains to Map
1. **Communication** (`docs/features/communication.md` / `src/main/services/ipcService.ts`)
2. **Cron** (`docs/features/cron/` / `src/main/services/cronService.ts`)
3. **Email** (`docs/features/email.md` / `src/main/services/emailOrchestratorService.ts`)
4. **Integration** (`docs/features/Integration/` / `src/main/services/integrationService.ts`)
5. **Notification** (`docs/features/notification/` / `src/main/services/notificationService.ts`)
6. **Onboarding** (`docs/features/Onboarding/` / splash UI components)
7. **Queue-Scheduling** (`docs/features/queue-scheduling/` / `jobQueue.ts`)
8. **Splash** (`docs/features/splash/` / Startup configuration IPC boundary)
9. **Storage** (`docs/features/storage/` / `secureStorageService.ts` & `vaultService.ts`)
10. **Vaidyar** (`docs/features/vaidyar/` / Runtime diagnostics components)
11. **Visual** (`docs/features/visual/` / `apps/astra` integrations & UI framework components)

## Investigation Directives for Planner
- **Documentation Granularity**: Many feature documentation sources are organized as directories (`cron`, `Integration`, etc.) while others are root markdown files (`communication.md`, `email.md`). The audit execution must parse index or root structures properly.
- **Reporting Requirement**: The user elected for "Domain-specific reports mapped to `docs/features` files" allowing traceability. Each domain investigation must synthesize a `{module}-audit-report.md`.
- **Inline Fix Strictness**: The execution phase must execute inline code remediation natively whenever superficial bounds are missing (e.g. error handling, Fail-Fast mechanisms). If a deep architectural rebuild is required, document it sequentially and pause inline fixes for that specific module.
- **Fail Fast Guarantee**: During the audit execution, verify every service initializes safely or throws standard blocked errors matching the Phase 01 hardening rules.

## Security Constraints
Feature completion code merges must strictly adhere to `PATH_TRAVERSAL_VIOLATION`, `IPC_VALIDATION_ERROR`, and `HTTP_SERVER_ERROR` bounds structured in Phase 01. No external `axios` or unwrapped `fetch` APIs can be introduced.

## Validation Architecture
- **Dimensions to target**: Feature completeness parity.
- **Goal-Backward Proof**: 100% of capabilities described in documentation must be proven via source code presence.
- **Structural Integrity Test**: The planner needs to inject tasks that read typescript method arrays against capability definitions to satisfy static parity.
- **Test Generation Constraints**: As directed by the user, emit static analyzer blocks and stub files targeting potential Playwright capabilities downstream. No functional runtime E2E test environments need to be executed locally, just structurally prevalidated.
