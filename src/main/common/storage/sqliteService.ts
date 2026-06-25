import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface SqliteServiceOptions {
  dbPath: string;
}

export class SqliteService {
  private db: Database.Database | null = null;
  private dbPath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: SqliteServiceOptions) {
    this.dbPath = options.dbPath;
  }

  async initialize(): Promise<Database.Database> {
    if (this.db) {
      return this.db;
    }

    await mkdir(join(this.dbPath, '..'), { recursive: true });

    this.db = existsSync(this.dbPath)
      ? new Database(this.dbPath, { fileMustExist: true })
      : new Database(this.dbPath);

    return this.db;
  }

  async getDatabase(): Promise<Database.Database> {
    if (!this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  async queueWrite(operation: () => Promise<void>): Promise<void> {
    this.writeQueue = this.writeQueue.then(operation, operation);
    await this.writeQueue;
  }

  async close(): Promise<void> {
    await this.writeQueue;
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }
}

export const createSqliteService = (options: SqliteServiceOptions): SqliteService => {
  return new SqliteService(options);
};
