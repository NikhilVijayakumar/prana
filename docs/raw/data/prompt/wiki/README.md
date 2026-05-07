# Wiki Generation Prompts

**Purpose**: Generate LLM-friendly wiki from documentation with token efficiency.

**Location**: `docs/raw/data/prompt/wiki/`

---

## Overview

| Prompt | Trigger | When to Use |
|--------|---------|--------------|
| `first-time.md` | Wiki doesn't exist | Initial wiki generation from scratch |
| `update.md` | docs/raw/ changed | Full wiki sync after source changes |
| `feature-update.md` | Single feature changed | Lightweight update for one feature |
| `verify.md` | Any time | Verify wiki matches implementation |

---

## Quick Start

### First Generation

```bash
# 1. Run first-time prompt
LLM reads docs/raw/ → generates docs/wiki/

# 2. Run verify prompt to confirm
LLM verifies claims against src/
```

### After Source Changes

```bash
# Option A: Full update (many changes)
LLM runs update.md → syncs entire wiki

# Option B: Feature update (single change)
LLM runs feature-update.md with feature path → updates only that feature
```

### Verification

```bash
# Run verify to confirm wiki accuracy
LLM runs verify.md → produces verification report
```

---

## Key Principles

1. **docs/raw/ is authoritative** - wiki is derived, never override source
2. **Token efficiency** - LLM reads index → navigates to detail, not full docs
3. **Verification** - claims in architecture pages must match src/
4. **Adaptability** - prompts work for any repo with docs/raw/ structure

---

## File Structure

```
docs/
├── raw/                              # Source docs (user-generated)
│   ├── architecture/
│   │   ├── invariants/               # ← Architecture layer (auto-detected)
│   │   └── runtime-map/             # ← Runtime maps (auto-detected)
│   ├── features/                    # ← Features (auto-detected)
│   └── data/
│       └── prompt/
│           └── wiki/                 # ← These prompts live here
│               ├── first-time.md
│               ├── update.md
│               ├── feature-update.md
│               └── verify.md
│
└── wiki/                            # Generated wiki (LLM-created)
    ├── index.md
    ├── log.md
    ├── architecture/
    │   ├── index.md
    │   └── {invariant}.md
    ├── runtime-maps/
    │   ├── index.md
    │   └── {runtime-map}.md
    └── features/
        └── index.md
```

---

## Wiki Page Template

Each page follows `docs/core.md`:

```markdown
# {Title}

**Summary**: One-line purpose.

**Last Updated**: {YYYY-MM-DD}

---

## Key Takeaways

- {Bullet 1}
- {Bullet 2}
- {Bullet 3}

**Source**: {source_file}

**Implementation**: Verified against src/

---

## Main Content

{Content with [[wiki-links]]}

---

## Related Pages

- [[wiki-index]]
- [[architecture-index]]
```

---

## Usage with Other Repos

These prompts adapt to any repo with:

1. `docs/raw/` - source documentation
2. `src/` or similar - implementation code
3. `docs/core.md` - wiki template rules (optional, prompts reference it)

**Adaptation tips**:
- Architecture invariants: Auto-detected from `docs/raw/architecture/`
- Runtime maps: Auto-detected from `docs/raw/architecture/runtime-map/`
- Features: Auto-detected from `docs/raw/features/`
- Verification commands: Reference language/framework of target repo

---

## Related

- `docs/core.md` - Template rules for wiki pages
- `docs/wiki/log.md` - Change history
- `src/` - Implementation (verification target)