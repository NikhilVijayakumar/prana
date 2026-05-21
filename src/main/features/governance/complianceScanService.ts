import { AuditLogRecord } from './auditLogService';

export interface ComplianceCheckResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warn';
  details: string;
}

export interface ComplianceScanInput {
  blockedSkillNames: string[];
  degradedProviderNames: string[];
  governanceFlaggedCount: number;
  auditLogEntries: AuditLogRecord[];
}

export interface ComplianceScanResult {
  overallStatus: 'secure' | 'warning' | 'critical';
  violationsCount: number;
  adherenceScore: number;
  checks: ComplianceCheckResult[];
}

const isAuditFailure = (entry: AuditLogRecord): boolean => {
  const normalized = entry.result.toUpperCase();
  return normalized !== 'SUCCESS' && normalized !== 'PASS';
};

export const complianceScanService = {
  scan(input: ComplianceScanInput): ComplianceScanResult {
    const flaggedAuditCount = input.auditLogEntries.filter((entry) => isAuditFailure(entry)).length;

    const violationsCount =
      input.blockedSkillNames.length +
      input.degradedProviderNames.length +
      input.governanceFlaggedCount +
      flaggedAuditCount;

    const overallStatus: ComplianceScanResult['overallStatus'] =
      violationsCount === 0 ? 'secure' : violationsCount < 4 ? 'warning' : 'critical';

    const checks: ComplianceCheckResult[] = [
      {
        id: 'CHK-001',
        name: 'Model Gateway Health',
        status: input.degradedProviderNames.length > 0 ? 'warn' : 'pass',
        details:
          input.degradedProviderNames.length > 0
            ? `Degraded providers: ${input.degradedProviderNames.join(', ')}`
            : 'All providers healthy.',
      },
      {
        id: 'CHK-002',
        name: 'Skill Eligibility Policy',
        status: input.blockedSkillNames.length > 0 ? 'warn' : 'pass',
        details:
          input.blockedSkillNames.length > 0
            ? `Blocked skills: ${input.blockedSkillNames.join(', ')}`
            : 'All loaded skills are eligible.',
      },
      {
        id: 'CHK-003',
        name: 'Governance and Audit Trail',
        status: input.governanceFlaggedCount + flaggedAuditCount > 0 ? 'fail' : 'pass',
        details:
          input.governanceFlaggedCount + flaggedAuditCount > 0
            ? `${input.governanceFlaggedCount} governance and ${flaggedAuditCount} audit-log entries require review.`
            : 'No flagged governance or audit-log actions.',
      },
    ];

    const adherenceScore = Math.max(0, 100 - violationsCount * 4);

    return {
      overallStatus,
      violationsCount,
      adherenceScore,
      checks,
    };
  },
};
