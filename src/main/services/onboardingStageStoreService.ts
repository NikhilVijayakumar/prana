import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot } from './governanceRepoService';

const DB_FILE_NAME = 'onboarding-stage.sqlite';
const META_CURRENT_STEP = 'current_step';
const META_MODEL_ACCESS = 'model_access';

export interface OnboardingPhaseStageRecord {
  stepId: string;
  status: 'PENDING' | 'DRAFT' | 'APPROVED';
  contextByKey: Record<string, string>;
  requiresReverification: boolean;
  updatedAt: string;
}

export interface OnboardingStageSnapshot {
  phases: Record<string, OnboardingPhaseStageRecord>;
  currentStep: number | null;
  modelAccess: Record<string, unknown> | null;
}

export interface SaveOnboardingStagePayload {
  phases: Record<string, {
    status: 'PENDING' | 'DRAFT' | 'APPROVED';
    contextByKey: Record<string, string>;
    requiresReverification: boolean;
  }>;
  currentStep: number;
  modelAccess?: Record<string, unknown>;
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const getDbPath = (): string => {
  return join(getAppDataRoot(), DB_FILE_NAME);
};

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
    sqlRuntimePromise = initSqlJs({
      locateFile: (fileName) => resolveSqlJsAsset(fileName),
    });
  }

  return sqlRuntimePromise;
};

const persistDatabase = async (database: Database): Promise<void> => {
  const bytes = database.export();
  await mkdir(getAppDataRoot(), { recursive: true });
  await writeFile(getDbPath(), Buffer.from(bytes));
};

const initializeDatabase = async (): Promise<Database> => {
  const sqlRuntime = await getSqlRuntime();
  await mkdir(getAppDataRoot(), { recursive: true });

  let database: Database;
  if (existsSync(getDbPath())) {
    const raw = await readFile(getDbPath());
    database = new sqlRuntime.Database(new Uint8Array(raw));
  } else {
    database = new sqlRuntime.Database();
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS onboarding_phase_stage (
      step_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      context_json TEXT NOT NULL,
      requires_reverification INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS onboarding_stage_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
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

const upsertMeta = (database: Database, key: string, value: string): void => {
  const statement = database.prepare(`
    INSERT INTO onboarding_stage_meta (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);

  const now = new Date().toISOString();
  statement.run([key, value, now]);
  statement.free();
};

const readMeta = (database: Database, key: string): string | null => {
  const statement = database.prepare('SELECT value FROM onboarding_stage_meta WHERE key = ?');
  statement.bind([key]);

  if (!statement.step()) {
    statement.free();
    return null;
  }

  const row = statement.getAsObject() as { value?: unknown };
  statement.free();
  return typeof row.value === 'string' ? row.value : null;
};

export const onboardingStageStoreService = {
  async saveSnapshot(payload: SaveOnboardingStagePayload): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();

      const upsertStatement = database.prepare(`
        INSERT INTO onboarding_phase_stage (step_id, status, context_json, requires_reverification, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(step_id) DO UPDATE SET
          status = excluded.status,
          context_json = excluded.context_json,
          requires_reverification = excluded.requires_reverification,
          updated_at = excluded.updated_at
      `);

      const now = new Date().toISOString();
      for (const [stepId, stage] of Object.entries(payload.phases)) {
        upsertStatement.run([
          stepId,
          stage.status,
          JSON.stringify(stage.contextByKey ?? {}),
          stage.requiresReverification ? 1 : 0,
          now,
        ]);
      }
      upsertStatement.free();

      upsertMeta(database, META_CURRENT_STEP, String(payload.currentStep));
      if (payload.modelAccess) {
        upsertMeta(database, META_MODEL_ACCESS, JSON.stringify(payload.modelAccess));
      }

      await persistDatabase(database);
    });
  },

  async getSnapshot(): Promise<OnboardingStageSnapshot> {
    const database = await getDatabase();

    const phases: Record<string, OnboardingPhaseStageRecord> = {};
    const statement = database.prepare(
      'SELECT step_id, status, context_json, requires_reverification, updated_at FROM onboarding_phase_stage',
    );

    while (statement.step()) {
      const row = statement.getAsObject() as {
        step_id?: unknown;
        status?: unknown;
        context_json?: unknown;
        requires_reverification?: unknown;
        updated_at?: unknown;
      };

      const stepId = typeof row.step_id === 'string' ? row.step_id : '';
      if (!stepId) {
        continue;
      }

      let contextByKey: Record<string, string> = {};
      if (typeof row.context_json === 'string') {
        try {
          const parsed = JSON.parse(row.context_json) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            contextByKey = Object.entries(parsed as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
              if (typeof value === 'string') {
                acc[key] = value;
              } else if (typeof value === 'number' || typeof value === 'boolean') {
                acc[key] = String(value);
              }
              return acc;
            }, {});
          }
        } catch {
          contextByKey = {};
        }
      }

      phases[stepId] = {
        stepId,
        status: row.status === 'APPROVED' ? 'APPROVED' : row.status === 'DRAFT' ? 'DRAFT' : 'PENDING',
        contextByKey,
        requiresReverification: Number(row.requires_reverification ?? 0) === 1,
        updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
      };
    }

    statement.free();

    const currentStepRaw = readMeta(database, META_CURRENT_STEP);
    const currentStep = currentStepRaw !== null && Number.isFinite(Number(currentStepRaw))
      ? Number(currentStepRaw)
      : null;

    const modelAccessRaw = readMeta(database, META_MODEL_ACCESS);
    let modelAccess: Record<string, unknown> | null = null;
    if (modelAccessRaw) {
      try {
        const parsed = JSON.parse(modelAccessRaw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          modelAccess = parsed as Record<string, unknown>;
        }
      } catch {
        modelAccess = null;
      }
    }

    return {
      phases,
      currentStep,
      modelAccess,
    };
  },

  async clearSnapshot(): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();
      database.run('DELETE FROM onboarding_phase_stage');
      database.run('DELETE FROM onboarding_stage_meta WHERE key IN (?, ?)', [META_CURRENT_STEP, META_MODEL_ACCESS]);
      await persistDatabase(database);
    });
  },
};
