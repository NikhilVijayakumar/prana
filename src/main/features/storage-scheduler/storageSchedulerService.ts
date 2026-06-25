import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { ISyncEngineService, SyncDomain, SyncOperation } from '../sync-engine/syncEngineService';
import { IEventRegistry } from '../event-registry/eventRegistryService';

export type PushCallback = (channel: string, data: unknown) => void;

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
  domain: SyncDomain;
  operation: SyncOperation;
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

export interface ConflictRecord {
  conflictId: string;
  jobId: string;
  domain: SyncDomain;
  conflictType: string;
  detectedAt: string;
  resolvedAt?: string;
  resolution?: string;
  metadata?: Record<string, unknown>;
}

export type SchedulerState = 'INITIALIZING' | 'RUNNING' | 'DRAINING' | 'STOPPED';

export interface SchedulerStatusData {
  state: SchedulerState;
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

const DRAIN_TIMEOUT_MS = 30_000;
const JOB_EXPIRY_HOURS = 24;

class StorageSchedulerService {
  private state: SchedulerState = 'INITIALIZING';
  private db: Database.Database | null = null;
  private syncEngine: ISyncEngineService | null = null;
  private events: IEventRegistry | null = null;
  private runningJobs = new Set<string>();
  private pushCallback: PushCallback | null = null;

  initialize(
    db: Database.Database,
    syncEngine: ISyncEngineService,
    events: IEventRegistry,
    pushCallback?: PushCallback
  ): void {
    this.db = db;
    this.syncEngine = syncEngine;
    this.events = events;
    this.pushCallback = pushCallback ?? null;
    this.recoverJobs();
    this.state = 'RUNNING';
  }

  private recoverJobs(): void {
    if (!this.db) return;
    const staleJobs = this.db
      .prepare(
        `SELECT * FROM storage_jobs WHERE status IN ('CLAIMED','RUNNING')`
      )
      .all() as StorageJob[];

    for (const job of staleJobs) {
      this.db
        .prepare(`UPDATE storage_jobs SET status='QUEUED', claimed_at=NULL WHERE job_id=?`)
        .run(job.jobId);
    }
  }

  async createJob(
    domain: SyncDomain,
    operation: SyncOperation,
    payloadRef: string,
    options?: { priority?: number; maxRetries?: number }
  ): Promise<StorageJob> {
    if (!this.db) throw new Error('Scheduler not initialized');

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + JOB_EXPIRY_HOURS * 3600 * 1000).toISOString();
    const job: StorageJob = {
      jobId: randomUUID(),
      domain,
      operation,
      status: 'CREATED',
      priority: options?.priority ?? 5,
      payloadRef,
      retryCount: 0,
      maxRetries: options?.maxRetries ?? 3,
      createdAt: now,
      expiresAt,
      lane: domain
    };

    this.db
      .prepare(
        `INSERT INTO storage_jobs
         (job_id, domain, operation, status, priority, payload_ref, retry_count, max_retries, created_at, expires_at, lane)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        job.jobId,
        job.domain,
        job.operation,
        job.status,
        job.priority,
        job.payloadRef,
        job.retryCount,
        job.maxRetries,
        job.createdAt,
        job.expiresAt,
        job.lane
      );

    this.updateJobStatus(job.jobId, 'QUEUED');
    void this.dispatchJob(job.jobId);
    return { ...job, status: 'QUEUED' };
  }

  private async dispatchJob(jobId: string): Promise<void> {
    if (!this.db || !this.syncEngine || this.state !== 'RUNNING') return;

    const row = this.db.prepare(`SELECT * FROM storage_jobs WHERE job_id=?`).get(jobId) as StorageJob | undefined;
    if (!row || row.status !== 'QUEUED') return;

    this.updateJobStatus(jobId, 'CLAIMED', { claimedAt: new Date().toISOString() });
    this.updateJobStatus(jobId, 'RUNNING');
    this.runningJobs.add(jobId);

    try {
      const result = await this.syncEngine.dispatch({
        jobId,
        domain: row.domain,
        operation: row.operation,
        payloadRef: row.payloadRef
      });

      if (result.success) {
        this.updateJobStatus(jobId, 'COMPLETED', { completedAt: new Date().toISOString() });

        if (result.requiresReconcile) {
          await this.createJob(row.domain, 'RECONCILE', row.payloadRef);
        }
      } else {
        await this.handleJobFailure(row, result.reason ?? 'unknown');
      }
    } catch (err) {
      await this.handleJobFailure(row, err instanceof Error ? err.message : String(err));
    } finally {
      this.runningJobs.delete(jobId);
    }

    this.pushJobUpdate(jobId);
  }

  private async handleJobFailure(job: StorageJob, reason: string): Promise<void> {
    if (!this.db) return;

    if (job.retryCount < job.maxRetries) {
      this.db
        .prepare(
          `UPDATE storage_jobs SET status='RETRY_PENDING', retry_count=retry_count+1, error_reason=? WHERE job_id=?`
        )
        .run(reason, job.jobId);
      this.updateJobStatus(job.jobId, 'QUEUED');
      void this.dispatchJob(job.jobId);
    } else {
      this.updateJobStatus(job.jobId, 'FAILED', {
        failedAt: new Date().toISOString(),
        errorReason: reason
      });
      this.pushTerminalFailure(job.jobId);
      try {
        this.events?.emit({
          eventType: 'storage:scheduler:terminal-failure',
          source: 'storageScheduler',
          payload: { jobId: job.jobId, domain: job.domain, reason }
        });
      } catch { /* ignore */ }
    }
  }

  private updateJobStatus(
    jobId: string,
    status: JobStatus,
    extra?: { claimedAt?: string; completedAt?: string; failedAt?: string; errorReason?: string }
  ): void {
    if (!this.db) return;
    const updates = [`status=?`];
    const params: unknown[] = [status];

    if (extra?.claimedAt) { updates.push('claimed_at=?'); params.push(extra.claimedAt); }
    if (extra?.completedAt) { updates.push('completed_at=?'); params.push(extra.completedAt); }
    if (extra?.failedAt) { updates.push('failed_at=?'); params.push(extra.failedAt); }
    if (extra?.errorReason) { updates.push('error_reason=?'); params.push(extra.errorReason); }

    params.push(jobId);
    this.db.prepare(`UPDATE storage_jobs SET ${updates.join(', ')} WHERE job_id=?`).run(...params);
  }

  private pushJobUpdate(jobId: string): void {
    if (!this.db || !this.pushCallback) return;
    const job = this.db.prepare(`SELECT * FROM storage_jobs WHERE job_id=?`).get(jobId);
    this.pushCallback('storage-scheduler:job-updated', job);
  }

  private pushTerminalFailure(jobId: string): void {
    if (!this.db || !this.pushCallback) return;
    const job = this.db.prepare(`SELECT * FROM storage_jobs WHERE job_id=?`).get(jobId);
    this.pushCallback('storage-scheduler:terminal-failure', job);
  }

  getStatus(): SchedulerStatusData {
    return { state: this.state };
  }

  getQueueDepth(lane?: string): QueueDepthData {
    if (!this.db) return { lanes: {} };

    if (lane) {
      const count = (this.db
        .prepare(`SELECT COUNT(*) as count FROM storage_jobs WHERE status='QUEUED' AND lane=?`)
        .get(lane) as { count: number }).count;
      return { lanes: { [lane]: count } };
    }

    const rows = this.db
      .prepare(`SELECT lane, COUNT(*) as count FROM storage_jobs WHERE status='QUEUED' GROUP BY lane`)
      .all() as Array<{ lane: string; count: number }>;

    return { lanes: Object.fromEntries(rows.map((r) => [r.lane, r.count])) };
  }

  listJobs(filters?: { domain?: string; status?: string; limit?: number }): StorageJob[] {
    if (!this.db) return [];
    let query = 'SELECT * FROM storage_jobs WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.domain) { query += ' AND domain=?'; params.push(filters.domain); }
    if (filters?.status) { query += ' AND status=?'; params.push(filters.status); }
    query += ' ORDER BY priority ASC, created_at ASC';
    if (filters?.limit) { query += ' LIMIT ?'; params.push(filters.limit); }

    return this.db.prepare(query).all(...params) as StorageJob[];
  }

  getJob(jobId: string): StorageJob | null {
    if (!this.db) return null;
    return (this.db.prepare(`SELECT * FROM storage_jobs WHERE job_id=?`).get(jobId) as StorageJob) ?? null;
  }

  cancelJob(jobId: string): boolean {
    if (!this.db) return false;
    const job = this.getJob(jobId);
    if (!job || !['CREATED', 'QUEUED'].includes(job.status)) return false;
    this.updateJobStatus(jobId, 'CANCELLED');
    return true;
  }

  getMetrics(): SchedulerMetricsData {
    const queueDepth = this.getQueueDepth();
    if (!this.db) return { queueDepth, activeJobs: 0, completedJobs: 0, failedJobs: 0 };

    const active = (this.db
      .prepare(`SELECT COUNT(*) as c FROM storage_jobs WHERE status IN ('CLAIMED','RUNNING')`)
      .get() as { c: number }).c;
    const completed = (this.db
      .prepare(`SELECT COUNT(*) as c FROM storage_jobs WHERE status='COMPLETED'`)
      .get() as { c: number }).c;
    const failed = (this.db
      .prepare(`SELECT COUNT(*) as c FROM storage_jobs WHERE status='FAILED'`)
      .get() as { c: number }).c;

    return { queueDepth, activeJobs: active, completedJobs: completed, failedJobs: failed };
  }

  async drain(): Promise<void> {
    this.state = 'DRAINING';
    const deadline = Date.now() + DRAIN_TIMEOUT_MS;
    while (this.runningJobs.size > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }
    this.state = 'STOPPED';
  }
}

export const storageSchedulerService = new StorageSchedulerService();
