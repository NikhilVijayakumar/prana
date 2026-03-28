# Bug Report: Missing `externalizeDepsPlugin` in Prana

## Status (2026-03-28)
Overall: CLOSED

Resolution evidence:
1. `electron.vite.config.ts` uses `externalizeDepsPlugin()` for main and preload.
2. Main/preload Rollup external dependencies include `sql.js`, `bcryptjs`, `js-tiktoken`, `mammoth`, `marked`, and `turndown`.
3. Typecheck and build pass in this workspace.

## Issue Description
We encountered a crash when running the dev server for the `dhi` app which consumes `prana`. 
The dev server crashed during the initial electron main process loading with the following error:
```
(node:25436) UnhandledPromiseRejectionWarning: TypeError: Cannot set properties of undefined (setting 'exports')
    at .../out/main/index.js:4629:26
    ...
[PRANA] Splash sync initialization failed: Cannot set properties of undefined (setting 'exports')
```

## Root Cause
The root cause was that Vite (via Rollup) was aggressively bundling `sql.js` inside the `dhi` environment instead of keeping it as an external `require()` reference. `sql.js` contains Emscripten/UMD patterns like `module.exports = ...` that get improperly polyfilled when packed into an ESM bundle without `require` being correctly exposed, hence the "Cannot set properties of undefined (setting 'exports')" error. 

While this was fixed inside `dhi` by adding `externalizeDepsPlugin` and explicit external configurations (e.g., `external: ['sql.js']`) to `dhi/electron.vite.config.ts`, a similar bug might be present in `prana`'s own build configuration. 

## Recommended Fix in Prana
Completed.

No further action is required unless new ESM dependency regressions are introduced.
