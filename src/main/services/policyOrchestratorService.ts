import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getGovernanceRepoPath } from './governanceRepoService';

const DHI_VAULT_ROOT = 'dhi-vault';

export interface PolicyMetadata {
  id: string;
  title: string;
  area: string;
  owner: string;
  status: 'draft' | 'active' | 'under-review' | 'deprecated';
  reviewCadence: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  lastReviewedAt: string | null;
  applicableTo: string[];
  vaultPath: string;
  maxTokens: number;
}

export interface PolicyIndex {
  generatedAt: string;
  policies: PolicyMetadata[];
}

export interface StaffComplianceRecord {
  employeeId: string;
  fullName: string;
  department: string;
  role: string;
  applicablePolicies: string[];
  compliantPolicies: string[];
  violatedPolicies: PolicyViolation[];
  complianceScore: number;
  overallStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';
}

export interface PolicyViolation {
  policyId: string;
  policyTitle: string;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface StaffComplianceEvaluationOutput {
  generatedAt: string;
  summary: {
    staffEvaluated: number;
    fullyCompliant: number;
    partiallyCompliant: number;
    nonCompliant: number;
    averageComplianceScore: number;
    totalViolations: number;
  };
  records: StaffComplianceRecord[];
}

export interface PolicyImprovementSuggestion {
  policyId: string;
  policyTitle: string;
  area: string;
  reason: string;
  suggestedAction: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  source: 'compliance-gap' | 'sentiment-signal' | 'review-overdue';
}

export interface PolicyImprovementOutput {
  generatedAt: string;
  summary: {
    totalSuggestions: number;
    highPriority: number;
  };
  suggestions: PolicyImprovementSuggestion[];
}

export interface MinimalStaffRow {
  employee_id: string;
  full_name: string;
  department: string;
  role: string;
  status: string;
}

export interface SentimentTeamSummary {
  team: string;
  averageSentiment: number;
  topConcerns: string[];
}

const getVaultRootPath = (): string => {
  return join(getGovernanceRepoPath(), DHI_VAULT_ROOT);
};

const getPolicyIndexPath = (): string => {
  return join(getVaultRootPath(), 'org', 'administration', 'policies', 'policy-index.json');
};

const REVIEW_CADENCE_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  annually: 365,
};

const isReviewOverdue = (policy: PolicyMetadata, now: Date): boolean => {
  if (!policy.lastReviewedAt) {
    return true;
  }

  const lastReview = new Date(policy.lastReviewedAt);
  if (Number.isNaN(lastReview.getTime())) {
    return true;
  }

  const cadenceDays = REVIEW_CADENCE_DAYS[policy.reviewCadence] ?? 30;
  const daysSinceReview = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceReview > cadenceDays;
};

const isPolicyApplicable = (policy: PolicyMetadata, department: string, role: string): boolean => {
  if (policy.applicableTo.includes('*')) {
    return true;
  }

  const normalizedDepartment = department.toLowerCase().trim();
  const normalizedRole = role.toLowerCase().trim();

  return policy.applicableTo.some((scope) => {
    const normalized = scope.toLowerCase().trim();
    return normalized === normalizedDepartment || normalized === normalizedRole;
  });
};

const classifyViolationSeverity = (policy: PolicyMetadata): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
  if (policy.area === 'security-compliance') {
    return 'CRITICAL';
  }
  if (policy.area === 'core-governance') {
    return 'HIGH';
  }
  if (policy.area === 'hr-performance') {
    return 'MEDIUM';
  }
  return 'LOW';
};

const clampScore = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Number(value.toFixed(2));
};

export const evaluateStaffCompliance = (
  staffRows: MinimalStaffRow[],
  policies: PolicyMetadata[],
): StaffComplianceEvaluationOutput => {
  const activePolicies = policies.filter((policy) => policy.status === 'active');

  const records: StaffComplianceRecord[] = staffRows
    .filter((staff) => staff.employee_id.trim().length > 0 && staff.status.toLowerCase() === 'active')
    .map((staff) => {
      const applicable = activePolicies.filter((policy) =>
        isPolicyApplicable(policy, staff.department, staff.role),
      );

      const applicableIds = applicable.map((policy) => policy.id);

      const violations: PolicyViolation[] = [];
      const compliant: string[] = [];

      for (const policy of applicable) {
        const overdue = isReviewOverdue(policy, new Date());
        const deprecated = policy.status === 'deprecated';

        if (overdue || deprecated) {
          violations.push({
            policyId: policy.id,
            policyTitle: policy.title,
            reason: overdue
              ? `Policy review is overdue (cadence: ${policy.reviewCadence}).`
              : 'Policy is deprecated and requires replacement.',
            severity: classifyViolationSeverity(policy),
          });
        } else {
          compliant.push(policy.id);
        }
      }

      const complianceScore = applicable.length > 0
        ? clampScore((compliant.length / applicable.length) * 100)
        : 100;

      let overallStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';
      if (violations.length === 0) {
        overallStatus = 'COMPLIANT';
      } else if (compliant.length > 0) {
        overallStatus = 'PARTIAL';
      } else {
        overallStatus = 'NON_COMPLIANT';
      }

      return {
        employeeId: staff.employee_id,
        fullName: staff.full_name,
        department: staff.department,
        role: staff.role,
        applicablePolicies: applicableIds,
        compliantPolicies: compliant,
        violatedPolicies: violations,
        complianceScore,
        overallStatus,
      };
    });

  const fullyCompliant = records.filter((record) => record.overallStatus === 'COMPLIANT').length;
  const partiallyCompliant = records.filter((record) => record.overallStatus === 'PARTIAL').length;
  const nonCompliant = records.filter((record) => record.overallStatus === 'NON_COMPLIANT').length;
  const totalViolations = records.reduce((sum, record) => sum + record.violatedPolicies.length, 0);
  const totalScore = records.reduce((sum, record) => sum + record.complianceScore, 0);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      staffEvaluated: records.length,
      fullyCompliant,
      partiallyCompliant,
      nonCompliant,
      averageComplianceScore: records.length > 0 ? clampScore(totalScore / records.length) : 100,
      totalViolations,
    },
    records,
  };
};

export const suggestPolicyImprovements = (
  policies: PolicyMetadata[],
  complianceOutput: StaffComplianceEvaluationOutput,
  teamSentiments?: SentimentTeamSummary[],
): PolicyImprovementOutput => {
  const suggestions: PolicyImprovementSuggestion[] = [];
  const now = new Date();

  for (const policy of policies) {
    if (isReviewOverdue(policy, now) && policy.status === 'active') {
      suggestions.push({
        policyId: policy.id,
        policyTitle: policy.title,
        area: policy.area,
        reason: `Policy review is overdue. Cadence: ${policy.reviewCadence}.`,
        suggestedAction: 'Schedule immediate policy review with the designated owner.',
        priority: policy.area === 'security-compliance' ? 'HIGH' : 'MEDIUM',
        source: 'review-overdue',
      });
    }
  }

  const violationsByPolicy = new Map<string, number>();
  for (const record of complianceOutput.records) {
    for (const violation of record.violatedPolicies) {
      violationsByPolicy.set(violation.policyId, (violationsByPolicy.get(violation.policyId) ?? 0) + 1);
    }
  }

  for (const [policyId, count] of violationsByPolicy.entries()) {
    if (count >= 2) {
      const policy = policies.find((p) => p.id === policyId);
      if (!policy) continue;

      suggestions.push({
        policyId,
        policyTitle: policy.title,
        area: policy.area,
        reason: `${count} staff members have compliance gaps against this policy.`,
        suggestedAction: 'Review policy scope and consider targeted training or policy simplification.',
        priority: count >= 5 ? 'HIGH' : 'MEDIUM',
        source: 'compliance-gap',
      });
    }
  }

  if (teamSentiments) {
    for (const team of teamSentiments) {
      if (team.averageSentiment < 40) {
        const relatedPolicies = policies.filter((policy) =>
          policy.applicableTo.includes('*') ||
          policy.applicableTo.some((scope) => scope.toLowerCase() === team.team.toLowerCase()),
        );

        for (const policy of relatedPolicies) {
          if (policy.area === 'hr-performance' || policy.area === 'operations-controls') {
            const concerns = team.topConcerns.length > 0
              ? ` Top concerns: ${team.topConcerns.slice(0, 3).join(', ')}.`
              : '';

            suggestions.push({
              policyId: policy.id,
              policyTitle: policy.title,
              area: policy.area,
              reason: `Team "${team.team}" has low sentiment (${team.averageSentiment}).${concerns}`,
              suggestedAction: 'Initiate policy review cycle incorporating employee feedback signals.',
              priority: team.averageSentiment < 25 ? 'HIGH' : 'MEDIUM',
              source: 'sentiment-signal',
            });
          }
        }
      }
    }
  }

  const highPriority = suggestions.filter((s) => s.priority === 'HIGH').length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSuggestions: suggestions.length,
      highPriority,
    },
    suggestions,
  };
};

export class PolicyOrchestratorService {
  async listPolicies(): Promise<PolicyMetadata[]> {
    const indexPath = getPolicyIndexPath();
    if (!existsSync(indexPath)) {
      return [];
    }

    try {
      const raw = await readFile(indexPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return [];
      }

      const index = parsed as Record<string, unknown>;
      if (!Array.isArray(index.policies)) {
        return [];
      }

      return index.policies
        .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
        .map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id : '',
          title: typeof entry.title === 'string' ? entry.title : '',
          area: typeof entry.area === 'string' ? entry.area : 'core-governance',
          owner: typeof entry.owner === 'string' ? entry.owner : 'director',
          status: (['draft', 'active', 'under-review', 'deprecated'] as const).includes(
            entry.status as 'draft' | 'active' | 'under-review' | 'deprecated',
          )
            ? (entry.status as 'draft' | 'active' | 'under-review' | 'deprecated')
            : 'draft',
          reviewCadence: (['weekly', 'monthly', 'quarterly', 'annually'] as const).includes(
            entry.reviewCadence as 'weekly' | 'monthly' | 'quarterly' | 'annually',
          )
            ? (entry.reviewCadence as 'weekly' | 'monthly' | 'quarterly' | 'annually')
            : 'monthly',
          lastReviewedAt: typeof entry.lastReviewedAt === 'string' ? entry.lastReviewedAt : null,
          applicableTo: Array.isArray(entry.applicableTo)
            ? entry.applicableTo.filter((item): item is string => typeof item === 'string')
            : ['*'],
          vaultPath: typeof entry.vaultPath === 'string' ? entry.vaultPath : '',
          maxTokens: typeof entry.maxTokens === 'number' ? entry.maxTokens : 16000,
        }))
        .filter((entry) => entry.id.length > 0);
    } catch {
      return [];
    }
  }

  evaluateStaffCompliance(
    staffRows: MinimalStaffRow[],
    policies: PolicyMetadata[],
  ): StaffComplianceEvaluationOutput {
    return evaluateStaffCompliance(staffRows, policies);
  }

  suggestPolicyImprovements(
    policies: PolicyMetadata[],
    complianceOutput: StaffComplianceEvaluationOutput,
    teamSentiments?: SentimentTeamSummary[],
  ): PolicyImprovementOutput {
    return suggestPolicyImprovements(policies, complianceOutput, teamSentiments);
  }
}

export const policyOrchestratorService = new PolicyOrchestratorService();
