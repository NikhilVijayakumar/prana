import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getAppDataRoot, mkdirSafe } from './governanceRepoService';
import { runtimeDocumentStoreService } from './runtimeDocumentStoreService';

const STATE_FILE = 'administration-integration-state.json';
const INTEGRATION_CONFIG_DOC_KEY = 'org/administration/integrations/external-systems.config.json';
const SHEETS_MAPPING_DOC_KEY = 'org/administration/integrations/google-sheets.mapping.json';
const STAFF_REGISTRY_DOC_KEY = 'org/administration/staff/staff-registry.csv';
const FEEDBACK_RESPONSES_DOC_KEY = 'org/administration/feedback/google-forms.responses.json';
const FEEDBACK_EVALUATION_DOC_KEY = 'org/administration/evaluations/feedback-latest.json';
const KPI_SIGNALS_DOC_KEY = 'org/administration/evaluations/kpi-signals.json';
const KPI_HAPPINESS_DOC_KEY = 'org/administration/evaluations/kpi-happiness-evaluation.latest.json';
const ESCALATION_OUTPUT_DOC_KEY = 'org/administration/evaluations/kpi-happiness-escalations.latest.json';
const SOCIAL_TREND_SIGNALS_DOC_KEY = 'org/administration/channels/twitter-trends.signals.json';
const SOCIAL_TREND_POLICY_DOC_KEY = 'org/administration/evaluations/social-trend-policy-impact.latest.json';
const SOCIAL_TREND_ESCALATIONS_DOC_KEY = 'org/administration/evaluations/social-trend-escalations.latest.json';

export interface GoogleSheetStaffRow {
  employee_id: string;
  full_name: string;
  department: string;
  role: string;
  email: string;
  status: string;
  manager: string;
  join_date: string;
  employment_type: string;
  location: string;
  kpi_profile: string;
  sheet_row_ref: string;
}

export interface GoogleFormFeedbackResponse {
  responseId: string;
  submittedAt: string;
  employeeId: string;
  team: string;
  role: string;
  happinessScore: number;
  workloadScore: number;
  goingWell: string;
  needsImprovement: string;
  supportRequested: string;
}

export interface GoogleSheetsGatewayProtocol {
  listStaffRows(): Promise<GoogleSheetStaffRow[]>;
}

export interface GoogleFormsGatewayProtocol {
  listFeedbackResponses(): Promise<GoogleFormFeedbackResponse[]>;
}

export interface AdministrationSyncRunReport {
  status: 'SYNCED' | 'SKIPPED' | 'FAILED';
  source: string;
  records: number;
  message: string;
  ranAt: string;
}

export interface EmployeeKpiSignal {
  employeeId: string;
  kpiScore: number;
  source?: string;
  measuredAt?: string;
}

export interface EmployeeKpiHappinessEvaluation {
  employeeId: string;
  fullName: string;
  department: string;
  role: string;
  kpiScore: number;
  happinessScore: number;
  compositeScore: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  escalationRequired: boolean;
  escalationReasons: string[];
}

export interface EscalationActionItem {
  employeeId: string;
  fullName: string;
  risk: 'HIGH' | 'CRITICAL';
  priority: 'IMPORTANT' | 'URGENT';
  reasons: string[];
  recommendedActions: string[];
}

export interface KpiHappinessEvaluationOutput {
  generatedAt: string;
  summary: {
    staffEvaluated: number;
    escalations: number;
    averageKpiScore: number;
    averageHappinessScore: number;
    averageCompositeScore: number;
  };
  employees: EmployeeKpiHappinessEvaluation[];
  escalations: EscalationActionItem[];
}

export interface SocialTrendSignal {
  id: string;
  capturedAt: string;
  channel: string;
  topic: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  intensity: number;
  relevanceToPolicy: number;
  summary: string;
}

export interface PolicyImpactRecommendation {
  topic: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rationale: string;
  recommendedPolicyArea: string;
  recommendedActions: string[];
  escalationRequired: boolean;
}

export interface SocialTrendIntelligenceOutput {
  generatedAt: string;
  source: string;
  summary: {
    trendCount: number;
    policySignals: number;
    escalations: number;
  };
  recommendations: PolicyImpactRecommendation[];
}

export interface AdministrationIntegrationSnapshot {
  mode: 'template-only' | 'adapter-ready';
  configPaths: {
    integrationConfig: string;
    googleSheetsMapping: string;
    staffRegistry: string;
    feedbackResponses: string;
    feedbackEvaluation: string;
    kpiSignals: string;
    kpiHappinessEvaluation: string;
    escalationOutput: string;
    socialTrendSignals: string;
    socialTrendPolicyImpact: string;
    socialTrendEscalations: string;
  };
  providers: {
    googleSheets: {
      configured: boolean;
      spreadsheetId: string;
      syncMode: string;
      frequency: string;
    };
    googleForms: {
      configured: boolean;
      ingestionEnabled: boolean;
    };
  };
  staffRegistry: {
    rowCount: number;
    headers: string[];
  };
  feedback: {
    responseCount: number;
  };
  lastSync: {
    staffRegistry: AdministrationSyncRunReport | null;
    feedback: AdministrationSyncRunReport | null;
    evaluation: AdministrationSyncRunReport | null;
    trends: AdministrationSyncRunReport | null;
  };
}

interface PersistedAdministrationIntegrationState {
  lastStaffRegistrySync: AdministrationSyncRunReport | null;
  lastFeedbackSync: AdministrationSyncRunReport | null;
  lastEvaluationSync: AdministrationSyncRunReport | null;
  lastTrendSync: AdministrationSyncRunReport | null;
  updatedAt: string;
}

interface IntegrationConfigFile {
  channels?: {
    email?: {
      enabled?: boolean;
    };
    socialTrend?: {
      enabled?: boolean;
    };
  };
}

interface SheetsMappingFile {
  workbook?: {
    spreadsheetId?: string;
  };
  sync?: {
    mode?: string;
    frequency?: string;
  };
}

const getStateFilePath = (): string => {
  return join(getAppDataRoot(), STATE_FILE);
};

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const next = line[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const parseCsv = (raw: string): Array<Record<string, string>> => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const columns = parseCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = columns[index] ?? '';
    });
    return record;
  });
};

const escapeCsvValue = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
};

const toCsv = (headers: string[], rows: Array<Record<string, string>>): string => {
  const headerLine = headers.join(',');
  const body = rows
    .map((row) => headers.map((header) => escapeCsvValue(row[header] ?? '')).join(','))
    .join('\n');

  return body.length > 0 ? `${headerLine}\n${body}\n` : `${headerLine}\n`;
};

const normalizeStaffRow = (row: Record<string, string>): GoogleSheetStaffRow => {
  return {
    employee_id: row.employee_id ?? '',
    full_name: row.full_name ?? '',
    department: row.department ?? '',
    role: row.role ?? '',
    email: row.email ?? '',
    status: row.status ?? '',
    manager: row.manager ?? '',
    join_date: row.join_date ?? '',
    employment_type: row.employment_type ?? '',
    location: row.location ?? '',
    kpi_profile: row.kpi_profile ?? '',
    sheet_row_ref: row.sheet_row_ref ?? '',
  };
};

class FileBackedGoogleSheetsGateway implements GoogleSheetsGatewayProtocol {
  async listStaffRows(): Promise<GoogleSheetStaffRow[]> {
    const raw = await runtimeDocumentStoreService.readText(STAFF_REGISTRY_DOC_KEY);
    if (!raw) {
      return [];
    }
    return parseCsv(raw).map(normalizeStaffRow);
  }
}

class FileBackedGoogleFormsGateway implements GoogleFormsGatewayProtocol {
  async listFeedbackResponses(): Promise<GoogleFormFeedbackResponse[]> {
    const raw = await runtimeDocumentStoreService.readText(FEEDBACK_RESPONSES_DOC_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
        .map((entry, index) => ({
          responseId: typeof entry.responseId === 'string' ? entry.responseId : `response-${index + 1}`,
          submittedAt: typeof entry.submittedAt === 'string' ? entry.submittedAt : new Date().toISOString(),
          employeeId: typeof entry.employeeId === 'string' ? entry.employeeId : '',
          team: typeof entry.team === 'string' ? entry.team : '',
          role: typeof entry.role === 'string' ? entry.role : '',
          happinessScore: typeof entry.happinessScore === 'number' ? entry.happinessScore : 0,
          workloadScore: typeof entry.workloadScore === 'number' ? entry.workloadScore : 0,
          goingWell: typeof entry.goingWell === 'string' ? entry.goingWell : '',
          needsImprovement: typeof entry.needsImprovement === 'string' ? entry.needsImprovement : '',
          supportRequested: typeof entry.supportRequested === 'string' ? entry.supportRequested : '',
        }));
    } catch {
      return [];
    }
  }
}

const readIntegrationState = async (): Promise<PersistedAdministrationIntegrationState> => {
  const path = getStateFilePath();
  if (!existsSync(path)) {
    return {
      lastStaffRegistrySync: null,
      lastFeedbackSync: null,
      lastEvaluationSync: null,
      lastTrendSync: null,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedAdministrationIntegrationState>;
    return {
      lastStaffRegistrySync: parsed.lastStaffRegistrySync ?? null,
      lastFeedbackSync: parsed.lastFeedbackSync ?? null,
      lastEvaluationSync: parsed.lastEvaluationSync ?? null,
      lastTrendSync: parsed.lastTrendSync ?? null,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return {
      lastStaffRegistrySync: null,
      lastFeedbackSync: null,
      lastEvaluationSync: null,
      lastTrendSync: null,
      updatedAt: new Date().toISOString(),
    };
  }
};

const writeIntegrationState = async (state: PersistedAdministrationIntegrationState): Promise<void> => {
  await mkdirSafe(getAppDataRoot());
  await writeFile(getStateFilePath(), JSON.stringify(state, null, 2), 'utf8');
};

const calculateFeedbackSummary = (responses: GoogleFormFeedbackResponse[]) => {
  const total = responses.length;
  const avgHappiness = total > 0
    ? Number((responses.reduce((sum, response) => sum + response.happinessScore, 0) / total).toFixed(2))
    : 0;
  const avgWorkload = total > 0
    ? Number((responses.reduce((sum, response) => sum + response.workloadScore, 0) / total).toFixed(2))
    : 0;

  return {
    totalResponses: total,
    avgHappiness,
    avgWorkload,
    generatedAt: new Date().toISOString(),
    responses,
  };
};

const clampScore = (value: number, min = 0, max = 100): number => {
  if (Number.isNaN(value)) {
    return min;
  }

  if (value < min) return min;
  if (value > max) return max;
  return Number(value.toFixed(2));
};

const normalizeKpiSignals = (raw: unknown): EmployeeKpiSignal[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      employeeId: typeof entry.employeeId === 'string' ? entry.employeeId.trim() : '',
      kpiScore: typeof entry.kpiScore === 'number' ? clampScore(entry.kpiScore) : 0,
      source: typeof entry.source === 'string' ? entry.source : undefined,
      measuredAt: typeof entry.measuredAt === 'string' ? entry.measuredAt : undefined,
    }))
    .filter((entry) => entry.employeeId.length > 0);
};

const normalizeSocialTrendSignals = (raw: unknown): SocialTrendSignal[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry, index) => ({
      id: typeof entry.id === 'string' ? entry.id : `trend-${index + 1}`,
      capturedAt: typeof entry.capturedAt === 'string' ? entry.capturedAt : new Date().toISOString(),
      channel: typeof entry.channel === 'string' ? entry.channel : 'twitter-x',
      topic: typeof entry.topic === 'string' ? entry.topic : 'unknown-topic',
      sentiment: entry.sentiment === 'POSITIVE' || entry.sentiment === 'NEGATIVE' ? entry.sentiment : 'NEUTRAL',
      intensity: typeof entry.intensity === 'number' ? clampScore(entry.intensity) : 50,
      relevanceToPolicy: typeof entry.relevanceToPolicy === 'number' ? clampScore(entry.relevanceToPolicy) : 50,
      summary: typeof entry.summary === 'string' ? entry.summary : '',
    }));
};

const classifyTrendRisk = (signal: SocialTrendSignal): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
  const weighted = signal.relevanceToPolicy * 0.65 + signal.intensity * 0.35;
  const negativeBias = signal.sentiment === 'NEGATIVE' ? 12 : 0;
  const score = weighted + negativeBias;

  if (score >= 90) return 'CRITICAL';
  if (score >= 75) return 'HIGH';
  if (score >= 55) return 'MEDIUM';
  return 'LOW';
};

const mapPolicyArea = (topic: string): string => {
  const normalized = topic.toLowerCase();
  if (normalized.includes('privacy') || normalized.includes('data')) return 'security-compliance';
  if (normalized.includes('hiring') || normalized.includes('culture') || normalized.includes('burnout')) return 'hr-performance';
  if (normalized.includes('attendance') || normalized.includes('workflow') || normalized.includes('calendar')) return 'operations-controls';
  return 'core-governance';
};

export const buildSocialTrendPolicyIntelligence = (signals: SocialTrendSignal[]): SocialTrendIntelligenceOutput => {
  const recommendations: PolicyImpactRecommendation[] = signals
    .filter((signal) => signal.relevanceToPolicy >= 35)
    .map((signal) => {
      const risk = classifyTrendRisk(signal);
      const policyArea = mapPolicyArea(signal.topic);

      return {
        topic: signal.topic,
        risk,
        rationale: signal.summary || `Trend on ${signal.topic} requires governance observation.`,
        recommendedPolicyArea: policyArea,
        recommendedActions: risk === 'CRITICAL'
          ? [
            'Escalate to Director Office for immediate policy review.',
            'Trigger 24-hour cross-team risk checkpoint.',
          ]
          : risk === 'HIGH'
            ? [
              'Assign policy owner for weekly update proposal.',
              'Track trend trajectory in governance review.',
            ]
            : [
              'Monitor trend in next weekly review.',
              'Capture notes for periodic policy iteration.',
            ],
        escalationRequired: risk === 'HIGH' || risk === 'CRITICAL',
      };
    });

  const escalations = recommendations.filter((recommendation) => recommendation.escalationRequired).length;

  return {
    generatedAt: new Date().toISOString(),
    source: 'social-trend-readonly-ingestion',
    summary: {
      trendCount: signals.length,
      policySignals: recommendations.length,
      escalations,
    },
    recommendations,
  };
};

const byNewestSubmittedAt = (left: GoogleFormFeedbackResponse, right: GoogleFormFeedbackResponse): number => {
  const leftTs = new Date(left.submittedAt).getTime();
  const rightTs = new Date(right.submittedAt).getTime();
  if (leftTs === rightTs) {
    return 0;
  }
  return leftTs > rightTs ? -1 : 1;
};

const scoreRisk = (compositeScore: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
  if (compositeScore < 50) {
    return 'CRITICAL';
  }
  if (compositeScore < 65) {
    return 'HIGH';
  }
  if (compositeScore < 80) {
    return 'MEDIUM';
  }
  return 'LOW';
};

export const buildKpiHappinessEvaluation = (payload: {
  staffRows: GoogleSheetStaffRow[];
  feedbackResponses: GoogleFormFeedbackResponse[];
  kpiSignals: EmployeeKpiSignal[];
}): KpiHappinessEvaluationOutput => {
  const kpiByEmployee = new Map(payload.kpiSignals.map((entry) => [entry.employeeId, entry.kpiScore]));

  const latestFeedbackByEmployee = new Map<string, GoogleFormFeedbackResponse>();
  const sortedResponses = [...payload.feedbackResponses].sort(byNewestSubmittedAt);
  sortedResponses.forEach((response) => {
    if (!latestFeedbackByEmployee.has(response.employeeId)) {
      latestFeedbackByEmployee.set(response.employeeId, response);
    }
  });

  const employees: EmployeeKpiHappinessEvaluation[] = payload.staffRows
    .filter((staff) => staff.employee_id.trim().length > 0)
    .map((staff) => {
      const kpiScore = clampScore(kpiByEmployee.get(staff.employee_id) ?? 70);
      const feedback = latestFeedbackByEmployee.get(staff.employee_id);
      const happinessScore = clampScore((feedback?.happinessScore ?? 7) * 10);

      const compositeScore = clampScore(kpiScore * 0.65 + happinessScore * 0.35);
      const risk = scoreRisk(compositeScore);

      const escalationReasons: string[] = [];
      if (kpiScore < 45) {
        escalationReasons.push('KPI score dropped below critical threshold (45).');
      }
      if (happinessScore < 40) {
        escalationReasons.push('Happiness score dropped below critical threshold (40).');
      }
      if (risk === 'HIGH') {
        escalationReasons.push('Composite score entered HIGH risk band (<65).');
      }
      if (risk === 'CRITICAL') {
        escalationReasons.push('Composite score entered CRITICAL risk band (<50).');
      }

      const escalationRequired = risk === 'HIGH' || risk === 'CRITICAL' || escalationReasons.length > 0;

      return {
        employeeId: staff.employee_id,
        fullName: staff.full_name,
        department: staff.department,
        role: staff.role,
        kpiScore,
        happinessScore,
        compositeScore,
        risk,
        escalationRequired,
        escalationReasons,
      };
    });

  const escalations: EscalationActionItem[] = employees
    .filter((employee) => employee.risk === 'HIGH' || employee.risk === 'CRITICAL' || employee.escalationRequired)
    .map((employee) => ({
      employeeId: employee.employeeId,
      fullName: employee.fullName,
      risk: employee.risk === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      priority: employee.risk === 'CRITICAL' ? 'URGENT' : 'IMPORTANT',
      reasons: employee.escalationReasons,
      recommendedActions: employee.risk === 'CRITICAL'
        ? [
          'Escalate to Director Office and HR within 24 hours.',
          'Create immediate support and performance recovery plan.',
        ]
        : [
          'Schedule manager and HR check-in in the current week.',
          'Track progress against 2-week KPI/happiness targets.',
        ],
    }));

  const sumKpi = employees.reduce((sum, entry) => sum + entry.kpiScore, 0);
  const sumHappiness = employees.reduce((sum, entry) => sum + entry.happinessScore, 0);
  const sumComposite = employees.reduce((sum, entry) => sum + entry.compositeScore, 0);
  const total = employees.length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      staffEvaluated: total,
      escalations: escalations.length,
      averageKpiScore: total > 0 ? Number((sumKpi / total).toFixed(2)) : 0,
      averageHappinessScore: total > 0 ? Number((sumHappiness / total).toFixed(2)) : 0,
      averageCompositeScore: total > 0 ? Number((sumComposite / total).toFixed(2)) : 0,
    },
    employees,
    escalations,
  };
};

export class AdministrationIntegrationService {
  constructor(
    private readonly sheetsGateway: GoogleSheetsGatewayProtocol,
    private readonly formsGateway: GoogleFormsGatewayProtocol,
  ) {}

  async getSnapshot(): Promise<AdministrationIntegrationSnapshot> {
    const [integrationConfig, sheetsMapping, staffRows, feedbackResponses, state] = await Promise.all([
      runtimeDocumentStoreService.readJsonObject<IntegrationConfigFile>(INTEGRATION_CONFIG_DOC_KEY),
      runtimeDocumentStoreService.readJsonObject<SheetsMappingFile>(SHEETS_MAPPING_DOC_KEY),
      this.sheetsGateway.listStaffRows(),
      this.formsGateway.listFeedbackResponses(),
      readIntegrationState(),
    ]);

    const spreadsheetId = sheetsMapping?.workbook?.spreadsheetId ?? '';
    const hasConfiguredSpreadsheet = spreadsheetId.trim().length > 0 && spreadsheetId !== 'REPLACE_WITH_SPREADSHEET_ID';

    return {
      mode: 'adapter-ready',
      configPaths: {
        integrationConfig: INTEGRATION_CONFIG_DOC_KEY,
        googleSheetsMapping: SHEETS_MAPPING_DOC_KEY,
        staffRegistry: STAFF_REGISTRY_DOC_KEY,
        feedbackResponses: FEEDBACK_RESPONSES_DOC_KEY,
        feedbackEvaluation: FEEDBACK_EVALUATION_DOC_KEY,
        kpiSignals: KPI_SIGNALS_DOC_KEY,
        kpiHappinessEvaluation: KPI_HAPPINESS_DOC_KEY,
        escalationOutput: ESCALATION_OUTPUT_DOC_KEY,
        socialTrendSignals: SOCIAL_TREND_SIGNALS_DOC_KEY,
        socialTrendPolicyImpact: SOCIAL_TREND_POLICY_DOC_KEY,
        socialTrendEscalations: SOCIAL_TREND_ESCALATIONS_DOC_KEY,
      },
      providers: {
        googleSheets: {
          configured: hasConfiguredSpreadsheet,
          spreadsheetId,
          syncMode: sheetsMapping?.sync?.mode ?? 'scheduled',
          frequency: sheetsMapping?.sync?.frequency ?? 'daily',
        },
        googleForms: {
          configured: true,
          ingestionEnabled: Boolean(integrationConfig?.channels?.email?.enabled ?? true),
        },
      },
      staffRegistry: {
        rowCount: staffRows.length,
        headers: [
          'employee_id',
          'full_name',
          'department',
          'role',
          'email',
          'status',
          'manager',
          'join_date',
          'employment_type',
          'location',
          'kpi_profile',
          'sheet_row_ref',
        ],
      },
      feedback: {
        responseCount: feedbackResponses.length,
      },
      lastSync: {
        staffRegistry: state.lastStaffRegistrySync,
        feedback: state.lastFeedbackSync,
        evaluation: state.lastEvaluationSync,
        trends: state.lastTrendSync,
      },
    };
  }

  async syncStaffRegistryFromSheets(): Promise<AdministrationSyncRunReport> {
    const now = new Date().toISOString();
    const sheetsMapping = await runtimeDocumentStoreService.readJsonObject<SheetsMappingFile>(SHEETS_MAPPING_DOC_KEY);
    const spreadsheetId = sheetsMapping?.workbook?.spreadsheetId ?? '';

    if (spreadsheetId.trim().length === 0 || spreadsheetId === 'REPLACE_WITH_SPREADSHEET_ID') {
      const report: AdministrationSyncRunReport = {
        status: 'SKIPPED',
        source: 'google-sheets',
        records: 0,
        message: 'Google Sheets mapping is not configured. Set workbook.spreadsheetId first.',
        ranAt: now,
      };

      const state = await readIntegrationState();
      state.lastStaffRegistrySync = report;
      state.updatedAt = now;
      await writeIntegrationState(state);
      return report;
    }

    try {
      const rows = await this.sheetsGateway.listStaffRows();
      const headers = [
        'employee_id',
        'full_name',
        'department',
        'role',
        'email',
        'status',
        'manager',
        'join_date',
        'employment_type',
        'location',
        'kpi_profile',
        'sheet_row_ref',
      ];

      const csvRows = rows.map((row) => ({
        employee_id: row.employee_id,
        full_name: row.full_name,
        department: row.department,
        role: row.role,
        email: row.email,
        status: row.status,
        manager: row.manager,
        join_date: row.join_date,
        employment_type: row.employment_type,
        location: row.location,
        kpi_profile: row.kpi_profile,
        sheet_row_ref: row.sheet_row_ref,
      }));

      await runtimeDocumentStoreService.writeText(STAFF_REGISTRY_DOC_KEY, toCsv(headers, csvRows));
      await runtimeDocumentStoreService.flushPendingToVault('sync: administration staff registry');

      const report: AdministrationSyncRunReport = {
        status: 'SYNCED',
        source: 'google-sheets',
        records: rows.length,
        message: 'Staff registry synchronized from configured sheets gateway.',
        ranAt: now,
      };

      const state = await readIntegrationState();
      state.lastStaffRegistrySync = report;
      state.updatedAt = now;
      await writeIntegrationState(state);
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown synchronization failure.';
      const report: AdministrationSyncRunReport = {
        status: 'FAILED',
        source: 'google-sheets',
        records: 0,
        message,
        ranAt: now,
      };

      const state = await readIntegrationState();
      state.lastStaffRegistrySync = report;
      state.updatedAt = now;
      await writeIntegrationState(state);
      return report;
    }
  }

  async ingestFeedbackFromForms(): Promise<AdministrationSyncRunReport> {
    const now = new Date().toISOString();

    try {
      const responses = await this.formsGateway.listFeedbackResponses();
      const summary = calculateFeedbackSummary(responses);
      await runtimeDocumentStoreService.writeJson(FEEDBACK_EVALUATION_DOC_KEY, summary);
      await runtimeDocumentStoreService.flushPendingToVault('sync: administration feedback evaluation');

      const report: AdministrationSyncRunReport = {
        status: 'SYNCED',
        source: 'google-forms',
        records: responses.length,
        message: 'Feedback responses ingested and summarized for administration evaluation.',
        ranAt: now,
      };

      const state = await readIntegrationState();
      state.lastFeedbackSync = report;
      state.updatedAt = now;
      await writeIntegrationState(state);
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown forms ingestion failure.';
      const report: AdministrationSyncRunReport = {
        status: 'FAILED',
        source: 'google-forms',
        records: 0,
        message,
        ranAt: now,
      };

      const state = await readIntegrationState();
      state.lastFeedbackSync = report;
      state.updatedAt = now;
      await writeIntegrationState(state);
      return report;
    }
  }

  async runKpiHappinessEvaluator(): Promise<KpiHappinessEvaluationOutput> {
    const [staffRows, feedbackResponses, kpiSignalRaw] = await Promise.all([
      this.sheetsGateway.listStaffRows(),
      this.formsGateway.listFeedbackResponses(),
      runtimeDocumentStoreService.readJsonObject<{ signals?: unknown }>(KPI_SIGNALS_DOC_KEY),
    ]);

    const kpiSignals = normalizeKpiSignals(kpiSignalRaw?.signals ?? []);
    const output = buildKpiHappinessEvaluation({
      staffRows,
      feedbackResponses,
      kpiSignals,
    });

    await runtimeDocumentStoreService.writeJson(KPI_HAPPINESS_DOC_KEY, output);
    await runtimeDocumentStoreService.writeJson(ESCALATION_OUTPUT_DOC_KEY, {
      generatedAt: output.generatedAt,
      summary: output.summary,
      escalations: output.escalations,
    });
    await runtimeDocumentStoreService.flushPendingToVault('sync: administration kpi happiness');

    const state = await readIntegrationState();
    state.lastEvaluationSync = {
      status: 'SYNCED',
      source: 'kpi-happiness-evaluator',
      records: output.summary.staffEvaluated,
      message: `Evaluator completed with ${output.summary.escalations} escalation(s).`,
      ranAt: output.generatedAt,
    };
    state.updatedAt = output.generatedAt;
    await writeIntegrationState(state);

    return output;
  }

  async runSocialTrendIntelligence(): Promise<SocialTrendIntelligenceOutput> {
    const integrationConfig = await runtimeDocumentStoreService.readJsonObject<IntegrationConfigFile>(INTEGRATION_CONFIG_DOC_KEY);
    const socialEnabled = Boolean(integrationConfig?.channels?.socialTrend?.enabled ?? true);

    if (!socialEnabled) {
      return {
        generatedAt: new Date().toISOString(),
        source: 'social-trend-readonly-ingestion',
        summary: {
          trendCount: 0,
          policySignals: 0,
          escalations: 0,
        },
        recommendations: [],
      };
    }

    const trendRaw = await runtimeDocumentStoreService.readJsonObject<{ signals?: unknown }>(SOCIAL_TREND_SIGNALS_DOC_KEY);
    const signals = normalizeSocialTrendSignals(trendRaw?.signals ?? []);
    const output = buildSocialTrendPolicyIntelligence(signals);

    await runtimeDocumentStoreService.writeJson(SOCIAL_TREND_POLICY_DOC_KEY, output);
    await runtimeDocumentStoreService.writeJson(SOCIAL_TREND_ESCALATIONS_DOC_KEY, {
      generatedAt: output.generatedAt,
      escalations: output.recommendations.filter((item) => item.escalationRequired),
      summary: output.summary,
    });
    await runtimeDocumentStoreService.flushPendingToVault('sync: administration social trend intelligence');

    const state = await readIntegrationState();
    state.lastTrendSync = {
      status: 'SYNCED',
      source: 'social-trend-intelligence',
      records: output.summary.policySignals,
      message: `Social trend intelligence completed with ${output.summary.escalations} escalation(s).`,
      ranAt: output.generatedAt,
    };
    state.updatedAt = output.generatedAt;
    await writeIntegrationState(state);

    return output;
  }
}

export const administrationIntegrationService = new AdministrationIntegrationService(
  new FileBackedGoogleSheetsGateway(),
  new FileBackedGoogleFormsGateway(),
);
