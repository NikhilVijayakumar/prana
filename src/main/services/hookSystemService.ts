import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type HookEventType =
  | 'session.bootstrap'
  | 'session.message'
  | 'session.afterTurn'
  | 'schedule.tick'
  | 'vault.ingested'
  | 'vault.pending.approved'
  | 'vault.pending.rejected'
  | 'system.status';

export type HookSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type HookAction = 'notify' | 'audit';

export type HookExecutionStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'SKIPPED_DISABLED'
  | 'SECURITY_BLOCKED';

export interface HookDefinition {
  id: string;
  event: HookEventType;
  enabled: boolean;
  priority: number;
  timeoutMs: number;
  retries: number;
  action: HookAction | string;
  severity?: HookSeverity;
  messageTemplate: string;
}

export interface HookExecutionRecord {
  id: string;
  hookId: string;
  event: HookEventType;
  status: HookExecutionStatus;
  attempts: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  message: string;
}

export interface HookNotification {
  id: string;
  timestamp: string;
  source: string;
  severity: HookSeverity;
  message: string;
  read: boolean;
}

export interface HookTelemetry {
  hookCount: number;
  enabledHooks: number;
  notificationsGenerated: number;
  totalExecutions: number;
  succeeded: number;
  failed: number;
  timedOut: number;
  skipped: number;
  lastRunAt: string | null;
}

const ALLOWED_ACTIONS = new Set<HookAction>(['notify', 'audit']);
const EVENTS = new Set<HookEventType>([
  'session.bootstrap',
  'session.message',
  'session.afterTurn',
  'schedule.tick',
  'vault.ingested',
  'vault.pending.approved',
  'vault.pending.rejected',
  'system.status',
]);

const MAX_EXECUTIONS = 500;
const MAX_NOTIFICATIONS = 200;
const DEFAULT_TIMEOUT_MS = 1500;

let loaded = false;
let orderCounter = 0;

const hooks = new Map<string, HookDefinition & { order: number }>();
const executionLog: HookExecutionRecord[] = [];
const notifications: HookNotification[] = [];

const nowIso = (): string => new Date().toISOString();

const nextId = (prefix: string): string => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

const renderTemplate = (template: string, payload: Record<string, unknown>): string => {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = payload[key];
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value);
  });
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('hook_timeout'));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

const pushExecution = (entry: HookExecutionRecord): void => {
  executionLog.unshift(entry);
  if (executionLog.length > MAX_EXECUTIONS) {
    executionLog.length = MAX_EXECUTIONS;
  }
};

const pushNotification = (entry: HookNotification): void => {
  notifications.unshift(entry);
  if (notifications.length > MAX_NOTIFICATIONS) {
    notifications.length = MAX_NOTIFICATIONS;
  }
};

const loadHooksFromFile = async (): Promise<HookDefinition[]> => {
  const configPath = join(process.cwd(), 'src', 'main', 'config', 'hooks.json');

  if (!existsSync(configPath)) {
    return [];
  }

  const raw = await readFile(configPath, 'utf8');
  const parsed = JSON.parse(raw) as HookDefinition[];
  return Array.isArray(parsed) ? parsed : [];
};

const registerHooks = (definitions: HookDefinition[]): void => {
  hooks.clear();
  orderCounter = 0;

  for (const definition of definitions) {
    if (!definition.id || !EVENTS.has(definition.event)) {
      continue;
    }

    hooks.set(definition.id, {
      ...definition,
      priority: Number.isFinite(definition.priority) ? definition.priority : 100,
      timeoutMs: Number.isFinite(definition.timeoutMs) ? definition.timeoutMs : DEFAULT_TIMEOUT_MS,
      retries: Number.isFinite(definition.retries) ? Math.max(0, definition.retries) : 0,
      enabled: definition.enabled !== false,
      order: orderCounter,
    });
    orderCounter += 1;
  }
};

const defaultHooks: HookDefinition[] = [
  {
    id: 'hook-default-vault-ingested',
    event: 'vault.ingested',
    enabled: true,
    priority: 10,
    timeoutMs: 1000,
    retries: 0,
    action: 'notify',
    severity: 'INFO',
    messageTemplate: 'Vault ingest completed: {{count}} file(s).',
  },
  {
    id: 'hook-default-session-bootstrap',
    event: 'session.bootstrap',
    enabled: true,
    priority: 20,
    timeoutMs: 1000,
    retries: 0,
    action: 'audit',
    messageTemplate: 'Session bootstrap observed for {{sessionId}}',
  },
];

const ensureLoaded = async (): Promise<void> => {
  if (loaded) {
    return;
  }

  const fromFile = await loadHooksFromFile();
  registerHooks(fromFile.length > 0 ? fromFile : defaultHooks);
  loaded = true;
};

const runHookAction = async (
  hook: HookDefinition & { order: number },
  payload: Record<string, unknown>,
): Promise<string> => {
  const action = hook.action as HookAction;
  const message = renderTemplate(hook.messageTemplate, payload).trim();

  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error('security_blocked');
  }

  // Intentional async boundary to keep hooks non-blocking from caller perspective.
  await Promise.resolve();

  if (payload.forceFailureForHookId === hook.id) {
    throw new Error('forced_failure');
  }

  if (action === 'notify') {
    pushNotification({
      id: nextId('hnotif'),
      timestamp: nowIso(),
      source: `Hook:${hook.id}`,
      severity: hook.severity ?? 'INFO',
      message: message || `Hook ${hook.id} executed for ${hook.event}`,
      read: false,
    });
  }

  return message || `Hook ${hook.id} executed for ${hook.event}`;
};

const executeHook = async (
  hook: HookDefinition & { order: number },
  event: HookEventType,
  payload: Record<string, unknown>,
): Promise<HookExecutionRecord> => {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();

  if (!hook.enabled) {
    return {
      id: nextId('hexec'),
      hookId: hook.id,
      event,
      status: 'SKIPPED_DISABLED',
      attempts: 0,
      startedAt,
      endedAt: nowIso(),
      durationMs: 0,
      message: 'Hook disabled.',
    };
  }

  if (!ALLOWED_ACTIONS.has(hook.action as HookAction)) {
    return {
      id: nextId('hexec'),
      hookId: hook.id,
      event,
      status: 'SECURITY_BLOCKED',
      attempts: 0,
      startedAt,
      endedAt: nowIso(),
      durationMs: 0,
      message: `Action blocked by security policy: ${hook.action}`,
    };
  }

  let attempt = 0;
  const maxAttempts = Math.max(1, hook.retries + 1);

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      const message = await withTimeout(runHookAction(hook, payload), Math.max(100, hook.timeoutMs));
      const ended = Date.now();
      return {
        id: nextId('hexec'),
        hookId: hook.id,
        event,
        status: 'SUCCESS',
        attempts: attempt,
        startedAt,
        endedAt: new Date(ended).toISOString(),
        durationMs: ended - started,
        message,
      };
    } catch (error) {
      const code = error instanceof Error ? error.message : 'unknown_error';

      if (code === 'hook_timeout') {
        const ended = Date.now();
        return {
          id: nextId('hexec'),
          hookId: hook.id,
          event,
          status: 'TIMED_OUT',
          attempts: attempt,
          startedAt,
          endedAt: new Date(ended).toISOString(),
          durationMs: ended - started,
          message: `Hook timed out after ${hook.timeoutMs}ms.`,
        };
      }

      if (attempt >= maxAttempts) {
        const ended = Date.now();
        return {
          id: nextId('hexec'),
          hookId: hook.id,
          event,
          status: 'FAILED',
          attempts: attempt,
          startedAt,
          endedAt: new Date(ended).toISOString(),
          durationMs: ended - started,
          message: `Hook failed: ${code}`,
        };
      }
    }
  }

  const ended = Date.now();
  return {
    id: nextId('hexec'),
    hookId: hook.id,
    event,
    status: 'FAILED',
    attempts: maxAttempts,
    startedAt,
    endedAt: new Date(ended).toISOString(),
    durationMs: ended - started,
    message: 'Hook failed after retries.',
  };
};

const listHooksForEvent = (event: HookEventType): Array<HookDefinition & { order: number }> => {
  return [...hooks.values()]
    .filter((hook) => hook.event === event)
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.order - b.order;
    });
};

export const hookSystemService = {
  async initialize(): Promise<void> {
    await ensureLoaded();
  },

  async emit(event: HookEventType, payload: Record<string, unknown> = {}): Promise<number> {
    await ensureLoaded();
    const targets = listHooksForEvent(event);

    // Fire-and-forget execution to keep caller path non-blocking.
    void (async () => {
      for (const hook of targets) {
        const record = await executeHook(hook, event, payload);
        pushExecution(record);
      }
    })();

    return targets.length;
  },

  async emitAndWait(
    event: HookEventType,
    payload: Record<string, unknown> = {},
  ): Promise<HookExecutionRecord[]> {
    await ensureLoaded();
    const targets = listHooksForEvent(event);
    const results: HookExecutionRecord[] = [];

    for (const hook of targets) {
      const record = await executeHook(hook, event, payload);
      results.push(record);
      pushExecution(record);
    }

    return results;
  },

  async listHooks(): Promise<HookDefinition[]> {
    await ensureLoaded();
    return [...hooks.values()]
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.order - b.order;
      })
      .map(({ order, ...hook }) => hook);
  },

  async setHookEnabled(hookId: string, enabled: boolean): Promise<HookDefinition | null> {
    await ensureLoaded();
    const existing = hooks.get(hookId);
    if (!existing) {
      return null;
    }

    existing.enabled = enabled;
    hooks.set(hookId, existing);
    const { order, ...rest } = existing;
    return rest;
  },

  async listExecutions(limit = 20): Promise<HookExecutionRecord[]> {
    await ensureLoaded();
    return executionLog.slice(0, Math.max(0, limit));
  },

  async listNotifications(limit = 20): Promise<HookNotification[]> {
    await ensureLoaded();
    return notifications.slice(0, Math.max(0, limit));
  },

  async getTelemetry(): Promise<HookTelemetry> {
    await ensureLoaded();
    const totalExecutions = executionLog.length;

    return {
      hookCount: hooks.size,
      enabledHooks: [...hooks.values()].filter((hook) => hook.enabled).length,
      notificationsGenerated: notifications.length,
      totalExecutions,
      succeeded: executionLog.filter((entry) => entry.status === 'SUCCESS').length,
      failed: executionLog.filter((entry) => entry.status === 'FAILED').length,
      timedOut: executionLog.filter((entry) => entry.status === 'TIMED_OUT').length,
      skipped: executionLog.filter(
        (entry) => entry.status === 'SKIPPED_DISABLED' || entry.status === 'SECURITY_BLOCKED',
      ).length,
      lastRunAt: executionLog[0]?.endedAt ?? null,
    };
  },

  async getEventCatalog(): Promise<HookEventType[]> {
    return [...EVENTS.values()];
  },

  async clearRuntimeState(): Promise<void> {
    executionLog.length = 0;
    notifications.length = 0;
  },

  async __resetForTesting(): Promise<void> {
    loaded = false;
    hooks.clear();
    executionLog.length = 0;
    notifications.length = 0;
    orderCounter = 0;
    await ensureLoaded();
  },
};
