/**
 * Agent Skill Registry
 * 
 * Defines and manages the capabilities (skills) available to Virtual Employees (Agents).
 * Each skill is classified as:
 * - Skill: Reusable capability or domain knowledge
 * - Rule: Governance constraint or policy enforcement
 * - Script: Deterministic algorithm or automation
 * - Tool: External API or system integration
 */

import { coreRegistryService } from './coreRegistryService';

export type SkillType = 'Skill' | 'Rule' | 'Script' | 'Tool';

export interface AgentSkill {
  id: string;
  type: SkillType;
  name: string;
  description: string;
  agent: string;
  category: string;
  constraint?: string; // For Rules: what constraint is enforced
  policy: 'default' | 'restricted' | 'governance-only'; // Access policy
  requiresApproval?: boolean; // True for high-risk skills
  inputs: SkillInput[];
  outputs: SkillOutput[];
  tags: string[];
}

export interface SkillInput {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface SkillOutput {
  name: string;
  type: string;
  description: string;
}

// =====================================================
// WAVE 1 AGENTS: Mira, Nora, Eva, Julia
// =====================================================

const MIRA_SKILLS: AgentSkill[] = [
  {
    id: 'mira-command-router',
    type: 'Skill',
    name: 'CommandRouter',
    description: 'Routes incoming work orders to the correct agent owner with deterministic logic.',
    agent: 'mira',
    category: 'routing',
    policy: 'default',
    inputs: [
      { name: 'workOrder', type: 'WorkOrder', required: true, description: 'Incoming work order from Director' },
      { name: 'agentRegistry', type: 'Map<string, AgentCapability>', required: true, description: 'Available agents' },
    ],
    outputs: [
      { name: 'targetAgentId', type: 'string', description: 'Primary owner agent ID' },
      { name: 'confidence', type: 'number', description: 'Routing confidence 0-1' },
    ],
    tags: ['routing', 'deterministic'],
  },
  {
    id: 'mira-escalation-protocol',
    type: 'Rule',
    name: 'EscalationRule',
    description: 'Escalates unresolved work orders above SLA threshold to Director.',
    agent: 'mira',
    category: 'governance',
    constraint: 'Work orders exceeding SLA by 4+ hours must escalate.',
    policy: 'governance-only',
    inputs: [
      { name: 'workOrder', type: 'WorkOrder', required: true, description: 'Work order to check' },
      { name: 'currentTime', type: 'ISO8601', required: true, description: 'Current timestamp' },
      { name: 'slaMinutes', type: 'number', required: true, description: 'SLA in minutes' },
    ],
    outputs: [
      { name: 'requiresEscalation', type: 'boolean', description: 'True if SLA breach' },
      { name: 'breachMinutes', type: 'number', description: 'Minutes of breach' },
    ],
    tags: ['escalation', 'sla', 'governance'],
  },
  {
    id: 'mira-brief-composer',
    type: 'Script',
    name: 'BriefComposer',
    description: 'Generates concise operational briefs synthesizing responses from multiple agents.',
    agent: 'mira',
    category: 'synthesis',
    policy: 'default',
    inputs: [
      { name: 'agentResponses', type: 'AgentExecutionResult[]', required: true, description: 'Responses from agent network' },
      { name: 'workOrder', type: 'WorkOrder', required: true, description: 'Original work order context' },
    ],
    outputs: [
      { name: 'briefMarkdown', type: 'string', description: 'Executive brief for Director' },
      { name: 'riskFlags', type: 'string[]', description: 'Highlighted risks or concerns' },
    ],
    tags: ['synthesis', 'deterministic'],
  },
];

const NORA_SKILLS: AgentSkill[] = [
  {
    id: 'nora-ledger-sync',
    type: 'Skill',
    name: 'LedgerSync',
    description: 'Reconciles financial records and detects drift between local and authoritative ledgers.',
    agent: 'nora',
    category: 'finance',
    policy: 'restricted',
    requiresApproval: true,
    inputs: [
      { name: 'localLedger', type: 'LedgerEntry[]', required: true, description: 'Local financial records' },
      { name: 'authoritativeLedger', type: 'LedgerEntry[]', required: true, description: 'Authoritative source (bank)' },
    ],
    outputs: [
      { name: 'reconciled', type: 'boolean', description: 'True if reconciled successfully' },
      { name: 'drift', type: 'number', description: 'Dollar amount of drift' },
    ],
    tags: ['finance', 'reconciliation', 'governance'],
  },
  {
    id: 'nora-burn-guard',
    type: 'Rule',
    name: 'BurnGuard',
    description: 'Enforces spend policy guardrails to ensure runway protection.',
    agent: 'nora',
    category: 'governance',
    constraint: 'No non-essential spend when runway < 60 days. Critical spend requires CEO approval.',
    policy: 'default',
    inputs: [
      { name: 'proposedExpense', type: 'Expense', required: true, description: 'Expense to validate' },
      { name: 'runwayDays', type: 'number', required: true, description: 'Current runway in days' },
      { name: 'spendPolicy', type: 'SpendPolicy', required: true, description: 'Spend guardrails' },
    ],
    outputs: [
      { name: 'allowed', type: 'boolean', description: 'True if expense passes guardrails' },
      { name: 'reason', type: 'string', description: 'Explanation for block (if any)' },
    ],
    tags: ['governance', 'runway-protection', 'deterministic'],
  },
  {
    id: 'nora-cashflow-forecaster',
    type: 'Script',
    name: 'CashflowForecaster',
    description: 'Projects forward cash scenarios based on burn rate and revenue assumptions.',
    agent: 'nora',
    category: 'forecasting',
    policy: 'default',
    inputs: [
      { name: 'monthlyBurnRate', type: 'number', required: true, description: 'Average monthly burn' },
      { name: 'revenueStreams', type: 'RevenueStream[]', required: true, description: 'Revenue assumptions' },
      { name: 'horizon', type: 'number', required: true, description: 'Forecast months ahead' },
    ],
    outputs: [
      { name: 'scenarios', type: 'ForecastScenario[]', description: 'Optimistic, expected, pessimistic cases' },
      { name: 'runwayMonths', type: 'number', description: 'Expected runway until cash out' },
    ],
    tags: ['forecasting', 'deterministic'],
  },
];

const EVA_SKILLS: AgentSkill[] = [
  {
    id: 'eva-policy-scanner',
    type: 'Skill',
    name: 'PolicyScanner',
    description: 'Scans artifacts and workflows to find policy violations.',
    agent: 'eva',
    category: 'compliance',
    policy: 'governance-only',
    inputs: [
      { name: 'artifact', type: 'object', required: true, description: 'Artifact to scan' },
      { name: 'policies', type: 'Policy[]', required: true, description: 'Applicable policies' },
    ],
    outputs: [
      { name: 'violations', type: 'Violation[]', description: 'Found policy violations' },
      { name: 'complianceScore', type: 'number', description: 'Compliance percentage 0-100' },
    ],
    tags: ['compliance', 'governance'],
  },
  {
    id: 'eva-no-bypass',
    type: 'Rule',
    name: 'NoBypass',
    description: 'Prevents execution when critical compliance checks fail.',
    agent: 'eva',
    category: 'governance',
    constraint: 'No bypass of critical controls under any circumstances.',
    policy: 'governance-only',
    inputs: [
      { name: 'workOrder', type: 'WorkOrder', required: true, description: 'Work order to validate' },
      { name: 'criticalControls', type: 'Policy[]', required: true, description: 'Critical compliance controls' },
    ],
    outputs: [
      { name: 'allowed', type: 'boolean', description: 'True if all controls pass' },
      { name: 'blockedControls', type: 'string[]', description: 'Controls that failed' },
    ],
    tags: ['governance', 'no-bypass', 'deterministic'],
  },
  {
    id: 'eva-compliance-auditor',
    type: 'Script',
    name: 'ComplianceAuditor',
    description: 'Generates compliance audit reports for leadership review.',
    agent: 'eva',
    category: 'reporting',
    policy: 'governance-only',
    inputs: [
      { name: 'auditScope', type: 'string', required: true, description: 'What to audit' },
      { name: 'policies', type: 'Policy[]', required: true, description: 'Applicable policies' },
      { name: 'artifacts', type: 'object[]', required: true, description: 'Artifacts to review' },
    ],
    outputs: [
      { name: 'auditReport', type: 'string', description: 'Markdown audit report' },
      { name: 'complianceScore', type: 'number', description: 'Overall compliance 0-100' },
      { name: 'recommendations', type: 'string[]', description: 'Improvement recommendations' },
    ],
    tags: ['compliance', 'reporting', 'deterministic'],
  },
];

const JULIA_SKILLS: AgentSkill[] = [
  {
    id: 'julia-kpi-tracker',
    type: 'Skill',
    name: 'KPITracker',
    description: 'Tracks and visualizes key performance indicators across the organization.',
    agent: 'julia',
    category: 'analytics',
    policy: 'default',
    inputs: [
      { name: 'kpiDefinitions', type: 'KpiDefinition[]', required: true, description: 'KPIs to track' },
      { name: 'dataSources', type: 'DataSource[]', required: true, description: 'Where to pull data' },
    ],
    outputs: [
      { name: 'kpiSummary', type: 'KpiSummary', description: 'Current KPI status' },
      { name: 'trendData', type: 'TrendPoint[]', description: 'Historical trend data' },
    ],
    tags: ['analytics', 'kpi', 'dashboard'],
  },
  {
    id: 'julia-anomaly-detector',
    type: 'Rule',
    name: 'AnomalyDetector',
    description: 'Detects statistical anomalies in operational metrics.',
    agent: 'julia',
    category: 'analytics',
    constraint: 'Anomalies exceeding 2 sigma must be flagged for review.',
    policy: 'default',
    inputs: [
      { name: 'metricStream', type: 'number[]', required: true, description: 'Time-series data' },
      { name: 'thresholdSigma', type: 'number', required: true, description: 'Detection threshold (sigma)' },
    ],
    outputs: [
      { name: 'anomalies', type: 'Anomaly[]', description: 'Detected anomalies' },
      { name: 'requiresReview', type: 'boolean', description: 'True if human review needed' },
    ],
    tags: ['analytics', 'anomaly', 'deterministic'],
  },
  {
    id: 'julia-data-pipeline',
    type: 'Script',
    name: 'DataPipeline',
    description: 'Transforms and loads data from multiple sources for analysis.',
    agent: 'julia',
    category: 'etl',
    policy: 'default',
    inputs: [
      { name: 'sourceConfigs', type: 'SourceConfig[]', required: true, description: 'Data sources' },
      { name: 'transformationRules', type: 'TransformRule[]', required: true, description: 'How to transform' },
    ],
    outputs: [
      { name: 'pipelineStatus', type: 'PipelineStatus', description: 'Success/failure status' },
      { name: 'recordCount', type: 'number', description: 'Records processed' },
    ],
    tags: ['etl', 'data-engineering', 'deterministic'],
  },
];

// =====================================================
// WAVE 2 AGENTS: Elina, Maya, Lina
// =====================================================

const ELINA_SKILLS: AgentSkill[] = [
  {
    id: 'elina-profile-analyzer',
    type: 'Skill',
    name: 'ProfileAnalyzer',
    description: 'Analyzes employee profiles for skill gaps and career development opportunities.',
    agent: 'elina',
    category: 'hr-analytics',
    policy: 'default',
    inputs: [
      { name: 'employeeProfile', type: 'EmployeeProfile', required: true, description: 'Profile to analyze' },
      { name: 'skillTaxonomy', type: 'SkillDefinition[]', required: true, description: 'Available skills' },
    ],
    outputs: [
      { name: 'skillGaps', type: 'SkillGap[]', description: 'Identified gaps' },
      { name: 'recommendations', type: 'DevelopmentPlan', description: 'Career growth plan' },
    ],
    tags: ['hr', 'profile', 'skills'],
  },
  {
    id: 'elina-onboarding-orchestrator',
    type: 'Script',
    name: 'OnboardingOrchestrator',
    description: 'Coordinates multi-agent onboarding workflows for new employees.',
    agent: 'elina',
    category: 'hr-workflow',
    policy: 'default',
    inputs: [
      { name: 'newEmployee', type: 'EmployeeProfile', required: true, description: 'Employee being onboarded' },
      { name: 'onboardingSteps', type: 'OnboardingStep[]', required: true, description: 'Steps to complete' },
    ],
    outputs: [
      { name: 'onboardingStatus', type: 'OnboardingStatus', description: 'Progress summary' },
      { name: 'pendingActions', type: 'ActionItem[]', description: 'Next steps' },
    ],
    tags: ['hr', 'onboarding', 'workflow'],
  },
];

const MAYA_SKILLS: AgentSkill[] = [
  {
    id: 'maya-culture-agent',
    type: 'Skill',
    name: 'CultureAgent',
    description: 'Monitors and guides cultural alignment across teams and communications.',
    agent: 'maya',
    category: 'culture',
    policy: 'default',
    inputs: [
      { name: 'communicationSample', type: 'string', required: true, description: 'What to review' },
      { name: 'culturalNorms', type: 'CulturalNorm[]', required: true, description: 'Expected norms' },
    ],
    outputs: [
      { name: 'alignmentScore', type: 'number', description: 'Cultural alignment 0-1' },
      { name: 'suggestions', type: 'string[]', description: 'Improvement tips' },
    ],
    tags: ['culture', 'communications'],
  },
  {
    id: 'maya-engagement-tracker',
    type: 'Script',
    name: 'EngagementTracker',
    description: 'Tracks team engagement signals and flags at-risk sentiment.',
    agent: 'maya',
    category: 'hr-analytics',
    policy: 'default',
    inputs: [
      { name: 'engagementSignals', type: 'EngagementSignal[]', required: true, description: 'Input signals' },
      { name: 'teamContext', type: 'TeamContext', required: true, description: 'Team information' },
    ],
    outputs: [
      { name: 'engagementScore', type: 'number', description: 'Team engagement 0-1' },
      { name: 'atRiskMembers', type: 'TeamMember[]', description: 'Members needing attention' },
    ],
    tags: ['hr', 'engagement', 'sentiment'],
  },
];

const LINA_SKILLS: AgentSkill[] = [
  {
    id: 'lina-scheduler',
    type: 'Skill',
    name: 'Scheduler',
    description: 'Manages calendar events and schedules meetings with conflict detection.',
    agent: 'lina',
    category: 'operations',
    policy: 'default',
    inputs: [
      { name: 'availabilityWindows', type: 'TimeWindow[]', required: true, description: 'When people are free' },
      { name: 'meetingSpec', type: 'MeetingSpec', required: true, description: 'What to schedule' },
    ],
    outputs: [
      { name: 'scheduledEvent', type: 'CalendarEvent', description: 'Confirmed event' },
      { name: 'conflicts', type: 'Conflict[]', description: 'Any scheduling conflicts' },
    ],
    tags: ['calendar', 'scheduling', 'operations'],
  },
  {
    id: 'lina-meeting- summarizer',
    type: 'Script',
    name: 'MeetingSummarizer',
    description: 'Generates structured summaries and action items from meeting transcripts.',
    agent: 'lina',
    category: 'document-generation',
    policy: 'default',
    inputs: [
      { name: 'transcript', type: 'string', required: true, description: 'Meeting transcript' },
      { name: 'meetingContext', type: 'MeetingContext', required: true, description: 'Meeting info' },
    ],
    outputs: [
      { name: 'summary', type: 'string', description: 'Structured summary' },
      { name: 'actionItems', type: 'ActionItem[]', description: 'Extracted action items' },
    ],
    tags: ['meetings', 'summarization', 'documents'],
  },
];

// =====================================================
// WAVE 3 AGENTS: Arya, Dani, Sofia
// =====================================================

const ARYA_SKILLS: AgentSkill[] = [
  {
    id: 'arya-escalation-guardian',
    type: 'Rule',
    name: 'EscalationGuardian',
    description: 'Prevents premature escalations and enforces proper triage protocols.',
    agent: 'arya',
    category: 'governance',
    constraint: 'No escalation without documented triage and resolution attempts.',
    policy: 'governance-only',
    inputs: [
      { name: 'workOrder', type: 'WorkOrder', required: true, description: 'Order being escalated' },
      { name: 'triageHistory', type: 'TriageEntry[]', required: true, description: 'Resolution attempts' },
    ],
    outputs: [
      { name: 'allowed', type: 'boolean', description: 'True if escalation justified' },
      { name: 'nextSteps', type: 'string[]', description: 'Required before escalation' },
    ],
    tags: ['escalation', 'triage', 'governance'],
  },
  {
    id: 'arya-fraud-detector',
    type: 'Script',
    name: 'FraudDetector',
    description: 'Identifies suspicious patterns and potential fraud across financial operations.',
    agent: 'arya',
    category: 'security',
    policy: 'governance-only',
    inputs: [
      { name: 'transactionStream', type: 'Transaction[]', required: true, description: 'Transactions to analyze' },
      { name: 'fraudPatterns', type: 'FraudPattern[]', required: true, description: 'Known patterns' },
    ],
    outputs: [
      { name: 'suspicions', type: 'FraudFlag[]', description: 'Detected suspicions' },
      { name: 'riskScore', type: 'number', description: 'Overall fraud risk 0-1' },
    ],
    tags: ['security', 'fraud', 'finance'],
  },
];

const DANI_SKILLS: AgentSkill[] = [
  {
    id: 'dani-code-reviewer',
    type: 'Skill',
    name: 'CodeReviewer',
    description: 'Performs deterministic code review against organizational standards.',
    agent: 'dani',
    category: 'engineering',
    policy: 'default',
    inputs: [
      { name: 'codeSubmission', type: 'CodeSubmission', required: true, description: 'What to review' },
      { name: 'standards', type: 'CodeStandard[]', required: true, description: 'Expected standards' },
    ],
    outputs: [
      { name: 'reviewPassed', type: 'boolean', description: 'True if code passes' },
      { name: 'issues', type: 'CodeIssue[]', description: 'Found violations' },
    ],
    tags: ['code-review', 'engineering', 'deterministic'],
  },
  {
    id: 'dani-ci-cd-orchestrator',
    type: 'Script',
    name: 'CI/CDOrchestrator',
    description: 'Coordinates build, test, and deployment pipelines with rollback capability.',
    agent: 'dani',
    category: 'engineering',
    policy: 'default',
    inputs: [
      { name: 'pipelineConfig', type: 'PipelineConfig', required: true, description: 'Pipeline definition' },
      { name: 'deploymentTarget', type: 'DeploymentTarget', required: true, description: 'Where to deploy' },
    ],
    outputs: [
      { name: 'pipelineStatus', type: 'PipelineStatus', description: 'Success/failure' },
      { name: 'rollbackPlan', type: 'RollbackPlan', description: 'If deployment fails' },
    ],
    tags: ['cicd', 'devops', 'automation'],
  },
];

const SOFIA_SKILLS: AgentSkill[] = [
  {
    id: 'sofia-design-agent',
    type: 'Skill',
    name: 'DesignAgent',
    description: 'Generates high-fidelity UI/UX prototypes and design system variations.',
    agent: 'sofia',
    category: 'design',
    policy: 'default',
    inputs: [
      { name: 'designBrief', type: 'DesignBrief', required: true, description: 'What to design' },
      { name: 'brandGuidelines', type: 'BrandGuide', required: true, description: 'Design constraints' },
    ],
    outputs: [
      { name: 'prototypeUrl', type: 'string', description: 'HTML prototype link' },
      { name: 'designVariant', type: 'DesignVariant[]', description: 'Alternative designs' },
    ],
    tags: ['design', 'prototype', 'visual'],
  },
  {
    id: 'sofia-style-enforcer',
    type: 'Rule',
    name: 'StyleEnforcer',
    description: 'Ensures all visual outputs meet brand and accessibility standards.',
    agent: 'sofia',
    category: 'governance',
    constraint: 'All public-facing visuals must meet WCAG AA and brand guidelines.',
    policy: 'default',
    inputs: [
      { name: 'visualArtifact', type: 'string', required: true, description: 'What to check' },
      { name: 'brandStandards', type: 'BrandStandard[]', required: true, description: 'Requirements' },
    ],
    outputs: [
      { name: 'compliant', type: 'boolean', description: 'True if passes all standards' },
      { name: 'violations', type: 'BrandViolation[]', description: 'Found violations' },
    ],
    tags: ['design', 'governance', 'accessibility'],
  },
];

/**
 * Factory function to create a skill registry.
 * This is transitional - will be fully DB-backed in v2.
 * Accepts dynamic skills via parameter.
 */
export const createSkillRegistry = (dynamicSkills: AgentSkill[] = []) => {
  // Combine static and dynamic skills
  const allSkills: AgentSkill[] = [
    ...MIRA_SKILLS,
    ...NORA_SKILLS,
    ...EVA_SKILLS,
    ...JULIA_SKILLS,
    ...ELINA_SKILLS,
    ...MAYA_SKILLS,
    ...LINA_SKILLS,
    ...ARYA_SKILLS,
    ...DANI_SKILLS,
    ...SOFIA_SKILLS,
    ...dynamicSkills,
  ];

  const skillMap = new Map<string, AgentSkill>();
  allSkills.forEach((skill) => skillMap.set(skill.id, skill));

  return {
    /**
     * Get a skill by ID.
     */
    getSkill(skillId: string): AgentSkill | undefined {
      return skillMap.get(skillId);
    },

    /**
     * List all registered skills (static + dynamic).
     */
    listAllSkills(): AgentSkill[] {
      return [...skillMap.values()];
    },

    /**
     * Get skills for a specific agent.
     */
    getAgentSkills(agentId: string): AgentSkill[] {
      return allSkills.filter((s) => s.agent === agentId);
    },

    /**
     * Get skills by type (Skill, Rule, Script, Tool).
     */
    getSkillsByType(type: SkillType): AgentSkill[] {
      return allSkills.filter((s) => s.type === type);
    },

    /**
     * Get skills by category.
     */
    getByCategory(category: string): AgentSkill[] {
      return allSkills.filter((s) => s.category === category);
    },

    /**
     * Get skills requiring approval.
     */
    getRestrictedSkills(): AgentSkill[] {
      return allSkills.filter(
        (s) => s.policy === 'restricted' || s.policy === 'governance-only' || s.requiresApproval,
      );
    },

    /**
     * Get public/default skills only.
     */
    getPublicSkills(): AgentSkill[] {
      return allSkills.filter((s) => s.policy === 'default');
    },

    /**
     * Get skills by tag.
     */
    getByTag(tag: string): AgentSkill[] {
      return allSkills.filter((s) => s.tags.includes(tag));
    },

    /**
     * Register a dynamic skill (runtime extension).
     */
    registerSkill(skill: AgentSkill): void {
      skillMap.set(skill.id, skill);
      allSkills.push(skill);
    },

    /**
     * Get registry-backed skills from coreRegistryService.
     */
    getRegistryBackedSkills(): AgentSkill[] {
      const snapshot = coreRegistryService.getSnapshot();
      if (!snapshot) return [];
      
      return snapshot.skills.map((doc) => ({
        id: doc.id,
        type: 'Skill' as SkillType,
        name: doc.title,
        description: doc.content.slice(0, 200),
        agent: doc.id.split('/')[0] ?? 'unknown',
        category: 'registry-markdown',
        policy: 'default' as const,
        inputs: [],
        outputs: [],
        tags: doc.tags ?? [],
      }));
    },

    /**
     * For testing.
     */
    __resetForTesting(): void {
      // Reinitialize with only static skills
      skillMap.clear();
      [
        ...MIRA_SKILLS,
        ...NORA_SKILLS,
        ...EVA_SKILLS,
        ...JULIA_SKILLS,
        ...ELINA_SKILLS,
        ...MAYA_SKILLS,
        ...LINA_SKILLS,
        ...ARYA_SKILLS,
        ...DANI_SKILLS,
        ...SOFIA_SKILLS,
      ].forEach((s) => skillMap.set(s.id, s));
    },
  };
};

/**
 * Get static skills for backward compatibility.
 */
export const getStaticSkills = (): AgentSkill[] => [
  ...MIRA_SKILLS,
  ...NORA_SKILLS,
  ...EVA_SKILLS,
  ...JULIA_SKILLS,
  ...ELINA_SKILLS,
  ...MAYA_SKILLS,
  ...LINA_SKILLS,
  ...ARYA_SKILLS,
  ...DANI_SKILLS,
  ...SOFIA_SKILLS,
];

// Backward compatibility - creates a default instance with no dynamic skills
export const skillRegistryService = createSkillRegistry();
