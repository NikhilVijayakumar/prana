# SQLite Cache Audit

## Summary
SQLite-backed runtime state is broad and practical, but the documentation should clearly separate hot-cache behavior from archival storage.

## Missing Logic / Edge Cases
- SQLite export persistence is unencrypted unless the encrypted system drive is active.
- Some domains still read from legacy paths or direct vault-backed files.
- Not every runtime entity has migrated to SQLite-backed projection services.

## Documentation-to-Code Mismatches
- The docs should avoid implying that SQLite itself is encrypted by the database engine.
- The actual encryption boundary is the storage layer underneath SQLite, not `sql.js`.
- Email knowledge context is now SQLite-backed, which the old docs did not describe.

## Security Risks
- In fallback mode, SQLite files can become plain files under the local app data root.
- Long-lived hot cache growth can create data retention sprawl if cleanup is not enforced.

## Recommended Fixes
- Document that SQLite encryption is an environmental property, not a DB-native one.
- Keep the system-drive mount as the preferred encrypted root.
- Retain cleanup policies for operational caches and email context stores.
