# Phase 01 Research: Chakra Runtime Integration Contracts

## Scope
Research for implementing two upstream contracts requested by Chakra:
1. Reusable host dependency capability checks.
2. Client-owned virtual-drive policy with minimal breakage.

## Existing Implementation Findings
- `startupOrchestratorService` currently treats storage/bootstrap diagnostics as blocking stages and already gates on Vaidyar blocked signals.
- `driveControllerService` already encapsulates mount/unmount, diagnostics, fail-closed posture, and provider abstraction (`virtualDriveProvider`).
- `vaidyarService` has hardcoded storage checks (`vault_mount`, `system_drive_posture`) that can block startup without host-level policy control.
- `virtualDriveProvider` already supports configurable provider binary path and provider abstraction; policy ownership can be injected without replacing provider mechanism.

## Recommended Architecture Patterns

### Pattern A: Capability Service + Structured Contract
Create a dedicated service for host dependency capability:
- Contract: `passed`, `missing`, `diagnostics[]`.
- Checks: SSH, Git, virtual-drive provider binary.
- Runtime-only output: no UI concerns, no startup-specific assumptions.

Why: Fits D-01, D-02, D-03 and aligns with existing service-oriented main-process architecture.

### Pattern B: Policy Injection with Backward-Compatible Defaults
Add a host policy contract for virtual drives:
- Keep `driveControllerService` as lifecycle/runtime owner.
- Introduce policy adapter/flags in runtime config (for example client-managed mount + diagnostic overrides).
- If policy absent, preserve current behavior for existing hosts.

Why: Satisfies D-04, D-05, D-06 while minimizing regressions.

### Pattern C: Diagnostics Severity/Ownership Overrides
Allow host-level control over drive-related diagnostic severity and blocking behavior:
- Integrate into Vaidyar checks and startup gate translation.
- Keep default strict posture; allow host-managed relaxation when configured.

Why: Resolves Dhi workaround pain and keeps core deterministic.

## Candidate Files for Implementation
- `src/main/services/hostDependencyCapabilityService.ts` (new)
- `src/main/services/startupOrchestratorService.ts`
- `src/main/services/driveControllerService.ts`
- `src/main/services/vaidyarService.ts`
- `src/main/services/runtimeConfigService.ts` (if new config surface required)
- `src/main/services/*.test.ts` for all touched services
- `docs/features/storage/virtual-drive.md` and related integration docs for contract updates

## Risks and Pitfalls
- Startup regressions if new policy defaults are not strictly backward-compatible.
- Security downgrade risk if diagnostic overrides are unconstrained.
- Contract drift between startup gate, drive diagnostics, and Vaidyar severity mapping.

## Mitigations
- Add tests for default path (no host policy) and client-managed path.
- Keep explicit severity bounds and transparent blocked signal mapping.
- Update docs-first artifacts before/with code changes to preserve atomic documentation constraints.

## Security Notes
- Maintain fail-closed defaults unless host policy explicitly overrides.
- Validate any host-provided policy at IPC/config boundary.
- Preserve path traversal guards and provider binary path safety constraints.

## Output
Planning should produce two execute plans:
- Plan 01: dependency capability contract and integration.
- Plan 02: virtual-drive policy decoupling and migration-safe startup/diagnostic wiring.
