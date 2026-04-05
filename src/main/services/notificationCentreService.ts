import { randomUUID } from 'node:crypto';
import { vaidyarService, VaidyarHealthEvent } from './vaidyarService';
import { notificationStoreService, Notification, NotificationPriority, NotificationListFilters } from './notificationStoreService';
import { notificationRateLimiterService } from './notificationRateLimiterService';
import { notificationValidationService } from './notificationValidationService';
import { hookSystemService, HookNotification } from './hookSystemService';

export type NotificationChannel = 'system' | 'storage' | 'integration' | 'agent' | 'diagnostic';

export interface ClassifiedNotification {
  notificationId: string;
  eventId?: string;
  eventType: string;
  priority: NotificationPriority;
  source: string;
  message: string;
  actionRoute?: string;
  channel: NotificationChannel;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationCentreTelemetry {
  eventsEmitted: number;
  eventsClassified: number;
  eventsDelivered: number;
  eventsDropped: number;
  criticalsSurfaced: number;
  rateLimitedByPriority: Record<NotificationPriority, number>;
}

type NotificationListener = (notification: ClassifiedNotification) => void;

const listeners: NotificationListener[] = [];
let appId: string = 'prana'; // Set during init

let telemetry: NotificationCentreTelemetry = {
  eventsEmitted: 0,
  eventsClassified: 0,
  eventsDelivered: 0,
  eventsDropped: 0,
  criticalsSurfaced: 0,
  rateLimitedByPriority: {
    CRITICAL: 0,
    ACTION: 0,
    WARN: 0,
    INFO: 0,
  },
};

const nowIso = (): string => new Date().toISOString();

/**
 * Map Vaidyar health event type to notification channel
 */
const getChannelForEventType = (eventType: string): NotificationChannel => {
  if (eventType.startsWith('vaidyar:')) return 'diagnostic';
  if (eventType.startsWith('vault:') || eventType.startsWith('storage:')) return 'storage';
  if (eventType.startsWith('email:') || eventType.startsWith('integration:')) return 'integration';
  if (eventType.startsWith('agent:')) return 'agent';
  return 'system';
};

/**
 * Calculate expiry time based on priority
 */
const getExpiryTime = (priority: NotificationPriority): string | undefined => {
  const now = new Date();

  switch (priority) {
    case 'INFO':
      // Expires in 1 hour
      now.setHours(now.getHours() + 1);
      return now.toISOString();
    case 'WARN':
      // Session-based (no auto-expire, user must dismiss)
      return undefined;
    case 'CRITICAL':
      // Persistent until resolved (no auto-expire)
      return undefined;
    case 'ACTION':
      // Session-based (no auto-expire)
      return undefined;
    default:
      return undefined;
  }
};

/**
 * Classify a raw event into a notification
 */
const classifyEvent = (event: {
  eventId?: string;
  eventType: string;
  priority: NotificationPriority;
  source: string;
  message: string;
  actionRoute?: string;
  payload?: Record<string, unknown>;
}): ClassifiedNotification | null => {
  // Validate event type
  const eventTypeValidation = notificationValidationService.validateEventType(event.eventType);
  if (!eventTypeValidation.valid) {
    console.warn('Invalid event type:', event.eventType, eventTypeValidation.errors);
    return null;
  }

  // Sanitize message
  const sanitizedMessage = notificationValidationService.sanitizeMessage(event.message);

  return {
    notificationId: `notif_${randomUUID()}`,
    eventId: event.eventId,
    eventType: event.eventType,
    priority: event.priority,
    source: event.source,
    message: sanitizedMessage,
    actionRoute: event.actionRoute,
    channel: getChannelForEventType(event.eventType),
    createdAt: nowIso(),
    expiresAt: getExpiryTime(event.priority),
  };
};

/**
 * Emit a notification through the centre
 */
const emitNotification = async (event: {
  eventId?: string;
  eventType: string;
  priority: NotificationPriority;
  source: string;
  message: string;
  actionRoute?: string;
  payload?: Record<string, unknown>;
}): Promise<void> => {
  telemetry.eventsEmitted += 1;

  // Rate limiting (bypassed for CRITICAL)
  if (event.priority !== 'CRITICAL') {
    const rateLimitCheck = notificationRateLimiterService.check(event.source, event.priority);
    if (!rateLimitCheck.allowed) {
      console.debug('Notification rate limited:', event.source, event.priority);
      telemetry.eventsDropped += 1;
      telemetry.rateLimitedByPriority[event.priority] += 1;
      return;
    }
  }

  // Classification
  const classified = classifyEvent(event);
  if (!classified) {
    telemetry.eventsDropped += 1;
    return;
  }

  telemetry.eventsClassified += 1;

  // Track CRITICAL events
  if (classified.priority === 'CRITICAL') {
    telemetry.criticalsSurfaced += 1;
  }

  // Persist to store
  const notification: Notification = {
    notificationId: classified.notificationId,
    appId,
    eventId: classified.eventId,
    eventType: classified.eventType,
    priority: classified.priority,
    source: classified.source,
    message: classified.message,
    actionRoute: classified.actionRoute,
    createdAt: classified.createdAt,
    expiresAt: classified.expiresAt,
    isRead: false,
  };

  try {
    await notificationStoreService.create(notification);
    telemetry.eventsDelivered += 1;

    // Notify listeners (UI, etc.)
    for (const listener of listeners) {
      try {
        listener(classified);
      } catch (err) {
        console.error('Error in notification listener:', err);
      }
    }
  } catch (err) {
    console.error('Failed to persist notification:', err);
    telemetry.eventsDropped += 1;
  }
};

/**
 * Handle Vaidyar health event
 */
const handleVaidyarHealthEvent = async (event: VaidyarHealthEvent): Promise<void> => {
  // Vaidyar events MUST bypass filtering per spec §8.3
  await emitNotification({
    eventId: event.eventId,
    eventType: event.eventType,
    priority: event.priority,
    source: event.subsystem,
    message: event.message,
    payload: event.payload,
  });
};

/**
 * Handle hook system notification
 */
const handleHookNotification = async (notification: HookNotification): Promise<void> => {
  // Map hook severity to priority
  const priorityMap: Record<string, NotificationPriority> = {
    CRITICAL: 'CRITICAL',
    WARNING: 'WARN',
    INFO: 'INFO',
  };

  await emitNotification({
    eventType: `system:hook_notification`,
    priority: priorityMap[notification.severity] || 'INFO',
    source: notification.source,
    message: notification.message,
    payload: { hookNotificationId: notification.id },
  });
};

export const notificationCentreService = {
  /**
   * Initialize the notification centre
   */
  async initialize(currentAppId: string): Promise<void> {
    appId = currentAppId;

    // Subscribe to Vaidyar health events
    vaidyarService.onHealthEvent(event => {
      handleVaidyarHealthEvent(event).catch(err => {
        console.error('Failed to handle Vaidyar event:', err);
      });
    });

    // Subscribe to hook system notifications
    const hookSystemModule = require('./hookSystemService');
    if (hookSystemModule && hookSystemModule.hookSystemService) {
      // Note: This is a workaround. In practice, hookSystemService needs to expose
      // an event emitter or subscription method. For now, we'll handle this in ipcService.
    }
  },

  /**
   * Subscribe to notifications
   */
  subscribe(listener: NotificationListener): () => void {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    };
  },

  /**
   * Emit a notification (internal, called by event sources)
   */
  async emit(event: {
    eventId?: string;
    eventType: string;
    priority: NotificationPriority;
    source: string;
    message: string;
    actionRoute?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await emitNotification(event);
  },

  /**
   * Get notifications
   */
  async getNotifications(
    filters: NotificationListFilters = {},
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ items: Notification[]; total: number }> {
    return notificationStoreService.list(appId, filters, limit, offset);
  },

  /**
   * Mark notifications as read
   */
  async markRead(notificationIds: string[]): Promise<number> {
    return notificationStoreService.markRead(appId, notificationIds);
  },

  /**
   * Mark notifications as dismissed
   */
  async markDismissed(notificationIds: string[]): Promise<number> {
    return notificationStoreService.markDismissed(appId, notificationIds);
  },

  /**
   * Record user action
   */
  async recordAction(
    notificationId: string,
    action: 'VIEWED' | 'DISMISSED' | 'ACTIONED',
  ): Promise<void> {
    return notificationStoreService.recordAction(appId, notificationId, action);
  },

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    return notificationStoreService.getUnreadCount(appId);
  },

  /**
   * Get telemetry
   */
  async getTelemetry(): Promise<{
    centre: NotificationCentreTelemetry;
    store: Record<string, number>;
    rateLimiter: ReturnType<typeof notificationRateLimiterService.getTelemetry>;
  }> {
    return {
      centre: { ...telemetry },
      store: await notificationStoreService.getTelemetry(appId),
      rateLimiter: notificationRateLimiterService.getTelemetry(),
    };
  },

  /**
   * Cleanup old notifications
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    return notificationStoreService.cleanup(appId, olderThanDays);
  },

  /**
   * Reset state (for testing)
   */
  async reset(): Promise<void> {
    listeners.length = 0;
    telemetry = {
      eventsEmitted: 0,
      eventsClassified: 0,
      eventsDelivered: 0,
      eventsDropped: 0,
      criticalsSurfaced: 0,
      rateLimitedByPriority: {
        CRITICAL: 0,
        ACTION: 0,
        WARN: 0,
        INFO: 0,
      },
    };
    notificationRateLimiterService.resetAll();
    await notificationStoreService.deleteAllForApp(appId);
  },
};
