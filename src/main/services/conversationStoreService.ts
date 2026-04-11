import { encryptSqliteBuffer, decryptSqliteBuffer } from './sqliteCryptoUtil';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getAppDataRoot } from './governanceRepoService';

export type ConversationChannel =
  | 'internal-chat'
  | 'telegram'
  | 'whatsapp'
  | 'webhook'
  | 'api'
  | (string & {});
export type ConversationMode = 'INDIVIDUAL' | 'GROUP';
export type ConversationMessageRole = 'operator' | 'assistant' | 'system';
export type ConversationMessageStatus = 'RECEIVED' | 'ROUTED' | 'BLOCKED' | 'ESCALATED' | 'FAILED' | 'COMPLETED';

export interface ConversationRecord {
  conversationId: string;
  conversationKey: string;
  roomKey: string;
  appId: string;
  channel: ConversationChannel;
  mode: ConversationMode;
  operatorCanonicalId: string;
  operatorDisplayName: string | null;
  targetPersonaId: string | null;
  participantAgentIdsJson: string;
  providerRoomId: string | null;
  metadataJson: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessageRecord {
  messageId: string;
  conversationId: string;
  sessionKey: string;
  role: ConversationMessageRole;
  actorId: string | null;
  actorName: string | null;
  content: string;
  channel: ConversationChannel;
  status: ConversationMessageStatus;
  replyToMessageId: string | null;
  workOrderId: string | null;
  metadataJson: string;
  createdAt: string;
}

export interface OperatorIdentityRecord {
  identityId: string;
  appId: string;
  canonicalOperatorId: string;
  channel: ConversationChannel;
  externalUserId: string;
  displayName: string | null;
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const DB_FILE_NAME = 'conversation-store.sqlite';

const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);
const nowIso = (): string => new Date().toISOString();
const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
  await writeFile(getDbPath(), await encryptSqliteBuffer(bytes));
};

const initializeDatabase = async (): Promise<Database> => {
  const sqlRuntime = await getSqlRuntime();
  await mkdir(getAppDataRoot(), { recursive: true });

  let database: Database;
  if (existsSync(getDbPath())) {
    const raw = await readFile(getDbPath());
    try {
      database = new sqlRuntime.Database(await decryptSqliteBuffer(Buffer.from(raw)));
    } catch {
      database = new sqlRuntime.Database(new Uint8Array(raw));
      await persistDatabase(database);
    }
  } else {
    database = new sqlRuntime.Database();
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_id TEXT PRIMARY KEY,
      conversation_key TEXT NOT NULL UNIQUE,
      room_key TEXT NOT NULL,
      app_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      mode TEXT NOT NULL,
      operator_canonical_id TEXT NOT NULL,
      operator_display_name TEXT,
      target_persona_id TEXT,
      participant_agent_ids_json TEXT NOT NULL,
      provider_room_id TEXT,
      metadata_json TEXT NOT NULL,
      last_message_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_conversations_channel_last_message
    ON conversations (channel, last_message_at DESC);
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      message_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      session_key TEXT NOT NULL,
      role TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      content TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      reply_to_message_id TEXT,
      work_order_id TEXT,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
    ON conversation_messages (conversation_id, created_at ASC);
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS operator_identity_map (
      identity_id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL,
      canonical_operator_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      external_user_id TEXT NOT NULL,
      display_name TEXT,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_identity_unique
    ON operator_identity_map (app_id, channel, external_user_id);
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

const queueWrite = async <T>(operation: () => Promise<T>): Promise<T> => {
  let result!: T;
  writeQueue = writeQueue.then(
    async () => {
      result = await operation();
    },
    async () => {
      result = await operation();
    },
  );
  await writeQueue;
  return result;
};

const mapConversation = (row: Record<string, unknown>): ConversationRecord => ({
  conversationId: String(row.conversation_id ?? ''),
  conversationKey: String(row.conversation_key ?? ''),
  roomKey: String(row.room_key ?? ''),
  appId: String(row.app_id ?? ''),
  channel: String(row.channel ?? 'internal-chat') as ConversationChannel,
  mode: String(row.mode ?? 'INDIVIDUAL') as ConversationMode,
  operatorCanonicalId: String(row.operator_canonical_id ?? ''),
  operatorDisplayName: row.operator_display_name ? String(row.operator_display_name) : null,
  targetPersonaId: row.target_persona_id ? String(row.target_persona_id) : null,
  participantAgentIdsJson: String(row.participant_agent_ids_json ?? '[]'),
  providerRoomId: row.provider_room_id ? String(row.provider_room_id) : null,
  metadataJson: String(row.metadata_json ?? '{}'),
  lastMessageAt: String(row.last_message_at ?? nowIso()),
  createdAt: String(row.created_at ?? nowIso()),
  updatedAt: String(row.updated_at ?? nowIso()),
});

const mapMessage = (row: Record<string, unknown>): ConversationMessageRecord => ({
  messageId: String(row.message_id ?? ''),
  conversationId: String(row.conversation_id ?? ''),
  sessionKey: String(row.session_key ?? ''),
  role: String(row.role ?? 'system') as ConversationMessageRole,
  actorId: row.actor_id ? String(row.actor_id) : null,
  actorName: row.actor_name ? String(row.actor_name) : null,
  content: String(row.content ?? ''),
  channel: String(row.channel ?? 'internal-chat') as ConversationChannel,
  status: String(row.status ?? 'RECEIVED') as ConversationMessageStatus,
  replyToMessageId: row.reply_to_message_id ? String(row.reply_to_message_id) : null,
  workOrderId: row.work_order_id ? String(row.work_order_id) : null,
  metadataJson: String(row.metadata_json ?? '{}'),
  createdAt: String(row.created_at ?? nowIso()),
});

const mapIdentity = (row: Record<string, unknown>): OperatorIdentityRecord => ({
  identityId: String(row.identity_id ?? ''),
  appId: String(row.app_id ?? ''),
  canonicalOperatorId: String(row.canonical_operator_id ?? ''),
  channel: String(row.channel ?? 'internal-chat') as ConversationChannel,
  externalUserId: String(row.external_user_id ?? ''),
  displayName: row.display_name ? String(row.display_name) : null,
  metadataJson: String(row.metadata_json ?? '{}'),
  createdAt: String(row.created_at ?? nowIso()),
  updatedAt: String(row.updated_at ?? nowIso()),
});

export const conversationStoreService = {
  async resolveOperatorIdentity(input: {
    appId: string;
    channel: ConversationChannel;
    externalUserId: string;
    canonicalOperatorId?: string;
    displayName?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<OperatorIdentityRecord> {
    return queueWrite(async () => {
      const db = await getDatabase();
      const statement = db.prepare(`
        SELECT *
        FROM operator_identity_map
        WHERE app_id = ? AND channel = ? AND external_user_id = ?
        LIMIT 1
      `);
      statement.bind([input.appId, input.channel, input.externalUserId]);

      const now = nowIso();
      if (statement.step()) {
        const existing = mapIdentity(statement.getAsObject() as Record<string, unknown>);
        statement.free();

        const update = db.prepare(`
          UPDATE operator_identity_map
          SET display_name = ?, metadata_json = ?, updated_at = ?
          WHERE identity_id = ?
        `);
        update.run([
          input.displayName ?? existing.displayName,
          JSON.stringify(input.metadata ?? JSON.parse(existing.metadataJson)),
          now,
          existing.identityId,
        ]);
        update.free();
        await persistDatabase(db);
        return {
          ...existing,
          displayName: input.displayName ?? existing.displayName,
          metadataJson: JSON.stringify(input.metadata ?? JSON.parse(existing.metadataJson)),
          updatedAt: now,
        };
      }
      statement.free();

      const record: OperatorIdentityRecord = {
        identityId: createId('opid'),
        appId: input.appId,
        canonicalOperatorId: (input.canonicalOperatorId ?? input.externalUserId).trim(),
        channel: input.channel,
        externalUserId: input.externalUserId.trim(),
        displayName: input.displayName ?? null,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        createdAt: now,
        updatedAt: now,
      };

      const insert = db.prepare(`
        INSERT INTO operator_identity_map (
          identity_id, app_id, canonical_operator_id, channel, external_user_id,
          display_name, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run([
        record.identityId,
        record.appId,
        record.canonicalOperatorId,
        record.channel,
        record.externalUserId,
        record.displayName,
        record.metadataJson,
        record.createdAt,
        record.updatedAt,
      ]);
      insert.free();
      await persistDatabase(db);
      return record;
    });
  },

  async ensureConversation(input: {
    conversationKey: string;
    roomKey: string;
    appId: string;
    channel: ConversationChannel;
    mode: ConversationMode;
    operatorCanonicalId: string;
    operatorDisplayName?: string | null;
    targetPersonaId?: string | null;
    participantAgentIds?: string[];
    providerRoomId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ConversationRecord> {
    return queueWrite(async () => {
      const db = await getDatabase();
      const lookup = db.prepare('SELECT * FROM conversations WHERE conversation_key = ? LIMIT 1');
      lookup.bind([input.conversationKey]);

      const now = nowIso();
      const participantAgentIdsJson = JSON.stringify(
        [...new Set((input.participantAgentIds ?? []).map((value) => value.trim()).filter(Boolean))],
      );
      const metadataJson = JSON.stringify(input.metadata ?? {});

      if (lookup.step()) {
        const existing = mapConversation(lookup.getAsObject() as Record<string, unknown>);
        lookup.free();

        const update = db.prepare(`
          UPDATE conversations
          SET room_key = ?, operator_display_name = ?, target_persona_id = ?,
              participant_agent_ids_json = ?, provider_room_id = ?, metadata_json = ?, updated_at = ?
          WHERE conversation_id = ?
        `);
        update.run([
          input.roomKey,
          input.operatorDisplayName ?? existing.operatorDisplayName,
          input.targetPersonaId ?? existing.targetPersonaId,
          participantAgentIdsJson,
          input.providerRoomId ?? existing.providerRoomId,
          metadataJson,
          now,
          existing.conversationId,
        ]);
        update.free();
        await persistDatabase(db);
        return {
          ...existing,
          roomKey: input.roomKey,
          operatorDisplayName: input.operatorDisplayName ?? existing.operatorDisplayName,
          targetPersonaId: input.targetPersonaId ?? existing.targetPersonaId,
          participantAgentIdsJson,
          providerRoomId: input.providerRoomId ?? existing.providerRoomId,
          metadataJson,
          updatedAt: now,
        };
      }
      lookup.free();

      const record: ConversationRecord = {
        conversationId: createId('conv'),
        conversationKey: input.conversationKey,
        roomKey: input.roomKey,
        appId: input.appId,
        channel: input.channel,
        mode: input.mode,
        operatorCanonicalId: input.operatorCanonicalId,
        operatorDisplayName: input.operatorDisplayName ?? null,
        targetPersonaId: input.targetPersonaId ?? null,
        participantAgentIdsJson,
        providerRoomId: input.providerRoomId ?? null,
        metadataJson,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const insert = db.prepare(`
        INSERT INTO conversations (
          conversation_id, conversation_key, room_key, app_id, channel, mode,
          operator_canonical_id, operator_display_name, target_persona_id,
          participant_agent_ids_json, provider_room_id, metadata_json,
          last_message_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run([
        record.conversationId,
        record.conversationKey,
        record.roomKey,
        record.appId,
        record.channel,
        record.mode,
        record.operatorCanonicalId,
        record.operatorDisplayName,
        record.targetPersonaId,
        record.participantAgentIdsJson,
        record.providerRoomId,
        record.metadataJson,
        record.lastMessageAt,
        record.createdAt,
        record.updatedAt,
      ]);
      insert.free();
      await persistDatabase(db);
      return record;
    });
  },

  async appendMessage(input: {
    conversationId: string;
    sessionKey: string;
    role: ConversationMessageRole;
    actorId?: string | null;
    actorName?: string | null;
    content: string;
    channel: ConversationChannel;
    status: ConversationMessageStatus;
    replyToMessageId?: string | null;
    workOrderId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ConversationMessageRecord> {
    return queueWrite(async () => {
      const db = await getDatabase();
      const record: ConversationMessageRecord = {
        messageId: createId('msg'),
        conversationId: input.conversationId,
        sessionKey: input.sessionKey,
        role: input.role,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        content: input.content,
        channel: input.channel,
        status: input.status,
        replyToMessageId: input.replyToMessageId ?? null,
        workOrderId: input.workOrderId ?? null,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        createdAt: nowIso(),
      };

      const insert = db.prepare(`
        INSERT INTO conversation_messages (
          message_id, conversation_id, session_key, role, actor_id, actor_name,
          content, channel, status, reply_to_message_id, work_order_id, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run([
        record.messageId,
        record.conversationId,
        record.sessionKey,
        record.role,
        record.actorId,
        record.actorName,
        record.content,
        record.channel,
        record.status,
        record.replyToMessageId,
        record.workOrderId,
        record.metadataJson,
        record.createdAt,
      ]);
      insert.free();

      const touch = db.prepare(`
        UPDATE conversations
        SET last_message_at = ?, updated_at = ?
        WHERE conversation_id = ?
      `);
      touch.run([record.createdAt, record.createdAt, record.conversationId]);
      touch.free();

      await persistDatabase(db);
      return record;
    });
  },

  async listConversationMessages(conversationId: string, limit = 100): Promise<ConversationMessageRecord[]> {
    const db = await getDatabase();
    const statement = db.prepare(`
      SELECT *
      FROM conversation_messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    statement.bind([conversationId, Math.max(1, Math.min(limit, 500))]);
    const rows: ConversationMessageRecord[] = [];
    while (statement.step()) {
      rows.push(mapMessage(statement.getAsObject() as Record<string, unknown>));
    }
    statement.free();
    return rows.reverse();
  },

  async listConversations(limit = 100, channel?: ConversationChannel): Promise<ConversationRecord[]> {
    const db = await getDatabase();
    const hasChannel = Boolean(channel);
    const statement = hasChannel
      ? db.prepare('SELECT * FROM conversations WHERE channel = ? ORDER BY last_message_at DESC LIMIT ?')
      : db.prepare('SELECT * FROM conversations ORDER BY last_message_at DESC LIMIT ?');
    statement.bind(hasChannel ? [channel, Math.max(1, Math.min(limit, 500))] : [Math.max(1, Math.min(limit, 500))]);
    const rows: ConversationRecord[] = [];
    while (statement.step()) {
      rows.push(mapConversation(statement.getAsObject() as Record<string, unknown>));
    }
    statement.free();
    return rows;
  },

  async getConversationByKey(conversationKey: string): Promise<ConversationRecord | null> {
    const db = await getDatabase();
    const statement = db.prepare('SELECT * FROM conversations WHERE conversation_key = ? LIMIT 1');
    statement.bind([conversationKey]);
    if (!statement.step()) {
      statement.free();
      return null;
    }
    const row = mapConversation(statement.getAsObject() as Record<string, unknown>);
    statement.free();
    return row;
  },

  async getConversation(conversationId: string): Promise<ConversationRecord | null> {
    const db = await getDatabase();
    const statement = db.prepare('SELECT * FROM conversations WHERE conversation_id = ? LIMIT 1');
    statement.bind([conversationId]);
    if (!statement.step()) {
      statement.free();
      return null;
    }
    const row = mapConversation(statement.getAsObject() as Record<string, unknown>);
    statement.free();
    return row;
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    dbPromise = null;
    sqlRuntimePromise = null;
    writeQueue = Promise.resolve();
    await rm(getDbPath(), { force: true });
  },
};
