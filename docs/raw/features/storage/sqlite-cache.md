# 🧱 SQLite Cache — Stateless ORM Caching Layer

**Version:** 2.0.0  
**Status:** Stable / Core  
**Engine:** Drizzle ORM + `better-sqlite3`

## 1. Tactical Purpose
The **SQLite Cache** in Prana is a highly concurrent, general-purpose, **stateless** operational caching layer. 

Unlike traditional stateful frameworks, Prana explicitly avoids defining core tables or enforcing specific database schemas. Instead, Prana provides the optimized plumbing (connection pooling, WAL-mode concurrency, filesystem routing), and delegates complete control over the schemas and data structures to the consuming applications (`dhi`, `chakra`, `rita`).

## 2. Core Principles
1. **Stateless Infrastructure:** Prana contains zero built-in tables for caching (no internal tracking, no `app_registry`). State is entirely owned by the apps.
2. **Schema Delegation:** Applications inject their own Drizzle ORM schemas into Prana at runtime.
3. **High Concurrency:** Enabled via SQLite's Write-Ahead Logging (`WAL`) mode, allowing multiple applications to read and write to a shared cache concurrently without locking.
4. **No Encryption:** Caches are optimized for speed and shared access; they are stored unencrypted in the local `.prana/sqlite/caches` directory (Note: Runtime Config may still use encryption separately, but the Cache layer does not).

## 3. Storage Model & Initialization
Applications share or isolate data based on the `cacheName` they provide during initialization.

### 3.1 Initializing a Cache
Applications use `sqliteCacheService.initCache` to receive a fully typed `drizzle-orm` database instance:

```typescript
import { sqliteCacheService } from 'prana/main/services/sqliteCacheService';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// 1. App defines its specific state/schema
const dhiData = sqliteTable('dhi_data', { id: integer('id'), value: text('value') });

// 2. App connects to the unified cache
const db = sqliteCacheService.initCache('chakra-cache.sqlite', { dhiData });
```

## 4. DDL and Migrations
Because Prana is stateless, it does not manage database migrations. Apps are responsible for ensuring their tables exist before performing CRUD operations.

To reduce boilerplate, Prana provides an `executeRawSql` helper to bootstrap schemas:

```typescript
// App bootstraps its required tables
sqliteCacheService.executeRawSql('chakra-cache.sqlite', `
  CREATE TABLE IF NOT EXISTS dhi_data (
    id INTEGER PRIMARY KEY,
    value TEXT
  );
`);
```

## 5. Single Unified Cache Database
Prana recommends using a **single, unified cache file** (e.g., `'chakra-cache.sqlite'`) for all operations across all applications. 

- **No Separate Databases:** Applications do not create separate databases for private data. Instead, both shared data (like synchronized Google Sheets) and app-specific private state are stored in different tables within this same unified database.
- **App Responsibility:** The logic for fetching and parsing Google Sheets is managed entirely by the apps, which then dump that data into tables within the shared cache.
- **Safe Concurrency:** Because of SQLite's WAL mode, multiple apps can simultaneously access this single database to read shared tables or write to their own private tables without conflicts.

## 6. Separation of Concerns
| Component | Responsibility |
| --- | --- |
| **Prana** | File path resolution (`getSqliteRoot`), `better-sqlite3` instance instantiation, connection management, WAL optimization. |
| **Consumer App** | Defining Drizzle tables, executing `CREATE TABLE` scripts, executing queries, handling domain logic. |
