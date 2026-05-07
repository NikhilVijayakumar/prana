import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { getSqliteRoot } from './governanceRepoService';

export const sqliteCacheService = {
  /**
   * Initializes a SQLite cache with a custom Drizzle schema.
   * Creates a new connection each time (no caching).
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
    const sqlite = new Database(dbPath);
    
    // Enable WAL mode for better concurrency and performance
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = NORMAL');
    sqlite.pragma('foreign_keys = ON');

    return drizzle(sqlite, { schema });
  },

  /**
   * Executes a raw SQL string (which can contain multiple statements) directly on the underlying SQLite connection.
   * Creates a temporary connection to execute the SQL.
   * 
   * @param cacheName - The filename for the cache
   * @param sqlString - The raw SQL string to execute
   */
  executeRawSql(cacheName: string, sqlString: string): void {
    const rootPath = join(getSqliteRoot(), 'caches');
    const dbPath = join(rootPath, cacheName);
    
    if (!existsSync(dbPath)) {
      throw new Error(`Cache ${cacheName} does not exist. Call initCache first.`);
    }

    const sqlite = new Database(dbPath);
    try {
      sqlite.exec(sqlString);
    } finally {
      sqlite.close();
    }
  },

  /**
   * Closes a specific cache database connection.
   * Note: Since connections are created on-demand, this is a no-op.
   * @param cacheName - The filename for the cache
   */
  closeCache(_cacheName: string): void {
    // No-op: connections are created on-demand and closed after use
  },

  /**
   * Closes all active cache database connections.
   * Note: Since connections are created on-demand, this is a no-op.
   */
  closeAll(): void {
    // No-op: connections are created on-demand and closed after use
  }
};
