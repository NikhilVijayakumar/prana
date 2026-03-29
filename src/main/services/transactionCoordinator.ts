import { auditLogService, AUDIT_ACTIONS } from './auditLogService';
import { registryRuntimeStoreService } from './registryRuntimeStoreService';
import { syncStoreService } from './syncStoreService';
import { vaultLifecycleManager } from './vaultLifecycleManager';
import { vaultService } from './vaultService';

const APPROVED_RUNTIME_SYNC_RECORD_KEY = 'approved_runtime_state';

export interface TransactionCoordinatorResult {
  processed: number;
  synced: number;
  deleted: number;
  failed: number;
}

export const transactionCoordinator = {
  async commitPendingRuntimeState(input: { approvedBy: string }): Promise<TransactionCoordinatorResult> {
    const pending = await syncStoreService.listSyncLineageRecords();
    const actionable = pending.filter((record) => record.syncStatus === 'PENDING_UPDATE' || record.syncStatus === 'PENDING_DELETE');

    if (actionable.length === 0) {
      return {
        processed: 0,
        synced: 0,
        deleted: 0,
        failed: 0,
      };
    }

    vaultLifecycleManager.markUnlocked();

    let synced = 0;
    let deleted = 0;
    let failed = 0;

    try {
      for (const record of actionable) {
        await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_STAGE_RECORDED, {
          workOrderId: record.recordKey,
          approvedBy: input.approvedBy,
          syncStatus: record.syncStatus,
        });

        if (record.recordKey === APPROVED_RUNTIME_SYNC_RECORD_KEY && record.syncStatus === 'PENDING_DELETE') {
          const publishResult = await vaultService.publishVaultChanges({
            approvedByUser: true,
            commitMessage: `sync: delete runtime state ${record.recordKey}`,
          });

          if (!publishResult.success || !publishResult.pushed) {
            failed += 1;
            await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_COMMIT_FAILED, {
              workOrderId: record.recordKey,
              approvedBy: input.approvedBy,
              reason: publishResult.message,
            });
            continue;
          }

          await registryRuntimeStoreService.clearApprovedRuntimeState();
          await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_DELETE_SUCCEEDED, {
            workOrderId: record.recordKey,
            approvedBy: input.approvedBy,
          });
          deleted += 1;
          continue;
        }

        if (record.recordKey === APPROVED_RUNTIME_SYNC_RECORD_KEY && record.syncStatus === 'PENDING_UPDATE') {
          const state = await registryRuntimeStoreService.getApprovedRuntimeState();
          if (!state) {
            failed += 1;
            await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_COMMIT_FAILED, {
              workOrderId: record.recordKey,
              approvedBy: input.approvedBy,
              reason: 'Approved runtime state missing during commit.',
            });
            continue;
          }

          const publishResult = await vaultService.publishVaultChanges({
            approvedByUser: true,
            commitMessage: `sync: commit runtime state ${state.committedAt}`,
          });

          if (!publishResult.success || !publishResult.pushed) {
            failed += 1;
            await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_COMMIT_FAILED, {
              workOrderId: record.recordKey,
              approvedBy: input.approvedBy,
              reason: publishResult.message,
            });
            continue;
          }

          await syncStoreService.upsertSyncLineageRecord({
            recordKey: record.recordKey,
            tableName: record.tableName,
            syncStatus: 'SYNCED',
            payload: JSON.stringify(state),
            lastModified: state.committedAt,
            vaultHash: record.payloadHash,
          });
          await auditLogService.appendTransaction(AUDIT_ACTIONS.SYNC_COMMIT_SUCCEEDED, {
            workOrderId: record.recordKey,
            approvedBy: input.approvedBy,
          });
          synced += 1;
        }
      }
    } finally {
      vaultLifecycleManager.markLocked();
    }

    return {
      processed: actionable.length,
      synced,
      deleted,
      failed,
    };
  },
};
