# Runtime Map Index — Template Schema

> Schema contract for the runtime-map index generator.
> The corresponding script lives at `scripts/runtime-map-index.py`.
> The LLM prompt lives at `docs/raw/data/prompt/runtime-map/generate-index.md`.

---

## Input Variables

| Variable | Type | Description | Source |
|---|---|---|---|
| `maps` | array | Per-file metadata objects parsed from each runtime-map | Parsed from `docs/raw/architecture/runtime-map/*.md` |
| `generatedAt` | string | ISO 8601 timestamp of index generation | Current time |
| `totalMaps` | int | Total number of runtime-map files | Script count |

### Per-File Metadata Object

| Field | Type | Description |
|---|---|---|
| `filename` | string | Basename of the runtime-map file (e.g., `email.md`) |
| `featureName` | string | Feature identifier from Metadata table |
| `featureDoc` | string | Path to the feature documentation |
| `implementation` | string | Path(s) to implementation source files |
| `layer` | string | Layer identifier from Metadata table |
| `status` | string | Compliance status (Compliant / Transitional / Violation) |
| `lastGenerated` | string | UTC timestamp of first generation |
| `lastUpdated` | string | UTC timestamp of last update |
| `lastReviewed` | string | Date of last manual review |
| `scores` | object | Per-category scores (e.g., `Runtime Purity: 9.2`) |
| `grandTotal` | float | Overall grand total score |

---

## Index Structure

The generated `index.md` MUST contain these sections in order:

```
# Runtime Map Index

## Mental Model
  - Layer equivalence table

## All Runtime Maps ({N} Total)
  - Grouped by layer in display order:
    Layer 0: Authentication
    Layer 1: Bootstrap & Foundation
    Layer 1B: Runtime Fabric
    Layer 2: Secure Persistence
    Layer 3: Data Lifecycle & Sync
    Layer 4: Intelligence & Integration
    Governance & Diagnostics
  - Per-layer table: | Runtime Map | Feature Doc | Implementation |

## Analysis Reports
  - Table of supplementary analysis reports in the same directory

## Verification Status
  - Per-invariant compliance summary (Statelessness, Determinism, etc.)

## Score Summary
  - Aggregate: | Category | Average | Min | Max | Count |

## Key Metrics
  - Total count, compliant/transitional/violation breakdown, template version

## Layer Summary
  - Per-layer count table

## Footer
  - Last Updated timestamp
  - Auto-generated attribution
```

---

## Layer Mapping Rules

| Raw Metadata Layer Values | Normalized Group |
|---|---|
| `0`, `0 - Authentication`, `Authentication` | `Layer 0: Authentication` |
| `1`, `1 - Bootstrap & Foundation`, `Bootstrap & Foundation` | `Layer 1: Bootstrap & Foundation` |
| `1B`, `1B - Runtime Fabric`, `Runtime Fabric` | `Layer 1B: Runtime Fabric` |
| `2`, `2 - Secure Persistence`, `Secure Persistence` | `Layer 2: Secure Persistence` |
| `3`, `3 - Data Lifecycle & Sync`, `Data Lifecycle & Sync` | `Layer 3: Data Lifecycle & Sync` |
| `4`, `4 - Intelligence & Integration`, `Intelligence & Integration` | `Layer 4: Intelligence & Integration` |
| Any other value | `Governance & Diagnostics` |

---

## Validation Rules

1. All runtime-map `.md` files in the directory MUST be included except those in `EXCLUDE_FILES` (index.md, activity-log.md)
2. Metadata must be parsed from both `# Metadata` (feature-style) and `## Metadata` (service-style) table formats
3. Files without parsable metadata use their filename stem as fallback name
4. Layer normalization is case-insensitive and prefix-matches (e.g., `1` matches `1 - Bootstrap & Foundation`)
5. Score Summary section parsing must handle both `/10` and `/5` denominator formats
6. Analysis Reports section includes only files that actually exist in the directory
7. `Last Updated` footer is set to the current generation timestamp

---

## Integration

The index is consumed by:
- **Developers** — quick navigation between runtime-maps
- **Architects** — cross-cutting view of governance compliance
- **Auditors** — verification that all features have runtime-maps
