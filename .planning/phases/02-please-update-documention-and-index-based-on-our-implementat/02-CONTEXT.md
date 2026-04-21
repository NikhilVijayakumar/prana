# Phase 02: Documentation and Index Alignment - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Update documentation and documentation indexes so they reflect the implemented runtime contracts from phase 01 and become the source of truth. Scope includes all touched and stale docs connected to those implementation changes, plus index generation sources.

</domain>

<decisions>
## Implementation Decisions

### Scope and source-of-truth policy
- **D-01:** Update all touched documentation artifacts related to the implemented phase 01 contracts, not only a single index file.
- **D-02:** Clean stale documentation references found in touched areas so documentation is the source of truth.
- **D-03:** Include generated index and non-generated index surfaces where relevant (for example docs index plus feature-level index and related references).

### Index generation workflow
- **D-04:** Keep documentation index generation script-driven. `docs/index.md` must be generated from script sources, not manually edited as the final source.
- **D-05:** If index content is incorrect or outdated, fix generator inputs and/or generation logic first (for example `scripts/wiki-steps.json` and `scripts/generate-index.cjs`), then regenerate.

### Contract rollout posture
- **D-06:** Do not add migration/backward-compatibility notes for old contract behavior in this phase.
- **D-07:** Treat the new contract language as canonical because no consuming apps are live yet.

### the agent's Discretion
- Exact wording/tone normalization across touched docs.
- How to structure section ordering in docs indexes while preserving existing repository style.
- Whether to add concise cross-links in README quick navigation when that improves discoverability without expanding scope.

</decisions>

<specifics>
## Specific Ideas

- Documentation should mirror implementation reality from phase 01 (host dependency capability gate and client-managed virtual-drive policy boundaries).
- Stale content in touched docs should be cleaned immediately rather than deferred.
- Generated index behavior remains script-owned.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 01 implementation truth
- `.planning/phases/01-chakra-is-the-app-which-now-integrate-drive-apart-from-dhi-r/01-01-SUMMARY.md` - Startup host dependency capability service + gating behavior delivered.
- `.planning/phases/01-chakra-is-the-app-which-now-integrate-drive-apart-from-dhi-r/01-02-SUMMARY.md` - Client-managed virtual-drive policy contract and policy-aware startup/diagnostics behavior delivered.

### Documentation targets and indexes
- `docs/features/boot/startup-orchestrator.md` - Startup stages and host dependency gate contract.
- `docs/features/storage/virtual-drive.md` - Runtime mechanism vs host policy ownership contract.
- `docs/index.md` - Generated repository documentation index output.
- `docs/features/index.md` - Atomic feature documentation index and navigation.
- `README.md` - Top-level navigation and doc contract references.

### Index generation sources
- `scripts/generate-index.cjs` - Index generation logic and section assembly.
- `scripts/wiki-steps.json` - Index content model (sections, concept map, feature details, rules, flows).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/generate-index.cjs`: Walks docs tree, builds section blocks from config, and writes `docs/index.md`.
- `scripts/wiki-steps.json`: Central config for concept mapping, feature details, flow text, and section ordering used by generator.

### Established Patterns
- Documentation-first and atomic documentation conventions are defined in project/planning docs and should remain consistent with feature docs structure.
- Generated index output is intended to be derived from script/config, not hand-curated drift.

### Integration Points
- Docs updates must align with runtime contracts implemented in `src/main/services/startupOrchestratorService.ts`, `src/main/services/hostDependencyCapabilityService.ts`, `src/main/services/driveControllerService.ts`, and `src/main/services/vaidyarService.ts`.
- Navigation consistency spans generated `docs/index.md`, manual `docs/features/index.md`, and README links.

</code_context>

<deferred>
## Deferred Ideas

- Broad documentation redesign unrelated to phase 01 contract deltas.
- New feature documentation for capabilities not implemented in phase 01.

</deferred>

---

*Phase: 02-please-update-documention-and-index-based-on-our-implementat*
*Context gathered: 2026-04-21*
