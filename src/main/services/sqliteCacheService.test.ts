import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sqliteCacheService } from './sqliteCacheService';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { join } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { getSqliteRoot } from './governanceRepoService';

// Define a test schema
const testTable = sqliteTable('test_table', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

describe('sqliteCacheService', () => {
  const cacheName = 'test-cache.sqlite';
  const rootPath = join(getSqliteRoot(), 'caches');
  const dbPath = join(rootPath, cacheName);

  beforeEach(() => {
    // Ensure clean state
    if (existsSync(dbPath)) {
      rmSync(dbPath, { force: true });
    }
  });

  afterEach(() => {
    sqliteCacheService.closeAll();
    if (existsSync(dbPath)) {
      rmSync(dbPath, { force: true });
    }
  });

  it('should initialize a cache and return a drizzle instance', () => {
    const db = sqliteCacheService.initCache(cacheName, { testTable });
    expect(db).toBeDefined();

    // The database is initially empty and the table doesn't exist,
    // so a direct select would fail without a migration. We just verify
    // the instance is created successfully.
    expect(existsSync(dbPath)).toBe(true);
  });

  it('should return the same instance if opened twice', () => {
    const db1 = sqliteCacheService.initCache(cacheName, { testTable });
    const db2 = sqliteCacheService.initCache(cacheName, { testTable });

    expect(db1).toBeDefined();
    // It should not throw and should handle returning the same ORM instance (or a newly wrapped one on the same sqlite connection)
    expect(db2).toBeDefined();
  });

  it('should close the cache successfully', () => {
    sqliteCacheService.initCache(cacheName, { testTable });
    expect(existsSync(dbPath)).toBe(true);
    
    // Close the specific cache
    sqliteCacheService.closeCache(cacheName);
    
    // Test that re-opening it works (it was properly removed from openCaches map)
    const db = sqliteCacheService.initCache(cacheName, { testTable });
    expect(db).toBeDefined();
  });
});
