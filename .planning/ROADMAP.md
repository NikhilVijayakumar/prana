# Roadmap: Prana Feature Evolution

- [v1.3: Feature Expansion & Ecosystem Integration](./milestones/v1.3-ROADMAP.md) — 2026-04-11
- [v1.2: Security Hardening & Spec Reconcilation](./milestones/v1.2-ROADMAP.md) — 2026-04-10
- [v1.1: Core Infrastructure Stabilization](./milestones/v1.1-ROADMAP.md) — 2026-04-09

### Phase 1: chakra is the app which now integrate drive apart from dhi rest of dhi is interanly integrate by chakra so please check chakra pr high preiority docs\pr\chakra can you check and create plan to fix it

**Goal:** Add upstream runtime contracts so Chakra can consume Prana as a reusable host runtime: (1) generic host dependency capability checks and (2) client-owned virtual-drive policy.
**Requirements**: CHAKRA-PR-01, CHAKRA-PR-02
**Depends on:** Phase 0
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Add reusable host dependency capability service + startup diagnostics integration
- [x] 01-02-PLAN.md — Decouple virtual-drive policy ownership to host-managed runtime contract

### Phase 2: please update documention and index based on our implementation

**Goal:** Align documentation and indexes with phase 01 runtime contract implementations so docs are authoritative and script-generated index content stays canonical.
**Requirements**: DOC-ALIGN-01, DOC-ALIGN-02
**Depends on:** Phase 1
**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md — Update index generation sources and regenerate docs/index.md from script
- [x] 02-02-PLAN.md — Reconcile touched docs and navigation indexes to match implemented runtime contracts

---

## Current Milestone: v1.4 (Planned)

> [!NOTE]
> Run `/gsd-new-milestone` to initialize the next development cycle.
