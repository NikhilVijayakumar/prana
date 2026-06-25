import { IpcService, ServerResponse } from 'astra';
import {
  SchedulerStatusData,
  QueueDepthData,
  StorageJob,
  SchedulerMetricsData
} from '../model/storageScheduler.types';

const ipc = new IpcService();

export const storageSchedulerRepository = {
  getStatus(): Promise<ServerResponse<SchedulerStatusData>> {
    return ipc.invoke('storage-scheduler:status');
  },

  getQueueDepth(lane?: string): Promise<ServerResponse<QueueDepthData>> {
    return ipc.invoke('storage-scheduler:queue-depth', { lane });
  },

  listJobs(filters?: { domain?: string; status?: string; limit?: number }): Promise<ServerResponse<StorageJob[]>> {
    return ipc.invoke('storage-scheduler:job-list', filters);
  },

  getJob(jobId: string): Promise<ServerResponse<StorageJob>> {
    return ipc.invoke('storage-scheduler:job-get', { jobId });
  },

  triggerSync(domain: string): Promise<ServerResponse<StorageJob>> {
    return ipc.invoke('storage-scheduler:trigger-sync', { domain });
  },

  triggerReconcile(domain: string): Promise<ServerResponse<StorageJob>> {
    return ipc.invoke('storage-scheduler:trigger-reconcile', { domain });
  },

  cancelJob(jobId: string): Promise<ServerResponse<boolean>> {
    return ipc.invoke('storage-scheduler:cancel-job', { jobId });
  },

  getMetrics(): Promise<ServerResponse<SchedulerMetricsData>> {
    return ipc.invoke('storage-scheduler:metrics');
  },

  onJobUpdated(callback: (data: unknown) => void): () => void {
    return ipc.receive('storage-scheduler:job-updated', callback);
  },

  onTerminalFailure(callback: (data: unknown) => void): () => void {
    return ipc.receive('storage-scheduler:terminal-failure', callback);
  }
};
