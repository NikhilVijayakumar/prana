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
