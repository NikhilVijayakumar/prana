import { describe, expect, it } from 'vitest';
import {
  buildKpiHappinessEvaluation,
  buildSocialTrendPolicyIntelligence,
  EmployeeKpiSignal,
  GoogleFormFeedbackResponse,
  GoogleSheetStaffRow,
  SocialTrendSignal,
} from './administrationIntegrationService';

describe('administrationIntegrationService evaluator pipeline', () => {
  it('produces escalation output for critical/high risk employees', () => {
    const staffRows: GoogleSheetStaffRow[] = [
      {
        employee_id: 'EMP-001',
        full_name: 'Critical Employee',
        department: 'Administration',
        role: 'Manager',
        email: 'critical@example.com',
        status: 'active',
        manager: 'DIR-001',
        join_date: '2024-01-01',
        employment_type: 'full_time',
        location: 'HQ',
        kpi_profile: 'administration-core',
        sheet_row_ref: '2',
      },
      {
        employee_id: 'EMP-002',
        full_name: 'Healthy Employee',
        department: 'Administration',
        role: 'Specialist',
        email: 'healthy@example.com',
        status: 'active',
        manager: 'ADM-001',
        join_date: '2024-01-01',
        employment_type: 'full_time',
        location: 'HQ',
        kpi_profile: 'administration-core',
        sheet_row_ref: '3',
      },
    ];

    const feedbackResponses: GoogleFormFeedbackResponse[] = [
      {
        responseId: 'R-1',
        submittedAt: '2026-03-01T10:00:00.000Z',
        employeeId: 'EMP-001',
        team: 'Administration',
        role: 'Manager',
        happinessScore: 2,
        workloadScore: 9,
        goingWell: 'Nothing specific',
        needsImprovement: 'Need support',
        supportRequested: 'Need coaching',
      },
      {
        responseId: 'R-2',
        submittedAt: '2026-03-01T11:00:00.000Z',
        employeeId: 'EMP-002',
        team: 'Administration',
        role: 'Specialist',
        happinessScore: 9,
        workloadScore: 5,
        goingWell: 'Great collaboration',
        needsImprovement: 'None',
        supportRequested: 'N/A',
      },
    ];

    const kpiSignals: EmployeeKpiSignal[] = [
      {
        employeeId: 'EMP-001',
        kpiScore: 30,
      },
      {
        employeeId: 'EMP-002',
        kpiScore: 88,
      },
    ];

    const output = buildKpiHappinessEvaluation({
      staffRows,
      feedbackResponses,
      kpiSignals,
    });

    expect(output.summary.staffEvaluated).toBe(2);
    expect(output.summary.escalations).toBeGreaterThanOrEqual(1);

    const criticalEmployee = output.employees.find((entry) => entry.employeeId === 'EMP-001');
    expect(criticalEmployee).toBeDefined();
    expect(criticalEmployee?.risk === 'CRITICAL' || criticalEmployee?.risk === 'HIGH').toBe(true);
    expect(criticalEmployee?.escalationRequired).toBe(true);

    const escalation = output.escalations.find((entry) => entry.employeeId === 'EMP-001');
    expect(escalation).toBeDefined();
    expect(escalation?.priority === 'URGENT' || escalation?.priority === 'IMPORTANT').toBe(true);
  });

  it('defaults missing KPI/feedback data and still returns deterministic output', () => {
    const output = buildKpiHappinessEvaluation({
      staffRows: [
        {
          employee_id: 'EMP-100',
          full_name: 'Defaulted Employee',
          department: 'Administration',
          role: 'Coordinator',
          email: 'defaulted@example.com',
          status: 'active',
          manager: 'ADM-001',
          join_date: '2024-01-01',
          employment_type: 'full_time',
          location: 'HQ',
          kpi_profile: 'administration-core',
          sheet_row_ref: '4',
        },
      ],
      feedbackResponses: [],
      kpiSignals: [],
    });

    expect(output.summary.staffEvaluated).toBe(1);
    expect(output.employees[0]?.kpiScore).toBe(70);
    expect(output.employees[0]?.happinessScore).toBe(70);
    expect(output.summary.averageCompositeScore).toBe(70);
  });
});

describe('administrationIntegrationService social trend intelligence pipeline', () => {
  it('flags critical policy-impact trends for escalation', () => {
    const signals: SocialTrendSignal[] = [
      {
        id: 'trend-001',
        capturedAt: '2026-03-01T10:00:00.000Z',
        channel: 'telegram',
        topic: 'payroll delay complaints',
        sentiment: 'NEGATIVE',
        intensity: 95,
        relevanceToPolicy: 95,
        summary: 'Multiple staff members reporting repeated payroll delays.',
      },
      {
        id: 'trend-002',
        capturedAt: '2026-03-01T10:30:00.000Z',
        channel: 'email',
        topic: 'canteen appreciation',
        sentiment: 'POSITIVE',
        intensity: 40,
        relevanceToPolicy: 20,
        summary: 'Positive feedback on cafeteria options.',
      },
    ];

    const output = buildSocialTrendPolicyIntelligence(signals);

    expect(output.summary.trendCount).toBe(2);
    expect(output.summary.policySignals).toBe(1);
    expect(output.summary.escalations).toBe(1);

    const criticalRecommendation = output.recommendations.find(
      (entry) => entry.topic === 'payroll delay complaints'
    );

    expect(criticalRecommendation).toBeDefined();
    expect(criticalRecommendation?.risk).toBe('CRITICAL');
    expect(criticalRecommendation?.escalationRequired).toBe(true);
  });

  it('returns empty recommendations when no policy-relevant trends exist', () => {
    const signals: SocialTrendSignal[] = [
      {
        id: 'trend-003',
        capturedAt: '2026-03-01T11:00:00.000Z',
        channel: 'social',
        topic: 'team outing photos',
        sentiment: 'POSITIVE',
        intensity: 25,
        relevanceToPolicy: 10,
        summary: 'Casual conversation with no policy implication.',
      },
    ];

    const output = buildSocialTrendPolicyIntelligence(signals);

    expect(output.summary.trendCount).toBe(1);
    expect(output.summary.policySignals).toBe(0);
    expect(output.summary.escalations).toBe(0);
    expect(output.recommendations).toHaveLength(0);
  });
});
