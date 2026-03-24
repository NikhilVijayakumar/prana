import type { GoogleFormFeedbackResponse } from './administrationIntegrationService';

export interface FeedbackSentimentResult {
  responseId: string;
  employeeId: string;
  team: string;
  goingWellSentiment: number;
  needsImprovementSentiment: number;
  supportRequestedSentiment: number;
  overallSentiment: number;
  topPositiveKeywords: string[];
  topNegativeKeywords: string[];
}

export interface TeamSentimentSummary {
  team: string;
  responseCount: number;
  averageSentiment: number;
  averageGoingWell: number;
  averageNeedsImprovement: number;
  averageSupportRequested: number;
  topConcerns: string[];
  topPositives: string[];
}

export interface FeedbackSentimentOutput {
  generatedAt: string;
  summary: {
    totalResponses: number;
    averageSentiment: number;
    teamsAnalyzed: number;
    criticalTeams: number;
  };
  results: FeedbackSentimentResult[];
  teamSummaries: TeamSentimentSummary[];
}

export interface PolicyImprovementFromSentiment {
  team: string;
  averageSentiment: number;
  topConcerns: string[];
  suggestedPolicyArea: string;
  suggestedAction: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SentimentPolicyImprovementOutput {
  generatedAt: string;
  summary: {
    totalSuggestions: number;
    highPriority: number;
  };
  suggestions: PolicyImprovementFromSentiment[];
}

const POSITIVE_KEYWORDS = new Set([
  'great', 'excellent', 'good', 'amazing', 'wonderful', 'fantastic',
  'happy', 'satisfied', 'supportive', 'collaborative', 'productive',
  'smooth', 'efficient', 'helpful', 'positive', 'rewarding',
  'clear', 'transparent', 'growth', 'opportunity', 'improvement',
  'flexible', 'balanced', 'empowered', 'motivated', 'inspired',
  'teamwork', 'respect', 'trust', 'innovation', 'recognition',
]);

const NEGATIVE_KEYWORDS = new Set([
  'bad', 'poor', 'terrible', 'awful', 'frustrating', 'stressful',
  'burnout', 'overwhelmed', 'overworked', 'exhausted', 'unfair',
  'unclear', 'confusing', 'chaotic', 'disorganized', 'unsupported',
  'ignored', 'micromanaged', 'toxic', 'hostile', 'delay',
  'complaint', 'problem', 'issue', 'concern', 'lack',
  'insufficient', 'inadequate', 'nothing', 'none', 'never',
  'difficult', 'struggling', 'anxious', 'dissatisfied', 'unhappy',
]);




const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
};

const scoreText = (text: string): { score: number; positives: string[]; negatives: string[] } => {
  if (!text || text.trim().length === 0) {
    return { score: 50, positives: [], negatives: [] };
  }

  const tokens = tokenize(text);
  const positives: string[] = [];
  const negatives: string[] = [];

  for (const token of tokens) {
    if (POSITIVE_KEYWORDS.has(token)) {
      positives.push(token);
    }
    if (NEGATIVE_KEYWORDS.has(token)) {
      negatives.push(token);
    }
  }

  const totalSignals = positives.length + negatives.length;
  if (totalSignals === 0) {
    return { score: 50, positives: [], negatives: [] };
  }

  const rawScore = (positives.length / totalSignals) * 100;
  return {
    score: Number(rawScore.toFixed(2)),
    positives: [...new Set(positives)],
    negatives: [...new Set(negatives)],
  };
};




const clampScore = (value: number): number => {
  if (Number.isNaN(value)) return 50;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Number(value.toFixed(2));
};

const mapConcernToPolicyArea = (concern: string): string => {
  if (concern === 'management' || concern === 'growth' || concern === 'workload') {
    return 'hr-performance';
  }
  if (concern === 'tools' || concern === 'communication') {
    return 'operations-controls';
  }
  if (concern === 'support') {
    return 'hr-performance';
  }
  return 'core-governance';
};

export const analyzeFeedbackSentiment = (
  responses: GoogleFormFeedbackResponse[],
): FeedbackSentimentResult[] => {
  return responses.map((response) => {
    const goingWell = scoreText(response.goingWell);
    const needsImprovement = scoreText(response.needsImprovement);
    const supportRequested = scoreText(response.supportRequested);

    const invertedImprovement = 100 - needsImprovement.score;
    const invertedSupport = 100 - supportRequested.score;

    const overallSentiment = clampScore(
      goingWell.score * 0.5 + invertedImprovement * 0.3 + invertedSupport * 0.2,
    );

    const allPositives = [...goingWell.positives];
    const allNegatives = [
      ...needsImprovement.negatives,
      ...supportRequested.negatives,
    ];

    return {
      responseId: response.responseId,
      employeeId: response.employeeId,
      team: response.team,
      goingWellSentiment: goingWell.score,
      needsImprovementSentiment: needsImprovement.score,
      supportRequestedSentiment: supportRequested.score,
      overallSentiment,
      topPositiveKeywords: [...new Set(allPositives)].slice(0, 5),
      topNegativeKeywords: [...new Set(allNegatives)].slice(0, 5),
    };
  });
};

export const computeTeamSentimentSummary = (
  results: FeedbackSentimentResult[],
): TeamSentimentSummary[] => {
  const byTeam = new Map<string, FeedbackSentimentResult[]>();

  for (const result of results) {
    const team = result.team || 'Unknown';
    const existing = byTeam.get(team) ?? [];
    existing.push(result);
    byTeam.set(team, existing);
  }

  const summaries: TeamSentimentSummary[] = [];

  for (const [team, teamResults] of byTeam.entries()) {
    const count = teamResults.length;
    const avgSentiment = clampScore(
      teamResults.reduce((sum, r) => sum + r.overallSentiment, 0) / count,
    );
    const avgGoingWell = clampScore(
      teamResults.reduce((sum, r) => sum + r.goingWellSentiment, 0) / count,
    );
    const avgNeedsImprovement = clampScore(
      teamResults.reduce((sum, r) => sum + r.needsImprovementSentiment, 0) / count,
    );
    const avgSupportRequested = clampScore(
      teamResults.reduce((sum, r) => sum + r.supportRequestedSentiment, 0) / count,
    );

    const allNegativeKeywords = teamResults.flatMap((r) => r.topNegativeKeywords);
    const allPositiveKeywords = teamResults.flatMap((r) => r.topPositiveKeywords);

    const negativeCounts = new Map<string, number>();
    for (const kw of allNegativeKeywords) {
      negativeCounts.set(kw, (negativeCounts.get(kw) ?? 0) + 1);
    }
    const topConcerns = [...negativeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kw]) => kw);

    const positiveCounts = new Map<string, number>();
    for (const kw of allPositiveKeywords) {
      positiveCounts.set(kw, (positiveCounts.get(kw) ?? 0) + 1);
    }
    const topPositives = [...positiveCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kw]) => kw);

    summaries.push({
      team,
      responseCount: count,
      averageSentiment: avgSentiment,
      averageGoingWell: avgGoingWell,
      averageNeedsImprovement: avgNeedsImprovement,
      averageSupportRequested: avgSupportRequested,
      topConcerns,
      topPositives,
    });
  }

  return summaries;
};

export const proposePolicyImprovements = (
  teamSummaries: TeamSentimentSummary[],
): SentimentPolicyImprovementOutput => {
  const suggestions: PolicyImprovementFromSentiment[] = [];

  for (const team of teamSummaries) {
    if (team.averageSentiment > 50) {
      continue;
    }

    const primaryConcern = team.topConcerns[0] ?? 'general';
    const policyArea = mapConcernToPolicyArea(primaryConcern);
    const priority: 'LOW' | 'MEDIUM' | 'HIGH' =
      team.averageSentiment < 25 ? 'HIGH' : team.averageSentiment < 40 ? 'MEDIUM' : 'LOW';

    suggestions.push({
      team: team.team,
      averageSentiment: team.averageSentiment,
      topConcerns: team.topConcerns.slice(0, 3),
      suggestedPolicyArea: policyArea,
      suggestedAction: `Review ${policyArea} policies addressing ${primaryConcern} concerns for team "${team.team}".`,
      priority,
    });
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

export class FeedbackSentimentService {
  analyzeFeedbackSentiment(responses: GoogleFormFeedbackResponse[]): FeedbackSentimentOutput {
    const results = analyzeFeedbackSentiment(responses);
    const teamSummaries = computeTeamSentimentSummary(results);

    const totalSentiment = results.reduce((sum, r) => sum + r.overallSentiment, 0);
    const criticalTeams = teamSummaries.filter((t) => t.averageSentiment < 40).length;

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalResponses: results.length,
        averageSentiment: results.length > 0
          ? clampScore(totalSentiment / results.length)
          : 50,
        teamsAnalyzed: teamSummaries.length,
        criticalTeams,
      },
      results,
      teamSummaries,
    };
  }

  proposePolicyImprovements(
    teamSummaries: TeamSentimentSummary[],
  ): SentimentPolicyImprovementOutput {
    return proposePolicyImprovements(teamSummaries);
  }
}

export const feedbackSentimentService = new FeedbackSentimentService();
