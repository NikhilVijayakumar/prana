/**
 * Onboarding Repository Layer
 * Handles: File I/O, Git operations, serialization/deserialization
 * For all 3 phases
 */

import { ApiService } from 'astra';
import {
  VirtualEmployeeProfile,
  Phase1SerializedPayload,
  CompanyKpiRegistry,
  LocalModelAccessConfig,
  FileOperationResult,
} from '../domain/onboarding.types';

const PHASE1_FILE_HINT = '~/.prana/governance/agents/profiles.md';
const PHASE2_FILE_HINT = '~/.prana/governance/kpi/registry.json';
const PHASE3_FILE_HINT = '~/.prana/governance/models/local.json';

/**
 * OnboardingRepository Protocol
 * Defines the contract for reading/writing onboarding data
 */
export interface IOnboardingRepository {
  /**
   * Phase 1: Virtual Employee Profiles
   */
  loadPhase1Profiles(): Promise<VirtualEmployeeProfile[] | null>;
  savePhase1Profiles(employees: VirtualEmployeeProfile[]): Promise<FileOperationResult>;
  loadPhase1Yaml(): Promise<string | null>;
  savePhase1Yaml(yaml: string): Promise<FileOperationResult>;

  /**
   * Phase 2: KPI Registry
   */
  loadPhase2Kpis(): Promise<CompanyKpiRegistry | null>;
  savePhase2Kpis(kpis: CompanyKpiRegistry): Promise<FileOperationResult>;

  /**
   * Phase 3: Local Model Configuration
   */
  loadPhase3ModelConfig(): Promise<LocalModelAccessConfig | null>;
  savePhase3ModelConfig(config: LocalModelAccessConfig): Promise<FileOperationResult>;

  /**
   * Global Skills Registry (from docs/virtual-employee/)
   */
  loadGlobalSkills(): Promise<Map<string, string>>; // skillId -> markdown content

  /**
   * Git Operations
   */
  commitPhase1ToGit(message: string): Promise<FileOperationResult>;
  commitPhase2ToGit(message: string): Promise<FileOperationResult>;
}

/**
 * Implementation: OnboardingRepository
 * Uses IPC to communicate with Electron main process for file I/O
 */
export class OnboardingRepository implements IOnboardingRepository {
  public constructor(private api: ApiService) {}

  /**
   * =========================================================================
   * PHASE 1: VIRTUAL EMPLOYEE PROFILES
   * =========================================================================
   */

  async loadPhase1Profiles(): Promise<VirtualEmployeeProfile[] | null> {
    try {
      const response = await this.api.post<VirtualEmployeeProfile[] | null>(
        '/ipc/onboarding/phase1/load-profiles',
        {}
      );
      return response.data || null;
    } catch (error) {
      console.error('[OnboardingRepo] Failed to load Phase 1 profiles:', error);
      return null;
    }
  }

  async savePhase1Profiles(employees: VirtualEmployeeProfile[]): Promise<FileOperationResult> {
    try {
      const payload: Phase1SerializedPayload = {
        virtual_employees: employees,
        meta: {
          version: '1.0',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const response = await this.api.post<FileOperationResult>(
        '/ipc/onboarding/phase1/save-profiles',
        { payload }
      );
      return response.data || { success: false, path: '', error: 'No response' };
    } catch (error) {
      return {
        success: false,
        path: PHASE1_FILE_HINT,
        error: String(error),
      };
    }
  }

  async loadPhase1Yaml(): Promise<string | null> {
    try {
      const response = await this.api.post<string | null>(
        '/ipc/onboarding/phase1/load-yaml',
        {}
      );
      return response.data || null;
    } catch (error) {
      console.error('[OnboardingRepo] Failed to load Phase 1 YAML:', error);
      return null;
    }
  }

  async savePhase1Yaml(yaml: string): Promise<FileOperationResult> {
    try {
      const response = await this.api.post<FileOperationResult>(
        '/ipc/onboarding/phase1/save-yaml',
        { yaml }
      );
      return response.data || { success: false, path: '', error: 'No response' };
    } catch (error) {
      return {
        success: false,
        path: PHASE1_FILE_HINT,
        error: String(error),
      };
    }
  }

  /**
   * =========================================================================
   * PHASE 2: KPI REGISTRY
   * =========================================================================
   */

  async loadPhase2Kpis(): Promise<CompanyKpiRegistry | null> {
    try {
      const response = await this.api.post<CompanyKpiRegistry | null>(
        '/ipc/onboarding/phase2/load-kpis',
        {}
      );
      return response.data || null;
    } catch (error) {
      console.error('[OnboardingRepo] Failed to load Phase 2 KPIs:', error);
      return null;
    }
  }

  async savePhase2Kpis(kpis: CompanyKpiRegistry): Promise<FileOperationResult> {
    try {
      const response = await this.api.post<FileOperationResult>(
        '/ipc/onboarding/phase2/save-kpis',
        { payload: kpis }
      );
      return response.data || { success: false, path: '', error: 'No response' };
    } catch (error) {
      return {
        success: false,
        path: PHASE2_FILE_HINT,
        error: String(error),
      };
    }
  }

  /**
   * =========================================================================
   * PHASE 3: LOCAL MODEL CONFIGURATION
   * =========================================================================
   */

  async loadPhase3ModelConfig(): Promise<LocalModelAccessConfig | null> {
    try {
      const response = await this.api.post<LocalModelAccessConfig | null>(
        '/ipc/onboarding/phase3/load-model-config',
        {}
      );
      return response.data || null;
    } catch (error) {
      console.error('[OnboardingRepo] Failed to load Phase 3 model config:', error);
      return null;
    }
  }

  async savePhase3ModelConfig(config: LocalModelAccessConfig): Promise<FileOperationResult> {
    try {
      const response = await this.api.post<FileOperationResult>(
        '/ipc/onboarding/phase3/save-model-config',
        { payload: config }
      );
      return response.data || { success: false, path: '', error: 'No response' };
    } catch (error) {
      return {
        success: false,
        path: PHASE3_FILE_HINT,
        error: String(error),
      };
    }
  }

  /**
   * =========================================================================
   * GLOBAL SKILLS REGISTRY
   * =========================================================================
   */

  async loadGlobalSkills(): Promise<Map<string, string>> {
    try {
      const response = await this.api.post<Record<string, string>>(
        '/ipc/onboarding/skills/load-registry',
        {}
      );
      return new Map(Object.entries(response.data || {}));
    } catch (error) {
      console.error('[OnboardingRepo] Failed to load global skills:', error);
      return new Map();
    }
  }

  /**
   * =========================================================================
   * GIT OPERATIONS
   * =========================================================================
   */

  async commitPhase1ToGit(message: string): Promise<FileOperationResult> {
    try {
      const response = await this.api.post<FileOperationResult>(
        '/ipc/onboarding/git/commit-phase1',
        { message }
      );
      return response.data || { success: false, path: '', error: 'No response' };
    } catch (error) {
      return {
        success: false,
        path: PHASE1_FILE_HINT,
        error: String(error),
      };
    }
  }

  async commitPhase2ToGit(message: string): Promise<FileOperationResult> {
    try {
      const response = await this.api.post<FileOperationResult>(
        '/ipc/onboarding/git/commit-phase2',
        { message }
      );
      return response.data || { success: false, path: '', error: 'No response' };
    } catch (error) {
      return {
        success: false,
        path: PHASE2_FILE_HINT,
        error: String(error),
      };
    }
  }
}

/**
 * Factory for creating OnboardingRepository
 */
export function createOnboardingRepository(api: ApiService): IOnboardingRepository {
  return new OnboardingRepository(api);
}
