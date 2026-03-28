# 03 Organism Complex UI

## Goal
Higher-composition components that can still be reusable when domain orchestration is externalized.

## Promotion Rule
Organism candidate must satisfy all:
- No direct workflow orchestration.
- No direct window/main-process coupling.
- Public props must be stable and domain-neutral.
- Any stateful behavior must be controllable from parent for Astra portability.

---

## AuthGuard Suite (Phase 2 Decomposed)

**Status**: ✅ **Decomposed into neutral + adapter layers**

Path (Neutral): `src/ui/common/components/RouteGuards.tsx`
Path (Prana Adapter): `src/ui/components/AuthGuardAdapter.tsx`

### What Was Done

The original AuthGuard monolith (5 guards: AuthGuard, MainAppGuard, OnboardingGuard, PublicOnlyGuard, ModuleRouteGuard) was split into:

**Neutral RouteGuards** (common/components/RouteGuards.tsx) — For Astra adoption:
- `SessionTokenGuard`: Generic authentication guard with custom validation predicate.
  - Props: `session`, `loginPath`, `validateFn` (token validation function)
- `OnboardingStateGuard`: Generic state-gated guard with condition predicate.
  - Props: `session`, `condition` (state evaluation), `redirectPath`
- `ModuleRouteGuard`: Feature-gated route guard with generic enablement predicate.
  - Props: `isEnabled`, `fallbackPath`
- `PublicAccessGuard`: Inverse guard for unauthenticated-only routes.
  - Props: `session`, `isAuthenticated` (predicate), `redirectPath`
- Utility: `validateSessionToken()` — Composable token validation.

**Prana Adapter** (components/AuthGuardAdapter.tsx) — Prana-specific wiring:
- Re-exports all 5 guards as before (AuthGuard, MainAppGuard, OnboardingGuard, PublicOnlyGuard, ModuleRouteGuard).
- Adapter connects guards to `useVolatileSessionStore()`, `SESSION_TOKEN_PREFIX`, `getFirstEnabledMainRoute()`, config.
- Astra can adopt generic guards by providing its own session store and routing helpers.

### Coupling Reduction

| Aspect | Before | After |
|--------|--------|-------|
| Token validation logic | 5 duplicates | 1 shared utility |
| Session store binding | Embedded in each guard | Centralized adapter |
| Routing decisions | Hard-coded per guard | Predicate-based (adapter) |
| Astra adoptability | 0% (app-specific) | 80% (with Astra session bridge) |

Promotion decision: **Lane B (Adopted into Astra with minor session bridge)**.

---

## PreAuthLayout (Phase 2 Decomposed)

**Status**: ✅ **Decomposed into frame + adapter layers**

Path (Neutral): `src/ui/common/components/PreAuthLayoutFrame.tsx`
Path (Prana Adapter): `src/ui/layout/PreAuthLayoutAdapter.tsx`

### What Was Done

The original PreAuthLayout (with hard-coded "DHI — COGNITIVE MANAGEMENT SYSTEM" branding) was split into:

**PreAuthLayoutFrame** (common/components/PreAuthLayoutFrame.tsx) — Neutral structure for Astra:
- Generic flex-column layout with draggable titlebar + centered content.
- Props: `children`, optional `titleText` (defaults to "Authentication").
- Uses Astra tokens (MUI theme, spacing.xl).
- Zero app-specific strings or imports.

**Prana Adapter** (layout/PreAuthLayoutAdapter.tsx) — Prana branding:
- Wraps PreAuthLayoutFrame with Prana app title: "DHI — COGNITIVE MANAGEMENT SYSTEM".
- Maintains backward-compatible PreAuthLayout export.

### Coupling Reduction

The structural frame is now domain-neutral and reusable in any Astra-based app by choosing the frame's `titleText` prop.

Promotion decision: **Lane B (Adopted into Astra structure library)**.

---

## ReviewActionModal

Path: `src/ui/common/components/ReviewActionModal.tsx`

User story:
As a reviewer, I need approve/reject interactions with mandatory reject rationale so decisions are auditable.

Current coupling observations:
- Maintains internal `actionMode`, `approveNote`, and `rejectNote` state.
- Uses workflow-specific localization keys.

Required refactor before Astra:
- Convert to fully controlled modal contract:
  - `mode`, `approveNote`, `rejectNote`
  - `onModeChange`, `onApproveNoteChange`, `onRejectNoteChange`
- Keep approve/reject callbacks behaviorally equivalent.

Promotion decision:
- **Lane B (Promote with controlled-state refactor)**.

---

## SyncHealthWidget

Path: `src/ui/common/components/SyncHealthWidget.tsx`

User story:
As an operator, I need sync health status and action controls for push/pull operations.

Current coupling observations:
- Controlled by props.
- Uses sync-domain-specific status shape and labels.

Required audit before Astra:
- Confirm status shape can be generic without Prana assumptions.
- Replace sync-domain label keys with neutral labels or caller-provided text.
- Keep action callbacks (`onRefresh`, `onPullNow`, `onPushNow`) parent-owned.

Promotion decision:
- **Lane B (Promote with neutrality audit)**.

---

## DirectorInteractionBar

Path: `src/ui/components/DirectorInteractionBar.tsx`

Current coupling observations:
- Bound to employee directory semantics and app branding sender identity.
- Contains direct channel/work-order window API calls.
- Includes app-specific routing metadata (`moduleRoute`).

Promotion decision:
- **Lane D (Keep local)** until split into:
  - reusable view-only interaction panel,
  - Prana-specific orchestration wrapper.

---

## DynamicProfileRenderer

Path: `src/ui/components/DynamicProfileRenderer.tsx`

Current coupling observations:
- Bound to lifecycle provider types (`LifecycleProfileDraft`, `LifecycleGlobalSkill`).
- Uses lifecycle-specific labels and structure.

Promotion decision:
- **Lane D (Keep local)** until split into generic profile-view primitives and lifecycle wrapper.

---

## MainLayout shell fragments

Path: `src/ui/layout/MainLayout.tsx`

Current coupling observations:
- Includes route depth stack, module enablement checks, session/onboarding gating, and director bar composition.
- Uses app title/footer branding strings.

Promotion decision:
- **Lane D (Keep orchestration local)**.
- Promotion only for extracted shell primitives (header/footer/frame blocks) after decoupling.

---

## Organism Exit Criteria
1. No direct main-process bridge calls.
2. No route/session orchestration in promoted component.
3. State contracts are controlled when needed.
4. Component can be mounted in another app without Prana constants/modules.
