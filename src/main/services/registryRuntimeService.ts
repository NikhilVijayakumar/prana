import { resolve } from 'node:path';

export interface RegistrySnapshot {
  version: string;
  loadedAt: string;
  onboarding?: Record<string, unknown>;
  agents: RegistryAgentTemplate[];
  kpiRequirements: Array<{
    minimumRequirements: RegistryKpiMinimumRequirementEntry[];
    [key: string]: unknown;
  }>;
  skills: RegistrySkillDoc[];
  kpis: RegistryKpiDefinition[];
  dataInputs: RegistryDataInputDefinition[];
  [key: string]: unknown;
}

export interface RegistryAgentTemplate {
  uid: string;
  goal?: string;
  backstory?: string;
  objectives_long_term?: string[];
  personality_traits?: string[];
  interaction_style?: string;
  skills?: string[];
  kpis?: string[];
  [key: string]: unknown;
}

export interface RegistryKpiRequirementField {
  key: string;
  quality: 'required' | 'optional';
  minWords: number;
}

export interface RegistryKpiMinimumRequirementEntry {
  stepId: string;
  requiredFields: RegistryKpiRequirementField[];
  [key: string]: unknown;
}

export interface RegistrySkillDoc {
  id: string;
  title: string;
  content: string;
  tags: string[];
  [key: string]: unknown;
}

export interface RegistryKpiDefinition {
  uid: string;
  name: string;
  description: string;
  unit: string;
  target: string;
  value: string;
  [key: string]: unknown;
}

export interface RegistryDataInputFieldObject {
  name: string;
}

export interface RegistryDataInputDefinition {
  uid: string;
  name: string;
  description: string;
  schemaType:
    | 'document'
    | 'tabular'
    | 'event-stream'
    | 'timeseries'
    | 'identity-protocol'
    | 'intelligence-protocol'
    | 'manifest-schema'
    | 'audit-trail';
  sampleSource: string;
  requiredFields: Array<string | RegistryDataInputFieldObject>;
  [key: string]: unknown;
}

export interface RegistryVersionInfo {
  version: string;
  loadedAt: string;
  fingerprint: string;
  hasExternalChanges: boolean;
}

export interface RegistrySnapshotLoadResult {
  fingerprint: string;
  snapshot: RegistrySnapshot;
}

export interface RegistryRuntimeConfig {
  registryRoot: string;
  getRegistryFileFingerprint?: () => string;
  loadRegistrySnapshot?: (versionCounter: number) => RegistrySnapshotLoadResult;
}

const createEmptySnapshot = (versionCounter = 0): RegistrySnapshot => ({
  version: `local-${versionCounter}`,
  loadedAt: new Date().toISOString(),
  onboarding: {},
  agents: [],
  kpiRequirements: [],
  skills: [],
  kpis: [],
  dataInputs: [],
});

let runtimeConfig: RegistryRuntimeConfig = {
  registryRoot: resolve(process.cwd(), '.dhi', 'registry'),
  getRegistryFileFingerprint: () => 'local-default-fingerprint',
  loadRegistrySnapshot: (versionCounter: number) => ({
    fingerprint: `local-default-${versionCounter}`,
    snapshot: createEmptySnapshot(versionCounter),
  }),
};

export const configureRegistryRuntime = (config: Partial<RegistryRuntimeConfig>): void => {
  runtimeConfig = {
    ...runtimeConfig,
    ...config,
    registryRoot: config.registryRoot ? resolve(config.registryRoot) : runtimeConfig.registryRoot,
  };
};

export const getRegistryRuntimeConfig = (): RegistryRuntimeConfig => runtimeConfig;
