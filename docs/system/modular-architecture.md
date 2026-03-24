# Modular Architecture Guide

This project is structured as a **Modular Monolith** designed for a seamless future transition to a multi-repo strategy.

## Global Directory Structure
The repository contains 5 root-level application modules orchestrated under the `@app/` super-directory:
- `/packages/prana/`: The underlying headless engine and foundational auth UI functionality.
- `/packages/dharma/`: The shared source of truth schema and company DNA values.
- `/packages/astra/`: The "Astra Design System" component library. Contains common Viewers, Layouts, and primitive UI blocks.
- `/packages/dhi/`: UI specifically dedicated to the Executive persona.
- `/packages/vidhan/`: UI specifically dedicated to internal Operations and policy integrations.

### Import Segregation Rules
To maintain decoupling and prevent circular dependencies:
1. `director` and `admin` **MUST NOT** import from each other. They import from `astra`, `registry`, and `core`.
2. `core` and `registry` **MUST NOT** import anything residing within `director` or `admin`. 
3. `astra` **MUST NOT** import business logic from `director` or `admin`.

These boundaries are statically enforced within our decoupled TypeScript configurations (`tsconfig.web.json` vs `tsconfig.node.json`).

## Future Split
When migrating to independent repositories (e.g. `dhi-director-app` vs `dhi-admin-app`):
- `Astra`, `Core`, and `Registry` will be exported into NPM packages or submodules.
- Each UI package will consume those distributed dependencies globally via dependency injection.
