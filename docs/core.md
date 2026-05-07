# LLM Documentation Core

# START HERE

This document defines how to understand, use, and maintain the documentation system for this project.

All agents must read this file before interacting with any other documentation.

---

## Purpose

This system is a structured, LLM-friendly knowledge base.

It separates:

* **Project context** → defined in `README.md`
* **Source knowledge** → stored in `docs/raw/`
* **Derived knowledge** → maintained in `docs/wiki/`

The goal is to create a consistent, evolving knowledge layer that improves over time.

---

## Project Context

* `README.md` defines the project’s purpose, goals, and constraints
* This file (`docs/core.md`) defines system rules and behavior

### Recommended reading order

1. `README.md` → understand the project
2. `docs/core.md` → understand system rules
3. `docs/wiki/index.md` → explore existing knowledge
4. `docs/raw/` → deep dive into source material

---

## Folder Structure

```
docs/
  core.md

  raw/
    architecture/
    feature/
    data/

  wiki/
    index.md
    log.md
```

---

## Source of Truth

* `docs/raw/` is the authoritative source of information
* `docs/wiki/` is derived and may be incomplete or outdated

### Rule

If there is any conflict:
→ ALWAYS trust `docs/raw/`

Agents must never treat wiki content as authoritative over raw documents.

---

## Raw Document Types

The `docs/raw/` folder may contain:

* **architecture/** → system design, components, data flow
* **feature/** → feature specifications and behavior
* **data/** → example inputs, outputs, or datasets

All of these are valid inputs for building and updating the wiki.

---

## Wiki Role

The wiki (`docs/wiki/`) is:

* a structured knowledge layer
* a summary and synthesis of raw documents
* an interconnected system of concepts

The wiki is NOT:

* a source of truth
* a place for unsupported assumptions

It can be regenerated if needed.

---

## Update Strategy

Always use the smallest possible scope when updating the wiki:

### 1. Ingest (smallest scope)

Used for new or single files.

Example:

```
ingest docs/raw/feature/auth/login.md
```

---

### 2. Feature Update (default)

Used when changes affect a feature or related components.

Example:

```
refresh feature auth
```

This should be the most common operation.

---

### 3. Full Refresh (rare)

Used only when:

* onboarding an existing project
* wiki is missing or heavily outdated

Example:

```
refresh wiki from raw
```

### Rules for full refresh:

* Do not rewrite correct content unnecessarily
* Preserve useful structure when possible
* Focus on missing or outdated areas

---

## Ingest Workflow

When ingesting a new source:

1. Read the full source document
2. Identify key concepts and entities
3. Discuss key takeaways with the user before writing
4. Create or update relevant wiki pages
5. Link related concepts using [[wiki-links]]
6. Update `wiki/index.md`
7. Append changes to `wiki/log.md`

Do not modify the wiki without user confirmation.

---

## Page Format

Wiki pages must follow the template:
`docs\raw\data\template\page.md`

---

## Citation Rules

* Every factual claim must reference a source file
* Use format: (source: filename)
* If sources disagree, note the contradiction
* If a claim lacks a source, mark it as "needs verification"

---

## Question Answering

When answering questions:

1. Read `wiki/index.md`
2. Identify relevant pages
3. Synthesize information
4. Cite wiki pages in the response
5. If not found, state clearly

If the answer is valuable:
→ Offer to save it as a wiki page

---

## Lint / Audit

When auditing the wiki:

* Find contradictions between pages
* Detect orphan pages (no inbound links)
* Identify missing concept pages
* Flag outdated information
* Check formatting compliance

Return findings with suggested fixes.

---

## Staleness

When `docs/raw/` changes:

* Related wiki pages may become outdated
* Agents must not assume wiki is current

Updates must be triggered via:

* ingest
* feature refresh
* or full refresh

---

## Implementation Validation

Source code (`src/`) represents the implemented system.

During validation or refresh:
- Compare implementation against documentation
- Detect undocumented behavior
- Detect outdated or incorrect documentation
- Identify features present in code but missing from docs

Do not assume documentation matches implementation.

---

## Logging

Every wiki update must:

* Update `docs/wiki/index.md`
* Append to `docs/wiki/log.md` with:

  * date
  * action type (ingest / update / refresh)
  * affected pages

---

## Validation

Validation checks alignment without modifying the wiki.

When validating:
- Identify missing updates
- Detect contradictions
- Flag outdated content
- Implementation has higher authority than outdated wiki content.

If implementation and wiki differ:
- Flag the mismatch
- Do not silently reconcile

Do NOT modify any files during validation.

Return results as:

1. Mismatch: [description]
   - Wiki: ...
   - Raw: ...
   - Suggested fix: ...

2. Missing coverage:
   - Concept/page not represented in wiki

3. Outdated content:
   - Page affected

---

## Rules

* Never modify anything in `docs/raw/`
* Always prefer raw over wiki
* Use clear, simple language
* Do not invent facts
* Do not silently resolve conflicts
* Ask the user when uncertain
* Keep page names lowercase with hyphens
* Validation should be performed before major decisions or transitions. Do not assume the wiki is correct without validation.

---

## Guiding Principle

This system is a living knowledge base.

* Raw documents store truth
* Wiki organizes understanding
* Agents maintain consistency

The goal is not just documentation, but **compounding knowledge over time**.
