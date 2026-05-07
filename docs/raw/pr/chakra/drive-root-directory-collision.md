# Prana Clarification: Intended Drive Root Layout (S:\)

**Status:** Clarification / design intent
**Owner repo:** Prana
**Reported by:** Chakra integration

---

## Summary

This document clarifies the **intended** directory layout on the virtual drive and corrects a previously incorrect proposal to introduce an `S:\live` subdirectory as the Prana data root.

**The drive root (`S:\`) IS the data root.** All Prana services and all Chakra drive-layout directories should resolve to paths directly under `S:\`. No `live\` intermediate directory should exist.

---

## Intended Drive Layout

```
S:\                         ← drive root = data root (getSystemDataRoot())
  apps\
    chakra\                 ← Chakra app data
    dhi\                    ← DHI app data
  cache\
    sqlite\                 ← SQLite cache files
  data\
    governance\             ← Governance repo clone
```

This structure is the source of truth from `src/main/config/drive-layout.json` in Chakra. On every startup, `chakra:ensure-drive-layout` reads that JSON and creates any missing directories under `getSystemDataRoot()`. If new top-level or nested keys are added to `drive-layout.json`, they are created on next startup — the JSON is the live schema.

---

## Valid Schema Changes to drive-layout.json

```jsonc
{
  "directories": {
    "apps": {
      "chakra": {},
      "dhi": {},
      "new-app": {}      // ← valid: new sub-object adds S:\apps\new-app\
    },
    "cache": {
      "sqlite": {},
      "thumbnails": {}   // ← valid: new sub-object adds S:\cache\thumbnails\
    },
    "data": {
      "governance": {}
    },
    "logs": {}           // ← valid: new top-level adds S:\logs\
  }
}
```

Removals from the JSON do NOT delete existing directories — the service is additive-only by design.

---

## What Prana Must NOT Do

- Do **not** introduce `S:\live\` as the Prana data root (previously proposed as a fix for the EPERM bug — see `windows-drive-root-mkdir-eperm.md` for the correct fix).
- Do **not** create parallel directory trees at `S:\live\apps`, `S:\live\cache`, etc.
- Prana services that resolve paths via `getSystemDataRoot()` must use that value as-is; they must not append a `live` or any other fixed subdirectory.

---

## Previously Observed Symptom (now explained)

When the now-reverted `live` subdirectory fix was partially applied, the drive showed two overlapping namespace roots:

```
S:\
  apps\       ← from Chakra driveLayout (driveRoot = S:)
  cache\
  data\
  live\       ← from partially-applied Prana fix (incorrect)
    ...
```

Any Prana state JSON tracking drive paths would see entries from both roots — appearing as "duplicate paths". This is resolved by never introducing `S:\live\` and keeping all directories at `S:\` root as per `drive-layout.json`.

---

## Prana Action Required

Apply the EPERM fix from `windows-drive-root-mkdir-eperm.md` instead of the `live` subdirectory workaround. Once that fix is in place:

1. `getSystemDataRoot()` returns `S:` on Windows (unchanged).
2. Prana services that need to initialize their data directory call `mkdir(root)` with the EPERM guard.
3. All paths resolve consistently under `S:\`.
4. No duplicate paths appear in any state JSON.
