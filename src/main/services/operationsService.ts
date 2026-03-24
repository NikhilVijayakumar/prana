import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getAppDataRoot, getGovernanceRepoPath } from './governanceRepoService';
import { authService } from './authService';
import { modelGatewayService } from './modelGatewayService';
import { skillSystemService } from './skillSystemService';
import { vaultService } from './vaultService';
import { contextEngineService, ContextEngineTelemetry } from './contextEngineService';
import { subagentService, SubagentTelemetry, SubagentTreeNode } from './subagentService';
import { toolPolicyService, ToolPolicyAuditEntry, ToolPolicyTelemetry } from './toolPolicyService';
import { hookSystemService, HookTelemetry } from './hookSystemService';
import { cronSchedulerService } from './cronSchedulerService';
import { systemHealthService } from './systemHealthService';
import { auditLogService } from './auditLogService';
import { complianceScanService } from './complianceScanService';
import { fundingDigestService } from './fundingDigestService';
import { hiringSimService } from './hiringSimService';
import { visualAuditService } from './visualAuditService';
import { dailyBriefCompilerService } from './dailyBriefCompilerService';
import { weeklyReviewCompilerService } from './weeklyReviewCompilerService';
import { workOrderService } from './workOrderService';
import { queueService } from './queueService';
import { agentRegistryService } from './agentRegistryService';
import { coreRegistryService } from './coreRegistryService';
import { sharedPromptPipeline } from './agentExecutionService';
import { onboardingStageStoreService } from './onboardingStageStoreService';
import {
  SYNC_PULL_CRON_JOB_ID,
  SYNC_PUSH_CRON_JOB_ID,
  syncProviderService,
} from './syncProviderService';
import {
  registryRuntimeStoreService,
  RuntimeChannelDetails,
  RuntimeChannelDetailsUpdatePayload,
} from './registryRuntimeStoreService';
import { getPublicRuntimeConfig, getRuntimeBootstrapConfig } from './runtimeConfigService';
import {
  documentConversionService,
  DocumentConversionRequest,
  DocumentConversionResult,
  FileDocumentConversionRequest,
  FileDocumentConversionResult,
} from './documentConversionService';
import {
  administrationIntegrationService,
  AdministrationIntegrationSnapshot,
  AdministrationSyncRunReport,
  KpiHappinessEvaluationOutput,
  SocialTrendIntelligenceOutput,
} from './administrationIntegrationService';
import {
  CronProposalRecord,
  CronProposalStatus,
  governanceLifecycleQueueStoreService,
  LifecycleDraftRecord,
  LifecycleDraftStatus,
} from './governanceLifecycleQueueStoreService';

export interface SettingsPayload {
  language: string;
  preferredModelProvider: 'lmstudio' | 'openrouter' | 'gemini';
  themeMode: 'system' | 'light' | 'dark';
  reducedMotion: boolean;
  syncPushIntervalMs?: number;
  syncCronEnabled?: boolean;
  syncPushCronEnabled?: boolean;
  syncPullCronEnabled?: boolean;
  syncPushCronExpression?: string;
  syncPullCronExpression?: string;
  syncHealthAutoRefreshEnabled?: boolean;
  syncHealthAutoRefreshIntervalMs?: number;
}

export interface RuntimeChannelConfigurationPayload {
  provider: string;
  allowedChannels: string[];
  approvedAgentsForChannels: Record<string, string[]>;
  channelAccessRules: string;
  telegramChannelId: string;
  webhookSubscriptionUri: string;
  providerCredentials: string;
}

export type AdministrationIntegrationSnapshotPayload = AdministrationIntegrationSnapshot;

export type AdministrationSyncRunReportPayload = AdministrationSyncRunReport;

export type DocumentConversionRequestPayload = DocumentConversionRequest;

export type DocumentConversionResultPayload = DocumentConversionResult;

export type FileDocumentConversionRequestPayload = FileDocumentConversionRequest;

export type FileDocumentConversionResultPayload = FileDocumentConversionResult;

export type KpiHappinessEvaluationOutputPayload = KpiHappinessEvaluationOutput;

export type SocialTrendIntelligenceOutputPayload = SocialTrendIntelligenceOutput;

export interface QueueTask {
  id: string;
  agentProcess: string;
  description: string;
  enqueuedAt: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'PAUSED';
  duration?: string;
}

export interface QueueMonitorPayload {
  activeCount: number;
  pendingCount: number;
  gateway: Awaited<ReturnType<typeof modelGatewayService.probeGateway>>;
  context: ContextEngineTelemetry;
  hooks: HookTelemetry;
  toolPolicy: ToolPolicyTelemetry;
  toolPolicyAudits: ToolPolicyAuditEntry[];
  subagents: {
    telemetry: SubagentTelemetry;
    tree: SubagentTreeNode[];
  };
  tasks: QueueTask[];
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  source: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  read: boolean;
}

export interface NotificationPayload {
  unreadCount: number;
  items: NotificationItem[];
}

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

export interface GovernanceLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  result: 'SUCCESS' | 'BLOCKED' | 'FLAGGED';
}

export interface GovernanceDecision {
  id: string;
  source: string;
  title: string;
  status: 'DRAFT' | 'APPROVED' | 'REJECTED' | 'DEFERRED' | 'COMMITTED';
}

export interface GovernancePayload {
  logs: GovernanceLogEntry[];
  decisions: GovernanceDecision[];
}

export interface CompliancePayload {
  overallStatus: 'secure' | 'warning' | 'critical';
  violationsCount: number;
  lastAudit: string;
  adherenceScore: number;
  checks: {
    id: string;
    name: string;
    status: 'pass' | 'fail' | 'warn';
    details: string;
  }[];
}

export interface TriageItem {
  id: string;
  source: string;
  topic: string;
  receivedAt: string;
  status: 'PENDING' | 'ANALYSIS' | 'CLEARED';
}

export interface SuiteAgentProfile {
  id: string;
  name: string;
  role: string;
  subAgents: number;
  status: 'IDLE' | 'EXECUTING' | 'WAITING' | `WAITING_ON_${string}`;
  lastActive: string;
}

export interface SuitePayload {
  agents: SuiteAgentProfile[];
  skills: Awaited<ReturnType<typeof skillSystemService.listWorkspaceSkills>>;
}

export interface FinancialMetric {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
}

export interface FundingLead {
  id: string;
  name: string;
  firm: string;
  stage: 'Contacted' | 'Pitch Scheduled' | 'Due Diligence' | 'Term Sheet';
  confidence: number;
}

export interface FundingDigestPayload {
  runwayMonths: number;
  burnRate: string;
  cashInBank: string;
  metrics: FinancialMetric[];
  leads: FundingLead[];
}

export interface HiringCandidate {
  id: string;
  name: string;
  role: string;
  matchScore: number;
  status: 'Evaluating' | 'Interview Round 1' | 'Technical Assessment' | 'Offer Pending';
  keyStrengths: string[];
}

export interface HiringSimPayload {
  openRolesCount: number;
  activeCandidates: number;
  averageTimeGaps: string;
  candidates: HiringCandidate[];
}

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

export interface DashboardKpi {
  id: string;
  label: string;
  value: string;
  status: 'healthy' | 'watch' | 'critical';
  detail: string;
}

export interface DashboardPayload {
  generatedAt: string;
  kpis: DashboardKpi[];
  highlights: string[];
}

export interface SystemMetric {
  id: string;
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'critical';
  threshold: string;
}

export interface InfrastructurePayload {
  crisisModeActive: boolean;
  activeAgents: string[];
  metrics: SystemMetric[];
}

export interface OnboardingKpi {
  id: string;
  name: string;
  unit: string;
  target: string;
  threshold: string;
}

export interface OnboardingAgentKpiRecord {
  agentId: string;
  agent: string;
  role: string;
  kpis: OnboardingKpi[];
}

export interface OnboardingAgentStatus {
  id: string;
  name: string;
  role: string;
  status: 'QUEUED' | 'GENERATING' | 'DONE';
  kpiCount: number;
}

export interface OnboardingKpiPayload {
  generatedAt: string;
  statuses: OnboardingAgentStatus[];
  registry: OnboardingAgentKpiRecord[];
}

export interface OnboardingCommitPayload {
  kpiData: Record<string, string>;
  contextByStep: Record<string, Record<string, string>>;
  approvalByStep: Record<string, 'PENDING' | 'DRAFT' | 'APPROVED'>;
  agentMappings: Record<string, {
    skills: string[];
    protocols: string[];
    kpis: string[];
    workflows: string[];
  }>;
}

export interface OnboardingCommitResult {
  success: boolean;
  committedAt: string;
  ingestedVaultRecords: number;
  validationErrors?: string[];
  alignmentIssues?: Array<{ field: string; reason: string }>;
}

export interface OnboardingPhaseStage {
  stepId: string;
  status: 'PENDING' | 'DRAFT' | 'APPROVED';
  contextByKey: Record<string, string>;
  requiresReverification: boolean;
  updatedAt: string;
}

export interface OnboardingStageSnapshotPayload {
  phases: Record<string, OnboardingPhaseStage>;
  currentStep: number | null;
  modelAccess: Record<string, unknown> | null;
}

export interface SaveOnboardingStagePayload {
  phases: Record<string, {
    status: 'PENDING' | 'DRAFT' | 'APPROVED';
    contextByKey: Record<string, string>;
    requiresReverification: boolean;
  }>;
  currentStep: number;
  modelAccess?: Record<string, unknown>;
}

export interface EmployeeProfileKpi {
  name: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
}

export interface EmployeeProfileTool {
  name: string;
  type: 'Skill' | 'Rule' | 'Script';
  description: string;
}

export interface EmployeeProfilePayload {
  id: string;
  name: string;
  role: string;
  triggerName: string;
  triggerDesignation: string;
  backstory: string;
  workflow: string[];
  tools: EmployeeProfileTool[];
  kpis: EmployeeProfileKpi[];
  canRequestFrom: string[];
  receivesFrom: string[];
}

export interface LifecycleProfileDraft {
  agentId: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  skills: string[];
  kpis: string[];
  kpiStatus: EmployeeProfileKpi[];
}

export interface LifecycleGlobalSkill {
  id: string;
  title: string;
  tags: string[];
  markdown: string;
}

export interface LifecycleKpiDefinition {
  id: string;
  name: string;
  description: string;
  unit: string;
  target: string;
  value: string;
  linkedAgents: string[];
}

export interface LifecycleDataInputDefinition {
  id: string;
  name: string;
  description: string;
  schemaType:
    | 'tabular'
    | 'event-stream'
    | 'document'
    | 'timeseries'
    | 'identity-protocol'
    | 'intelligence-protocol'
    | 'manifest-schema'
    | 'audit-trail';
  requiredFields: string[];
  sampleSource: string;
  uploadedFileName?: string;
  uploadedContent?: string;
  uploadedPreview?: string;
  updatedAt?: string;
}

export interface LifecycleSnapshotPayload {
  profiles: LifecycleProfileDraft[];
  globalSkills: LifecycleGlobalSkill[];
  kpis: LifecycleKpiDefinition[];
  dataInputs: LifecycleDataInputDefinition[];
  committedAt: string | null;
}

export interface LifecycleProfileUpdatePayload {
  agentId: string;
  goal: string;
  backstory: string;
  skills: string[];
  kpis: string[];
}

export interface LifecycleSkillUpdatePayload {
  skillId: string;
  markdown: string;
}

export interface LifecycleKpiUpdatePayload {
  kpiId: string;
  target: string;
  value?: string;
}

export interface LifecycleDataInputUpdatePayload {
  dataInputId: string;
  fileName: string;
  content: string;
}

export interface LifecycleCreateDataInputPayload {
  dataInputId: string;
  name: string;
  description: string;
  schemaType: string;
  requiredFields: string[];
  sampleSource: string;
  fileName?: string;
  content?: string;
}

export interface LifecycleUpdateResult {
  success: boolean;
  updatedAt: string;
  reviewRequired?: boolean;
  referenceId?: string;
  validationErrors?: string[];
}

export interface ReviewLifecycleDraftPayload {
  draftId: string;
  status: Exclude<LifecycleDraftStatus, 'PENDING'>;
  reviewer: string;
  reviewNote?: string;
}

export interface ReviewCronProposalPayload {
  proposalId: string;
  status: Exclude<CronProposalStatus, 'PENDING'>;
  reviewer: string;
  reviewNote?: string;
}

export interface ProposeCronSchedulePayload {
  id: string;
  name: string;
  expression: string;
  retentionDays?: number;
  maxRuntimeMs?: number;
}

export interface TaskAuditLogPayload {
  id: number;
  eventType: string;
  jobId: string | null;
  taskId: string | null;
  details: string;
  createdAt: string;
}

type GovernanceAction = 'APPROVE' | 'REJECT' | 'DEFER' | 'COMMIT';
type TriageAction = 'ANALYZE' | 'CLEAR';

interface PersistedSettings {
  language: string;
  preferredModelProvider: 'lmstudio' | 'openrouter' | 'gemini';
  themeMode: 'system' | 'light' | 'dark';
  reducedMotion: boolean;
  syncPushIntervalMs: number;
  syncCronEnabled: boolean;
  syncPushCronEnabled: boolean;
  syncPullCronEnabled: boolean;
  syncPushCronExpression: string;
  syncPullCronExpression: string;
  syncHealthAutoRefreshEnabled: boolean;
  syncHealthAutoRefreshIntervalMs: number;
  updatedAt: string;
}

interface PersistedOperationsState {
  governanceDecisions: GovernanceDecision[];
  governanceLogs: GovernanceLogEntry[];
  triageItems: TriageItem[];
  onboardingKpis: OnboardingAgentKpiRecord[];
  onboardingGeneratedAt: string | null;
  onboardingCommittedAt: string | null;
}

const SETTINGS_FILE = 'settings.json';
const OPERATIONS_STATE_FILE = 'operations-state.json';
const DHI_VAULT_ROOT = 'dhi-vault';

interface OnboardingVaultPaths {
  root: string;
  coreDir: string;
  coreKpiOrgDir: string;
  coreSkillsSharedDir: string;
  coreSchemasOnboardingDir: string;
  orgOnboardingDir: string;
  orgAdministrationDir: string;
  orgAdministrationPoliciesDir: string;
  orgAdministrationPoliciesCoreDir: string;
  orgAdministrationPoliciesHrDir: string;
  orgAdministrationPoliciesOpsDir: string;
  orgAdministrationPoliciesSecurityDir: string;
  orgAdministrationEvaluationsDir: string;
  orgAdministrationIntegrationsDir: string;
  orgAdministrationCalendarDir: string;
  orgAdministrationAttendanceDir: string;
  orgAdministrationFeedbackDir: string;
  orgAdministrationMeetingsDir: string;
  orgAdministrationChannelsDir: string;
  departmentsTemplateDir: string;
  agentsSharedOnboardingDir: string;
  kpiRegistryFile: string;
  kpiTemplateFile: string;
  kpiIndexFile: string;
  contextFile: string;
  companyRequirementsTemplateFile: string;
  profileFile: string;
  profileTemplateFile: string;
  skillsTemplateFile: string;
  skillsIndexFile: string;
  departmentTemplateFile: string;
  schemaFile: string;
  staffCsvFile: string;
  policyIndexFile: string;
  integrationConfigFile: string;
  googleSheetsMappingFile: string;
  feedbackTemplateFile: string;
  meetingNotesTemplateFile: string;
  holidayCalendarFile: string;
  attendanceTemplateFile: string;
  channelIntelligenceConfigFile: string;
  routingMapFile: string;
}

interface NormalizedOnboardingKpiEntry {
  id: string;
  name: string;
  description: string;
  target: string;
  threshold: {
    warning: string;
    critical: string;
  };
  owner: string;
  frequency: string;
  source: string;
}

interface PersistedLifecycleTemplateEmployee {
  id: string;
  name?: string;
  role?: string;
  in_depth_goal?: string;
  in_depth_backstory?: string;
  core_skills?: string;
  required_kpis?: string;
  updatedAt?: string;
}

interface PersistedLifecycleSkillOverride {
  markdown: string;
  updatedAt: string;
}

interface PersistedLifecycleKpiOverride {
  target: string;
  value?: string;
  updatedAt: string;
}

interface PersistedLifecycleDataInputOverride {
  fileName: string;
  content: string;
  updatedAt: string;
}

interface PersistedLifecycleTemplate {
  metadata?: {
    classification?: string;
    source?: string;
  };
  committedAt?: string;
  employees?: PersistedLifecycleTemplateEmployee[];
  global_skills?: Record<string, PersistedLifecycleSkillOverride>;
  kpi_overrides?: Record<string, PersistedLifecycleKpiOverride>;
  data_input_overrides?: Record<string, PersistedLifecycleDataInputOverride>;
}

const normalizeKpiId = (key: string): string => {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'kpi';
};

const splitDelimitedList = (raw: string): string[] => {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const toRuntimeChannelConfigurationPayload = (
  details: RuntimeChannelDetails,
): RuntimeChannelConfigurationPayload => {
  return {
    provider: details.provider,
    allowedChannels: details.allowedChannels,
    approvedAgentsForChannels: details.approvedAgentsForChannels,
    channelAccessRules: details.channelAccessRules,
    telegramChannelId: details.telegramChannelId,
    webhookSubscriptionUri: details.webhookSubscriptionUri,
    providerCredentials: details.providerCredentials,
  };
};

const normalizeRegistryId = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const readLifecycleTemplate = async (): Promise<PersistedLifecycleTemplate> => {
  const profileFile = getOnboardingVaultPaths().profileTemplateFile;
  if (!existsSync(profileFile)) {
    return {};
  }

  try {
    const raw = await readFile(profileFile, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return {};
    }

    const employees = Array.isArray(parsed.employees)
      ? parsed.employees.filter((entry): entry is PersistedLifecycleTemplateEmployee => isRecord(entry) && typeof entry.id === 'string')
      : [];

    const globalSkills = isRecord(parsed.global_skills)
      ? Object.entries(parsed.global_skills).reduce<Record<string, PersistedLifecycleSkillOverride>>((acc, [skillId, value]) => {
          if (!isRecord(value)) {
            return acc;
          }
          if (typeof value.markdown !== 'string' || typeof value.updatedAt !== 'string') {
            return acc;
          }
          acc[skillId] = {
            markdown: value.markdown,
            updatedAt: value.updatedAt,
          };
          return acc;
        }, {})
      : {};

    const kpiOverrides = isRecord(parsed.kpi_overrides)
      ? Object.entries(parsed.kpi_overrides).reduce<Record<string, PersistedLifecycleKpiOverride>>((acc, [kpiId, value]) => {
          if (!isRecord(value)) {
            return acc;
          }
          if (typeof value.target !== 'string' || typeof value.updatedAt !== 'string') {
            return acc;
          }
          acc[kpiId] = {
            target: value.target,
            value: typeof value.value === 'string' ? value.value : undefined,
            updatedAt: value.updatedAt,
          };
          return acc;
        }, {})
      : {};

    const dataInputOverrides = isRecord(parsed.data_input_overrides)
      ? Object.entries(parsed.data_input_overrides).reduce<Record<string, PersistedLifecycleDataInputOverride>>(
          (acc, [dataInputId, value]) => {
            if (!isRecord(value)) {
              return acc;
            }
            if (
              typeof value.fileName !== 'string' ||
              typeof value.content !== 'string' ||
              typeof value.updatedAt !== 'string'
            ) {
              return acc;
            }
            acc[dataInputId] = {
              fileName: value.fileName,
              content: value.content,
              updatedAt: value.updatedAt,
            };
            return acc;
          },
          {},
        )
      : {};

    return {
      metadata: isRecord(parsed.metadata)
        ? {
            classification:
              typeof parsed.metadata.classification === 'string' ? parsed.metadata.classification : undefined,
            source: typeof parsed.metadata.source === 'string' ? parsed.metadata.source : undefined,
          }
        : undefined,
      committedAt: typeof parsed.committedAt === 'string' ? parsed.committedAt : undefined,
      employees,
      global_skills: globalSkills,
      kpi_overrides: kpiOverrides,
      data_input_overrides: dataInputOverrides,
    };
  } catch {
    return {};
  }
};

const writeLifecycleTemplate = async (template: PersistedLifecycleTemplate): Promise<void> => {
  const paths = getOnboardingVaultPaths();
  await mkdir(paths.agentsSharedOnboardingDir, { recursive: true });

  const normalized: PersistedLifecycleTemplate = {
    metadata: {
      classification: template.metadata?.classification ?? 'T2-INTERNAL',
      source: template.metadata?.source ?? 'lifecycle-management',
    },
    committedAt: template.committedAt,
    employees: template.employees ?? [],
    global_skills: template.global_skills ?? {},
    kpi_overrides: template.kpi_overrides ?? {},
    data_input_overrides: template.data_input_overrides ?? {},
  };

  await writeFile(paths.profileTemplateFile, JSON.stringify(normalized, null, 2), 'utf8');
};

const readDraftString = (proposed: Record<string, unknown>, key: string): string => {
  const value = proposed[key];
  return typeof value === 'string' ? value.trim() : '';
};

const readDraftOptionalString = (proposed: Record<string, unknown>, key: string): string | undefined => {
  const value = proposed[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readDraftStringArray = (proposed: Record<string, unknown>, key: string): string[] => {
  const value = proposed[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const applyApprovedLifecycleDraft = async (draft: LifecycleDraftRecord): Promise<{ success: boolean; errors?: string[] }> => {
  const template = await readLifecycleTemplate();
  const now = new Date().toISOString();

  if (draft.entityType === 'profile') {
    const goal = readDraftString(draft.proposed, 'goal');
    const backstory = readDraftString(draft.proposed, 'backstory');
    const skills = readDraftStringArray(draft.proposed, 'skills');
    const kpis = readDraftStringArray(draft.proposed, 'kpis');

    if (!goal || !backstory || skills.length === 0 || kpis.length === 0) {
      return { success: false, errors: ['Approved profile draft is missing required fields.'] };
    }

    const existing = template.employees ?? [];
    const currentAgent = agentRegistryService.getAgent(draft.entityId);
    const upserted: PersistedLifecycleTemplateEmployee = {
      id: draft.entityId,
      name: currentAgent?.name,
      role: currentAgent ? toRoleLabel(currentAgent.role) : undefined,
      in_depth_goal: goal,
      in_depth_backstory: backstory,
      core_skills: skills.join(', '),
      required_kpis: kpis.join(', '),
      updatedAt: now,
    };

    const nextEmployees = existing.some((entry) => entry.id === draft.entityId)
      ? existing.map((entry) => (entry.id === draft.entityId ? upserted : entry))
      : [...existing, upserted];

    await writeLifecycleTemplate({
      ...template,
      committedAt: now,
      employees: nextEmployees,
    });
    return { success: true };
  }

  if (draft.entityType === 'skill') {
    const markdown = readDraftString(draft.proposed, 'markdown');
    if (!markdown) {
      return { success: false, errors: ['Approved skill draft is missing markdown content.'] };
    }

    await writeLifecycleTemplate({
      ...template,
      committedAt: now,
      global_skills: {
        ...(template.global_skills ?? {}),
        [draft.entityId]: {
          markdown,
          updatedAt: now,
        },
      },
    });
    return { success: true };
  }

  if (draft.entityType === 'kpi') {
    const target = readDraftString(draft.proposed, 'target');
    const value = readDraftOptionalString(draft.proposed, 'value');
    if (!target) {
      return { success: false, errors: ['Approved KPI draft is missing target.'] };
    }

    await writeLifecycleTemplate({
      ...template,
      committedAt: now,
      kpi_overrides: {
        ...(template.kpi_overrides ?? {}),
        [draft.entityId]: {
          target,
          value,
          updatedAt: now,
        },
      },
    });
    return { success: true };
  }

  if (draft.entityType === 'data-input') {
    const fileName = readDraftString(draft.proposed, 'fileName');
    const content = readDraftString(draft.proposed, 'content');
    if (!fileName || !content) {
      return { success: false, errors: ['Approved data input draft is missing file payload.'] };
    }

    await writeLifecycleTemplate({
      ...template,
      committedAt: now,
      data_input_overrides: {
        ...(template.data_input_overrides ?? {}),
        [draft.entityId]: {
          fileName,
          content,
          updatedAt: now,
        },
      },
    });
    return { success: true };
  }

  if (draft.entityType === 'data-input-create') {
    const dataInputId = normalizeRegistryId(draft.entityId);
    const name = readDraftString(draft.proposed, 'name');
    const description = readDraftString(draft.proposed, 'description');
    const schemaType = readDraftString(draft.proposed, 'schemaType');
    const requiredFields = readDraftStringArray(draft.proposed, 'requiredFields');
    const sampleSource = readDraftString(draft.proposed, 'sampleSource');

    if (!dataInputId || !name || !description || !schemaType || requiredFields.length === 0 || !sampleSource) {
      return { success: false, errors: ['Approved data input create draft is missing required metadata.'] };
    }

    const existing = coreRegistryService.listDataInputs();
    if (existing.some((entry) => entry.uid === dataInputId)) {
      return { success: false, errors: [`Data input ${dataInputId} already exists.`] };
    }

    const registryRoot = coreRegistryService.getRegistryRoot();
    const dataInputPath = join(registryRoot, 'data-inputs', `${dataInputId}.json`);
    const definition = {
      uid: dataInputId,
      name,
      description,
      schemaType,
      requiredFields,
      sampleSource,
      sourceType: 'json',
      privacyClassification: 'internal',
    };

    await writeFile(dataInputPath, JSON.stringify(definition, null, 2), 'utf8');

    const maybeFileName = readDraftOptionalString(draft.proposed, 'fileName');
    const maybeContent = readDraftOptionalString(draft.proposed, 'content');
    if (maybeFileName && maybeContent) {
      await writeLifecycleTemplate({
        ...template,
        committedAt: now,
        data_input_overrides: {
          ...(template.data_input_overrides ?? {}),
          [dataInputId]: {
            fileName: maybeFileName,
            content: maybeContent,
            updatedAt: now,
          },
        },
      });
    }

    coreRegistryService.reload();
    return { success: true };
  }

  return { success: false, errors: ['Unsupported draft entity type.'] };
};

const getOnboardingVaultPaths = (): OnboardingVaultPaths => {
  const root = join(getGovernanceRepoPath(), DHI_VAULT_ROOT);
  return {
    root,
    coreDir: join(root, 'core'),
    coreKpiOrgDir: join(root, 'core', 'kpis', 'org'),
    coreSkillsSharedDir: join(root, 'core', 'skills', 'shared'),
    coreSchemasOnboardingDir: join(root, 'core', 'schemas', 'onboarding'),
    orgOnboardingDir: join(root, 'org', 'onboarding'),
    orgAdministrationDir: join(root, 'org', 'administration'),
    orgAdministrationPoliciesDir: join(root, 'org', 'administration', 'policies'),
    orgAdministrationPoliciesCoreDir: join(root, 'org', 'administration', 'policies', 'core-governance'),
    orgAdministrationPoliciesHrDir: join(root, 'org', 'administration', 'policies', 'hr-performance'),
    orgAdministrationPoliciesOpsDir: join(root, 'org', 'administration', 'policies', 'operations-controls'),
    orgAdministrationPoliciesSecurityDir: join(root, 'org', 'administration', 'policies', 'security-compliance'),
    orgAdministrationEvaluationsDir: join(root, 'org', 'administration', 'evaluations'),
    orgAdministrationIntegrationsDir: join(root, 'org', 'administration', 'integrations'),
    orgAdministrationCalendarDir: join(root, 'org', 'administration', 'calendar'),
    orgAdministrationAttendanceDir: join(root, 'org', 'administration', 'attendance'),
    orgAdministrationFeedbackDir: join(root, 'org', 'administration', 'feedback'),
    orgAdministrationMeetingsDir: join(root, 'org', 'administration', 'meetings'),
    orgAdministrationChannelsDir: join(root, 'org', 'administration', 'channels'),
    departmentsTemplateDir: join(root, 'departments', 'templates'),
    agentsSharedOnboardingDir: join(root, 'agents', 'shared', 'onboarding'),
    kpiRegistryFile: join(root, 'core', 'kpis', 'org', 'onboarding-kpi-registry.json'),
    kpiTemplateFile: join(root, 'core', 'kpis', 'org', 'onboarding-kpi-template.json'),
    kpiIndexFile: join(root, 'core', 'kpis', 'index.json'),
    contextFile: join(root, 'org', 'onboarding', 'context.json'),
    companyRequirementsTemplateFile: join(root, 'org', 'onboarding', 'company-requirements.template.json'),
    profileFile: join(root, 'agents', 'shared', 'onboarding', 'profile-alignment.json'),
    profileTemplateFile: join(root, 'agents', 'shared', 'onboarding', 'virtual-employee-profiles.template.json'),
    skillsTemplateFile: join(root, 'core', 'skills', 'shared', 'onboarding-core-skills-template.md'),
    skillsIndexFile: join(root, 'core', 'skills', 'index.json'),
    departmentTemplateFile: join(root, 'departments', 'templates', 'department-standard.template.md'),
    schemaFile: join(root, 'core', 'schemas', 'onboarding', 'onboarding-commit.schema.json'),
    staffCsvFile: join(root, 'org', 'administration', 'staff', 'staff-registry.csv'),
    policyIndexFile: join(root, 'org', 'administration', 'policies', 'policy-index.json'),
    integrationConfigFile: join(root, 'org', 'administration', 'integrations', 'external-systems.config.json'),
    googleSheetsMappingFile: join(root, 'org', 'administration', 'integrations', 'google-sheets.mapping.json'),
    feedbackTemplateFile: join(root, 'org', 'administration', 'feedback', 'employee-happiness-form-template.md'),
    meetingNotesTemplateFile: join(root, 'org', 'administration', 'meetings', 'weekly-admin-meeting-notes.template.md'),
    holidayCalendarFile: join(root, 'org', 'administration', 'calendar', 'holiday-calendar.csv'),
    attendanceTemplateFile: join(root, 'org', 'administration', 'attendance', 'attendance-template.csv'),
    channelIntelligenceConfigFile: join(root, 'org', 'administration', 'channels', 'intelligence-channels.config.json'),
    routingMapFile: join(root, 'core', 'routing_map.json'),
  };
};

const normalizeOnboardingKpis = (kpiData: Record<string, string>): NormalizedOnboardingKpiEntry[] => {
  return Object.entries(kpiData)
    .filter(([key, value]) => key.trim().length > 0 && value.trim().length > 0)
    .map(([key, value]) => ({
      id: normalizeKpiId(key),
      name: key,
      description: `Director onboarding KPI for ${key}`,
      target: value,
      threshold: {
        warning: 'review-required',
        critical: 'review-required',
      },
      owner: 'director-input',
      frequency: 'monthly',
      source: 'onboarding',
    }));
};

const readStepValue = (
  payload: OnboardingCommitPayload,
  stepId: string,
  key: string,
): string => {
  return payload.contextByStep[stepId]?.[key]?.trim() ?? '';
};

const countWords = (value: string): number => {
  return value
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0).length;
};

const parseDelimitedSet = (value: string): Set<string> => {
  return new Set(
    value
      .split(',')
      .map((entry) => normalizeRegistryId(entry))
      .filter((entry) => entry.length > 0),
  );
};

const hasApprovedStep = (payload: OnboardingCommitPayload, stepId: string): boolean => {
  return payload.approvalByStep[stepId] === 'APPROVED';
};

const alignmentTokens = (value: string): string[] => {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 5);
};

const keywordOverlapCount = (reference: string, candidate: string): number => {
  const referenceTokens = new Set(alignmentTokens(reference));
  const candidateTokens = new Set(alignmentTokens(candidate));

  let overlap = 0;
  for (const token of candidateTokens) {
    if (referenceTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap;
};

const verifyVisionAlignment = async (
  companyVision: string,
  agentVision: string,
): Promise<{ aligned: boolean; reason: string }> => {
  const overlapTokens = new Set(
    companyVision
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 4),
  );
  const agentTokens = new Set(
    agentVision
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 4),
  );

  let overlapCount = 0;
  for (const token of agentTokens) {
    if (overlapTokens.has(token)) {
      overlapCount += 1;
    }
  }

  // Deterministic baseline pass/fail used if no model result is available.
  const deterministicAligned = overlapCount >= 2;

  const systemPrompt = 'You are a strict governance validator. Return JSON only.';
  const userPrompt = JSON.stringify({
    task: 'Assess whether agent individual vision is aligned with company vision',
    expectedFormat: {
      aligned: 'boolean',
      reason: 'string',
    },
    companyVision,
    agentVision,
  });

  const modelOutput = await sharedPromptPipeline.callModel(systemPrompt, userPrompt);
  if (typeof modelOutput !== 'string' || modelOutput.trim().length === 0) {
    return {
      aligned: deterministicAligned,
      reason: deterministicAligned
        ? 'Deterministic keyword overlap passed (LLM unavailable).'
        : 'Deterministic keyword overlap failed (LLM unavailable).',
    };
  }

  try {
    const cleaned = modelOutput.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned) as { aligned?: boolean; reason?: string };
    if (typeof parsed.aligned === 'boolean') {
      return {
        aligned: parsed.aligned,
        reason: typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
          ? parsed.reason
          : (parsed.aligned ? 'LLM confirmed alignment.' : 'LLM flagged misalignment.'),
      };
    }
  } catch {
    // Fall through to deterministic fallback.
  }

  return {
    aligned: deterministicAligned,
    reason: deterministicAligned
      ? 'Deterministic keyword overlap passed after unparsable LLM response.'
      : 'Deterministic keyword overlap failed after unparsable LLM response.',
  };
};

const validateOnboardingCommitPayload = async (
  payload: OnboardingCommitPayload,
): Promise<{
  isValid: boolean;
  errors: string[];
  normalizedKpis: NormalizedOnboardingKpiEntry[];
  alignmentIssues: Array<{ field: string; reason: string }>;
}> => {
  const errors: string[] = [];
  const alignmentIssues: Array<{ field: string; reason: string }> = [];
  const normalizedKpis = normalizeOnboardingKpis(payload.kpiData);

  const requireDirectorField = (
    stepId: string,
    key: string,
    label: string,
    minWords: number,
  ): void => {
    const value = readStepValue(payload, stepId, key);
    if (!value) {
      errors.push(`Missing mandatory onboarding field: ${label}`);
      return;
    }

    if (value.startsWith('Example:')) {
      errors.push(`Replace example content with company-specific input: ${label}`);
      return;
    }

    if (countWords(value) < minWords) {
      errors.push(`Insufficient depth for ${label}. Provide at least ${minWords} words.`);
    }
  };

  const requiredStepIds = [
    'company-core',
    'product-context',
    'global-assets',
    'global-guardrails',
    'agent-profile-persona',
    'agent-workflows',
    'infrastructure-finalization',
  ];

  for (const stepId of requiredStepIds) {
    if (!hasApprovedStep(payload, stepId)) {
      errors.push(`Step must be approved before final commit: ${stepId}`);
    }
  }

  const requirementStepIds = ['company-core', 'product-context', 'global-assets', 'global-guardrails', 'infrastructure-finalization'];
  for (const stepId of requirementStepIds) {
    const requirements = coreRegistryService.getMinimumRequirements(stepId);
    for (const requirement of requirements) {
      for (const field of requirement.requiredFields) {
        if (field.quality !== 'required') {
          continue;
        }
        const label = `${stepId}.${field.key}`;
        requireDirectorField(stepId, field.key, label, field.minWords);
      }
    }
  }

  requireDirectorField('company-core', 'company_vision', 'company-core.company_vision', 16);
  requireDirectorField('company-core', 'company_context', 'company-core.company_context', 12);
  requireDirectorField('company-core', 'core_values', 'company-core.core_values', 3);
  requireDirectorField('company-core', 'global_non_negotiables', 'company-core.global_non_negotiables', 8);
  requireDirectorField('product-context', 'product_value_proposition', 'product-context.product_value_proposition', 10);
  requireDirectorField('product-context', 'product_features', 'product-context.product_features', 3);
  requireDirectorField('product-context', 'technical_constraints', 'product-context.technical_constraints', 6);
  requireDirectorField('global-assets', 'approved_skills', 'global-assets.approved_skills', 3);
  requireDirectorField('global-assets', 'approved_kpis', 'global-assets.approved_kpis', 3);
  requireDirectorField('global-guardrails', 'approved_protocols', 'global-guardrails.approved_protocols', 3);
  requireDirectorField('global-guardrails', 'approved_data_inputs', 'global-guardrails.approved_data_inputs', 3);
  requireDirectorField('agent-workflows', 'approved_workflows', 'agent-workflows.approved_workflows', 3);
  requireDirectorField('infrastructure-finalization', 'channel_provider', 'infrastructure-finalization.channel_provider', 1);
  requireDirectorField('infrastructure-finalization', 'allowed_channels', 'infrastructure-finalization.allowed_channels', 2);
  requireDirectorField('infrastructure-finalization', 'approved_agents_for_channels', 'infrastructure-finalization.approved_agents_for_channels', 2);
  requireDirectorField('infrastructure-finalization', 'channel_access_rules', 'infrastructure-finalization.channel_access_rules', 2);

  const approvedSkillSet = parseDelimitedSet(readStepValue(payload, 'global-assets', 'approved_skills'));
  const approvedKpiSet = parseDelimitedSet(readStepValue(payload, 'global-assets', 'approved_kpis'));
  const approvedProtocolSet = parseDelimitedSet(readStepValue(payload, 'global-guardrails', 'approved_protocols'));

  for (const [agentId, mapping] of Object.entries(payload.agentMappings)) {
    if (mapping.skills.length === 0 || mapping.kpis.length === 0 || mapping.protocols.length === 0 || mapping.workflows.length === 0) {
      errors.push(`Agent mapping incomplete: ${agentId}`);
      continue;
    }

    for (const skill of mapping.skills) {
      if (!approvedSkillSet.has(normalizeRegistryId(skill))) {
        errors.push(`Agent ${agentId} references non-approved skill: ${skill}`);
      }
    }

    for (const protocol of mapping.protocols) {
      if (!approvedProtocolSet.has(normalizeRegistryId(protocol))) {
        errors.push(`Agent ${agentId} references non-approved protocol: ${protocol}`);
      }
    }

    for (const kpi of mapping.kpis) {
      if (!approvedKpiSet.has(normalizeRegistryId(kpi))) {
        errors.push(`Agent ${agentId} references non-approved KPI: ${kpi}`);
      }
    }
  }

  const companyVision = readStepValue(payload, 'company-core', 'company_vision');
  const companyNonNegotiables = readStepValue(payload, 'company-core', 'global_non_negotiables');
  const nonNegotiableTokens = alignmentTokens(companyNonNegotiables);
  for (const [agentId, values] of Object.entries(payload.contextByStep['agent-profile-persona'] ?? {})) {
    if (!agentId.endsWith('.individual_vision')) {
      continue;
    }
    const resolvedAgentId = agentId.replace('.individual_vision', '');
    const coreObjective = payload.contextByStep['agent-profile-persona']?.[`${resolvedAgentId}.core_objective`] ?? '';
    const roleRequirements = payload.contextByStep['agent-profile-persona']?.[`${resolvedAgentId}.role_non_negotiable_requirements`] ?? '';

    const alignment = await verifyVisionAlignment(companyVision, values);
    if (!alignment.aligned) {
      errors.push(`Individual vision misalignment for ${resolvedAgentId}: ${alignment.reason}`);
      alignmentIssues.push({
        field: `${resolvedAgentId}.individual_vision`,
        reason: alignment.reason,
      });
    }

    const objectiveOverlap = keywordOverlapCount(companyVision, coreObjective);
    if (objectiveOverlap < 2) {
      const reason = `Core objective for ${resolvedAgentId} has low company-vision alignment (${objectiveOverlap} overlap tokens).`;
      errors.push(reason);
      alignmentIssues.push({
        field: `${resolvedAgentId}.core_objective`,
        reason,
      });
    }

    const roleText = roleRequirements.toLowerCase();
    const roleTokenMatches = nonNegotiableTokens.filter((token) => roleText.includes(token)).length;
    const hasHumanReviewGate = roleText.includes('human') && roleText.includes('review');
    const hasTrackSeparationGate = roleText.includes('separation') || (roleText.includes('education') && roleText.includes('fiction'));
    if (roleTokenMatches < 2 || !hasHumanReviewGate || !hasTrackSeparationGate) {
      const reason = `Role non-negotiables for ${resolvedAgentId} must include human-review and track-separation safeguards.`;
      errors.push(reason);
      alignmentIssues.push({
        field: `${resolvedAgentId}.role_non_negotiable_requirements`,
        reason,
      });
    }
  }

  if (normalizedKpis.length < 2) {
    errors.push('At least two KPI entries are required before onboarding commit.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedKpis,
    alignmentIssues,
  };
};

const persistOnboardingVaultStructure = async (
  committedAt: string,
  payload: OnboardingCommitPayload,
  normalizedKpis: NormalizedOnboardingKpiEntry[],
): Promise<void> => {
  const paths = getOnboardingVaultPaths();

  await Promise.all([
    mkdir(paths.coreKpiOrgDir, { recursive: true }),
    mkdir(paths.coreSkillsSharedDir, { recursive: true }),
    mkdir(paths.coreSchemasOnboardingDir, { recursive: true }),
    mkdir(paths.orgOnboardingDir, { recursive: true }),
    mkdir(paths.orgAdministrationDir, { recursive: true }),
    mkdir(paths.orgAdministrationPoliciesDir, { recursive: true }),
    mkdir(paths.orgAdministrationPoliciesCoreDir, { recursive: true }),
    mkdir(paths.orgAdministrationPoliciesHrDir, { recursive: true }),
    mkdir(paths.orgAdministrationPoliciesOpsDir, { recursive: true }),
    mkdir(paths.orgAdministrationPoliciesSecurityDir, { recursive: true }),
    mkdir(paths.orgAdministrationEvaluationsDir, { recursive: true }),
    mkdir(paths.orgAdministrationIntegrationsDir, { recursive: true }),
    mkdir(paths.orgAdministrationCalendarDir, { recursive: true }),
    mkdir(paths.orgAdministrationAttendanceDir, { recursive: true }),
    mkdir(paths.orgAdministrationFeedbackDir, { recursive: true }),
    mkdir(paths.orgAdministrationMeetingsDir, { recursive: true }),
    mkdir(paths.orgAdministrationChannelsDir, { recursive: true }),
    mkdir(join(paths.orgAdministrationDir, 'staff'), { recursive: true }),
    mkdir(paths.departmentsTemplateDir, { recursive: true }),
    mkdir(paths.agentsSharedOnboardingDir, { recursive: true }),
  ]);

  const registryPayload = {
    metadata: {
      classification: 'T2-INTERNAL',
      schemaRef: '/core/schemas/onboarding/onboarding-commit.schema.json',
      source: 'director-manual',
    },
    committedAt,
    source: 'onboarding',
    kpis: normalizedKpis,
  };

  const contextPayload = {
    metadata: {
      classification: 'T2-INTERNAL',
      schemaRef: '/core/schemas/onboarding/onboarding-commit.schema.json',
      source: 'director-manual',
    },
    committedAt,
    source: 'onboarding',
    contextByStep: payload.contextByStep,
  };

  const companyRequirementsTemplatePayload = {
    metadata: {
      classification: 'T2-INTERNAL',
      schemaRef: '/core/schemas/onboarding/onboarding-commit.schema.json',
      source: 'onboarding-template',
    },
    mandatory_fields: {
      company_vision: readStepValue(payload, 'company-core', 'company_vision'),
      company_context: readStepValue(payload, 'company-core', 'company_context'),
      core_values: readStepValue(payload, 'company-core', 'core_values'),
      global_non_negotiables: readStepValue(payload, 'company-core', 'global_non_negotiables'),
      product_value_proposition: readStepValue(payload, 'product-context', 'product_value_proposition'),
      product_features: readStepValue(payload, 'product-context', 'product_features'),
      technical_constraints: readStepValue(payload, 'product-context', 'technical_constraints'),
      approved_skills: readStepValue(payload, 'global-assets', 'approved_skills'),
      approved_kpis: readStepValue(payload, 'global-assets', 'approved_kpis'),
      approved_protocols: readStepValue(payload, 'global-guardrails', 'approved_protocols'),
      approved_data_inputs: readStepValue(payload, 'global-guardrails', 'approved_data_inputs'),
      approved_workflows: readStepValue(payload, 'agent-workflows', 'approved_workflows'),
      workflow_dependency_rules: readStepValue(payload, 'agent-workflows', 'workflow_dependency_rules'),
      channel_provider: readStepValue(payload, 'infrastructure-finalization', 'channel_provider'),
      allowed_channels: readStepValue(payload, 'infrastructure-finalization', 'allowed_channels'),
      approved_agents_for_channels: readStepValue(payload, 'infrastructure-finalization', 'approved_agents_for_channels'),
      channel_access_rules: readStepValue(payload, 'infrastructure-finalization', 'channel_access_rules'),
    },
    guiding_questions: [
      'What unique company advantage must AI recommendations protect?',
      'Which objectives are mandatory this quarter regardless of trade-offs?',
      'What KPI drift should trigger escalation to director-level review?',
      'Which risks are acceptable versus unacceptable under current runway?',
    ],
    committedAt,
    approvalByStep: payload.approvalByStep,
    agentMappings: payload.agentMappings,
  };

  const profilePayload = {
    metadata: {
      classification: 'T2-INTERNAL',
      source: 'director-manual',
    },
    committedAt,
    owner: 'director',
    role: 'onboarding',
    summary: 'Consolidated onboarding persona and goal alignment context.',
    steps: Object.keys(payload.contextByStep),
  };

  const profileTemplatePayload = {
    metadata: {
      classification: 'T2-INTERNAL',
      source: 'onboarding-template',
    },
    committedAt,
    employees: Object.entries(payload.contextByStep['agent-profile-persona'] ?? {})
      .filter(([key]) => key.endsWith('.goal'))
      .map(([key, goal]) => {
        const employeeId = key.replace('.goal', '');
        return {
          id: employeeId,
          in_depth_goal: goal,
          in_depth_backstory: payload.contextByStep['agent-profile-persona']?.[`${employeeId}.backstory`] ?? '',
          core_skills: payload.contextByStep['agent-profile-persona']?.[`${employeeId}.skills`] ?? '',
          core_objective: payload.contextByStep['agent-profile-persona']?.[`${employeeId}.core_objective`] ?? '',
          individual_vision: payload.contextByStep['agent-profile-persona']?.[`${employeeId}.individual_vision`] ?? '',
          role_non_negotiable_requirements:
            payload.contextByStep['agent-profile-persona']?.[`${employeeId}.role_non_negotiable_requirements`] ?? '',
        };
      }),
  };

  const kpiTemplatePayload = {
    metadata: {
      classification: 'T2-INTERNAL',
      source: 'onboarding-template',
    },
    version: '1.0',
    committedAt,
    example_kpis: normalizedKpis,
  };

  const skillsTemplate = [
    '# Onboarding Core Skills Template',
    '',
    'Use this template to keep skill mapping deterministic during onboarding.',
    '',
    '## Required Mapping Format',
    '- Employee ID',
    '- Role Title',
    '- Core Skills (Markdown filenames)',
    '- Optional Extensions',
    '',
    '## Seeded Skill Mapping',
    ...Object.entries(payload.contextByStep['agent-profile-persona'] ?? {})
      .filter(([key]) => key.endsWith('.core_skills'))
      .map(([key, value]) => `- ${key.replace('.core_skills', '')}: ${value}`),
  ].join('\n');

  const departmentTemplate = [
    '# Department Standard Template',
    '',
    'Every department folder should contain:',
    '- rules/',
    '- data/',
    '- reports/',
    '- metadata.json',
    '',
    'Metadata schema example:',
    '{',
    '  "owner": "agent-id",',
    '  "sensitivity": "high|medium|low",',
    '  "last_updated": "YYYY-MM-DD"',
    '}',
  ].join('\n');

  const policyCoreGovernance = [
    '# Policy: Decision Governance and Delegation',
    '',
    '## Scope',
    '- Applies to all director-office and administration workflows.',
    '',
    '## Rules',
    '1. Any policy change must include rationale, owner, and review date.',
    '2. Any organization-wide decision must capture impacted teams and risk classification.',
    '3. Emergency overrides require Director acknowledgement within 24 hours.',
    '',
    '## Review Cadence',
    '- Monthly governance review by Director Office.',
    '- Quarterly policy refresh against legal and operational updates.',
  ].join('\n');

  const policyHrPerformance = [
    '# Policy: Staff Performance and Wellbeing Evaluation',
    '',
    '## Scope',
    '- Covers KPI checks, employee happiness feedback, and improvement plans.',
    '',
    '## Rules',
    '1. KPI evaluations are run monthly per role-specific thresholds.',
    '2. Happiness and feedback survey runs every 30 days via approved form workflow.',
    '3. Improvement plans require measurable goals and 2-week checkpoints.',
    '',
    '## Privacy',
    '- Feedback records are internal and visible to HR and Director Office only.',
  ].join('\n');

  const policyOperationsControls = [
    '# Policy: Attendance, Calendar, and Administrative Controls',
    '',
    '## Scope',
    '- Governs attendance records, holiday calendar updates, and admin workflow ownership.',
    '',
    '## Rules',
    '1. Attendance source of truth is Google Sheets unless fallback CSV mode is active.',
    '2. Holiday calendar changes require announcement in weekly status summary.',
    '3. All admin workflows must include owner, SLA, and escalation contact.',
  ].join('\n');

  const policySecurityCompliance = [
    '# Policy: External Integration Security and Audit',
    '',
    '## Scope',
    '- Covers Google Workspace APIs, form ingestion, email automation, MCP connectors, and social-trend feeds.',
    '',
    '## Rules',
    '1. Service account scopes must be least-privilege and documented.',
    '2. External webhook automation must include signing secret validation.',
    '3. Social trend ingestion is read-only and never publishes automatically.',
    '4. Conversion pipelines (markdown/html/docx) must preserve audit metadata.',
  ].join('\n');

  const staffCsvSeed = [
    'employee_id,full_name,department,role,email,status,manager,join_date,employment_type,location,kpi_profile,sheet_row_ref',
    'DIR-001,Director Office Lead,Director Office,Director,director-office@example.com,active,BOARD,2023-01-03,full_time,HQ,director-office-core,2',
    'ADM-001,Administration Manager,Administration,Manager,admin-manager@example.com,active,DIR-001,2023-05-15,full_time,HQ,administration-core,3',
    'HR-001,People Operations Specialist,Administration,HR Specialist,people-ops@example.com,active,ADM-001,2024-02-02,full_time,HQ,people-ops-core,4',
  ].join('\n');

  const holidayCalendarCsvSeed = [
    'date,name,region,type,notes',
    '2026-01-01,New Year,GLOBAL,public_holiday,Organization closed',
    '2026-03-29,Annual Strategy Day,GLOBAL,internal_event,Director office planning day',
  ].join('\n');

  const attendanceTemplateCsvSeed = [
    'date,employee_id,status,check_in,check_out,source,remarks',
    '2026-03-01,ADM-001,present,09:02,18:11,google_sheets,',
    '2026-03-01,HR-001,present,09:15,18:03,google_sheets,',
  ].join('\n');

  const policyIndexPayload = {
    metadata: {
      classification: 'T2-INTERNAL',
      source: 'onboarding-template',
      unitBoundary: 'single-policy-per-file',
      maxContextGuidance: 'Each markdown file should stay below ~16k token context usage.',
    },
    categories: [
      {
        id: 'core-governance',
        owner: 'director-office',
        files: ['/org/administration/policies/core-governance/decision-governance.md'],
      },
      {
        id: 'hr-performance',
        owner: 'people-operations',
        files: ['/org/administration/policies/hr-performance/performance-and-wellbeing.md'],
      },
      {
        id: 'operations-controls',
        owner: 'administration-manager',
        files: ['/org/administration/policies/operations-controls/attendance-and-calendar-controls.md'],
      },
      {
        id: 'security-compliance',
        owner: 'security-and-compliance',
        files: ['/org/administration/policies/security-compliance/external-integration-security.md'],
      },
    ],
  };

  const integrationConfigPayload = {
    metadata: {
      classification: 'T2-INTERNAL',
      source: 'director-onboarding',
    },
    workspaceAccount: {
      email: 'director-office-automation@example.com',
      ownerRole: 'director-office',
      managedBy: ['administration-manager', 'security-and-compliance'],
    },
    channels: {
      email: {
        enabled: true,
        direction: ['inbound', 'outbound'],
        ingestionPurpose: ['meeting-notes', 'daily-status', 'weekly-status'],
      },
      socialTrend: {
        enabled: true,
        providers: ['twitter-x-readonly'],
        mode: 'read-only-ingestion',
      },
    },
    conversionPipelines: {
      markdownToHtml: { enabled: true, status: 'planned' },
      markdownToDocx: { enabled: true, status: 'planned' },
      docxToMarkdown: { enabled: true, status: 'planned' },
      htmlToMarkdown: { enabled: true, status: 'planned' },
    },
    orchestration: {
      mcpPreferred: true,
      zapierWebhookFallback: true,
      notes: 'All external connectors must pass policy and audit trail checks before production enablement.',
    },
  };

  const googleSheetsMappingPayload = {
    metadata: {
      classification: 'T2-INTERNAL',
      source: 'onboarding-template',
    },
    workbook: {
      spreadsheetId: 'REPLACE_WITH_SPREADSHEET_ID',
      tabs: {
        staffRegistry: 'staff_registry',
        attendance: 'attendance',
        holidayCalendar: 'holiday_calendar',
        performanceMonthly: 'performance_monthly',
      },
    },
    sync: {
      mode: 'scheduled',
      frequency: 'daily',
      conflictRule: 'google-sheet-authoritative',
    },
  };

  const feedbackTemplate = [
    '# Employee Happiness and Improvement Form Template',
    '',
    '## Recommended Fields',
    '1. Employee ID',
    '2. Team and role',
    '3. Happiness score (1-10)',
    '4. Workload score (1-10)',
    '5. What is going well?',
    '6. What needs improvement?',
    '7. Support requested from admin/director office',
    '',
    '## Cadence',
    '- Default: every 30 days.',
    '- Optional pulse-check: every 14 days for high-change teams.',
  ].join('\n');

  const meetingNotesTemplate = [
    '# Weekly Administration Meeting Notes',
    '',
    '## Header',
    '- Meeting date:',
    '- Facilitator:',
    '- Attendees:',
    '',
    '## Agenda',
    '1. Policy updates',
    '2. Staff KPI review',
    '3. Feedback and wellbeing updates',
    '4. Escalations and decisions',
    '',
    '## Actions',
    '| Action | Owner | Due Date | Status |',
    '|---|---|---|---|',
    '',
    '## Follow-up',
    '- Daily summary owner:',
    '- Weekly summary owner:',
  ].join('\n');

  const channelIntelligenceConfigPayload = {
    metadata: {
      classification: 'T2-INTERNAL',
      source: 'onboarding-template',
    },
    channels: [
      {
        id: 'mail',
        type: 'email',
        enabled: true,
        source: 'director-office-automation@example.com',
        usage: ['status-updates', 'meeting-notes', 'approval-requests'],
      },
      {
        id: 'twitter-trends',
        type: 'social-intelligence',
        enabled: true,
        source: 'mcp-or-approved-adapter',
        usage: ['trend-monitoring', 'policy-input-signals'],
      },
    ],
    reviewPolicy: {
      autoPublishAllowed: false,
      requiresHumanValidation: true,
      reviewCadence: 'weekly',
    },
  };

  const schemaPayload = {
    type: 'object',
    required: ['committedAt', 'source', 'kpis', 'contextByStep'],
    properties: {
      committedAt: { type: 'string' },
      source: { type: 'string' },
      contextByStep: {
        type: 'object',
        required: [
          'company-core',
          'product-context',
          'global-assets',
          'global-guardrails',
          'agent-profile-persona',
          'agent-workflows',
          'infrastructure-finalization',
        ],
      },
      kpis: {
        type: 'array',
        minItems: 2,
        items: {
          type: 'object',
          required: ['id', 'name', 'target'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            target: { type: 'string' },
          },
        },
      },
    },
  };

  let kpiIndex: Record<string, string> = {};
  if (existsSync(paths.kpiIndexFile)) {
    try {
      const rawIndex = await readFile(paths.kpiIndexFile, 'utf8');
      const parsed = JSON.parse(rawIndex) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        kpiIndex = parsed as Record<string, string>;
      }
    } catch {
      kpiIndex = {};
    }
  }

  kpiIndex['director-input'] = '/core/kpis/org/onboarding-kpi-registry.json';

  let routingMap: Record<string, string> = {};
  if (existsSync(paths.routingMapFile)) {
    try {
      const rawRouting = await readFile(paths.routingMapFile, 'utf8');
      const parsed = JSON.parse(rawRouting) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        routingMap = parsed as Record<string, string>;
      }
    } catch {
      routingMap = {};
    }
  }

  routingMap['onboarding_kpi_lookup'] = '/core/kpis/org/onboarding-kpi-registry.json';
  routingMap['onboarding_context'] = '/org/onboarding/context.json';
  routingMap['onboarding_profile_alignment'] = '/agents/shared/onboarding/profile-alignment.json';
  routingMap['onboarding_company_requirements_template'] = '/org/onboarding/company-requirements.template.json';
  routingMap['onboarding_core_skills_template'] = '/core/skills/shared/onboarding-core-skills-template.md';
  routingMap['administration_policy_index'] = '/org/administration/policies/policy-index.json';
  routingMap['administration_staff_registry'] = '/org/administration/staff/staff-registry.csv';
  routingMap['administration_integration_config'] = '/org/administration/integrations/external-systems.config.json';
  routingMap['administration_google_sheets_mapping'] = '/org/administration/integrations/google-sheets.mapping.json';
  routingMap['administration_feedback_template'] = '/org/administration/feedback/employee-happiness-form-template.md';
  routingMap['administration_meeting_template'] = '/org/administration/meetings/weekly-admin-meeting-notes.template.md';
  routingMap['administration_channel_intelligence'] = '/org/administration/channels/intelligence-channels.config.json';

  let skillsIndex: Record<string, string> = {};
  if (existsSync(paths.skillsIndexFile)) {
    try {
      const rawSkillsIndex = await readFile(paths.skillsIndexFile, 'utf8');
      const parsed = JSON.parse(rawSkillsIndex) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        skillsIndex = parsed as Record<string, string>;
      }
    } catch {
      skillsIndex = {};
    }
  }

  skillsIndex['onboarding-core-skills'] = '/core/skills/shared/onboarding-core-skills-template.md';

  await Promise.all([
    writeFile(paths.kpiRegistryFile, JSON.stringify(registryPayload, null, 2), 'utf8'),
    writeFile(paths.kpiTemplateFile, JSON.stringify(kpiTemplatePayload, null, 2), 'utf8'),
    writeFile(paths.contextFile, JSON.stringify(contextPayload, null, 2), 'utf8'),
    writeFile(paths.companyRequirementsTemplateFile, JSON.stringify(companyRequirementsTemplatePayload, null, 2), 'utf8'),
    writeFile(paths.profileFile, JSON.stringify(profilePayload, null, 2), 'utf8'),
    writeFile(paths.profileTemplateFile, JSON.stringify(profileTemplatePayload, null, 2), 'utf8'),
    writeFile(paths.skillsTemplateFile, skillsTemplate, 'utf8'),
    writeFile(paths.departmentTemplateFile, departmentTemplate, 'utf8'),
    writeFile(paths.schemaFile, JSON.stringify(schemaPayload, null, 2), 'utf8'),
    writeFile(join(paths.orgAdministrationPoliciesCoreDir, 'decision-governance.md'), policyCoreGovernance, 'utf8'),
    writeFile(join(paths.orgAdministrationPoliciesHrDir, 'performance-and-wellbeing.md'), policyHrPerformance, 'utf8'),
    writeFile(join(paths.orgAdministrationPoliciesOpsDir, 'attendance-and-calendar-controls.md'), policyOperationsControls, 'utf8'),
    writeFile(join(paths.orgAdministrationPoliciesSecurityDir, 'external-integration-security.md'), policySecurityCompliance, 'utf8'),
    writeFile(paths.policyIndexFile, JSON.stringify(policyIndexPayload, null, 2), 'utf8'),
    writeFile(paths.staffCsvFile, staffCsvSeed, 'utf8'),
    writeFile(paths.holidayCalendarFile, holidayCalendarCsvSeed, 'utf8'),
    writeFile(paths.attendanceTemplateFile, attendanceTemplateCsvSeed, 'utf8'),
    writeFile(paths.integrationConfigFile, JSON.stringify(integrationConfigPayload, null, 2), 'utf8'),
    writeFile(paths.googleSheetsMappingFile, JSON.stringify(googleSheetsMappingPayload, null, 2), 'utf8'),
    writeFile(paths.feedbackTemplateFile, feedbackTemplate, 'utf8'),
    writeFile(paths.meetingNotesTemplateFile, meetingNotesTemplate, 'utf8'),
    writeFile(paths.channelIntelligenceConfigFile, JSON.stringify(channelIntelligenceConfigPayload, null, 2), 'utf8'),
    writeFile(paths.kpiIndexFile, JSON.stringify(kpiIndex, null, 2), 'utf8'),
    writeFile(paths.skillsIndexFile, JSON.stringify(skillsIndex, null, 2), 'utf8'),
    writeFile(paths.routingMapFile, JSON.stringify(routingMap, null, 2), 'utf8'),
  ]);
};

const getSettingsFilePath = (): string => {
  return join(getAppDataRoot(), SETTINGS_FILE);
};

const getOperationsStatePath = (): string => {
  return join(getAppDataRoot(), OPERATIONS_STATE_FILE);
};

const ensureSettingsStore = async (): Promise<void> => {
  await mkdir(getAppDataRoot(), { recursive: true });
  const settingsPath = getSettingsFilePath();
  if (!existsSync(settingsPath)) {
    const runtimeSync = getRuntimeBootstrapConfig().sync;
    const seeded: PersistedSettings = {
      language: 'en',
      preferredModelProvider: 'lmstudio',
      themeMode: 'system',
      reducedMotion: false,
      syncPushIntervalMs: runtimeSync.pushIntervalMs,
      syncCronEnabled: runtimeSync.cronEnabled,
      syncPushCronEnabled: runtimeSync.cronEnabled,
      syncPullCronEnabled: runtimeSync.cronEnabled,
      syncPushCronExpression: runtimeSync.pushCronExpression,
      syncPullCronExpression: runtimeSync.pullCronExpression,
      syncHealthAutoRefreshEnabled: true,
      syncHealthAutoRefreshIntervalMs: 30_000,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(settingsPath, JSON.stringify(seeded, null, 2), 'utf8');
  }
};

const normalizeSyncSettings = (payload: SettingsPayload, parsed?: Partial<PersistedSettings>): {
  syncPushIntervalMs: number;
  syncCronEnabled: boolean;
  syncPushCronEnabled: boolean;
  syncPullCronEnabled: boolean;
  syncPushCronExpression: string;
  syncPullCronExpression: string;
  syncHealthAutoRefreshEnabled: boolean;
  syncHealthAutoRefreshIntervalMs: number;
} => {
  const runtimeSync = getRuntimeBootstrapConfig().sync;

  const syncPushIntervalMs = Math.max(
    30_000,
    payload.syncPushIntervalMs
      ?? parsed?.syncPushIntervalMs
      ?? runtimeSync.pushIntervalMs,
  );
  const syncCronEnabled = payload.syncCronEnabled ?? parsed?.syncCronEnabled ?? runtimeSync.cronEnabled;
  const syncPushCronEnabled = payload.syncPushCronEnabled ?? parsed?.syncPushCronEnabled ?? syncCronEnabled;
  const syncPullCronEnabled = payload.syncPullCronEnabled ?? parsed?.syncPullCronEnabled ?? syncCronEnabled;
  const syncPushCronExpression =
    payload.syncPushCronExpression?.trim()
    || parsed?.syncPushCronExpression?.trim()
    || runtimeSync.pushCronExpression;
  const syncPullCronExpression =
    payload.syncPullCronExpression?.trim()
    || parsed?.syncPullCronExpression?.trim()
    || runtimeSync.pullCronExpression;
  const syncHealthAutoRefreshEnabled = payload.syncHealthAutoRefreshEnabled
    ?? parsed?.syncHealthAutoRefreshEnabled
    ?? true;
  const syncHealthAutoRefreshIntervalMs = Math.max(
    5_000,
    payload.syncHealthAutoRefreshIntervalMs
      ?? parsed?.syncHealthAutoRefreshIntervalMs
      ?? 30_000,
  );

  return {
    syncPushIntervalMs,
    syncCronEnabled,
    syncPushCronEnabled,
    syncPullCronEnabled,
    syncPushCronExpression,
    syncPullCronExpression,
    syncHealthAutoRefreshEnabled,
    syncHealthAutoRefreshIntervalMs,
  };
};

const applySyncAutomationFromSettings = async (settings: PersistedSettings): Promise<void> => {
  syncProviderService.updatePushInterval(settings.syncPushIntervalMs);

  const pushEnabled = settings.syncCronEnabled && settings.syncPushCronEnabled;
  const pullEnabled = settings.syncCronEnabled && settings.syncPullCronEnabled;

  await cronSchedulerService.upsertJob({
    id: SYNC_PUSH_CRON_JOB_ID,
    name: 'Registry Sync Push (DB -> Vault)',
    expression: settings.syncPushCronExpression,
    enabled: pushEnabled,
    retentionDays: 30,
    maxRuntimeMs: 30_000,
  });

  await cronSchedulerService.upsertJob({
    id: SYNC_PULL_CRON_JOB_ID,
    name: 'Registry Sync Pull (Vault -> DB)',
    expression: settings.syncPullCronExpression,
    enabled: pullEnabled,
    retentionDays: 30,
    maxRuntimeMs: 30_000,
  });
};

const seedOperationsState = (): PersistedOperationsState => {
  return {
    governanceDecisions: [],
    governanceLogs: [],
    triageItems: [],
    onboardingKpis: [],
    onboardingGeneratedAt: null,
    onboardingCommittedAt: null,
  };
};

const LEGACY_DEMO_DECISION_IDS = new Set(['DEC-001', 'DEC-002', 'DEC-003']);
const LEGACY_DEMO_LOG_IDS = new Set(['LOG-1001', 'LOG-1002', 'LOG-1003']);
const LEGACY_DEMO_TRIAGE_IDS = new Set(['TRG-001', 'TRG-002', 'TRG-003']);

const pruneLegacyDemoState = (state: PersistedOperationsState): PersistedOperationsState => {
  return {
    ...state,
    governanceDecisions: state.governanceDecisions.filter((entry) => !LEGACY_DEMO_DECISION_IDS.has(entry.id)),
    governanceLogs: state.governanceLogs.filter((entry) => !LEGACY_DEMO_LOG_IDS.has(entry.id)),
    triageItems: state.triageItems.filter((entry) => !LEGACY_DEMO_TRIAGE_IDS.has(entry.id)),
  };
};

const ensureOperationsStateStore = async (): Promise<void> => {
  await mkdir(getAppDataRoot(), { recursive: true });
  const statePath = getOperationsStatePath();

  if (!existsSync(statePath)) {
    await writeFile(statePath, JSON.stringify(seedOperationsState(), null, 2), 'utf8');
  }
};

const readOperationsState = async (): Promise<PersistedOperationsState> => {
  await ensureOperationsStateStore();
  const raw = await readFile(getOperationsStatePath(), 'utf8');
  const parsed = normalizeOperationsState(JSON.parse(raw) as PersistedOperationsState);
  const pruned = pruneLegacyDemoState(parsed);

  if (
    pruned.governanceDecisions.length !== parsed.governanceDecisions.length ||
    pruned.governanceLogs.length !== parsed.governanceLogs.length ||
    pruned.triageItems.length !== parsed.triageItems.length
  ) {
    await writeOperationsState(pruned);
  }

  return pruned;
};

const writeOperationsState = async (state: PersistedOperationsState): Promise<void> => {
  await writeFile(getOperationsStatePath(), JSON.stringify(state, null, 2), 'utf8');
};

const normalizeOperationsState = (state: PersistedOperationsState): PersistedOperationsState => {
  return {
    ...state,
    onboardingCommittedAt: state.onboardingCommittedAt ?? null,
  };
};

const nextLogId = (logs: GovernanceLogEntry[]): string => {
  const max = logs
    .map((entry) => Number.parseInt(entry.id.replace('LOG-', ''), 10))
    .filter((value) => Number.isFinite(value))
    .reduce((acc, value) => Math.max(acc, value), 1000);
  return `LOG-${max + 1}`;
};

const formatMinutesAgo = (minutesAgo: number): string => {
  const now = Date.now();
  return new Date(now - minutesAgo * 60_000).toISOString();
};

const getWeekEnding = (): string => {
  const date = new Date();
  const day = date.getDay();
  const offsetToFriday = (5 - day + 7) % 7;
  const friday = new Date(date);
  friday.setDate(date.getDate() + offsetToFriday);
  return friday.toISOString().slice(0, 10);
};

const mapQueueEntryToTaskStatus = (status: string): QueueTask['status'] => {
  if (status === 'QUEUED') {
    return 'PENDING';
  }
  if (status === 'RUNNING') {
    return 'RUNNING';
  }
  if (status === 'COMPLETED') {
    return 'SUCCEEDED';
  }
  if (status === 'FAILED') {
    return 'FAILED';
  }
  return 'PAUSED';
};

const mapWorkOrderStateToTriageStatus = (state: string): TriageItem['status'] => {
  if (state === 'INIT' || state === 'PLANNED' || state === 'QUEUED') {
    return 'PENDING';
  }

  if (state === 'WAITING' || state === 'EXECUTING' || state === 'SYNTHESIS' || state === 'REVIEW') {
    return 'ANALYSIS';
  }

  return 'CLEARED';
};

const buildOnboardingKpisForAgent = (agentId: string, role: string): OnboardingKpi[] => {
  const normalizedRole = role.toLowerCase();

  if (normalizedRole.includes('finance') || normalizedRole.includes('cfo')) {
    return [
      { id: `${agentId}-1`, name: 'Runway Coverage', unit: 'months', target: '>= 18', threshold: '< 12' },
      { id: `${agentId}-2`, name: 'Burn Variance', unit: '%', target: '<= 5', threshold: '> 10' },
    ];
  }

  if (normalizedRole.includes('tech') || normalizedRole.includes('cto')) {
    return [
      { id: `${agentId}-1`, name: 'Deployment Success', unit: '%', target: '>= 98', threshold: '< 95' },
      { id: `${agentId}-2`, name: 'Lead Time', unit: 'hours', target: '<= 24', threshold: '> 48' },
    ];
  }

  if (normalizedRole.includes('marketing') || normalizedRole.includes('cmo')) {
    return [
      { id: `${agentId}-1`, name: 'CAC Payback', unit: 'months', target: '<= 12', threshold: '> 15' },
      { id: `${agentId}-2`, name: 'Pipeline Coverage', unit: 'x', target: '>= 3.0', threshold: '< 2.0' },
    ];
  }

  if (normalizedRole.includes('compliance')) {
    return [
      { id: `${agentId}-1`, name: 'Control Pass Rate', unit: '%', target: '>= 95', threshold: '< 90' },
      { id: `${agentId}-2`, name: 'Critical Findings', unit: 'count', target: '0', threshold: '> 2' },
    ];
  }

  if (normalizedRole.includes('operations') || normalizedRole.includes('coo')) {
    return [
      { id: `${agentId}-1`, name: 'Execution Throughput', unit: 'tasks/week', target: '>= 40', threshold: '< 25' },
      { id: `${agentId}-2`, name: 'SLA Breaches', unit: 'count', target: '<= 1', threshold: '> 4' },
    ];
  }

  if (normalizedRole.includes('design')) {
    return [
      { id: `${agentId}-1`, name: 'Design Debt', unit: 'tickets', target: '<= 8', threshold: '> 15' },
      { id: `${agentId}-2`, name: 'Accessibility Coverage', unit: '%', target: '>= 95', threshold: '< 85' },
    ];
  }

  if (normalizedRole.includes('hr')) {
    return [
      { id: `${agentId}-1`, name: 'Offer Acceptance', unit: '%', target: '>= 80', threshold: '< 65' },
      { id: `${agentId}-2`, name: 'Time to Fill', unit: 'days', target: '<= 35', threshold: '> 50' },
    ];
  }

  if (normalizedRole.includes('fund')) {
    return [
      { id: `${agentId}-1`, name: 'Investor Response', unit: '%', target: '>= 40', threshold: '< 20' },
      { id: `${agentId}-2`, name: 'Pipeline Stage Progression', unit: '%', target: '>= 60', threshold: '< 35' },
    ];
  }

  if (normalizedRole.includes('ceo') || normalizedRole.includes('strategy')) {
    return [
      { id: `${agentId}-1`, name: 'Strategic Milestones Hit', unit: '%', target: '>= 85', threshold: '< 70' },
      { id: `${agentId}-2`, name: 'Cross-Team Alignment', unit: '%', target: '>= 90', threshold: '< 75' },
    ];
  }

  return [
    { id: `${agentId}-1`, name: 'Decision Cycle Time', unit: 'hours', target: '<= 24', threshold: '> 48' },
    { id: `${agentId}-2`, name: 'Execution Reliability', unit: '%', target: '>= 92', threshold: '< 80' },
  ];
};

const synthesizeOnboardingRegistry = (): OnboardingAgentKpiRecord[] => {
  return agentRegistryService.listAgents().map((agent) => ({
    agentId: agent.agentId,
    agent: agent.name,
    role: agent.role,
    kpis: buildOnboardingKpisForAgent(agent.agentId, agent.role),
  }));
};

const roleToDesignation = (role: string): string => {
  if (role === 'secretary') return '@secretary';
  if (role === 'ceo') return '@ceo';
  if (role === 'cfo') return '@cfo';
  if (role === 'cto') return '@cto';
  if (role === 'coo') return '@coo';
  if (role === 'compliance') return '@compliance';
  if (role === 'cmo') return '@cmo';
  if (role === 'designer') return '@designer';
  if (role === 'hr') return '@hr';
  if (role === 'funding') return '@funding';
  return `@${role}`;
};

const buildRuntimeWorkflow = (name: string): string[] => {
  return [
    `Receive and parse Director request for ${name}`,
    'Validate constraints and policy boundaries',
    'Execute delegated tasks and synthesize findings',
    'Return recommendation for Director review',
  ];
};

const toRoleLabel = (role: string): string => {
  if (role === 'ceo') return 'Chief Executive Officer';
  if (role === 'cfo') return 'Chief Financial Officer';
  if (role === 'cto') return 'Chief Technology Officer';
  if (role === 'coo') return 'Chief Operating Officer';
  if (role === 'cmo') return 'Chief Marketing Officer';
  if (role === 'hr') return 'Head of Human Resources';
  if (role === 'funding') return 'Funding & Resource Procurement';
  if (role === 'designer') return 'Head of Design';
  if (role === 'compliance') return 'Compliance Officer';
  return 'Secretary & Command Router';
};

const buildRuntimeKpis = (orders: ReturnType<typeof workOrderService.list>): EmployeeProfileKpi[] => {
  const total = orders.length;
  const completed = orders.filter((order) => order.state === 'COMPLETED' || order.state === 'APPROVED').length;
  const failed = orders.filter((order) => order.state === 'FAILED' || order.state === 'REJECTED').length;
  const active = orders.filter(
    (order) => order.state === 'INIT' || order.state === 'PLANNED' || order.state === 'QUEUED' || order.state === 'EXECUTING' || order.state === 'SYNTHESIS' || order.state === 'REVIEW',
  ).length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const failureRate = total > 0 ? Math.round((failed / total) * 100) : 0;

  return [
    {
      name: 'Completed Work Orders',
      value: String(completed),
      trend: completed > 0 ? 'up' : 'neutral',
    },
    {
      name: 'Active Work Orders',
      value: String(active),
      trend: active > 3 ? 'down' : active > 0 ? 'neutral' : 'up',
    },
    {
      name: 'Failure Rate',
      value: `${failureRate}%`,
      trend: failureRate > 10 ? 'down' : failureRate > 0 ? 'neutral' : 'up',
    },
    {
      name: 'Completion Rate',
      value: `${completionRate}%`,
      trend: completionRate >= 70 ? 'up' : completionRate >= 40 ? 'neutral' : 'down',
    },
  ];
};

export const operationsService = {
  async loadSettings(): Promise<SettingsPayload> {
    await ensureSettingsStore();
    const raw = await readFile(getSettingsFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    const sync = normalizeSyncSettings({
      language: 'en',
      preferredModelProvider: 'lmstudio',
      themeMode: 'system',
      reducedMotion: false,
    }, parsed);

    return {
      language: parsed.language || 'en',
      preferredModelProvider: parsed.preferredModelProvider || 'lmstudio',
      themeMode: parsed.themeMode || 'system',
      reducedMotion: parsed.reducedMotion ?? false,
      syncPushIntervalMs: sync.syncPushIntervalMs,
      syncCronEnabled: sync.syncCronEnabled,
      syncPushCronEnabled: sync.syncPushCronEnabled,
      syncPullCronEnabled: sync.syncPullCronEnabled,
      syncPushCronExpression: sync.syncPushCronExpression,
      syncPullCronExpression: sync.syncPullCronExpression,
      syncHealthAutoRefreshEnabled: sync.syncHealthAutoRefreshEnabled,
      syncHealthAutoRefreshIntervalMs: sync.syncHealthAutoRefreshIntervalMs,
    };
  },

  async saveSettings(payload: SettingsPayload): Promise<boolean> {
    await ensureSettingsStore();
    const existingRaw = await readFile(getSettingsFilePath(), 'utf8');
    const existing = JSON.parse(existingRaw) as Partial<PersistedSettings>;
    const normalizedLanguage = payload.language?.trim() || 'en';
    const normalizedProvider = payload.preferredModelProvider || 'lmstudio';
    const normalizedThemeMode = payload.themeMode || 'system';
    const normalizedReducedMotion = Boolean(payload.reducedMotion);
    const normalizedSync = normalizeSyncSettings(payload, existing);

    const content: PersistedSettings = {
      language: normalizedLanguage,
      preferredModelProvider: normalizedProvider,
      themeMode: normalizedThemeMode,
      reducedMotion: normalizedReducedMotion,
      syncPushIntervalMs: normalizedSync.syncPushIntervalMs,
      syncCronEnabled: normalizedSync.syncCronEnabled,
      syncPushCronEnabled: normalizedSync.syncPushCronEnabled,
      syncPullCronEnabled: normalizedSync.syncPullCronEnabled,
      syncPushCronExpression: normalizedSync.syncPushCronExpression,
      syncPullCronExpression: normalizedSync.syncPullCronExpression,
      syncHealthAutoRefreshEnabled: normalizedSync.syncHealthAutoRefreshEnabled,
      syncHealthAutoRefreshIntervalMs: normalizedSync.syncHealthAutoRefreshIntervalMs,
      updatedAt: new Date().toISOString(),
    };

    await writeFile(getSettingsFilePath(), JSON.stringify(content, null, 2), 'utf8');
    await applySyncAutomationFromSettings(content);
    return true;
  },

  async getRuntimeChannelConfiguration(): Promise<RuntimeChannelConfigurationPayload> {
    const stored = await registryRuntimeStoreService.getRuntimeChannelDetails();
    if (stored) {
      return toRuntimeChannelConfigurationPayload(stored);
    }

    const runtimeConfig = getPublicRuntimeConfig();
    return {
      provider: 'telegram',
      allowedChannels: ['internal-chat', 'telegram'],
      approvedAgentsForChannels: {},
      channelAccessRules: 'director_only_inbound=true; allow_all_agents_telegram=true',
      telegramChannelId: runtimeConfig.channels.telegramChannelId?.trim() ?? '',
      webhookSubscriptionUri: '',
      providerCredentials: '',
    };
  },

  async updateRuntimeChannelConfiguration(
    payload: RuntimeChannelConfigurationPayload,
  ): Promise<RuntimeChannelConfigurationPayload> {
    const normalizedPayload: RuntimeChannelDetailsUpdatePayload = {
      provider: payload.provider,
      allowedChannels: payload.allowedChannels,
      approvedAgentsForChannels: payload.approvedAgentsForChannels,
      channelAccessRules: payload.channelAccessRules,
      telegramChannelId: payload.telegramChannelId,
      webhookSubscriptionUri: payload.webhookSubscriptionUri,
      providerCredentials: payload.providerCredentials,
    };

    const updated = await registryRuntimeStoreService.updateRuntimeChannelDetails(normalizedPayload);
    return toRuntimeChannelConfigurationPayload(updated);
  },

  async getAdministrationIntegrationSnapshot(): Promise<AdministrationIntegrationSnapshotPayload> {
    return administrationIntegrationService.getSnapshot();
  },

  async syncAdministrationStaffRegistry(): Promise<AdministrationSyncRunReportPayload> {
    return administrationIntegrationService.syncStaffRegistryFromSheets();
  },

  async ingestAdministrationFeedback(): Promise<AdministrationSyncRunReportPayload> {
    return administrationIntegrationService.ingestFeedbackFromForms();
  },

  async convertDocumentContent(payload: DocumentConversionRequestPayload): Promise<DocumentConversionResultPayload> {
    return documentConversionService.convertContent(payload);
  },

  async convertDocumentFile(payload: FileDocumentConversionRequestPayload): Promise<FileDocumentConversionResultPayload> {
    return documentConversionService.convertFile(payload);
  },

  async runAdministrationKpiHappinessEvaluator(): Promise<KpiHappinessEvaluationOutputPayload> {
    return administrationIntegrationService.runKpiHappinessEvaluator();
  },

  async runAdministrationSocialTrendIntelligence(): Promise<SocialTrendIntelligenceOutputPayload> {
    return administrationIntegrationService.runSocialTrendIntelligence();
  },

  async getQueueMonitorPayload(): Promise<QueueMonitorPayload> {
    contextEngineService.bootstrapSession('operations-main');
    await contextEngineService.afterTurn('operations-main');
    subagentService.timeoutSweep();

    const gateway = await modelGatewayService.probeGateway();
    const context = contextEngineService.getTelemetry();
    const subagents = {
      telemetry: subagentService.getTelemetry(),
      tree: subagentService.getTree(),
    };
    const toolPolicy = toolPolicyService.getTelemetry();
    const toolPolicyAudits = toolPolicyService.listRecentAudits(6);
    const hooks = await hookSystemService.getTelemetry();

    const runtimeTasks: QueueTask[] = queueService.list().map((entry) => {
      const workOrder = workOrderService.get(entry.workOrderId);
      return {
        id: entry.id,
        agentProcess: workOrder ? `${workOrder.targetEmployeeId.toUpperCase()} (${workOrder.priority})` : 'Unknown Agent',
        description: workOrder
          ? `${workOrder.moduleRoute} :: ${workOrder.message.slice(0, 72)}`
          : `Queue entry ${entry.id}`,
        enqueuedAt: entry.enqueuedAt,
        status: mapQueueEntryToTaskStatus(entry.status),
        duration: entry.startedAt
          ? `${Math.max(0, Math.floor((Date.now() - new Date(entry.startedAt).getTime()) / 1000))}s`
          : undefined,
      };
    });

    const tasks: QueueTask[] = runtimeTasks;

    const activeCount = tasks.filter((task) => task.status === 'RUNNING').length;
    const pendingCount = tasks.filter((task) => task.status === 'PENDING').length;

    return {
      activeCount,
      pendingCount,
      gateway,
      context,
      hooks,
      toolPolicy,
      toolPolicyAudits,
      subagents,
      tasks,
    };
  },

  async getNotificationPayload(): Promise<NotificationPayload> {
    await hookSystemService.initialize();
    const [gateway, authStatus, skills, vaultFiles] = await Promise.all([
      modelGatewayService.probeGateway(),
      authService.getStatus().catch(() => ({
        sshVerified: false,
        repoReady: false,
        clonedNow: false,
        sshMessage: 'bootstrap_unavailable',
        repoPath: '',
        repoUrl: '',
      })),
      skillSystemService.listWorkspaceSkills().catch(() => []),
      vaultService.listFiles().catch(() => []),
    ]);

    const items: NotificationItem[] = [];
    const machineLockWarning = syncProviderService.getLastMachineLockWarning();

    if (machineLockWarning) {
      items.push({
        id: 'NOTIF-SYNC-LOCK-001',
        timestamp: new Date().toISOString(),
        source: 'Sync Provider',
        severity: 'WARNING',
        message: machineLockWarning,
        read: false,
      });
    }

    if (!authStatus.sshVerified || !authStatus.repoReady) {
      items.push({
        id: 'NOTIF-SSH-001',
        timestamp: new Date().toISOString(),
        source: 'System',
        severity: 'CRITICAL',
        message: 'SSH/repository bootstrap is not ready. Actions are restricted.',
        read: false,
      });
    }

    const unhealthyProviders = gateway.statuses.filter((status) => status.status !== 'healthy');
    if (unhealthyProviders.length > 0) {
      items.push({
        id: 'NOTIF-GTW-001',
        timestamp: formatMinutesAgo(5),
        source: 'Model Gateway',
        severity: 'WARNING',
        message: `Provider health degraded: ${unhealthyProviders.map((p) => `${p.provider}:${p.status}`).join(', ')}`,
        read: false,
      });
    }

    const blockedSkills = skills.filter((skill) => !skill.eligible);
    if (blockedSkills.length > 0) {
      items.push({
        id: 'NOTIF-SKL-001',
        timestamp: formatMinutesAgo(30),
        source: 'Skill Loader',
        severity: 'INFO',
        message: `${blockedSkills.length} skills are currently ineligible due to OS/env/bin constraints.`,
        read: true,
      });
    }

    items.push({
      id: 'NOTIF-VLT-001',
      timestamp: formatMinutesAgo(60),
      source: 'Vault',
      severity: 'INFO',
      message: `Vault inventory indexed files: ${vaultFiles.length}.`,
      read: true,
    });

    const workOrders = workOrderService.list().slice(0, 5);
    items.push(
      ...workOrders.map((order): NotificationItem => {
        const severity: NotificationItem['severity'] =
          order.state === 'FAILED' || order.state === 'REJECTED' ? 'WARNING' : 'INFO';

        return {
          id: `NOTIF-WO-${order.id}`,
          timestamp: order.updatedAt,
          source: 'Work Order Runtime',
          severity,
          message: `${order.id} (${order.targetEmployeeId}) is ${order.state} for ${order.moduleRoute}.`,
          read: order.state === 'COMPLETED' || order.state === 'APPROVED',
        };
      }),
    );

    const hookItems = await hookSystemService.listNotifications(6);
    items.push(
      ...hookItems.map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp,
        source: entry.source,
        severity: entry.severity,
        message: entry.message,
        read: entry.read,
      })),
    );

    const unreadCount = items.filter((item) => !item.read).length;

    return {
      unreadCount,
      items,
    };
  },

  async getDailyBriefPayload(): Promise<DailyBriefPayload> {
    const [gateway, skills, vaultFiles] = await Promise.all([
      modelGatewayService.probeGateway(),
      skillSystemService.listWorkspaceSkills().catch(() => []),
      vaultService.listFiles().catch(() => []),
    ]);
    const schedules = await cronSchedulerService.listJobs();
    const runtimeWorkOrders = workOrderService.list();
    const pendingWorkOrderCount = runtimeWorkOrders.filter(
      (workOrder) =>
        workOrder.state === 'INIT' ||
        workOrder.state === 'PLANNED' ||
        workOrder.state === 'QUEUED' ||
        workOrder.state === 'EXECUTING' ||
        workOrder.state === 'SYNTHESIS' ||
        workOrder.state === 'REVIEW',
    ).length;

    const blockedSkillCount = skills.filter((skill) => !skill.eligible).length;
    const unhealthyProviderNames = gateway.statuses
      .filter((status) => status.status !== 'healthy')
      .map((status) => status.provider);

    return dailyBriefCompilerService.createPayload({
      fallbackOrder: gateway.fallbackOrder,
      unhealthyProviderNames,
      blockedSkillCount,
      vaultFileCount: vaultFiles.length,
      pendingWorkOrderCount,
      recentWorkOrders: runtimeWorkOrders.slice(0, 3).map((workOrder) => ({
        id: workOrder.id,
        targetEmployeeId: workOrder.targetEmployeeId,
        moduleRoute: workOrder.moduleRoute,
        state: workOrder.state,
        priority: workOrder.priority,
      })),
      schedules,
      localeDate: new Date().toLocaleDateString(),
    });
  },

  async getWeeklyReviewPayload(): Promise<WeeklyReviewPayload> {
    const [gateway, skills, vaultFiles] = await Promise.all([
      modelGatewayService.probeGateway(),
      skillSystemService.listWorkspaceSkills().catch(() => []),
      vaultService.listFiles().catch(() => []),
    ]);
    const schedules = await cronSchedulerService.listJobs();
    const scheduleTelemetry = await cronSchedulerService.getTelemetry();
    const runtimeWorkOrders = workOrderService.list();

    const healthyProviders = gateway.statuses.filter((status) => status.status === 'healthy').length;
    const blockedSkills = skills.filter((skill) => !skill.eligible).length;
    const openWorkOrderCount = runtimeWorkOrders.filter(
      (workOrder) => workOrder.state !== 'COMPLETED' && workOrder.state !== 'APPROVED' && workOrder.state !== 'CANCELLED',
    ).length;
    const failedWorkOrderCount = runtimeWorkOrders.filter(
      (workOrder) => workOrder.state === 'FAILED' || workOrder.state === 'REJECTED',
    ).length;

    return weeklyReviewCompilerService.createPayload({
      weekEnding: getWeekEnding(),
      healthyProviderCount: healthyProviders,
      totalProviderCount: gateway.statuses.length,
      activeProvider: gateway.activeProvider,
      blockedSkillCount: blockedSkills,
      totalSkillCount: skills.length,
      vaultFileCount: vaultFiles.length,
      openWorkOrderCount,
      failedWorkOrderCount,
      schedules,
      lastTickAt: scheduleTelemetry.lastTickAt,
    });
  },

  async getGovernancePayload(): Promise<GovernancePayload> {
    const state = await readOperationsState();

    return {
      logs: [...state.governanceLogs].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)),
      decisions: [...state.governanceDecisions],
    };
  },

  async applyGovernanceAction(decisionId: string, action: GovernanceAction): Promise<GovernancePayload> {
    const state = await readOperationsState();
    const decision = state.governanceDecisions.find((entry) => entry.id === decisionId);

    if (!decision) {
      return this.getGovernancePayload();
    }

    if (action === 'APPROVE') {
      decision.status = 'APPROVED';
    } else if (action === 'REJECT') {
      decision.status = 'REJECTED';
    } else if (action === 'DEFER') {
      decision.status = 'DEFERRED';
    } else if (action === 'COMMIT' && decision.status === 'APPROVED') {
      decision.status = 'COMMITTED';
    }

    const result: GovernanceLogEntry['result'] = action === 'REJECT' ? 'FLAGGED' : 'SUCCESS';
    state.governanceLogs.unshift({
      id: nextLogId(state.governanceLogs),
      timestamp: new Date().toISOString(),
      actor: 'DIRECTOR',
      action,
      target: decisionId,
      result,
    });

    await writeOperationsState(state);
    return this.getGovernancePayload();
  },

  async getCompliancePayload(): Promise<CompliancePayload> {
    const [gateway, skills, governance, auditLogs] = await Promise.all([
      modelGatewayService.probeGateway(),
      skillSystemService.listWorkspaceSkills(),
      this.getGovernancePayload(),
      auditLogService.listEntries(500),
    ]);

    const blockedSkills = skills.filter((skill) => !skill.eligible);
    const providerWarnings = gateway.statuses.filter((status) => status.status !== 'healthy');
    const flaggedLogs = governance.logs.filter((entry) => entry.result !== 'SUCCESS');
    const scan = complianceScanService.scan({
      blockedSkillNames: blockedSkills.map((skill) => skill.manifest.name || skill.id),
      degradedProviderNames: providerWarnings.map((entry) => entry.provider),
      governanceFlaggedCount: flaggedLogs.length,
      auditLogEntries: auditLogs,
    });

    return {
      overallStatus: scan.overallStatus,
      violationsCount: scan.violationsCount,
      lastAudit: new Date().toISOString(),
      adherenceScore: scan.adherenceScore,
      checks: scan.checks,
    };
  },

  async getTriagePayload(): Promise<TriageItem[]> {
    const runtimeTriage = workOrderService.list().map((workOrder) => ({
      id: workOrder.id,
      source: `Director:${workOrder.targetEmployeeId}`,
      topic: workOrder.message,
      receivedAt: workOrder.createdAt,
      status: mapWorkOrderStateToTriageStatus(workOrder.state),
    }));

    if (runtimeTriage.length > 0) {
      return runtimeTriage.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
    }

    const state = await readOperationsState();
    return [...state.triageItems].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  },

  async applyTriageAction(itemId: string, action: TriageAction): Promise<TriageItem[]> {
    const workOrder = workOrderService.get(itemId);
    if (workOrder) {
      if (action === 'ANALYZE' && (workOrder.state === 'INIT' || workOrder.state === 'PLANNED' || workOrder.state === 'QUEUED')) {
        workOrderService.updateState(itemId, 'EXECUTING');
      }

      if (action === 'CLEAR' && workOrder.state !== 'COMPLETED') {
        workOrderService.updateState(itemId, 'COMPLETED', { summary: 'Cleared via triage action' });
      }

      return this.getTriagePayload();
    }

    const state = await readOperationsState();
    const item = state.triageItems.find((entry) => entry.id === itemId);

    if (!item) {
      return this.getTriagePayload();
    }

    if (action === 'ANALYZE') {
      item.status = 'ANALYSIS';
    }

    if (action === 'CLEAR') {
      item.status = 'CLEARED';
    }

    state.governanceLogs.unshift({
      id: nextLogId(state.governanceLogs),
      timestamp: new Date().toISOString(),
      actor: 'MIRA_SECRETARY',
      action,
      target: itemId,
      result: 'SUCCESS',
    });

    await writeOperationsState(state);
    return this.getTriagePayload();
  },

  async getSuitePayload(): Promise<SuitePayload> {
    const [skills, triageItems, governance] = await Promise.all([
      skillSystemService.listWorkspaceSkills().catch(() => []),
      this.getTriagePayload(),
      this.getGovernancePayload(),
    ]);

    const pendingTriage = triageItems.filter((item) => item.status !== 'CLEARED').length;
    const pendingDecisions = governance.decisions.filter((decision) => decision.status !== 'COMMITTED').length;
    const allAgents = agentRegistryService.listAgents();
    const allWorkOrders = workOrderService.list();

    const agents: SuiteAgentProfile[] = allAgents.map((agent) => {
      const agentOrders = allWorkOrders.filter((order) => order.targetEmployeeId === agent.agentId);
      const latestOrder = agentOrders[0] ?? null;

      const hasRunning = agentOrders.some((order) =>
        order.state === 'EXECUTING' || order.state === 'SYNTHESIS' || order.state === 'REVIEW',
      );
      const waitingOnRole = agentOrders.find((order) => order.state === 'WAITING' && order.waitingOnRole)?.waitingOnRole ?? null;
      const hasWaiting = agentOrders.some((order) =>
        order.state === 'INIT' || order.state === 'PLANNED' || order.state === 'QUEUED' || order.state === 'WAITING',
      );

      const subAgents = allAgents.filter((candidate) => candidate.agentId !== agent.agentId && agent.canDelegate(candidate.agentId)).length;

      return {
        id: `AGT-${agent.agentId.toUpperCase()}`,
        name: agent.name,
        role: agent.role,
        subAgents,
        status: hasRunning
          ? 'EXECUTING'
          : waitingOnRole
            ? `WAITING_ON_${waitingOnRole.toUpperCase()}`
            : hasWaiting
              ? 'WAITING'
              : pendingTriage > 0 || pendingDecisions > 0
                ? 'WAITING'
                : 'IDLE',
        lastActive: latestOrder ? latestOrder.updatedAt : 'No recent activity',
      };
    });

    return {
      agents,
      skills,
    };
  },

  async getFundingDigestPayload(): Promise<FundingDigestPayload> {
    const [vaultFiles, governance, triageItems] = await Promise.all([
      vaultService.listFiles(),
      this.getGovernancePayload(),
      this.getTriagePayload(),
    ]);

    const blockedDecisions = governance.decisions.filter((decision) => decision.status !== 'COMMITTED').length;
    const unresolvedTriage = triageItems.filter((item) => item.status !== 'CLEARED').length;

    return fundingDigestService.createPayload({
      blockedDecisions,
      unresolvedTriage,
      vaultFileCount: vaultFiles.length,
    });
  },

  async getHiringSimPayload(): Promise<HiringSimPayload> {
    const [skills, triageItems] = await Promise.all([
      skillSystemService.listWorkspaceSkills(),
      this.getTriagePayload(),
    ]);

    const blockedSkillCount = skills.filter((skill) => !skill.eligible).length;

    return hiringSimService.createPayload({
      blockedSkillCount,
      totalSkillCount: skills.length,
      triageItemCount: triageItems.length,
      skillNames: skills.map((skill) => skill.manifest.name || skill.id),
    });
  },

  async getDesignAuditPayload(): Promise<DesignAuditPayload> {
    const [compliance, queue, skills, gateway] = await Promise.all([
      this.getCompliancePayload(),
      this.getQueueMonitorPayload(),
      skillSystemService.listWorkspaceSkills(),
      modelGatewayService.probeGateway(),
    ]);

    const blockedSkillsCount = skills.filter((skill) => !skill.eligible).length;
    const degradedProviderCount = gateway.statuses.filter((status) => status.status !== 'healthy').length;

    return visualAuditService.createPayload({
      complianceOverallStatus: compliance.overallStatus,
      complianceViolationsCount: compliance.violationsCount,
      queuePendingCount: queue.pendingCount,
      blockedSkillsCount,
      degradedProviderCount,
    });
  },

  async getDashboardPayload(): Promise<DashboardPayload> {
    const [governance, triageItems, compliance, gateway, vaultFiles] = await Promise.all([
      this.getGovernancePayload(),
      this.getTriagePayload(),
      this.getCompliancePayload(),
      modelGatewayService.probeGateway(),
      vaultService.listFiles(),
    ]);

    const pendingDecisions = governance.decisions.filter((item) => item.status !== 'COMMITTED').length;
    const pendingTriage = triageItems.filter((item) => item.status !== 'CLEARED').length;
    const providerWarnings = gateway.statuses.filter((item) => item.status !== 'healthy').length;

    const kpis: DashboardKpi[] = [
      {
        id: 'KPI-001',
        label: 'Pending Governance Decisions',
        value: String(pendingDecisions),
        status: pendingDecisions === 0 ? 'healthy' : pendingDecisions < 3 ? 'watch' : 'critical',
        detail: 'Decisions awaiting director commit.',
      },
      {
        id: 'KPI-002',
        label: 'Open Triage Threads',
        value: String(pendingTriage),
        status: pendingTriage === 0 ? 'healthy' : pendingTriage < 4 ? 'watch' : 'critical',
        detail: 'Discrepancies not yet cleared.',
      },
      {
        id: 'KPI-003',
        label: 'Compliance Adherence',
        value: `${compliance.adherenceScore}%`,
        status: compliance.adherenceScore >= 92 ? 'healthy' : compliance.adherenceScore >= 80 ? 'watch' : 'critical',
        detail: 'Derived from gateway, skill, and governance checks.',
      },
      {
        id: 'KPI-004',
        label: 'Vault Indexed Files',
        value: String(vaultFiles.length),
        status: 'healthy',
        detail: 'Files available in secured knowledge workspace.',
      },
      {
        id: 'KPI-005',
        label: 'Model Gateway',
        value: gateway.activeProvider ?? 'none',
        status: providerWarnings === 0 ? 'healthy' : 'watch',
        detail: providerWarnings > 0
          ? `${providerWarnings} providers are degraded and using fallback behavior.`
          : 'All providers healthy.',
      },
    ];

    const highlights: string[] = [
      `Governance trail entries: ${governance.logs.length}.`,
      `Active provider order: ${gateway.fallbackOrder.join(' -> ')}.`,
      compliance.overallStatus === 'secure'
        ? 'Compliance posture is secure across all tracked controls.'
        : `Compliance posture is ${compliance.overallStatus}; review flagged controls.`,
    ];

    return {
      generatedAt: new Date().toISOString(),
      kpis,
      highlights,
    };
  },

  async getInfrastructurePayload(): Promise<InfrastructurePayload> {
    const [gateway, skills] = await Promise.all([
      modelGatewayService.probeGateway(),
      skillSystemService.listWorkspaceSkills().catch(() => []),
    ]);

    const systemHealth = systemHealthService.getSnapshot();
    const degradedProviders = gateway.statuses.filter((status) => status.status !== 'healthy').length;
    const blockedSkills = skills.filter((skill) => !skill.eligible).length;
    const activeRuntimeOrders = workOrderService
      .list()
      .filter(
        (workOrder) =>
          workOrder.state === 'QUEUED' ||
          workOrder.state === 'WAITING' ||
          workOrder.state === 'EXECUTING' ||
          workOrder.state === 'SYNTHESIS' ||
          workOrder.state === 'REVIEW',
      );
    const queuedOrRunningEntries = queueService
      .list()
      .filter((entry) => entry.status === 'QUEUED' || entry.status === 'RUNNING');

    const activeAgentIds = new Set<string>();
    activeRuntimeOrders.forEach((order) => {
      activeAgentIds.add(order.targetEmployeeId);
    });

    queuedOrRunningEntries.forEach((entry) => {
      const order = workOrderService.get(entry.workOrderId);
      if (order) {
        activeAgentIds.add(order.targetEmployeeId);
      }
    });

    const activeAgents = Array.from(activeAgentIds)
      .map((agentId) => {
        const agent = agentRegistryService.getAgent(agentId);
        return agent ? `${agent.name} (${agent.role.toUpperCase()})` : agentId;
      })
      .sort((a, b) => a.localeCompare(b));

    const crisisModeActive =
      degradedProviders > 1 ||
      systemHealth.memoryUsagePercent >= 90 ||
      systemHealth.cpuUsagePercent >= 95;

    const memoryStatus: SystemMetric['status'] =
      systemHealth.memoryUsagePercent >= 90
        ? 'critical'
        : systemHealth.memoryUsagePercent >= 80
          ? 'warning'
          : 'ok';

    const cpuStatus: SystemMetric['status'] =
      systemHealth.cpuUsagePercent >= 95
        ? 'critical'
        : systemHealth.cpuUsagePercent >= 80
          ? 'warning'
          : 'ok';

    return {
      crisisModeActive,
      activeAgents,
      metrics: [
        {
          id: 'SYS-1',
          label: 'CPU Utilization',
          value: `${systemHealth.cpuUsagePercent}%`,
          status: cpuStatus,
          threshold: '< 80%',
        },
        {
          id: 'SYS-2',
          label: 'System Memory Usage',
          value: `${systemHealth.memoryUsagePercent}%`,
          status: memoryStatus,
          threshold: '< 80%',
        },
        { id: 'SYS-3', label: 'Model Providers Healthy', value: `${gateway.statuses.length - degradedProviders}/${gateway.statuses.length}`, status: degradedProviders > 1 ? 'critical' : degradedProviders > 0 ? 'warning' : 'ok', threshold: 'all healthy' },
        { id: 'SYS-4', label: 'Blocked Skills', value: `${blockedSkills}`, status: blockedSkills > 0 ? 'warning' : 'ok', threshold: '0' },
        {
          id: 'SYS-5',
          label: 'Process RSS Memory',
          value: `${systemHealth.processRssMb}MB / ${systemHealth.totalMemoryMb}MB`,
          status: systemHealth.processRssMb > systemHealth.totalMemoryMb * 0.25 ? 'warning' : 'ok',
          threshold: '< 25% system memory',
        },
      ],
    };
  },

  async getOnboardingKpiPayload(): Promise<OnboardingKpiPayload> {
    const state = await readOperationsState();
    const generatedAt = state.onboardingGeneratedAt ?? new Date().toISOString();

    const registry = agentRegistryService.listAgents().map((agent) => {
      const existing = state.onboardingKpis.find((record) => record.agentId === agent.agentId);
      return {
        agentId: agent.agentId,
        agent: agent.name,
        role: agent.role,
        kpis: existing ? existing.kpis : [],
      };
    });

    const statuses: OnboardingAgentStatus[] = registry.map((record) => ({
      id: record.agentId,
      name: record.agent,
      role: record.role,
      status: record.kpis.length > 0 ? 'DONE' : 'QUEUED',
      kpiCount: record.kpis.length,
    }));

    return {
      generatedAt,
      statuses,
      registry,
    };
  },

  async getOnboardingCommitStatus(): Promise<boolean> {
    const state = await readOperationsState();
    return Boolean(state.onboardingCommittedAt);
  },

  async getOnboardingStageSnapshot(): Promise<OnboardingStageSnapshotPayload> {
    return onboardingStageStoreService.getSnapshot();
  },

  async saveOnboardingStageSnapshot(payload: SaveOnboardingStagePayload): Promise<boolean> {
    await onboardingStageStoreService.saveSnapshot(payload);
    return true;
  },

  async generateOnboardingKpis(): Promise<OnboardingKpiPayload> {
    const state = await readOperationsState();
    state.onboardingKpis = synthesizeOnboardingRegistry();
    state.onboardingGeneratedAt = new Date().toISOString();
    await writeOperationsState(state);
    return this.getOnboardingKpiPayload();
  },

  async removeOnboardingKpi(agentId: string, kpiId: string): Promise<OnboardingKpiPayload> {
    const state = await readOperationsState();
    const record = state.onboardingKpis.find((entry) => entry.agentId === agentId);

    if (!record) {
      return this.getOnboardingKpiPayload();
    }

    record.kpis = record.kpis.filter((kpi) => kpi.id !== kpiId);
    await writeOperationsState(state);
    return this.getOnboardingKpiPayload();
  },

  async commitOnboarding(payload: OnboardingCommitPayload): Promise<OnboardingCommitResult> {
    const validation = await validateOnboardingCommitPayload(payload);
    if (!validation.isValid) {
      return {
        success: false,
        committedAt: new Date().toISOString(),
        ingestedVaultRecords: 0,
        validationErrors: validation.errors,
        alignmentIssues: validation.alignmentIssues,
      };
    }

    const state = await readOperationsState();
    const committedAt = new Date().toISOString();

    const normalizedKpiEntries = validation.normalizedKpis.map((kpi, index) => ({
      id: `KPI-DRAFT-${index + 1}`,
      name: kpi.name,
      unit: 'value',
      target: kpi.target,
      threshold: 'review-required',
    }));

    state.onboardingKpis = [
      {
        agentId: 'director-input',
        agent: 'Director Input',
        role: 'Custom KPI Draft',
        kpis: normalizedKpiEntries,
      },
    ];
    state.onboardingGeneratedAt = committedAt;
    state.onboardingCommittedAt = committedAt;
    await writeOperationsState(state);

    const stageSnapshot = await onboardingStageStoreService.getSnapshot();
    await registryRuntimeStoreService.saveApprovedRuntime({
      committedAt,
      contextByStep: payload.contextByStep,
      approvalByStep: payload.approvalByStep,
      agentMappings: payload.agentMappings,
      modelAccess: stageSnapshot.modelAccess,
    });

    await persistOnboardingVaultStructure(committedAt, payload, validation.normalizedKpis);

    const tempDir = join(getAppDataRoot(), 'tmp');
    await mkdir(tempDir, { recursive: true });
    const tempPath = join(tempDir, `onboarding-kpis-${Date.now()}.json`);

    const vaultPayload = {
      committedAt,
      kpiData: payload.kpiData,
      contextByStep: payload.contextByStep,
      approvalByStep: payload.approvalByStep,
      agentMappings: payload.agentMappings,
      note: 'Model access configuration is intentionally excluded for volatile-only handling.',
    };

    await writeFile(tempPath, JSON.stringify(vaultPayload, null, 2), 'utf8');
    const ingested = await vaultService.ingestPaths([tempPath]);
    await rm(tempPath, { force: true });
    await vaultService.createTempSnapshot(`onboarding-final-${Date.now()}`);
    await syncProviderService.stageApprovedRegistryForSync('onboarding-commit-approved');
    void syncProviderService.triggerBackgroundPush();
    await onboardingStageStoreService.clearSnapshot();

    return {
      success: true,
      committedAt,
      ingestedVaultRecords: ingested.length,
      alignmentIssues: validation.alignmentIssues,
    };
  },

  async getEmployeeProfilePayload(employeeId: string): Promise<EmployeeProfilePayload> {
    const allAgents = agentRegistryService.listAgents();
    const selectedAgent = agentRegistryService.getAgent(employeeId) ?? agentRegistryService.getAgent('mira');

    if (!selectedAgent) {
      throw new Error('No registered agents available for profile payload');
    }

    const selectedOrders = workOrderService.list().filter((order) => order.targetEmployeeId === selectedAgent.agentId);

    const receivesFrom = allAgents
      .filter((candidate) => candidate.agentId !== selectedAgent.agentId && candidate.canDelegate(selectedAgent.agentId))
      .map((candidate) => candidate.agentId);

    const canRequestFrom = allAgents
      .filter((candidate) => candidate.agentId !== selectedAgent.agentId && selectedAgent.canDelegate(candidate.agentId))
      .map((candidate) => candidate.agentId);

    const registryTemplate = coreRegistryService.getAgentTemplate(selectedAgent.agentId);

    return {
      id: selectedAgent.agentId,
      name: selectedAgent.name,
      role: toRoleLabel(selectedAgent.role),
      triggerName: `@${selectedAgent.agentId}`,
      triggerDesignation: roleToDesignation(selectedAgent.role),
      backstory:
        registryTemplate?.backstory ??
        `${selectedAgent.name} is the ${toRoleLabel(selectedAgent.role).toLowerCase()} and executes deterministic role-scoped decisions for Director requests.`,
      workflow: [
        ...(registryTemplate?.goal
          ? [`Goal: ${registryTemplate.goal}`]
          : []),
        ...buildRuntimeWorkflow(selectedAgent.name),
      ],
      tools: selectedAgent.tools.map((tool) => ({
        name: tool.name,
        type: tool.type,
        description: tool.description,
      })),
      kpis: buildRuntimeKpis(selectedOrders),
      canRequestFrom,
      receivesFrom,
    };
  },

  async getLifecycleSnapshot(): Promise<LifecycleSnapshotPayload> {
    const persistedTemplate = await readLifecycleTemplate();
    const persistedByAgent = new Map(
      (persistedTemplate.employees ?? []).map((entry) => [entry.id, entry]),
    );
    const persistedSkills = persistedTemplate.global_skills ?? {};
    const persistedKpis = persistedTemplate.kpi_overrides ?? {};
    const persistedDataInputs = persistedTemplate.data_input_overrides ?? {};

    const agents = agentRegistryService.listAgents();
    const profiles = await Promise.all(
      agents.map(async (agent) => {
        const registryTemplate = coreRegistryService.getAgentTemplate(agent.agentId);
        const persisted = persistedByAgent.get(agent.agentId);
        const agentOrders = workOrderService.list().filter((order) => order.targetEmployeeId === agent.agentId);

        return {
          agentId: agent.agentId,
          name: agent.name,
          role: toRoleLabel(agent.role),
          goal: persisted?.in_depth_goal ?? registryTemplate?.goal ?? '',
          backstory: persisted?.in_depth_backstory ?? registryTemplate?.backstory ?? '',
          skills: persisted?.core_skills ? splitDelimitedList(persisted.core_skills) : registryTemplate?.skills ?? [],
          kpis: persisted?.required_kpis ? splitDelimitedList(persisted.required_kpis) : registryTemplate?.kpis ?? [],
          kpiStatus: buildRuntimeKpis(agentOrders),
        };
      }),
    );

    const globalSkills = coreRegistryService.listSkills().map((skill) => ({
      id: skill.id,
      title: skill.title,
      tags: skill.tags,
      markdown: persistedSkills[skill.id]?.markdown ?? skill.content,
    }));

    const kpis = coreRegistryService.listKpis().map((kpi) => ({
      id: kpi.uid,
      name: kpi.name,
      description: kpi.description,
      unit: kpi.unit,
      target: persistedKpis[kpi.uid]?.target ?? kpi.target,
      value: persistedKpis[kpi.uid]?.value ?? kpi.value,
      linkedAgents: profiles
        .filter((profile) => profile.kpis.includes(kpi.uid))
        .map((profile) => profile.agentId),
    }));

    const dataInputs = coreRegistryService.listDataInputs().map((input) => {
      const override = persistedDataInputs[input.uid];
      const normalizedRequiredFields = input.requiredFields
        .map((field) => {
          if (typeof field === 'string') {
            return field.trim();
          }

          return field.name.trim();
        })
        .filter((field) => field.length > 0);

      return {
        id: input.uid,
        name: input.name,
        description: input.description,
        schemaType: input.schemaType,
        requiredFields: normalizedRequiredFields,
        sampleSource: input.sampleSource,
        uploadedFileName: override?.fileName,
        uploadedContent: override?.content,
        uploadedPreview: override?.content.slice(0, 400),
        updatedAt: override?.updatedAt,
      };
    });

    const state = await readOperationsState();
    return {
      profiles,
      globalSkills,
      kpis,
      dataInputs,
      committedAt: state.onboardingCommittedAt,
    };
  },

  async updateLifecycleProfile(payload: LifecycleProfileUpdatePayload): Promise<LifecycleUpdateResult> {
    const errors: string[] = [];
    const trimmedGoal = payload.goal.trim();
    const trimmedBackstory = payload.backstory.trim();
    const skills = payload.skills.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    const kpis = payload.kpis.map((entry) => entry.trim()).filter((entry) => entry.length > 0);

    if (trimmedGoal.length < 20) {
      errors.push('Goal must be at least 20 characters.');
    }
    if (trimmedBackstory.length < 40) {
      errors.push('Backstory must be at least 40 characters.');
    }
    if (skills.length < 1) {
      errors.push('At least one skill is required.');
    }
    if (kpis.length < 1) {
      errors.push('At least one KPI is required.');
    }

    if (errors.length > 0) {
      return {
        success: false,
        updatedAt: new Date().toISOString(),
        validationErrors: errors,
      };
    }

    const staged = await governanceLifecycleQueueStoreService.stageLifecycleDraft({
      entityType: 'profile',
      entityId: payload.agentId,
      proposed: {
        goal: trimmedGoal,
        backstory: trimmedBackstory,
        skills,
        kpis,
      },
    });

    return {
      success: true,
      updatedAt: staged.updatedAt,
      reviewRequired: true,
      referenceId: staged.draftId,
    };
  },

  async updateLifecycleSkill(payload: LifecycleSkillUpdatePayload): Promise<LifecycleUpdateResult> {
    const skillId = payload.skillId.trim();
    const markdown = payload.markdown.trim();
    const errors: string[] = [];

    if (!skillId) {
      errors.push('Skill id is required.');
    }
    if (!markdown) {
      errors.push('Skill markdown content cannot be empty.');
    }

    if (errors.length > 0) {
      return {
        success: false,
        updatedAt: new Date().toISOString(),
        validationErrors: errors,
      };
    }

    const staged = await governanceLifecycleQueueStoreService.stageLifecycleDraft({
      entityType: 'skill',
      entityId: skillId,
      proposed: {
        markdown,
      },
    });

    return {
      success: true,
      updatedAt: staged.updatedAt,
      reviewRequired: true,
      referenceId: staged.draftId,
    };
  },

  async updateLifecycleKpi(payload: LifecycleKpiUpdatePayload): Promise<LifecycleUpdateResult> {
    const kpiId = payload.kpiId.trim();
    const target = payload.target.trim();
    const value = payload.value?.trim();
    const errors: string[] = [];

    if (!kpiId) {
      errors.push('KPI id is required.');
    }
    if (!target) {
      errors.push('KPI target is required.');
    }

    if (errors.length > 0) {
      return {
        success: false,
        updatedAt: new Date().toISOString(),
        validationErrors: errors,
      };
    }

    const staged = await governanceLifecycleQueueStoreService.stageLifecycleDraft({
      entityType: 'kpi',
      entityId: kpiId,
      proposed: {
        target,
        value,
      },
    });

    return {
      success: true,
      updatedAt: staged.updatedAt,
      reviewRequired: true,
      referenceId: staged.draftId,
    };
  },

  async updateLifecycleDataInput(payload: LifecycleDataInputUpdatePayload): Promise<LifecycleUpdateResult> {
    const dataInputId = payload.dataInputId.trim();
    const fileName = payload.fileName.trim();
    const content = payload.content;
    const errors: string[] = [];

    if (!dataInputId) {
      errors.push('Data input id is required.');
    }
    if (!fileName) {
      errors.push('Uploaded file name is required.');
    }
    if (!content.trim()) {
      errors.push('Uploaded content cannot be empty.');
    }

    if (errors.length > 0) {
      return {
        success: false,
        updatedAt: new Date().toISOString(),
        validationErrors: errors,
      };
    }

    const staged = await governanceLifecycleQueueStoreService.stageLifecycleDraft({
      entityType: 'data-input',
      entityId: dataInputId,
      proposed: {
        fileName,
        content,
      },
    });

    return {
      success: true,
      updatedAt: staged.updatedAt,
      reviewRequired: true,
      referenceId: staged.draftId,
    };
  },

  async createLifecycleDataInput(payload: LifecycleCreateDataInputPayload): Promise<LifecycleUpdateResult> {
    const dataInputId = normalizeRegistryId(payload.dataInputId);
    const name = payload.name.trim();
    const description = payload.description.trim();
    const schemaType = payload.schemaType.trim();
    const requiredFields = payload.requiredFields
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const sampleSource = payload.sampleSource.trim();
    const errors: string[] = [];

    if (!dataInputId) {
      errors.push('Data input id is required and must be kebab-case compatible.');
    }
    if (!name) {
      errors.push('Data input name is required.');
    }
    if (description.length < 15) {
      errors.push('Data input description must be at least 15 characters.');
    }
    if (!schemaType) {
      errors.push('Data input schema type is required.');
    }
    if (requiredFields.length < 1) {
      errors.push('At least one required field is needed.');
    }
    if (sampleSource.length < 3) {
      errors.push('Sample source must be at least 3 characters.');
    }

    const existing = coreRegistryService.listDataInputs();
    if (existing.some((entry) => entry.uid === dataInputId)) {
      errors.push(`Data input ${dataInputId} already exists.`);
    }

    if (errors.length > 0) {
      return {
        success: false,
        updatedAt: new Date().toISOString(),
        validationErrors: errors,
      };
    }

    const staged = await governanceLifecycleQueueStoreService.stageLifecycleDraft({
      entityType: 'data-input-create',
      entityId: dataInputId,
      proposed: {
        name,
        description,
        schemaType,
        requiredFields,
        sampleSource,
        fileName: payload.fileName?.trim(),
        content: payload.content,
      },
    });

    return {
      success: true,
      updatedAt: staged.updatedAt,
      reviewRequired: true,
      referenceId: staged.draftId,
    };
  },

  async listLifecycleDrafts(status?: LifecycleDraftStatus): Promise<LifecycleDraftRecord[]> {
    return governanceLifecycleQueueStoreService.listLifecycleDrafts(status);
  },

  async reviewLifecycleDraft(payload: ReviewLifecycleDraftPayload): Promise<LifecycleUpdateResult> {
    if (payload.status === 'APPROVED') {
      const allDrafts = await governanceLifecycleQueueStoreService.listLifecycleDrafts('PENDING');
      const target = allDrafts.find((entry) => entry.draftId === payload.draftId);
      if (!target) {
        return {
          success: false,
          updatedAt: new Date().toISOString(),
          validationErrors: ['Draft not found or no longer pending.'],
        };
      }

      const applied = await applyApprovedLifecycleDraft(target);
      if (!applied.success) {
        return {
          success: false,
          updatedAt: new Date().toISOString(),
          validationErrors: applied.errors ?? ['Failed to apply approved draft.'],
        };
      }
    }

    const reviewed = await governanceLifecycleQueueStoreService.reviewLifecycleDraft(payload);
    if (!reviewed) {
      return {
        success: false,
        updatedAt: new Date().toISOString(),
        validationErrors: ['Draft not found.'],
      };
    }

    return {
      success: true,
      updatedAt: reviewed.updatedAt,
      referenceId: reviewed.draftId,
    };
  },

  async createCronProposal(payload: ProposeCronSchedulePayload): Promise<CronProposalRecord> {
    const jobId = payload.id.trim();
    const name = payload.name.trim();
    const expression = payload.expression.trim();

    if (!jobId || !name || !expression) {
      throw new Error('Cron proposal requires id, name, and expression.');
    }

    return governanceLifecycleQueueStoreService.createCronProposal({
      jobId,
      name,
      expression,
      retentionDays: Math.max(7, payload.retentionDays ?? 30),
      maxRuntimeMs: Math.max(1000, payload.maxRuntimeMs ?? 5000),
    });
  },

  async listCronProposals(status?: CronProposalStatus): Promise<CronProposalRecord[]> {
    return governanceLifecycleQueueStoreService.listCronProposals(status);
  },

  async reviewCronProposal(payload: ReviewCronProposalPayload): Promise<LifecycleUpdateResult> {
    if (payload.status === 'APPROVED') {
      const pending = await governanceLifecycleQueueStoreService.listCronProposals('PENDING');
      const target = pending.find((entry) => entry.proposalId === payload.proposalId);
      if (!target) {
        return {
          success: false,
          updatedAt: new Date().toISOString(),
          validationErrors: ['Cron proposal not found or no longer pending.'],
        };
      }

      await cronSchedulerService.upsertJob({
        id: target.jobId,
        name: target.name,
        expression: target.expression,
        enabled: true,
        retentionDays: target.retentionDays,
        maxRuntimeMs: target.maxRuntimeMs,
      });
    }

    const reviewed = await governanceLifecycleQueueStoreService.reviewCronProposal(payload);
    if (!reviewed) {
      return {
        success: false,
        updatedAt: new Date().toISOString(),
        validationErrors: ['Cron proposal not found.'],
      };
    }

    return {
      success: true,
      updatedAt: reviewed.updatedAt,
      referenceId: reviewed.proposalId,
    };
  },

  async getTaskAuditLog(limit?: number): Promise<TaskAuditLogPayload[]> {
    return governanceLifecycleQueueStoreService.getTaskAuditLog(limit ?? 100);
  },
};
