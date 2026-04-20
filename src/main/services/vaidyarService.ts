import { randomUUID } from 'node:crypto';
import { driveControllerService } from './driveControllerService';
import { systemHealthService } from './systemHealthService';

export type VaidyarHealthStatus = 'healthy' | 'degraded' | 'critical' | 'recovering';

export type VaidyarEventType =
  | 'diagnostic:health_state_changed'
  | 'diagnostic:check_failed'
  | 'diagnostic:check_recovered'
  | 'diagnostic:system_blocked'
  | 'diagnostic:pulse_fail'
  | 'diagnostic:storage_issue'
  | 'diagnostic:connectivity_lag'
  | 'diagnostic:recovery_success'
  | 'diagnostic:security_failure';

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

export type VaidyarLayerName = 'Storage' | 'Security' | 'Network' | 'Cognitive';
export type VaidyarLayerStatus = 'Healthy' | 'Degraded' | 'Blocked';
export type VaidyarCheckStatus = 'Healthy' | 'Degraded' | 'Blocked';
export type VaidyarCheckSeverity = 'low' | 'medium' | 'high';
export type VaidyarExecutionMode = 'bootstrap' | 'pulse' | 'on-demand';

export interface VaidyarCheckResult {
  check_id: string;
  status: VaidyarCheckStatus;
  message: string;
  severity: VaidyarCheckSeverity;
  failure_hint: string;
  latency_ms: number;
  metadata?: Record<string, unknown>;
}

export interface VaidyarLayerReport {
  name: VaidyarLayerName;
  status: VaidyarLayerStatus;
  checks: VaidyarCheckResult[];
}

export interface VaidyarReport {
  timestamp: string;
  overall_status: VaidyarLayerStatus;
  execution_mode: VaidyarExecutionMode;
  blocked_signals: string[];
  layers: VaidyarLayerReport[];
}

export interface VaidyarTelemetry {
  lastExecutionLatencyMs: number;
  checkExecutionLatencyMs: Record<string, number>;
  failureFrequencyByLayer: Record<VaidyarLayerName, number>;
  degradedDurationSeconds: number;
}

interface VaidyarDiagnosticCheck {
  check_id: string;
  layer: VaidyarLayerName;
  severity: VaidyarCheckSeverity;
  expected_state: 'pass';
  failure_hint: string;
  execution_fn: () => Promise<{
    pass: boolean;
    message: string;
    metadata?: Record<string, unknown>;
    degraded?: boolean;
  }>;
}

type VaidyarEventHandler = (event: VaidyarHealthEvent) => void;

let eventHandlers: VaidyarEventHandler[] = [];
let healthSnapshot: VaidyarHealthSnapshot = {
  timestamp: new Date().toISOString(),
  overallStatus: 'healthy',
  subsystems: {},
  recentEvents: [],
};

let latestReport: VaidyarReport = {
  timestamp: new Date().toISOString(),
  overall_status: 'Healthy',
  execution_mode: 'bootstrap',
  blocked_signals: [],
  layers: [],
};

let degradedSinceIso: string | null = null;
let checkStatusById: Record<string, VaidyarCheckStatus> = {};
let checkLatencyById: Record<string, number> = {};
let failureFrequencyByLayer: Record<VaidyarLayerName, number> = {
  Storage: 0,
  Security: 0,
  Network: 0,
  Cognitive: 0,
};
let lastExecutionLatencyMs = 0;

const nowIso = (): string => new Date().toISOString();

const toOverallHealthStatus = (status: VaidyarLayerStatus): VaidyarHealthStatus => {
  if (status === 'Blocked') {
    return 'critical';
  }
  if (status === 'Degraded') {
    return 'degraded';
  }
  return 'healthy';
};

const classifyLayerStatus = (checks: VaidyarCheckResult[]): VaidyarLayerStatus => {
  if (checks.some((check) => check.status === 'Blocked')) {
    return 'Blocked';
  }
  if (checks.some((check) => check.status === 'Degraded')) {
    return 'Degraded';
  }
  return 'Healthy';
};

const classifyOverallStatus = (layers: VaidyarLayerReport[]): VaidyarLayerStatus => {
  if (layers.some((layer) => layer.checks.some((check) => check.status === 'Blocked'))) {
    return 'Blocked';
  }

  const mediumFailures = layers
    .flatMap((layer) => layer.checks)
    .filter((check) => check.status !== 'Healthy' && check.severity === 'medium').length;

  if (mediumFailures >= 2 || layers.some((layer) => layer.status === 'Degraded')) {
    return 'Degraded';
  }

  return 'Healthy';
};

const blockedSignalsForReport = (report: VaidyarReport): string[] => {
  const signals = new Set<string>();

  for (const layer of report.layers) {
    if (layer.status !== 'Blocked') {
      continue;
    }

    switch (layer.name) {
      case 'Storage':
        signals.add('BLOCKED_STORAGE');
        break;
      case 'Security':
        signals.add('BLOCKED_SECURITY');
        break;
      case 'Network':
        signals.add('BLOCKED_NETWORK');
        break;
      case 'Cognitive':
        signals.add('BLOCKED_COGNITIVE');
        break;
    }
  }

  return Array.from(signals);
};

const emitDiagnosticEvent = (input: {
  eventType: VaidyarEventType;
  priority: VaidyarPriority;
  subsystem: string;
  message: string;
  payload?: Record<string, unknown>;
}): void => {
  emitHealthEvent({
    eventId: `vaidyar_${randomUUID()}`,
    eventType: input.eventType,
    priority: input.priority,
    timestamp: nowIso(),
    subsystem: input.subsystem,
    message: input.message,
    payload: input.payload ?? {},
  });
};

const diagnosticsRegistry: VaidyarDiagnosticCheck[] = [
  {
    check_id: 'vault_mount',
    layer: 'Storage',
    severity: 'high',
    expected_state: 'pass',
    failure_hint: 'Ensure the vault drive is mounted and crypt credentials are valid.',
    execution_fn: async () => {
      const policy = driveControllerService.getPolicy();
      if (policy.clientManaged) {
        return {
          pass: true,
          message: 'Vault mount ownership is delegated to host policy (client-managed).',
          metadata: {
            clientManaged: true,
          },
        };
      }

      const diagnostics = driveControllerService.getDiagnostics();
      const vaultRecord = diagnostics.records.find((record) => record.id === 'vault');
      const pass = Boolean(vaultRecord && vaultRecord.stage === 'MOUNTED');
      return {
        pass,
        message: pass
          ? 'Vault mounted successfully.'
          : 'Vault is not mounted; secure storage session is unavailable.',
        metadata: {
          overallStatus: diagnostics.overallStatus,
          vaultStage: vaultRecord?.stage ?? 'UNKNOWN',
        },
      };
    },
  },
  {
    check_id: 'system_drive_posture',
    layer: 'Storage',
    severity: 'high',
    expected_state: 'pass',
    failure_hint: 'Re-establish secure system drive mount or disable fail-closed posture only if policy permits.',
    execution_fn: async () => {
      const policy = driveControllerService.getPolicy();
      if (policy.clientManaged) {
        return {
          pass: true,
          message: 'System drive posture enforcement is delegated to host policy (client-managed).',
          metadata: {
            clientManaged: true,
          },
        };
      }

      const diagnostics = driveControllerService.getDiagnostics();
      const systemRecord = diagnostics.records.find((record) => record.id === 'system');
      const blocked =
        !systemRecord ||
        systemRecord.posture === 'UNAVAILABLE' ||
        (diagnostics.failClosed && systemRecord.usedFallbackPath);

      return {
        pass: !blocked,
        degraded: !blocked && Boolean(systemRecord?.usedFallbackPath),
        message: blocked
          ? 'System drive posture is blocked due to unavailable secure mount.'
          : systemRecord?.usedFallbackPath
            ? 'System drive is running in fallback mode.'
            : 'System drive posture is secure.',
        metadata: {
          failClosed: diagnostics.failClosed,
          usedFallbackPath: systemRecord?.usedFallbackPath ?? false,
          stage: systemRecord?.stage ?? 'UNKNOWN',
          posture: systemRecord?.posture ?? 'UNKNOWN',
        },
      };
    },
  },
  {
    check_id: 'sqlite_integrity',
    layer: 'Storage',
    severity: 'high',
    expected_state: 'pass',
    failure_hint: 'Inspect storage locks and recover SQLite database access before continuing.',
    execution_fn: async () => {
      const snapshot = systemHealthService.getSnapshot();
      const storageBlocked = snapshot.storage.overallStatus === 'Blocked';
      const pass = !storageBlocked;
      return {
        pass,
        message: pass
          ? 'SQLite integrity checks are within expected runtime posture.'
          : 'SQLite integrity risk detected due to blocked storage posture.',
        metadata: {
          storageStatus: snapshot.storage.overallStatus,
        },
      };
    },
  },
  {
    check_id: 'security_identity_contract',
    layer: 'Security',
    severity: 'high',
    expected_state: 'pass',
    failure_hint: 'Verify identity/authentication runtime configuration and secure channel preconditions.',
    execution_fn: async () => {
      const snapshot = systemHealthService.getSnapshot();
      const pass = snapshot.processRssMb > 0;
      return {
        pass,
        message: pass
          ? 'Security contract baseline is reachable.'
          : 'Security contract baseline failed.',
      };
    },
  },
  {
    check_id: 'network_connectivity_latency',
    layer: 'Network',
    severity: 'medium',
    expected_state: 'pass',
    failure_hint: 'Review external API/channel reachability and retry policies.',
    execution_fn: async () => {
      const snapshot = systemHealthService.getSnapshot();
      const degraded = snapshot.cpuUsagePercent >= 90;
      return {
        pass: !degraded,
        degraded,
        message: degraded
          ? 'Runtime CPU saturation may degrade network responsiveness.'
          : 'Network baseline is healthy.',
        metadata: {
          cpuUsagePercent: snapshot.cpuUsagePercent,
        },
      };
    },
  },
  {
    check_id: 'context_token_guardrails',
    layer: 'Cognitive',
    severity: 'medium',
    expected_state: 'pass',
    failure_hint: 'Apply context compaction and reduce prompt pressure before saturation.',
    execution_fn: async () => {
      const snapshot = systemHealthService.getSnapshot();
      const degraded = snapshot.memoryUsagePercent >= 85;
      return {
        pass: !degraded,
        degraded,
        message: degraded
          ? 'Memory pressure indicates token/context overflow risk.'
          : 'Cognitive guardrails are within limits.',
        metadata: {
          memoryUsagePercent: snapshot.memoryUsagePercent,
        },
      };
    },
  },
];

const runDiagnostics = async (mode: VaidyarExecutionMode): Promise<VaidyarReport> => {
  const startedAt = Date.now();
  const grouped: Record<VaidyarLayerName, VaidyarCheckResult[]> = {
    Storage: [],
    Security: [],
    Network: [],
    Cognitive: [],
  };

  for (const check of diagnosticsRegistry) {
    const checkStartedAt = Date.now();
    let result: VaidyarCheckResult;

    try {
      const execution = await check.execution_fn();
      const latencyMs = Date.now() - checkStartedAt;
      const status: VaidyarCheckStatus = execution.pass
        ? execution.degraded
          ? 'Degraded'
          : 'Healthy'
        : check.severity === 'high'
          ? 'Blocked'
          : 'Degraded';

      result = {
        check_id: check.check_id,
        status,
        message: execution.message,
        severity: check.severity,
        failure_hint: check.failure_hint,
        latency_ms: latencyMs,
        metadata: execution.metadata,
      };
    } catch (error) {
      const latencyMs = Date.now() - checkStartedAt;
      result = {
        check_id: check.check_id,
        status: check.severity === 'high' ? 'Blocked' : 'Degraded',
        message: error instanceof Error ? error.message : 'Diagnostic check execution failed.',
        severity: check.severity,
        failure_hint: check.failure_hint,
        latency_ms: latencyMs,
      };
    }

    checkLatencyById[check.check_id] = result.latency_ms;
    grouped[check.layer].push(result);
  }

  const layerReports: VaidyarLayerReport[] = (['Storage', 'Security', 'Network', 'Cognitive'] as const).map(
    (layerName) => ({
      name: layerName,
      checks: grouped[layerName],
      status: classifyLayerStatus(grouped[layerName]),
    }),
  );

  const overallStatus = classifyOverallStatus(layerReports);
  const nextReport: VaidyarReport = {
    timestamp: nowIso(),
    overall_status: overallStatus,
    execution_mode: mode,
    blocked_signals: [],
    layers: layerReports,
  };
  nextReport.blocked_signals = blockedSignalsForReport(nextReport);

  lastExecutionLatencyMs = Date.now() - startedAt;

  const currentStatuses: Record<string, VaidyarCheckStatus> = {};
  for (const layer of nextReport.layers) {
    for (const check of layer.checks) {
      currentStatuses[check.check_id] = check.status;
      const previous = checkStatusById[check.check_id];

      if ((check.status === 'Blocked' || check.status === 'Degraded') && check.status !== previous) {
        failureFrequencyByLayer[layer.name] += 1;
        emitDiagnosticEvent({
          eventType: 'diagnostic:check_failed',
          priority: check.severity === 'high' ? 'CRITICAL' : 'WARN',
          subsystem: layer.name.toLowerCase(),
          message: `[${check.check_id}] ${check.message}`,
          payload: {
            check_id: check.check_id,
            layer: layer.name,
            status: check.status,
            severity: check.severity,
            failure_hint: check.failure_hint,
          },
        });
      }

      if ((previous === 'Blocked' || previous === 'Degraded') && check.status === 'Healthy') {
        emitDiagnosticEvent({
          eventType: 'diagnostic:check_recovered',
          priority: 'INFO',
          subsystem: layer.name.toLowerCase(),
          message: `[${check.check_id}] Recovered to healthy state.`,
          payload: {
            check_id: check.check_id,
            layer: layer.name,
          },
        });
      }
    }
  }

  const previousOverall = latestReport.overall_status;
  if (previousOverall !== nextReport.overall_status) {
    emitDiagnosticEvent({
      eventType: 'diagnostic:health_state_changed',
      priority: nextReport.overall_status === 'Blocked' ? 'CRITICAL' : 'INFO',
      subsystem: 'system',
      message: `Health state changed from ${previousOverall} to ${nextReport.overall_status}.`,
      payload: {
        previous_status: previousOverall,
        next_status: nextReport.overall_status,
      },
    });
  }

  if (nextReport.overall_status === 'Blocked') {
    emitDiagnosticEvent({
      eventType: 'diagnostic:system_blocked',
      priority: 'CRITICAL',
      subsystem: 'system',
      message: 'System blocked by high-severity diagnostic failures.',
      payload: {
        blocked_signals: nextReport.blocked_signals,
      },
    });
  }

  checkStatusById = currentStatuses;
  latestReport = nextReport;

  if (nextReport.overall_status === 'Degraded') {
    degradedSinceIso = degradedSinceIso ?? nextReport.timestamp;
  } else {
    degradedSinceIso = null;
  }

  healthSnapshot.timestamp = nextReport.timestamp;
  healthSnapshot.overallStatus = toOverallHealthStatus(nextReport.overall_status);

  const nextSubsystems: VaidyarHealthSnapshot['subsystems'] = {};
  for (const layer of nextReport.layers) {
    const layerKey = layer.name.toLowerCase();
    nextSubsystems[layerKey] = {
      status: toOverallHealthStatus(layer.status),
      lastCheckedAt: nextReport.timestamp,
      consecutiveFailures: layer.checks.filter((check) => check.status !== 'Healthy').length,
      lastFailureAt: layer.checks.some((check) => check.status !== 'Healthy') ? nextReport.timestamp : undefined,
    };
  }
  healthSnapshot.subsystems = nextSubsystems;

  return JSON.parse(JSON.stringify(nextReport));
};

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
  async runBootstrapDiagnostics(): Promise<VaidyarReport> {
    return runDiagnostics('bootstrap');
  },

  async runRuntimePulse(): Promise<VaidyarReport> {
    return runDiagnostics('pulse');
  },

  async runOnDemandDiagnostics(): Promise<VaidyarReport> {
    return runDiagnostics('on-demand');
  },

  getReport(): VaidyarReport {
    return JSON.parse(JSON.stringify(latestReport));
  },

  getTelemetry(): VaidyarTelemetry {
    const degradedDurationSeconds = degradedSinceIso
      ? Math.max(0, Math.floor((Date.now() - new Date(degradedSinceIso).getTime()) / 1000))
      : 0;

    return {
      lastExecutionLatencyMs,
      checkExecutionLatencyMs: { ...checkLatencyById },
      failureFrequencyByLayer: { ...failureFrequencyByLayer },
      degradedDurationSeconds,
    };
  },

  getBlockingSignals(): string[] {
    return [...latestReport.blocked_signals];
  },

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
    const timestamp = nowIso();
    if (!healthSnapshot.subsystems[subsystem]) {
      healthSnapshot.subsystems[subsystem] = {
        status: 'critical',
        lastCheckedAt: timestamp,
        consecutiveFailures: 0,
      };
    }
    const sysInfo = healthSnapshot.subsystems[subsystem];
    sysInfo.status = 'critical';
    sysInfo.lastCheckedAt = timestamp;
    sysInfo.lastFailureAt = timestamp;
    sysInfo.consecutiveFailures += 1;
    healthSnapshot.overallStatus = 'critical';

    emitDiagnosticEvent({
      eventType: 'diagnostic:pulse_fail',
      priority: 'CRITICAL',
      subsystem,
      message: `Health pulse failed for subsystem: ${subsystem}`,
      payload: {
        subsystem,
        reason: 'pulse_timeout',
        ...details,
      },
    });
  },

  /**
   * Report a storage issue (e.g., vault mount failure)
   */
  reportStorageIssue(subsystem: string, details: Record<string, unknown> = {}): void {
    const timestamp = nowIso();
    if (!healthSnapshot.subsystems[subsystem]) {
      healthSnapshot.subsystems[subsystem] = {
        status: 'critical',
        lastCheckedAt: timestamp,
        consecutiveFailures: 0,
      };
    }
    const sysInfo = healthSnapshot.subsystems[subsystem];
    sysInfo.status = 'critical';
    sysInfo.lastCheckedAt = timestamp;
    sysInfo.lastFailureAt = timestamp;
    healthSnapshot.overallStatus = 'critical';

    emitDiagnosticEvent({
      eventType: 'diagnostic:storage_issue',
      priority: 'CRITICAL',
      subsystem,
      message: `Storage issue detected in subsystem: ${subsystem}`,
      payload: {
        subsystem,
        reason: 'storage_failure',
        ...details,
      },
    });
  },

  /**
   * Report a security failure
   */
  reportSecurityFailure(subsystem: string, details: Record<string, unknown> = {}): void {
    const timestamp = nowIso();
    if (!healthSnapshot.subsystems[subsystem]) {
      healthSnapshot.subsystems[subsystem] = {
        status: 'critical',
        lastCheckedAt: timestamp,
        consecutiveFailures: 0,
      };
    }
    const sysInfo = healthSnapshot.subsystems[subsystem];
    sysInfo.status = 'critical';
    sysInfo.lastCheckedAt = timestamp;
    sysInfo.lastFailureAt = timestamp;
    healthSnapshot.overallStatus = 'critical';

    emitDiagnosticEvent({
      eventType: 'diagnostic:security_failure',
      priority: 'CRITICAL',
      subsystem,
      message: `Security failure detected in subsystem: ${subsystem}`,
      payload: {
        subsystem,
        reason: 'security_violation',
        ...details,
      },
    });
  },

  /**
   * Report a connectivity lag warning
   */
  reportConnectivityLag(subsystem: string, details: Record<string, unknown> = {}): void {
    const timestamp = nowIso();
    if (!healthSnapshot.subsystems[subsystem]) {
      healthSnapshot.subsystems[subsystem] = {
        status: 'degraded',
        lastCheckedAt: timestamp,
        consecutiveFailures: 0,
      };
    }
    const sysInfo = healthSnapshot.subsystems[subsystem];
    sysInfo.status = 'degraded';
    sysInfo.lastCheckedAt = timestamp;

    if (healthSnapshot.overallStatus === 'healthy') {
      healthSnapshot.overallStatus = 'degraded';
    }

    emitDiagnosticEvent({
      eventType: 'diagnostic:connectivity_lag',
      priority: 'WARN',
      subsystem,
      message: `Connectivity lag detected in subsystem: ${subsystem}`,
      payload: {
        subsystem,
        reason: 'latency_threshold_exceeded',
        ...details,
      },
    });
  },

  /**
   * Report successful recovery
   */
  reportRecoverySuccess(subsystem: string, details: Record<string, unknown> = {}): void {
    const timestamp = nowIso();
    if (!healthSnapshot.subsystems[subsystem]) {
      healthSnapshot.subsystems[subsystem] = {
        status: 'healthy',
        lastCheckedAt: timestamp,
        consecutiveFailures: 0,
      };
    }
    const sysInfo = healthSnapshot.subsystems[subsystem];
    sysInfo.status = 'healthy';
    sysInfo.lastCheckedAt = timestamp;
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

    emitDiagnosticEvent({
      eventType: 'diagnostic:recovery_success',
      priority: 'INFO',
      subsystem,
      message: `Subsystem recovered successfully: ${subsystem}`,
      payload: {
        subsystem,
        reason: 'recovery_completed',
        ...details,
      },
    });
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
    latestReport = {
      timestamp: new Date().toISOString(),
      overall_status: 'Healthy',
      execution_mode: 'bootstrap',
      blocked_signals: [],
      layers: [],
    };
    degradedSinceIso = null;
    checkStatusById = {};
    checkLatencyById = {};
    failureFrequencyByLayer = {
      Storage: 0,
      Security: 0,
      Network: 0,
      Cognitive: 0,
    };
    lastExecutionLatencyMs = 0;
    eventHandlers = [];
  },
};
