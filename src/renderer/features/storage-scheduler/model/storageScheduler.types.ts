export type JobStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'CLAIMED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRY_PENDING'
  | 'CANCELLED'
  | 'EXPIRED';

export interface StorageJob {
  jobId: string;
  domain: string;
  operation: string;
  status: JobStatus;
  priority: number;
  payloadRef: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  claimedAt?: string;
  completedAt?: string;
  failedAt?: string;
  expiresAt?: string;
  errorReason?: string;
  lane: string;
}

export interface SchedulerStatusData {
  state: 'INITIALIZING' | 'RUNNING' | 'DRAINING' | 'STOPPED';
}

export interface QueueDepthData {
  lanes: Record<string, number>;
}

export interface SchedulerMetricsData {
  queueDepth: QueueDepthData;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
}
