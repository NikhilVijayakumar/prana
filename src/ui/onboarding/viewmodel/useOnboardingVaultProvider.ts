import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ONBOARDING_LEDGER_STORAGE_KEY,
  LEGACY_ONBOARDING_LEDGER_STORAGE_KEY,
  readStorageWithLegacy,
} from 'prana/ui/constants/storageKeys';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

export interface ScreenDraftRecord {
  stepId: string;
  ownerAgentId: string;
  draft: Record<string, unknown>;
  draftRevision: number;
  draftHash: string;
  committedRevision: number;
  committedHash: string;
  committedAt: string | null;
}

interface LedgerRecord {
  stepId: string;
  committedRevision: number;
  committedHash: string;
  committedAt: string;
}

const computeHash = (value: unknown): string => {
  const text = JSON.stringify(value);
  let hash = 0;

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  return `h-${Math.abs(hash)}`;
};

const readLedger = (): Record<string, LedgerRecord> => {
  const raw = readStorageWithLegacy(ONBOARDING_LEDGER_STORAGE_KEY, LEGACY_ONBOARDING_LEDGER_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, LedgerRecord>;
  } catch {
    return {};
  }
};

const writeLedger = (nextLedger: Record<string, LedgerRecord>): void => {
  localStorage.setItem(ONBOARDING_LEDGER_STORAGE_KEY, JSON.stringify(nextLedger));
  localStorage.removeItem(LEGACY_ONBOARDING_LEDGER_STORAGE_KEY);
};

export const useOnboardingVaultProvider = () => {
  const [records, setRecords] = useState<Record<string, ScreenDraftRecord>>({});
  const hydrateLocks = useRef<Record<string, boolean>>({});

  const ensureHydrated = useCallback(async (stepId: string, ownerAgentId: string): Promise<void> => {
    if (hydrateLocks.current[stepId]) {
      return;
    }

    hydrateLocks.current[stepId] = true;

    try {
      const ledger = readLedger();
      const fromLedger = ledger[stepId];

      setRecords((prev) => {
        if (prev[stepId]) {
          return prev;
        }

        return {
          ...prev,
          [stepId]: {
            stepId,
            ownerAgentId,
            draft: {},
            draftRevision: fromLedger?.committedRevision ?? 0,
            draftHash: computeHash({}),
            committedRevision: fromLedger?.committedRevision ?? 0,
            committedHash: fromLedger?.committedHash ?? '',
            committedAt: fromLedger?.committedAt ?? null,
          },
        };
      });
    } finally {
      hydrateLocks.current[stepId] = false;
    }
  }, []);

  const updateDraft = useCallback((stepId: string, ownerAgentId: string, nextDraft: Record<string, unknown>) => {
    const nextDraftHash = computeHash(nextDraft);

    setRecords((prev) => {
      const current = prev[stepId] ?? {
        stepId,
        ownerAgentId,
        draft: {},
        draftRevision: 0,
        draftHash: computeHash({}),
        committedRevision: 0,
        committedHash: '',
        committedAt: null,
      };

      return {
        ...prev,
        [stepId]: {
          ...current,
          ownerAgentId,
          draft: nextDraft,
          draftRevision: current.draftRevision + 1,
          draftHash: nextDraftHash,
        },
      };
    });
  }, []);

  const commitStep = useCallback(
    async (stepId: string, dependencySnapshot: string[]): Promise<{ committed: boolean; reason?: string }> => {
      const record = records[stepId];
      if (!record) {
        return { committed: false, reason: 'No draft found.' };
      }

      try {
        const committedAt = new Date().toISOString();
        const committedHash = computeHash({
          stepId,
          ownerAgentId: record.ownerAgentId,
          draft: record.draft,
          draftRevision: record.draftRevision,
          committedAt,
          dependencySnapshot,
        });

        // Security path: renderer requests main-process vault operation.
        await safeIpcCall(
          'vault.createSnapshot',
          () => window.api.vault.createSnapshot(`onboarding-${stepId}-${record.draftRevision}`),
          () => true,
        );

        const ledger = readLedger();
        ledger[stepId] = {
          stepId,
          committedRevision: record.draftRevision,
          committedHash,
          committedAt,
        };
        writeLedger(ledger);

        setRecords((prev) => {
          const current = prev[stepId];
          if (!current) {
            return prev;
          }

          return {
            ...prev,
            [stepId]: {
              ...current,
              committedRevision: current.draftRevision,
              committedHash,
              committedAt,
            },
          };
        });

        return { committed: true };
      } catch (error) {
        return {
          committed: false,
          reason: error instanceof Error ? error.message : 'Commit failed.',
        };
      }
    },
    [records],
  );

  const getScreenStatus = useCallback(
    (stepId: string) => {
      const record = records[stepId];
      if (!record) {
        return {
          hasCommitted: false,
          isDirtyDraft: false,
          hasConflict: false,
        };
      }

      const hasCommitted = Boolean(record.committedAt);
      const isDirtyDraft = record.draftRevision > record.committedRevision;
      const ledgerHash = readLedger()[stepId]?.committedHash ?? '';
      const hasConflict = hasCommitted && !isDirtyDraft && ledgerHash !== '' && ledgerHash !== record.committedHash;

      return {
        hasCommitted,
        isDirtyDraft,
        hasConflict,
      };
    },
    [records],
  );

  const hasDependenciesCommitted = useCallback(
    (requiredFrom: string[]): boolean => {
      return requiredFrom.every((depId) => Boolean(records[depId]?.committedAt));
    },
    [records],
  );

  const getResumeStepId = useCallback((orderedStepIds: string[]): string | null => {
    const firstUncommitted = orderedStepIds.find((stepId) => !records[stepId]?.committedAt);
    return firstUncommitted ?? null;
  }, [records]);

  const getStepStatusLabel = useMemo(() => {
    return (stepId: string): 'DRAFT' | 'COMMITTED' => {
      const status = getScreenStatus(stepId);
      if (!status.hasCommitted || status.isDirtyDraft) {
        return 'DRAFT';
      }
      return 'COMMITTED';
    };
  }, [getScreenStatus]);

  const reloadCommitted = useCallback((stepId: string) => {
    setRecords((prev) => {
      const current = prev[stepId];
      if (!current) {
        return prev;
      }

      return {
        ...prev,
        [stepId]: {
          ...current,
          draftRevision: current.committedRevision,
          draftHash: current.committedHash || current.draftHash,
        },
      };
    });
  }, []);

  return {
    records,
    ensureHydrated,
    updateDraft,
    commitStep,
    getScreenStatus,
    hasDependenciesCommitted,
    getResumeStepId,
    getStepStatusLabel,
    reloadCommitted,
  };
};
