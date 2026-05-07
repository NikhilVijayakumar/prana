# Wiki Update Prompt (Optimized for LLM Knowledge Maintenance)

## Purpose

Update the existing wiki using changes from `docs/raw/`.

The wiki is a compressed, navigable knowledge layer optimized for:
- LLM context retrieval
- token efficiency
- architecture understanding
- implementation-aware summaries

The wiki is NOT the source of truth.

Authoritative sources:
1. `docs/raw/`
2. implementation in `src/`

The goal is to maintain alignment between:
- source documentation
- implementation
- derived wiki knowledge

Without unnecessarily rewriting stable content.

---

# Primary Goal

Maintain an accurate, token-efficient knowledge graph that allows LLMs to:

```txt id="1l1hzw"
index
  → concept
    → detail
      → implementation
````

Without repeatedly reading full raw documentation.

The update process should:

* preserve stable knowledge
* update only affected areas
* maintain graph consistency
* maintain navigability
* minimize unnecessary rewrites

---

# Core Principles

## 1. Minimal-Scope Updates

Only modify affected knowledge areas.

Avoid:

* full rewrites
* restructuring stable pages
* unnecessary content churn

Preserve useful existing structure whenever possible.

---

## 2. Wiki as Knowledge Graph

The wiki is an interconnected graph.

Maintain:

* `[[wiki-links]]`
* concept relationships
* navigation paths
* canonical pages
* architecture hierarchy

Avoid:

* orphan pages
* duplicated concepts
* fragmented architecture explanations

---

## 3. Raw Documentation Has Authority

Always trust:

1. `docs/raw/`
2. implementation in `src/`

If wiki content conflicts:

* update the wiki
* preserve implementation accuracy
* explicitly note contradictions when necessary

Do NOT silently reconcile inconsistencies.

---

## 4. Token Efficiency

The wiki exists to reduce LLM token consumption.

Prefer:

* compressed summaries
* bullet points
* canonical references
* linked navigation

Avoid:

* duplicated explanations
* copied raw documentation
* excessive prose

The updated wiki should remain retrieval-efficient.

---

## 5. Canonical Knowledge Preservation

Each major concept should maintain ONE primary page.

When updating:

* preserve canonical concept ownership
* link instead of duplicating
* merge fragmented explanations if needed

Examples:

* authentication
* storage architecture
* runtime lifecycle
* permissions
* plugin system

---

# Change Detection

Analyze differences between:

* existing wiki
* current raw documentation
* implementation state

Identify:

* new concepts
* modified concepts
* deleted concepts
* renamed concepts
* moved concepts
* changed relationships
* implementation mismatches

---

# Update Workflow

## Step 1 — Discover Affected Areas

Identify:

* changed source documents
* affected wiki pages
* affected relationships
* affected architecture domains
* affected feature areas

Avoid touching unrelated pages.

---

## Step 2 — Rebuild Knowledge Relationships

For affected areas:

Re-evaluate:

* dependencies
* runtime relationships
* architecture ownership
* feature boundaries
* implementation evidence

Update:

* `[[wiki-links]]`
* related pages
* navigation paths
* indices

---

## Step 3 — Update Canonical Pages

For each affected concept:

Update:

* summaries
* key takeaways
* architecture explanations
* implementation notes
* verification status

Preserve:

* stable structure
* useful explanations
* existing navigation

---

## Step 4 — Validate Against Implementation

When possible:

* verify documentation against `src/`
* identify outdated wiki claims
* identify undocumented implementation
* identify missing documentation

Implementation has higher authority than outdated wiki content.

Do NOT silently fix contradictions.

Explicitly flag:

* mismatches
* outdated assumptions
* missing verification

---

## Step 5 — Repair Graph Integrity

Ensure:

* all `[[wiki-links]]` resolve
* no orphan pages exist
* indices reference current pages
* deleted concepts are removed or deprecated
* renamed concepts redirect correctly

The knowledge graph must remain navigable.

---

# Required Updates

Update affected:

* `Last Updated` fields
* key takeaways
* related links
* verification notes
* architecture relationships

Update indices if:

* new domains appear
* categories change
* pages are removed
* relationships shift

---

# Required Log Update

Append to:

```txt id="0ec9lu"
docs/wiki/log.md
```

Include:

* date
* action type
* affected pages
* architecture areas
* verification status
* detected mismatches
* unresolved uncertainty

Keep logs concise and structured.

---

# Validation Rules

During update:

Validate:

* wiki vs raw docs
* wiki vs implementation
* feature docs vs UI mockups
* canonical page consistency
* graph navigability

Flag:

* outdated pages
* missing coverage
* undocumented implementation
* broken relationships
* duplicated concepts

Do NOT silently resolve inconsistencies.

---

# Uncertainty Rules

If information is incomplete:

* mark `needs verification`
* avoid assumptions
* avoid hallucinated architecture
* avoid inferred implementation details

Accuracy is more important than completeness.

---

# Deletion Rules

If source documentation is removed:

Determine whether:

* the concept was deprecated
* the concept moved
* the concept merged elsewhere

Then:

* remove obsolete pages
  OR
* mark deprecated
  OR
* redirect relationships

Avoid dangling references.

---

# Success Criteria

The updated wiki should:

* remain aligned with raw documentation
* remain aligned with implementation
* preserve token efficiency
* preserve navigability
* preserve architecture understanding
* avoid unnecessary rewrites
* maintain canonical concept ownership
* maintain knowledge graph integrity

The result should function as:

* a compressed LLM memory layer
* a navigable architecture graph
* a retrieval-optimized project understanding system

```
```
