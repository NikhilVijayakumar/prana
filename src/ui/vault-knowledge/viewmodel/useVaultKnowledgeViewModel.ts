import { useEffect, useState } from 'react';
import { useDataState } from 'astra';
import {
  VaultKnowledgeRepo,
  VaultFileContent,
  VaultPayload,
  MemorySearchPayload,
  MemoryHealthPayload,
} from '../repo/VaultKnowledgeRepo';
import { useFailFastAsync } from 'prana/ui/common/errors/useFailFastAsync';

export const useVaultKnowledgeViewModel = () => {
  const repo = new VaultKnowledgeRepo();
  const { fatalError, clearFatalError, runSafely } = useFailFastAsync('viewmodel');
  const [vaultState, executeLoad] = useDataState<VaultPayload>();
  const [previewState, executePreviewLoad] = useDataState<VaultFileContent>();
  const [memoryState, executeMemorySearch] = useDataState<MemorySearchPayload>();
  const [memoryHealthState, executeMemoryHealthLoad] = useDataState<MemoryHealthPayload>();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isApplyingAction, setIsApplyingAction] = useState(false);
  const [memoryQuery, setMemoryQuery] = useState('');
  const [isReindexingMemory, setIsReindexingMemory] = useState(false);

  const loadSnapshot = async () => {
    await runSafely(() => executeLoad(() => repo.getVaultData()), {
      category: 'ipc',
      title: 'Vault Knowledge Load Error',
      userMessage: 'Vault knowledge data could not be loaded.',
      swallow: true,
    });
    await runSafely(() => executeMemoryHealthLoad(() => repo.getMemoryHealth()), {
      category: 'ipc',
      title: 'Memory Health Load Error',
      userMessage: 'Memory health data could not be loaded.',
      swallow: true,
    });
  };

  useEffect(() => {
    loadSnapshot();
  }, []);

  const previewFile = async (relativePath: string) => {
    setSelectedPath(relativePath);
    await runSafely(() => executePreviewLoad(() => repo.readFile(relativePath)), {
      category: 'ipc',
      title: 'File Preview Error',
      userMessage: 'The selected file could not be previewed.',
      swallow: true,
    });
  };

  const approvePending = async (relativePath: string) => {
    if (isApplyingAction) return;
    setIsApplyingAction(true);
    try {
      await repo.approve(relativePath);
      await loadSnapshot();
    } catch (error) {
      await runSafely(
        async () => {
          throw error;
        },
        {
          category: 'ipc',
          title: 'Approve Pending Error',
          userMessage: 'Pending file approval failed.',
          swallow: true,
        },
      );
    } finally {
      setIsApplyingAction(false);
    }
  };

  const rejectPending = async (relativePath: string) => {
    if (isApplyingAction) return;
    setIsApplyingAction(true);
    try {
      await repo.reject(relativePath);
      await loadSnapshot();
    } catch (error) {
      await runSafely(
        async () => {
          throw error;
        },
        {
          category: 'ipc',
          title: 'Reject Pending Error',
          userMessage: 'Pending file rejection failed.',
          swallow: true,
        },
      );
    } finally {
      setIsApplyingAction(false);
    }
  };

  const searchMemory = async (query: string) => {
    setMemoryQuery(query);
    if (!query.trim()) {
      return;
    }
    await runSafely(() => executeMemorySearch(() => repo.searchMemory(query)), {
      category: 'ipc',
      title: 'Memory Search Error',
      userMessage: 'Memory search could not be completed.',
      swallow: true,
    });
  };

  const reindexMemory = async () => {
    if (isReindexingMemory) {
      return;
    }
    setIsReindexingMemory(true);
    try {
      await repo.reindexMemory();
      await runSafely(() => executeMemoryHealthLoad(() => repo.getMemoryHealth()), {
        category: 'ipc',
        title: 'Memory Health Refresh Error',
        userMessage: 'Memory health refresh failed after reindex.',
        swallow: true,
      });
      if (memoryQuery.trim()) {
        await runSafely(() => executeMemorySearch(() => repo.searchMemory(memoryQuery)), {
          category: 'ipc',
          title: 'Memory Search Refresh Error',
          userMessage: 'Memory search refresh failed after reindex.',
          swallow: true,
        });
      }
    } catch (error) {
      await runSafely(
        async () => {
          throw error;
        },
        {
          category: 'ipc',
          title: 'Memory Reindex Error',
          userMessage: 'Memory reindex failed.',
          swallow: true,
        },
      );
    } finally {
      setIsReindexingMemory(false);
    }
  };

  return {
    vaultState,
    previewState,
    memoryState,
    memoryHealthState,
    selectedPath,
    isApplyingAction,
    memoryQuery,
    isReindexingMemory,
    reload: loadSnapshot,
    previewFile,
    approvePending,
    rejectPending,
    searchMemory,
    reindexMemory,
    setMemoryQuery,
    moduleError: fatalError,
    clearModuleError: clearFatalError,
  };
};
