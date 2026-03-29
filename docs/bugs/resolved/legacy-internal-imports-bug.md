# Bug Audit: Legacy `@prana` Imports Inside `prana` Repository

## Purpose
Track status of the historical legacy internal alias bug and keep closure evidence for downstream consumers.

## Historical Issue
When `dhi` compiled against `prana` source, TypeScript failed to resolve internal `@prana/...` imports from `node_modules/prana/src/...` after `dhi` removed alias support.

Representative historical errors:
```
node_modules/prana/src/ui/authentication/repo/AuthRepo.ts(7,8): error TS2307: Cannot find module '@prana/ui/constants/storageKeys' or its corresponding type declarations.
node_modules/prana/src/ui/components/AuthGuard.tsx(3,41): error TS2307: Cannot find module '@prana/ui/state/volatileSessionStore' or its corresponding type declarations.
```

## Current Status (2026-03-28)
Status: CLOSED.

Findings:
1. Active source imports using `@prana/...` are no longer present in implementation code.
2. `package.json` name is `prana`.
3. `tsconfig.web.json` maps `prana/*` to `src/*`.
4. Backward-compatibility comment now references `prana/...` pathing and no stale `@prana/...` example remains.

## Remaining Actions
1. Keep regression check in CI/local audit:
	- search for `from '@prana/` in `src/**`
2. Keep this file as closure evidence for consumers still transitioning from old alias contracts.

## Closure Criteria
This bug is considered closed when:
1. No active `@prana/...` imports exist in `src/**`.
2. Typecheck passes in standalone consumer setup without `@prana` alias hacks.
3. Documentation references only `prana/...` internal absolute imports.
