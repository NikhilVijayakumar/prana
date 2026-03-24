import { useCallback, useMemo, useRef, useState } from 'react';

export interface ScreenDraftRecord {
  stepId: string;
  ownerAgentId: string;
  draft: Record<string, unknown>;
  draftRevision: number;
  draftHash: string;
  committedRevision: number;
  committedHash: string;
  committedAt: string | null;
  lastError?: string;
  lastHydrationAttempt?: string;
}

const ONBOARDING_LEDGER_KEY = 'dhi_onboarding_commit_ledger_v1';

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
  const raw = localStorage.getItem(ONBOARDING_LEDGER_KEY);
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
  localStorage.setItem(ONBOARDING_LEDGER_KEY, JSON.stringify(nextLedger));
};

/**
 * Improved vault provider with robust error handling and hydration state.
 * 
 * Key improvements:
 * - Promise-based hydration locks (better than ref-based)
 * - Proper error recovery and tracking
 * - Hydration timeout protection
 * - Atomic state updates
 */
export const useOnboardingVaultProviderV2 = () => {
  const [records, setRecords] = useState<Record<string, ScreenDraftRecord>>({});
  const hydrationPromises = useRef<Partial<Record<string, Promise<void>>>>({});

  const HYDRATION_TIMEOUT = 5000; // 5 second timeout per step

  const ensureHydrated = useCallback(
    async (stepId: string, ownerAgentId: string): Promise<void> => {
      // If already hydrating, return existing promise (prevents race condition)
      if (hydrationPromises.current[stepId]) {
        return hydrationPromises.current[stepId];
      }

      // If already hydrated, return immediately
      const currentRecord = await new Promise<ScreenDraftRecord | undefined>((resolve) => {
        setRecords((prev) => {
          resolve(prev[stepId]);
          return prev;
        });
      });

      if (currentRecord?.committedAt !== undefined) {
        return; // Already hydrated
      }

      // Create hydration promise with timeout protection
      const hydrationPromise = Promise.race([
        (async () => {
          try {
            const ledger = readLedger();
            const fromLedger = ledger[stepId];

            await new Promise<void>((resolve) => {
              setRecords((prev) => {
                if (prev[stepId]) {
                  resolve();
                  return prev;
                }

                const newRecord: ScreenDraftRecord = {
                  stepId,
                  ownerAgentId,
                  draft: {},
                  draftRevision: fromLedger?.committedRevision ?? 0,
                  draftHash: computeHash({}),
                  committedRevision: fromLedger?.committedRevision ?? 0,
                  committedHash: fromLedger?.committedHash ?? '',
                  committedAt: fromLedger?.committedAt ?? null,
                  lastHydrationAttempt: new Date().toISOString(),
                };

                resolve();
                return {
                  ...prev,
                  [stepId]: newRecord,
                };
              });
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown hydration error';
            setRecords((prev) => {
              const current = prev[stepId];
              if (!current) {
                return prev;
              }
              return {
                ...prev,
                [stepId]: {
                  ...current,
                  lastError: errorMsg,
                  lastHydrationAttempt: new Date().toISOString(),
                },
              };
            });
            throw error;
          }
        })(),
        new Promise<void>((_resolve, reject) =>
          setTimeout(() => reject(new Error('Hydration timeout')), HYDRATION_TIMEOUT)
        ),
      ]);

      hydrationPromises.current[stepId] = hydrationPromise;

      try {
        await hydrationPromise;
      } finally {
        // Clean up promise reference after completion/error
        delete hydrationPromises.current[stepId];
      }
    },
    []
  );

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
          lastError: undefined, // Clear error on successful draft update
        },
      };
    });
  }, []);

  const commitStep = useCallback(
    async (stepId: string, dependencySnapshot: string[]): Promise<{ committed: boolean; reason?: string }> => {
      // Get current record state
      let currentRecord: ScreenDraftRecord | undefined;
      await new Promise<void>((resolve) => {
        setRecords((prev) => {
          currentRecord = prev[stepId];
          resolve();
          return prev;
        });
      });

      if (!currentRecord) {
        return { committed: false, reason: 'No draft found.' };
      }

      try {
        const committedAt = new Date().toISOString();
        const committedHash = computeHash({
          stepId,
          ownerAgentId: currentRecord.ownerAgentId,
          draft: currentRecord.draft,
          draftRevision: currentRecord.draftRevision,
          committedAt,
          dependencySnapshot,
        });

        // Security path: renderer requests main-process vault operation
        await window.api.vault.createSnapshot(`onboarding-${stepId}-${currentRecord.draftRevision}`);

        const ledger = readLedger();
        ledger[stepId] = {
          stepId,
          committedRevision: currentRecord.draftRevision,
          committedHash,
          committedAt,
        };
        writeLedger(ledger);

        // Update state atomically
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
              lastError: undefined, // Clear error on successful commit
            },
          };
        });

        return { committed: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Commit failed';
        
        // Track error in record state
        setRecords((prev) => {
          const current = prev[stepId];
          if (!current) {
            return prev;
          }
          return {
            ...prev,
            [stepId]: {
              ...current,
              lastError: errorMsg,
            },
          };
        });

        return { committed: false, reason: errorMsg };
      }
    },
    []
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
          lastError: undefined, // Clear error on reload
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
