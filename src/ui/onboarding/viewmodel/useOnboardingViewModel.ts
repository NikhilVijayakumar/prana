import { useCallback, useEffect, useMemo, useState } from 'react';
import { OnboardingRepo } from '../repo/OnboardingRepo';
import { volatileSessionStore } from 'prana/ui/state/volatileSessionStore';
import { LifecycleProfileDraft, useLifecycle } from 'prana/ui/state/LifecycleProvider';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

// Type stubs for registry (module not yet implemented)
interface FieldSchemaRule {
  key: string;
  mandatoryForEfficiency: boolean;
  guidance: string;
  exampleText?: string;
  minWords?: number;
}

interface OnboardingBlueprintSnapshot {
  fieldSchema?: Record<string, FieldSchemaRule[]>;
  initialDrafts?: Record<string, DynamicFieldRecord[]>;
}

interface RegistrySnapshot {
  agents?: Array<{ uid: string; protocols?: string[]; workflows?: string[] }>;
}

const getRegistryAgents = () => [];
const getRegistryKpis = () => [];
const getOnboardingFieldSchema = (_agents: unknown[], _kpis: unknown[]): Record<string, FieldSchemaRule[]> => ({});
const getOnboardingInitialDraftByStep = (_agents: unknown[], _kpis: unknown[]): Record<string, DynamicFieldRecord[]> => ({
  'company-core': [],
  'product-context': [],
  'global-assets': [],
  'global-guardrails': [],
  'agent-profile-persona': [],
  'agent-workflows': [],
  'infrastructure-finalization': [],
});

export type OnboardingStepKind = 'dynamic-form' | 'infrastructure-finalization';
export type OnboardingEntityStatus = 'PENDING' | 'DRAFT' | 'APPROVED';

export interface PhaseTrackerStatus {
  state: 'LOCKED' | 'DRAFT' | 'VALIDATED' | 'APPROVED';
  requiresReverification: boolean;
}

export interface OnboardingStepConfig {
  id: string;
  titleKey: string;
  bodyKey: string;
  kind: OnboardingStepKind;
  requiresInput: boolean;
}

export interface ModelProviderDraft {
  enabled: boolean;
  endpoint: string;
  model: string;
  apiKey: string;
  contextWindow?: number;
  reservedOutputTokens?: number;
}

export interface ModelAccessDraft {
  lmstudio: ModelProviderDraft;
  openrouter: ModelProviderDraft;
  gemini: ModelProviderDraft;
}

export interface DynamicFieldRecord {
  key: string;
  value: string;
}

export interface FieldValidationStatus {
  key: string;
  mandatoryForEfficiency: boolean;
  guidance: string;
  isValid: boolean;
  isPopulated: boolean;
  message?: string;
}

export interface ProfileAlignmentWarning {
  field: 'goal' | 'backstory' | 'skills' | 'kpis';
  message: string;
}

const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: 'company-core',
    titleKey: 'onboarding.step1.title',
    bodyKey: 'onboarding.step1.body',
    kind: 'dynamic-form',
    requiresInput: true,
  },
  {
    id: 'product-context',
    titleKey: 'onboarding.step2.title',
    bodyKey: 'onboarding.step2.body',
    kind: 'dynamic-form',
    requiresInput: true,
  },
  {
    id: 'global-assets',
    titleKey: 'onboarding.step3.title',
    bodyKey: 'onboarding.step3.body',
    kind: 'dynamic-form',
    requiresInput: true,
  },
  {
    id: 'global-guardrails',
    titleKey: 'onboarding.step4.title',
    bodyKey: 'onboarding.step4.body',
    kind: 'dynamic-form',
    requiresInput: true,
  },
  {
    id: 'agent-profile-persona',
    titleKey: 'onboarding.step5.title',
    bodyKey: 'onboarding.step5.body',
    kind: 'dynamic-form',
    requiresInput: true,
  },
  {
    id: 'agent-workflows',
    titleKey: 'onboarding.step6.title',
    bodyKey: 'onboarding.step6.body',
    kind: 'dynamic-form',
    requiresInput: true,
  },
  {
    id: 'infrastructure-finalization',
    titleKey: 'onboarding.step7.title',
    bodyKey: 'onboarding.step7.body',
    kind: 'infrastructure-finalization',
    requiresInput: true,
  },
];

const createEmptyModelProvider = (endpoint: string, model: string): ModelProviderDraft => ({
  enabled: false,
  endpoint,
  model,
  apiKey: '',
});

const createInitialModelAccessDraft = (): ModelAccessDraft => ({
  lmstudio: createEmptyModelProvider('http://localhost:1234/v1', 'local-model'),
  openrouter: createEmptyModelProvider('https://openrouter.ai/api/v1', 'openai/gpt-4o-mini'),
  gemini: createEmptyModelProvider('https://generativelanguage.googleapis.com/v1beta', 'gemini-1.5-flash'),
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return fallback;
};

const toString = (value: unknown, fallback: string): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
};

const coerceProviderDraft = (candidate: unknown, fallback: ModelProviderDraft): ModelProviderDraft => {
  if (!isRecord(candidate)) {
    return fallback;
  }

  return {
    enabled: toBoolean(candidate.enabled, fallback.enabled),
    endpoint: toString(candidate.endpoint, fallback.endpoint),
    model: toString(candidate.model, fallback.model),
    apiKey: toString(candidate.apiKey, fallback.apiKey),
    contextWindow: toOptionalNumber(candidate.contextWindow),
    reservedOutputTokens: toOptionalNumber(candidate.reservedOutputTokens),
  };
};

const coerceModelAccessDraft = (candidate: unknown): ModelAccessDraft | null => {
  if (!isRecord(candidate)) {
    return null;
  }

  const fallback = createInitialModelAccessDraft();
  return {
    lmstudio: coerceProviderDraft(candidate.lmstudio, fallback.lmstudio),
    openrouter: coerceProviderDraft(candidate.openrouter, fallback.openrouter),
    gemini: coerceProviderDraft(candidate.gemini, fallback.gemini),
  };
};

const DEFAULT_REGISTRY_AGENTS = getRegistryAgents();
const DEFAULT_REGISTRY_KPIS = getRegistryKpis();
const DEFAULT_FIELD_SCHEMA_BY_STEP: Record<string, FieldSchemaRule[]> = getOnboardingFieldSchema(
  DEFAULT_REGISTRY_AGENTS,
  DEFAULT_REGISTRY_KPIS,
);

const STEP_DEPENDENCIES: Record<string, string[]> = {
  'company-core': [],
  'product-context': ['company-core'],
  'global-assets': ['company-core', 'product-context'],
  'global-guardrails': ['company-core', 'product-context', 'global-assets'],
  'agent-profile-persona': ['company-core', 'product-context', 'global-assets', 'global-guardrails'],
  'agent-workflows': ['company-core', 'product-context', 'global-assets', 'global-guardrails', 'agent-profile-persona'],
  'infrastructure-finalization': [
    'company-core',
    'product-context',
    'global-assets',
    'global-guardrails',
    'agent-profile-persona',
    'agent-workflows',
  ],
};

const getDownstreamSteps = (sourceStepId: string): string[] => {
  const visited = new Set<string>();
  const stack = [sourceStepId];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const step of ONBOARDING_STEPS) {
      const dependencies = STEP_DEPENDENCIES[step.id] ?? [];
      if (!dependencies.includes(current) || visited.has(step.id) || step.id === sourceStepId) {
        continue;
      }
      visited.add(step.id);
      stack.push(step.id);
    }
  }

  return Array.from(visited);
};

const countWords = (value: string): number => {
  return value
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0).length;
};

const tokenize = (value: string): string[] => {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 5);
};

const countTokenOverlap = (reference: string, candidate: string): number => {
  const referenceTokens = new Set(tokenize(reference));
  const candidateTokens = new Set(tokenize(candidate));

  let overlap = 0;
  candidateTokens.forEach((token) => {
    if (referenceTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap;
};

const buildProfileAlignmentWarnings = (
  profile: LifecycleProfileDraft,
  companyVision: string,
  companyNonNegotiables: string,
): ProfileAlignmentWarning[] => {
  const warnings: ProfileAlignmentWarning[] = [];

  const goalOverlap = countTokenOverlap(companyVision, profile.goal);
  if (goalOverlap < 2) {
    warnings.push({
      field: 'goal',
      message: `Goal alignment is weak (${goalOverlap} shared business keywords).`,
    });
  }

  const backstoryOverlap = countTokenOverlap(companyVision, profile.backstory);
  if (backstoryOverlap < 2) {
    warnings.push({
      field: 'backstory',
      message: `Backstory alignment is weak (${backstoryOverlap} shared business keywords).`,
    });
  }

  const lowerSkills = profile.skills.join(' ').toLowerCase();
  const hasTrackSeparationSkill = lowerSkills.includes('separation') || lowerSkills.includes('governance');
  if (!hasTrackSeparationSkill) {
    warnings.push({
      field: 'skills',
      message: 'Skills should include at least one governance or track-separation capability.',
    });
  }

  const kpiText = profile.kpis.join(' ').toLowerCase();
  const requiresHumanReview = companyNonNegotiables.toLowerCase().includes('human review');
  if (requiresHumanReview && !kpiText.includes('human-review')) {
    warnings.push({
      field: 'kpis',
      message: 'KPI set should include a human-review gate metric.',
    });
  }

  return warnings;
};

const createInitialDraftByStep = (): Record<string, DynamicFieldRecord[]> => {
  const liveDraft = getOnboardingInitialDraftByStep(DEFAULT_REGISTRY_AGENTS, DEFAULT_REGISTRY_KPIS);
  return {
    ...liveDraft,
    'company-core': liveDraft['company-core'] ?? [{ key: '', value: '' }],
    'product-context': liveDraft['product-context'] ?? [{ key: '', value: '' }],
    'global-assets': liveDraft['global-assets'] ?? [{ key: '', value: '' }],
    'global-guardrails': liveDraft['global-guardrails'] ?? [{ key: '', value: '' }],
    'agent-profile-persona': liveDraft['agent-profile-persona'] ?? [{ key: '', value: '' }],
    'agent-workflows': liveDraft['agent-workflows'] ?? [{ key: '', value: '' }],
    'infrastructure-finalization': liveDraft['infrastructure-finalization'] ?? [{ key: '', value: '' }],
  };
};

const normalizeJsonEntryValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  return JSON.stringify(value);
};

const toFieldMap = (records: DynamicFieldRecord[]): Record<string, string> => {
  return records.reduce<Record<string, string>>((acc, record) => {
    const nextKey = record.key.trim();
    if (nextKey.length === 0) {
      return acc;
    }
    acc[nextKey] = record.value;
    return acc;
  }, {});
};

const toDisplayFields = (source: Record<string, string>): DynamicFieldRecord[] => {
  const entries = Object.entries(source);
  if (entries.length === 0) {
    return [{ key: '', value: '' }];
  }

  return entries.map(([key, value]) => ({ key, value }));
};

const toVirtualEmployeeFields = (profiles: LifecycleProfileDraft[]): DynamicFieldRecord[] => {
  return profiles.flatMap((profile) => [
    {
      key: `${profile.agentId}.core_objective`,
      value: profile.goal,
    },
    {
      key: `${profile.agentId}.individual_vision`,
      value: profile.goal,
    },
    {
      key: `${profile.agentId}.role_non_negotiable_requirements`,
      value: 'Align with company vision and approved protocols',
    },
    {
      key: `${profile.agentId}.goal`,
      value: profile.goal,
    },
    {
      key: `${profile.agentId}.backstory`,
      value: profile.backstory,
    },
    {
      key: `${profile.agentId}.skills`,
      value: profile.skills.join(', '),
    },
    {
      key: `${profile.agentId}.required_kpis`,
      value: profile.kpis.join(', '),
    },
  ]);
};

const hasMeaningfulFields = (fields: DynamicFieldRecord[]): boolean => {
  return fields.some((field) => field.key.trim().length > 0 && field.value.trim().length > 0);
};

const getFieldValueByKey = (fields: DynamicFieldRecord[], key: string): string => {
  const matching = fields.find((field) => field.key.trim() === key);
  return matching?.value ?? '';
};

const validateRuleValue = (value: string, rule: FieldSchemaRule): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return rule.mandatoryForEfficiency ? 'Missing mandatory field' : null;
  }

  if (rule.exampleText && trimmed === rule.exampleText.trim()) {
    return 'Replace example text with your company-specific perspective';
  }

  if (rule.minWords && countWords(trimmed) < rule.minWords) {
    return `Add more depth (${rule.minWords}+ words recommended)`;
  }

  return null;
};

const evaluateStepValidation = (
  fieldSchemaByStep: Record<string, FieldSchemaRule[]>,
  stepId: string,
  fields: DynamicFieldRecord[],
): FieldValidationStatus[] => {
  const schema = fieldSchemaByStep[stepId] ?? [];
  if (schema.length === 0) {
    return [];
  }

  return schema.map((rule) => {
    const value = getFieldValueByKey(fields, rule.key);
    const error = validateRuleValue(value, rule);
    return {
      key: rule.key,
      mandatoryForEfficiency: rule.mandatoryForEfficiency,
      guidance: rule.guidance,
      isValid: error === null,
      isPopulated: value.trim().length > 0,
      message: error ?? undefined,
    };
  });
};

const isStepReady = (
  fieldSchemaByStep: Record<string, FieldSchemaRule[]>,
  stepId: string,
  fields: DynamicFieldRecord[],
): boolean => {
  const statuses = evaluateStepValidation(fieldSchemaByStep, stepId, fields);
  if (statuses.length === 0) {
    return hasMeaningfulFields(fields);
  }

  return statuses.every((status) => !status.mandatoryForEfficiency || status.isValid);
};

export const useOnboardingViewModel = (onComplete: () => void) => {
  const repo = useMemo(() => new OnboardingRepo(), []);
  const lifecycle = useLifecycle();
  const [fieldSchemaByStep, setFieldSchemaByStep] = useState<Record<string, FieldSchemaRule[]>>(
    DEFAULT_FIELD_SCHEMA_BY_STEP,
  );
  const [registryAgentBindings, setRegistryAgentBindings] = useState<
    Record<string, { protocols: string[]; workflows: string[] }>
  >({});
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [draftByStep, setDraftByStep] = useState<Record<string, DynamicFieldRecord[]>>(createInitialDraftByStep);
  const [approvalByStep, setApprovalByStep] = useState<Record<string, OnboardingEntityStatus>>(() => {
    return ONBOARDING_STEPS.reduce<Record<string, OnboardingEntityStatus>>((acc, step) => {
      acc[step.id] = 'PENDING';
      return acc;
    }, {});
  });
  const [reverificationByStep, setReverificationByStep] = useState<Record<string, boolean>>(() => {
    return ONBOARDING_STEPS.reduce<Record<string, boolean>>((acc, step) => {
      acc[step.id] = false;
      return acc;
    }, {});
  });
  const [modelAccess, setModelAccess] = useState<ModelAccessDraft>(createInitialModelAccessDraft);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [selectedVirtualProfileId, setSelectedVirtualProfileId] = useState<string>('');
  const [isStageHydrated, setIsStageHydrated] = useState<boolean>(false);

  const totalSteps = ONBOARDING_STEPS.length;
  const currentStepConfig = ONBOARDING_STEPS[currentStep];

  const currentStepFields = draftByStep[currentStepConfig.id] ?? [{ key: '', value: '' }];

  useEffect(() => {
    const hydrateFromRegistry = async (): Promise<void> => {
      try {
        const blueprint = await safeIpcCall<OnboardingBlueprintSnapshot>(
          'registry.getOnboardingBlueprint',
          () => window.api.registry.getOnboardingBlueprint(),
          (value) => typeof value === 'object' && value !== null,
        );
        const liveFieldSchema = blueprint.fieldSchema;
        const liveInitialDrafts = blueprint.initialDrafts;

        if (liveFieldSchema && typeof liveFieldSchema === 'object') {
          setFieldSchemaByStep(liveFieldSchema);
        }

        if (liveInitialDrafts && typeof liveInitialDrafts === 'object') {
          setDraftByStep((prev) => ({
            ...prev,
            ...liveInitialDrafts,
          }));
        }

        const snapshot = await safeIpcCall<RegistrySnapshot>(
          'registry.getSnapshot',
          () => window.api.registry.getSnapshot(),
          (value) => typeof value === 'object' && value !== null,
        );
        const agentsArray = snapshot.agents ?? [];
        const bindings = agentsArray.reduce<Record<string, { protocols: string[]; workflows: string[] }>>(
          (acc, agent) => {
            acc[agent.uid] = {
              protocols: agent.protocols ?? [],
              workflows: agent.workflows ?? [],
            };
            return acc;
          },
          {},
        );
        setRegistryAgentBindings(bindings);

        const staged = await repo.getOnboardingStageSnapshot();
        const stagedPayload = staged.data;
        if (stagedPayload) {
          setDraftByStep((prev) => {
            const next = { ...prev };
            for (const [stepId, stage] of Object.entries(stagedPayload.phases ?? {})) {
              const existsInFlow = ONBOARDING_STEPS.some((entry) => entry.id === stepId);
              if (!existsInFlow) {
                continue;
              }
              next[stepId] = toDisplayFields(stage.contextByKey ?? {});
            }
            return next;
          });

          setApprovalByStep((prev) => {
            const next = { ...prev };
            for (const [stepId, stage] of Object.entries(stagedPayload.phases ?? {})) {
              if (ONBOARDING_STEPS.some((entry) => entry.id === stepId)) {
                next[stepId] = stage.status;
              }
            }
            return next;
          });

          setReverificationByStep((prev) => {
            const next = { ...prev };
            for (const [stepId, stage] of Object.entries(stagedPayload.phases ?? {})) {
              if (ONBOARDING_STEPS.some((entry) => entry.id === stepId)) {
                next[stepId] = stage.requiresReverification;
              }
            }
            return next;
          });

          if (
            typeof stagedPayload.currentStep === 'number' &&
            stagedPayload.currentStep >= 0 &&
            stagedPayload.currentStep <= ONBOARDING_STEPS.length - 1
          ) {
            setCurrentStep(stagedPayload.currentStep);
          }

          const hydratedModel = coerceModelAccessDraft(stagedPayload.modelAccess);
          if (hydratedModel) {
            setModelAccess(hydratedModel);
          }
        }
      } catch {
        // Fall back to bundled shared registry if IPC snapshot is unavailable.
      } finally {
        setIsStageHydrated(true);
      }
    };

    void hydrateFromRegistry();
  }, [repo]);

  useEffect(() => {
    if (lifecycle.profiles.length === 0) {
      return;
    }

    setDraftByStep((prev) => {
      const existing = prev['agent-profile-persona'] ?? [];
      if (hasMeaningfulFields(existing)) {
        return prev;
      }

      return {
        ...prev,
        'agent-profile-persona': toVirtualEmployeeFields(lifecycle.profiles),
      };
    });

    setSelectedVirtualProfileId((current) => current || lifecycle.profiles[0].agentId);
  }, [lifecycle.profiles]);

  useEffect(() => {
    if (!isStageHydrated) {
      return;
    }

    const persistStageSnapshot = async (): Promise<void> => {
      const phases = ONBOARDING_STEPS.reduce<Record<string, {
        status: 'PENDING' | 'DRAFT' | 'APPROVED';
        contextByKey: Record<string, string>;
        requiresReverification: boolean;
      }>>((acc, step) => {
        acc[step.id] = {
          status: approvalByStep[step.id] ?? 'PENDING',
          contextByKey: toFieldMap(draftByStep[step.id] ?? []),
          requiresReverification: reverificationByStep[step.id] ?? false,
        };
        return acc;
      }, {});

      await repo.saveOnboardingStageSnapshot({
        phases,
        currentStep,
        modelAccess: modelAccess as unknown as Record<string, unknown>,
      });
    };

    void persistStageSnapshot();
  }, [approvalByStep, currentStep, draftByStep, isStageHydrated, modelAccess, repo, reverificationByStep]);

  const currentStepValidation = useMemo(() => {
    return evaluateStepValidation(fieldSchemaByStep, currentStepConfig.id, currentStepFields);
  }, [currentStepConfig.id, currentStepFields, fieldSchemaByStep]);

  const profileAlignmentByAgent = useMemo(() => {
    const companyCoreDraft = toFieldMap(draftByStep['company-core'] ?? []);
    const companyVision = companyCoreDraft.company_vision ?? '';
    const companyNonNegotiables = companyCoreDraft.global_non_negotiables ?? '';

    return lifecycle.profiles.reduce<Record<string, ProfileAlignmentWarning[]>>((acc, profile) => {
      acc[profile.agentId] = buildProfileAlignmentWarnings(profile, companyVision, companyNonNegotiables);
      return acc;
    }, {});
  }, [draftByStep, lifecycle.profiles]);

  const guidanceByFieldKey = useMemo(() => {
    return currentStepValidation.reduce<Record<string, string>>((acc, item) => {
      acc[item.key] = item.guidance;
      return acc;
    }, {});
  }, [currentStepValidation]);

  const statusByFieldKey = useMemo(() => {
    return currentStepValidation.reduce<Record<string, FieldValidationStatus>>((acc, item) => {
      acc[item.key] = item;
      return acc;
    }, {});
  }, [currentStepValidation]);

  const canGoNext = useMemo(() => {
    return currentStep < totalSteps - 1;
  }, [currentStep, totalSteps]);

  const markDownstreamForReverification = useCallback((sourceStepId: string) => {
    const downstream = getDownstreamSteps(sourceStepId);
    if (downstream.length === 0) {
      return;
    }

    setApprovalByStep((prev) => {
      const next = { ...prev };
      for (const stepId of downstream) {
        if (next[stepId] === 'APPROVED') {
          next[stepId] = 'DRAFT';
        }
      }
      return next;
    });

    setReverificationByStep((prev) => {
      const next = { ...prev };
      for (const stepId of downstream) {
        next[stepId] = true;
      }
      return next;
    });
  }, []);

  const updateStepFields = useCallback((stepId: string, updater: (current: DynamicFieldRecord[]) => DynamicFieldRecord[]) => {
    setDraftByStep((prev) => {
      const current = prev[stepId] ?? [{ key: '', value: '' }];
      return {
        ...prev,
        [stepId]: updater(current),
      };
    });
    setApprovalByStep((prev) => {
      if (prev[stepId] !== 'APPROVED') {
        return prev;
      }

      return {
        ...prev,
        [stepId]: 'DRAFT',
      };
    });

    markDownstreamForReverification(stepId);
  }, [markDownstreamForReverification]);

  const updateField = useCallback(
    (index: number, key: 'key' | 'value', value: string) => {
      updateStepFields(currentStepConfig.id, (current) =>
        current.map((record, recordIndex) => {
          if (recordIndex !== index) {
            return record;
          }

          return {
            ...record,
            [key]: value,
          };
        }),
      );
    },
    [currentStepConfig.id, updateStepFields],
  );

  const addField = useCallback(() => {
    updateStepFields(currentStepConfig.id, (current) => [...current, { key: '', value: '' }]);
  }, [currentStepConfig.id, updateStepFields]);

  const removeField = useCallback(
    (index: number) => {
      updateStepFields(currentStepConfig.id, (current) => {
        const next = current.filter((_, recordIndex) => recordIndex !== index);
        return next.length > 0 ? next : [{ key: '', value: '' }];
      });
    },
    [currentStepConfig.id, updateStepFields],
  );

  const applyJson = useCallback(
    async (file: File) => {
      setJsonError(null);

      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw) as unknown;

        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setJsonError('onboarding.json.error.invalidObject');
          return;
        }

        const nextFields = Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
          key,
          value: normalizeJsonEntryValue(value),
        }));

        updateStepFields(currentStepConfig.id, () => {
          return nextFields.length > 0 ? nextFields : [{ key: '', value: '' }];
        });
      } catch {
        setJsonError('onboarding.json.error.parse');
      }
    },
    [currentStepConfig.id, updateStepFields],
  );

  const updateModelProvider = useCallback(
    (provider: keyof ModelAccessDraft, field: keyof ModelProviderDraft, value: string | boolean | number | '') => {
      setModelAccess((prev) => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          [field]: value === '' ? undefined : value,
        },
      }));
      setApprovalByStep((prev) => {
        if (prev['infrastructure-finalization'] === 'APPROVED') {
          return {
            ...prev,
            'infrastructure-finalization': 'DRAFT',
          };
        }
        return prev;
      });

      markDownstreamForReverification('infrastructure-finalization');
    },
    [markDownstreamForReverification],
  );

  const updateVirtualProfile = useCallback(
    (agentId: string, patch: Partial<LifecycleProfileDraft>) => {
      lifecycle.updateProfileLocal(agentId, patch);
      setApprovalByStep((prev) => {
        if (prev['agent-profile-persona'] === 'APPROVED') {
          return {
            ...prev,
            'agent-profile-persona': 'DRAFT',
          };
        }
        return prev;
      });

      markDownstreamForReverification('agent-profile-persona');
    },
    [lifecycle, markDownstreamForReverification],
  );

  const updateVirtualSkill = useCallback(
    (skillId: string, markdown: string) => {
      lifecycle.updateGlobalSkillLocal(skillId, markdown);
      setApprovalByStep((prev) => {
        if (prev['global-assets'] === 'APPROVED') {
          return {
            ...prev,
            'global-assets': 'DRAFT',
          };
        }
        return prev;
      });

      markDownstreamForReverification('global-assets');
    },
    [lifecycle, markDownstreamForReverification],
  );

  const modelConfigReady = useMemo(() => {
    return Object.values(modelAccess).some((provider) => provider.enabled && provider.endpoint.trim().length > 0 && provider.model.trim().length > 0);
  }, [modelAccess]);

  const canApproveCurrentStep = useMemo(() => {
    const dependencies = STEP_DEPENDENCIES[currentStepConfig.id] ?? [];
    const dependencyBlocked = dependencies.some((stepId) => approvalByStep[stepId] !== 'APPROVED');
    if (dependencyBlocked) {
      return false;
    }

    if (currentStepConfig.id === 'infrastructure-finalization') {
      return modelConfigReady;
    }

    if (currentStepConfig.id === 'agent-profile-persona') {
      return !Object.values(profileAlignmentByAgent).some((warnings) => warnings.length > 0);
    }

    return isStepReady(fieldSchemaByStep, currentStepConfig.id, currentStepFields);
  }, [
    approvalByStep,
    currentStepConfig.id,
    currentStepFields,
    fieldSchemaByStep,
    modelConfigReady,
    profileAlignmentByAgent,
  ]);

  const stepStatusById = useMemo<Record<string, OnboardingEntityStatus>>(() => {
    return ONBOARDING_STEPS.reduce<Record<string, OnboardingEntityStatus>>((acc, step) => {
      if (approvalByStep[step.id] === 'APPROVED') {
        acc[step.id] = 'APPROVED';
        return acc;
      }

      const fields = draftByStep[step.id] ?? [];
      const hasDraft = hasMeaningfulFields(fields);
      acc[step.id] = hasDraft ? 'DRAFT' : 'PENDING';
      return acc;
    }, {});
  }, [approvalByStep, draftByStep]);

  const approveCurrentStep = useCallback(() => {
    setJsonError(null);

    const dependencies = STEP_DEPENDENCIES[currentStepConfig.id] ?? [];
    const dependencyBlocked = dependencies.find((stepId) => approvalByStep[stepId] !== 'APPROVED');
    if (dependencyBlocked) {
      setJsonError('onboarding.guard.dependencyBlocked');
      return;
    }

    if (currentStepConfig.id === 'infrastructure-finalization') {
      if (!modelConfigReady) {
        setJsonError('onboarding.guard.modelConfigRequired');
        return;
      }
    } else if (currentStepConfig.id === 'agent-profile-persona') {
      const firstMisaligned = Object.entries(profileAlignmentByAgent).find(([, warnings]) => warnings.length > 0);
      if (firstMisaligned) {
        setJsonError(firstMisaligned[1][0]?.message ?? 'onboarding.guard.missingInput');
        return;
      }
    } else {
      const ready = isStepReady(fieldSchemaByStep, currentStepConfig.id, currentStepFields);
      if (!ready) {
        const firstValidationIssue = currentStepValidation.find(
          (status) => status.mandatoryForEfficiency && !status.isValid,
        );
        setJsonError(firstValidationIssue?.message ?? 'onboarding.guard.missingInput');
        return;
      }
    }

    setApprovalByStep((prev) => ({
      ...prev,
      [currentStepConfig.id]: 'APPROVED',
    }));

    setReverificationByStep((prev) => ({
      ...prev,
      [currentStepConfig.id]: false,
    }));
  }, [
    approvalByStep,
    currentStepConfig.id,
    currentStepFields,
    currentStepValidation,
    fieldSchemaByStep,
    modelConfigReady,
    profileAlignmentByAgent,
  ]);

  const jumpToStep = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex > totalSteps - 1) {
      return;
    }

    setCurrentStep(targetIndex);
  }, [totalSteps]);

  const goNext = useCallback(() => {
    setCommitError(null);
    setJsonError(null);

    if (currentStep >= totalSteps - 1) {
      return;
    }

    const nextStepIndex = Math.min(currentStep + 1, totalSteps - 1);
    setCurrentStep(nextStepIndex);
  }, [currentStep, totalSteps]);

  const goBack = useCallback(() => {
    setCommitError(null);
    setJsonError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const allStepDrafts = useMemo<Record<string, Record<string, string>>>(() => {
    return Object.entries(draftByStep).reduce<Record<string, Record<string, string>>>((acc, [stepId, fields]) => {
      acc[stepId] = toFieldMap(fields);
      return acc;
    }, {});
  }, [draftByStep]);

  const infrastructureModelFields = useMemo<Record<string, string>>(() => {
    const enabledProviders = Object.entries(modelAccess)
      .filter(([, provider]) => provider.enabled)
      .map(([provider]) => provider);

    const endpointMap = Object.entries(modelAccess)
      .filter(([, provider]) => provider.enabled)
      .map(([provider, values]) => `${provider}:${values.endpoint}`)
      .join(', ');

    const modelMap = Object.entries(modelAccess)
      .filter(([, provider]) => provider.enabled)
      .map(([provider, values]) => `${provider}:${values.model}`)
      .join(', ');

    const contextWindowMap = Object.entries(modelAccess)
      .filter(([, provider]) => provider.enabled && typeof provider.contextWindow === 'number')
      .map(([provider, values]) => `${provider}:${values.contextWindow}`)
      .join(', ');

    const reservedOutputMap = Object.entries(modelAccess)
      .filter(([, provider]) => provider.enabled && typeof provider.reservedOutputTokens === 'number')
      .map(([provider, values]) => `${provider}:${values.reservedOutputTokens}`)
      .join(', ');

    return {
      model_enabled_providers: enabledProviders.join(', '),
      model_endpoints: endpointMap,
      model_catalog: modelMap,
      model_context_windows: contextWindowMap,
      model_reserved_output_tokens: reservedOutputMap,
    };
  }, [modelAccess]);

  const contextByStepForCommit = useMemo<Record<string, Record<string, string>>>(() => {
    return {
      ...allStepDrafts,
      'infrastructure-finalization': {
        ...(allStepDrafts['infrastructure-finalization'] ?? {}),
        ...infrastructureModelFields,
      },
    };
  }, [allStepDrafts, infrastructureModelFields]);

  const kpiData = useMemo(() => {
    const directKpiStep = allStepDrafts['global-assets'] ?? {};
    if (Object.keys(directKpiStep).length > 0) {
      return directKpiStep;
    }

    return Object.entries(contextByStepForCommit).reduce<Record<string, string>>((acc, [stepId, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        acc[`${stepId}.${key}`] = value;
      });
      return acc;
    }, {});
  }, [allStepDrafts, contextByStepForCommit]);

  const summary = useMemo(() => {
    const sections = ONBOARDING_STEPS.filter((step) => step.kind === 'dynamic-form' || step.id === 'infrastructure-finalization').map((step) => ({
      stepId: step.id,
      titleKey: step.titleKey,
      fields: toDisplayFields(contextByStepForCommit[step.id] ?? {}),
    }));

    return {
      sections,
      modelAccess,
      kpiData,
    };
  }, [contextByStepForCommit, kpiData, modelAccess]);

  const phaseTrackerById = useMemo<Record<string, PhaseTrackerStatus>>(() => {
    return ONBOARDING_STEPS.reduce<Record<string, PhaseTrackerStatus>>((acc, step) => {
      const dependencies = STEP_DEPENDENCIES[step.id] ?? [];
      const isUnlocked = dependencies.every((stepId) => approvalByStep[stepId] === 'APPROVED');

      if (approvalByStep[step.id] === 'APPROVED' && !reverificationByStep[step.id]) {
        acc[step.id] = {
          state: 'APPROVED',
          requiresReverification: false,
        };
        return acc;
      }

      if (!isUnlocked) {
        acc[step.id] = {
          state: 'LOCKED',
          requiresReverification: reverificationByStep[step.id] ?? false,
        };
        return acc;
      }

      let isValidated = false;
      if (step.id === 'infrastructure-finalization') {
        isValidated = modelConfigReady;
      } else if (step.id === 'agent-profile-persona') {
        isValidated = !Object.values(profileAlignmentByAgent).some((warnings) => warnings.length > 0);
      } else {
        isValidated = isStepReady(fieldSchemaByStep, step.id, draftByStep[step.id] ?? []);
      }

      acc[step.id] = {
        state: isValidated ? 'VALIDATED' : 'DRAFT',
        requiresReverification: reverificationByStep[step.id] ?? false,
      };
      return acc;
    }, {});
  }, [approvalByStep, draftByStep, fieldSchemaByStep, modelConfigReady, profileAlignmentByAgent, reverificationByStep]);

  useEffect(() => {
    const requiredApprovals = ONBOARDING_STEPS.map((step) => step.id);
    const approvedCount = requiredApprovals.filter((stepId) => approvalByStep[stepId] === 'APPROVED').length;

    if (approvedCount === 0) {
      volatileSessionStore.setOnboardingStatus('NOT_STARTED');
      return;
    }

    if (approvedCount < requiredApprovals.length) {
      volatileSessionStore.setOnboardingStatus('IN_PROGRESS');
      return;
    }

    volatileSessionStore.setOnboardingStatus('IN_PROGRESS');
  }, [approvalByStep]);

  const canDirectorApproveAll = useMemo(() => {
    const finalStepId = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]?.id;
    if (!finalStepId) {
      return false;
    }
    const finalDependencies = STEP_DEPENDENCIES[finalStepId] ?? [];
    const dependenciesApproved = finalDependencies.every((stepId) => approvalByStep[stepId] === 'APPROVED');
    return dependenciesApproved && approvalByStep[finalStepId] === 'APPROVED';
  }, [approvalByStep]);

  const approveAndCommit = useCallback(async () => {
    setCommitError(null);
    setIsCommitting(true);

    try {
      const requiredApprovals = [
        'company-core',
        'product-context',
        'global-assets',
        'global-guardrails',
        'agent-profile-persona',
        'agent-workflows',
        'infrastructure-finalization',
      ];
      const missingApproval = requiredApprovals.find((stepId) => approvalByStep[stepId] !== 'APPROVED');
      if (missingApproval) {
        setCommitError('onboarding.guard.masterCommitBlocked');
        return;
      }

      const agentMappings = lifecycle.profiles.reduce<Record<string, { skills: string[]; protocols: string[]; kpis: string[]; workflows: string[] }>>(
        (acc, profile) => {
          const registryBinding = registryAgentBindings[profile.agentId];
          acc[profile.agentId] = {
            skills: profile.skills,
            protocols: registryBinding?.protocols ?? [],
            kpis: profile.kpis,
            workflows: registryBinding?.workflows ?? [],
          };
          return acc;
        },
        {},
      );

      const response = await repo.commitOnboarding({
        kpiData,
        contextByStep: contextByStepForCommit,
        approvalByStep,
        agentMappings,
      });

      if (!response.isSuccess) {
        const alignmentIssue = response.data?.alignmentIssues?.[0]?.reason;
        const validationError = response.data?.validationErrors?.[0];
        setCommitError(alignmentIssue ?? validationError ?? 'onboarding.commit.error.generic');
        return;
      }

      volatileSessionStore.setOnboardingStatus('COMPLETED');
      onComplete();
    } catch {
      setCommitError('onboarding.commit.error.generic');
    } finally {
      setIsCommitting(false);
    }
  }, [approvalByStep, contextByStepForCommit, kpiData, lifecycle.profiles, onComplete, registryAgentBindings, repo]);

  return {
    steps: ONBOARDING_STEPS,
    currentStep,
    totalSteps,
    currentStepConfig,
    currentStepFields,
    stepStatusById,
    phaseTrackerById,
    canDirectorApproveAll,
    canApproveCurrentStep,
    canGoNext,
    jsonError,
    commitError,
    modelAccess,
    summary,
    currentStepValidation,
    guidanceByFieldKey,
    statusByFieldKey,
    isCommitting,
    virtualProfiles: lifecycle.profiles,
    profileAlignmentByAgent,
    globalSkills: lifecycle.globalSkills,
    selectedVirtualProfileId,
    setSelectedVirtualProfileId,
    updateVirtualProfile,
    updateVirtualSkill,
    updateField,
    addField,
    removeField,
    applyJson,
    updateModelProvider,
    approveCurrentStep,
    jumpToStep,
    goNext,
    goBack,
    approveAndCommit,
  };
};
