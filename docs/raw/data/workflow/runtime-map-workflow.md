# Runtime Map Workflow

> Canonical workflow for generating, updating, grading, and reporting on Feature Runtime Maps.
> Part of: features → invariants → runtime-map → audit-governance

---

## Overview

This workflow manages the lifecycle of runtime-map documents across all features. It consists of 7 steps, each producing an artifact consumed by the next step.

```
Step 1: Feature Discovery   ──→  manifest.json
Step 2: Common Inventory    ──→  dependency info
Step 3: User Verification   ──→  approved manifest
Step 4: Generate / Update   ──→  runtime-map files
Step 5: Grading             ──→  score summaries
Step 6: Reporting           ──→  report.md
Step 7: Review              ──→  action items
```

---

## Step 1 — Feature Discovery

**Script:** `scripts/runtime-map-feature-discovery.py`

Scans `docs/raw/features/` to discover all documented features and produces:

1. **Terminal table** — human-readable list of all features with status (has map / missing / needs update), source file count, common dependencies
2. **JSON manifest** at `/tmp/runtime-map-manifest.json` — consumed by downstream steps

### Manifest Schema

```json
{
  "generatedAt": "2026-05-21 14:30",
  "totalFeatures": 23,
  "features": [
    {
      "featureName": "email",
      "featureDoc": "docs/raw/features/email/email.md",
      "sourceFiles": ["features/communication/emailService.ts", "features/communication/emailOrchestratorService.ts"],
      "featureDirs": ["communication"],
      "commonDependencies": ["config", "storage"],
      "existingMap": "docs/raw/architecture/runtime-map/email.md",
      "status": "up-to-date",
      "needsUpdate": false,
      "mapLastUpdated": "2026-05-21",
      "sourceHashes": ["abc123...", "def456..."]
    }
  ]
}
```

### Resolution Strategy

Each feature doc `.md` file under `docs/raw/features/{dir}/` maps to:

| Source | Description |
|---|---|
| **`src/main/features/`** | Feature implementation directory — discovered via name matching + hardcoded mapping (e.g., `email/` → `features/communication/`) |
| **`src/main/common/`** | Common dependencies — detected from import analysis in source files (e.g., `config`, `storage`, `types`) |
| **Runtime-map file** | `docs/raw/architecture/runtime-map/{doc-stem}.md` — naming matches the feature doc stem |

### Status Values

| Status | Meaning |
|---|---|
| `missing` | No runtime-map exists — requires generation |
| `stale` | Runtime-map exists but source or doc is newer — requires update |
| `up-to-date` | Runtime-map exists and is current — no action needed |

---

## Step 2 — Common Dependency Inventory

**Script:** `scripts/runtime-map-feature-discovery.py` (built into manifest)

For each feature, common dependencies are listed in `commonDependencies`. These reference modules in `src/main/common/`:

| Common Module | Path |
|---|---|
| `config` | `src/main/common/config/` — runtime configuration, env, token management |
| `storage` | `src/main/common/storage/` — SQLite access, caching, encryption |
| `types` | `src/main/common/types/` — shared type definitions (channel adapter types, orchestration types, sandbox types) |
| `protocols` | `src/main/common/protocols/` — shared agent base protocol interfaces |
| `utils` | `src/main/common/utils/` — shared utilities (e.g., global fetch wrapper) |

Common modules do NOT get their own runtime-maps by default. They are listed as dependency context in each feature's runtime-map metadata. If a feature uses no common modules, the field is omitted entirely.

---

## Step 3 — User Verification

**Role: Human / Agent**

Review the terminal table from Step 1:

1. **Confirm the feature list** — are all documented features included? Are UI-only docs (viewer screens, storage governance specs) correctly excluded?
2. **Resolve unmapped features** — for any feature with no source files or unexpected common deps, check the feature doc and clarify the mapping
3. **Approve manifest** — confirmed manifest becomes the execution plan for Step 4

**Output:** Approved feature list (may be a subset)

---

## Step 4 — Generate / Update

**Prompt:** `docs/raw/data/prompt/runtime-map/generate-feature-map.md`
**Template:** `docs/raw/data/template/runtime_map_template.md`
**Schema:** `docs/raw/data/template/generate-feature-map.md`

For each feature in the approved manifest:

1. Read all source files from `sourceFiles`
2. Read the existing runtime-map (if `status === "stale"`)
3. Feed the `generate-feature-map.md` prompt + all source code to an LLM
4. The LLM analyzes ALL files holistically and produces a single feature-level runtime-map
5. Review the LLM output:
   - If `ambiguities` is non-empty, resolve with the user before proceeding
   - If clean, save the `runtimeMapContent` to `docs/raw/architecture/runtime-map/{featureName}.md`
6. Set `Last Generated` (preserve if updating) and `Last Updated` (always current) in the Metadata section

### Per-Feature Flow

```
For each feature in approved manifest:
  ├── status == "missing"  → LLM generates new file
  ├── status == "stale"    → LLM updates existing file
  └── status == "up-to-date" → skip
```

### Multi-File Analysis

When a feature has multiple source files, the LLM evaluates the feature as a whole:
- **Responsibility** — covers all source files; each file may handle a distinct sub-responsibility
- **Scoring** — worst offender across all files determines the feature score
- **Classification** — may differ per file; select all that apply to the feature

### LLM Clarification Loop

When the LLM encounters ambiguity, it returns questions. The caller (human or agent) answers them, then re-runs that feature through the LLM with the additional context. Do NOT guess — every unresolved ambiguity leads to incorrect runtime-map content.

---

## Step 5 — Grading

**Script:** `scripts/runtime-map-grade.py`

Run on all runtime-map files:

```bash
python scripts/runtime-map-grade.py
```

This updates each runtime-map in-place:
1. Computes section averages and score rows
2. Updates the Score Summary table with grand total, letter grade, relative score, and relative grade

The script is idempotent — safe to run multiple times. Running it after every batch generation keeps grades current.

---

## Step 6 — Reporting

**Script:** `scripts/runtime-map-grade.py --report`

Generates a summary report at `report/runtime-map/report.md`:

```bash
python scripts/runtime-map-grade.py --report
```

### Report Contents

| Section | Content |
|---|---|
| Header | Report date, total features, cross-file average |
| Score Table | Per-feature: section scores, grand total, grade, relative score, relative grade |
| Grade Distribution | Count of A/B/C/D/F grades |
| Best / Worst | Top and bottom 3 features |
| LLM Analysis | Narrative, patterns, remediation priorities (from `grade-analysis.md` prompt) |

### LLM Analysis in Report

The `--report` flag optionally reads `docs/raw/data/prompt/runtime-map/grade-analysis.md` and feeds the score data to an LLM for interpretation. The analysis is appended to the report under a `## LLM Analysis` section.

To skip LLM analysis (faster, no API call), omit the prompt file or run without `--report`.

---

## Step 7 — Review

**Role: Human / Agent**

Review the report at `report/runtime-map/report.md`:

1. **Check for regressions** — compare with previous report (if available)
2. **Identify priority fixes** — use remediation priorities from the LLM analysis
3. **Plan refactoring** — create tickets or tasks for the highest-impact improvements
4. **Update Last Reviewed** — for features that were manually reviewed, update the `Last Reviewed` timestamp in the runtime-map Metadata

---

## File Reference

| Artifact | Path |
|---|---|
| Workflow definition | `docs/raw/data/workflow/runtime-map-workflow.md` |
| Feature map template | `docs/raw/data/template/runtime_map_template.md` |
| Generation schema | `docs/raw/data/template/generate-feature-map.md` |
| Grade analysis template | `docs/raw/data/template/grade-analysis.md` |
| LLM prompt (overview) | `docs/raw/data/prompt/runtime-map/runtime-map.md` |
| LLM prompt (generation) | `docs/raw/data/prompt/runtime-map/generate-feature-map.md` |
| LLM prompt (grade analysis) | `docs/raw/data/prompt/runtime-map/grade-analysis.md` |
| Discovery script | `scripts/runtime-map-feature-discovery.py` |
| Grade script | `scripts/runtime-map-grade.py` |
| Runtime-map files | `docs/raw/architecture/runtime-map/*.md` |
| Report | `report/runtime-map/report.md` |
| Manifest (transient) | `/tmp/runtime-map-manifest.json` |
