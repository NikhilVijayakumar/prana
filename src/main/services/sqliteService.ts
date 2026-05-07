import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { encryptSqliteBuffer, decryptSqliteBuffer } from './sqliteCryptoUtil';

const DB_MODE_READONLY = 1;
const DB_MODE_READWRITE = 2;
const DB_MODE_CREATE = 4;

export interface SqliteServiceOptions {
  dbPath: string;
  encrypted?: boolean;
}

export class SqliteService {
  private db: Database | null = null;
  private dbPath: string;
  private encrypted: boolean;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: SqliteServiceOptions) {
    this.dbPath = options.dbPath;
    this.encrypted = options.encrypted ?? false;
  }

  async initialize(): Promise<Database> {
    if (this.db) {
      return this.db;
    }

    await mkdir(join(this.dbPath, '..'), { recursive: true });

    if (existsSync(this.dbPath)) {
      if (this.encrypted) {
        const encryptedBuffer = await readFile(this.dbPath);
        const decryptedBuffer = await decryptSqliteBuffer(encryptedBuffer);
        const tempPath = `${this.dbPath}.decrypted`;
        await writeFile(tempPath, decryptedBuffer);
        this.db = new Database(tempPath, { fileMustExist: true });
      } else {
        this.db = new Database(this.dbPath, { fileMustExist: true });
      }
    } else {
      this.db = new Database(this.dbPath);
      await this.persist();
    }

    return this.db;
  }

  async getDatabase(): Promise<Database> {
    if (!this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  async persist(): Promise<void> {
    if (!this.db) {
      return;
    }

    this.db.close();
    if (this.encrypted) {
      const buffer = await readFile(this.dbPath);
      const encryptedBuffer = await encryptSqliteBuffer(buffer);
      await writeFile(this.dbPath, encryptedBuffer);
    }
    this.db = new Database(this.dbPath);
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
