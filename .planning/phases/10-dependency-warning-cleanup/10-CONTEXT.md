# Phase 10: Dependency Warning Cleanup - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduce npm install warning noise by changing only dependencies Prana can directly maintain (especially Astra and direct package.json entries), while preserving build/typecheck behavior and avoiding scope creep into unowned upstream package internals.

</domain>

<decisions>
## Implementation Decisions

### Dependency Ownership Boundaries
- **D-01:** Treat `astra` as the primary maintainable external dependency and prefer fixes through Astra/package.json alignment first.
- **D-02:** Do not attempt invasive edits to transitive dependencies that Prana does not own.
- **D-03:** Where warning cleanup is possible, do it through direct version updates/alternatives in `package.json` (including targeted overrides), not patching vendor code.
- **D-09:** Do not modify or patch `node_modules` directly.
- **D-10:** Do not modify generated build artifacts or regenerated build files (for example outputs under `out/`); fix sources/manifests only.

### Warning Handling Strategy
- **D-04:** Resolve warnings that can be eliminated through direct dependency version upgrades or compatible alternatives in `package.json`.
- **D-05:** If warnings remain due to upstream toolchain packages (for example Electron packaging transitive chains), classify them as external/unowned and document clearly rather than forcing brittle hacks.
- **D-06:** Preserve the existing Astra export fix path and do not reintroduce compatibility workarounds that mask real dependency health.

### Validation Contract
- **D-07:** Every dependency change must be validated with `npm install`, `npm run typecheck`, and `npm run build`.
- **D-08:** Any residual warnings must be traced to exact dependency chains and separated into "fixable in-repo" vs "upstream external".

### the agent's Discretion
- Choose exact semver pin/range strategy for direct dependencies when multiple safe options exist.
- Decide whether to keep or remove targeted `overrides` entries after lockfile resolution, based on deterministic install behavior.

</decisions>

<specifics>
## Specific Ideas

- User direction: "Astra is the only dependency we maintain and it is clean; remaining issues are external dependencies we cannot edit. If possible, update versions or look for alternatives in package.json for a better fix."
- Prefer practical package-level remediation over theoretical full warning elimination if final warnings are only upstream transitive deprecations.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dependency manifests and state
- `package.json` — Direct dependencies, devDependencies, and overrides policy.
- `package-lock.json` — Actual resolved dependency graph and transitive source of warnings.
- `.planning/STATE.md` — Current phase status and completion tracking.

### Milestone/phase execution context
- `.planning/phases/10-dependency-warning-cleanup/10-01-PLAN.md` — Planned execution tasks and validation contract.
- `.planning/phases/10-dependency-warning-cleanup/10-01-SUMMARY.md` — Current execution outcomes and residual warning classification.

### Runtime dependency constraints
- `node_modules/astra/package.json` — Astra package metadata and version constraints currently in use.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json`: Existing direct dependency pinning and override support for deterministic installs.
- `src/ui/mui.d.ts`: Restores custom MUI typography variant typing after dependency updates.

### Established Patterns
- Dependency hygiene fixes are done through manifest-level changes plus lockfile regeneration, followed by full typecheck/build validation.
- UI typing compatibility is preserved via local module augmentation instead of loosening type checks across call sites.

### Integration Points
- Direct dependency updates impact `npm install` and all build scripts in `package.json`.
- Toolchain-level warnings come through Electron/Electron Builder transitive trees and may remain even after in-repo direct dependency cleanup.

</code_context>

<deferred>
## Deferred Ideas

- Replacing Electron packaging/runtime toolchain dependencies solely to eliminate upstream deprecation warnings.
- Forking or patch-maintaining unowned transitive dependencies.

</deferred>

---

*Phase: 10-dependency-warning-cleanup*
*Context gathered: 2026-04-11*