import { useEffect, useState } from 'react';
import { useDataState } from 'astra';
import {
  VaultKnowledgeRepo,
  VaultFileContent,
  VaultPayload,
  MemorySearchPayload,
  MemoryHealthPayload,
} from '../repo/VaultKnowledgeRepo';

export const useVaultKnowledgeViewModel = () => {
  const repo = new VaultKnowledgeRepo();
  const [vaultState, executeLoad] = useDataState<VaultPayload>();
  const [previewState, executePreviewLoad] = useDataState<VaultFileContent>();
  const [memoryState, executeMemorySearch] = useDataState<MemorySearchPayload>();
  const [memoryHealthState, executeMemoryHealthLoad] = useDataState<MemoryHealthPayload>();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isApplyingAction, setIsApplyingAction] = useState(false);
  const [memoryQuery, setMemoryQuery] = useState('');
  const [isReindexingMemory, setIsReindexingMemory] = useState(false);

  const loadSnapshot = async () => {
    await executeLoad(() => repo.getVaultData());
    await executeMemoryHealthLoad(() => repo.getMemoryHealth());
  };

  useEffect(() => {
    loadSnapshot();
  }, []);

  const previewFile = async (relativePath: string) => {
    setSelectedPath(relativePath);
    await executePreviewLoad(() => repo.readFile(relativePath));
  };

  const approvePending = async (relativePath: string) => {
    if (isApplyingAction) return;
    setIsApplyingAction(true);
    try {
      await repo.approve(relativePath);
      await loadSnapshot();
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
    } finally {
      setIsApplyingAction(false);
    }
  };

  const searchMemory = async (query: string) => {
    setMemoryQuery(query);
    if (!query.trim()) {
      return;
    }
    await executeMemorySearch(() => repo.searchMemory(query));
  };

  const reindexMemory = async () => {
    if (isReindexingMemory) {
      return;
    }
    setIsReindexingMemory(true);
    try {
      await repo.reindexMemory();
      await executeMemoryHealthLoad(() => repo.getMemoryHealth());
      if (memoryQuery.trim()) {
        await executeMemorySearch(() => repo.searchMemory(memoryQuery));
      }
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
  };
};
