# PRANA-ISSUE: Branding Config Cold-Vault Migration

**Status**: OPEN  
**Severity**: High  
**Created**: 2026-03-31  
**Component**: `PranaBrandingConfig` / Renderer Configuration Pipeline  

---

## Problem Statement

`PranaBrandingConfig` (containing `appBrandName`, `appTitlebarTagline`, `appSplashSubtitle`, `directorSenderEmail`, `directorSenderName`, `avatarBaseUrl`) is currently injected into the renderer via a volatile `window.__pranaBrandingConfig` global variable. This violates Prana's **Cold-Vault Architecture** which mandates that *all* configuration must flow through the IPC → SQLite → Cold-Vault pipeline.

### Current (Broken) Flow
```
Host App (Dhi) → window.__pranaBrandingConfig (volatile global) → resolveBrandingConfig() → prop-drilling through React tree
```

### Target (Cold-Vault) Flow
```
Host App (Dhi) → IPC 'app:bootstrap-host' { config: { branding: {...} } } → sqliteConfigStoreService → IPC 'app:get-branding-config' → React Context
```

---

## Evidence

### 1. Volatile Global Injection (`src/ui/main.tsx:9-18`)
```typescript
const resolveBrandingConfig = (): Partial<PranaBrandingConfig> => {
  if (typeof window === 'undefined') return {};
  const injectedConfig = (window.__pranaBrandingConfig ?? window.__pranaTestBrandingConfig) as
    | Partial<PranaBrandingConfig>
    | undefined;
  return injectedConfig ?? {};
};
```
This reads from a raw, unvalidated window global — bypassing SQLite entirely.

### 2. Prop-Drilling Anti-Pattern
Branding config is passed as `branding: Partial<PranaBrandingConfig>` props through every component:
- `main.tsx` → `RootFlow` → `IntegrationVerificationPage`
- `main.tsx` → `RootFlow` → `SplashContainer` → `SplashView`
- `MainLayout` → `DirectorInteractionBar`

This creates a fragile, verbose integration surface for host apps.

### 3. No Backend Awareness
The main process has zero knowledge of branding config. It is not part of:
- `PranaRuntimeConfig` interface
- `validatePranaRuntimeConfig()` validation
- `sqliteConfigStoreService` persistence
- `RuntimeBootstrapConfig` or `PublicRuntimeConfig`

---

## Impacted Files

### Main Process (Backend)
| File | Change |
|------|--------|
| `src/main/services/pranaRuntimeConfig.ts` | Add `branding` section to `PranaRuntimeConfig` interface |
| `src/main/services/runtimeConfigService.ts` | Add branding to `RuntimeBootstrapConfig`, `PublicRuntimeConfig`, and `REQUIRED_RUNTIME_KEYS` |
| `src/main/services/ipcService.ts` | Add `app:get-branding-config` IPC handler |

### Renderer (Frontend)
| File | Change |
|------|--------|
| `src/ui/main.tsx` | Replace `window.__pranaBrandingConfig` with IPC fetch + `BrandingProvider` |
| `src/ui/constants/pranaConfig.ts` | Add `BrandingContext` and `useBranding()` hook |
| `src/ui/env.d.ts` | Keep `__pranaBrandingConfig` for backward compat but mark deprecated |
| `src/ui/splash/view/SplashView.tsx` | Consume from context instead of props |
| `src/ui/splash/view/SplashContainer.tsx` | Remove `branding` prop |
| `src/ui/layout/MainLayout.tsx` | Consume from context instead of props |
| `src/ui/components/DirectorInteractionBar.tsx` | Consume from context instead of props |
| `src/ui/integration/view/IntegrationVerificationPage.tsx` | Consume from context instead of props |

---

## Architectural Alignment

This migration aligns with:
- **Cold-Vault Philosophy** (`docs/integration_guide/library-integration-guide.md`): All config flows through IPC → SQLite
- **PG-001** (`docs/bugs/persistence-gaps.md`): Eliminates another raw runtime props bypass
- **Leak 1** (`docs/bugs/critical-gaps.md`): Removes volatile memory-based config access pattern

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Breaking Dhi host integration | Backward-compat: keep `window.__pranaBrandingConfig` as fallback with deprecation warning |
| Pre-bootstrap branding needed for IntegrationVerificationPage | IntegrationVerificationPage renders before bootstrap; use window fallback for this single screen |
| Branding fields are cosmetic, not security-critical | True, but consistency matters — partial cold-vault compliance breeds architectural debt |
