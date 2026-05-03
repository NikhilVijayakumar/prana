import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { getSqliteRoot } from './governanceRepoService';

const openCaches = new Map<string, Database.Database>();

export const sqliteCacheService = {
  /**
   * Initializes a stateless SQLite cache with a custom Drizzle schema.
   * If the database is already open, returns the existing connection.
   *
   * @param cacheName - The filename for the cache (e.g. 'rita-cache.sqlite')
   * @param schema - The Drizzle schema object defined by the consumer app
   * @returns A Drizzle ORM database instance mapped to the provided schema
   */
  initCache<TSchema extends Record<string, unknown>>(
    cacheName: string,
    schema: TSchema
  ): BetterSQLite3Database<TSchema> {
    const rootPath = join(getSqliteRoot(), 'caches');
    
    if (!existsSync(rootPath)) {
      mkdirSync(rootPath, { recursive: true });
    }

    const dbPath = join(rootPath, cacheName);

    if (openCaches.has(dbPath)) {
      const existingDb = openCaches.get(dbPath)!;
      return drizzle(existingDb, { schema });
    }

    const sqlite = new Database(dbPath);
    
    // Enable WAL mode for better concurrency and performance
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = NORMAL');
    sqlite.pragma('foreign_keys = ON');

    openCaches.set(dbPath, sqlite);

    return drizzle(sqlite, { schema });
  },

  /**
   * Executes a raw SQL string (which can contain multiple statements) directly on the underlying SQLite connection.
   * This is a helper to reduce boilerplate for apps that need to quickly execute 'CREATE TABLE IF NOT EXISTS'
   * scripts on initialization without manually managing the Drizzle SQL objects.
   * 
   * @param cacheName - The filename for the cache
   * @param sqlString - The raw SQL string to execute
   */
  executeRawSql(cacheName: string, sqlString: string): void {
    const rootPath = join(getSqliteRoot(), 'caches');
    const dbPath = join(rootPath, cacheName);
    
    const db = openCaches.get(dbPath);
    if (!db) {
      throw new Error(`Cache ${cacheName} is not initialized. Call initCache first.`);
    }
    
    // Use the native better-sqlite3 exec() which supports multiple statements
    db.exec(sqlString);
  },

  /**
   * Closes a specific cache database connection if it's open.
   * @param cacheName - The filename for the cache
   */
  closeCache(cacheName: string): void {
    const rootPath = join(getSqliteRoot(), 'caches');
    const dbPath = join(rootPath, cacheName);
    
    const db = openCaches.get(dbPath);
    if (db) {
      db.close();
      openCaches.delete(dbPath);
    }
  },

  /**
   * Closes all active cache database connections.
   */
  closeAll(): void {
    for (const [path, db] of openCaches.entries()) {
      db.close();
      openCaches.delete(path);
    }
  }
};
