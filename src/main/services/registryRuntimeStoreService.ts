import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { agentRegistryService } from './agentRegistryService';
import { getAppDataRoot } from './governanceRepoService';
import { syncStoreService } from './syncStoreService';

const DB_FILE_NAME = 'registry-runtime.sqlite';
const META_STATE_KEY = 'approved_runtime_state';
const APPROVED_RUNTIME_SYNC_RECORD_KEY = 'approved_runtime_state';

interface RuntimeAgentMapping {
  skills: string[];
  protocols: string[];
  kpis: string[];
  workflows: string[];
}

export interface ApprovedRuntimeWritePayload {
  committedAt: string;
  contextByStep: Record<string, Record<string, string>>;
  approvalByStep: Record<string, 'PENDING' | 'DRAFT' | 'APPROVED'>;
  agentMappings: Record<string, RuntimeAgentMapping>;
  modelAccess: Record<string, unknown> | null;
}

export interface SyncImportedRuntimePayload {
  committedAt: string;
  contextByStep: Record<string, Record<string, string>>;
  approvalByStep: Record<string, 'PENDING' | 'DRAFT' | 'APPROVED'>;
  agentMappings: Record<string, RuntimeAgentMapping>;
}

export interface RuntimeChannelDetails {
  provider: string;
  allowedChannels: string[];
  approvedAgentsForChannels: Record<string, string[]>;
  channelAccessRules: string;
  telegramChannelId: string;
  webhookSubscriptionUri: string;
  providerCredentials: string;
}

export interface RuntimeChannelDetailsUpdatePayload {
  provider: string;
  allowedChannels: string[];
  approvedAgentsForChannels: Record<string, string[]>;
  channelAccessRules: string;
  telegramChannelId?: string;
  webhookSubscriptionUri?: string;
  providerCredentials?: string;
}

interface ApprovedRuntimeState {
  committedAt: string;
  contextByStep: Record<string, Record<string, string>>;
  approvalByStep: Record<string, 'PENDING' | 'DRAFT' | 'APPROVED'>;
  agentMappings: Record<string, RuntimeAgentMapping>;
  modelAccess: Record<string, unknown> | null;
  channelDetails: RuntimeChannelDetails;
}

export interface RuntimePersonaRecord {
  id: string;
  name: string;
  role: string;
  constraints: string[];
  approvedProtocols: string[];
  approvedChannels: string[];
  workflows: string[];
}

export interface RuntimeWorkflowRecord {
  id: string;
  personaId: string;
  title: string;
  description: string;
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

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
  await mkdir(getAppDataRoot(), { recursive: true });
  await writeFile(getDbPath(), Buffer.from(bytes));
};

const initializeDatabase = async (): Promise<Database> => {
  const sqlRuntime = await getSqlRuntime();
  await mkdir(getAppDataRoot(), { recursive: true });

  const database = existsSync(getDbPath())
    ? new sqlRuntime.Database(new Uint8Array(await readFile(getDbPath())))
    : new sqlRuntime.Database();

  database.run(`
    CREATE TABLE IF NOT EXISTS runtime_registry_meta (
      key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
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

const splitDelimited = (value: string): string[] => {
  return value
    .split(/[\n,;|]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const toDisplayName = (agentId: string): string => {
  if (!agentId) {
    return 'Unknown';
  }
  return `${agentId.charAt(0).toUpperCase()}${agentId.slice(1)}`;
};

const normalizeAgentKey = (value: string): string => value.trim().toLowerCase();

const parseAgentChannelMatrix = (raw: string): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  const entries = splitDelimited(raw);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const agentId = normalizeAgentKey(entry.slice(0, separatorIndex));
    const channelsRaw = entry.slice(separatorIndex + 1).trim();
    if (!agentId || !channelsRaw) {
      continue;
    }

    const channels = splitDelimited(channelsRaw).map((channel) => channel.toLowerCase());
    if (channels.length > 0) {
      result[agentId] = channels;
    }
  }

  return result;
};

const buildChannelDetails = (contextByStep: Record<string, Record<string, string>>): RuntimeChannelDetails => {
  const infrastructure = contextByStep['infrastructure-finalization'] ?? {};
  const provider = (infrastructure.channel_provider ?? '').trim();
  const allowedChannels = splitDelimited(infrastructure.allowed_channels ?? '').map((channel) => channel.toLowerCase());
  const approvedAgentsForChannels = parseAgentChannelMatrix(infrastructure.approved_agents_for_channels ?? '');
  const channelAccessRules = (infrastructure.channel_access_rules ?? '').trim();
  const telegramChannelId = (infrastructure.telegram_channel_id ?? '').trim();
  const webhookSubscriptionUri = (infrastructure.webhook_subscription_uri ?? '').trim();
  const providerCredentials = (infrastructure.provider_credentials ?? '').trim();

  return {
    provider,
    allowedChannels,
    approvedAgentsForChannels,
    channelAccessRules,
    telegramChannelId,
    webhookSubscriptionUri,
    providerCredentials,
  };
};

const stringifyAgentChannelMatrix = (matrix: Record<string, string[]>): string => {
  return Object.entries(matrix)
    .map(([agentId, channels]) => {
      const normalizedAgentId = normalizeAgentKey(agentId);
      const normalizedChannels = Array.from(
        new Set((channels ?? []).map((channel) => channel.trim().toLowerCase()).filter((channel) => channel.length > 0)),
      );

      if (!normalizedAgentId || normalizedChannels.length === 0) {
        return '';
      }

      return `${normalizedAgentId}:${normalizedChannels.join(',')}`;
    })
    .filter((entry) => entry.length > 0)
    .join('; ');
};

const parseStoredState = (payloadJson: string): ApprovedRuntimeState | null => {
  try {
    const parsed = JSON.parse(payloadJson) as Partial<ApprovedRuntimeState>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (typeof parsed.committedAt !== 'string') {
      return null;
    }

    return {
      committedAt: parsed.committedAt,
      contextByStep: (parsed.contextByStep ?? {}) as Record<string, Record<string, string>>,
      approvalByStep: (parsed.approvalByStep ?? {}) as Record<string, 'PENDING' | 'DRAFT' | 'APPROVED'>,
      agentMappings: (parsed.agentMappings ?? {}) as Record<string, RuntimeAgentMapping>,
      modelAccess: (parsed.modelAccess ?? null) as Record<string, unknown> | null,
      channelDetails: (parsed.channelDetails ?? {
        provider: '',
        allowedChannels: [],
        approvedAgentsForChannels: {},
        channelAccessRules: '',
        telegramChannelId: '',
        webhookSubscriptionUri: '',
        providerCredentials: '',
      }) as RuntimeChannelDetails,
    };
  } catch {
    return null;
  }
};

const readApprovedRuntimeState = async (): Promise<ApprovedRuntimeState | null> => {
  const db = await getDatabase();
  const statement = db.prepare('SELECT payload_json FROM runtime_registry_meta WHERE key = ?');
  statement.bind([META_STATE_KEY]);

  if (!statement.step()) {
    statement.free();
    return null;
  }

  const row = statement.getAsObject() as { payload_json?: unknown };
  statement.free();

  if (typeof row.payload_json !== 'string') {
    return null;
  }

  return parseStoredState(row.payload_json);
};

const writeApprovedRuntimeState = async (state: ApprovedRuntimeState): Promise<void> => {
  await queueWrite(async () => {
    const db = await getDatabase();
    const statement = db.prepare(`
      INSERT INTO runtime_registry_meta (key, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `);

    const now = new Date().toISOString();
    statement.run([META_STATE_KEY, JSON.stringify(state), now]);
    statement.free();
    await persistDatabase(db);
  });
};

const clearApprovedRuntimeStateInternal = async (): Promise<void> => {
  await queueWrite(async () => {
    const db = await getDatabase();
    const statement = db.prepare('DELETE FROM runtime_registry_meta WHERE key = ?');
    statement.run([META_STATE_KEY]);
    statement.free();
    await persistDatabase(db);
  });
};

export const registryRuntimeStoreService = {
  async saveApprovedRuntime(payload: ApprovedRuntimeWritePayload): Promise<void> {
    const state: ApprovedRuntimeState = {
      committedAt: payload.committedAt,
      contextByStep: payload.contextByStep,
      approvalByStep: payload.approvalByStep,
      agentMappings: payload.agentMappings,
      modelAccess: payload.modelAccess,
      channelDetails: buildChannelDetails(payload.contextByStep),
    };

    await writeApprovedRuntimeState(state);
    await syncStoreService.upsertSyncLineageRecord({
      recordKey: APPROVED_RUNTIME_SYNC_RECORD_KEY,
      tableName: 'runtime_registry_meta',
      syncStatus: 'PENDING_UPDATE',
      payload: JSON.stringify(state),
      lastModified: payload.committedAt,
    });
    await syncStoreService.upsertSyncLineageRecord({
      recordKey: 'runtime_model_access',
      tableName: 'runtime_registry_meta',
      syncStatus: 'LOCAL_ONLY',
      payload: JSON.stringify(payload.modelAccess ?? null),
      lastModified: payload.committedAt,
    });
  },

  async getApprovedRuntimeState(): Promise<ApprovedRuntimeState | null> {
    return readApprovedRuntimeState();
  },

  async markApprovedRuntimePendingDelete(): Promise<void> {
    const existing = await readApprovedRuntimeState();
    const lastModified = existing?.committedAt ?? new Date().toISOString();
    await syncStoreService.upsertSyncLineageRecord({
      recordKey: APPROVED_RUNTIME_SYNC_RECORD_KEY,
      tableName: 'runtime_registry_meta',
      syncStatus: 'PENDING_DELETE',
      payload: JSON.stringify(existing ?? null),
      lastModified,
    });
  },

  async clearApprovedRuntimeState(): Promise<void> {
    await clearApprovedRuntimeStateInternal();
    await syncStoreService.deleteSyncLineageRecord(APPROVED_RUNTIME_SYNC_RECORD_KEY);
  },

  async importApprovedRuntimeFromSync(payload: SyncImportedRuntimePayload): Promise<void> {
    const contextByStep = {
      ...payload.contextByStep,
      'infrastructure-finalization': {
        ...(payload.contextByStep['infrastructure-finalization'] ?? {}),
        // Keep volatile credentials local-only. Remote pull intentionally never restores these values.
        telegram_channel_id: '',
        webhook_subscription_uri: '',
        provider_credentials: '',
      },
    };

    const importedState: ApprovedRuntimeState = {
      committedAt: payload.committedAt,
      contextByStep,
      approvalByStep: payload.approvalByStep,
      agentMappings: payload.agentMappings,
      modelAccess: null,
      channelDetails: buildChannelDetails(contextByStep),
    };

    await writeApprovedRuntimeState(importedState);
    await syncStoreService.upsertSyncLineageRecord({
      recordKey: APPROVED_RUNTIME_SYNC_RECORD_KEY,
      tableName: 'runtime_registry_meta',
      syncStatus: 'SYNCED',
      payload: JSON.stringify(importedState),
      lastModified: payload.committedAt,
    });
  },

  async listRuntimePersonas(): Promise<RuntimePersonaRecord[]> {
    const state = await readApprovedRuntimeState();
    if (!state) {
      return [];
    }

    const profilePersona = state.contextByStep['agent-profile-persona'] ?? {};
    const personas = Object.entries(state.agentMappings).map(([agentId, mapping]) => {
      const runtimeAgent = agentRegistryService.getAgent(agentId);
      const constraintsRaw = profilePersona[`${agentId}.role_non_negotiable_requirements`] ?? '';
      const approvedChannels = state.channelDetails.approvedAgentsForChannels[normalizeAgentKey(agentId)]
        ?? state.channelDetails.allowedChannels;

      return {
        id: agentId,
        name: runtimeAgent?.name ?? toDisplayName(agentId),
        role: runtimeAgent?.role ?? 'Runtime Persona',
        constraints: splitDelimited(constraintsRaw),
        approvedProtocols: mapping.protocols,
        approvedChannels,
        workflows: mapping.workflows,
      };
    });

    return personas.sort((left, right) => left.id.localeCompare(right.id));
  },

  async getRuntimePersona(agentId: string): Promise<RuntimePersonaRecord | null> {
    const personas = await this.listRuntimePersonas();
    return personas.find((persona) => persona.id === agentId) ?? null;
  },

  async listRuntimeWorkflows(): Promise<RuntimeWorkflowRecord[]> {
    const state = await readApprovedRuntimeState();
    if (!state) {
      return [];
    }

    const workflows: RuntimeWorkflowRecord[] = [];
    for (const [agentId, mapping] of Object.entries(state.agentMappings)) {
      for (const workflowId of mapping.workflows) {
        workflows.push({
          id: workflowId,
          personaId: agentId,
          title: workflowId,
          description: `Runtime-approved workflow for ${agentId}`,
        });
      }
    }

    return workflows;
  },

  async listRuntimeProtocolIds(): Promise<string[]> {
    const state = await readApprovedRuntimeState();
    if (!state) {
      return [];
    }

    const protocolIds = new Set<string>();
    Object.values(state.agentMappings).forEach((mapping) => {
      mapping.protocols.forEach((protocolId) => protocolIds.add(protocolId));
    });

    return Array.from(protocolIds.values()).sort((left, right) => left.localeCompare(right));
  },

  async getRuntimeModelAccess(): Promise<Record<string, unknown> | null> {
    const state = await readApprovedRuntimeState();
    return state?.modelAccess ?? null;
  },

  async getRuntimeChannelDetails(): Promise<RuntimeChannelDetails | null> {
    const state = await readApprovedRuntimeState();
    return state?.channelDetails ?? null;
  },

  async updateRuntimeChannelDetails(payload: RuntimeChannelDetailsUpdatePayload): Promise<RuntimeChannelDetails> {
    const existingState = await readApprovedRuntimeState();
    const normalizedProvider = payload.provider.trim();
    const normalizedAllowedChannels = Array.from(
      new Set(payload.allowedChannels.map((channel) => channel.trim().toLowerCase()).filter((channel) => channel.length > 0)),
    );
    const normalizedAgentChannels = Object.fromEntries(
      Object.entries(payload.approvedAgentsForChannels)
        .map(([agentId, channels]) => {
          const normalizedAgentId = normalizeAgentKey(agentId);
          const normalizedChannels = Array.from(
            new Set((channels ?? []).map((channel) => channel.trim().toLowerCase()).filter((channel) => channel.length > 0)),
          );
          return [normalizedAgentId, normalizedChannels] as const;
        })
        .filter(([agentId, channels]) => agentId.length > 0 && channels.length > 0),
    );

    const contextByStep = {
      ...(existingState?.contextByStep ?? {}),
      'infrastructure-finalization': {
        ...(existingState?.contextByStep?.['infrastructure-finalization'] ?? {}),
        channel_provider: normalizedProvider,
        allowed_channels: normalizedAllowedChannels.join(', '),
        approved_agents_for_channels: stringifyAgentChannelMatrix(normalizedAgentChannels),
        channel_access_rules: payload.channelAccessRules.trim(),
        telegram_channel_id: (payload.telegramChannelId ?? '').trim(),
        webhook_subscription_uri: (payload.webhookSubscriptionUri ?? '').trim(),
        provider_credentials: (payload.providerCredentials ?? '').trim(),
      },
    };

    const nextState: ApprovedRuntimeState = {
      committedAt: existingState?.committedAt ?? new Date().toISOString(),
      contextByStep,
      approvalByStep: existingState?.approvalByStep ?? {},
      agentMappings: existingState?.agentMappings ?? {},
      modelAccess: existingState?.modelAccess ?? null,
      channelDetails: buildChannelDetails(contextByStep),
    };

    await writeApprovedRuntimeState(nextState);
    await syncStoreService.upsertSyncLineageRecord({
      recordKey: APPROVED_RUNTIME_SYNC_RECORD_KEY,
      tableName: 'runtime_registry_meta',
      syncStatus: 'PENDING_UPDATE',
      payload: JSON.stringify(nextState),
      lastModified: nextState.committedAt,
    });
    return nextState.channelDetails;
  },
};
