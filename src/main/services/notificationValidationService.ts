import DOMPurify from 'isomorphic-dompurify';

export type NotificationEventDomain = 'system' | 'storage' | 'integration' | 'agent' | 'diagnostic';

export interface EventSchemaValidationError {
  field: string;
  message: string;
}

/**
 * Validates event types against the naming convention: <domain>:<action>[:<state>]
 */
export const validateEventType = (eventType: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!eventType || typeof eventType !== 'string') {
    errors.push('eventType must be a non-empty string');
    return { valid: false, errors };
  }

  const parts = eventType.split(':');
  if (parts.length < 2 || parts.length > 3) {
    errors.push(
      `eventType must follow format <domain>:<action>[:<state>], got: ${eventType}`,
    );
    return { valid: false, errors };
  }

  const [domain, action, state] = parts;

  // Validate domain
  const validDomains: NotificationEventDomain[] = [
    'system',
    'storage',
    'integration',
    'agent',
    'diagnostic',
  ];
  if (!validDomains.includes(domain as NotificationEventDomain)) {
    errors.push(
      `domain must be one of [${validDomains.join(', ')}], got: ${domain}`,
    );
  }

  // Validate action (alphanumeric + underscore)
  if (!/^[a-z0-9_]+$/.test(action)) {
    errors.push(
      `action must be lowercase alphanumeric + underscore, got: ${action}`,
    );
  }

  // Validate state if present (alphanumeric + underscore)
  if (state && !/^[a-z0-9_]+$/.test(state)) {
    errors.push(
      `state must be lowercase alphanumeric + underscore, got: ${state}`,
    );
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Sanitizes message text to prevent XSS attacks
 */
export const sanitizeMessage = (message: string): string => {
  if (typeof message !== 'string') {
    return '';
  }

  // Strip HTML tags and decode entities
  const sanitized = DOMPurify.sanitize(message, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  // Limit length
  const maxLength = 500;
  if (sanitized.length > maxLength) {
    return sanitized.substring(0, maxLength) + '…';
  }

  return sanitized;
};

/**
 * Validates a complete notification payload
 */
export const validateNotificationPayload = (payload: Record<string, unknown>): {
  valid: boolean;
  errors: EventSchemaValidationError[];
} => {
  const errors: EventSchemaValidationError[] = [];

  // Validate eventType
  if (!payload.eventType || typeof payload.eventType !== 'string') {
    errors.push({
      field: 'eventType',
      message: 'eventType must be a non-empty string',
    });
  } else {
    const eventTypeValidation = validateEventType(payload.eventType as string);
    if (!eventTypeValidation.valid) {
      errors.push({
        field: 'eventType',
        message: eventTypeValidation.errors.join('; '),
      });
    }
  }

  // Validate priority
  if (!payload.priority || typeof payload.priority !== 'string') {
    errors.push({
      field: 'priority',
      message: 'priority must be a non-empty string',
    });
  } else {
    const validPriorities = ['INFO', 'WARN', 'CRITICAL', 'ACTION'];
    if (!validPriorities.includes(payload.priority as string)) {
      errors.push({
        field: 'priority',
        message: `priority must be one of [${validPriorities.join(', ')}], got: ${payload.priority}`,
      });
    }
  }

  // Validate source
  if (!payload.source || typeof payload.source !== 'string') {
    errors.push({
      field: 'source',
      message: 'source must be a non-empty string',
    });
  } else if (!/^[a-zA-Z0-9_.-]+$/.test(payload.source as string)) {
    errors.push({
      field: 'source',
      message: `source must be alphanumeric + underscore/dash/dot, got: ${payload.source}`,
    });
  }

  // Validate message
  if (!payload.message || typeof payload.message !== 'string') {
    errors.push({
      field: 'message',
      message: 'message must be a non-empty string',
    });
  }

  // Validate eventId if present
  if (payload.eventId && typeof payload.eventId !== 'string') {
    errors.push({
      field: 'eventId',
      message: 'eventId must be a string if provided',
    });
  }

  // Validate actionRoute if present
  if (payload.actionRoute && typeof payload.actionRoute !== 'string') {
    errors.push({
      field: 'actionRoute',
      message: 'actionRoute must be a string if provided',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const notificationValidationService = {
  /**
   * Validate event type naming convention
   */
  validateEventType,

  /**
   * Sanitize message to prevent XSS
   */
  sanitizeMessage,

  /**
   * Validate complete notification payload
   */
  validateNotificationPayload,

  /**
   * Sanitize entire notification object
   */
  sanitizeNotification(notification: any): any {
    if (!notification || typeof notification !== 'object') {
      return null;
    }

    return {
      eventId: notification.eventId ? String(notification.eventId).substring(0, 100) : undefined,
      eventType: notification.eventType ? String(notification.eventType).substring(0, 100) : '',
      priority: notification.priority ? String(notification.priority).substring(0, 20) : 'INFO',
      source: notification.source ? String(notification.source).substring(0, 100) : '',
      message: this.sanitizeMessage(notification.message),
      actionRoute: notification.actionRoute ? String(notification.actionRoute).substring(0, 200) : undefined,
      payload: notification.payload ? this.sanitizePayload(notification.payload) : undefined,
    };
  },

  /**
   * Sanitize nested payload object
   */
  sanitizePayload(payload: any, depth: number = 0, maxDepth: number = 5): any {
    if (depth > maxDepth) {
      return null;
    }

    if (payload === null || payload === undefined) {
      return null;
    }

    if (typeof payload === 'string') {
      return this.sanitizeMessage(payload);
    }

    if (typeof payload === 'number' || typeof payload === 'boolean') {
      return payload;
    }

    if (Array.isArray(payload)) {
      return payload.slice(0, 10).map(item => this.sanitizePayload(item, depth + 1, maxDepth));
    }

    if (typeof payload === 'object') {
      const sanitized: Record<string, any> = {};
      const keys = Object.keys(payload).slice(0, 20); // Limit keys
      for (const key of keys) {
        if (!/^[a-zA-Z0-9_]+$/.test(key)) {
          continue; // Skip suspicious keys
        }
        sanitized[key] = this.sanitizePayload((payload as any)[key], depth + 1, maxDepth);
      }
      return sanitized;
    }

    return null;
  },
};
