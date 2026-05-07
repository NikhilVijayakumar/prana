import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { getAppDataRoot, mkdirSafe } from './governanceRepoService';

const DB_FILE_NAME = 'onboarding-stage.sqlite';
const META_CURRENT_STEP = 'current_step';
const META_MODEL_ACCESS = 'model_access';
const META_FLOW_META = 'flow_meta';

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
  meta?: {
    stage: 'welcome' | 'steps' | 'consent' | 'review' | 'completion';
    consent: {
      dataHandling: boolean;
      runtimePolicy: boolean;
      externalChannels: boolean;
    };
    lastCheckpointAt: string;
  };
}

export interface SaveOnboardingStagePayload {
  phases: Record<string, {
    status: 'PENDING' | 'DRAFT' | 'APPROVED';
    contextByKey: Record<string, string>;
    requiresReverification: boolean;
  }>;
  currentStep: number;
  modelAccess?: Record<string, unknown>;
  meta?: {
    stage: 'welcome' | 'steps' | 'consent' | 'review' | 'completion';
    consent: {
      dataHandling: boolean;
      runtimePolicy: boolean;
      externalChannels: boolean;
    };
    lastCheckpointAt: string;
  };
}

let db: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);
const nowIso = (): string => new Date().toISOString();

const persistDatabase = async (database: Database): Promise<void> => {
  const buffer = database.serialize();
  await mkdirSafe(getAppDataRoot());
  await writeFile(getDbPath(), Buffer.from(buffer));
};

const initializeDatabase = async (): Promise<Database> => {
  await mkdirSafe(getAppDataRoot());

  let database: Database;
  if (existsSync(getDbPath())) {
    database = new Database(getDbPath());
  } else {
    database = new Database(':memory:');
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS onboarding_phase_stage (
      step_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      context_json TEXT NOT NULL,
      requires_reverification INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS onboarding_stage_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db = database;
  return database;
};

const getDatabase = async (): Promise<Database> => {
  if (!db) {
    await initializeDatabase();
  }
  return db!;
};

const queueWrite = async (operation: () => Promise<void>): Promise<void> => {
  writeQueue = writeQueue.then(operation, operation);
  await writeQueue;
};

const upsertMeta = (database: Database, key: string, value: string): void => {
  database.prepare(`
    INSERT OR REPLACE INTO onboarding_stage_meta (key, value, updated_at)
    VALUES (?, ?, ?)
  `).run(key, value, nowIso());
};

const readMeta = (database: Database, key: string): string | null => {
  const row = database.prepare('SELECT value FROM onboarding_stage_meta WHERE key = ?').get(key) as { value?: unknown } | undefined;
  return row && typeof row.value === 'string' ? row.value : null;
};

export const onboardingStageStoreService = {
  async saveSnapshot(payload: SaveOnboardingStagePayload): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();

      const upsertStmt = database.prepare(`
        INSERT OR REPLACE INTO onboarding_phase_stage (step_id, status, context_json, requires_reverification, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      const now = nowIso();
      for (const [stepId, stage] of Object.entries(payload.phases)) {
        upsertStmt.run(
          stepId,
          stage.status,
          JSON.stringify(stage.contextByKey ?? {}),
          stage.requiresReverification ? 1 : 0,
          now
        );
      }

      upsertMeta(database, META_CURRENT_STEP, String(payload.currentStep));
      if (payload.modelAccess) {
        upsertMeta(database, META_MODEL_ACCESS, JSON.stringify(payload.modelAccess));
      }
      if (payload.meta) {
        upsertMeta(database, META_FLOW_META, JSON.stringify(payload.meta));
      }

      await persistDatabase(database);
    });
  },

  async getSnapshot(): Promise<OnboardingStageSnapshot> {
    const database = await getDatabase();

    const phases: Record<string, OnboardingPhaseStageRecord> = {};
    const rows = database.prepare(
      'SELECT step_id, status, context_json, requires_reverification, updated_at FROM onboarding_phase_stage'
    ).all() as Record<string, unknown>[];

    for (const row of rows) {
      const stepId = String(row.step_id ?? '');
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
        updatedAt: typeof row.updated_at === 'string' ? row.updated_at : nowIso(),
      };
    }

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

    const metaRaw = readMeta(database, META_FLOW_META);
    let meta: OnboardingStageSnapshot['meta'] | undefined;
    if (metaRaw) {
      try {
        const parsed = JSON.parse(metaRaw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const candidate = parsed as {
            stage?: unknown;
            consent?: unknown;
            lastCheckpointAt?: unknown;
          };
          const stage =
            candidate.stage === 'welcome' ||
            candidate.stage === 'steps' ||
            candidate.stage === 'consent' ||
            candidate.stage === 'review' ||
            candidate.stage === 'completion'
              ? candidate.stage
              : null;
          const consent =
            candidate.consent && typeof candidate.consent === 'object' && !Array.isArray(candidate.consent)
              ? (candidate.consent as {
                  dataHandling?: unknown;
                  runtimePolicy?: unknown;
                  externalChannels?: unknown;
                })
              : null;

          if (stage && consent) {
            meta = {
              stage,
              consent: {
                dataHandling: consent.dataHandling === true,
                runtimePolicy: consent.runtimePolicy === true,
                externalChannels: consent.externalChannels === true,
              },
              lastCheckpointAt:
                typeof candidate.lastCheckpointAt === 'string' && candidate.lastCheckpointAt.trim().length > 0
                  ? candidate.lastCheckpointAt
                  : nowIso(),
            };
          }
        }
      } catch {
        meta = undefined;
      }
    }

    return {
      phases,
      currentStep,
      modelAccess,
      meta,
    };
  },

  async clearSnapshot(): Promise<void> {
    await queueWrite(async () => {
      const database = await getDatabase();
      database.prepare('DELETE FROM onboarding_phase_stage').run();
      database.prepare('DELETE FROM onboarding_stage_meta WHERE key IN (?, ?, ?)').run(
        META_CURRENT_STEP,
        META_MODEL_ACCESS,
        META_FLOW_META
      );
      await persistDatabase(database);
    });
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    db = null;
    writeQueue = Promise.resolve();
    await rm(getDbPath(), { force: true });
  },
};
