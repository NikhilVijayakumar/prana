# Generate Feature Runtime Map — Template Schema

> Schema contract for the LLM-assisted runtime-map generation prompt.
> The corresponding prompt lives at `docs/raw/data/prompt/runtime-map/generate-feature-map.md`.

---

## Input Variables

| Variable | Type | Description | Source |
|---|---|---|---|
| `featureName` | string | Kebab-case feature identifier | Discovery manifest |
| `featureDoc` | string | Path to the feature documentation | Discovery manifest |
| `sourceFiles` | string[] | Paths to all TypeScript implementations for this feature | Discovery manifest |
| `sourceDir` | string | Feature implementation directory (`src/main/features/{name}/`) | Discovery manifest |
| `commonDependencies` | string[] | Common modules used (config, storage, types, ...) | Discovery manifest |
| `sourceCode` | string | Concatenated source code of all `sourceFiles` | Read from source files |
| `existingMap` | string | Contents of existing runtime-map (null if new) | Read from runtime-map dir |
| `operation` | enum | `"generate"` or `"update"` | Determined by file existence |
| `runtimeMapTemplate` | string | Contents of `runtime_map_template.md` | Loaded from template dir |

---

## Output Contract

| Field | Type | Description |
|---|---|---|
| `runtimeMapContent` | string | Complete `.md` file following `runtime_map_template.md` structure |
| `generationTimestamp` | string | ISO 8601 timestamp when generated |
| `updateTimestamp` | string | ISO 8601 timestamp when updated (same as generation for new files) |
| `sourceHashes` | string[] | SHA256 of each source file at generation time (for staleness detection) |
| `ambiguities` | array | List of questions for user clarification (empty if none) |

---

## Output File Structure

The generated content MUST follow `runtime_map_template.md` exactly with these populated sections:

```
# Feature Runtime Map

---

# Metadata
- Feature: {featureName}
- Feature Doc: {featureDoc}
- Implementation: src/main/features/{featureName}/
- Source Files: {file1.ts}, {file2.ts}, ...
- Common Dependencies: {config, storage, ...} (omit if none)
- Runtime Map: docs/raw/architecture/runtime-map/{featureName}.md
- Layer: {1-5}
- Runtime Classification: {classification(s)}
- Status: {✅ / ⚠️ / ❌}
- Last Generated: {generationTimestamp}
- Last Updated: {updateTimestamp}
- Workflow Version: 2.0
- Last Reviewed: {YYYY-MM-DD}
- Audit Suites Applied: {audit suites}

--- ... all sections from template ... ---

# Template Metadata
- Template Version: 2.0
- Generated From: runtime-map governance system
- Last Updated: {generationTimestamp}
```

---

## Validation Rules

1. All 22 sections from `runtime_map_template.md` MUST be present in order
2. Every compliance table must have score cells populated (not empty)
3. Detection Heuristics checkboxes must reflect actual source analysis of ALL source files
4. `Last Generated` is set once on creation and NEVER changed on update
5. `Last Updated` is updated to current time on every regeneration
6. `sourceHashes` tracks each source file individually — any changed file triggers an update
7. Ambiguities are returned as an array of user-facing questions — the caller pauses and asks before writing the file
8. `Common Dependencies` is omitted from metadata when the feature uses no common modules
