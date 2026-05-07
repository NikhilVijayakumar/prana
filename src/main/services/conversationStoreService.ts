import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { getAppDataRoot, mkdirSafe } from './governanceRepoService';

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

let db: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const DB_FILE_NAME = 'conversation-store.sqlite';

const getDbPath = (): string => join(getAppDataRoot(), DB_FILE_NAME);
const nowIso = (): string => new Date().toISOString();
const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_channel_last_message
      ON conversations (channel, last_message_at DESC);
  `);

  database.exec(`
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

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
      ON conversation_messages (conversation_id, created_at ASC);
  `);

  database.exec(`
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

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_identity_unique
      ON operator_identity_map (app_id, channel, external_user_id);
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
  channel: String(row.channel ?? '') as ConversationChannel,
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
  role: String(row.role ?? 'assistant') as ConversationMessageRole,
  actorId: row.actor_id ? String(row.actor_id) : null,
  actorName: row.actor_name ? String(row.actor_name) : null,
  content: String(row.content ?? ''),
  channel: String(row.channel ?? '') as ConversationChannel,
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
  channel: String(row.channel ?? '') as ConversationChannel,
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
    canonicalOperatorId: string;
    displayName?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<OperatorIdentityRecord> {
    return queueWrite(async () => {
      const database = await getDatabase();
      const existing = database
        .prepare('SELECT * FROM operator_identity_map WHERE app_id = ? AND channel = ? AND external_user_id = ? LIMIT 1')
        .get(input.appId, input.channel, input.externalUserId) as Record<string, unknown> | undefined;

      if (existing) {
        const updatedAt = nowIso();
        database
          .prepare('UPDATE operator_identity_map SET display_name = ?, metadata_json = ?, updated_at = ? WHERE identity_id = ?')
          .run(input.displayName ?? existing.display_name, JSON.stringify(input.metadata ?? {}), updatedAt, existing.identity_id);
        await persistDatabase(database);
        return mapIdentity({ ...existing, display_name: input.displayName ?? existing.display_name, metadata_json: JSON.stringify(input.metadata ?? {}), updated_at: updatedAt });
      }

      const now = nowIso();
      const identityId = createId('ident');
      database.prepare(`
        INSERT INTO operator_identity_map (identity_id, app_id, canonical_operator_id, channel, external_user_id, display_name, metadata_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(identityId, input.appId, input.canonicalOperatorId, input.channel, input.externalUserId, input.displayName ?? null, JSON.stringify(input.metadata ?? {}), now, now);
      await persistDatabase(database);
      return {
        identityId,
        appId: input.appId,
        canonicalOperatorId: input.canonicalOperatorId,
        channel: input.channel,
        externalUserId: input.externalUserId,
        displayName: input.displayName ?? null,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        createdAt: now,
        updatedAt: now,
      };
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
      const database = await getDatabase();
      const existing = database
        .prepare('SELECT * FROM conversations WHERE conversation_key = ? LIMIT 1')
        .get(input.conversationKey) as Record<string, unknown> | undefined;

      if (existing) {
        return mapConversation(existing);
      }

      const now = nowIso();
      const conversationId = createId('conv');
      database.prepare(`
        INSERT INTO conversations (
          conversation_id, conversation_key, room_key, app_id, channel, mode,
          operator_canonical_id, operator_display_name, target_persona_id,
          participant_agent_ids_json, provider_room_id, metadata_json,
          last_message_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        conversationId,
        input.conversationKey,
        input.roomKey,
        input.appId,
        input.channel,
        input.mode,
        input.operatorCanonicalId,
        input.operatorDisplayName ?? null,
        input.targetPersonaId ?? null,
        JSON.stringify(input.participantAgentIds ?? []),
        input.providerRoomId ?? null,
        JSON.stringify(input.metadata ?? {}),
        now,
        now,
        now,
      );
      await persistDatabase(database);
      return {
        conversationId,
        conversationKey: input.conversationKey,
        roomKey: input.roomKey,
        appId: input.appId,
        channel: input.channel,
        mode: input.mode,
        operatorCanonicalId: input.operatorCanonicalId,
        operatorDisplayName: input.operatorDisplayName ?? null,
        targetPersonaId: input.targetPersonaId ?? null,
        participantAgentIdsJson: JSON.stringify(input.participantAgentIds ?? []),
        providerRoomId: input.providerRoomId ?? null,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      };
    });
  },

  async appendMessage(input: {
    conversationId: string;
    sessionKey: string;
    role: string;
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
      const database = await getDatabase();
      const now = nowIso();
      const messageId = createId('msg');
      database.prepare(`
        INSERT INTO conversation_messages (
          message_id, conversation_id, session_key, role, actor_id, actor_name,
          content, channel, status, reply_to_message_id, work_order_id, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        messageId,
        input.conversationId,
        input.sessionKey,
        input.role,
        input.actorId ?? null,
        input.actorName ?? null,
        input.content,
        input.channel,
        input.status,
        input.replyToMessageId ?? null,
        input.workOrderId ?? null,
        JSON.stringify(input.metadata ?? {}),
        now,
      );
      database
        .prepare('UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE conversation_id = ?')
        .run(now, now, input.conversationId);
      await persistDatabase(database);
      return {
        messageId,
        conversationId: input.conversationId,
        sessionKey: input.sessionKey,
        role: input.role as ConversationMessageRole,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        content: input.content,
        channel: input.channel,
        status: input.status,
        replyToMessageId: input.replyToMessageId ?? null,
        workOrderId: input.workOrderId ?? null,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        createdAt: now,
      };
    });
  },

  async listConversations(limit = 100, channel?: ConversationChannel): Promise<ConversationRecord[]> {
    const database = await getDatabase();
    const rows = channel
      ? (database.prepare('SELECT * FROM conversations WHERE channel = ? ORDER BY last_message_at DESC LIMIT ?').all(channel, limit) as Record<string, unknown>[])
      : (database.prepare('SELECT * FROM conversations ORDER BY last_message_at DESC LIMIT ?').all(limit) as Record<string, unknown>[]);
    return rows.map(mapConversation);
  },

  async getConversationByKey(conversationKey: string): Promise<ConversationRecord | null> {
    const database = await getDatabase();
    const row = database
      .prepare('SELECT * FROM conversations WHERE conversation_key = ? LIMIT 1')
      .get(conversationKey) as Record<string, unknown> | undefined;
    return row ? mapConversation(row) : null;
  },

  async listConversationMessages(conversationId: string, limit = 200): Promise<ConversationMessageRecord[]> {
    const database = await getDatabase();
    const rows = database
      .prepare('SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?')
      .all(conversationId, limit) as Record<string, unknown>[];
    return rows.map(mapMessage);
  },

  async __resetForTesting(): Promise<void> {
    await writeQueue;
    if (db) {
      db.close();
      db = null;
    }
    writeQueue = Promise.resolve();
    await rm(getDbPath(), { force: true });
  },
};
