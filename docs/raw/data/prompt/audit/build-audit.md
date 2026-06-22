# Build Integrity Audit — Prompt Engine

## Purpose

You are acting as:

- Build Systems Auditor
- CI/CD Pipeline Reviewer
- Bundle Integrity Inspector

Your responsibility is to audit Prana's build system for integrity and correctness against the documented Deterministic Build invariant.

Focused audit dimension: **Deterministic Build**

This is a focused audit on the build system dimension of library governance.

---

# Understanding Prana

Prana is an **Electron runtime library & host application shell** built with:

- **electron-vite** — build toolchain (Vite-based for Electron)
- **electron-builder** — packaging and distribution
- **Vitest** — unit and integration testing
- **Playwright** — end-to-end testing
- **TypeScript** — type-safe development

Prana depends on Astra for its MVVM patterns (`useDataState`, `AppStateHandler`, `ApiService`), but the build integrity audit focuses on Prana's own build configuration and outputs.

Prana source structure:

```text
src/
  main/                 ← Main process (services, features, IPC handlers)
  preload/              ← Preload scripts (context bridge)
  renderer/             ← Renderer process (React UI, hooks, components)
```

Prana's build produces an Electron application (not a library), with `electron-vite` managing separate configs for main, preload, and renderer builds. Packaging is handled by `electron-builder` for Windows, macOS, and Linux targets.

---

# Scope

Audit only:

```text
electron.vite.config.ts
tsconfig.json, tsconfig.node.json, tsconfig.web.json
package.json
out/            ← if built (electron-vite output)
.env, .env.example
```

Reference invariant: deterministic build (applies to Prana's electron-vite build). See Astra's invariant pattern in `docs/raw/external-context/astra.md`.

The invariant document overrides all assumptions.

---

# Explicit Non-Goals

The Build Audit MUST NOT:

- inspect component implementation details
- evaluate feature completeness
- evaluate test coverage
- evaluate runtime behavior
- evaluate architectural layering

unless they directly intersect with build configuration.

---

# Mental Model

| Build Concern    | Requirement                                 | Detection                          |
|------------------|---------------------------------------------|------------------------------------|
| Configuration    | Explicit, environment-independent           | `vite.config.ts`, `tsconfig.json`  |
| Output           | Deterministic, bit-identical on re-build    | Two consecutive builds             |
| Dependencies     | Pinned, lockfile-verified                   | Lockfile committed, no wildcards   |
| Environment      | Documented env vars with defaults           | `.env.example`, fallbacks          |
| Scripts          | No source mutation, no network deps         | `package.json` scripts             |
| Type generation  | Reproducible type definitions               | `tsc` / `vite` type plugin         |
| Bundle format    | Valid ESM + UMD output                      | Package exports, format testing    |

---

# Audit Goal

Determine whether the build system behaves as:

- a deterministic, reproducible build producing bit-identical output for identical source
- an explicitly configured build with no environment-dependent behavior
- a valid dual-format package (ESM + UMD) with correct export configuration

OR whether it has drifted into:

- timestamps or random identifiers in build output
- environment-variable-dependent build behavior without documented defaults
- platform-dependent paths or behavior in build config
- build scripts that modify source files
- network-dependent build steps
- missing or incomplete lockfile
- incorrect or missing `exports` configuration
- type generation issues (missing `.d.ts` files, incorrect paths)

---

# Required Audit Dimensions

Analyze ALL of the following:

---

## 1. Vite Correctness

Detect:
- missing or incorrect `build.outDir` configuration
- incorrect `build.lib` configuration for library mode
- missing `rollupOptions.external` for peer dependencies (React in bundle)
- incorrect or missing `build.sourcemap` configuration
- missing or incorrect `build.cssCodeSplit` for library mode
- incorrect `resolve.alias` configuration that works in dev but not build
- missing plugins required for the build (TypeScript, dts, etc.)

Allowed:
- [ ] `build.lib` correctly configured for library output
- [ ] Peer dependencies externalized in `rollupOptions.external`
- [ ] `build.sourcemap` explicitly set (not relying on default)
- [ ] All necessary Vite plugins installed and configured

Forbidden:
- [ ] No React bundled in library output
- [ ] No missing required plugins
- [ ] No incorrect path resolution
- [ ] No sourcemap misconfiguration

Severity mapping:
- P0: React bundled in library output (breaks consumer)
- P1: missing dts plugin (no type declarations), incorrect sourcemap config
- P2: suboptimal but working build config
- P3: build configuration correct and complete

---

## 2. Bundle Determinism

Detect:
- `new Date()` or `Date.now()` in build configuration files
- `Math.random()` or `crypto.randomUUID()` in build scripts
- timestamps injected into bundle via define or replace plugin
- `module.id` or similar non-deterministic values in source
- CSS class name generation without stable hash
- source content hashing that depends on file system order
- build output that differs between consecutive builds

Allowed:
- [ ] All build output derived deterministically from source
- [ ] Version derived from package.json or git hash (not timestamp)
- [ ] Content hashes based on file content, not timestamps

Forbidden:
- [ ] No timestamps in build output
- [ ] No random identifiers in build output
- [ ] No non-deterministic class name generation
- [ ] No Date/Math.random in build config or scripts

Severity mapping:
- P0: timestamps or random IDs in build output, non-deterministic class names
- P1: Date/Math.random in build config (even if not in output yet)
- P2: hashing from unstable input (file order, etc.)
- P3: fully deterministic build output

---

## 3. Type Generation

Detect:
- missing `dist/*.d.ts` files in build output
- incorrect type declaration paths (not matching source structure)
- `tsconfig.json` missing `declaration: true` or `declarationDir`
- missing `@rollup/plugin-typescript` or `vite-plugin-dts` configuration
- type declarations that export internal types (not just public API)
- `.d.ts` files referencing source paths (not relative to dist)
- ambient type declarations missing for library consumers

Allowed:
- [ ] Type declarations generated for all public exports
- [ ] Type declaration paths match import paths
- [ ] No internal types leaked in declarations
- [ ] All necessary type references included

Forbidden:
- [ ] No missing type declarations
- [ ] No incorrect type declaration paths
- [ ] No internal types in declarations
- [ ] No source path references in declarations

Severity mapping:
- P0: no type declarations generated at all
- P1: missing declarations for some exports, incorrect declaration paths
- P2: internal types included but marked as internal
- P3: complete and correct type declarations

---

## 4. ESM/UMD Validity

Detect:
- missing or incorrect `"type": "module"` in package.json
- incorrect `"main"` field for UMD entry point
- incorrect `"module"` field for ESM entry point
- incorrect or missing `"exports"` map in package.json
- `.mjs` vs `.js` extension mismatch between config and output
- missing or incorrect `"types"` or `"typings"` field
- `"sideEffects"` field missing or incorrect
- dual-format output where ESM and UMD have different behavior

Allowed:
- [ ] `"main"` points to UMD bundle
- [ ] `"module"` points to ESM bundle
- [ ] `"exports"` map correctly defines all subpath imports
- [ ] `"types"` points to generated type declarations
- [ ] `"sideEffects"` correctly declared for tree-shaking

Forbidden:
- [ ] No missing or incorrect entry points
- [ ] No missing subpath exports
- [ ] No incorrect sideEffects declaration
- [ ] No ESM/UMD behavioral differences

Severity mapping:
- P0: package won't resolve in consumer (missing/invalid entry point, ESM/UMD mismatch)
- P1: missing subpath exports, incorrect sideEffects
- P2: missing optional exports config
- P3: correct dual-format package configuration

---

# Finding Format

Each finding MUST include:

```
### Finding ID
BUILD-{nnn}

### File
{config-file-path}

### Category
Vite Correctness / Bundle Determinism / Type Generation / ESM-UMD Validity

### Invariant Violated
Deterministic Build invariant (see `docs/raw/external-context/astra.md` for pattern reference)

### Severity
P0 / P1 / P2 / P3

### Violation Type
{short description}

### Evidence
{exact config excerpt or build output inspection}

### Invariant Rule Violated
docs/raw/external-context/astra.md §{Section} — {rule}

### Recommendation
{actionable remediation}

### Impact
{what breaks — consumer resolution, tree-shaking, type safety}
```

---

# Severity Classification

| Severity | Meaning                                  | Action                              |
|----------|------------------------------------------|-------------------------------------|
| P0       | Critical — broken build or resolution    | Must fix before release             |
| P1       | High — suboptimal build config           | Must fix next release               |
| P2       | Transitional — documented build debt     | Allowed temporarily with plan       |
| P3       | Compliant — build integrity intact       | No action required                  |

---

# Scoring Model

Score each dimension 0–10. Apply weights:

| Dimension            | Weight |
|----------------------|--------|
| Vite Correctness     | 30%    |
| Bundle Determinism   | 30%    |
| Type Generation      | 25%    |
| ESM/UMD Validity     | 15%    |

Formula:

```text
Build Score =
(
  Vite Correctness × 0.30
  + Bundle Determinism × 0.30
  + Type Generation × 0.25
  + ESM/UMD Validity × 0.15
)
```

Start each dimension at 10. Deduct per finding in that dimension:

| Severity | Deduction per Finding |
|----------|-----------------------|
| P0       | −3.0                  |
| P1       | −1.5                  |
| P2       | −0.5                  |
| P3       | −0.0 (compliant)      |

Floor per dimension: 0.0.

---

# Final Assessment

| Score Range | Assessment              |
|-------------|-------------------------|
| 9.0–10.0    | Excellent               |
| 7.0–8.9     | Good                    |
| 5.0–6.9     | Needs Improvement       |
| 3.0–4.9     | Major Revision Required |
| 0.0–2.9     | Build Unsound           |

---

# Required Report Structure

## 1. Executive Summary

```text
# Build Audit Report — Prana

Overall Assessment:  {assessment}
Final Score:         {score} / 10
P0 Findings:         {n}
P1 Findings:         {n}
P2 Findings:         {n}
P3 (Compliant):      {n}
```

Followed immediately by the Files Audited table:

| File | Purpose |
|------|---------|
| `electron.vite.config.ts` | electron-vite build configuration |
| `tsconfig.json` | TypeScript configuration (node + web) |
| `tsconfig.node.json` | Node-specific TypeScript config |
| `tsconfig.web.json` | Web-specific TypeScript config |
| `package.json` | Package manifest, scripts, dependencies |
| `out/` | Build output directory |
| Deterministic Build invariant | Invariant authority (see `docs/raw/external-context/astra.md`) |

## 2. Build Configuration Inventory

Summary of active build configuration.

## 3. Vite Correctness Report

Findings per check. Compliance table at end.

## 4. Bundle Determinism Report

Findings per check. Compliance table at end.

## 5. Type Generation Report

Findings per check. Compliance table at end.

## 6. ESM/UMD Validity Report

Findings per check. Compliance table at end.

## 7. Findings Summary

All findings grouped by severity:

### P0 — Critical

| ID | File | Finding |
|----|------|---------|

### P1 — High

| ID | File | Finding |
|----|------|---------|

### P2 — Transitional

| ID | File | Finding |
|----|------|---------|

## 8. Transitional Violations

Known documented tech debt accepted for this release with rationale.

## 9. Scoring Breakdown

| Dimension            | Raw Score | Weight | Weighted Score |
|----------------------|-----------|--------|----------------|
| Vite Correctness     |           | 30%    |                |
| Bundle Determinism   |           | 30%    |                |
| Type Generation      |           | 25%    |                |
| ESM/UMD Validity     |           | 15%    |                |

```text
Total Score: X.X / 10
```

## 10. Score Improvement Summary

Compare against the previous report from `docs/raw/report/build/archive/` (highest timestamp). If no previous report exists, state "Baseline — no prior report to compare."

```text
Previous Report: {filename}
Previous Score:  X.X / 10
Current Score:   Y.Y / 10
Change:          +N.N / −N.N / No change
```

| Dimension            | Previous | Current | Change |
|----------------------|----------|---------|--------|
| Vite Correctness     | X        | Y       | +N     |
| Bundle Determinism   | X        | Y       | +N     |
| Type Generation      | X        | Y       | +N     |
| ESM/UMD Validity     | X        | Y       | +N     |

List resolved findings from previous report. List new findings not in previous report.

## 11. Final Verdict

```text
{Assessment} ({Score}/10)
```

Provide a concise build health summary.

## 12. Audit Traceability

| Reference          | Location                                                      |
|--------------------|---------------------------------------------------------------|
| Invariant Doc      | Deterministic Build invariant (see `docs/raw/external-context/astra.md`) |
| Source             | `src/**`                                                      |
| Build Config       | `vite.config.ts`, `tsconfig.json`, `package.json`            |
| Audit Report       | `docs/raw/report/build/latest/build-audit-{timestamp}.md`    |
| Previous Report    | `docs/raw/report/build/archive/{previous-filename}`           |

---

# Report Rotation

Before writing the new report, rotate the previous report:

```text
mv docs/raw/report/build/latest/* docs/raw/report/build/archive/
mkdir -p docs/raw/report/build/latest
```

---

# Output Location

```text
docs/raw/report/build/latest/build-audit-{timestamp}.md
```

Timestamp format: `YYYY-MM-DD-HHMM`

---

# Invariant Document Authority

When checking compliance:

- The invariant document is the source of truth
- For each finding, reference the specific Allowed or Forbidden pattern section from `docs/raw/external-context/astra.md`
- Do NOT override invariant rules based on perceived convenience
- Findings that also affect library governance must be flagged for cross-suite deduplication in the fix plan
