# Grade Analysis — LLM Prompt

> LLM instructions for interpreting runtime-map grade data.
> Used by `scripts/runtime-map-grade.py --report` to populate the `## LLM Analysis` section.

---

## Task

You are analyzing a batch of runtime-map grades across all features. Given the score data below, produce an executive summary with patterns, anomalies, and prioritized remediation recommendations.

## Input

You will receive structured grade data:

1. **scores** — Array of per-feature score objects:
   ```json
   {
     "feature": "email",
     "purity": 9.6,
     "integrity": 10.0,
     "neutrality": 10.0,
     "extensibility": 10.0,
     "security": 10.0,
     "grandTotal": 9.9,
     "grade": "A",
     "relativeScore": 3.2,
     "relativeGrade": "A"
   }
   ```
2. **distribution** — `{ "A": 2, "B": 3, "C": 4, "D": 1, "F": 1 }`
3. **crossFileAvg** — Float (e.g., 6.7)
4. **reportDate** — ISO 8601 timestamp
5. **totalFeatures** — Integer
6. **featureCounts** — `{ "generated": N, "updated": N, "skipped": N }`

## Analysis Instructions

### What to analyze

1. **Overview** — Total features, cross-file average, distribution shape

2. **Patterns**:
Identify recurring structural issues across features. Examples:
- "4 of the 5 lowest-scoring features have module-level mutable state"
- "Runtime Security is the lowest-scoring section across all features"
- "All 3 persistence boundary features scored below average on Platform Neutrality"

### Remediation Priorities
Ordered list (highest impact first). Each entry:
- **Feature** — name
- **Section** — which section needs attention
- **Current Score** — what it is now
- **Issue** — what the source analysis reveals
- **Action** — what to fix

### Anomalies
Features worth special attention:
- High score despite complexity (investigate — might be under-scored)
- Low score despite simplicity (might be over-scored or have hidden issues)
- Significant relative grade deviation from peer group

## Output Format

Return structured JSON matching the contract in `docs/raw/data/template/grade-analysis.md`:

```json
{
  "narrative": "...",
  "patterns": ["..."],
  "remediationPriorities": [
    {
      "feature": "context-engine",
      "section": "Runtime Purity",
      "section": "Runtime Purity",
      "currentScore": 4.3,
      "issue": "Module-level mutable state registry",
      "action": "Refactor state ownership to use dependency injection"
    }
  ],
  "qualityTrend": "stable",
  "anomalies": [
    {
      "feature": "orchestration-manager",
      "deviation": -1.3,
      "note": "Complex orchestrator scoring below simple services — expected"
    }
  ],
  "recommendations": [
    "Prioritize context-engine for refactoring — lowest purity score",
    "..."
  ]
}
```

Do not fabricate data. If you cannot determine a pattern, state that clearly.
