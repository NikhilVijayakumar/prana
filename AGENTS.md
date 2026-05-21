# Agent Instructions

Follow docs/core.md and README.md.
Follow all rules defined in:

- docs/core.md

Do not:
- modify docs/raw
- assume wiki is correct
- make large updates without confirmation

Use:
- ingest
- update
- validate
- refresh

Prefer smallest scope.

Ask when uncertain.

Do not override or reinterpret these rules.

If there is ambiguity, ask the user.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## Session Summary (May 21 2026)

### Done

- **common/features restructure**: `src/main/` reorganized into `common/` (shared infrastructure) and `features/` (business capabilities); `services/` cleaned entirely; 62 files had imports rewritten, type check passes with 0 errors
- **Workflow system created**: `docs/raw/data/workflow/runtime-map-workflow.md` (6 steps), 3 templates + 3 prompts for LLM-assisted generation and grade analysis
- **Grading fixed & run**: regex handles blank line before `---`, stores /10 values; all 15 existing runtime-maps graded (grand avg 6.7/10); `--report` flag writes `report/runtime-map/report.md`
- **Discovery script** (`scripts/runtime-map-service-discovery.py`): scans 129 services, outputs manifest + terminal table
- **DDD restructure completed**: 134 files moved from flat `services/` to 14 feature folders under `src/main/` (auth, vault, sync, communication, agent, orchestration, sandbox, storage, context, registry, governance, operations, intelligence, config + types/, utils/, workers/)
- **Import paths migrated**: `scripts/migrate-imports.py` rewrote all relative imports across `.ts` files (2 passes: first pass 300+ rewrites, second pass fixed types/ subdirectory edge case — 323 more rewrites, 9 files changed)
- **Type check passes with 0 errors** (was 70 errors)
- **Barrel files** created per feature folder; main index.ts updated
- **Stale file-path comments** fixed in 4 files

### Next
1. Run `graphify update .` to sync the graph
2. Batch runtime-map generation for remaining ~100 services using the workflow
3. Verify discovery/grading scripts still work post-restructure
