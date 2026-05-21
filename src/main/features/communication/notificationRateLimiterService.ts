export type NotificationPriority = 'INFO' | 'WARN' | 'CRITICAL' | 'ACTION';

export interface RateLimitConfig {
  priority: NotificationPriority;
  maxEventsPerSecond: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  limit?: number;
}

interface SourceRateLimiter {
  [priority: string]: {
    windowStart: number;
    count: number;
    limit: number;
  };
}

const DEFAULT_LIMITS: Record<NotificationPriority, number> = {
  CRITICAL: 1000, // Bypass effectively
  ACTION: 10,
  WARN: 5,
  INFO: 3,
};

const sourceLimiters = new Map<string, SourceRateLimiter>();
const globalDroppedCount = new Map<string, number>();

const WINDOW_SIZE_MS = 1000; // 1 second window

/**
 * Get or create limiter for a source
 */
const getLimiter = (source: string): SourceRateLimiter => {
  if (!sourceLimiters.has(source)) {
    sourceLimiters.set(source, {});
  }
  return sourceLimiters.get(source)!;
};

/**
 * Record dropped event
 */
const recordDropped = (source: string, priority: NotificationPriority): void => {
  const key = `${source}:${priority}`;
  globalDroppedCount.set(key, (globalDroppedCount.get(key) ?? 0) + 1);
};

export const notificationRateLimiterService = {
  /**
   * Check if an event should be allowed through the rate limiter
   */
  check(source: string, priority: NotificationPriority): RateLimitCheckResult {
    // CRITICAL events bypass all limiting
    if (priority === 'CRITICAL') {
      return { allowed: true };
    }

    const limiter = getLimiter(source);
    const limit = DEFAULT_LIMITS[priority];
    const now = Date.now();

    // Initialize or reset window if expired
    if (!limiter[priority]) {
      limiter[priority] = {
        windowStart: now,
        count: 0,
        limit,
      };
    }

    const record = limiter[priority];

    // Check if window has expired
    if (now - record.windowStart > WINDOW_SIZE_MS) {
      // Window expired, reset
      record.windowStart = now;
      record.count = 1;
      return { allowed: true };
    }

    // Check if we're within limit
    if (record.count < limit) {
      record.count += 1;
      return { allowed: true };
    }

    // Limit exceeded
    recordDropped(source, priority);
    return {
      allowed: false,
      reason: `Rate limit exceeded for ${source}:${priority} (${limit} events/sec)`,
      currentCount: record.count,
      limit,
    };
  },

  /**
   * Reset limiter for a specific source
   */
  resetSource(source: string): void {
    sourceLimiters.delete(source);
  },

  /**
   * Reset all limiters
   */
  resetAll(): void {
    sourceLimiters.clear();
    globalDroppedCount.clear();
  },

  /**
   * Get telemetry for all sources
   */
  getTelemetry(): {
    sources: Record<
      string,
      {
        priority: NotificationPriority;
        currentCount: number;
        limit: number;
      }[]
    >;
    droppedByPriority: Record<NotificationPriority, number>;
    totalDropped: number;
  } {
    const sources: Record<string, any[]> = {};

    for (const [source, limiter] of sourceLimiters.entries()) {
      sources[source] = [];
      for (const [priority, record] of Object.entries(limiter)) {
        sources[source].push({
          priority: priority as NotificationPriority,
          currentCount: record.count,
          limit: record.limit,
        });
      }
    }

    const droppedByPriority: Record<NotificationPriority, number> = {
      CRITICAL: globalDroppedCount.get('*:CRITICAL') ?? 0,
      ACTION: globalDroppedCount.get('*:ACTION') ?? 0,
      WARN: globalDroppedCount.get('*:WARN') ?? 0,
      INFO: globalDroppedCount.get('*:INFO') ?? 0,
    };

    let totalDropped = 0;
    for (const count of globalDroppedCount.values()) {
      totalDropped += count;
    }

    return {
      sources,
      droppedByPriority,
      totalDropped,
    };
  },

  /**
   * Get dropped count for a specific source:priority pair
   */
  getDroppedCount(source: string, priority: NotificationPriority): number {
    return globalDroppedCount.get(`${source}:${priority}`) ?? 0;
  },

  /**
   * Get total dropped count
   */
  getTotalDropped(): number {
    let total = 0;
    for (const count of globalDroppedCount.values()) {
      total += count;
    }
    return total;
  },
};
