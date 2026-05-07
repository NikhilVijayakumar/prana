# Wiki Verification Prompt (Optimized for LLM Knowledge Validation)

## Purpose

Validate the wiki against:
- source documentation
- implementation in `src/`
- runtime architecture
- knowledge graph integrity

The verification process ensures the wiki remains:
- accurate
- navigable
- implementation-aware
- token-efficient
- trustworthy for LLM retrieval

The wiki is NOT the source of truth.

Authority order:
1. implementation (`src/`)
2. raw documentation (`docs/raw/`)
3. wiki (`docs/wiki/`)

---

# Primary Goal

Verify that the wiki remains a reliable compressed knowledge layer for LLMs.

The verification process should detect:
- outdated wiki content
- implementation drift
- broken relationships
- missing coverage
- undocumented behavior
- invalid navigation
- duplicated concepts
- stale assumptions

Without regenerating the entire wiki.

---

# Verification Philosophy

The wiki exists to reduce repeated LLM consumption of:
- raw documentation
- source code
- architecture files

Verification ensures the compressed knowledge layer still accurately represents reality.

The goal is NOT:
- formatting validation
- stylistic review
- prose optimization

The goal IS:
- semantic accuracy
- implementation alignment
- graph integrity
- retrieval reliability

---

# Core Principles

## 1. Verify Semantics, Not Formatting

Focus on:
- architecture correctness
- implementation alignment
- runtime relationships
- concept ownership
- feature boundaries
- navigation integrity

Ignore:
- writing style
- formatting preferences
- cosmetic structure

---

## 2. Implementation Has Highest Authority

If implementation differs from wiki:
- implementation wins

If raw docs differ from implementation:
- flag mismatch explicitly

Do NOT silently reconcile contradictions.

Verification should expose drift, not hide it.

---

## 3. Validate the Knowledge Graph

The wiki is an interconnected graph.

Verification must ensure:
- links resolve
- concepts remain connected
- canonical pages remain authoritative
- relationships remain valid
- no orphan pages exist

Navigation integrity is critical for LLM retrieval.

---

## 4. Optimize for Token Efficiency

Verification should:
- minimize unnecessary scanning
- focus on drift-prone areas
- validate changed knowledge domains
- avoid full regeneration

The process should remain lightweight and targeted.

---

# Verification Scope

Validate:

## Architecture Integrity

Confirm:
- architecture claims match implementation
- invariants still hold
- runtime assumptions remain valid
- dependency boundaries still exist

Detect:
- undocumented architecture changes
- outdated patterns
- broken invariants

---

## Runtime Map Integrity

Confirm:
- services/modules still exist
- runtime relationships remain valid
- ownership boundaries still align
- integration paths still exist

Detect:
- removed services
- renamed modules
- changed runtime flows
- obsolete dependencies

---

## Knowledge Graph Integrity

Confirm:
- all `[[wiki-links]]` resolve
- navigation remains valid
- canonical concepts remain centralized
- no orphan pages exist
- indices remain accurate

Detect:
- broken links
- duplicate concepts
- fragmented ownership
- disconnected pages

---

## Documentation Drift

Detect:
- outdated wiki summaries
- implementation changes missing from wiki
- raw documentation divergence
- stale architectural assumptions

Flag:
- needs verification
- possible drift
- missing implementation evidence

---

# Discovery Phase

Before verification:

Identify:
- project language/framework
- implementation structure
- service boundaries
- architecture domains
- runtime map structure
- feature organization

Adapt verification behavior dynamically.

Do NOT assume:
- language
- framework
- directory naming
- architecture style

---

# Verification Workflow

## Step 1 — Identify Verification Targets

Prioritize:
- architecture pages
- runtime maps
- core concept pages
- recently updated areas
- drift-prone systems

Avoid unnecessary full-wiki scanning.

---

## Step 2 — Validate Architecture Claims

For each architecture concept:

Verify:
- implementation existence
- structural alignment
- dependency assumptions
- runtime ownership
- architectural boundaries

Look for:
- changed patterns
- missing components
- outdated assumptions
- undocumented implementation

---

## Step 3 — Validate Runtime Relationships

Confirm:
- services/modules still exist
- integrations remain valid
- flows remain accurate
- dependency relationships still hold

Detect:
- renamed systems
- removed integrations
- changed ownership
- obsolete runtime paths

---

## Step 4 — Validate Knowledge Graph Integrity

Ensure:
- all `[[wiki-links]]` resolve
- no orphan pages exist
- indices remain accurate
- canonical pages remain referenced
- navigation paths remain valid

Prefer:
```txt id="cwmr5h"
index
  → domain
    → concept
      → implementation
````

Navigation structure.

---

## Step 5 — Detect Drift

Compare:

* wiki claims
* raw documentation
* implementation reality

Identify:

* stale knowledge
* undocumented implementation
* outdated runtime maps
* conflicting architecture descriptions

Do NOT silently resolve conflicts.

Explicitly report them.

---

# Verification Heuristics

Use implementation evidence to validate:

* services
* modules
* handlers
* controllers
* runtime flows
* factories
* lifecycle systems
* state ownership
* integration boundaries

Adapt heuristics dynamically to detected language/framework.

Verification behavior should be semantic rather than command-specific.

---

# Uncertainty Handling

If verification confidence is low:

* mark `needs verification`
* avoid assumptions
* avoid hallucinated architecture
* avoid inferred runtime relationships

Prefer incomplete-but-accurate over confident hallucinations.

---

# Output Requirements

Produce a concise verification report.

The report should optimize for:

* fast comprehension
* actionable drift detection
* low token usage

Avoid excessive implementation detail.

---

# Verification Report Structure


# Verification Report

**Date**: YYYY-MM-DD

**Status**:
- PASS
- PASS WITH WARNINGS
- FAILED

---

## Verified Areas

- architecture invariants
- runtime relationships
- implementation alignment
- wiki graph integrity

---

## Issues Detected

### Drift

- outdated wiki claim
- undocumented implementation
- stale runtime relationship

### Graph Issues

- broken links
- orphan pages
- duplicate concepts

### Architecture Issues

- invalid invariant
- changed dependency boundary
- missing implementation

---

## Recommended Actions

- update affected pages
- refresh runtime maps
- regenerate architecture summaries
- repair graph links
- investigate implementation mismatch


---

# Success Criteria

Verification succeeds when:

* implementation-aligned knowledge remains accurate
* runtime relationships remain valid
* navigation graph remains intact
* architecture assumptions still hold
* canonical pages remain authoritative
* no critical drift exists

The verified wiki should remain:

* trustworthy for LLM retrieval
* token-efficient
* semantically accurate
* implementation-aware
* navigable as a knowledge graph


