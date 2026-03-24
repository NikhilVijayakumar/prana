import { describe, expect, it } from 'vitest';
import type { GoogleFormFeedbackResponse } from './administrationIntegrationService';
import {
  analyzeFeedbackSentiment,
  computeTeamSentimentSummary,
  proposePolicyImprovements,
} from './feedbackSentimentService';

const makePositiveResponse = (): GoogleFormFeedbackResponse => ({
  responseId: 'R-P1',
  submittedAt: '2026-03-01T10:00:00.000Z',
  employeeId: 'EMP-001',
  team: 'Engineering',
  role: 'Developer',
  happinessScore: 9,
  workloadScore: 4,
  goingWell: 'Great teamwork and excellent collaboration. Supportive management.',
  needsImprovement: 'Nothing major, things are smooth.',
  supportRequested: 'None needed.',
});

const makeNegativeResponse = (): GoogleFormFeedbackResponse => ({
  responseId: 'R-N1',
  submittedAt: '2026-03-01T11:00:00.000Z',
  employeeId: 'EMP-002',
  team: 'Engineering',
  role: 'Manager',
  happinessScore: 3,
  workloadScore: 9,
  goingWell: 'Nothing specific.',
  needsImprovement: 'Overworked and overwhelmed. Burnout is a concern. Frustrating delays.',
  supportRequested: 'Need coaching and unsupported in current role. Struggling with workload.',
});

const makeNeutralResponse = (): GoogleFormFeedbackResponse => ({
  responseId: 'R-U1',
  submittedAt: '2026-03-01T12:00:00.000Z',
  employeeId: 'EMP-003',
  team: 'Operations',
  role: 'Coordinator',
  happinessScore: 6,
  workloadScore: 6,
  goingWell: 'Adequate workflow and processes.',
  needsImprovement: 'Some areas need attention.',
  supportRequested: 'Not yet decided.',
});

describe('feedbackSentimentService analyzeFeedbackSentiment', () => {
  it('scores positive text higher than negative text', () => {
    const results = analyzeFeedbackSentiment([makePositiveResponse(), makeNegativeResponse()]);

    expect(results).toHaveLength(2);

    const positive = results.find((r) => r.responseId === 'R-P1');
    const negative = results.find((r) => r.responseId === 'R-N1');

    expect(positive).toBeDefined();
    expect(negative).toBeDefined();
    expect(positive!.overallSentiment).toBeGreaterThan(negative!.overallSentiment);
  });

  it('extracts positive keywords from going-well field', () => {
    const results = analyzeFeedbackSentiment([makePositiveResponse()]);
    const result = results[0];

    expect(result?.topPositiveKeywords.length).toBeGreaterThan(0);
    expect(result?.topPositiveKeywords).toContain('great');
  });

  it('extracts negative keywords from needs-improvement field', () => {
    const results = analyzeFeedbackSentiment([makeNegativeResponse()]);
    const result = results[0];

    expect(result?.topNegativeKeywords.length).toBeGreaterThan(0);
    expect(result?.topNegativeKeywords).toContain('burnout');
  });

  it('returns neutral scores for empty text', () => {
    const emptyResponse: GoogleFormFeedbackResponse = {
      responseId: 'R-E',
      submittedAt: '2026-03-01T13:00:00.000Z',
      employeeId: 'EMP-004',
      team: 'Analytics',
      role: 'Analyst',
      happinessScore: 5,
      workloadScore: 5,
      goingWell: '',
      needsImprovement: '',
      supportRequested: '',
    };

    const results = analyzeFeedbackSentiment([emptyResponse]);
    expect(results[0]?.overallSentiment).toBe(50);
  });
});

describe('feedbackSentimentService computeTeamSentimentSummary', () => {
  it('aggregates results by team', () => {
    const results = analyzeFeedbackSentiment([
      makePositiveResponse(),
      makeNegativeResponse(),
      makeNeutralResponse(),
    ]);

    const summaries = computeTeamSentimentSummary(results);

    expect(summaries).toHaveLength(2);

    const engineering = summaries.find((s) => s.team === 'Engineering');
    expect(engineering).toBeDefined();
    expect(engineering?.responseCount).toBe(2);

    const operations = summaries.find((s) => s.team === 'Operations');
    expect(operations).toBeDefined();
    expect(operations?.responseCount).toBe(1);
  });

  it('identifies top concerns across a team', () => {
    const results = analyzeFeedbackSentiment([makeNegativeResponse()]);
    const summaries = computeTeamSentimentSummary(results);
    const engineering = summaries.find((s) => s.team === 'Engineering');

    expect(engineering?.topConcerns.length).toBeGreaterThan(0);
  });
});

describe('feedbackSentimentService proposePolicyImprovements', () => {
  it('suggests improvements for teams with low sentiment', () => {
    const lowSentimentResponses: GoogleFormFeedbackResponse[] = [
      {
        responseId: 'R-LS1',
        submittedAt: '2026-03-01T10:00:00.000Z',
        employeeId: 'EMP-010',
        team: 'Support',
        role: 'Agent',
        happinessScore: 2,
        workloadScore: 9,
        goingWell: 'Nothing.',
        needsImprovement: 'Terrible burnout and frustrating stressful workload. Awful hostile toxic environment.',
        supportRequested: 'Overwhelmed and unsupported. Struggling with exhausted overworked schedule.',
      },
      {
        responseId: 'R-LS2',
        submittedAt: '2026-03-01T11:00:00.000Z',
        employeeId: 'EMP-011',
        team: 'Support',
        role: 'Lead',
        happinessScore: 1,
        workloadScore: 10,
        goingWell: 'Nothing.',
        needsImprovement: 'Poor awful terrible management. Frustrating and stressful.',
        supportRequested: 'Need coaching. Unsupported and overwhelmed.',
      },
    ];

    const results = analyzeFeedbackSentiment(lowSentimentResponses);
    const summaries = computeTeamSentimentSummary(results);
    const output = proposePolicyImprovements(summaries);

    const supportTeam = summaries.find((t) => t.team === 'Support');
    expect(supportTeam).toBeDefined();
    expect(supportTeam!.averageSentiment).toBeLessThanOrEqual(50);
    expect(output.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(output.suggestions[0]?.team).toBe('Support');
  });

  it('returns no suggestions when all teams are healthy', () => {
    const results = analyzeFeedbackSentiment([makePositiveResponse()]);
    const summaries = computeTeamSentimentSummary(results);
    const output = proposePolicyImprovements(summaries);

    expect(output.suggestions).toHaveLength(0);
  });
});
