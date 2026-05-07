# Storage Neutrality Invariant

````md
# Storage Neutrality Invariant

## Purpose

Prana is a reusable orchestration runtime library.

The runtime must not depend on any specific persistence implementation,
database engine, filesystem layout, vault provider, or storage vendor.

All storage interaction must occur through explicit capability contracts.

The runtime coordinates persistence behavior but does not own storage technology decisions.

Storage ownership belongs to:
- client applications
- infrastructure adapters
- capability implementations

NOT the runtime core.

---

# Architectural Rule

Runtime services must depend only on abstract storage capabilities.

Core orchestration layers may not:
- directly import database drivers
- directly manipulate filesystem infrastructure
- assume storage topology
- assume directory layouts
- assume storage semantics
- encode vendor-specific persistence logic

All storage behavior must be injected through contracts.

---

# Allowed Patterns

## Capability-Based Persistence

Allowed:

```ts
interface StorageCapability {
  save(record: RuntimeRecord): Promise<void>
}
````

Reason:
Core runtime depends on abstraction only.

---

## Injected Storage Providers

Allowed:

```ts
constructor(
  private readonly storage: StorageCapability
) {}
```

Reason:
Storage implementation is externalized.

---

## Adapter Isolation

Allowed:

```text
/adapters/sqlite/
/adapters/postgres/
/adapters/filesystem/
```

Reason:
Infrastructure concerns remain isolated.

---

## Storage Strategy Injection

Allowed:

```ts
runtime.start({
  storageProvider
})
```

Reason:
Client owns persistence decisions.

---

## Explicit Storage Contracts

Allowed:

```ts
await vaultCapability.store(document)
```

Reason:
Runtime coordinates behavior without vendor assumptions.

---

# Forbidden Patterns

## Direct Database Driver Usage In Core Runtime

Forbidden:

```ts
import Database from 'better-sqlite3'
```

inside:

* orchestration services
* runtime coordination layers
* core execution modules

Reason:
Runtime becomes storage-coupled.

---

## Direct Filesystem Ownership

Forbidden:

```ts
fs.mkdirSync('/vault')
```

inside runtime orchestration layers.

Reason:
Filesystem topology becomes runtime-owned.

---

## Hardcoded Paths

Forbidden:

```ts
const ROOT = 'C:/prana/storage'
```

Reason:
Storage layout assumptions leak into runtime core.

---

## Embedded Storage Semantics

Forbidden:

```ts
if (sqliteLocked)
```

inside orchestration logic.

Reason:
Vendor semantics contaminate runtime behavior.

---

## Storage-Specific Retry Logic

Forbidden:

```ts
retrySqliteTransaction()
```

inside runtime services.

Reason:
Infrastructure behavior belongs to adapters.

---

## Runtime-Owned Schema Assumptions

Forbidden:

```ts
SELECT * FROM runtime_memory
```

inside orchestration services.

Reason:
Runtime should not encode storage structure.

---

# Detection Heuristics

Flag the following inside runtime/core layers:

---

## Database Imports

Detect:

```ts
better-sqlite3
sqlite
postgres
mysql
mongoose
typeorm
drizzle
```

inside:

* orchestration
* runtime
* coordination services

---

## Filesystem Imports

Detect:

```ts
fs
path
os
```

where used for persistent ownership.

---

## Hardcoded Storage Paths

Detect:

* `/data`
* `/vault`
* drive letters
* storage roots

---

## Vendor-Specific Error Handling

Detect:

```ts
SQLITE_BUSY
SQLITE_LOCKED
ENOENT
```

inside core runtime logic.

---

## Embedded Query Logic

Detect:

* SQL queries
* storage engine syntax
* ORM entity ownership

inside orchestration layers.

---

# Severity Levels

## P0 — Critical

Core runtime directly depends on storage implementation.

Examples:

* direct sqlite usage
* direct filesystem ownership
* embedded persistence logic

Must fix before release.

---

## P1 — High

Storage semantics leak into runtime behavior.

Examples:

* vendor retry assumptions
* schema assumptions
* path assumptions

Must migrate.

---

## P2 — Transitional

Legacy adapter leakage with migration plan.

Allowed temporarily only.

---

## P3 — Informational

Infrastructure adapters correctly isolated.

No action required.

---

# Refactoring Guidance

## Replace Direct Storage Imports With Capabilities

BAD:

```ts
import Database from 'better-sqlite3'
```

GOOD:

```ts
interface PersistenceCapability
```

---

## Move Infrastructure Into Adapters

BAD:

```ts
runtimeService.saveToDisk()
```

GOOD:

```text
/adapters/filesystem/
```

---

## Externalize Storage Topology

BAD:

```ts
const vaultPath = '/vault'
```

GOOD:

```ts
storageProvider.resolvePath()
```

---

## Remove Vendor Logic From Runtime

BAD:

```ts
if (sqliteLocked)
```

GOOD:

```ts
storageCapability.handleFailure()
```

---

# Runtime Impact

Violating storage neutrality causes:

* vendor lock-in
* infrastructure coupling
* portability failure
* testing complexity
* replay inconsistency
* adapter contamination
* runtime rigidity

The runtime becomes a platform implementation
instead of a reusable orchestration kernel.

---

# Migration Notes

## Transitional Storage Coupling Must Include

```ts
/**
 * @deprecated-storage-coupling
 * Vendor:
 * Removal target:
 * Replacement capability:
 */
```

---

## Migration Strategy

1. Extract interface
2. Move implementation to adapter
3. Inject capability
4. Remove vendor imports from runtime core

---

# Validation Requirements

A runtime service is compliant only if:

* storage implementation is abstracted
* persistence flows through capabilities
* no vendor assumptions exist
* no filesystem ownership exists
* no topology assumptions exist
* infrastructure remains replaceable

---

# Compliance Goal

Prana must behave as:

* a storage-agnostic orchestration runtime
* a capability-driven execution kernel
* an infrastructure-neutral coordination layer

NOT:

* a SQLite runtime
* a filesystem platform
* a vault implementation
* a persistence engine

```
```
