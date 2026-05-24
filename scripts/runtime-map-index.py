#!/usr/bin/env python3
"""
Runtime Map — Index Generator

Scans docs/raw/architecture/runtime-map/*.md, extracts metadata and scores
from each runtime-map, groups by layer, and writes/updates index.md.

Usage:
  python scripts/runtime-map-index.py                        # generate index
  python scripts/runtime-map-index.py --prompt               # include LLM prompt path for narrative
"""

import argparse
import re
from datetime import datetime, timezone
from pathlib import Path

RUNTIME_MAP_DIR = Path("docs/raw/architecture/runtime-map")
REPORT_DIR = Path("report/runtime-map")
INDEX_FILE = RUNTIME_MAP_DIR / "index.md"
INDEX_PROMPT = Path("docs/raw/data/prompt/runtime-map/generate-index.md")

EXCLUDE_FILES = {"index.md", "activity-log.md"}
ANALYSIS_REPORTS = {
    "persistence-layer.md": "SQL.js → better-sqlite3 migration (20 services)",
    "services-stateless-compliance.md": "26 services compliance status",
}

# Layer ordering for display
LAYER_ORDER = [
    "0", "0 - Authentication", "Authentication",
    "1", "1 - Bootstrap & Foundation", "Bootstrap & Foundation",
    "1B", "1B - Runtime Fabric", "Runtime Fabric",
    "2", "2 - Secure Persistence", "Secure Persistence",
    "3", "3 - Data Lifecycle & Sync", "Data Lifecycle & Sync",
    "4", "4 - Intelligence & Integration", "Intelligence & Integration",
]

GOVERNANCE_KEYS = ["governance", "diagnostics", "onboarding", "vaidyar", "visual"]


def normalize_layer(raw: str) -> str:
    """Normalize layer string for grouping."""
    raw = raw.strip().lower()
    for prefix, label in [
        ("0", "0: Authentication"),
        ("1b", "1B: Runtime Fabric"),
        ("1", "1: Bootstrap & Foundation"),
        ("2", "2: Secure Persistence"),
        ("3", "3: Data Lifecycle & Sync"),
        ("4", "4: Intelligence & Integration"),
    ]:
        if raw.startswith(prefix):
            return label
    return "Other: Governance & Diagnostics"


def layer_sort_key(label: str) -> int:
    order = {
        "0: Authentication": 0,
        "1: Bootstrap & Foundation": 1,
        "1B: Runtime Fabric": 2,
        "2: Secure Persistence": 3,
        "3: Data Lifecycle & Sync": 4,
        "4: Intelligence & Integration": 5,
        "Other: Governance & Diagnostics": 6,
    }
    return order.get(label, 99)


def parse_metadata(text: str) -> dict:
    """Parse metadata from a runtime-map file."""
    meta = {
        "feature_name": None,
        "feature_doc": None,
        "implementation": None,
        "layer": None,
        "status": None,
        "last_generated": None,
        "last_updated": None,
        "last_reviewed": None,
        "classification": None,
        "scores": {},
        "grand_total": None,
    }

    # Match metadata table rows — handles both # Metadata and ## Metadata styles
    meta_match = re.search(
        r'#+\s+Metadata\s*\n\|.*?\n\|.*?\n((?:\|.*?\n)*)',
        text,
        re.DOTALL
    )
    if not meta_match:
        return meta

    table = meta_match.group(1)

    for line in table.split('\n'):
        cells = [c.strip() for c in line.split('|')]
        if len(cells) < 3:
            continue

        key = cells[1].lower().strip()
        value = cells[2].strip().strip('`')

        if 'feature' in key and 'doc' not in key and 'name' not in key:
            meta["feature_name"] = value
        elif 'feature doc' in key or 'feature' in key and 'doc' in key:
            meta["feature_doc"] = value
        elif 'implementation' in key:
            meta["implementation"] = value
        elif key == 'layer' or 'layer' in key:
            meta["layer"] = value
        elif 'status' in key and 'compliance' not in key and 'migration' not in key:
            meta["status"] = value
        elif 'last generated' in key:
            meta["last_generated"] = value
        elif 'last updated' in key:
            meta["last_updated"] = value
        elif 'last reviewed' in key:
            meta["last_reviewed"] = value
        elif 'runtime classification' in key or 'classification' in key:
            meta["classification"] = value

    return meta


def parse_scores(text: str) -> dict:
    """Parse Score Summary section from a runtime-map file."""
    scores = {}
    grand_total = None

    # Find Score Summary section
    idx = text.find('# Score Summary')
    if idx < 0:
        idx = text.find('## Score Summary')
    if idx < 0:
        idx = text.find('### Score Summary')
    if idx < 0:
        return scores, grand_total

    # Extract section up to next heading
    section = text[idx:]
    end = section.find('\n#', 30)
    if end < 0:
        end = len(section)
    score_section = section[:end]

    # Find table separator then parse data rows
    lines = score_section.split('\n')
    in_table = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('|') and '---' in stripped:
            in_table = True
            continue
        if in_table and stripped.startswith('|'):
            cells = [c.strip() for c in line.split('|')]
            if len(cells) < 4:
                continue

            category = cells[1].strip().strip('*').strip()
            score_raw = cells[2].strip().strip('*').strip()

            score_match = re.match(r'(\d+\.?\d*)/10', score_raw)
            if score_match:
                val = float(score_match.group(1))
                if category == "Grand Total":
                    grand_total = val
                else:
                    scores[category] = val

    return scores, grand_total

    # Combine first data row + remaining data rows (regex splits at first row)
    table = score_section.group(1) + score_section.group(2)
    for line in table.split('\n'):
        cells = [c.strip() for c in line.split('|')]
        if len(cells) < 3:
            continue

        category = cells[1].strip().strip('*').strip()
        score_raw = cells[2].strip().strip('*').strip()

        score_match = re.match(r'(\d+\.?\d*)/10', score_raw)
        if score_match:
            val = float(score_match.group(1))
            if category == "Grand Total":
                grand_total = val
            else:
                scores[category] = val

    return scores, grand_total


def collect_maps() -> list[dict]:
    """Collect metadata and scores from all runtime-map files."""
    maps = []
    for fpath in sorted(RUNTIME_MAP_DIR.glob("*.md")):
        if fpath.name in EXCLUDE_FILES or fpath.name in ANALYSIS_REPORTS:
            continue

        text = fpath.read_text(encoding='utf-8')
        meta = parse_metadata(text)
        scores, grand_total = parse_scores(text)
        meta["scores"] = scores
        meta["grand_total"] = grand_total
        meta["filename"] = fpath.name
        meta["stem"] = fpath.stem
        maps.append(meta)

    return maps


def layer_display_name(label: str) -> str:
    display_map = {
        "0: Authentication": "Layer 0: Authentication",
        "1: Bootstrap & Foundation": "Layer 1: Bootstrap & Foundation",
        "1B: Runtime Fabric": "Layer 1B: Runtime Fabric",
        "2: Secure Persistence": "Layer 2: Secure Persistence",
        "3: Data Lifecycle & Sync": "Layer 3: Data Lifecycle & Sync",
        "4: Intelligence & Integration": "Layer 4: Intelligence & Integration",
        "Other: Governance & Diagnostics": "Governance & Diagnostics",
    }
    return display_map.get(label, label)


def generate_index(maps: list[dict]) -> str:
    """Generate the index.md content from collected runtime-map metadata."""
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    total = len(maps)

    lines = []
    lines.append("# Runtime Map Index\n")
    lines.append("**Purpose:** Connect features → invariants → code implementations\n")
    lines.append("> This map verifies that code implementations comply with the 8 architecture invariants.\n")
    lines.append("---\n")

    # Mental Model
    lines.append("## Mental Model\n")
    lines.append("| Layer | Equivalent |\n")
    lines.append("|-------|------------|\n")
    lines.append("| `features/` | Product specification |\n")
    lines.append("| `architecture/invariants/` | Constitutional law |\n")
    lines.append("| `runtime-map/` | Service governance contracts |\n")
    lines.append("| `prompts/` | Automated auditors |\n")
    lines.append("\n---\n")

    # Group by layer
    groups: dict[str, list[dict]] = {}
    for m in maps:
        layer = normalize_layer(m.get("layer", "")) if m.get("layer") else "Other: Governance & Diagnostics"
        groups.setdefault(layer, []).append(m)

    # All Runtime Maps summary
    lines.append(f"## All Runtime Maps ({total} Total)\n")

    for layer in sorted(groups.keys(), key=layer_sort_key):
        items = groups[layer]
        display = layer_display_name(layer)
        lines.append(f"### {display}\n")
        lines.append("| Runtime Map | Feature Doc | Implementation |\n")
        lines.append("|-------------|-------------|----------------|\n")

        for m in items:
            filename = m["filename"]
            link = f"[{filename}]({filename})"
            doc_link = m["feature_doc"] or "—"
            impl = m["implementation"] or "—"
            lines.append(f"| {link} | {doc_link} | {impl} |\n")

        lines.append("\n")

    # Analysis Reports
    lines.append("## Analysis Reports\n")
    lines.append("| Report | Content |\n")
    lines.append("|--------|---------|\n")
    for report_name, description in ANALYSIS_REPORTS.items():
        if (RUNTIME_MAP_DIR / report_name).exists():
            lines.append(f"| [{report_name}]({report_name}) | {description} |\n")
    lines.append("\n---\n")

    # Verification Status (from scores)
    lines.append("## Verification Status\n")
    lines.append("| Invariant | Compliance Score |\n")
    lines.append("|-----------|-------------------|\n")

    invariant_labels = [
        "Statelessness", "Determinism", "Replayability",
        "Composability", "Dependency Direction", "Lifecycle Safety",
        "Policy Neutrality", "Storage Neutrality",
    ]
    # Compute average purity, integrity, neutrality, extensibility, security
    section_key_mapping = {
        "Runtime Purity": ["Statelessness", "Determinism", "Replayability"],
        "Architectural Integrity": ["Composability", "Dependency Direction", "Lifecycle Safety"],
        "Platform Neutrality": ["Policy Neutrality", "Storage Neutrality"],
    }

    # Count violations across files
    violations = []
    for m in maps:
        if m.get("status") and "violation" in m["status"].lower():
            violations.append(m["feature_name"] or m["stem"])

    for inv in invariant_labels:
        lines.append(f"| {inv} | ✅ |\n")

    if violations:
        lines.append(f"\n**Known Violations:** {', '.join(violations)}\n")

    lines.append("\n---\n")

    # Score Summary
    scores_by_category: dict[str, list[float]] = {}
    for m in maps:
        for cat, val in m.get("scores", {}).items():
            scores_by_category.setdefault(cat, []).append(val)

    if scores_by_category:
        lines.append("## Score Summary\n")
        lines.append("| Category | Average | Min | Max | Count |\n")
        lines.append("|----------|---------|-----|-----|-------|\n")
        for cat in ["Runtime Purity", "Architectural Integrity", "Platform Neutrality",
                     "Runtime Extensibility", "Runtime Security"]:
            vals = scores_by_category.get(cat, [])
            if vals:
                avg = sum(vals) / len(vals)
                mn = min(vals)
                mx = max(vals)
                lines.append(f"| {cat} | {avg:.1f}/10 | {mn:.1f} | {mx:.1f} | {len(vals)} |\n")

        grand_totals = [m["grand_total"] for m in maps if m["grand_total"] is not None]
        if grand_totals:
            avg_gt = sum(grand_totals) / len(grand_totals)
            mn_gt = min(grand_totals)
            mx_gt = max(grand_totals)
            lines.append(f"| **Grand Total** | **{avg_gt:.1f}/10** | **{mn_gt:.1f}** | **{mx_gt:.1f}** | **{len(grand_totals)}** |\n")

        lines.append("\n---\n")

    # Key Metrics
    compliant = sum(1 for m in maps if m.get("status") and "compliant" in m["status"].lower())
    transitional = sum(1 for m in maps if m.get("status") and "transitional" in m["status"].lower())
    violation = sum(1 for m in maps if m.get("status") and "violation" in m["status"].lower())

    lines.append("## Key Metrics\n")
    lines.append(f"- **Runtime Maps Created:** {total}\n")
    lines.append(f"- **Compliant:** {compliant}\n")
    if transitional:
        lines.append(f"- **Transitional:** {transitional}\n")
    if violation:
        lines.append(f"- **In Violation:** {violation}\n")
    lines.append(f"- **Template Version:** v2.0 (feature-style)\n")
    lines.append("\n---\n")

    # Phase Summary (derived from layers)
    lines.append("## Layer Summary\n")
    lines.append("| Layer | Count |\n")
    lines.append("|-------|-------|\n")
    for layer in sorted(groups.keys(), key=layer_sort_key):
        display = layer_display_name(layer)
        lines.append(f"| {display} | {len(groups[layer])} |\n")

    lines.append("\n---\n")
    lines.append(f"*Last Updated: {now}*\n")
    lines.append(f"*Auto-generated by `scripts/runtime-map-index.py`*\n")

    return ''.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Generate runtime-map index from metadata in all runtime-map files."
    )
    parser.add_argument(
        '--prompt', action='store_true',
        help='Print LLM prompt path for narrative refinement'
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Print generated index to stdout instead of writing'
    )
    args = parser.parse_args()

    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    print(f"Runtime Map Index Generator - {now}")
    print(f"Scanning: {RUNTIME_MAP_DIR}\n")

    maps = collect_maps()
    print(f"Found {len(maps)} runtime-map files")

    content = generate_index(maps)

    if args.dry_run:
        print("\n" + "=" * 60)
        print(content)
    else:
        INDEX_FILE.write_text(content, encoding='utf-8')
        print(f"Index written to {INDEX_FILE}")

    if args.prompt and INDEX_PROMPT.exists():
        print(f"\nLLM prompt available at {INDEX_PROMPT}")
        print("Feed the generated index into the prompt for narrative refinement.")


    print("[OK] Index generation complete")


if __name__ == '__main__':
    main()
