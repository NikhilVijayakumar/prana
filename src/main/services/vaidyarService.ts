import { randomUUID } from 'node:crypto';

export type VaidyarHealthStatus = 'healthy' | 'degraded' | 'critical' | 'recovering';

export type VaidyarEventType =
  | 'vaidyar:pulse_fail'
  | 'vaidyar:storage_issue'
  | 'vaidyar:connectivity_lag'
  | 'vaidyar:recovery_success'
  | 'vaidyar:security_failure';

export type VaidyarPriority = 'CRITICAL' | 'WARN' | 'INFO';

export interface VaidyarHealthEvent {
  eventId: string;
  eventType: VaidyarEventType;
  priority: VaidyarPriority;
  timestamp: string;
  subsystem: string;
  message: string;
  payload: Record<string, unknown>;
}

export interface VaidyarHealthSnapshot {
  timestamp: string;
  overallStatus: VaidyarHealthStatus;
  subsystems: Record<
    string,
    {
      status: VaidyarHealthStatus;
      lastCheckedAt: string;
      lastFailureAt?: string;
      consecutiveFailures: number;
    }
  >;
  recentEvents: VaidyarHealthEvent[];
}

type VaidyarEventHandler = (event: VaidyarHealthEvent) => void;

let eventHandlers: VaidyarEventHandler[] = [];
let healthSnapshot: VaidyarHealthSnapshot = {
  timestamp: new Date().toISOString(),
  overallStatus: 'healthy',
  subsystems: {},
  recentEvents: [],
};

const nowIso = (): string => new Date().toISOString();

const emitHealthEvent = (event: VaidyarHealthEvent): void => {
  healthSnapshot.recentEvents.unshift(event);

  // Keep last 100 events in memory
  if (healthSnapshot.recentEvents.length > 100) {
    healthSnapshot.recentEvents.pop();
  }

  // Fire handlers synchronously
  for (const handler of eventHandlers) {
    try {
      handler(event);
    } catch (err) {
      console.error('Error in vaidyar event handler:', err);
    }
  }
};

export const vaidyarService = {
  /**
   * Register a handler to listen to health events
   */
  onHealthEvent(handler: VaidyarEventHandler): () => void {
    eventHandlers.push(handler);
    // Return unsubscription function
    return () => {
      eventHandlers = eventHandlers.filter(h => h !== handler);
    };
  },

  /**
   * Report a pulse failure (e.g., health check timeout)
   */
  reportPulseFail(subsystem: string, details: Record<string, unknown> = {}): void {
    const event: VaidyarHealthEvent = {
      eventId: `vaidyar_pulse_fail_${randomUUID()}`,
      eventType: 'vaidyar:pulse_fail',
      priority: 'CRITICAL',
      timestamp: nowIso(),
      subsystem,
      message: `Health pulse failed for subsystem: ${subsystem}`,
      payload: {
        subsystem,
        reason: 'pulse_timeout',
        ...details,
      },
    };

    // Update snapshot
    if (!healthSnapshot.subsystems[subsystem]) {
      healthSnapshot.subsystems[subsystem] = {
        status: 'critical',
        lastCheckedAt: event.timestamp,
        consecutiveFailures: 0,
      };
    }
    const sysInfo = healthSnapshot.subsystems[subsystem];
    sysInfo.status = 'critical';
    sysInfo.lastCheckedAt = event.timestamp;
    sysInfo.lastFailureAt = event.timestamp;
    sysInfo.consecutiveFailures += 1;
    healthSnapshot.overallStatus = 'critical';

    emitHealthEvent(event);
  },

  /**
   * Report a storage issue (e.g., vault mount failure)
   */
  reportStorageIssue(subsystem: string, details: Record<string, unknown> = {}): void {
    const event: VaidyarHealthEvent = {
      eventId: `vaidyar_storage_issue_${randomUUID()}`,
      eventType: 'vaidyar:storage_issue',
      priority: 'CRITICAL',
      timestamp: nowIso(),
      subsystem,
      message: `Storage issue detected in subsystem: ${subsystem}`,
      payload: {
        subsystem,
        reason: 'storage_failure',
        ...details,
      },
    };

    if (!healthSnapshot.subsystems[subsystem]) {
      healthSnapshot.subsystems[subsystem] = {
        status: 'critical',
        lastCheckedAt: event.timestamp,
        consecutiveFailures: 0,
      };
    }
    const sysInfo = healthSnapshot.subsystems[subsystem];
    sysInfo.status = 'critical';
    sysInfo.lastCheckedAt = event.timestamp;
    sysInfo.lastFailureAt = event.timestamp;
    healthSnapshot.overallStatus = 'critical';

    emitHealthEvent(event);
  },

  /**
   * Report a security failure
   */
  reportSecurityFailure(subsystem: string, details: Record<string, unknown> = {}): void {
    const event: VaidyarHealthEvent = {
      eventId: `vaidyar_security_failure_${randomUUID()}`,
      eventType: 'vaidyar:security_failure',
      priority: 'CRITICAL',
      timestamp: nowIso(),
      subsystem,
      message: `Security failure detected in subsystem: ${subsystem}`,
      payload: {
        subsystem,
        reason: 'security_violation',
        ...details,
      },
    };

    if (!healthSnapshot.subsystems[subsystem]) {
      healthSnapshot.subsystems[subsystem] = {
        status: 'critical',
        lastCheckedAt: event.timestamp,
        consecutiveFailures: 0,
      };
    }
    const sysInfo = healthSnapshot.subsystems[subsystem];
    sysInfo.status = 'critical';
    sysInfo.lastCheckedAt = event.timestamp;
    sysInfo.lastFailureAt = event.timestamp;
    healthSnapshot.overallStatus = 'critical';

    emitHealthEvent(event);
  },

  /**
   * Report a connectivity lag warning
   */
  reportConnectivityLag(subsystem: string, details: Record<string, unknown> = {}): void {
    const event: VaidyarHealthEvent = {
      eventId: `vaidyar_connectivity_lag_${randomUUID()}`,
      eventType: 'vaidyar:connectivity_lag',
      priority: 'WARN',
      timestamp: nowIso(),
      subsystem,
      message: `Connectivity lag detected in subsystem: ${subsystem}`,
      payload: {
        subsystem,
        reason: 'latency_threshold_exceeded',
        ...details,
      },
    };

    if (!healthSnapshot.subsystems[subsystem]) {
      healthSnapshot.subsystems[subsystem] = {
        status: 'degraded',
        lastCheckedAt: event.timestamp,
        consecutiveFailures: 0,
      };
    }
    const sysInfo = healthSnapshot.subsystems[subsystem];
    sysInfo.status = 'degraded';
    sysInfo.lastCheckedAt = event.timestamp;

    if (healthSnapshot.overallStatus === 'healthy') {
      healthSnapshot.overallStatus = 'degraded';
    }

    emitHealthEvent(event);
  },

  /**
   * Report successful recovery
   */
  reportRecoverySuccess(subsystem: string, details: Record<string, unknown> = {}): void {
    const event: VaidyarHealthEvent = {
      eventId: `vaidyar_recovery_success_${randomUUID()}`,
      eventType: 'vaidyar:recovery_success',
      priority: 'INFO',
      timestamp: nowIso(),
      subsystem,
      message: `Subsystem recovered successfully: ${subsystem}`,
      payload: {
        subsystem,
        reason: 'recovery_completed',
        ...details,
      },
    };

    if (!healthSnapshot.subsystems[subsystem]) {
      healthSnapshot.subsystems[subsystem] = {
        status: 'healthy',
        lastCheckedAt: event.timestamp,
        consecutiveFailures: 0,
      };
    }
    const sysInfo = healthSnapshot.subsystems[subsystem];
    sysInfo.status = 'healthy';
    sysInfo.lastCheckedAt = event.timestamp;
    sysInfo.consecutiveFailures = 0;

    // Recalculate overall status
    const statuses = Object.values(healthSnapshot.subsystems).map(s => s.status);
    if (statuses.every(s => s === 'healthy')) {
      healthSnapshot.overallStatus = 'healthy';
    } else if (statuses.some(s => s === 'critical')) {
      healthSnapshot.overallStatus = 'critical';
    } else {
      healthSnapshot.overallStatus = 'degraded';
    }

    emitHealthEvent(event);
  },

  /**
   * Get current health snapshot
   */
  getHealthSnapshot(): VaidyarHealthSnapshot {
    return JSON.parse(JSON.stringify(healthSnapshot)); // Deep clone
  },

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 20): VaidyarHealthEvent[] {
    return healthSnapshot.recentEvents.slice(0, limit);
  },

  /**
   * Get overall health status
   */
  getOverallStatus(): VaidyarHealthStatus {
    return healthSnapshot.overallStatus;
  },

  /**
   * Get subsystem status
   */
  getSubsystemStatus(subsystem: string): VaidyarHealthStatus | null {
    return healthSnapshot.subsystems[subsystem]?.status ?? null;
  },

  /**
   * Reset health state (for testing)
   */
  reset(): void {
    healthSnapshot = {
      timestamp: new Date().toISOString(),
      overallStatus: 'healthy',
      subsystems: {},
      recentEvents: [],
    };
    eventHandlers = [];
  },
};
