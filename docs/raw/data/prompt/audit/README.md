# Prana Audit System — Execution Guide

## Overview

Prana has 7 audit prompts across two concerns: **documentation integrity** and **source integrity**. Order matters because downstream audits treat upstream documents as authority. Running implementation audit before architecture and feature audits are clean produces false positives — the implementation might correctly follow bad docs.

---

## Authority Chain

```text
L1  External Context (Astra)   ← defines architecture patterns consumed by Prana
L2  Feature docs               ← defines what Prana must do
L3  README                     ← public contract summary
L4  Source code                ← how it was actually built
```

Each audit layer depends on the layer above it being correct first.

---

## Execution Order

### Stage 1 — Architecture Foundation

**Run first. No dependencies.**

| # | Prompt | Scope | Report Location |
|---|--------|-------|-----------------|
| 1 | `external-context-audit.md` | `README.md` + `docs/raw/external-context/**` + `docs/raw/data/prompt/**` | `docs/raw/report/governance/latest/` |

**Why first:** External context defines the architecture patterns Prana consumes. A gap in external context propagates into every downstream audit that references architecture.

---

### Stage 2 — Feature Specification

**Run after Stage 1 is clean.**

| # | Prompt | Scope | Report Location |
|---|--------|-------|-----------------|
| 2 | `feature-audit.md` | `docs/raw/features/**` against itself | `docs/raw/report/feature/latest/` |

**Why second:** Feature-technical docs (if they exist) must align with feature specs. Running feature-technical audit before feature specs are verified means fixing the wrong layer when conflicts are found.

---

### Stage 3 — Public Contract

**Run after Stage 2 is clean.**

| # | Prompt | Scope | Report Location |
|---|--------|-------|-----------------|
| 3 | `readme-audit.md` | `README.md` against `docs/raw/features/**` + `docs/raw/external-context/astra.md` | `docs/raw/report/readme/latest/` |

**Why third:** README is the public face of Prana. It must accurately reflect features and external context. Verifying it after L1–L2 are clean avoids correcting README against wrong source docs.

---

### Stage 4 — Source Validation

**Run after Stage 3 is clean. Audits 4a, 4b, 4c can run in parallel.**

| # | Prompt | Scope | Report Location |
|---|--------|-------|-----------------|
| 4a | `implementation-audit.md` | `src/**` against `docs/raw/external-context/astra.md` + `docs/raw/features/**` + `README.md` | `docs/raw/report/implementation/latest/` |
| 4b | `statelessness-audit.md` | `src/main/**` + `src/renderer/**` against statelessness invariants | `docs/raw/report/statelessness/latest/` |
| 4c | `build-audit.md` | `electron.vite.config.ts`, `tsconfig*.json`, `package.json`, `out/` against deterministic build invariant | `docs/raw/report/build/latest/` |

**Why parallel:** These three audits examine different aspects of the source with no cross-dependency:
- `implementation-audit` — full doc-vs-source compliance (behavior, API, types, drift)
- `statelessness-audit` — focused statelessness boundary check (subset of implementation scope, different angle)
- `build-audit` — build system integrity (orthogonal to behavioral correctness)

**Note:** `statelessness-audit` overlaps partially with `implementation-audit` Phase 2 (Architecture Compliance). Conflicting findings in both reports indicate the same root cause — fix once.

---

### Stage 5 — Security

**Run after Stage 4 is clean. Independent of doc hierarchy.**

| # | Prompt | Scope | Report Location |
|---|--------|-------|-----------------|
| 5 | `security-audit.md` | `src/**` + `package.json` + `package-lock.json` + `electron.vite.config.ts` | `docs/raw/report/security/latest/` |

**Why:** Security audit is most useful on stable, implementation-correct code. Running it while source has known behavioral bugs adds noise. Can run earlier if a security review is urgently needed — it is independent of doc layers.

---

## Quick Reference

```text
Stage 1  external-context-audit  (docs only — no deps)
Stage 2  feature-audit           (docs only — after Stage 1)
Stage 3  readme-audit            (docs only — after Stage 2)
Stage 4  implementation-audit  ┐
         statelessness-audit   ├── parallel — after Stage 3
         build-audit           ┘
Stage 5  security-audit        (after Stage 4)
```

---

## Re-Run Triggers

Run only the affected stage and everything downstream of it.

| What Changed | Re-run From |
|---|---|
| `docs/raw/external-context/**` | Stage 1 → all stages |
| `docs/raw/features/**` | Stage 2 → Stages 3, 4, 5 |
| `README.md` | Stage 3 → Stages 4, 5 |
| `src/**` (behavior change) | Stage 4 (4a + 4b) → Stage 5 |
| `electron.vite.config.ts` / `tsconfig*.json` / `package.json` | Stage 4c → Stage 5 |
| `package-lock.json` (dependency update) | Stage 5 only |

---

## Report Rotation

Every audit prompt rotates its previous report before writing a new one:

```text
mv docs/raw/report/{type}/latest/* docs/raw/report/{type}/archive/
```

Archive reports are compared against in the Score Improvement Summary section of each new report.

---

## Audit Inventory

| Prompt | Authority Source | What It Validates |
|--------|-----------------|-------------------|
| `feature-audit.md` | Feature docs (self) | Functional completeness, workflow coverage, state coverage, purity |
| `readme-audit.md` | Features + External Context | Public contract accuracy |
| `implementation-audit.md` | All doc layers | Source compliance with all documented contracts |
| `statelessness-audit.md` | Statelessness invariant | Runtime service statelessness compliance |
| `build-audit.md` | Deterministic build invariant | Build reproducibility, type generation, ESM validity |
| `security-audit.md` | OWASP / secure coding practices | XSS, data exposure, dependency CVEs, injection, build security |
| `external-context-audit.md` | `docs/raw/external-context/**` | External context completeness and scope compliance |
