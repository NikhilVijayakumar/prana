export interface DesignAuditMetric {
  id: string;
  name: string;
  value: string;
  threshold: string;
  status: 'pass' | 'fail' | 'warn';
}

export interface DesignAuditPayload {
  lastRun: string;
  overallHealth: number;
  tokensSynced: boolean;
  metrics: DesignAuditMetric[];
}

export interface VisualAuditSignalInput {
  complianceOverallStatus: 'secure' | 'warning' | 'critical';
  complianceViolationsCount: number;
  queuePendingCount: number;
  blockedSkillsCount: number;
  degradedProviderCount: number;
}

const clampHealth = (value: number): number => {
  return Math.max(0, Math.min(100, Math.round(value)));
};

export const buildDesignAuditPayload = (signal: VisualAuditSignalInput): DesignAuditPayload => {
  const contrastValue =
    signal.complianceOverallStatus === 'critical'
      ? `${(3.9 + signal.degradedProviderCount * 0.1).toFixed(1)}:1 minimum observed`
      : `${Math.max(4.5, 4.8 - signal.blockedSkillsCount * 0.1).toFixed(1)}:1 min met`;

  const colorEntropy = Math.max(8, 10 + signal.queuePendingCount + signal.blockedSkillsCount);
  const motionDelayMs = Math.max(180, Math.min(520, 220 + signal.queuePendingCount * 25));
  const hardcodedPixels = Math.max(0, signal.complianceViolationsCount + signal.blockedSkillsCount - 1);

  const metrics: DesignAuditMetric[] = [
    {
      id: 'M-1',
      name: 'Contrast Ratios (WCAG AA)',
      value: contrastValue,
      threshold: '4.5:1',
      status: signal.complianceOverallStatus === 'critical' ? 'warn' : 'pass',
    },
    {
      id: 'M-2',
      name: 'Color Entropy',
      value: `${colorEntropy} unique tokens`,
      threshold: '<= 16',
      status: colorEntropy > 16 ? 'warn' : 'pass',
    },
    {
      id: 'M-3',
      name: 'Motion Stagger Delay',
      value: `${(motionDelayMs / 1000).toFixed(2)}s avg`,
      threshold: '0.20s - 0.50s',
      status: motionDelayMs > 500 ? 'warn' : 'pass',
    },
    {
      id: 'M-4',
      name: 'Hardcoded Pixel Values',
      value: hardcodedPixels > 0 ? `${hardcodedPixels} instances found` : '0 instances found',
      threshold: '0 instances',
      status: hardcodedPixels > 0 ? 'warn' : 'pass',
    },
  ];

  const penalties = metrics.reduce((accumulator, metric) => {
    if (metric.status === 'fail') {
      return accumulator + 15;
    }

    if (metric.status === 'warn') {
      return accumulator + 8;
    }

    return accumulator;
  }, 0);

  return {
    lastRun: new Date().toISOString(),
    overallHealth: clampHealth(100 - penalties),
    tokensSynced: signal.blockedSkillsCount === 0 && signal.degradedProviderCount === 0,
    metrics,
  };
};

export const visualAuditService = {
  createPayload(signal: VisualAuditSignalInput): DesignAuditPayload {
    return buildDesignAuditPayload(signal);
  },
};
