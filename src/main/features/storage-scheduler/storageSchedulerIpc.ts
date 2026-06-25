import { ipcMain } from 'electron';
import { ServerResponse, HttpStatusCode } from 'astra';
import { storageSchedulerService } from './storageSchedulerService';
import { SyncDomain, SyncOperation } from '../sync-engine/syncEngineService';

export function registerStorageSchedulerIpcHandlers(): void {
  ipcMain.handle('storage-scheduler:status', () => {
    try {
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: storageSchedulerService.getStatus() });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('storage-scheduler:queue-depth', (_e, payload: { lane?: string }) => {
    try {
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: storageSchedulerService.getQueueDepth(payload?.lane) });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('storage-scheduler:job-list', (_e, payload?: { domain?: string; status?: string; limit?: number }) => {
    try {
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: storageSchedulerService.listJobs(payload) });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('storage-scheduler:job-get', (_e, payload: { jobId: string }) => {
    try {
      const job = storageSchedulerService.getJob(payload.jobId);
      if (!job) return ServerResponse.error({ status: HttpStatusCode.NOT_FOUND, statusMessage: `Job ${payload.jobId} not found` });
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: job });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('storage-scheduler:trigger-sync', async (_e, payload: { domain: string }) => {
    try {
      const job = await storageSchedulerService.createJob(payload.domain as SyncDomain, 'PULL' as SyncOperation, payload.domain);
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'Triggered', data: job });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('storage-scheduler:trigger-reconcile', async (_e, payload: { domain: string }) => {
    try {
      const job = await storageSchedulerService.createJob(payload.domain as SyncDomain, 'RECONCILE' as SyncOperation, payload.domain);
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'Triggered', data: job });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('storage-scheduler:cancel-job', (_e, payload: { jobId: string }) => {
    try {
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: storageSchedulerService.cancelJob(payload.jobId) });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ipcMain.handle('storage-scheduler:metrics', () => {
    try {
      return ServerResponse.success({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: storageSchedulerService.getMetrics() });
    } catch (err) {
      return ServerResponse.error({ status: HttpStatusCode.INTERNAL_SERVER_ERROR, statusMessage: err instanceof Error ? err.message : 'Unknown error' });
    }
  });
}
