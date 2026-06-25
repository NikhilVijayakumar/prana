import { SchedulerStatusData, SchedulerMetricsData, StorageJob } from './storageScheduler.types';

export interface StorageSchedulerStatusState {
  status: SchedulerStatusData;
}

export interface StorageSchedulerMetricsState {
  metrics: SchedulerMetricsData;
}

export interface StorageSchedulerJobListState {
  jobs: StorageJob[];
}

export interface StorageSchedulerJobState {
  job: StorageJob;
}
