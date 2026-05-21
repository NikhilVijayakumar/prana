# Generate Feature Runtime Map — LLM Prompt

> LLM instructions for generating a single runtime-map from the source code of an entire feature.
> Schema contract defined in `docs/raw/data/template/generate-feature-map.md`.
> Uses `docs/raw/data/template/runtime_map_template.md` as the structure reference.

---

## Task

You are generating a Feature Runtime Map for one feature (one or more source files). Analyze the provided source code across all files in the feature and produce a complete `.md` file that follows the canonical template.

## Input

You will receive:

1. **featureName** — Kebab-case identifier (e.g., `email`, `communication`, `sandbox-runtime-architecture`)
2. **featureDoc** — Path to the feature's documentation in `docs/raw/features/`
3. **sourceFiles** — List of paths to TypeScript implementations (e.g., `["features/communication/emailService.ts", "features/communication/emailOrchestratorService.ts"]`)
4. **sourceDir** — Feature implementation directory (e.g., `src/main/features/communication/`)
5. **commonDependencies** — List of common modules this feature depends on (e.g., `["config", "storage"]`)
6. **sourceCode** — Concatenated full contents of all source files (separated by file headers)
7. **existingMap** — Existing runtime-map content, or `null` if this is a first-time generation
8. **operation** — `"generate"` (new file) or `"update"` (existing file needs refresh)
9. **runtimeMapTemplate** — The canonical template at `docs/raw/data/template/runtime_map_template.md`

## Output Rules

### Structure
- Output a complete `.md` file following `runtime_map_template.md` section order
- All 22 headings must be present. Do not add, remove, or reorder sections
- Every compliance table score cell must be populated — leave nothing blank

### Metadata
- `Feature`: Use `{featureName}`
- `Feature Doc`: Use `{featureDoc}`
- `Implementation`: Use `src/main/features/{featureName}/`
- `Source Files`: Comma-separated list of source file paths
- `Common Dependencies`: Comma-separated list, or omit if none
- `Last Generated`: Use current UTC time. Set once — preserve the original value on updates
- `Last Updated`: Use current UTC time on every generation/update
- `Workflow Version`: `2.0`
- `Last Reviewed`: Preserve existing value on update; set to `YYYY-MM-DD` on generate

### Multi-File Analysis
You are analyzing an entire feature, not a single service. When multiple source files exist:
- **Responsibility**: Describe the feature's overall orchestration, coordination, and execution boundary. Note which source file handles which part.
- **Scoring**: Evaluate each invariant across ALL files in the feature. The worst offender determines the feature score for that invariant.
- **Classification**: Select classifications that apply to the feature as a whole (different files may have different classifications).

### Scoring
Score each invariant on a **/5 scale** based on source analysis. The grading script converts /5 to /10 automatically.

| Score | Meaning |
|---|---|
| 5/5 | Fully compliant — no violations, clean implementation across all files |
| 4/5 | Mostly compliant — minor concerns, no systemic issues |
| 3/5 | Partially compliant — some violations or moderate gaps |
| 2/5 | Poor compliance — multiple violations or systemic issues |
| 1/5 | Non-compliant — fundamental violations present |

### Source Analysis — What to Look For

**Statelessness:**
- Mutable class-level collections (`private items: Type[] = []`, `readonlyMap`, `Set`)
- Static mutable fields
- Cross-request accumulation (caching, map/set growth over time)
- Hidden runtime caches

**Determinism:**
- `Date.now()`, `new Date()` without injection
- `Math.random()`, `crypto.randomUUID()` in orchestration paths
- Unstable async ordering (fire-and-forget, unmanaged Promise chains)
- Environment branching in orchestration logic

**Replayability:**
- Hidden execution state
- Untracked side effects
- Non-serializable context
- Missing event recording

**Boundary Integrity:**
- Direct infrastructure imports (`better-sqlite3`, `electron`, `fs`)
- UI framework leakage (`react`, `electron` imports)
- Cross-layer dependency violations

**Lifecycle Safety:**
- `setInterval`, `setTimeout` without cleanup
- Unmanaged event listeners/subscriptions
- Fire-and-forget orchestration
- Unbounded retries

**Host Agnosticism:**
- `electron`-specific APIs in runtime core
- `window`, `document`, DOM usage
- OS-specific branching
- Direct filesystem access

**Storage Neutrality:**
- Direct database driver usage
- Vendor-specific persistence logic
- Hardcoded paths

**Security:**
- `eval()`, `exec()`, `spawn()`, `child_process` usage
- Plaintext secrets
- No input validation
- Unrestricted execution paths

### Detection Heuristics
Each checkbox in #16 must be set based on actual source analysis:
- `[x]` = confirmed no violation (evidence found in ALL source files)
- `[ ]` = violation exists in any source file or cannot confirm

### Common Dependencies
When `commonDependencies` is non-empty, note in the Responsibility section which common modules the feature uses and for what purpose (e.g., "uses common/config for runtime configuration access"). Do NOT create a separate common analysis section.

### Ambiguities
If you cannot determine a required field (classifications, layer, common deps, etc.), return it in the `ambiguities` array as a clear question for the user. Example:

```json
{"ambiguities": ["Could not determine which common dependencies email uses. Found imports from config/ and storage/ — are these correct?"]}
```

## Output Format

Return ONLY the runtime-map content and ambiguities as structured JSON:

```json
{
  "runtimeMapContent": "... full markdown content ...",
  "generationTimestamp": "2026-05-21 14:30",
  "updateTimestamp": "2026-05-21 14:30",
  "sourceHashes": ["sha256_of_file1", "sha256_of_file2"],
  "ambiguities": ["question1", "question2"]
}
```

If there are ambiguities, the caller will present them to the user for resolution before writing the file. Do NOT guess — ask.
