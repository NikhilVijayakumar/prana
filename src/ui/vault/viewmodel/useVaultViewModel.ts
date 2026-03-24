import { useEffect } from 'react';
import { useDataState } from 'astra';
import { VaultRepo, VaultFile } from '../repo/VaultRepo';
import { useState } from 'react';

export const useVaultViewModel = () => {
  const repo = new VaultRepo();
  const [vaultState, executeFetch] = useDataState<VaultFile[]>();
  const [isIngesting, setIsIngesting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastIngestedCount, setLastIngestedCount] = useState(0);
  const [publishMessage, setPublishMessage] = useState('');

  const loadVault = async () => {
    await executeFetch(() => repo.fetchVaultContents());
  };

  const ingestFromDialog = async () => {
    if (isIngesting) return;
    setIsIngesting(true);
    try {
      const ingestResp = await repo.selectAndIngestFiles();
      const ingestedCount = ingestResp.data?.length ?? 0;
      setLastIngestedCount(ingestedCount);
      if (ingestedCount > 0) {
        setPublishMessage('Vault archive saved locally. Approve to commit and push to the data repository.');
      }
      await loadVault();
    } finally {
      setIsIngesting(false);
    }
  };

  const approveAndPublish = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      const result = await repo.publishVaultChanges(true);
      setPublishMessage(result.message);
      await loadVault();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish vault changes.';
      setPublishMessage(message);
    } finally {
      setIsPublishing(false);
    }
  };

  useEffect(() => {
    loadVault();
  }, []);

  return {
    state: vaultState,
    reload: loadVault,
    ingestFromDialog,
    approveAndPublish,
    isIngesting,
    isPublishing,
    lastIngestedCount,
    publishMessage,
  };
};
