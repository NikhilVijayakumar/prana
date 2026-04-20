# Phase 01: Chakra Runtime Integration Contracts - Context

## Goal
Plan and implement the high-priority Chakra PR requests in Prana so host apps can integrate runtime capabilities without app-specific coupling.

## Decisions

### Locked Decisions
- D-01: Implement a reusable, page-agnostic host dependency capability service in Prana core/runtime (not splash-specific).
- D-02: Host dependency capability must check binary availability for SSH, Git, and virtual-drive runtime (rclone/provider binary path support where configured).
- D-03: Dependency capability output contract must include `passed`, `missing`, and per-dependency diagnostics; callers own rendering and flow behavior.
- D-04: Decouple virtual-drive policy ownership from Prana core so client apps control drive schema/content/encryption policy while Prana keeps lifecycle/runtime capability.
- D-05: Preserve current mount/unmount mechanism where possible (minimal breaking change migration path).
- D-06: Keep drive lifecycle guarantees: mount/open on app start and eject/unmount on app stop (unless client-managed policy explicitly opts out).
- D-07: Keep vault encryption behavior; do not remove existing vault security controls.
- D-08: Do not implement Chakra-specific schema/content directly in Prana core.

### the agent's Discretion
- Adapter naming and exact TypeScript interface shapes for client-managed virtual-drive policy.
- Where to expose capability contracts (service-only and/or IPC endpoint) as long as page/UI coupling is avoided.
- Backward-compatible defaults for existing Dhi/Prana behavior when new host-policy flags are absent.

## Canonical References
- docs/pr/chakra/splash-dependency-precheck-proposal.md
- docs/pr/chakra/drive-decoupling-client-owned-policy-proposal.md
- docs/pr/dhi/client-controlled-drive-mounting.md
- src/main/services/driveControllerService.ts
- src/main/services/virtualDriveProvider.ts
- src/main/services/startupOrchestratorService.ts
- src/main/services/vaidyarService.ts
- docs/features/storage/virtual-drive.md

## Deferred Ideas
- Automatic host dependency installation flows.
- Chakra-specific drive schema/folder conventions in Prana core.
- Replacing the provider stack wholesale (incremental contract refactor only in this phase).

---

*Phase: 01-chakra-is-the-app-which-now-integrate-drive-apart-from-dhi-r*
*Context gathered: 2026-04-20 via docs/pr/chakra proposals*
