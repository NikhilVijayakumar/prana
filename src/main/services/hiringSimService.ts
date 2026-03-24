import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getAppDataRoot } from './governanceRepoService';

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

export interface HiringSimSignalInput {
  blockedSkillCount: number;
  totalSkillCount: number;
  triageItemCount: number;
  skillNames: string[];
}

interface CandidateReportFile {
  openRolesCount?: number;
  averageTimeGaps?: string;
  candidates?: Array<{
    id?: string;
    name?: string;
    role?: string;
    matchScore?: number;
    status?: string;
    keyStrengths?: string[];
  }>;
}

const CANDIDATE_REPORT_PATH = ['processed', 'lina', 'candidates.json'];

const normalizeStatus = (status: string): HiringCandidate['status'] => {
  if (status === 'Interview Round 1' || status === 'Technical Assessment' || status === 'Offer Pending') {
    return status;
  }

  return 'Evaluating';
};

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Math.round(value)));
};

const pick = <T>(items: T[], index: number, fallback: T): T => {
  if (items.length === 0) {
    return fallback;
  }

  return items[index % items.length] ?? fallback;
};

export const buildHiringPayloadFromSignals = (
  signal: HiringSimSignalInput,
  report?: CandidateReportFile,
): HiringSimPayload => {
  const openRolesCount = typeof report?.openRolesCount === 'number'
    ? Math.max(1, Math.round(report.openRolesCount))
    : Math.max(2, Math.min(8, Math.ceil(signal.totalSkillCount / 4) + 1));

  const averageTimeGaps =
    typeof report?.averageTimeGaps === 'string'
      ? report.averageTimeGaps
      : signal.blockedSkillCount > 0
        ? `${14 + signal.blockedSkillCount} days`
        : '12 days';

  const reportCandidates = Array.isArray(report?.candidates) ? report.candidates : [];

  const fallbackNames = ['Alex Carter', 'Priya Nair', 'Mateo Silva', 'Jin Park', 'Fatima Noor'];
  const fallbackRoles = ['Staff Engineer', 'Product Designer', 'Growth Lead', 'Operations Analyst'];

  const generatedCandidates: HiringCandidate[] = reportCandidates.length > 0
    ? reportCandidates
        .filter((candidate) => typeof candidate.name === 'string' && typeof candidate.role === 'string')
        .map((candidate, index) => {
          const score = typeof candidate.matchScore === 'number' ? candidate.matchScore : 72;
          const status = typeof candidate.status === 'string' ? candidate.status : 'Evaluating';
          return {
            id: typeof candidate.id === 'string' ? candidate.id : `C-${index + 1}`,
            name: candidate.name as string,
            role: candidate.role as string,
            matchScore: clampScore(score),
            status: normalizeStatus(status),
            keyStrengths:
              Array.isArray(candidate.keyStrengths) && candidate.keyStrengths.length > 0
                ? candidate.keyStrengths.slice(0, 3)
                : ['Structured Thinking', 'Execution Discipline'],
          };
        })
    : Array.from({ length: Math.max(3, Math.min(6, openRolesCount + 1)) }).map((_, index) => {
        const name = pick(fallbackNames, index + signal.triageItemCount, 'Candidate');
        const role = pick(fallbackRoles, index + signal.blockedSkillCount, 'Generalist');
        const skillHint = pick(signal.skillNames, index, 'Cross-functional');
        const scoreBase = 78 + Math.max(0, signal.totalSkillCount - signal.blockedSkillCount) - index * 2;

        return {
          id: `C-${index + 1}`,
          name,
          role,
          matchScore: clampScore(scoreBase),
          status: normalizeStatus(index === 0 ? 'Technical Assessment' : index === 1 ? 'Interview Round 1' : 'Evaluating'),
          keyStrengths: [skillHint, 'Team Collaboration', 'Delivery Ownership'],
        };
      });

  return {
    openRolesCount,
    activeCandidates: generatedCandidates.length,
    averageTimeGaps,
    candidates: generatedCandidates,
  };
};

const getCandidateReportPath = (): string => {
  return join(getAppDataRoot(), ...CANDIDATE_REPORT_PATH);
};

const tryReadCandidateReport = async (): Promise<CandidateReportFile | undefined> => {
  const reportPath = getCandidateReportPath();
  if (!existsSync(reportPath)) {
    return undefined;
  }

  try {
    const raw = await readFile(reportPath, 'utf8');
    const parsed = JSON.parse(raw) as CandidateReportFile;
    return parsed;
  } catch {
    return undefined;
  }
};

export const hiringSimService = {
  async createPayload(signal: HiringSimSignalInput): Promise<HiringSimPayload> {
    const report = await tryReadCandidateReport();
    return buildHiringPayloadFromSignals(signal, report);
  },
};
