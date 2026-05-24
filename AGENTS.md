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
- **Import paths migrated**: `scripts/migrate-imports.py` rewrote all relative imports across `.ts` files (2 passes: first pass 300+ rewrites, second pass fixed 323 more rewrites, 9 files changed)
- **Type check passes with 0 errors** (was 70 errors)
- **Barrel files** created per feature folder; main index.ts updated
- **Stale file-path comments** fixed in 4 files

## Session Summary (May 22 2026)

### Done

- **Fixed discovery script bugs**: Windows path separator (`\` vs `/`) broke `FEATURE_FILE_MAP` key lookup; normalized `doc_rel` with `.replace("\\", "/")`
- **Improved FEATURE_FILE_MAP coverage**: broadened 12 entries (context `*`, sandbox `*`, vault `vault*`), added patterns for chat adapters, governance, RAG, onboarding lifecycle, model gateway, channel registry — all 23 features now resolve source files
- **Fixed unicode console issues**: replaced box-drawing (U+2500), em dashes (U+2014), checkmarks (U+2713) with ASCII equivalents in `grade.py`, `discovery.py`, `orchestrate.py`, `generate-manual.py`
- **Ran Phase 5-7 (Grade/Report/Index)**: 34 maps scored (grand avg 2.1/10), report written to `report/runtime-map/report.md`, index regenerated at `docs/raw/architecture/runtime-map/index.md`
- **Created `scripts/runtime-map-generate-manual.py`**: interactive prompt-paste workflow for generating runtime maps without API keys — loops through missing/stale features, prints composed prompt with source code + template, accepts pasted LLM response, parses JSON, writes file

### Next
1. Run `python scripts/runtime-map-grade.py --report && python scripts/runtime-map-index.py` to grade/index existing maps
2. Run `graphify update .` to sync the knowledge graph
