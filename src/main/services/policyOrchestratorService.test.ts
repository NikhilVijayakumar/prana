import { describe, expect, it } from 'vitest';
import {
  evaluateStaffCompliance,
  suggestPolicyImprovements,
  MinimalStaffRow,
  PolicyMetadata,
  SentimentTeamSummary,
} from './policyOrchestratorService';

const makePolicies = (): PolicyMetadata[] => [
  {
    id: 'decision-governance',
    title: 'Decision Governance',
    area: 'core-governance',
    owner: 'arya',
    status: 'active',
    reviewCadence: 'quarterly',
    lastReviewedAt: new Date().toISOString(),
    applicableTo: ['*'],
    vaultPath: '/org/administration/policies/core-governance/decision-governance.md',
    maxTokens: 16000,
  },
  {
    id: 'performance-and-wellbeing',
    title: 'Performance and Wellbeing',
    area: 'hr-performance',
    owner: 'mira',
    status: 'active',
    reviewCadence: 'monthly',
    lastReviewedAt: '2024-01-01T00:00:00.000Z',
    applicableTo: ['*'],
    vaultPath: '/org/administration/policies/hr-performance/performance-and-wellbeing.md',
    maxTokens: 16000,
  },
  {
    id: 'external-integration-security',
    title: 'External Integration Security',
    area: 'security-compliance',
    owner: 'eva',
    status: 'active',
    reviewCadence: 'quarterly',
    lastReviewedAt: new Date().toISOString(),
    applicableTo: ['engineering', 'devops'],
    vaultPath: '/org/administration/policies/security-compliance/external-integration-security.md',
    maxTokens: 16000,
  },
];

const makeStaffRows = (): MinimalStaffRow[] => [
  {
    employee_id: 'EMP-001',
    full_name: 'Alice Admin',
    department: 'Administration',
    role: 'Manager',
    status: 'active',
  },
  {
    employee_id: 'EMP-002',
    full_name: 'Bob Builder',
    department: 'Engineering',
    role: 'Developer',
    status: 'active',
  },
  {
    employee_id: 'EMP-003',
    full_name: 'Charlie Contractor',
    department: 'Operations',
    role: 'Coordinator',
    status: 'inactive',
  },
];

describe('policyOrchestratorService evaluateStaffCompliance', () => {
  it('evaluates active staff against applicable policies', () => {
    const output = evaluateStaffCompliance(makeStaffRows(), makePolicies());

    expect(output.summary.staffEvaluated).toBe(2);
    expect(output.records).toHaveLength(2);

    const alice = output.records.find((r) => r.employeeId === 'EMP-001');
    expect(alice).toBeDefined();
    expect(alice?.applicablePolicies).toContain('decision-governance');
    expect(alice?.applicablePolicies).toContain('performance-and-wellbeing');
    expect(alice?.applicablePolicies).not.toContain('external-integration-security');
  });

  it('detects overdue policy reviews as violations', () => {
    const output = evaluateStaffCompliance(makeStaffRows(), makePolicies());

    const alice = output.records.find((r) => r.employeeId === 'EMP-001');
    expect(alice).toBeDefined();

    const overdueViolation = alice?.violatedPolicies.find(
      (v) => v.policyId === 'performance-and-wellbeing',
    );
    expect(overdueViolation).toBeDefined();
    expect(overdueViolation?.reason).toContain('overdue');
  });

  it('scopes security policy only to applicable departments', () => {
    const output = evaluateStaffCompliance(makeStaffRows(), makePolicies());

    const bob = output.records.find((r) => r.employeeId === 'EMP-002');
    expect(bob).toBeDefined();
    expect(bob?.applicablePolicies).toContain('external-integration-security');

    const alice = output.records.find((r) => r.employeeId === 'EMP-001');
    expect(alice?.applicablePolicies).not.toContain('external-integration-security');
  });

  it('excludes inactive staff', () => {
    const output = evaluateStaffCompliance(makeStaffRows(), makePolicies());
    const charlie = output.records.find((r) => r.employeeId === 'EMP-003');
    expect(charlie).toBeUndefined();
  });

  it('returns 100% compliance when no active policies exist', () => {
    const output = evaluateStaffCompliance(makeStaffRows(), []);
    expect(output.summary.averageComplianceScore).toBe(100);
    expect(output.summary.totalViolations).toBe(0);
  });
});

describe('policyOrchestratorService suggestPolicyImprovements', () => {
  it('suggests review for overdue policies', () => {
    const policies = makePolicies();
    const compliance = evaluateStaffCompliance(makeStaffRows(), policies);
    const output = suggestPolicyImprovements(policies, compliance);

    const overdueItems = output.suggestions.filter((s) => s.source === 'review-overdue');
    expect(overdueItems.length).toBeGreaterThanOrEqual(1);
    expect(overdueItems[0]?.policyId).toBe('performance-and-wellbeing');
  });

  it('suggests improvements from compliance gaps', () => {
    const policies = makePolicies();
    const compliance = evaluateStaffCompliance(makeStaffRows(), policies);
    const output = suggestPolicyImprovements(policies, compliance);

    const gapItems = output.suggestions.filter((s) => s.source === 'compliance-gap');
    expect(gapItems.length).toBeGreaterThanOrEqual(1);
  });

  it('incorporates sentiment signals when team sentiment is low', () => {
    const policies = makePolicies();
    const compliance = evaluateStaffCompliance(makeStaffRows(), policies);

    const teamSentiments: SentimentTeamSummary[] = [
      {
        team: 'Administration',
        averageSentiment: 20,
        topConcerns: ['workload', 'burnout', 'lack of support'],
      },
    ];

    const output = suggestPolicyImprovements(policies, compliance, teamSentiments);

    const sentimentItems = output.suggestions.filter((s) => s.source === 'sentiment-signal');
    expect(sentimentItems.length).toBeGreaterThanOrEqual(1);
    expect(sentimentItems[0]?.priority).toBe('HIGH');
  });

  it('returns no sentiment suggestions when teams are healthy', () => {
    const policies = makePolicies();
    const compliance = evaluateStaffCompliance(makeStaffRows(), policies);

    const teamSentiments: SentimentTeamSummary[] = [
      { team: 'Administration', averageSentiment: 80, topConcerns: [] },
    ];

    const output = suggestPolicyImprovements(policies, compliance, teamSentiments);
    const sentimentItems = output.suggestions.filter((s) => s.source === 'sentiment-signal');
    expect(sentimentItems).toHaveLength(0);
  });
});
