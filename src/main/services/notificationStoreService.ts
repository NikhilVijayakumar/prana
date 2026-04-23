import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot, mkdirSafe } from './governanceRepoService';

const DB_FILE_NAME = 'notifications.sqlite';

export type NotificationPriority = 'INFO' | 'WARN' | 'CRITICAL' | 'ACTION';

export interface Notification {
  notificationId: string;
  appId: string;
  eventId?: string;
  eventType: string;
  priority: NotificationPriority;
  source: string;
  message: string;
  payload?: Record<string, unknown>;
  actionRoute?: string;
  createdAt: string;
  expiresAt?: string;
  isRead: boolean;
}

export interface NotificationHistoryRecord {
  historyId: string;
  notificationId: string;
  appId: string;
  action: 'VIEWED' | 'DISMISSED' | 'ACTIONED';
  actedAt: string;
}

export interface NotificationListFilters {
  priority?: NotificationPriority[];
  source?: string;
  startTime?: string;
  endTime?: string;
  unreadOnly?: boolean;
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const nowIso = (): string => new Date().toISOString();
const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);

const resolveSqlJsAsset = (fileName: string): string => {
  const candidates = [
    join(process.cwd(), 'node_modules', 'sql.js', 'dist', fileName),
    join(process.resourcesPath ?? '', 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', fileName),
    join(process.resourcesPath ?? '', 'node_modules', 'sql.js', 'dist', fileName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return fileName;
};

const getSqlRuntime = async (): Promise<SqlJsStatic> => {
  if (!sqlRuntimePromise) {
    sqlRuntimePromise = initSqlJs({ locateFile: (fileName) => resolveSqlJsAsset(fileName) });
  }

  return sqlRuntimePromise;
};

const persistDatabase = async (database: Database): Promise<void> => {
  const bytes = database.export();
  await mkdirSafe(getAppDataRoot());
  await writeFile(getDbPath(), Buffer.from(bytes));
};

const initializeDatabase = async (): Promise<Database> => {
  const sqlRuntime = await getSqlRuntime();
  await mkdirSafe(getAppDataRoot());

  const database = existsSync(getDbPath())
    ? new sqlRuntime.Database(new Uint8Array(await readFile(getDbPath())))
    : new sqlRuntime.Database();

  // Create notifications table
  database.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL,
      event_id TEXT,
      event_type TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('INFO', 'WARN', 'CRITICAL', 'ACTION')),
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json TEXT,
      action_route TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_index INTEGER NOT NULL DEFAULT (CAST(julianday('now') * 86400000 AS INTEGER))
    );
  `);

  // Create history table
  database.run(`
    CREATE TABLE IF NOT EXISTS notification_history (
      history_id TEXT PRIMARY KEY,
      notification_id TEXT NOT NULL,
      app_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('VIEWED', 'DISMISSED', 'ACTIONED')),
      acted_at TEXT NOT NULL,
      FOREIGN KEY (notification_id) REFERENCES notifications(notification_id)
    );
  `);

  // Create indexes for common queries
  database.run(`
    CREATE INDEX IF NOT EXISTS idx_notifications_app_id ON notifications(app_id);
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
  `);

  await persistDatabase(database);
  return database;
};

const getDatabase = async (): Promise<Database> => {
  if (!dbPromise) {
    dbPromise = initializeDatabase();
  }

  return dbPromise;
};

const queueWrite = async (operation: () => Promise<void>): Promise<void> => {
  writeQueue = writeQueue.then(operation, operation);
  await writeQueue;
};

export const notificationStoreService = {
  /**
   * Create a notification
   */
  async create(notification: Notification): Promise<Notification> {
    await queueWrite(async () => {
      const database = await getDatabase();
      const stmt = database.prepare(`
        INSERT INTO notifications 
        (notification_id, app_id, event_id, event_type, priority, source, message, payload_json, action_route, created_at, expires_at, is_read)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        notification.notificationId,
        notification.appId,
        notification.eventId || null,
        notification.eventType,
        notification.priority,
        notification.source,
        notification.message,
        notification.payload ? JSON.stringify(notification.payload) : null,
        notification.actionRoute || null,
        notification.createdAt,
        notification.expiresAt || null,
        notification.isRead ? 1 : 0,
      ]);

      stmt.free();
      await persistDatabase(database);
    });

    return notification;
  },

  /**
   * Get a single notification by ID
   */
  async get(appId: string, notificationId: string): Promise<Notification | null> {
    const database = await getDatabase();
    const stmt = database.prepare(
      `SELECT * FROM notifications WHERE notification_id = ? AND app_id = ?`,
    );
    stmt.bind([notificationId, appId]);

    if (!stmt.step()) {
      stmt.free();
      return null;
    }

    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();

    return {
      notificationId: row.notification_id as string,
      appId: row.app_id as string,
      eventId: row.event_id as string | undefined,
      eventType: row.event_type as string,
      priority: row.priority as NotificationPriority,
      source: row.source as string,
      message: row.message as string,
      payload: row.payload_json ? JSON.parse(row.payload_json as string) : undefined,
      actionRoute: row.action_route as string | undefined,
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string | undefined,
      isRead: (row.is_read as number) === 1,
    };
  },

  /**
   * List notifications with optional filters
   */
  async list(
    appId: string,
    filters: NotificationListFilters = {},
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ items: Notification[]; total: number }> {
    const database = await getDatabase();

    // Build WHERE clause
    const whereClauses = ['app_id = ?'];
    const params: (string | number | null)[] = [appId];

    if (filters.unreadOnly) {
      whereClauses.push('is_read = 0');
    }

    if (filters.priority && filters.priority.length > 0) {
      const placeholders = filters.priority.map(() => '?').join(',');
      whereClauses.push(`priority IN (${placeholders})`);
      params.push(...filters.priority);
    }

    if (filters.source) {
      whereClauses.push('source = ?');
      params.push(filters.source);
    }

    if (filters.startTime) {
      whereClauses.push('created_at >= ?');
      params.push(filters.startTime);
    }

    if (filters.endTime) {
      whereClauses.push('created_at <= ?');
      params.push(filters.endTime);
    }

    const whereClause = whereClauses.join(' AND ');

    // Get total count
    const countStmt = database.prepare(`SELECT COUNT(*) as cnt FROM notifications WHERE ${whereClause}`);
    countStmt.bind(params);
    countStmt.step();
    const countRow = countStmt.getAsObject() as { cnt: unknown };
    countStmt.free();
    const total = typeof countRow.cnt === 'number' ? countRow.cnt : 0;

    // Get paginated results
    const listStmt = database.prepare(
      `SELECT * FROM notifications WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    );
    listStmt.bind([...params, limit, offset]);

    const items: Notification[] = [];
    while (listStmt.step()) {
      const row = listStmt.getAsObject() as Record<string, unknown>;
      items.push({
        notificationId: row.notification_id as string,
        appId: row.app_id as string,
        eventId: row.event_id as string | undefined,
        eventType: row.event_type as string,
        priority: row.priority as NotificationPriority,
        source: row.source as string,
        message: row.message as string,
        payload: row.payload_json ? JSON.parse(row.payload_json as string) : undefined,
        actionRoute: row.action_route as string | undefined,
        createdAt: row.created_at as string,
        expiresAt: row.expires_at as string | undefined,
        isRead: (row.is_read as number) === 1,
      });
    }
    listStmt.free();

    return { items, total };
  },

  /**
   * Mark notifications as read
   */
  async markRead(appId: string, notificationIds: string[]): Promise<number> {
    if (notificationIds.length === 0) {
      return 0;
    }

    let updatedCount = 0;

    await queueWrite(async () => {
      const database = await getDatabase();
      const placeholders = notificationIds.map(() => '?').join(',');
      const stmt = database.prepare(
        `UPDATE notifications SET is_read = 1 WHERE app_id = ? AND notification_id IN (${placeholders})`,
      );

      stmt.run([appId, ...notificationIds]);
      updatedCount = database.getRowsModified();
      stmt.free();
      await persistDatabase(database);
    });

    return updatedCount;
  },

  /**
   * Mark notifications as dismissed
   */
  async markDismissed(appId: string, notificationIds: string[]): Promise<number> {
    if (notificationIds.length === 0) {
      return 0;
    }

    let deletedCount = 0;

    await queueWrite(async () => {
      const database = await getDatabase();
      const placeholders = notificationIds.map(() => '?').join(',');
      const stmt = database.prepare(
        `DELETE FROM notifications WHERE app_id = ? AND notification_id IN (${placeholders})`,
      );

      stmt.run([appId, ...notificationIds]);
      deletedCount = database.getRowsModified();
      stmt.free();
      await persistDatabase(database);
    });

    return deletedCount;
  },

  /**
   * Record a user action in history
   */
  async recordAction(
    appId: string,
    notificationId: string,
    action: 'VIEWED' | 'DISMISSED' | 'ACTIONED',
  ): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();
      const stmt = database.prepare(
        `INSERT INTO notification_history (history_id, notification_id, app_id, action, acted_at)
         VALUES (?, ?, ?, ?, ?)`,
      );

      const historyId = `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      stmt.run([historyId, notificationId, appId, action, nowIso()]);
      stmt.free();
      await persistDatabase(database);
    });
  },

  /**
   * Cleanup expired notifications based on retention rules
   */
  async cleanup(appId: string, olderThanDays: number = 7): Promise<number> {
    let deletedCount = 0;

    await queueWrite(async () => {
      const database = await getDatabase();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffIso = cutoffDate.toISOString();

      // Delete INFO and ephemeral notifications older than cutoff
      const stmtInfo = database.prepare(
        `DELETE FROM notifications WHERE app_id = ? AND priority = 'INFO' AND created_at < ?`,
      );
      stmtInfo.run([appId, cutoffIso]);
      deletedCount += database.getRowsModified();
      stmtInfo.free();

      // Delete notifications that have expired
      const stmtExpired = database.prepare(
        `DELETE FROM notifications WHERE app_id = ? AND expires_at IS NOT NULL AND expires_at < ?`,
      );
      stmtExpired.run([appId, nowIso()]);
      deletedCount += database.getRowsModified();
      stmtExpired.free();

      await persistDatabase(database);
    });

    return deletedCount;
  },

  /**
   * Get unread count
   */
  async getUnreadCount(appId: string): Promise<number> {
    const database = await getDatabase();
    const stmt = database.prepare(`SELECT COUNT(*) as cnt FROM notifications WHERE app_id = ? AND is_read = 0`);
    stmt.bind([appId]);
    stmt.step();
    const row = stmt.getAsObject() as { cnt: unknown };
    stmt.free();
    return typeof row.cnt === 'number' ? row.cnt : 0;
  },

  /**
   * Get telemetry
   */
  async getTelemetry(appId: string): Promise<Record<string, number>> {
    const database = await getDatabase();

    const queries = {
      total: `SELECT COUNT(*) as cnt FROM notifications WHERE app_id = ?`,
      unread: `SELECT COUNT(*) as cnt FROM notifications WHERE app_id = ? AND is_read = 0`,
      critical: `SELECT COUNT(*) as cnt FROM notifications WHERE app_id = ? AND priority = 'CRITICAL'`,
      warn: `SELECT COUNT(*) as cnt FROM notifications WHERE app_id = ? AND priority = 'WARN'`,
      info: `SELECT COUNT(*) as cnt FROM notifications WHERE app_id = ? AND priority = 'INFO'`,
    };

    const telemetry: Record<string, number> = {};

    for (const [key, query] of Object.entries(queries)) {
      const stmt = database.prepare(query);
      stmt.bind([appId]);
      stmt.step();
      const row = stmt.getAsObject() as { cnt: unknown };
      stmt.free();
      telemetry[key] = typeof row.cnt === 'number' ? row.cnt : 0;
    }

    return telemetry;
  },

  /**
   * Delete all notifications for an app (testing/reset only)
   */
  async deleteAllForApp(appId: string): Promise<number> {
    let deletedCount = 0;

    await queueWrite(async () => {
      const database = await getDatabase();
      const stmt = database.prepare(`DELETE FROM notifications WHERE app_id = ?`);
      stmt.run([appId]);
      deletedCount = database.getRowsModified();
      stmt.free();
      await persistDatabase(database);
    });

    return deletedCount;
  },
};
