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
      { name: 'canExecute', type: 'boolean', description: 'False if critical control fails' },
      { name: 'blockReason', type: 'string', description: 'Reason for no-bypass' },
    ],
    tags: ['compliance', 'governance', 'deterministic'],
  },
  {
    id: 'eva-audit-exporter',
    type: 'Script',
    name: 'AuditExporter',
    description: 'Generates regulator-ready compliance snapshots.',
    agent: 'eva',
    category: 'audit',
    policy: 'governance-only',
    requiresApproval: true,
    inputs: [
      { name: 'auditScope', type: 'string', required: true, description: 'Time range or scope' },
      { name: 'exportFormat', type: 'enum[CSV|JSON|PDF]', required: true, description: 'Output format' },
    ],
    outputs: [
      { name: 'auditReport', type: 'Blob', description: 'Compliance snapshot' },
      { name: 'timestamp', type: 'ISO8601', description: 'Report generation time' },
    ],
    tags: ['audit', 'compliance', 'deterministic'],
  },
];

const JULIA_SKILLS: AgentSkill[] = [
  {
    id: 'julia-architecture-lens',
    type: 'Skill',
    name: 'ArchitectureLens',
    description: 'Evaluates design choices against clean architecture boundaries.',
    agent: 'julia',
    category: 'architecture',
    policy: 'default',
    inputs: [
      { name: 'proposedFeature', type: 'Feature', required: true, description: 'Feature to evaluate' },
      { name: 'architectureConstraints', type: 'Constraint[]', required: true, description: 'Clean architecture rules' },
    ],
    outputs: [
      { name: 'feasibility', type: 'enum[HIGH|MEDIUM|LOW]', description: 'Implementation feasibility' },
      { name: 'alignmentScore', type: 'number', description: 'Architecture alignment 0-10' },
    ],
    tags: ['architecture', 'design-review'],
  },
  {
    id: 'julia-cycle-shield',
    type: 'Rule',
    name: 'CycleShield',
    description: 'Flags dependency cycles and layer leaks.',
    agent: 'julia',
    category: 'governance',
    constraint: 'Zero dependency cycles permitted. All imports must flow in single direction.',
    policy: 'governance-only',
    inputs: [
      { name: 'dependencyGraph', type: 'Graph', required: true, description: 'Current dependency structure' },
      { name: 'proposedChange', type: 'CodeChange', required: true, description: 'Proposed import/change' },
    ],
    outputs: [
      { name: 'cycleDetected', type: 'boolean', description: 'True if cycle would result' },
      { name: 'affectedModules', type: 'string[]', description: 'Modules in the cycle' },
    ],
    tags: ['governance', 'architecture', 'deterministic'],
  },
  {
    id: 'julia-tech-plan-builder',
    type: 'Script',
    name: 'TechPlanBuilder',
    description: 'Builds implementation milestones with risk tags.',
    agent: 'julia',
    category: 'planning',
    policy: 'default',
    inputs: [
      { name: 'feature', type: 'Feature', required: true, description: 'Feature to plan' },
      { name: 'teamCapacity', type: 'number', required: true, description: 'Dev-days available' },
    ],
    outputs: [
      { name: 'milestones', type: 'Milestone[]', description: 'Implementation phases' },
      { name: 'estimatedDays', type: 'number', description: 'Total effort estimate' },
      { name: 'risks', type: 'RiskTag[]', description: 'Technical risk markers' },
    ],
    tags: ['planning', 'deterministic'],
  },
];

// =====================================================
// WAVE 2 AGENTS: Elina, Maya, Lina
// =====================================================

const ELINA_SKILLS: AgentSkill[] = [
  {
    id: 'elina-flow-board',
    type: 'Skill',
    name: 'FlowBoard',
    description: 'Provides throughput and bottleneck visibility across work queue.',
    agent: 'elina',
    category: 'operations',
    policy: 'default',
    inputs: [
      { name: 'queue', type: 'WorkOrder[]', required: true, description: 'Current work queue' },
      { name: 'completionByAgent', type: 'Map<string, number>', required: true, description: 'Perf by agent' },
    ],
    outputs: [
      { name: 'throughput', type: 'number', description: 'Work orders/week' },
      { name: 'bottlenecks', type: 'string[]', description: 'Identified blockers' },
    ],
    tags: ['operations', 'analytics'],
  },
  {
    id: 'elina-queue-rule',
    type: 'Rule',
    name: 'QueueRule',
    description: 'Protects crisis slots and SLA priorities.',
    agent: 'elina',
    category: 'governance',
    constraint: 'Reserve 20% capacity for CRITICAL work. Maintain SLA slot protection.',
    policy: 'default',
    inputs: [
      { name: 'workOrder', type: 'WorkOrder', required: true, description: 'Incoming work order' },
      { name: 'queueState', type: 'QueueState', required: true, description: 'Current queue metrics' },
    ],
    outputs: [
      { name: 'canQueue', type: 'boolean', description: 'True if can be queued' },
      { name: 'insertPosition', type: 'number', description: 'Position in queue' },
    ],
    tags: ['governance', 'queue-management', 'deterministic'],
  },
  {
    id: 'elina-ops-digest',
    type: 'Script',
    name: 'OpsDigest',
    description: 'Summarizes delivery pulse every cycle.',
    agent: 'elina',
    category: 'reporting',
    policy: 'default',
    inputs: [
      { name: 'weeklyMetrics', type: 'OperationalMetrics', required: true, description: 'Week\'s metrics' },
    ],
    outputs: [
      { name: 'digestMarkdown', type: 'string', description: 'Weekly operational summary' },
      { name: 'healthScore', type: 'number', description: 'Operations health 0-100' },
    ],
    tags: ['reporting', 'deterministic'],
  },
];

const MAYA_SKILLS: AgentSkill[] = [
  {
    id: 'maya-funding-radar',
    type: 'Skill',
    name: 'FundingRadar',
    description: 'Tracks and ranks funding opportunities in market.',
    agent: 'maya',
    category: 'capital',
    policy: 'default',
    requiresApproval: true,
    inputs: [
      { name: 'targetRaise', type: 'number', required: true, description: 'Capital target' },
      { name: 'runwayConstraint', type: 'number', required: true, description: 'Runway limit days' },
    ],
    outputs: [
      { name: 'opportunities', type: 'FundingOpportunity[]', description: 'Ranked opportunities' },
      { name: 'score', type: 'number', description: 'Pipeline health 0-1' },
    ],
    tags: ['capital', 'market-intel'],
  },
  {
    id: 'maya-capital-discipline',
    type: 'Rule',
    name: 'CapitalDiscipline',
    description: 'Rejects misaligned capital terms.',
    agent: 'maya',
    category: 'governance',
    constraint: 'Reject terms: dilution >25%, valuation <target*0.8, governance override clauses.',
    policy: 'default',
    inputs: [
      { name: 'termSheet', type: 'TermSheet', required: true, description: 'Proposed terms' },
      { name: 'criteria', type: 'TermCriteria', required: true, description: 'Acceptable terms' },
    ],
    outputs: [
      { name: 'acceptable', type: 'boolean', description: 'True if terms meet criteria' },
      { name: 'concerns', type: 'string[]', description: 'Issues with terms' },
    ],
    tags: ['governance', 'capital', 'deterministic'],
  },
  {
    id: 'maya-deck-assembler',
    type: 'Script',
    name: 'DeckAssembler',
    description: 'Builds concise investor narrative packets.',
    agent: 'maya',
    category: 'sales-enablement',
    policy: 'default',
    inputs: [
      { name: 'companyMetrics', type: 'Metrics', required: true, description: 'Current company state' },
      { name: 'investorProfile', type: 'Investor', required: true, description: 'Target investor' },
    ],
    outputs: [
      { name: 'deckPDF', type: 'Blob', description: 'Investor deck' },
      { name: 'talkingPoints', type: 'string[]', description: 'Key narrative points' },
    ],
    tags: ['sales-enablement', 'deterministic'],
  },
];

const LINA_SKILLS: AgentSkill[] = [
  {
    id: 'lina-role-fit-engine',
    type: 'Skill',
    name: 'RoleFitEngine',
    description: 'Scores candidate profiles against role requirements.',
    agent: 'lina',
    category: 'talent',
    policy: 'default',
    inputs: [
      { name: 'candidate', type: 'Candidate', required: true, description: 'Candidate profile' },
      { name: 'roleRequirements', type: 'RoleRequirement[]', required: true, description: 'Role specs' },
    ],
    outputs: [
      { name: 'fitScore', type: 'number', description: 'Role-fit 0-10' },
      { name: 'strengths', type: 'string[]', description: 'Key strengths for role' },
      { name: 'gaps', type: 'string[]', description: 'Development areas' },
    ],
    tags: ['talent', 'analytics'],
  },
  {
    id: 'lina-bias-blocker',
    type: 'Rule',
    name: 'BiasBlocker',
    description: 'Prevents non-compliant selection heuristics.',
    agent: 'lina',
    category: 'governance',
    constraint: 'All hiring decisions must pass bias audit. Diverse cohort scoring required.',
    policy: 'governance-only',
    inputs: [
      { name: 'candidates', type: 'Candidate[]', required: true, description: 'Full candidate set' },
      { name: 'decision', type: 'HiringDecision', required: true, description: 'Proposed selection' },
    ],
    outputs: [
      { name: 'biasCheckPassed', type: 'boolean', description: 'True if unbiased decision' },
      { name: 'auditLog', type: 'string', description: 'Bias audit trail' },
    ],
    tags: ['governance', 'compliance', 'deterministic'],
  },
  {
    id: 'lina-hiring-summary',
    type: 'Script',
    name: 'HiringSummary',
    description: 'Produces transparent hiring notes.',
    agent: 'lina',
    category: 'documentation',
    policy: 'default',
    inputs: [
      { name: 'hirings', type: 'HiringDecision[]', required: true, description: 'Hiring actions this cycle' },
    ],
    outputs: [
      { name: 'summaryMarkdown', type: 'string', description: 'Hiring cycle notes' },
      { name: 'metrics', type: 'HiringMetrics', description: 'Cycle KPIs' },
    ],
    tags: ['documentation', 'deterministic'],
  },
];

// =====================================================
// WAVE 3 AGENTS: Arya, Dani, Sofia
// =====================================================

const ARYA_SKILLS: AgentSkill[] = [
  {
    id: 'arya-strategy-alignment',
    type: 'Skill',
    name: 'StrategicAlignment',
    description: 'Evaluates proposed initiatives against company strategic goals.',
    agent: 'arya',
    category: 'strategy',
    policy: 'default',
    inputs: [
      { name: 'initiative', type: 'Initiative', required: true, description: 'Proposed initiative' },
      { name: 'strategicGoals', type: 'Goal[]', required: true, description: 'Company goals' },
    ],
    outputs: [
      { name: 'alignmentScore', type: 'number', description: 'Alignment 0-10' },
      { name: 'recommendation', type: 'enum[APPROVED|REVISION_REQUIRED|REJECTED]', description: 'Recommendation' },
    ],
    tags: ['strategy', 'decision-support'],
  },
  {
    id: 'arya-antigravity-principles',
    type: 'Rule',
    name: 'AntrigravityPrinciples',
    description: 'Enforces minimalist, high-impact momentum rules.',
    agent: 'arya',
    category: 'governance',
    constraint: 'All features must demonstrate >2x value-to-complexity ratio. No unnecessary overhead.',
    policy: 'default',
    inputs: [
      { name: 'feature', type: 'Feature', required: true, description: 'Proposed feature' },
      { name: 'phase', type: 'string', required: true, description: 'Current phase' },
    ],
    outputs: [
      { name: 'violatesAntigravity', type: 'boolean', description: 'True if violates principles' },
      { name: 'justification', type: 'string', description: 'Reason for violation (if any)' },
    ],
    tags: ['governance', 'strategy', 'deterministic'],
  },
  {
    id: 'arya-cross-module-cohesion',
    type: 'Skill',
    name: 'CrossModuleCohesion',
    description: 'Validates alignment between technical reality and marketing promises.',
    agent: 'arya',
    category: 'strategy',
    policy: 'default',
    inputs: [
      { name: 'techCapacity', type: 'Capacity', required: true, description: 'Engineering capacity' },
      { name: 'marketingPlan', type: 'MarketingPlan', required: true, description: 'Marketing promises' },
    ],
    outputs: [
      { name: 'promiseDrift', type: 'number', description: 'Variance % (0 ideal)' },
      { name: 'risks', type: 'RiskTag[]', description: 'Risk markers' },
    ],
    tags: ['strategy', 'risk-management'],
  },
];

const DANI_SKILLS: AgentSkill[] = [
  {
    id: 'dani-campaign-board',
    type: 'Skill',
    name: 'CampaignBoard',
    description: 'Manages marketing campaigns and channel allocation.',
    agent: 'dani',
    category: 'marketing',
    policy: 'default',
    inputs: [
      { name: 'campaigns', type: 'Campaign[]', required: true, description: 'Current campaigns' },
      { name: 'budget', type: 'number', required: true, description: 'Marketing budget' },
    ],
    outputs: [
      { name: 'allocation', type: 'Map<string, number>', description: 'Budget by channel' },
      { name: 'projectedROI', type: 'number', description: 'Expected return' },
    ],
    tags: ['marketing', 'analytics'],
  },
  {
    id: 'dani-messaging-rule',
    type: 'Rule',
    name: 'MessagingRule',
    description: 'Ensures brand consistency across all external communications.',
    agent: 'dani',
    category: 'governance',
    constraint: 'All messaging must align with approved brand guidelines. Consistent tone across channels.',
    policy: 'default',
    inputs: [
      { name: 'communication', type: 'string', required: true, description: 'Draft message' },
      { name: 'brandGuidelines', type: 'Guidelines', required: true, description: 'Brand rules' },
    ],
    outputs: [
      { name: 'compliant', type: 'boolean', description: 'True if compliant' },
      { name: 'suggestions', type: 'string[]', description: 'Improvement suggestions' },
    ],
    tags: ['governance', 'brand', 'deterministic'],
  },
  {
    id: 'dani-marketing-digest',
    type: 'Script',
    name: 'MarketingDigest',
    description: 'Aggregates market insights and campaign performance.',
    agent: 'dani',
    category: 'reporting',
    policy: 'default',
    inputs: [
      { name: 'weeklyMetrics', type: 'MarketingMetrics', required: true, description: 'Weekly performance' },
    ],
    outputs: [
      { name: 'digestMarkdown', type: 'string', description: 'Marketing summary' },
      { name: 'nextActions', type: 'string[]', description: 'Recommended actions' },
    ],
    tags: ['reporting', 'deterministic'],
  },
];

const SOFIA_SKILLS: AgentSkill[] = [
  {
    id: 'sofia-design-system',
    type: 'Skill',
    name: 'DesignSystem',
    description: 'Manages design tokens, component library, and visual coherence.',
    agent: 'sofia',
    category: 'design',
    policy: 'default',
    inputs: [
      { name: 'components', type: 'UIComponent[]', required: true, description: 'Components to audit' },
      { name: 'designTokens', type: 'Token[]', required: true, description: 'Design system tokens' },
    ],
    outputs: [
      { name: 'coherenceScore', type: 'number', description: 'Visual coherence 0-100' },
      { name: 'violations', type: 'Violation[]', description: 'Token violations' },
    ],
    tags: ['design', 'quality-assurance'],
  },
  {
    id: 'sofia-accessibility-rule',
    type: 'Rule',
    name: 'AccessibilityRule',
    description: 'Enforces WCAG 2.1 AA compliance across all interfaces.',
    agent: 'sofia',
    category: 'accessibility',
    constraint: 'All interfaces must meet WCAG 2.1 AA. Color contrast ≥4.5:1 required.',
    policy: 'default',
    inputs: [
      { name: 'uiHierarchy', type: 'UIElement[]', required: true, description: 'UI to audit' },
    ],
    outputs: [
      { name: 'wcagCompliant', type: 'boolean', description: 'True if AA compliant' },
      { name: 'issues', type: 'AccessibilityIssue[]', description: 'Found issues' },
    ],
    tags: ['accessibility', 'compliance', 'deterministic'],
  },
  {
    id: 'sofia-user-test-summary',
    type: 'Script',
    name: 'UserTestSummary',
    description: 'Aggregates user research findings and usability metrics.',
    agent: 'sofia',
    category: 'research',
    policy: 'default',
    inputs: [
      { name: 'testResults', type: 'TestResult[]', required: true, description: 'User test results' },
    ],
    outputs: [
      { name: 'summaryMarkdown', type: 'string', description: 'Research summary' },
      { name: 'usabilityScore', type: 'number', description: 'Usability 0-10' },
      { name: 'recommendations', type: 'string[]', description: 'Design recommendations' },
    ],
    tags: ['research', 'deterministic'],
  },
];

/**
 * Global Skill Registry
 * Centralized repository of all agent capabilities
 */
export const skillRegistry: Map<string, AgentSkill> = new Map([
  // Wave 1: Mira
  ...MIRA_SKILLS.map((s) => [s.id, s] as [string, AgentSkill]),
  // Wave 1: Nora
  ...NORA_SKILLS.map((s) => [s.id, s] as [string, AgentSkill]),
  // Wave 1: Eva
  ...EVA_SKILLS.map((s) => [s.id, s] as [string, AgentSkill]),
  // Wave 1: Julia
  ...JULIA_SKILLS.map((s) => [s.id, s] as [string, AgentSkill]),
  // Wave 2: Elina
  ...ELINA_SKILLS.map((s) => [s.id, s] as [string, AgentSkill]),
  // Wave 2: Maya
  ...MAYA_SKILLS.map((s) => [s.id, s] as [string, AgentSkill]),
  // Wave 2: Lina
  ...LINA_SKILLS.map((s) => [s.id, s] as [string, AgentSkill]),
  // Wave 3: Arya
  ...ARYA_SKILLS.map((s) => [s.id, s] as [string, AgentSkill]),
  // Wave 3: Dani
  ...DANI_SKILLS.map((s) => [s.id, s] as [string, AgentSkill]),
  // Wave 3: Sofia
  ...SOFIA_SKILLS.map((s) => [s.id, s] as [string, AgentSkill]),
]);

/**
 * Skill Registry Service
 */
export const skillRegistryService = {
  getRegistryBackedSkills(): AgentSkill[] {
    const staticSkills = Array.from(skillRegistry.values());
    const markdownSkills: AgentSkill[] = coreRegistryService.listSkills().map((entry) => ({
      id: `registry-${entry.id}`,
      type: 'Skill',
      name: entry.title,
      description: entry.content.split('\n').slice(0, 4).join(' ').trim(),
      agent: 'registry',
      category: 'registry-markdown',
      policy: 'default',
      inputs: [],
      outputs: [],
      tags: entry.tags,
    }));

    return [...staticSkills, ...markdownSkills];
  },

  /**
   * Get a skill by ID
   */
  getSkill(skillId: string): AgentSkill | undefined {
    return this.getRegistryBackedSkills().find((skill) => skill.id === skillId);
  },

  /**
   * Get all skills for an agent
   */
  getAgentSkills(agentId: string): AgentSkill[] {
    return this.getRegistryBackedSkills().filter((skill) => skill.agent === agentId);
  },

  /**
   * Get skills by type (Skill, Rule, Script, Tool)
   */
  getSkillsByType(type: SkillType): AgentSkill[] {
    return this.getRegistryBackedSkills().filter((skill) => skill.type === type);
  },

  /**
   * Get skills by category
   */
  getByCategory(category: string): AgentSkill[] {
    return this.getRegistryBackedSkills().filter((skill) => skill.category === category);
  },

  /**
   * Get skills requiring approval
   */
  getRestrictedSkills(): AgentSkill[] {
    return this.getRegistryBackedSkills().filter(
      (skill) => skill.policy === 'restricted' || skill.policy === 'governance-only' || skill.requiresApproval,
    );
  },

  /**
   * Get public/default skills only
   */
  getPublicSkills(): AgentSkill[] {
    return this.getRegistryBackedSkills().filter((skill) => skill.policy === 'default');
  },

  /**
   * Get skills that match a tag
   */
  getByTag(tag: string): AgentSkill[] {
    return this.getRegistryBackedSkills().filter((skill) => skill.tags.includes(tag));
  },

  /**
   * Register a new skill (for dynamic extensions)
   */
  registerSkill(skill: AgentSkill): void {
    skillRegistry.set(skill.id, skill);
  },

  /**
   * Get all skills
   */
  listAllSkills(): AgentSkill[] {
    return this.getRegistryBackedSkills();
  },

  /**
   * Validate skill inputs
   */
  validateInputs(skill: AgentSkill, inputs: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const input of skill.inputs) {
      if (input.required && !(input.name in inputs)) {
        errors.push(`Missing required input: ${input.name}`);
      }
    }

    return { valid: errors.length === 0, errors };
  },
};
