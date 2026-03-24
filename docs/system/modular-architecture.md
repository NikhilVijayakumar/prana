# Modular Architecture Guide

This project is structured as a **separate-repository architecture** where core libraries are consumed as Git dependencies.

## Global Directory Structure
Core modules live in independent repositories and are imported through `package.json` Git references in consuming apps.

Example consumer dependency pattern:
- `"astra": "github:NikhilVijayakumar/astra"`
- `"dharma": "github:NikhilVijayakumar/dharma"`
- `"prana": "github:NikhilVijayakumar/prana"`

### Import Segregation Rules
To maintain decoupling and prevent circular dependencies across repositories:
1. Application repositories **MUST NOT** couple directly to each other; shared dependencies should flow through `astra`, `dharma`, and `prana`.
2. Core/runtime libraries **MUST NOT** import application-specific UI layers.
3. `astra` **MUST NOT** import business logic from app repositories.

These boundaries should be enforced by import rules, CI checks, and package-level contracts.

## Local Repository Layout
This repository is the Prana codebase and should keep local build/type paths aligned with its actual local source layout.

If local config still points to legacy package paths (for example `packages/prana/*`) while implementation lives under `src/*`, treat it as a migration residue to be cleaned up.

### Source-Of-Truth Path Mapping (This Repo)
- `src/main/*` -> Electron main process
- `src/ui/*` -> renderer UI domain modules
- `src/services/*` -> shared service adapters used by renderer/main
- `@prana/*` -> `src/*`
- `@renderer/*` -> `src/ui/*`

Legacy aliases like `packages/prana/*`, `packages/dhi/*`, and `packages/dharma/*` should not be used in this repository unless those directories are intentionally reintroduced.
