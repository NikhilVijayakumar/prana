import type { Database } from 'sql.js';
import type { GoogleBridgeCredentials } from './googleBridgeService';
import { sqliteConfigStoreService } from './sqliteConfigStoreService';

// ---------------------------------------------------------------------------
// Column / schema types
// ---------------------------------------------------------------------------

export type SqliteColumnType = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';

export interface SheetColumnMapping {
  /** Header name in the Google Sheet tab (used to match columns by position). */
  sheetHeader: string;
  /** Column name in the SQLite table. */
  sqliteColumn: string;
  /** SQLite storage type. */
  type: SqliteColumnType;
  /** Whether this column is part of the primary key. */
  primaryKey?: boolean;
  /** Defaults to true (nullable). Pass false for NOT NULL. */
  nullable?: boolean;
}

export interface SqliteForeignKey {
  /** Local column in this table. */
  column: string;
  /** Existing SQLite table to reference. */
  referencesTable: string;
  /** Column in the referenced table. */
  referencesColumn: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

// ---------------------------------------------------------------------------
// Tab → table mapping
// ---------------------------------------------------------------------------

export interface SheetTabMapping {
  /** Tab name inside the Google Sheets workbook (e.g. "Employees"). */
  sheetTab: string;
  /** Target SQLite table name (e.g. "employees"). */
  sqliteTable: string;
  /** Column-level mapping between sheet headers and SQLite columns. */
  columns: SheetColumnMapping[];
  /**
   * Optional FK constraints that reference existing tables in the shared
   * SQLite database.  Google Sheets has no concept of FK — these are
   * declared only for the SQLite side.
   */
  foreignKeys?: SqliteForeignKey[];
  /**
   * How to handle existing rows during a pull:
   *  - "replace" (default): truncate the table then insert all rows.
   *  - "upsert": INSERT OR REPLACE (requires at least one primaryKey column).
   */
  syncMode?: 'replace' | 'upsert';
}

// ---------------------------------------------------------------------------
// Request / result types
// ---------------------------------------------------------------------------

export interface GoogleSheetsSyncRequest {
  /** The Google Sheets workbook ID (provided by the client app, not prana). */
  spreadsheetId: string;
  /** OAuth credentials (provided by the client app). */
  credentials: GoogleBridgeCredentials;
  /** One entry per tab/table pair to sync. */
  mappings: SheetTabMapping[];
}

export interface SyncTabResult {
  tab: string;
  table: string;
  rowsAffected: number;
  status: 'OK' | 'FAILED';
  error?: string;
}

export interface SyncResult {
  direction: 'pull' | 'push';
  syncedAt: string;
  tabs: SyncTabResult[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const refreshToken = async (credentials: GoogleBridgeCredentials): Promise<string> => {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`[SheetsCache] Token refresh failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { access_token?: string };
  if (!data.access_token) {
    throw new Error('[SheetsCache] Token refresh returned no access_token.');
  }

  return data.access_token;
};

const fetchTabValues = async (
  accessToken: string,
  spreadsheetId: string,
  tab: string,
): Promise<string[][]> => {
  const range = encodeURIComponent(`${tab}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (!res.ok) {
    throw new Error(`[SheetsCache] Failed to read tab "${tab}": ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { values?: string[][] };
  return data.values ?? [];
};

const clearAndWriteTab = async (
  accessToken: string,
  spreadsheetId: string,
  tab: string,
  rows: string[][],
): Promise<void> => {
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tab)}:clear`;
  const clearRes = await fetch(clearUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
  });

  if (!clearRes.ok) {
    throw new Error(`[SheetsCache] Failed to clear tab "${tab}": ${clearRes.status}`);
  }

  if (rows.length === 0) return;

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tab)}?valueInputOption=RAW`;
  const updateRes = await fetch(updateUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: tab, majorDimension: 'ROWS', values: rows }),
  });

  if (!updateRes.ok) {
    throw new Error(`[SheetsCache] Failed to write tab "${tab}": ${updateRes.status}`);
  }
};

const buildCreateTableSql = (mapping: SheetTabMapping): string => {
  const pkColumns = mapping.columns
    .filter((c) => c.primaryKey)
    .map((c) => c.sqliteColumn);

  const columnDefs = mapping.columns.map((col) => {
    const notNull = col.nullable === false ? ' NOT NULL' : '';
    return `  ${col.sqliteColumn} ${col.type}${notNull}`;
  });

  const constraints: string[] = [];

  if (pkColumns.length > 0) {
    constraints.push(`  PRIMARY KEY (${pkColumns.join(', ')})`);
  }

  for (const fk of mapping.foreignKeys ?? []) {
    const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
    constraints.push(
      `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencesTable}(${fk.referencesColumn})${onDelete}`,
    );
  }

  const allDefs = [...columnDefs, ...constraints].join(',\n');
  return `CREATE TABLE IF NOT EXISTS ${mapping.sqliteTable} (\n${allDefs}\n);`;
};

const insertRows = (
  db: Database,
  mapping: SheetTabMapping,
  rows: Record<string, string>[],
): number => {
  if (rows.length === 0) return 0;

  const cols = mapping.columns.map((c) => c.sqliteColumn);
  const placeholders = cols.map(() => '?').join(', ');
  const verb = mapping.syncMode === 'upsert' ? 'INSERT OR REPLACE' : 'INSERT';
  const sql = `${verb} INTO ${mapping.sqliteTable} (${cols.join(', ')}) VALUES (${placeholders})`;
  const stmt = db.prepare(sql);

  let count = 0;
  for (const row of rows) {
    const values = mapping.columns.map((col) => {
      const raw = row[col.sheetHeader] ?? '';
      if (col.type === 'INTEGER') return raw === '' ? null : parseInt(raw, 10);
      if (col.type === 'REAL') return raw === '' ? null : parseFloat(raw);
      return raw;
    });
    stmt.run(values as any[]);
    count++;
  }

  stmt.free();
  return count;
};

const readTableRows = (
  db: Database,
  mapping: SheetTabMapping,
): Record<string, string>[] => {
  const cols = mapping.columns.map((c) => c.sqliteColumn);
  const stmt = db.prepare(`SELECT ${cols.join(', ')} FROM ${mapping.sqliteTable}`);
  const results: Record<string, string>[] = [];

  while (stmt.step()) {
    const obj = stmt.getAsObject() as Record<string, unknown>;
    const row: Record<string, string> = {};
    for (const col of cols) {
      row[col] = obj[col] != null ? String(obj[col]) : '';
    }
    results.push(row);
  }

  stmt.free();
  return results;
};

// ---------------------------------------------------------------------------
// Public service (stateless — all config provided by caller)
// ---------------------------------------------------------------------------

/**
 * Ensures all tables defined in the request mappings exist in the shared
 * SQLite cache.  Safe to call repeatedly (uses CREATE TABLE IF NOT EXISTS).
 * FK references are applied only for the SQLite side — Google Sheets has no
 * concept of relations.
 */
const ensureSchema = async (request: GoogleSheetsSyncRequest): Promise<void> => {
  const db = await sqliteConfigStoreService.getDatabase();
  for (const mapping of request.mappings) {
    db.run(buildCreateTableSql(mapping));
  }
};

/**
 * Pulls data from Google Sheets into the SQLite cache.
 * Each tab in the mapping is fetched and written to its target table.
 * The caller controls which tabs to sync via `tabNames` (omit to sync all).
 */
const pullFromSheets = async (
  request: GoogleSheetsSyncRequest,
  tabNames?: string[],
): Promise<SyncResult> => {
  const syncedAt = new Date().toISOString();
  const accessToken = await refreshToken(request.credentials);
  const db = await sqliteConfigStoreService.getDatabase();
  const results: SyncTabResult[] = [];

  const targets = tabNames
    ? request.mappings.filter((m) => tabNames.includes(m.sheetTab))
    : request.mappings;

  for (const mapping of targets) {
    try {
      const rawRows = await fetchTabValues(accessToken, request.spreadsheetId, mapping.sheetTab);
      if (rawRows.length < 1) {
        results.push({ tab: mapping.sheetTab, table: mapping.sqliteTable, rowsAffected: 0, status: 'OK' });
        continue;
      }

      const headers = rawRows[0];
      const dataRows = rawRows.slice(1).map((row) => {
        const record: Record<string, string> = {};
        headers.forEach((h, i) => { record[h] = row[i] ?? ''; });
        return record;
      });

      if (mapping.syncMode !== 'upsert') {
        db.run(`DELETE FROM ${mapping.sqliteTable}`);
      }

      const count = insertRows(db, mapping, dataRows);
      results.push({ tab: mapping.sheetTab, table: mapping.sqliteTable, rowsAffected: count, status: 'OK' });
    } catch (err) {
      results.push({
        tab: mapping.sheetTab,
        table: mapping.sqliteTable,
        rowsAffected: 0,
        status: 'FAILED',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { direction: 'pull', syncedAt, tabs: results };
};

/**
 * Pushes data from the SQLite cache to Google Sheets.
 * Each mapped table is read and written to its target tab (clears first).
 * The caller controls which tabs to push via `tabNames` (omit for all).
 */
const pushToSheets = async (
  request: GoogleSheetsSyncRequest,
  tabNames?: string[],
): Promise<SyncResult> => {
  const syncedAt = new Date().toISOString();
  const accessToken = await refreshToken(request.credentials);
  const db = await sqliteConfigStoreService.getDatabase();
  const results: SyncTabResult[] = [];

  const targets = tabNames
    ? request.mappings.filter((m) => tabNames.includes(m.sheetTab))
    : request.mappings;

  for (const mapping of targets) {
    try {
      const dbRows = readTableRows(db, mapping);
      const headers = mapping.columns.map((c) => c.sheetHeader);
      const sheetRows: string[][] = [
        headers,
        ...dbRows.map((row) => mapping.columns.map((col) => row[col.sqliteColumn] ?? '')),
      ];

      await clearAndWriteTab(accessToken, request.spreadsheetId, mapping.sheetTab, sheetRows);
      results.push({
        tab: mapping.sheetTab,
        table: mapping.sqliteTable,
        rowsAffected: dbRows.length,
        status: 'OK',
      });
    } catch (err) {
      results.push({
        tab: mapping.sheetTab,
        table: mapping.sqliteTable,
        rowsAffected: 0,
        status: 'FAILED',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { direction: 'push', syncedAt, tabs: results };
};

export const googleSheetsCacheService = {
  /** Create tables (with optional FK constraints) for all mappings. */
  ensureSchema,
  /** Google Sheets → SQLite cache. Caller decides which tabs and when. */
  pullFromSheets,
  /** SQLite cache → Google Sheets. Caller decides which tabs and when. */
  pushToSheets,
};
