import { randomUUID } from 'node:crypto';

export type SubscriptionId = string;

export interface RuntimeEvent {
  eventId?: string;
  timestamp?: number;
  eventType: string;
  source: string;
  payload?: Record<string, unknown>;
}

export type EventHandler = (event: RuntimeEvent) => void;

export interface IEventRegistry {
  emit(event: Omit<RuntimeEvent, 'eventId' | 'timestamp'> & { eventId?: string; timestamp?: number }): void;
  subscribe(pattern: string, handler: EventHandler): SubscriptionId;
  unsubscribe(subscriptionId: SubscriptionId): void;
  getMetrics(): EventRegistryMetrics;
}

export interface EventRegistryMetrics {
  eventsEmitted: number;
  eventsRejected: number;
  eventsRouted: number;
  deliveryFailures: number;
  activeSubscriptions: number;
  perChannel: Record<string, { emitted: number; deliveryFailures: number }>;
}

export class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventValidationError';
  }
}

type ServiceState = 'UNINITIALIZED' | 'OPERATIONAL' | 'STOPPING' | 'TERMINATED';

const EVENT_TYPE_PATTERN = /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_*-]+(:[a-zA-Z0-9_*-]+)?$/;

function isSerializable(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

function matchesPattern(pattern: string, eventType: string): boolean {
  const patternParts = pattern.split(':');
  const eventParts = eventType.split(':');
  if (patternParts.length !== eventParts.length) return false;
  return patternParts.every((part, i) => part === '*' || part === eventParts[i]);
}

class EventRegistryService implements IEventRegistry {
  private state: ServiceState = 'UNINITIALIZED';
  private subscriptions = new Map<SubscriptionId, { pattern: string; handler: EventHandler }>();
  private metrics: EventRegistryMetrics = {
    eventsEmitted: 0,
    eventsRejected: 0,
    eventsRouted: 0,
    deliveryFailures: 0,
    activeSubscriptions: 0,
    perChannel: {}
  };

  initialize(): void {
    this.state = 'OPERATIONAL';
  }

  emit(event: Omit<RuntimeEvent, 'eventId' | 'timestamp'> & { eventId?: string; timestamp?: number }): void {
    if (this.state !== 'OPERATIONAL') {
      throw new EventValidationError(
        `Event Registry is not OPERATIONAL (state: ${this.state}). Cannot emit events.`
      );
    }

    if (!event.eventType || !EVENT_TYPE_PATTERN.test(event.eventType)) {
      this.metrics.eventsRejected++;
      throw new EventValidationError(
        `Invalid eventType format: "${event.eventType}". Must match <domain>:<action>[:<state>].`
      );
    }

    if (!event.source || typeof event.source !== 'string' || event.source.trim() === '') {
      this.metrics.eventsRejected++;
      throw new EventValidationError('Event source must be present and non-empty.');
    }

    if (event.payload !== undefined && !isSerializable(event.payload)) {
      this.metrics.eventsRejected++;
      throw new EventValidationError('Event payload must be a serializable plain object.');
    }

    const fullEvent: RuntimeEvent = Object.freeze({
      eventId: randomUUID(),
      timestamp: Date.now(),
      eventType: event.eventType,
      source: event.source,
      ...(event.payload !== undefined ? { payload: event.payload } : {})
    });

    this.metrics.eventsEmitted++;
    const channel = fullEvent.eventType.split(':')[0];
    if (!this.metrics.perChannel[channel]) {
      this.metrics.perChannel[channel] = { emitted: 0, deliveryFailures: 0 };
    }
    this.metrics.perChannel[channel].emitted++;

    const matched = Array.from(this.subscriptions.entries()).filter(([, sub]) =>
      matchesPattern(sub.pattern, fullEvent.eventType)
    );

    if (matched.length === 0) return;

    this.metrics.eventsRouted++;

    for (const [, sub] of matched) {
      try {
        sub.handler(fullEvent);
      } catch {
        this.metrics.deliveryFailures++;
        this.metrics.perChannel[channel].deliveryFailures++;
      }
    }
  }

  subscribe(pattern: string, handler: EventHandler): SubscriptionId {
    if (!EVENT_TYPE_PATTERN.test(pattern)) {
      throw new EventValidationError(
        `Invalid subscription pattern: "${pattern}". Must match <domain>:<action>[:<state>] with single-segment wildcards only.`
      );
    }
    const id = randomUUID();
    this.subscriptions.set(id, { pattern, handler });
    this.metrics.activeSubscriptions++;
    return id;
  }

  unsubscribe(subscriptionId: SubscriptionId): void {
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.delete(subscriptionId);
      this.metrics.activeSubscriptions--;
    }
  }

  getMetrics(): EventRegistryMetrics {
    return { ...this.metrics, perChannel: { ...this.metrics.perChannel } };
  }

  teardown(): void {
    this.state = 'STOPPING';
    this.subscriptions.clear();
    this.metrics.activeSubscriptions = 0;
    this.state = 'TERMINATED';
  }
}

export const eventRegistryService = new EventRegistryService();
