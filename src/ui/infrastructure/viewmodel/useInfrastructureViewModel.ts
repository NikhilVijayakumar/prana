import { useEffect } from 'react';
import { useDataState } from 'astra';
import { InfrastructureRepo, InfrastructurePayload } from '../repo/InfrastructureRepo';
import { useFailFastAsync } from 'prana/ui/common/errors/useFailFastAsync';
import { useState } from 'react';

export const useInfrastructureViewModel = () => {
  const repo = new InfrastructureRepo();
  const [infraState, executeLoad] = useDataState<InfrastructurePayload>();
  const { fatalError, clearFatalError, runSafely } = useFailFastAsync('viewmodel');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isGoogleActionRunning, setIsGoogleActionRunning] = useState(false);

  const reload = async () => {
    await runSafely(() => executeLoad(() => repo.getSystemHealth()), {
      category: 'ipc',
      title: 'Infrastructure Load Error',
      userMessage: 'Infrastructure status could not be loaded.',
      swallow: true,
    });
  };

  const runGoogleAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setIsGoogleActionRunning(true);
    setActionMessage(null);

    try {
      await runSafely(action, {
        category: 'ipc',
        title: 'Google Bridge Action Error',
        userMessage: 'Google Workspace action could not be completed.',
        swallow: true,
      });
      setActionMessage(successMessage);
      await reload();
    } finally {
      setIsGoogleActionRunning(false);
    }
  };

  const runGoogleDriveSync = async () => {
    await runGoogleAction(() => repo.runGoogleDriveSync('MANUAL'), 'Google Workspace sync completed.');
  };

  const ensureGoogleDriveSyncSchedule = async () => {
    await runGoogleAction(() => repo.ensureGoogleDriveSyncSchedule(), 'Google Workspace schedule registered.');
  };

  const publishGooglePolicyDocument = async (policyId: string, htmlContent: string) => {
    await runGoogleAction(
      () => repo.publishGooglePolicyDocument(policyId, htmlContent),
      'Google policy document published.',
    );
  };

  const pullGoogleDocumentToVault = async (documentId: string, vaultTargetPath: string) => {
    await runGoogleAction(
      () => repo.pullGoogleDocumentToVault(documentId, vaultTargetPath),
      'Google document pulled to vault.',
    );
  };

  useEffect(() => {
    void reload();
  }, []);

  return {
    infraState,
    reload,
    moduleError: fatalError,
    clearModuleError: clearFatalError,
    actionMessage,
    isGoogleActionRunning,
    runGoogleDriveSync,
    ensureGoogleDriveSyncSchedule,
    publishGooglePolicyDocument,
    pullGoogleDocumentToVault,
  };
};
