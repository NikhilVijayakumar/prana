import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getAppDataRoot } from './governanceRepoService';

export interface FundingLead {
  id: string;
  name: string;
  firm: string;
  stage: 'Contacted' | 'Pitch Scheduled' | 'Due Diligence' | 'Term Sheet';
  confidence: number;
}

export interface FinancialMetric {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
}

export interface FundingDigestPayload {
  runwayMonths: number;
  burnRate: string;
  cashInBank: string;
  metrics: FinancialMetric[];
  leads: FundingLead[];
}

export interface FundingDigestSignalInput {
  blockedDecisions: number;
  unresolvedTriage: number;
  vaultFileCount: number;
}

interface FundingReportFile {
  cashInBank?: number;
  monthlyBurn?: number;
  leads?: Array<{
    id?: string;
    name?: string;
    firm?: string;
    stage?: string;
    confidence?: number;
  }>;
}

const FUNDING_REPORT_PATH = ['processed', 'maya', 'opportunity_report.json'];

const formatCurrency = (value: number): string => {
  return `$${Math.max(0, Math.round(value)).toLocaleString()}`;
};

const clampConfidence = (value: number): number => {
  return Math.min(100, Math.max(0, Math.round(value)));
};

const normalizeStage = (stage: string): FundingLead['stage'] => {
  if (stage === 'Pitch Scheduled' || stage === 'Due Diligence' || stage === 'Term Sheet') {
    return stage;
  }

  return 'Contacted';
};

export const buildFundingPayloadFromSignals = (
  signal: FundingDigestSignalInput,
  report?: FundingReportFile,
): FundingDigestPayload => {
  const computedCashInBank = Math.max(100_000, 300_000 + signal.vaultFileCount * 3_500 - signal.blockedDecisions * 2_500);
  const computedMonthlyBurn = Math.max(10_000, 20_000 + signal.unresolvedTriage * 1_500 + signal.blockedDecisions * 750);

  const cashInBank = typeof report?.cashInBank === 'number' ? report.cashInBank : computedCashInBank;
  const monthlyBurn = typeof report?.monthlyBurn === 'number' ? report.monthlyBurn : computedMonthlyBurn;
  const runwayMonths = Number((cashInBank / Math.max(1, monthlyBurn)).toFixed(1));

  const reportLeads = Array.isArray(report?.leads) ? report.leads : [];
  const leads: FundingLead[] = reportLeads
    .filter((lead) => typeof lead.name === 'string' && typeof lead.firm === 'string')
    .map((lead, index) => {
      const confidence = typeof lead.confidence === 'number' ? lead.confidence : 50;
      const stage = typeof lead.stage === 'string' ? lead.stage : 'Contacted';

      return {
        id: typeof lead.id === 'string' ? lead.id : `L-${index + 1}`,
        name: lead.name as string,
        firm: lead.firm as string,
        stage: normalizeStage(stage),
        confidence: clampConfidence(confidence),
      };
    });

  const metrics: FinancialMetric[] = [
    {
      label: 'CAC',
      value: formatCurrency(Math.max(30, Math.round(monthlyBurn / Math.max(50, signal.vaultFileCount + 20)))),
      trend: signal.unresolvedTriage > 0 ? 'up' : 'neutral',
      trendValue: signal.unresolvedTriage > 0 ? `+${Math.min(signal.unresolvedTriage * 2, 18)}%` : '0%',
    },
    {
      label: 'LTV',
      value: formatCurrency(Math.max(500, Math.round(cashInBank / Math.max(20, signal.vaultFileCount + 40)))),
      trend: signal.blockedDecisions > 0 ? 'down' : 'up',
      trendValue: signal.blockedDecisions > 0 ? `-${Math.min(signal.blockedDecisions * 2, 12)}%` : '+6%',
    },
    {
      label: 'MRR',
      value: formatCurrency(Math.max(2_000, Math.round(cashInBank / Math.max(8, runwayMonths || 1)))),
      trend: 'up',
      trendValue: `+${Math.max(2, Math.min(signal.vaultFileCount, 15))}%`,
    },
  ];

  return {
    runwayMonths,
    burnRate: `${formatCurrency(monthlyBurn)}/mo`,
    cashInBank: formatCurrency(cashInBank),
    metrics,
    leads,
  };
};

const getFundingReportPath = (): string => {
  return join(getAppDataRoot(), ...FUNDING_REPORT_PATH);
};

const tryReadFundingReport = async (): Promise<FundingReportFile | undefined> => {
  const reportPath = getFundingReportPath();
  if (!existsSync(reportPath)) {
    return undefined;
  }

  try {
    const raw = await readFile(reportPath, 'utf8');
    const parsed = JSON.parse(raw) as FundingReportFile;
    return parsed;
  } catch {
    return undefined;
  }
};

export const fundingDigestService = {
  async createPayload(signal: FundingDigestSignalInput): Promise<FundingDigestPayload> {
    const report = await tryReadFundingReport();
    return buildFundingPayloadFromSignals(signal, report);
  },
};
