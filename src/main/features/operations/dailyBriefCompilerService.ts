export interface TopRequest {
  id: string;
  sourceAgent: string;
  summary: string;
  classification: 'CRITICAL' | 'URGENT' | 'IMPORTANT';
}

export interface FunctionStatus {
  agentName: string;
  domain: string;
  health: 'ok' | 'warning' | 'critical';
  statusLine: string;
}

export interface ApprovalItem {
  id: string;
  source: string;
  description: string;
  expiresInHours: number;
}

export interface DailyBriefPayload {
  date: string;
  topRequests: TopRequest[];
  functionStatuses: FunctionStatus[];
  approvalQueue: ApprovalItem[];
  scheduleStatus: {
    enabledJobs: number;
    totalJobs: number;
    nextRunAt: string | null;
    lastRunAt: string | null;
  };
}

export interface DailyBriefCompilerInput {
  fallbackOrder: string[];
  unhealthyProviderNames: string[];
  blockedSkillCount: number;
  vaultFileCount: number;
  pendingWorkOrderCount?: number;
  recentWorkOrders?: Array<{
    id: string;
    targetEmployeeId: string;
    moduleRoute: string;
    state: string;
    priority: 'CRITICAL' | 'URGENT' | 'IMPORTANT' | 'ROUTINE';
  }>;
  schedules: Array<{
    enabled: boolean;
    nextRunAt?: string | null;
    lastRunAt?: string | null;
  }>;
  localeDate: string;
}

const firstSorted = (values: string[], ascending: boolean): string | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => (ascending ? (a < b ? -1 : 1) : a > b ? -1 : 1));
  return sorted[0] ?? null;
};

export const buildDailyBriefPayload = (input: DailyBriefCompilerInput): DailyBriefPayload => {
  const recentWorkOrderRequests: TopRequest[] = (input.recentWorkOrders ?? []).slice(0, 3).map((workOrder) => ({
    id: workOrder.id,
    sourceAgent: workOrder.targetEmployeeId.toUpperCase(),
    summary: `Work order ${workOrder.id} in ${workOrder.moduleRoute} is ${workOrder.state}.`,
    classification:
      workOrder.priority === 'CRITICAL'
        ? 'CRITICAL'
        : workOrder.priority === 'URGENT'
          ? 'URGENT'
          : 'IMPORTANT',
  }));

  const synthesizedRequests: TopRequest[] = [
    {
      id: 'R-1',
      sourceAgent: 'Julia (CTO)',
      summary: `Review model gateway status and fallback order (${input.fallbackOrder.join(' -> ')}).`,
      classification: input.unhealthyProviderNames.length > 0 ? 'CRITICAL' : 'IMPORTANT',
    },
    {
      id: 'R-2',
      sourceAgent: 'Eva (Compliance)',
      summary: `Validate ${input.blockedSkillCount} ineligible skills and policy requirements.`,
      classification: input.blockedSkillCount > 0 ? 'URGENT' : 'IMPORTANT',
    },
    {
      id: 'R-3',
      sourceAgent: 'Nora (CFO)',
      summary: `Confirm vault ingestion health. Indexed files: ${input.vaultFileCount}.`,
      classification: 'IMPORTANT',
    },
  ];

  const topRequests = recentWorkOrderRequests.length > 0 ? recentWorkOrderRequests : synthesizedRequests;

  const functionStatuses: FunctionStatus[] = [
    {
      agentName: 'Julia',
      domain: 'Technology',
      health: input.unhealthyProviderNames.length > 0 ? 'warning' : 'ok',
      statusLine:
        input.unhealthyProviderNames.length > 0
          ? `Degraded providers: ${input.unhealthyProviderNames.join(', ')}.`
          : 'Model gateway healthy across providers.',
    },
    {
      agentName: 'Eva',
      domain: 'Compliance',
      health: input.blockedSkillCount > 0 ? 'warning' : 'ok',
      statusLine:
        input.blockedSkillCount > 0
          ? `${input.blockedSkillCount} skills blocked by environment policy.`
          : 'All discovered skills meet eligibility checks.',
    },
    {
      agentName: 'Elina',
      domain: 'Operations',
      health: (input.pendingWorkOrderCount ?? 0) > 5 ? 'warning' : 'ok',
      statusLine:
        (input.pendingWorkOrderCount ?? 0) > 0
          ? `Pending work orders in runtime: ${input.pendingWorkOrderCount}.`
          : `Vault inventory and queue telemetry available. Files indexed: ${input.vaultFileCount}.`,
    },
  ];

  const approvalQueue: ApprovalItem[] = [
    {
      id: 'AQ-201',
      source: 'Vault Publish',
      description: 'Approve pending vault archive commit/push to data repository.',
      expiresInHours: 6,
    },
    {
      id: 'AQ-202',
      source: 'Settings',
      description: 'Approve engine order changes if fallback preference is updated.',
      expiresInHours: 24,
    },
  ];

  const nextRuns = input.schedules
    .map((job) => job.nextRunAt)
    .filter((value): value is string => Boolean(value));
  const lastRuns = input.schedules
    .map((job) => job.lastRunAt)
    .filter((value): value is string => Boolean(value));

  return {
    date: input.localeDate,
    topRequests,
    functionStatuses,
    approvalQueue,
    scheduleStatus: {
      enabledJobs: input.schedules.filter((job) => job.enabled).length,
      totalJobs: input.schedules.length,
      nextRunAt: firstSorted(nextRuns, true),
      lastRunAt: firstSorted(lastRuns, false),
    },
  };
};

export const dailyBriefCompilerService = {
  createPayload(input: DailyBriefCompilerInput): DailyBriefPayload {
    return buildDailyBriefPayload(input);
  },
};
