# Prana PR: Client-Configurable SQLite Root Path

**Status:** Implemented — `sqliteRoot` field in `PranaRuntimeConfig`; all store services use `mkdirSafe` via `getSqliteRoot()`
**Owner repo:** Prana
**Requested by:** Chakra (Phase 10 — Drive Layout JSON)

---

## Problem

Prana currently resolves the SQLite root path internally from the System Drive (`getSystemDataRoot()`). The client app has no way to tell Prana where to store SQLite databases within the mounted drive.

This couples Prana's storage mechanics to a specific path layout that the client app cannot control, violating the client-owned policy contract established in `pr/chakra/drive-decoupling-client-owned-policy-proposal.md`.

For Chakra, SQLite databases should live under `cache/sqlite/` inside the mounted drive. For other client apps, the preferred path may differ. Prana should not make this decision.

---

## Proposal

Allow the client app to provide the SQLite root path at runtime initialization, before any SQLite service opens a connection.

Prana should expose a configuration hook — either via `PranaRuntimeConfig`, `setPranaPlatformRuntime`, or a dedicated pre-init call — that accepts:

```typescript
interface PranaStoragePathConfig {
  sqliteRoot?: string  // Absolute path where SQLite files should be written
}
```

If `sqliteRoot` is provided by the client app, Prana uses it. If not provided, Prana falls back to current behavior (`getSystemDataRoot()`).

---

## Required Behavior

1. Prana SQLite services (`sqliteConfigStoreService`, `runtimeDocumentStoreService`, `conversationStoreService`, etc.) must resolve their database file paths using the client-provided `sqliteRoot` when set.
2. The client app sets this path after the virtual drive mounts and after `ensureDirectories` has created the target folder.
3. Prana must validate that the provided path exists and is writable before accepting it. If invalid, fall back to default with a warning log.
4. The path must be set before any SQLite connection is opened — Prana must not cache or snapshot the path before the client has had a chance to set it.
5. No breaking change to existing behavior when `sqliteRoot` is not provided.

---

## Acceptance Criteria

- Client app can pass an absolute path as the SQLite root via the Prana initialization contract.
- All Prana SQLite services write their `.sqlite` files under the provided path.
- Omitting the config leaves current behavior unchanged.
- Path validation occurs at init time with clear error messaging.
- Prana core has no Chakra-specific logic — the config is generic and app-neutral.

---

## Non-Goals

- Do not change the SQLite schema, table structure, or domain model.
- Do not expose per-service path overrides — one root path for all SQLite files is sufficient.
- Do not remove the existing `getSystemDataRoot()` default path behavior.

---

## Chakra Usage (After Implementation)

Chakra will:
1. Mount virtual drive (Prana handles mount mechanics)
2. Call `driveLayoutService.ensureDirectories(driveRoot)` — creates `cache/sqlite/` among others
3. Pass `sqliteRoot = join(driveRoot, 'cache', 'sqlite')` to Prana's init config
4. Prana then writes all SQLite files under `cache/sqlite/` on the mounted drive

---

## Files Expected to Change in Prana

- `src/main/services/pranaRuntimeConfig.ts` — Add `sqliteRoot` to the runtime config shape
- `src/main/services/runtimeConfigService.ts` — Propagate `sqliteRoot` to SQLite services
- `src/main/services/sqliteConfigStoreService.ts` — Use configurable root path
- `src/main/services/runtimeDocumentStoreService.ts` — Use configurable root path
- Other SQLite-backed store services as applicable
