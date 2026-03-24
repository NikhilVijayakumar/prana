import { syncStoreService } from './syncStoreService';

export interface RecoveryRunSummary {
  recoveredTasks: number;
  restartedTasks: number;
}

export const recoveryOrchestratorService = {
  async recoverPendingSyncTasks(): Promise<RecoveryRunSummary> {
    const recoveredTasks = await syncStoreService.recoverInterruptedTasks();
    return {
      recoveredTasks,
      restartedTasks: recoveredTasks,
    };
  },
};
