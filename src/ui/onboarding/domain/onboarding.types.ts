/**
 * Domain Types for Three-Phase Onboarding System
 * Covers: Phase 1 (Personas), Phase 2 (KPIs), Phase 3 (Model Config)
 */

/**
 * ============================================================================
 * PHASE 1: VIRTUAL EMPLOYEE PERSONAS & SKILLS
 * ============================================================================
 */

/**
 * Global Skill Registry Entry
 * References shared skills from docs/virtual-employee/*.md
 */
export interface GlobalSkill {
  skill_id: string;
  skill_name: string;
  source: string; // e.g., "skills/strategic-alignment.md" or "custom:arya"
  description: string;
  category?: 'strategic' | 'tactical' | 'operational' | 'custom';
  tags?: string[];
}

/**
 * Custom Skill (per-employee addition)
 */
export interface CustomSkill extends GlobalSkill {
  source: `custom:${string}`; // e.g., "custom:arya"
  isCustom: true;
}

/**
 * Agent Handshake: Outbound Request
 */
export interface AgentHandshakeRequest {
  agent_id: string;
  agent_name?: string;
  request_type: string;
  description?: string;
}

/**
 * Agent Handshake: Inbound Receipt
 */
export interface AgentHandshakeReceive {
  agent_id: string;
  agent_name?: string;
  request_type: string;
  description?: string;
}

/**
 * Virtual Employee Persona (Phase 1 Output)
 * Represents one of the 10 Virtual Employees (Arya, Nora, Julia, etc.)
 */
export interface VirtualEmployeeProfile {
  id: string; // e.g., "arya", "nora", "julia"
  name: string; // e.g., "Arya Sharma"
  role_title: string; // e.g., "Chief Executive Officer"
  trigger_name: string; // e.g., "@arya"
  trigger_designation: string; // e.g., "@ceo"
  photo_path: string; // e.g., "/resources/arya.png"

  // Phase 1 editable fields
  in_depth_goal: string; // Multi-line goal statement
  in_depth_backstory: string; // Multi-line backstory

  // Skill Registry (global + custom)
  skills: GlobalSkill[];

  // Agent design constraints (immutable)
  agent_designation: string; // e.g., "Executive Strategist & Vision Keeper"
  crisis_protocol_role: string; // Role during crisis (e.g., "Stabilization Authority")

  // Agent Handshakes (immutable, from agent spec)
  can_request_from: AgentHandshakeRequest[];
  receives_from: AgentHandshakeReceive[];

  // Metadata
  created_at?: string; // ISO8601
  updated_at?: string; // ISO8601
}

/**
 * Phase 1 Draft State (UI editing)
 * Volatile state during user editing
 */
export interface Phase1DraftState {
  employees: VirtualEmployeeProfile[];
  selectedEmployeeId?: string;
  isDirty: boolean;
  validationErrors: Record<string, string[]>; // e.g., { "arya.name": ["Name is required"] }
}

/**
 * ============================================================================
 * PHASE 2: COMPANY KPI CONFIGURATION
 * ============================================================================
 */

/**
 * KPI Definition
 */
export interface KpiDefinition {
  id: string;
  name: string;
  category: 'Financial' | 'Growth' | 'Engineering' | 'Operations' | 'Sales' | 'Custom';
  unit: string; // e.g., "USD", "count", "score (0-100)"
  target: number;
  alert_threshold: number;
  crisis_threshold: number;
  evaluation_frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
  owner_agent: string; // e.g., "nora", "dani", "julia"
  description: string;
  source?: 'template' | 'custom'; // New KPIs are "custom"
}

/**
 * Company KPI Registry (Phase 2 Output)
 * Master list of all KPIs for the company
 */
export interface CompanyKpiRegistry {
  company_name: string;
  kpi_version: string;
  created_at: string; // ISO8601
  last_updated_at: string; // ISO8601
  kpis: KpiDefinition[];
}

/**
 * KPI Template (predefined starting point)
 */
export interface KpiTemplate {
  id: string;
  name: string;
  description: string;
  company_stage: 'seed' | 'series-a' | 'series-b' | 'enterprise';
  kpis: Array<Omit<KpiDefinition, 'owner_agent'> & { suggested_owner_agent?: string }>;
}

/**
 * Phase 2 Draft State (UI editing)
 */
export interface Phase2DraftState {
  templateSelected?: string;
  companyName?: string;
  kpis: KpiDefinition[];
  isDirty: boolean;
  validationErrors: Record<string, string[]>;
}

/**
 * ============================================================================
 * PHASE 3: LOCAL MODEL CONFIGURATION (PRIVACY LAYER)
 * ============================================================================
 */

/**
 * Model Provider Configuration
 */
export interface ModelProviderConfig {
  enabled: boolean;
  endpoint: string; // e.g., "http://localhost:1234/v1"
  model: string; // e.g., "mistral-7b-instruct"
  api_key: string; // Sensitive
  contextWindow?: number; // Model-specific context window in tokens (optional user override)
  reservedOutputTokens?: number; // Reserved for model output in tokens (optional user override)
  fallback_to?: string; // e.g., "openrouter" (next provider to try)
}

/**
 * Execution Policy for Model Invocations
 */
export interface ExecutionPolicy {
  timeout_seconds: number;
  max_retries: number;
  cache_responses: boolean;
}

/**
 * Local Model Access Configuration (Phase 3 Output)
 * Stored in ~/.prana/governance/models/local.json (NOT in Git)
 * Contains sensitive data (API keys)
 */
export interface LocalModelAccessConfig {
  model_version: string;
  created_at: string; // ISO8601
  primary_provider: 'lmstudio' | 'openrouter' | 'gemini';
  providers: {
    lmstudio: ModelProviderConfig;
    openrouter: ModelProviderConfig;
    gemini: ModelProviderConfig;
  };
  execution_policy: ExecutionPolicy;
}

/**
 * Phase 3 Draft State (UI editing)
 */
export interface Phase3DraftState {
  primaryProvider: 'lmstudio' | 'openrouter' | 'gemini';
  providers: {
    lmstudio: ModelProviderConfig;
    openrouter: ModelProviderConfig;
    gemini: ModelProviderConfig;
  };
  executionPolicy: ExecutionPolicy;
  isDirty: boolean;
  validationErrors: Record<string, string[]>;
  testConnectionResults?: Record<string, boolean>; // e.g., { "lmstudio": true }
}

/**
 * ============================================================================
 * UNIFIED ONBOARDING STATE (ALL 3 PHASES)
 * ============================================================================
 */

/**
 * Overall Onboarding Status
 */
export type OnboardingPhaseStatus = 'not-started' | 'in-progress' | 'committed' | 'locked';

/**
 * Master Onboarding State (Zustand / Context)
 */
export interface OnboardingState {
  // Phase tracking
  phase1: {
    status: OnboardingPhaseStatus;
    draft: Phase1DraftState;
  };
  phase2: {
    status: OnboardingPhaseStatus;
    draft: Phase2DraftState;
  };
  phase3: {
    status: OnboardingPhaseStatus;
    draft: Phase3DraftState;
  };

  // Overall flags
  isOnboardingComplete: boolean;
  currentPhase: 1 | 2 | 3; // Currently viewing phase
  commitError?: string;
  isCommitting: boolean;

  // Operations
  updatePhase1Draft: (draft: Partial<Phase1DraftState>) => void;
  updatePhase2Draft: (draft: Partial<Phase2DraftState>) => void;
  updatePhase3Draft: (draft: Partial<Phase3DraftState>) => void;
  commitPhase1: () => Promise<void>;
  commitPhase2: () => Promise<void>;
  commitPhase3: () => Promise<void>;
  finalizeOnboarding: () => Promise<void>;
  resetOnboarding: () => void;
}

/**
 * ============================================================================
 * REPOSITORY / SERIALIZATION TYPES
 * ============================================================================
 */

/**
 * Phase 1 Serialization (YAML format)
 * This is written to ~/.prana/governance/agents/profiles.md
 */
export interface Phase1SerializedPayload {
  virtual_employees: VirtualEmployeeProfile[];
  meta: {
    version: string;
    created_at: string;
    updated_at: string;
  };
}

/**
 * Phase 2 Serialization (JSON format)
 * This is written to ~/.prana/governance/kpi/registry.json
 */
export type Phase2SerializedPayload = CompanyKpiRegistry;

/**
 * Phase 3 Serialization (JSON format)
 * This is written to ~/.prana/governance/models/local.json (NOT in Git)
 */
export type Phase3SerializedPayload = LocalModelAccessConfig;

/**
 * ============================================================================
 * VALIDATION & SCHEMA TYPES
 * ============================================================================
 */

/**
 * Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>; // Field -> Error messages
}

/**
 * File Operation Result
 */
export interface FileOperationResult {
  success: boolean;
  path: string;
  error?: string;
}
