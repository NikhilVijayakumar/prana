import { useDataState, ServerResponse, HttpStatusCode } from 'astra';
import { storageSchedulerRepository } from '../repo/storageSchedulerRepository';
import { SchedulerMetricsData, StorageJob } from '../model/storageScheduler.types';

interface SchedulerState {
  metrics: SchedulerMetricsData | null;
}

interface JobListState {
  jobs: StorageJob[];
}

export function useSchedulerMetrics() {
  const [appState, execute] = useDataState<SchedulerState>();

  const load = () =>
    execute(async () => {
      const response = await storageSchedulerRepository.getMetrics();
      if (response.isError) {
        return ServerResponse.error<SchedulerState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<SchedulerState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { metrics: response.data as SchedulerMetricsData } });
    });

  return { appState, load };
}

export function useSchedulerJobs() {
  const [appState, execute] = useDataState<JobListState>();

  const load = (filters?: { domain?: string; status?: string; limit?: number }) =>
    execute(async () => {
      const response = await storageSchedulerRepository.listJobs(filters);
      if (response.isError) {
        return ServerResponse.error<JobListState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<JobListState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { jobs: (response.data ?? []) as StorageJob[] } });
    });

  const triggerSync = (domain: string) =>
    execute(async () => {
      const triggerResponse = await storageSchedulerRepository.triggerSync(domain);
      if (triggerResponse.isError) {
        return ServerResponse.error<JobListState>({ status: triggerResponse.status, statusMessage: triggerResponse.statusMessage });
      }
      const response = await storageSchedulerRepository.listJobs();
      if (response.isError) {
        return ServerResponse.error<JobListState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<JobListState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { jobs: (response.data ?? []) as StorageJob[] } });
    });

  const triggerReconcile = (domain: string) =>
    execute(async () => {
      const triggerResponse = await storageSchedulerRepository.triggerReconcile(domain);
      if (triggerResponse.isError) {
        return ServerResponse.error<JobListState>({ status: triggerResponse.status, statusMessage: triggerResponse.statusMessage });
      }
      const response = await storageSchedulerRepository.listJobs();
      if (response.isError) {
        return ServerResponse.error<JobListState>({ status: response.status, statusMessage: response.statusMessage });
      }
      return ServerResponse.success<JobListState>({ status: HttpStatusCode.SUCCESS, statusMessage: 'OK', data: { jobs: (response.data ?? []) as StorageJob[] } });
    });

  return { appState, load, triggerSync, triggerReconcile };
}
