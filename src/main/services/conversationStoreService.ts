import { encryptSqliteBuffer, decryptSqliteBuffer } from './sqliteCryptoUtil';
import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
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


