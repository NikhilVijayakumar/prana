# Wiki Generation Prompt (Optimized for LLM Context Compression)

## Purpose

Generate an LLM-optimized wiki from `docs/raw/`.

The wiki is a compressed knowledge layer designed to:
- reduce token usage
- improve retrieval/navigation
- provide structured project understanding
- avoid repeatedly reading large raw documents

The wiki is NOT the source of truth.

Authoritative sources:
1. `docs/raw/`
2. implementation in `src/`

The wiki is a derived knowledge graph for efficient LLM consumption.

---

# Primary Goal

Transform large, fragmented documentation into:

- concise structured knowledge
- navigable concepts
- linked architecture understanding
- implementation-aware summaries
- token-efficient retrieval paths

The intended workflow is:

```txt
LLM reads:
wiki/index.md
  ↓
relevant wiki pages
  ↓
specific raw docs only if needed
````

The LLM should rarely need to scan full raw documentation.

---

# Core Principles

## 1. Compression Over Duplication

Do NOT copy raw documentation.

Instead:

* compress
* summarize
* extract concepts
* preserve relationships
* preserve critical implementation details

The wiki should ideally be:

* less than 10–20% of raw documentation size
* while preserving architectural understanding

---

## 2. Knowledge Graph, Not Notes

The wiki is an interconnected knowledge graph.

Pages must:

* reference related concepts
* use `[[wiki-links]]`
* avoid isolated information
* minimize repeated explanations

Prefer:

* linking
* references
* canonical concept pages

Over:

* duplicated explanations

---

## 3. Canonical Concepts

Each major concept should have ONE primary page.

Examples:

* authentication
* runtime lifecycle
* storage architecture
* event system
* permissions
* plugin architecture

Other pages should link to canonical pages instead of redefining concepts.

---

## 4. Raw Documentation Has Authority

Always trust:

1. `docs/raw/`
2. implementation in `src/`

Never assume wiki content is correct.

If contradictions exist:

* explicitly mention them
* do not silently reconcile

---

## 5. Implementation Awareness

Documentation may be outdated.

When possible:

* verify behavior against `src/`
* detect undocumented implementation
* detect outdated docs
* detect mismatches

Implementation is higher authority than outdated wiki content.

---

# Input Discovery

Dynamically analyze available documentation.

Possible sources include:

```txt
docs/raw/
  architecture/
  features/
  ui-mockups/
  data/
  api/
  runtime-map/
  integrations/
```

Do NOT assume all folders exist.

Adapt to discovered structure.

Skip missing sections gracefully.

---

# Generation Workflow

## Step 1 — Discover Knowledge Domains

Identify:

* architecture concepts
* features
* services
* entities
* runtime flows
* integrations
* invariants
* implementation boundaries
* data flow
* ownership boundaries

Create a mental knowledge graph BEFORE writing pages.

---

## Step 2 — Identify Canonical Pages

Determine:

* which concepts deserve dedicated pages
* which concepts belong inside overview pages
* which concepts are supporting details only

Avoid:

* duplicated concept pages
* fragmented architecture explanations

---

## Step 3 — Generate Wiki Structure

Create:

```txt
docs/wiki/
  index.md
  log.md

  architecture/
  features/
  runtime-maps/
  integrations/
  glossary/
  meta/
```

Only create categories that are supported by raw documentation.

---

# Required Pages

## `docs/wiki/index.md`

Purpose:

* primary LLM entrypoint
* high-level navigation
* system overview
* links to major knowledge domains

Must contain:

* architecture overview
* feature overview
* important runtime concepts
* important integrations
* navigation links

This page should optimize first-pass project understanding.

---

## `docs/wiki/log.md`

Tracks:

* wiki generation
* updates
* refreshes
* validations

Append:

* date
* action
* affected pages

---

## `docs/wiki/meta/glossary.md`

Define:

* canonical terminology
* aliases
* domain language
* important acronyms

This improves LLM consistency.

---

## `docs/wiki/meta/coverage.md`

Track:

* documented areas
* partially documented areas
* missing coverage
* unverified sections

---

# Page Generation Rules

Each page should optimize for:

* fast comprehension
* low token usage
* navigation clarity
* architecture understanding

---

# Standard Page Structure

```md
# {Page Title}

**Summary**: Short explanation of the concept.

**Source Files**:
- docs/raw/...

**Last Updated**: YYYY-MM-DD

---

## Key Takeaways

- Important concept
- Important relationship
- Important constraint
- Important implementation detail

---

## Overview

High-level explanation.

---

## Architecture / Behavior

Compressed explanation of:
- responsibilities
- flows
- constraints
- dependencies

Use `[[wiki-links]]`.

---

## Implementation Notes

Verified behavior from `src/`.

Include:
- implementation evidence
- mismatches
- undocumented behavior

Mark uncertain claims:
`needs verification`

---

## Related Pages

- [[related-page]]
```

---

# Token Optimization Rules

The wiki exists to reduce LLM token usage.

Prefer:

* bullet points
* summaries
* structured sections
* linked navigation
* canonical pages

Avoid:

* long prose
* repeated explanations
* copied raw documentation
* redundant examples

The wiki should enable:

```txt
index
  → concept
    → implementation
```

Without reading all raw docs.

---

# Linking Rules

Use:

```txt
[[wiki-links]]
```

For:

* related concepts
* dependencies
* runtime relationships
* shared entities

Pages should rarely exist without inbound links.

Avoid orphan pages.

---

# Validation Rules

During generation:

Validate:

* wiki vs raw docs
* docs vs implementation
* features vs UI mockups

Flag:

* contradictions
* outdated documentation
* missing implementation
* undocumented behavior

Do NOT silently resolve inconsistencies.

---

# Uncertainty Rules

If information is incomplete:

* mark `needs verification`
* avoid assumptions
* avoid hallucinated architecture
* avoid inferred behavior unless clearly labeled

Accuracy is more important than completeness.

---

# Success Criteria

The generated wiki should:

* reduce dependency on raw docs
* improve LLM retrieval efficiency
* preserve architectural understanding
* expose implementation-relevant knowledge
* minimize token consumption
* provide navigable concept relationships
* remain maintainable over time

The wiki should function as:

* an LLM memory layer
* a compressed architecture graph
* a retrieval-optimized project understanding system

```
```
