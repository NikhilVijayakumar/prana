import { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

export interface LifecycleProfileDraft {
  agentId: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  skills: string[];
  kpis: string[];
  kpiStatus: Array<{ name: string; value: string; trend: 'up' | 'down' | 'neutral' }>;
}

export interface LifecycleGlobalSkill {
  id: string;
  title: string;
  tags: string[];
  markdown: string;
}

export interface LifecycleKpiDefinition {
  id: string;
  name: string;
  description: string;
  unit: string;
  target: string;
  value: string;
  linkedAgents: string[];
}

export interface LifecycleDataInputDefinition {
  id: string;
  name: string;
  description: string;
  schemaType: 'tabular' | 'event-stream' | 'document' | 'timeseries';
  requiredFields: string[];
  sampleSource: string;
  uploadedFileName?: string;
  uploadedContent?: string;
  uploadedPreview?: string;
  updatedAt?: string;
}

export interface LifecycleDraftRecord {
  draftId: string;
  entityType: 'profile' | 'skill' | 'kpi' | 'data-input' | 'data-input-create';
  entityId: string;
  proposed: Record<string, unknown>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  reviewNote: string | null;
}

interface LifecycleSnapshotPayload {
  profiles: LifecycleProfileDraft[];
  globalSkills: LifecycleGlobalSkill[];
  kpis: LifecycleKpiDefinition[];
  dataInputs: LifecycleDataInputDefinition[];
  committedAt: string | null;
}

interface LifecycleMutationResult {
  success: boolean;
  updatedAt?: string;
  validationErrors?: string[];
}

interface LifecycleContextValue {
  profiles: LifecycleProfileDraft[];
  globalSkills: LifecycleGlobalSkill[];
  kpis: LifecycleKpiDefinition[];
  dataInputs: LifecycleDataInputDefinition[];
  lifecycleDrafts: LifecycleDraftRecord[];
  isLoading: boolean;
  isLoadingDrafts: boolean;
  dirtyProfiles: Record<string, boolean>;
  dirtySkills: Record<string, boolean>;
  dirtyKpis: Record<string, boolean>;
  dirtyDataInputs: Record<string, boolean>;
  error: string | null;
  lastSavedAt: string | null;
  refresh: () => Promise<void>;
  refreshLifecycleDrafts: () => Promise<void>;
  updateProfileLocal: (agentId: string, patch: Partial<LifecycleProfileDraft>) => void;
  updateGlobalSkillLocal: (skillId: string, markdown: string) => void;
  updateKpiLocal: (kpiId: string, patch: Partial<LifecycleKpiDefinition>) => void;
  updateDataInputLocal: (dataInputId: string, patch: Partial<LifecycleDataInputDefinition>) => void;
  saveProfile: (agentId: string) => Promise<{ success: boolean; error?: string }>;
  saveSkill: (skillId: string) => Promise<{ success: boolean; error?: string }>;
  saveKpi: (kpiId: string) => Promise<{ success: boolean; error?: string }>;
  saveDataInput: (dataInputId: string) => Promise<{ success: boolean; error?: string }>;
  createDataInput: (payload: {
    dataInputId: string;
    name: string;
    description: string;
    schemaType: string;
    requiredFields: string[];
    sampleSource: string;
    fileName?: string;
    content?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  reviewLifecycleDraft: (
    draftId: string,
    status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN',
    reviewNote?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

const LifecycleContext = createContext<LifecycleContextValue | null>(null);

const sanitizeList = (values: string[]): string[] => {
  return values.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
};

export const LifecycleProvider: FC<PropsWithChildren> = ({ children }) => {
  const [profiles, setProfiles] = useState<LifecycleProfileDraft[]>([]);
  const [globalSkills, setGlobalSkills] = useState<LifecycleGlobalSkill[]>([]);
  const [kpis, setKpis] = useState<LifecycleKpiDefinition[]>([]);
  const [dataInputs, setDataInputs] = useState<LifecycleDataInputDefinition[]>([]);
  const [lifecycleDrafts, setLifecycleDrafts] = useState<LifecycleDraftRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [dirtyProfiles, setDirtyProfiles] = useState<Record<string, boolean>>({});
  const [dirtySkills, setDirtySkills] = useState<Record<string, boolean>>({});
  const [dirtyKpis, setDirtyKpis] = useState<Record<string, boolean>>({});
  const [dirtyDataInputs, setDirtyDataInputs] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await safeIpcCall<LifecycleSnapshotPayload>(
        'operations.getLifecycleSnapshot',
        () => window.api.operations.getLifecycleSnapshot(),
        (value) => typeof value === 'object' && value !== null,
      );
      setProfiles(snapshot.profiles);
      setGlobalSkills(snapshot.globalSkills);
      setKpis(snapshot.kpis);
      setDataInputs(snapshot.dataInputs);
      setDirtyProfiles({});
      setDirtySkills({});
      setDirtyKpis({});
      setDirtyDataInputs({});
      setLastSavedAt(snapshot.committedAt);
      const drafts = await safeIpcCall<LifecycleDraftRecord[]>(
        'operations.listLifecycleDrafts',
        () => window.api.operations.listLifecycleDrafts('PENDING'),
        Array.isArray,
      );
      setLifecycleDrafts(drafts);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load lifecycle snapshot');
    } finally {
      setIsLoading(false);
      setIsLoadingDrafts(false);
    }
  }, []);

  const refreshLifecycleDrafts = useCallback(async () => {
    setIsLoadingDrafts(true);
    try {
      const drafts = await safeIpcCall<LifecycleDraftRecord[]>(
        'operations.listLifecycleDrafts',
        () => window.api.operations.listLifecycleDrafts('PENDING'),
        Array.isArray,
      );
      setLifecycleDrafts(drafts);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load lifecycle draft queue');
    } finally {
      setIsLoadingDrafts(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateProfileLocal = useCallback((agentId: string, patch: Partial<LifecycleProfileDraft>) => {
    setProfiles((current) =>
      current.map((entry) => {
        if (entry.agentId !== agentId) {
          return entry;
        }

        return {
          ...entry,
          ...patch,
          skills: patch.skills ? sanitizeList(patch.skills) : entry.skills,
          kpis: patch.kpis ? sanitizeList(patch.kpis) : entry.kpis,
        };
      }),
    );
    setDirtyProfiles((current) => ({
      ...current,
      [agentId]: true,
    }));
  }, []);

  const updateGlobalSkillLocal = useCallback((skillId: string, markdown: string) => {
    setGlobalSkills((current) =>
      current.map((entry) => {
        if (entry.id !== skillId) {
          return entry;
        }

        return {
          ...entry,
          markdown,
        };
      }),
    );
    setDirtySkills((current) => ({
      ...current,
      [skillId]: true,
    }));
  }, []);

  const updateKpiLocal = useCallback((kpiId: string, patch: Partial<LifecycleKpiDefinition>) => {
    setKpis((current) =>
      current.map((entry) => {
        if (entry.id !== kpiId) {
          return entry;
        }

        return {
          ...entry,
          ...patch,
        };
      }),
    );
    setDirtyKpis((current) => ({
      ...current,
      [kpiId]: true,
    }));
  }, []);

  const updateDataInputLocal = useCallback((dataInputId: string, patch: Partial<LifecycleDataInputDefinition>) => {
    setDataInputs((current) =>
      current.map((entry) => {
        if (entry.id !== dataInputId) {
          return entry;
        }

        return {
          ...entry,
          ...patch,
        };
      }),
    );
    setDirtyDataInputs((current) => ({
      ...current,
      [dataInputId]: true,
    }));
  }, []);

  const saveProfile = useCallback(
    async (agentId: string): Promise<{ success: boolean; error?: string }> => {
      const target = profiles.find((entry) => entry.agentId === agentId);
      if (!target) {
        return { success: false, error: 'Profile not found' };
      }

      let result;
      try {
        result = await safeIpcCall<LifecycleMutationResult>(
          'operations.updateLifecycleProfile',
          () =>
            window.api.operations.updateLifecycleProfile({
              agentId,
              goal: target.goal,
              backstory: target.backstory,
              skills: target.skills,
              kpis: target.kpis,
            }),
          (value) => typeof value === 'object' && value !== null,
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save profile',
        };
      }

      if (!result.success) {
        return {
          success: false,
          error: result.validationErrors?.[0] ?? 'Failed to save profile',
        };
      }

      setDirtyProfiles((current) => ({
        ...current,
        [agentId]: false,
      }));
      setLastSavedAt(result.updatedAt);
      await refreshLifecycleDrafts();
      return { success: true };
    },
    [profiles, refreshLifecycleDrafts],
  );

  const saveSkill = useCallback(
    async (skillId: string): Promise<{ success: boolean; error?: string }> => {
      const target = globalSkills.find((entry) => entry.id === skillId);
      if (!target) {
        return { success: false, error: 'Skill not found' };
      }

      let result;
      try {
        result = await safeIpcCall<LifecycleMutationResult>(
          'operations.updateLifecycleSkill',
          () =>
            window.api.operations.updateLifecycleSkill({
              skillId,
              markdown: target.markdown,
            }),
          (value) => typeof value === 'object' && value !== null,
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save skill',
        };
      }

      if (!result.success) {
        return {
          success: false,
          error: result.validationErrors?.[0] ?? 'Failed to save skill',
        };
      }

      setDirtySkills((current) => ({
        ...current,
        [skillId]: false,
      }));
      setLastSavedAt(result.updatedAt);
      await refreshLifecycleDrafts();
      return { success: true };
    },
    [globalSkills, refreshLifecycleDrafts],
  );

  const saveKpi = useCallback(
    async (kpiId: string): Promise<{ success: boolean; error?: string }> => {
      const target = kpis.find((entry) => entry.id === kpiId);
      if (!target) {
        return { success: false, error: 'KPI not found' };
      }

      let result;
      try {
        result = await safeIpcCall<LifecycleMutationResult>(
          'operations.updateLifecycleKpi',
          () =>
            window.api.operations.updateLifecycleKpi({
              kpiId,
              target: target.target,
              value: target.value,
            }),
          (value) => typeof value === 'object' && value !== null,
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save KPI',
        };
      }

      if (!result.success) {
        return {
          success: false,
          error: result.validationErrors?.[0] ?? 'Failed to save KPI',
        };
      }

      setDirtyKpis((current) => ({
        ...current,
        [kpiId]: false,
      }));
      setLastSavedAt(result.updatedAt);
      await refreshLifecycleDrafts();
      return { success: true };
    },
    [kpis, refreshLifecycleDrafts],
  );

  const saveDataInput = useCallback(
    async (dataInputId: string): Promise<{ success: boolean; error?: string }> => {
      const target = dataInputs.find((entry) => entry.id === dataInputId);
      if (!target) {
        return { success: false, error: 'Data input not found' };
      }

      let result;
      try {
        result = await safeIpcCall<LifecycleMutationResult>(
          'operations.updateLifecycleDataInput',
          () =>
            window.api.operations.updateLifecycleDataInput({
              dataInputId,
              fileName: target.uploadedFileName ?? `${dataInputId}.txt`,
              content: target.uploadedContent ?? '',
            }),
          (value) => typeof value === 'object' && value !== null,
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save data input',
        };
      }

      if (!result.success) {
        return {
          success: false,
          error: result.validationErrors?.[0] ?? 'Failed to save data input',
        };
      }

      setDirtyDataInputs((current) => ({
        ...current,
        [dataInputId]: false,
      }));
      setLastSavedAt(result.updatedAt);
      await refreshLifecycleDrafts();
      return { success: true };
    },
    [dataInputs, refreshLifecycleDrafts],
  );

  const createDataInput = useCallback(
    async (payload: {
      dataInputId: string;
      name: string;
      description: string;
      schemaType: string;
      requiredFields: string[];
      sampleSource: string;
      fileName?: string;
      content?: string;
    }): Promise<{ success: boolean; error?: string }> => {
      let result;
      try {
        result = await safeIpcCall<LifecycleMutationResult>(
          'operations.createLifecycleDataInput',
          () => window.api.operations.createLifecycleDataInput(payload),
          (value) => typeof value === 'object' && value !== null,
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create data input',
        };
      }
      if (!result.success) {
        return {
          success: false,
          error: result.validationErrors?.[0] ?? 'Failed to create data input',
        };
      }

      await refresh();
      setLastSavedAt(result.updatedAt);
      await refreshLifecycleDrafts();
      return { success: true };
    },
    [refresh, refreshLifecycleDrafts],
  );

  const reviewLifecycleDraft = useCallback(
    async (
      draftId: string,
      status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN',
      reviewNote?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      let result;
      try {
        result = await safeIpcCall<LifecycleMutationResult>(
          'operations.reviewLifecycleDraft',
          () =>
            window.api.operations.reviewLifecycleDraft({
              draftId,
              status,
              reviewer: 'DIRECTOR',
              reviewNote,
            }),
          (value) => typeof value === 'object' && value !== null,
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to review lifecycle draft',
        };
      }

      if (!result.success) {
        return {
          success: false,
          error: result.validationErrors?.[0] ?? 'Failed to review lifecycle draft',
        };
      }

      await refresh();
      await refreshLifecycleDrafts();
      setLastSavedAt(result.updatedAt);
      return { success: true };
    },
    [refresh, refreshLifecycleDrafts],
  );

  const value = useMemo<LifecycleContextValue>(() => {
    return {
      profiles,
      globalSkills,
      kpis,
      dataInputs,
      lifecycleDrafts,
      isLoading,
      isLoadingDrafts,
      dirtyProfiles,
      dirtySkills,
      dirtyKpis,
      dirtyDataInputs,
      error,
      lastSavedAt,
      refresh,
      refreshLifecycleDrafts,
      updateProfileLocal,
      updateGlobalSkillLocal,
      updateKpiLocal,
      updateDataInputLocal,
      saveProfile,
      saveSkill,
      saveKpi,
      saveDataInput,
      createDataInput,
      reviewLifecycleDraft,
    };
  }, [
    dataInputs,
    lifecycleDrafts,
    dirtyDataInputs,
    dirtyKpis,
    dirtyProfiles,
    dirtySkills,
    error,
    globalSkills,
    isLoading,
    isLoadingDrafts,
    kpis,
    lastSavedAt,
    profiles,
    refresh,
    refreshLifecycleDrafts,
    reviewLifecycleDraft,
    saveDataInput,
    saveKpi,
    saveProfile,
    saveSkill,
    createDataInput,
    updateDataInputLocal,
    updateGlobalSkillLocal,
    updateKpiLocal,
    updateProfileLocal,
  ]);

  return <LifecycleContext.Provider value={value}>{children}</LifecycleContext.Provider>;
};

export const useLifecycle = (): LifecycleContextValue => {
  const context = useContext(LifecycleContext);
  if (!context) {
    throw new Error('useLifecycle must be used inside LifecycleProvider');
  }
  return context;
};
