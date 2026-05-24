#!/usr/bin/env python3
"""
Runtime Map Grading Script

Converts /5 scores to /10, computes section averages, grand totals,
letter grades, relative scores (vs cross-file mean), and relative grades.

Usage:
  python scripts/runtime-map-grade.py          # grade runtime-maps
  python scripts/runtime-map-grade.py --report # grade + write report to report/runtime-map/report.md
"""

import argparse
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

RUNTIME_MAP_DIR = Path("docs/raw/architecture/runtime-map")
REPORT_DIR = Path("report/runtime-map")
GRADE_ANALYSIS_PROMPT = Path("docs/raw/data/prompt/runtime-map/grade-analysis.md")

GRADE_THRESHOLDS = [
    (9.0, "A"), (8.0, "A-"), (7.0, "B+"), (6.0, "B"),
    (5.0, "B-"), (4.0, "C+"), (3.0, "C"), (2.0, "C-"),
    (1.0, "D+"), (0.0, "D"),
]

REL_GRADE_THRESHOLDS = [
    (2.0, "A"), (1.0, "B"), (-0.9, "C"), (-1.9, "D"), (float("-inf"), "F"),
]

SECTIONS = [
    "Runtime Purity",
    "Architectural Integrity",
    "Platform Neutrality",
    "Runtime Extensibility",
    "Runtime Security",
]


def letter_grade(value, thresholds=GRADE_THRESHOLDS):
    for t, g in thresholds:
        if value >= t:
            return g
    return "D"


def process_section_table(lines, section_name):
    section_header = f"## {section_name}"
    found = False
    table_separator_found = False
    data_start = None
    data_end = None

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == section_header:
            found = True
            continue
        if not found:
            continue
        if stripped.startswith('| ---') and not stripped.startswith('| **'):
            table_separator_found = True
            data_start = i + 1
            continue
        if table_separator_found:
            if stripped == '' or stripped.startswith('---') or stripped.startswith('##'):
                data_end = i
                break

    if data_start is None or data_end is None or data_start >= data_end:
        return None

    scores = []
    insert_idx = data_end
    rewrite_idx = None

    for i in range(data_start, data_end):
        line = lines[i]
        if 'Section Score' in line:
            rewrite_idx = i
            continue
        cells = [c.strip() for c in line.split('|')]
        if len(cells) < 4:
            continue

        score_raw = cells[3]
        m = re.match(r'(\d+)/(5|10)\s*$', score_raw)
        if not m:
            continue

        val = int(m.group(1))
        denom = int(m.group(2))

        if denom == 5:
            val *= 2
            new_score = f"{val}/10"
            lines[i] = line.replace(score_raw, new_score, 1)

        scores.append(val)

    if not scores:
        return None

    avg = sum(scores) / len(scores)
    score_row = f"| **Section Score** | **—** | **{avg:.1f}/10** |\n"

    if rewrite_idx is not None:
        lines[rewrite_idx] = score_row
    else:
        lines.insert(insert_idx, score_row)

    return avg


def upsert_score_summary(content, section_scores, grand_total, rel_score):
    summary = (
        f"\n## Score Summary\n"
        f"\n"
        f"| Category                  | Score | Grade |\n"
        f"| ------------------------- | ----- | ----- |\n"
        f"| Runtime Purity            | {section_scores.get('Runtime Purity', 0):.1f}/10 | {letter_grade(section_scores.get('Runtime Purity', 0))} |\n"
        f"| Architectural Integrity   | {section_scores.get('Architectural Integrity', 0):.1f}/10 | {letter_grade(section_scores.get('Architectural Integrity', 0))} |\n"
        f"| Platform Neutrality       | {section_scores.get('Platform Neutrality', 0):.1f}/10 | {letter_grade(section_scores.get('Platform Neutrality', 0))} |\n"
        f"| Runtime Extensibility     | {section_scores.get('Runtime Extensibility', 0):.1f}/10 | {letter_grade(section_scores.get('Runtime Extensibility', 0))} |\n"
        f"| Runtime Security          | {section_scores.get('Runtime Security', 0):.1f}/10 | {letter_grade(section_scores.get('Runtime Security', 0))} |\n"
        f"| **Grand Total**           | **{grand_total:.1f}/10** | **{letter_grade(grand_total)}** |\n"
        f"| **Relative Score**        | **{rel_score:+.1f}** | **{letter_grade(rel_score, REL_GRADE_THRESHOLDS)}** |\n"
        f"\n"
        f"---\n"
    )

    content = re.sub(
        r'\n## Score Summary\n.*?(?=\n# 16\. Detection Heuristics Applied)',
        '',
        content,
        flags=re.DOTALL
    )

    content = content.replace(
        '# 16. Detection Heuristics Applied',
        summary + '\n# 16. Detection Heuristics Applied',
        1
    )
    return content


def read_lines(fpath):
    with open(fpath, 'r', encoding='utf-8') as f:
        return f.readlines()


def write_lines(fpath, lines):
    with open(fpath, 'w', encoding='utf-8') as f:
        f.writelines(lines)


def read_text(fpath):
    return fpath.read_text(encoding='utf-8')


def write_text(fpath, text):
    fpath.write_text(text, encoding='utf-8')


def generate_report(all_scores, grand_totals, cross_grand_avg, cross_section_avgs, files):
    """Write report/runtime-map/report.md with full score breakdown."""
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    report_path = REPORT_DIR / "report.md"
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    lines = []
    lines.append("# Runtime Map Grade Report\n")
    lines.append(f"**Generated:** {now}\n")
    lines.append(f"**Total Features:** {len(files)}\n")
    lines.append(f"**Cross-File Grand Average:** {cross_grand_avg:.1f}/10\n")
    lines.append("---\n")

    # Score table
    lines.append("## Score Table\n")
    lines.append(
        f"| {'Feature':45s} | {'Purity':>6s} | {'Integrity':>9s} | "
        f"{'Neutrality':>9s} | {'Extens.':>9s} | {'Security':>9s} | "
        f"{'Total':>6s} | {'Grade':>4s} | {'vs Avg':>6s} | {'Rel G':>4s} |\n"
    )
    lines.append(
        f"| {'-' * 45} | {'-' * 6} | {'-' * 9} | "
        f"{'-' * 9} | {'-' * 9} | {'-' * 9} | "
        f"{'-' * 6} | {'-' * 4} | {'-' * 6} | {'-' * 4} |\n"
    )

    # Sort by grand total descending
    sorted_files = sorted(
        files, key=lambda f: grand_totals.get(f.name, 0), reverse=True
    )

    for fpath in sorted_files:
        scores = all_scores.get(fpath.name, {})
        gt = grand_totals.get(fpath.name, 0)
        rel = gt - cross_grand_avg
        name = fpath.name.replace('.md', '')
        lines.append(
            f"| {name:45s} "
            f"| {scores.get('Runtime Purity', 0):5.1f} "
            f"| {scores.get('Architectural Integrity', 0):5.1f} "
            f"| {scores.get('Platform Neutrality', 0):5.1f} "
            f"| {scores.get('Runtime Extensibility', 0):5.1f} "
            f"| {scores.get('Runtime Security', 0):5.1f} "
            f"| {gt:5.1f} "
            f"| {letter_grade(gt):>4s} "
            f"| {rel:+5.1f} "
            f"| {letter_grade(rel, REL_GRADE_THRESHOLDS):>4s} |\n"
        )

    lines.append("\n---\n")

    # Grade distribution
    grade_counts = Counter(letter_grade(grand_totals.get(f.name, 0)) for f in files)
    lines.append("## Grade Distribution\n\n")
    lines.append(f"| {'Grade':>6s} | {'Count':>5s} |\n")
    lines.append(f"| {'-' * 6} | {'-' * 5} |\n")
    for g in ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"]:
        if grade_counts[g] > 0:
            lines.append(f"| {g:>6s} | {grade_counts[g]:5d} |\n")
    lines.append("\n---\n")

    # Best / worst performers
    ranked = sorted(
        files, key=lambda f: grand_totals.get(f.name, 0), reverse=True
    )
    lines.append("## Top Performers\n\n")
    lines.append(f"| {'Rank':>4s} | {'Feature':45s} | {'Total':>6s} | {'Grade':>4s} |\n")
    lines.append(f"| {'-' * 4} | {'-' * 45} | {'-' * 6} | {'-' * 4} |\n")
    for i, fpath in enumerate(ranked[:3], 1):
        gt = grand_totals.get(fpath.name, 0)
        name = fpath.name.replace('.md', '')
        lines.append(
            f"| {i:4d} | {name:45s} | {gt:5.1f} "
            f"| {letter_grade(gt):>4s} |\n"
        )

    lines.append("\n## Areas of Concern\n\n")
    lines.append(f"| {'Rank':>4s} | {'Feature':45s} | {'Total':>6s} | {'Grade':>4s} |\n")
    lines.append(f"| {'-' * 4} | {'-' * 45} | {'-' * 6} | {'-' * 4} |\n")
    for i, fpath in enumerate(ranked[-3:], 0):
        gt = grand_totals.get(fpath.name, 0)
        name = fpath.name.replace('.md', '')
        lines.append(
            f"| {len(ranked) - i:4d} | {name:45s} | {gt:5.1f} "
            f"| {letter_grade(gt):>4s} |\n"
        )

    lines.append("\n---\n")

    # LLM Analysis placeholder
    lines.append("## LLM Analysis\n\n")
    if GRADE_ANALYSIS_PROMPT.exists():
        lines.append(
            "To populate this section, feed the score data above into "
            "`docs/raw/data/prompt/runtime-map/grade-analysis.md` "
            "via an LLM.\n\n"
        )
        lines.append(
            "1. Copy the Score Table, Grade Distribution, and cross-file average into the LLM prompt input\n"
        )
        lines.append("2. Run through the LLM\n")
        lines.append("3. Append the output below this line\n\n")
    lines.append("<!-- LLM analysis output goes below this line -->\n")
    lines.append("\n---\n")

    write_text(report_path, ''.join(lines))
    print(f"  Report written to {report_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Grade runtime-map files and optionally generate a report."
    )
    parser.add_argument(
        '--report',
        action='store_true',
        help='Generate report at report/runtime-map/report.md'
    )
    args = parser.parse_args()

    files = sorted(RUNTIME_MAP_DIR.glob('*.md'))
    if not files:
        print(f"ERROR: No .md files found in {RUNTIME_MAP_DIR}")
        sys.exit(1)

    print(f"Found {len(files)} runtime map files\n")

    # Phase 1: Process each file — convert scores, add section score rows
    all_scores = {}
    for fpath in files:
        lines = read_lines(fpath)
        scores = {}
        for section in SECTIONS:
            avg = process_section_table(lines, section)
            if avg is not None:
                scores[section] = avg
        all_scores[fpath.name] = scores
        write_lines(fpath, lines)
        print(f"  Phase 1: {fpath.name} - {len(scores)} sections")

    # Phase 2: Compute cross-file averages
    cross_section_avgs = {}
    for section in SECTIONS:
        vals = [s[section] for s in all_scores.values() if section in s]
        cross_section_avgs[section] = sum(vals) / len(vals) if vals else 0.0

    grand_totals = {}
    for fname, scores in all_scores.items():
        vals = list(scores.values())
        grand_totals[fname] = sum(vals) / len(vals) if vals else 0.0

    cross_grand_avg = (
        sum(grand_totals.values()) / len(grand_totals) if grand_totals else 0.0
    )

    # Phase 3: Add score summaries
    for fpath in files:
        content = read_text(fpath)
        scores = all_scores[fpath.name]
        gt = grand_totals[fpath.name]
        rel = gt - cross_grand_avg
        content = upsert_score_summary(content, scores, gt, rel)
        write_text(fpath, content)
        print(
            f"  Phase 3: {fpath.name} - "
            f"GT {gt:.1f}/10 ({rel:+.1f})"
        )

    # Phase 4: Generate report if --report flag
    if args.report:
        generate_report(
            all_scores, grand_totals, cross_grand_avg, cross_section_avgs, files
        )

    # Print results
    print(f"\n{'-' * 80}")
    print(f"{'Feature':45s}  {'Total':>6s}  {'Grade':>4s}  {'vs Avg':>6s}  {'Rel G':>4s}")
    print(f"{'-' * 80}")
    for fpath in sorted(files):
        gt = grand_totals[fpath.name]
        rel = gt - cross_grand_avg
        print(
            f"{fpath.name.replace('.md', ''):45s}  "
            f"{gt:5.1f}/10  "
            f"{letter_grade(gt):>4s}  "
            f"{rel:+5.1f}  "
            f"{letter_grade(rel, REL_GRADE_THRESHOLDS):>4s}"
        )
    print(f"\nCross-file grand average: {cross_grand_avg:.1f}/10")
    print("[OK] All files updated")


if __name__ == '__main__':
    main()
