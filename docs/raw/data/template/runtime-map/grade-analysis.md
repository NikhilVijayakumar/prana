# Grade Analysis — Template Schema

> Schema contract for the LLM-assisted grade interpretation prompt.
> The corresponding prompt lives at `docs/raw/data/prompt/runtime-map/grade-analysis.md`.

---

## Input Variables

| Variable | Type | Description | Source |
|---|---|---|---|
| `scores` | array | Per-service score objects with fields: `service`, `sections`, `grandTotal`, `grade`, `relativeScore`, `relativeGrade` | `runtime-map-grade.py --report` output |
| `crossFileAverage` | float | Mean grand total across all runtime-maps | Grade script |
| `gradeDistribution` | object | Count of A/B/C/D/F grades | Grade script |
| `reportDate` | string | Date the report was generated | Grade script |
| `totalServices` | int | Number of services graded | Grade script |
| `serviceCounts` | object | `{ generated: N, updated: N, skipped: N }` | Discovery manifest |

---

## Output Contract

| Field | Type | Description |
|---|---|---|
| `narrative` | string | 2-3 paragraph executive summary of the grade results |
| `patterns` | array | Recurring patterns found across services (e.g., "4 of 5 low-scoring services share mutable class-level state") |
| `remediationPriorities` | array | Ordered list of services and sections that need attention, with rationale |
| `qualityTrend` | string | "improving" / "stable" / "declining" (only meaningful after 2+ runs) |
| `anomalies` | array | Services whose scores deviate significantly from peers, with explanation |
| `recommendations` | array | Actionable suggestions for improving runtime governance scores |

---

## Narrative Structure

The analysis narrative should follow this structure:

1. **Overview** — Total services graded, cross-file average, grade distribution (e.g., "45% of services scored C or below")
2. **Top Performers** — What the A-range services do differently (common patterns)
3. **Areas of Concern** — Low-scoring sections, recurring violations, systemic issues
4. **Priority Actions** — Ordered remediation recommendations with service names and section references
5. **Notable Anomalies** — Services that buck the trend (high despite complexity, low despite simplicity)

---

## Integration

The analysis output is appended to `report/runtime-map/report.md` after the score table, under a `## LLM Analysis` section.
