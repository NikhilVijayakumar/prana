export interface AgentReport {
  agent: string;
  domain: string;
  slips: string[];
  improvements: string[];
  risks: string[];
  customMetricLabel?: string;
  customMetricValue?: string;
}

export interface WeeklyReviewPayload {
  weekEnding: string;
  reports: AgentReport[];
  scheduleStatus: {
    enabledJobs: number;
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    lastTickAt: string | null;
  };
}

export interface WeeklyReviewCompilerInput {
  weekEnding: string;
  healthyProviderCount: number;
  totalProviderCount: number;
  activeProvider: string | null;
  blockedSkillCount: number;
  totalSkillCount: number;
  vaultFileCount: number;
  openWorkOrderCount?: number;
  failedWorkOrderCount?: number;
  schedules: Array<{
    enabled: boolean;
    lastRunStatus?: 'SUCCESS' | 'FAILED' | 'SKIPPED_OVERLAP' | null;
  }>;
  lastTickAt: string | null;
}

export const buildWeeklyReviewPayload = (input: WeeklyReviewCompilerInput): WeeklyReviewPayload => {
  const reports: AgentReport[] = [
    {
      agent: 'Nora',
      domain: 'CFO',
      slips: input.blockedSkillCount > 0 ? ['Skill execution constraints increased operational friction.'] : [],
      improvements: [
        `Vault data footprint increased to ${input.vaultFileCount} indexed files.`,
        `Open work-order load: ${input.openWorkOrderCount ?? 0}.`,
      ],
      risks:
        input.blockedSkillCount > 0
          ? ['Dependency or env drift may delay automated workflows.']
          : ['Continue monitoring runway and pipeline quality for variability.'],
      customMetricLabel: 'Vault Files',
      customMetricValue: String(input.vaultFileCount),
    },
    {
      agent: 'Julia',
      domain: 'CTO',
      slips: input.healthyProviderCount === 0 ? ['No healthy model provider available at review time.'] : [],
      improvements: [`Healthy providers this week: ${input.healthyProviderCount}/${input.totalProviderCount}`],
      risks: input.activeProvider ? [] : ['No active provider selected in gateway.'],
      customMetricLabel: 'Gateway',
      customMetricValue: input.activeProvider ?? 'none',
    },
    {
      agent: 'Eva',
      domain: 'Compliance',
      slips:
        input.blockedSkillCount > 0
          ? [`${input.blockedSkillCount} skills failed eligibility checks.`]
          : input.failedWorkOrderCount && input.failedWorkOrderCount > 0
            ? [`${input.failedWorkOrderCount} work orders ended in FAILED/REJECTED state.`]
            : [],
      improvements: ['Approval-gated vault publish flow enforced.'],
      risks:
        input.blockedSkillCount > 0
          ? ['Continue monitoring for unauthorized commit/push pathways in future modules.']
          : ['Maintain periodic audit coverage for policy drift.'],
      customMetricLabel: 'Eligible Skills',
      customMetricValue: `${input.totalSkillCount - input.blockedSkillCount}/${input.totalSkillCount}`,
    },
  ];

  return {
    weekEnding: input.weekEnding,
    reports,
    scheduleStatus: {
      enabledJobs: input.schedules.filter((job) => job.enabled).length,
      totalJobs: input.schedules.length,
      successfulJobs: input.schedules.filter((job) => job.lastRunStatus === 'SUCCESS').length,
      failedJobs: input.schedules.filter((job) => job.lastRunStatus === 'FAILED').length,
      lastTickAt: input.lastTickAt,
    },
  };
};

export const weeklyReviewCompilerService = {
  createPayload(input: WeeklyReviewCompilerInput): WeeklyReviewPayload {
    return buildWeeklyReviewPayload(input);
  },
};
