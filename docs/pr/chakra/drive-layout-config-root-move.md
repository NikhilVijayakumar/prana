# Prana Clarification: drive-layout.json Is Now at the Project Root

**Status:** Informational / path update required
**Owner repo:** Prana
**Reported by:** Chakra integration

---

## Summary

`drive-layout.json` has been moved from `src/main/config/drive-layout.json` to `config/drive-layout.json` (project root). Any Prana code or documentation that references the old path should be updated.

---

## Why

The config file has no dependency on the Electron main-process compilation pipeline — it is a plain JSON schema that describes the virtual drive directory layout. Keeping it under `src/main/config/` made it appear to be source code and placed it behind a long relative path. Moving it to a root-level `config/` directory makes it:

- Directly accessible from the project root without navigating into `src/`
- Consistent with the convention for project-wide configuration (e.g. alongside `.env`, `package.json`)
- Easier to edit by non-TypeScript contributors who only need to add a directory to the layout

---

## What Changed in Chakra

| Before | After |
|---|---|
| `src/main/config/drive-layout.json` | `config/drive-layout.json` |

One import updated in `src/main/services/driveLayoutService.ts`:

```diff
- import driveLayoutConfig from '../config/drive-layout.json'
+ import driveLayoutConfig from '../../../config/drive-layout.json'
```

No behavior change. The JSON content is identical. Vite bundles the JSON at build time via the static import, so runtime resolution is unaffected.

---

## Prana Action Required

If Prana's documentation (e.g. `docs/pr/chakra/`) or any tooling references the old path `src/main/config/drive-layout.json`, update those references to `config/drive-layout.json`.

Prana itself does not import this file directly — it receives the directory list from Chakra via the `chakra:ensure-drive-layout` IPC call. No Prana source files need to change.

---

## Drive Layout Schema (for reference)

The JSON schema remains unchanged:

```jsonc
{
  "version": 1,
  "description": "Virtual drive folder structure and quota.",
  "quota": {
    "maxStorageMb": 10240,
    "warnAtPercent": 85,
    "pollIntervalMs": 60000
  },
  "directories": {
    "apps": {
      "chakra": {},
      "dhi": {}
    },
    "cache": {
      "sqlite": {}
    },
    "data": {
      "governance": {}
    }
  }
}
```

Adding a new key at any level (top-level or nested) causes `chakra:ensure-drive-layout` to create the corresponding directory under the drive root on the next startup. Removals from the JSON do **not** delete existing directories — the service is additive-only.
